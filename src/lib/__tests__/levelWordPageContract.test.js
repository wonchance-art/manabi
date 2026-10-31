import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { exampleSegments } from '../levelListData';
import { LEVEL_WORD_STATUS } from '../levelWordStatus';

// 계약: HSK 단어 페이지(오너 확정 2026-10-19 KST · 문서 「HSK 단어 페이지」 rev 17).
// 문서의 결정 중 코드로 지킬 수 있는 것을 여기 심는다 — 상태 글자 · 네 칸 색 · 단어당 카드 하나 · 움직임 · 예문 나눔.
const read = (f) => fs.readFileSync(f, 'utf8');
const CSS = 'src/components/levels/word/level-word.css';
const PAGE_FILES = [
  'src/views/LevelWordPage.jsx', 'src/views/JlptWordPage.jsx',
  ...fs.readdirSync('src/components/levels/word').filter((f) => f.endsWith('.jsx')).map((f) => `src/components/levels/word/${f}`),
  'src/lib/useLevelWordGrade.js', 'src/lib/levelFsrsGrade.js', 'src/lib/levelWordStatus.js', 'src/lib/levelWordSession.js', 'src/lib/levelCharTiles.js',
];

describe('상태 칸 — ☆ · 담음 · 오늘 · 복습 · 졸업', () => {
  it('보이는 글자는 두 글자 이내, 화면 읽기 이름은 따로', () => {
    expect(Object.values(LEVEL_WORD_STATUS).map((s) => s.short)).toEqual(['☆', '담음', '오늘', '복습', '졸업']);
    for (const s of Object.values(LEVEL_WORD_STATUS)) {
      expect([...s.short].length).toBeLessThanOrEqual(2);
      expect(s.label.length).toBeGreaterThan(s.short.length);
    }
  });
});

describe('네 칸 색 — 복습실과 단어 페이지가 같은 등급 토큰', () => {
  const SPEC = { again: ['#a3352b', '#f8e5e3'], hard: ['#8a5a12', '#f8f0e0'], good: ['#2f6b4f', '#e6f0e9'], easy: ['#2d5f8a', '#e4ecf5'] };
  it('web-shell이 문서의 네 색(글자 · 바탕)을 한 번 정의한다', () => {
    const shell = read('src/components/web/web-shell.css');
    for (const [g, [ink, bg]] of Object.entries(SPEC)) {
      expect(shell).toContain(`--grade-${g}:${ink}`);
      expect(shell).toContain(`--grade-${g}-bg:${bg}`);
    }
  });
  it('복습실 채점 단추와 단어 페이지 네 칸이 토큰을 쓴다(색 숫자를 따로 적지 않는다)', () => {
    const room = read('src/components/web/review-room.css');
    const page = read(CSS);
    for (const g of Object.keys(SPEC)) {
      expect(room).toMatch(new RegExp(`\\.review-score-btn--${g}\\s*\\{[^}]*background:var\\(--grade-${g}-bg\\);\\s*color:var\\(--grade-${g}\\)`));
      expect(page).toMatch(new RegExp(`\\.lw-grade--${g}\\{background:var\\(--grade-${g}-bg\\)\\}`));
    }
    for (const hex of Object.values(SPEC).flat()) {
      expect(room.toLowerCase()).not.toContain(hex);
      expect(page.toLowerCase()).not.toContain(hex);
    }
  });
});

describe('단어당 카드 하나 — 새 표 없음', () => {
  it('단어 페이지가 쓰는 표는 user_vocabulary뿐(FSRS 카드는 복습실 컨트롤러가 다룬다)', () => {
    const tables = PAGE_FILES.flatMap((f) => [...read(f).matchAll(/\.from\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
    expect(new Set(tables)).toEqual(new Set(['user_vocabulary']));
  });
  it('담기는 뷰어와 같은 행 조립 · 같은 충돌 키(buildVocabRow · VOCAB_UPSERT)', () => {
    const grade = read('src/lib/useLevelWordGrade.js');
    expect(grade).toMatch(/buildVocabRow\(/);
    expect(grade).toMatch(/\.upsert\(\[row\], VOCAB_UPSERT\)/);
  });
});

describe('움직임 — 0.3초 이하 · --ease-settle · 동작 줄이기면 없음 · 진동 없음', () => {
  const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, '');
  const reduceBlocks = [...css.matchAll(/@media \(prefers-reduced-motion:reduce\)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)].map((m) => m[1]);
  const reduced = new Set(reduceBlocks.join('\n').split('{').flatMap((part, i, all) => (i < all.length - 1 ? part.split('}').pop().split(',') : [])).map((s) => s.trim()));
  const body = reduceBlocks.reduce((s, b) => s.replace(b, ''), css);
  const rules = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, sel, decl]) => ({ sel: sel.trim(), decl }))
    .filter((r) => /(?:^|;)\s*(?:animation|transition)\s*:(?!\s*none)/.test(r.decl) && !r.sel.startsWith('@'));

  it('대상이 실제로 있다(공허 통과 방지)', () => expect(rules.length).toBeGreaterThanOrEqual(10));
  it('시간은 모두 0.3초 이하', () => {
    const long = rules.flatMap((r) => [...r.decl.matchAll(/(\d*\.?\d+)(m?s)\b/g)]
      .filter(([, n, u]) => (u === 'ms' ? Number(n) / 1000 : Number(n)) > 0.3).map(() => r.sel));
    expect(long).toEqual([]);
  });
  it('곡선은 var(--ease-settle) 하나', () => {
    expect(rules.filter((r) => !/var\(--ease-settle\)/.test(r.decl)).map((r) => r.sel)).toEqual([]);
  });
  it('움직이는 선택자는 모두 동작 줄이기 블록에 있다', () => {
    const missing = rules.filter((r) => !r.sel.startsWith('::view-transition'))
      .flatMap((r) => r.sel.split(',').map((s) => s.trim())).filter((s) => !reduced.has(s));
    expect(missing).toEqual([]);
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{::view-transition-old\(root\),::view-transition-new\(root\)\{animation:none\}\}/);
  });
  it('JS가 붙이는 움직임(시트 닫힘 · 모드 전환 · 알림)도 reducedMotion()을 거친다', () => {
    expect(read('src/components/levels/word/WordSheets.jsx')).toMatch(/reducedMotion\(\) \? undefined : \{ transition: 'transform \.2s var\(--ease-settle\)' \}/);
    const page = read('src/components/levels/word/LevelWordScreen.jsx');
    expect(page).toMatch(/startViewTransition/);
    const calls = page.split('\n').filter((line) => /document\.startViewTransition\(/.test(line));
    expect(calls.length).toBeGreaterThan(0);
    for (const line of calls) expect(line).toMatch(/!reducedMotion\(\)/);
  });
  it('하단 바가 끝에서 튕김에 끌려가지 않는다 — 문서 튕김 끄기 · 채점 바 합성 레이어(.mobile-nav 선례)', () => {
    expect(css).toMatch(/html:has\(\.lw-page\)\{overscroll-behavior-y:none\}/);
    expect(css).toMatch(/\.lw-gradebar\{[^}]*transform:translateZ\(0\)/);
    expect(read('src/components/levels/level-list.css')).toMatch(/html:has\(\.lv-page\)\{overscroll-behavior-y:none\}/);
  });
  it('진동은 쓰지 않는다(오너 결정 — 진동만 제외)', () => {
    expect(PAGE_FILES.filter((f) => /\bvibrate\b/.test(read(f)))).toEqual([]);
  });
});

describe('예문 단어 나눔(빌드 때) — exampleSegments', () => {
  it('분할 조각 길이 · 카드 단어는 갈라져도 한 조각', () => {
    expect(exampleSegments('这是一个爱情故事。', '爱情', ['这', '是', '一个', '爱', '情', '故事', '。'])).toEqual([1, 1, 2, 2, 2, 1]);
    expect(exampleSegments('这是一个爱情故事。', '爱情', ['这', '是', '一个', '爱情故事', '。'])).toEqual([1, 1, 2, 2, 2, 1]);
  });
  it('조각을 이으면 원문이 안 되거나 한 조각뿐이면 null — 화면은 나누지 않는다', () => {
    expect(exampleSegments('他 不喝。', '喝', ['他', '不', '喝', '。'])).toBeNull();
    expect(exampleSegments('你好', '你好', ['你好'])).toBeNull();
    expect(exampleSegments('', '你', [])).toBeNull();
  });
  it('보조 평면 글자(𠮷)도 글자 단위로 센다 — 화면의 [...text]와 같은 단위', () => {
    expect(exampleSegments('𠮷他', '他', ['𠮷', '他'])).toEqual([1, 1]);
  });
});

// 고르는 칸(10 · 20 · 50)은 없앴다 — 20 고정(학습 옵션 LEVEL-STUDY-OPTIONS-001, 오너 2026-10-31 KST). 값 고정은 levelStudyOptions.test.jsx.
describe('리스트 한 번에 — 20장 고정(오너 2026-10-20 KST 기본값 · 2026-10-31 KST 고정)', () => {
  const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
  it('기본값 20 · 고르는 수는 없다', () => {
    expect(screen).not.toContain('LEVEL_WORD_PAGE_SIZES');
    expect(fs.readFileSync('src/lib/levelWordPrefs.js', 'utf8')).toMatch(/LEVEL_WORD_PREFS = Object\.freeze\(\{[^}]*page: 20\b/);
  });
  // 첫 리스트 = page장(20)과 하루 새 단어 몫(기본 15 — 시안 ⑧, 2026-10-21 KST) 중 작은 쪽. smoke N3 계정은 복습할 단어가 없어 15장.
  it('시간이 된 카드는 page장 위에 더한다 · 첫 리스트 예산은 하루 새 단어 몫 15장', () => {
    expect(screen).toMatch(/const shown = limit \+ \(listed\?\.due\.size \|\| 0\)/);
    expect(fs.readFileSync('e2e/smoke.e2e.mjs', 'utf8')).toMatch(/assert\.equal\(rows, 15,/);
  });
});
