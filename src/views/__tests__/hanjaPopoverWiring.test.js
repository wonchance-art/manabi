import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { DATA_CREDIT_SECTIONS } from '../../lib/dataCredits.js';

/**
 * 계약: 한자 창 배선 — 뷰어 v2 AE-R4 PR ②(정본 VIEWER-V2-ROUNDS-001 §9 · §10 「한자 창 한 줄 · 크기 고정 · 색 연결」,
 * 설계서 docs/manabi-viewer-v2-ae-r4.md §4·§6·§7·§8·§11.4).
 *   ⑴ 중국어 일반 모드 = 한자 창, 일본어 자료·수업 판서 = 글자 카드(마크업·데이터 무변경). 설계서 §7.1의 wordCardFit 개정분.
 *   ⑵ 한자 창 머리도 R0+ 단일 조회(hanjaReadingsOf)를 거친다 — 세 경로 + 팝오버(설계서 §7.1의 hanjaKo 개정분).
 *   ⑶ 미리 받기: hanjaPanel.json = 중국어 자료를 열 때 유휴, 훈음 표 = 첫 시트 열림 유휴. 중국어 일반 모드는 자원·스토리·日 꼴
 *      표(hanjaEtym·hanjaStory·hanjaJa)를 받지 않는다. 런타임 pinyin-pro 0.
 *   ⑷ 창 동작: 비모달 dialog · Esc(문서 포착) · 바깥 누르기 · 포커스 이탈 · 포커스 복귀. 쓰기 0.
 *   ⑸ 색: --reader-sound 별칭(밝게·종이 = 황토, 어둡게 = 밝은 황토) + ui-conventions 등재. 인라인 색 0.
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const pop = read('src/components/viewer/ViewerHanjaPopover.jsx');
const css = read('src/components/viewer/reader-controls.css');

describe('⑴ 중국어 일반 모드만 한자 창 — 일본어·수업 판서는 글자 카드', () => {
  it('모드 = 중국어 && 수업 아님, 글자 카드와 한자 창이 서로 배타', () => {
    expect(viewer).toContain("const hanjaPopoverMode = materialLang === 'Chinese' && !classStudyActive;");
    expect(viewer).toContain('{inspectChar && !hanjaPopoverMode && (() => {');
    expect(viewer).toMatch(/\{inspectChar && hanjaPopoverMode && <div className="hanja-pop-layer">\s*<ViewerHanjaPopover inspect=\{inspectChar\} word=\{headText\}/);
    expect(viewer).toContain("import ViewerHanjaPopover from '../components/viewer/ViewerHanjaPopover';");
  });
  it('수업 판서 글자 탭은 지금대로 글자 카드 키(teaching:) — 한자 창으로 바꾸지 않는다(설계서 Q2)', () => {
    expect(viewer).toContain("onChar={(ch,index)=>toggleInspectChar(ch,`teaching:${index}`,null)}");
  });
  it('창은 단어창 위 층(카드 흐름 밖) — 본문 스크롤 상자 밖, 하단 뒤', () => {
    const card = sliceBetween(viewer, 'const renderWordDetailCard = ', 'const renderRightPanelContent = ');
    expect(card.indexOf('<div className="reader-card-actions">')).toBeGreaterThan(-1);
    expect(card.indexOf('className="hanja-pop-layer"')).toBeGreaterThan(card.indexOf('<div className="reader-card-actions">'));
  });
  it('표제어 글자는 창이 찾을 수 있게 data-inspect-key, 탭 동작(toggleInspectChar)은 그대로', () => {
    expect(viewer).toMatch(/data-glyph-i=\{i\}\s*data-inspect-key=\{key\}/);
    expect(viewer).toContain('onClick={() => toggleInspectChar(ch, key, reading)}');
  });
});

describe('⑵ 머리 = R0+ 단일 조회(세 경로 + 한자 창)', () => {
  it('창은 hanjaPanelModel(→ hanjaReadingsOf · zhengForm)로 머리를 그리고, 뷰어는 같은 정체 표를 넘긴다', () => {
    const model = sliceBetween(read('src/lib/viewerHanjaPanel.js'), 'export function hanjaPanelModel', '\n}');
    expect(model).toContain('hanjaReadingsOf(word, { koTable, hunTable, tradTable })');
    expect(model).toContain('zhengForm(word, tradTable)');
    expect(pop).toContain('hanjaPanelModel({ ch: inspect.ch, index, reading: inspect.reading, word, tables })');
    expect(viewer).toContain('({ koTable: hanjaKoTable, hunTable: hanjaHunTable, tradTable: hanjaTradTable, panel: hanjaPanelTable })');
  });
});

describe('⑶ 미리 받기 · 받지 않기(설계서 §8)', () => {
  it('hanjaPanel.json — 중국어 자료를 열면 유휴 시간에(prefetchHanjaPanel), 창이 먼저 열리면 바로', () => {
    expect(viewer).toMatch(/if \(materialLang !== 'Chinese' \|\| hanjaPanelTable\) return undefined;[\s\S]{0,120}prefetchHanjaPanel\(/);
    expect(viewer).toMatch(/if \(!hanjaPopoverMode \|\| !inspectChar \|\| hanjaPanelTable\) return undefined;[\s\S]{0,80}loadHanjaPanelTable\(\)/);
    expect(read('src/lib/viewerHanjaPanel.js')).toContain("import('./data/hanjaPanel.json')");
  });
  it('훈음 표 — 중국어 단어창을 처음 열 때 유휴 시간에(토글·글자 탭 즉시 로드 조건은 그대로)', () => {
    expect(viewer).toMatch(/if \(materialLang !== 'Chinese' \|\| !isSheetOpen \|\| hanjaKoTable\) return undefined;[\s\S]{0,120}onIdle\(\(\) => \{\s*import\('\.\.\/lib\/data\/hanjaKo\.json'\)[\s\S]{0,200}import\('\.\.\/lib\/data\/hanjaHun\.json'\)/);
    expect(viewer).toMatch(/\(showHanjaKo && materialLang === 'Chinese'\) \|\| inspectChar !== null/);
  });
  it('중국어 일반 모드는 자원·스토리(hanjaEtym·hanjaStory)·日 꼴(hanjaJa) 표를 받지 않는다', () => {
    expect(viewer).toContain('if (inspectChar === null || hanjaEtymTable || hanjaPopoverMode) return undefined;');
    expect(viewer).toMatch(/if \(hanjaJaTable \|\| !inspectChar\) return undefined;\s*if \(hanjaPopoverMode\) return undefined;/);
  });
  it('창은 런타임 pinyin-pro를 싣지 않는다(음절 나누기 = PR ① 순수 함수)', () => {
    expect(pop).not.toMatch(/pinyin-pro/);
    expect(read('src/lib/viewerHanjaPanel.js')).not.toMatch(/import\(['"]pinyin-pro|from ['"]pinyin-pro/);
  });
});

describe('⑷ 창 동작 · 표시만', () => {
  it('비모달 dialog, 머리가 이름, 열리면 창으로 포커스', () => {
    expect(pop).toContain('role="dialog"');
    expect(pop).toContain('aria-modal="false"');
    expect(pop).toContain('aria-labelledby={headId}');
    const focusIn = sliceBetween(pop, 'const focusedKey = useRef(null);', '}, [placed, inspect.key]);');
    expect(focusIn).toContain('ref.current?.focus({ preventScroll: true });'); // 자리가 잡힌 뒤(숨은 상자는 포커스를 못 받는다), 글자마다 한 번
  });
  it('Esc는 열린 동안 문서 포착 단계(시트 Esc보다 먼저) · 바깥 pointerdown · 포커스 이탈로 닫고, 닫을 때 그 글자로 포커스', () => {
    expect(pop).toContain("document.addEventListener('keydown', onKey, true);");
    expect(pop).toContain("document.addEventListener('pointerdown', onDown, true);");
    expect(pop).toContain('onBlur={onBlur}');
    expect(sliceBetween(pop, 'const close = useCallback(', '}, [anchorOf, onClose]);')).toContain('anchor?.focus({ preventScroll: true });');
  });
  it('✕ · ‹는 44px 누름 영역(ui-conventions §3)', () => {
    expect(css).toMatch(/\.hanja-pop :is\(\.hanja-pop__close,\.hanja-pop__back\) \{[^}]*width:44px;[^}]*height:44px;/);
  });
  it('크기 고정 — 높이는 CSS 변수 하나(기본 170 · 작은 규격 152), 창 안 줄은 한 줄(nowrap)', () => {
    expect(css).toMatch(/\.hanja-pop \{--hanja-pop-h:170px;[\s\S]*?height:var\(--hanja-pop-h\);/);
    expect(css).toContain('.hanja-pop[data-compact] {--hanja-pop-h:152px;');
    expect(pop).toContain('const HEIGHTS = [170, 152];');
    for (const sel of ['.hanja-pop__head {', '.hanja-pop__parts {', '.hanja-pop__fam {', '.hanja-pop__note {', '.hanja-pop__tile > span {']) {
      expect(sliceBetween(css, sel, '}')).toContain('white-space:nowrap');
    }
  });
  it('쓰기 0 — 창은 저장·교정·아는 단어·FSRS 경로를 부르지 않는다, 단어 타일은 버튼이 아니다(죽은 버튼 0)', () => {
    for (const w of ['mutate', 'fetch(', 'supabase', 'addToVocab', 'correctToken', 'knownState', 'fsrs']) expect(pop).not.toContain(w);
    expect(sliceBetween(pop, 'function WordTile', '\n}')).not.toContain('<button');
  });
  it('「AI」 표시 0 · 글자 카드 구획(이야기·메타·자형 칩) 0', () => {
    expect(pop).not.toMatch(/['">]AI['"<\s]/);
    for (const gone of ['char-inspect__story', 'char-inspect__meta', 'char-inspect__form', 'hanjaStory', 'hanjaEtym']) expect(pop).not.toContain(gone);
  });
});

describe('⑸ 색 — 토큰만, 소리 = --reader-sound 별칭(등재)', () => {
  it('--reader-sound: 종이·밝게 = --book-amber-main, 어둡게 = --book-amber-dark-text', () => {
    expect(css).toMatch(/\.viewer-layout \{[^}]*--reader-sound:var\(--book-amber-main\);/);
    expect(css).toMatch(/\.viewer-layout\[data-reader-theme="dark"\],[^{]*\{[^}]*--reader-sound:var\(--book-amber-dark-text\);/);
  });
  it('docs/ui-conventions.md §1에 별칭이 등재돼 있다', () => {
    const doc = read('docs/ui-conventions.md');
    const sec1 = sliceBetween(doc, '## 1. 색은 토큰으로만', '## 2.');
    expect(sec1).toContain('--reader-sound');
    expect(sec1).toContain('--book-amber-main');
    expect(sec1).toContain('--book-amber-dark-text');
  });
  it('한자 창 CSS·JSX에 색 리터럴 없음(#hex·rgb) — 그림자도 토큰 color-mix', () => {
    const block = sliceBetween(css, '/* ── 한자 창(팝오버)');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(pop).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});

describe('출처 — Unihan 쓰임에 형성자 소리 계열·대표 병음(hanjaPanel.json)', () => {
  it('dataCredits Unihan 항목', () => {
    const unihan = DATA_CREDIT_SECTIONS.flatMap((g) => g.items || []).find((x) => x.id === 'unihan');
    expect(unihan.use).toContain('형성자 소리 계열·대표 병음');
  });
});
