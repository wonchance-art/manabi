import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const css = read('src/index.css');
// 카드 렌더 본체 — 정의 시작부터 패널 조립 직전까지
const card = sliceBetween(viewer, 'const renderWordDetailCard = (classAction=null,classMeaning=null) => !selectedToken || !isSheetOpen ? null : (', 'const renderRightPanelContent =');

/**
 * 계약: 단어 카드 재배치 R2 (오너 확정 2026-09-02, #1077 5504878570).
 * 오너 보고 「동사 · 道歉」은 품사 오염이 아니라 「품사 · 기본형」 연결이 겸류 구분자와 같은 모양.
 * 더 큰 결함 = 이합사 조각을 탭하면 표제어(道·「길 도」)와 뜻(사과하다)이 다른 단어.
 * → 표제어 = 기본형(탭한 조각만 강조) · 메타 줄 위치 고정 · 순서 뜻 → 日 → 예문(mark) → 유의어 → 한자 ·
 *   액션 4단 → 2단. 토큰 데이터·저장 행 무변경(R4a·저장 계약 무회귀).
 */
describe('단어 카드 R2 — 표제어·순서·액션 (ViewerPage)', () => {
  it('표면 ≠ 기본형이면 표제어 문자열이 기본형(selectedLexKey)이고 탭한 구간에 강조 클래스가 붙는다', () => {
    expect(viewer).toContain('const headText = selectedToken && selectedLexKey && selectedLexKey !== selectedToken.text ? selectedLexKey : selectedToken?.text;');
    expect(viewer).toContain("import { pickedRangeOf } from '../lib/headwordPick';");
    expect(viewer).toContain('const headPicked = headIsBase ? pickedRangeOf(headText, selectedToken.text) : null;');
    expect(card).toContain('splitRuby(headText, headReading)');
    expect(card).toContain('[...headText].map((ch, j) => charSpan(ch, `p:${j}`, null, j))');
    expect(card).toMatch(/isPickedAt\(i\) \? ' word-fit__char--picked' : ''/);
    expect(css).toMatch(/\.word-fit__char--picked \{[^}]*background/);
    // 표면형으로 표제어를 그리는 옛 경로 부활 금지
    expect(card).not.toContain('splitRuby(selectedToken.text, selectedToken.furigana)');
    expect(card).not.toContain('[...selectedToken.text].map');
  });

  it('기본형 읽기는 사전 reading — 표면 ≠ 기본형이면 token-dict 조회가 켜지고, 없으면 폴백만 남는다', () => {
    expect(viewer).toContain("(!!selectedToken && !!selectedLexKey && selectedLexKey !== selectedToken.text)) && !!selectedDictKey");
    expect(viewer).toContain('const headReading = headIsBase ? (editDictEntry?.reading || null) : selectedToken?.furigana;');
    expect(viewer).toContain('const headFallback = headIsBase && dictFetched && !editDictEntry?.reading;');
  });

  it('표제어 아래 훈음 루비는 기본형 글자 기준 — hanjaHunOf(headText)', () => {
    expect(card).toContain('hanjaHunOf(headText)');
    expect(card).not.toContain('hanjaHunOf(selectedToken.text)');
  });

  it('메타 줄 — 「· 기본형」 구분자 문자열이 없고, 폴백 시에만 「기본형 …」 라벨 텍스트; 품사·급수 자리는 현행', () => {
    const meta = sliceBetween(card, '<div className="word-detail-card__meta">', '</div>');
    expect(meta).not.toContain('` · ${selectedLexKey}`');
    expect(meta).toContain('{headFallback && <span className="word-detail-card__base">기본형</span>}');
    expect(meta).toContain('<TokenPosLabel token={selectedToken} />');
    expect(meta).toContain('word-detail-card__level');
  });

  // AE-R1 개정(VIEWER-V2-ROUNDS-001 §2 순서 · §10 「블록 순서는 §2 순서로」, 설계서 §7.1):
  // 문장 줄 → 칩 줄 → 표제어 → 뜻 → 문형 → 사전 뜻 목록(예문은 그 뜻 아래) → 한자 정보 → 교재 설명 → 더 알아보기.
  // 일본어 대조는 AE-R3(자형 열)까지 사전 뜻 목록 아래에 남긴다(Q2 결정 — §0.2 회귀 없음).
  it('본문 블록 순서 — 문장 줄 → 칩 → 표제어 → 뜻 → 문형 → 사전 뜻(예문) → (日 대조) → 한자 정보 → 교재 설명 → 더 알아보기', () => {
    const at = (s) => { const i = card.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    const order = [
      at('<p className="reader-card-sentence"'),
      at('<div className="word-detail-card__actions">'),
      at('<div className="reader-card-headword">'),
      at("refMeaning || selectedToken.meaning || '(뜻 없음)'"),
      at('className="reader-card-pattern"'),
      at('senseListCount(senseGroups) > 0'),
      at('splitSentenceAroundWord(refVocab.word.ex.zh, headText, null)'),
      at('className="reader-card-senses"'),
      at('{item.example && !classStudyActive && example}'),
      at('<ViewerJapaneseReference'),
      at("<h3>{vt('한자 정보')}</h3>"),
      at('{classAction}'),
      at('className="reader-card-learn"'),
      at('className="syn-ant"'),
    ];
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1], `block ${i - 1} before ${i}`).toBeLessThan(order[i]);
    // 글자 카드(AE-R4 전까지)는 표제어 바로 아래 — 뜻보다 위(정본 §3 「위치만 표제어 바로 아래」)
    expect(at('<div className="char-inspect">')).toBeGreaterThan(at('<div className="reader-card-headword">'));
    expect(at('<div className="char-inspect">')).toBeLessThan(at("refMeaning || selectedToken.meaning || '(뜻 없음)'"));
    // 옛 블록 — 별도 훈음 목록·관련 문형 후보 제목·문장 속 쓰임 인용은 없다
    for (const gone of ['<ViewerHanjaReading', '관련 문형 후보', 'reader-card-context', '문장 속 쓰임']) expect(card).not.toContain(gone);
  });

  it('예문 강조 — 복습 카드의 정본 헬퍼로 기본형을 <mark>, 연속으로 없으면(term null) 강조 0', () => {
    expect(viewer).toMatch(/import \{[^}]*\bsplitSentenceAroundWord\b[^}]*\} from '\.\.\/lib\/constants';/);
    const ex = sliceBetween(card, '<div lang="zh-Hans">{(() => {', '})()}</div>');
    expect(ex).toContain('<mark className="review-card__highlight">{term}</mark>');
    expect(ex).toMatch(/i < arr\.length - 1/);
  });

  it('일본어 대조가 자형과 의미를 구분하며 동일 표기는 한 번만 표시한다', () => {
    const component=read('src/components/viewer/ViewerJapaneseReference.jsx');
    expect(component).toContain('japaneseReferenceForMeaning(dictEntry,meaning,{pos,form:glyphForm})');
    expect(component).toContain('ref.form===glyphForm');
    expect(component).toContain('ref&&!same');
    expect(component).toContain('같은 뜻');
  });

  it("유의어와 반의어는 구분된 줄에서 제공한다", () => {
    expect(card).toContain('className="syn-ant__row"'); expect(card).toContain('renderSynAntChips(synAnt.syn)'); expect(sliceBetween(css,'.syn-ant__row {','}')).toContain('flex-direction: column');
  });

  it('액션 영역 — 전폭 단독 버튼 0, 아는 단어 토글은 안내 줄 하나', () => {
    // 기존 저장/게스트 줄 유지. 오너 정정으로 known 취소의 중복 줄은 안내 줄 토글에 통합.
    expect(card.match(/className="word-detail-card__actrow"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(card).toContain('aria-pressed={selectedKnown}');
    expect(card).not.toContain('아는 말로 표시됨 — 취소');
    expect(card).not.toContain("style={{ width: '100%', marginBottom: 12 }}");
    expect(card).not.toContain("style={{ width: '100%' }}");
    expect(card).not.toContain("style={{ width: '100%', marginTop: 6");
    expect(css).toContain('.word-detail-card__actrow > .btn { flex: 1; min-width: 0; }');
    // AE-R1 개정(정본 §2.1 「더 알아보기 = 요청 버튼」·「없어지는 것: 이 문장에서는?」, 설계서 §7.1):
    // 자세한 설명은 같은 핸들러(fetchWordDetail)를 「✦ 자세한 설명」이 부르고, 「이 문장에서는?」·「상세 설명 보기」는 없다.
    for (const s of ['fetchWordDetail(selectedToken)', 'vt("✦ 자세한 설명")', 'vt("✦ 비슷한 말 찾기")', "'✓ 단어장에 있음'"]) {
      expect(card).toContain(s);
    }
    for (const s of ['runCtxExplain(', '상세 설명 보기']) expect(card).not.toContain(s);
  });

  // ── AE-R1 PR②(VIEWER-V2-ROUNDS-001 §2.1 · §3 합격, 설계서 §7.3) ──
  it('접힘 0 — 일반 모드 카드에 <details>·aria-expanded={false}가 없다(수업 분기만 예외)', () => {
    expect(card).not.toMatch(/aria-expanded=\{false\}/);
    const opens = [...card.matchAll(/<details\b/g)].map((m) => m.index);
    for (const i of opens) {
      // 남는 details는 수업 분기(classStudyActive?…)뿐 — 바로 앞 500자 안에 수업 분기 조건이 있어야 한다.
      expect(card.lastIndexOf('classStudyActive', i), card.slice(Math.max(0, i - 120), i + 60)).toBeGreaterThan(i - 500);
    }
    // 유의어 details·교재 설명 details(일반 모드)는 없다
    expect(card).not.toContain('onToggle=');
    expect(viewer).not.toContain('<details className="reader-card-notes"');
  });

  it('문구 0 — 단어 탭에 「번역」·「이 문장에서는?」·「이 문장에서」·「문맥상 · 사전」·「해석」 칩이 없다(보이는 텍스트·버튼 이름)', () => {
    // 툴팁 「이 문장에서는 {pos}로 쓰였어요」는 TokenPosLabel 파일(카드 조각 밖)이라 걸리지 않는다(Q5).
    for (const gone of ['vt("번역")', "vt('번역')", 'vt("문장 번역")', '이 문장에서는?', 'vt("이 문장에서")', '문맥상 · 사전', 'vt("해석")', "vt('해석')", '본문의 쓰임은']) {
      expect(card, gone).not.toContain(gone);
    }
    // 「AI」 표시 없음(오너 결정 2026-10-07 23:45 KST — Q4)
    expect(card).not.toMatch(/>\s*AI\s*</);
  });

  it('[문장] 탭 = 기존 번역 전용 경로(Q1) — 탭이 runSelectedSentence(sel, true)를 부르고, 수업 모드는 runSelectionAnalysis 그대로', () => {
    expect(viewer).toMatch(/onSentenceTab=\{openSentenceTranslation\}/);
    const handler = sliceBetween(viewer, 'const openSentenceTranslation = () => {', '\n  };');
    expect(handler).toContain('runSelectedSentence(sentence, true)');
    expect(handler).toContain('classStudyActive');
    const classAction = sliceBetween(viewer, 'const renderClassSentenceAction = () =>', '\n  );');
    expect(classAction).toContain('runSelectionAnalysis(ctxSentenceOf(selectedToken))');
    expect(card).toContain('{classStudyActive && renderClassSentenceAction()}');
    const sheet = read('src/components/ViewerBottomSheet.jsx');
    expect(sheet).toContain('onSentenceTab');
  });

  it('문장 줄 — 누른 자리 하나만 칠하는 한 문장(sentenceAroundToken), 버튼 0', () => {
    expect(viewer).toMatch(/import \{[^}]*\bsentenceAroundToken\b[^}]*\} from '\.\.\/lib\/viewerSentenceLine'/);
    const line = sliceBetween(card, '<p className="reader-card-sentence"', '</p>');
    expect(line).toContain('<mark className="reader-card-sentence__term">');
    expect(line).not.toContain('<button');
    expect(line).not.toContain('splitSentenceAroundWord');
  });

  it('사전 뜻 목록은 표시만(Q3) — buildSenseList, 누름 영역·교정 호출 0', () => {
    expect(viewer).toMatch(/import \{[^}]*\bbuildSenseList\b[^}]*\} from '\.\.\/lib\/viewerSenseList'/);
    const senses = sliceBetween(card, 'className="reader-card-senses"', '</section>');
    expect(senses).not.toMatch(/onClick|correctTokenMutation|role="button"/);
    expect(senses).toContain('reader-card-sense__context');
  });

  it('하단 — 저장(복습 전) 줄에 다음 복습 날짜(nextReviewForSavedWord), FSRS 복습 시점은 「복습 차례」(Q7)', () => {
    expect(viewer).toMatch(/import \{[^}]*\bnextReviewForSavedWord\b[^}]*\} from '\.\.\/lib\/viewerNextReview'/);
    const actions = sliceBetween(viewer, '<div className="reader-card-actions">', 'const renderRightPanelContent');
    expect(actions).toContain('save-grade__saved');
    expect(actions).toContain("vt('다음 복습 {date}'");
    expect(actions).toContain("vt('복습 차례')");
    expect(actions.match(/aria-pressed=\{selectedKnown\}/g)).toHaveLength(1);
  });

  it('토큰 데이터·저장 행 무변경 — 표제어 재배치가 저장·만남 경로에 새지 않는다', () => {
    for (const fn of ['const saveInlineVocabulary = async (token) => {', 'const addToVocab = ']) {
      const i = viewer.indexOf(fn);
      expect(i, fn).toBeGreaterThan(-1);
      expect(viewer.slice(i, i + 1500)).not.toContain('headText');
    }
    expect(viewer).not.toMatch(/processed_json[^\n]*headText/);
  });
});
