import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages';
import { DATA_CREDIT_IDS } from '../../lib/dataCredits';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

/**
 * 계약: 뷰어 v2 AE-R3 PR ② — 자형 열(正 · 日) 배선 · 일본어 대조 블록 교체 · 출처(표시만, 쓰기 0).
 * 정본: VIEWER-V2-ROUNDS-001 §2·§2.1·§6 · 설계서 docs/manabi-viewer-v2-ae-r3.md §2·§4·§5·§6·§7.3·§8·§9 PR②.
 *
 * - 자형 열은 표제어 덩어리 안(일반 모드)에만 둔다. 수업 모드 TeachingWord 판서에는 넣지 않는다(설계서 Q3).
 * - 日 줄은 확인된 표기만 — 단어창은 글자 변환(toJaForm)을 부르지 않는다(설계서 §3.2, 메인 세션 결정 10-08).
 * - 일본어 대조 블록은 없앤다. diff·warn은 「더 알아보기 · 일본어로는」 한 줄, AI 찾기는 그 줄의 요청 버튼(「AI」 표 없음 —
 *   오너 결정 10-07 23:45 KST).
 * - 日 줄이 JMdict 파생 표에서 왔을 때만 카드 출처 줄(/credits#jmdict) — EDRDG 화면별 표기 조건(설계서 §6 O1 보수안).
 * - 표: 중국어 자료를 열면 유휴 시간에 정체 표·일본어 표기 표를 미리 받고, 일본식 자형 표(hanjaJa)는 글자 카드만(설계서 §8).
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const column = read('src/components/viewer/ViewerGlyphColumn.jsx');
const more = read('src/components/viewer/ViewerJapaneseMore.jsx');
const css = read('src/components/viewer/reader-controls.css');
const card = sliceBetween(viewer, 'const renderWordDetailCard = (classAction=null,classMeaning=null) => !selectedToken || !isSheetOpen ? null : (', 'const renderRightPanelContent =');

describe('자형 열 배선 — 표제어 덩어리 안, 일반 모드만', () => {
  it('正·日 판정은 PR ① 순수 함수 하나(glyphRows)에 표제어(기본형)·정체 표·사전 행·일본어 표기 표를 넘긴다', () => {
    expect(viewer).toMatch(/import \{[^}]*\bglyphRows\b[^}]*\} from '\.\.\/lib\/glyphColumn'/);
    expect(viewer).toContain('glyphRows({ word: headText, tradTable: hanjaTradTable, dictEntry: editDictEntry, jaTable: jaWordsTable })');
    expect(viewer).toContain("import ViewerGlyphColumn from '../components/viewer/ViewerGlyphColumn'");
  });

  it('열은 표제어 word-fit-wrap 안(표제어 바로 옆·아래)에 있고, 수업 모드 판서 분기에는 없다', () => {
    const head = sliceBetween(card, '<div className="reader-card-headword">', '<div className={`word-detail-card__meaningrow');
    expect(head).toContain('<div className="word-fit-wrap">');
    expect(head).toContain('<ViewerGlyphColumn');
    expect(head.indexOf('<ViewerGlyphColumn')).toBeGreaterThan(head.indexOf('<div className="word-fit-wrap">'));
    const teaching = sliceBetween(card, 'classStudyActive?<div className="reader-teaching-word">', ':<div className="reader-card-headword">');
    expect(teaching).not.toContain('ViewerGlyphColumn');
    // 표제어 옆 1곳(+ 첫 화면 우선 2단계의 正 한 칸) · 뜻 줄 아래 1곳 — 셋 다 수업 모드 판서 밖
    expect(card.match(/<ViewerGlyphColumn/g)).toHaveLength(3);
  });

  // 메인 세션 결정(10-08): 안 2가 390 첫 화면(표제어·이 문장 뜻 줄·하단)을 깨면 결함이다 — 우선순위 표제어·뜻·하단 > 자형 표.
  it('첫 화면 우선 — 뜻 줄이 밀리면 1단계 문장 줄 2줄 예산, 2단계 자형 표를 뜻 줄 아래로(표제어 옆엔 正 한 칸), 접힘 0', () => {
    expect(column).toContain("const meaning = body?.querySelector('.word-detail-card__meaning');");
    expect(column).toMatch(/onBudget\(budgetStep \+ 1\)/);
    expect(viewer).toContain('cardSentenceOf(selectedToken, glyphStep >= 1)');
    expect(viewer).toContain('clipSentenceToBudget(found, tight ? { budget: SENTENCE_LINE_BUDGET_TIGHT } : undefined)');
    expect(card).toContain('data-tight={glyphStep >= 1 || undefined}');
    expect(css.replace(/\s+/g, ' ')).toMatch(/\.reader-card-sentence\[data-tight\] \{-webkit-line-clamp:2;line-clamp:2;\}/);
    const below = sliceBetween(card, '{/* 첫 화면 우선 2단계', '{/* 사전 뜻 줄 교정 직후');
    expect(below).toContain('forceLayout="stack"');
    expect(below).not.toMatch(/<details|aria-expanded/);
    expect(card.indexOf('{/* 첫 화면 우선 2단계')).toBeGreaterThan(card.indexOf("refMeaning || selectedToken.meaning || '(뜻 없음)'"));
    expect(card).toContain('sideOnly onSideMiss');
  });

  it('표 칸 정렬은 표제어 글자 자리(data-glyph-i)를 잰다 — 셀 순서 = 표제어 코드포인트 순서', () => {
    expect(card).toContain('data-glyph-i={i}');
    expect(column).toContain('[data-glyph-i]');
  });

  it('正 줄 lang="zh-Hant-TW"(Noto Sans TC) · 日 줄 lang="ja", 라벨은 한자 한 글자 正 · 日', () => {
    expect(column).toContain('lang="zh-Hant-TW"');
    expect(column).toContain('lang="ja"');
    expect(column).toMatch(/>正</);
    expect(column).toMatch(/>日</);
  });

  it('안 1/안 2는 폭으로 판정한다 — glyphColumnLayout(em 추정) + 컨테이너 폭 읽기(그리기 전) + 크기 변화 재판정', () => {
    expect(column).toMatch(/import \{[^}]*\bglyphColumnLayout\b[^}]*\} from '\.\.\/\.\.\/lib\/glyphColumn'/);
    expect(column).toContain('useLayoutEffect(');
    expect(column).toContain('ResizeObserver');
  });

  it('초록 칠은 토큰 색(--reader-accent)이고, 안 1 = 다른 글자 점선 밑줄 · 안 2 = 같은 글자 흐림 0.45', () => {
    const rules = css.replace(/\s+/g, ' ');
    expect(rules).toMatch(/\.reader-card-glyph__ch\.is-diff \{[^}]*color: ?var\(--reader-accent\)/);
    expect(rules).toMatch(/\.reader-card-glyph:is\(\[data-layout="side"\],\[data-layout="stack"\]\) \.reader-card-glyph__ch\.is-diff \{[^}]*text-decoration[^}]*dotted/);
    expect(rules).toMatch(/\.reader-card-glyph\[data-layout="table"\] \.reader-card-glyph__ch\.is-same \{[^}]*opacity: ?\.45/);
    expect(rules).toMatch(/\.reader-card-glyph__yomi \{[^}]*white-space: ?nowrap/);
  });
});

describe('日 줄은 확인된 표기만 — 단어창은 글자 변환을 부르지 않는다', () => {
  it('ViewerPage·자형 열·일본어로는 줄에 toJaForm( 호출 0', () => {
    for (const [name, src] of [['ViewerPage', viewer], ['ViewerGlyphColumn', column], ['ViewerJapaneseMore', more]]) {
      expect(src, name).not.toMatch(/\btoJaForm\s*\(/);
    }
  });

  it('일본식 자형 표(hanjaJa)는 글자 카드를 열 때만 받는다 — 시트 열림 조건이 없다', () => {
    const effect = sliceBetween(viewer, "import('../lib/data/hanjaJa.json')", '}, [');
    expect(viewer).toMatch(/if \(hanjaJaTable \|\| !inspectChar\) return undefined;/);
    expect(effect).not.toContain('isSheetOpen');
  });

  it('중국어 자료를 열면 유휴 시간에 정체 표·일본어 표기 표를 미리 받는다(한·일·영 자료는 받지 않는다)', () => {
    expect(viewer).toMatch(/import \{[^}]*\bprefetchGlyphTables\b[^}]*\} from '\.\.\/lib\/glyphTables'/);
    const prefetch = sliceBetween(viewer, 'prefetchGlyphTables({', '});');
    expect(prefetch).toContain('onLoad');
    const effect = sliceBetween(viewer, "if (materialLang !== 'Chinese') return undefined;", '}, [materialLang]);');
    expect(effect).toContain('prefetchGlyphTables({');
  });
});

describe('일본어 대조 블록 제거 → 더 알아보기 「일본어로는」 한 줄(표시만, 쓰기 0)', () => {
  it('블록 컴포넌트와 마운트가 없다', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/components/viewer/ViewerJapaneseReference.jsx'))).toBe(false);
    expect(viewer).not.toContain('ViewerJapaneseReference');
    expect(viewer).not.toContain('jaFormError');
  });

  it('「일본어로는」 줄은 더 알아보기 안 — 日 줄이 숨겨졌을 때(수업 모드는 자형 열이 없으므로 항상) 사전 diff/warn · 요청 버튼', () => {
    const learn = sliceBetween(card, 'className="reader-card-learn"', '</section>');
    expect(learn).toContain('<ViewerJapaneseMore');
    expect(learn).toMatch(/materialLang === 'Chinese' && \(classStudyActive \|\| !glyph\.ja\) && <ViewerJapaneseMore/);
    // 사전 diff/warn은 뜻별 매칭(japaneseReferenceForMeaning), 버튼은 기존 클라 AI(lookupJapaneseReference) 그대로
    expect(more).toContain('japaneseReferenceForMeaning(');
    expect(more).toContain('lookupJapaneseReference(');
    expect(more).toContain('reader-card-learn__ask');
    // 쓰기 0: 저장·변이 경로가 없다(요미 받기·빈 칸 저장은 PR ③)
    expect(more).not.toMatch(/useMutation|(?<![.\w])fetch\(|supabase|\/api\/dictionary/);
  });

  it('「AI」 표시가 없다(오너 결정) — 자형 열·일본어로는 줄·카드 조각에 AI 문자열 0', () => {
    for (const [name, src] of [['ViewerGlyphColumn', column], ['ViewerJapaneseMore', more]]) {
      expect(src, name).not.toMatch(/>\s*AI\s*</);
      expect(src, name).not.toMatch(/['"]AI['"]/);
      expect(src, name).not.toContain('AI 대응어');
    }
    expect(card).not.toMatch(/>\s*AI\s*</);
  });
});

describe('출처 — JMdict(EDRDG, CC BY-SA 4.0)', () => {
  it('日 줄이 JMdict 파생 표에서 온 카드에만 출처 줄 한 줄 → /credits#jmdict', () => {
    expect(card).toMatch(/glyph\.ja\?\.source === 'jmdict' && [^\n]*reader-card-credit/);
    expect(card).toContain('href="/credits#jmdict"');
    expect(DATA_CREDIT_IDS).toContain('jmdict');
    expect(read('src/lib/dataCredits.js')).toMatch(/JMdict[^\n]*카드 출처 줄|카드 출처 줄[^\n]*JMdict/);
  });
});

describe('새 문구 — viewerMessages ko · zh-CN · zh-TW', () => {
  it.each(['일본어로는', '✦ 일본어로는?', '같은 한자 표기는 일본어에서 ‘{meaning}’라는 뜻이에요.', '일본어 읽기 · JMdict (EDRDG) · CC BY-SA 4.0', '대만 정체', '일본어 표기'])('%s', (key) => {
    for (const locale of VIEWER_MESSAGE_LOCALES) expect(VIEWER_MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
    expect(VIEWER_MESSAGES['zh-CN'][key]).not.toBe(key);
  });
});
