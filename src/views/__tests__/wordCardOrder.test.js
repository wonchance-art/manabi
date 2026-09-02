import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const css = read('src/index.css');
// 카드 렌더 본체 — 정의 시작부터 패널 조립 직전까지
const card = sliceBetween(viewer, 'const wordDetailCard = !selectedToken || !isSheetOpen ? null : (', 'const rightPanelContent =');

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
    expect(viewer).toContain("(!!selectedToken && selectedLexKey !== selectedToken.text)) && !!selectedLexKey");
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
    expect(meta).toContain('{headFallback && <span className="word-detail-card__base">기본형 {headText}</span>}');
    expect(meta).toContain('<TokenPosLabel token={selectedToken} />');
    expect(meta).toContain('word-detail-card__level');
  });

  it('본문 블록 순서 — 뜻 → 日 → 예문 → 유의어·반의어 → 한자 노트', () => {
    const at = (s) => { const i = card.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    const meaning = at("refMeaning || selectedToken.meaning || '(뜻 없음)'");
    const ja = at('formatJaRef(ja, headText, jaFormOf(headText))');
    const ex = at('splitSentenceAroundWord(refVocab.word.ex.zh, headText, null)');
    const syn = at('className="syn-ant"');
    const hanja = at('한자 · {refVocab.word.hanja}');
    expect(meaning).toBeLessThan(ja);
    expect(ja).toBeLessThan(ex);
    expect(ex).toBeLessThan(syn);
    expect(syn).toBeLessThan(hanja);
  });

  it('예문 강조 — 복습 카드의 정본 헬퍼로 기본형을 <mark>, 연속으로 없으면(term null) 강조 0', () => {
    expect(viewer).toContain("import { langNameKo, splitSentenceAroundWord } from '../lib/constants';");
    const ex = sliceBetween(card, '<div lang="zh-Hans">{(() => {', '})()}</div>');
    expect(ex).toContain('<mark className="review-card__highlight">{term}</mark>');
    expect(ex).toMatch(/i < arr\.length - 1/);
  });

  it('日 대응 — ≒ 기호를 렌더하지 않고 「≠ 다른 단어」 부제로(jaRef.js 불변)', () => {
    expect(card).toContain("const jrDiff = !!jr && jr.startsWith('≒');");
    expect(card).toContain('<span className="word-detail-card__jadiff">≠ 다른 단어</span>');
    expect(card).toContain('{jrText}</span>');
    expect(card).not.toMatch(/>\{jr\}</);
  });

  it('유의어 라벨은 칩 컨테이너의 형제 캡션 — 세로 스택', () => {
    expect(card).toContain('<span className="syn-ant__label">유의어</span>\n              <div className="syn-ant__chips">');
    expect(sliceBetween(css, '.syn-ant__row {', '}')).toContain('flex-direction: column');
    expect(css).toContain('.syn-ant__chips { display: flex; flex-wrap: wrap;');
  });

  it('액션 영역 — 전폭 단독 버튼 0, 줄(actrow) 정확히 2', () => {
    expect(card.match(/className="word-detail-card__actrow"/g)?.length).toBe(2);
    expect(card).not.toContain("style={{ width: '100%', marginBottom: 12 }}");
    expect(card).not.toContain("style={{ width: '100%' }}");
    expect(card).not.toContain("style={{ width: '100%', marginTop: 6");
    expect(css).toContain('.word-detail-card__actrow > .btn { flex: 1; min-width: 0; }');
    // 버튼 문구·핸들러는 그대로(기능 무변경)
    for (const s of ['runCtxExplain(selectedToken, ctxSentence)', 'fetchWordDetail(selectedToken)', '상세 설명 보기', "'✓ 단어장에 있음' : '단어장에 저장'", "'👌 이미 알아요'"]) {
      expect(card).toContain(s);
    }
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
