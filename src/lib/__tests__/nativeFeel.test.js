import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cssFiles, rulesOf } from './helpers/cssRules.js';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: NATIVE-FEEL-001 — 휴대폰(iOS Safari · Chrome, 홈 화면 설치 앱 포함)에서 「앱 같은 손맛」을 깨던 것들.
 * 실측 근거(390×844 터치 에뮬레이션, 합성 무거운 계정): 로그인 이메일 14.4px · 서재 검색 14px · 단어장 한도 13.6px 입력칸(iOS 초점 확대),
 * 단어장 「범위 고르기」 · 「단어 직접 추가」 · 단어 상세 · 내 정보 시트 위를 쓸면 뒤 페이지가 scrollY 0 → 1488로 움직임,
 * 레벨 단어 탭 「뜻」 누르는 폭 14px. 계약 = 배선 보증(ui-conventions §5) — 실제 확대 · 키보드 · 홈 막대 모습은 실기(iOS) 몫이다.
 * PWA 셸(viewport-fit · 안전 영역 · 두 번 탭 확대 · 호버 들림)은 pwaShell.test.js가 따로 본다.
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const squash = (s) => s.replace(/\s+/g, '');
const FLOOR = 'var(--field-font-min)';

/** 손대지 않는 구역 — 월드(개발 동결 · 게임 팔레트), PDF 뷰어(별도 과제), 관리자 화면(데스크톱 저작 도구). */
const OUT_OF_SCOPE = /(^|\/)(world|admin)\/|pdf|Pdf|WorldPage|AdminPage/;

describe('NATIVE-FEEL-001 ① 입력칸 글자 하한 — iOS 초점 확대 방지(터치 기기만)', () => {
  const index = () => read('src/index.css');

  it('하한 토큰: 기본 0px, 터치 기기(pointer: coarse)에서 16px — 데스크톱 크기는 그대로', () => {
    const rules = rulesOf(index());
    const root = rules.filter((r) => r.selector === ':root' && /--field-font-min/.test(r.body));
    expect(root.map((r) => [squash(r.body), r.at])).toEqual([
      ['--field-font-min:0px;', []],
      ['--field-font-min:16px;', ['@media (pointer: coarse)']],
    ]);
  });

  it('글자 크기를 적지 않은 입력칸(브라우저 기본 13.33px)은 클래스를 달아 터치 블록에서 16px — 전역 :where(input) 한 줄은 쓰지 않는다(스타일 없는 폼 줄바꿈이 바뀐다, 오너 결정 대기)', () => {
    const touch = rulesOf(index()).filter((r) => r.at.length === 1 && r.at[0] === '@media (pointer: coarse)');
    expect(touch.find((r) => r.selector === '.drill-answer')?.body.trim()).toBe('font-size: 16px;');
    expect(touch.some((r) => /^:where\((input|textarea|select)/.test(r.selector))).toBe(false);
    const drill = fieldTags().find((t) => t.file === 'src/components/ChapterDrills.jsx' && t.tag === 'input');
    expect(drill.text).toContain('className="drill-answer"');
    expect(drill.text).not.toMatch(/fontSize/); // 인라인 크기를 적으면 위 규칙을 덮는다
  });

  it('손가락 확대를 막아 확대를 피하지 않는다(maximum-scale 금지 — pwaShell ②와 같은 이유)', () => {
    expect(read('src/app/layout.jsx')).not.toMatch(/maximumScale|maximum-scale|userScalable|user-scalable/);
  });

  /** px · rem 값만 잰다(em · % · inherit는 부모에 달려 정적으로 모른다 — 실렌더 감사 몫). */
  const px = (v) => {
    const m = v.trim().match(/^(\d*\.?\d+)(px|rem)$/);
    return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null;
  };
  /** 선택자의 마지막 조각이 입력칸 태그(input · textarea · select)를 가리키는가. */
  const FIELD_TAG = /(^|[\s>+~(,])(input|textarea|select)(?![\w-])(?![^(]*\[type=["']?(checkbox|radio|range))/;
  /** 태그가 아닌 클래스로만 그리는 입력칸(JSX에서 입력칸에만 붙는 이름). 새 입력칸 클래스를 작게 쓰면 여기와 규칙 둘 다에 걸린다. */
  const FIELD_CLASSES = ['.auth-input', '.search-wrap__input', '.token-edit__input', '.source-edit__textarea', '.note-reading'];

  const smallFieldRules = () => cssFiles().filter((f) => !OUT_OF_SCOPE.test(f)).flatMap((file) => {
    const rules = rulesOf(read(file));
    // 같은 파일에서 그 선택자만 따로 하한을 진 규칙(단추와 묶인 규칙에서 선택 상자만 떼어 낸 경우 — teaching-board)
    const floored = new Set(rules.filter((r) => r.body.includes(FLOOR)).flatMap((r) => r.selector.split(',').map(squash)));
    return rules.flatMap((r) => {
      const size = r.body.match(/(?:^|;)\s*font-size\s*:\s*([^;!]+)/);
      const value = size && px(size[1]);
      if (value === null || value >= 16 || r.body.includes(FLOOR)) return [];
      return r.selector.split(',').map((s) => s.trim())
        .filter((s) => FIELD_TAG.test(s.split(/\s+/).pop()) || FIELD_CLASSES.some((c) => s.endsWith(c)))
        .filter((s) => !floored.has(squash(s)))
        .filter((s) => !/^\.pdf-/.test(s)) // PDF 뷰어 전용(.pdf-bridge · .pdf-input-bar …) — 이번 범위 밖
        .map((s) => `${file} ${s} font-size:${size[1].trim()}`);
    });
  });

  it('입력칸에 16px보다 작은 글자를 적은 규칙은 max(var(--field-font-min), 원래 값)으로 쓴다', () => {
    expect(smallFieldRules()).toEqual([]);
  });

  it('입력칸 클래스 목록은 실제로 입력칸에 붙은 이름만 가리킨다(죽은 예외 금지)', () => {
    const tags = fieldTags();
    for (const c of FIELD_CLASSES) {
      const name = c.slice(1);
      expect(tags.some((t) => new RegExp(`className=[{"'\`][^}"]*\\b${name}\\b`).test(t.text)), `${c}가 어떤 입력칸에도 없다`).toBe(true);
    }
  });

  it('인라인 style로 16px보다 작은 글자를 적은 입력칸도 같은 꼴 — 미디어 쿼리는 인라인을 덮지 못한다', () => {
    const bad = fieldTags().filter(({ file }) => !OUT_OF_SCOPE.test(file)).flatMap(({ file, line, tag, text }) => {
      const m = text.match(/fontSize:\s*('([^']*)'|"([^"]*)"|(\d+))/);
      if (!m) return [];
      const raw = m[2] ?? m[3] ?? `${m[4]}px`;
      if (raw.includes(FLOOR)) return [];
      const value = px(raw);
      return value !== null && value < 16 ? [`${file}:${line} <${tag}> fontSize ${raw}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('하한을 진 규칙은 원래 값을 그대로 품는다(데스크톱 크기 보존 — 값만 바꿔 치우지 않게)', () => {
    const css = cssFiles().map(read).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const uses = [...css.matchAll(/max\(var\(--field-font-min\),\s*([^)]+)\)/g)].map((m) => m[1].trim());
    expect(uses.length).toBeGreaterThanOrEqual(13);
    // 1em = font: inherit로 물려받던 크기 그대로(NATIVE-FEEL-P1 ⓓ) — 부모마다 달라 px로 적으면 다른 화면의 데스크톱 크기가 바뀐다.
    for (const v of uses.filter((x) => x !== '1em')) expect(px(v), v).toBeLessThan(16);
  });
});

/** src 아래 JSX(월드 · 테스트 · 판본 스냅숏 제외). */
function jsxFiles(dir = path.join(ROOT, 'src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['__tests__', 'textbookEditions'].includes(e.name) ? [] : jsxFiles(p);
    return e.name.endsWith('.jsx') ? [path.relative(ROOT, p)] : [];
  });
}

/** JSX의 <input|textarea|select …> 여는 태그 전체(속성 안 => · {} 를 건너뛴다). 체크 · 라디오 · 범위 · 숨김 · 파일은 뺀다. */
function fieldTags() {
  const out = [];
  for (const file of jsxFiles()) {
    const s = read(file);
    for (const m of s.matchAll(/<(input|textarea|select)\b/g)) {
      let depth = 0, end = -1;
      for (let j = m.index; j < s.length; j += 1) {
        const c = s[j];
        if (c === '{') depth += 1;
        else if (c === '}') depth -= 1;
        else if (c === '>' && depth === 0) { end = j; break; }
      }
      const text = s.slice(m.index, end + 1);
      if (/type=["{]'?"?(checkbox|radio|range|hidden|file|color|submit|button)/.test(text)) continue;
      out.push({ file, line: s.slice(0, m.index).split('\n').length, tag: m[1], text });
    }
  }
  return out;
}

describe('NATIVE-FEEL-P1 — 미뤄 둔 네 곳(오너 「권장대로 진행」 2026-10-26 KST)', () => {
  const ruleBody = (file, selector) => {
    const mine = rulesOf(read(file)).filter((r) => r.selector === selector && r.at.length === 0);
    expect(mine.length, `${file} ${selector}`).toBeGreaterThan(0);
    return mine.map((r) => r.body).join(';');
  };

  it('ⓐ 함께 읽는 글: 정렬은 칩 줄 밖 자기 자리의 글자 단추 꼴 — 칩 모양 선택 상자를 칩 사이에 두지 않는다', () => {
    const page = read('src/views/MaterialsPage.jsx');
    const sort = fieldTags().find((t) => t.file === 'src/views/MaterialsPage.jsx' && t.text.includes('aria-label="정렬"'));
    expect(sort?.tag).toBe('select');
    expect(sort.text).toContain('className="materials-sort"');
    expect(sort.text).not.toMatch(/\bchip\b|style=/);
    // 첫 칩 줄을 연 뒤 정렬 상자까지 열고 닫은 div가 같다 = 칩 줄(언어 · 난이도) 안이 아니다.
    const before = sliceBetween(page, '<div className="chip-group">', 'className="materials-sort"');
    expect((before.match(/<div\b/g) || []).length - (before.match(/<\/div>/g) || []).length).toBe(0);
    expect(sliceBetween(page, 'className="materials-filters"', 'className="materials-sort"')).toContain('className="chip-group"');
    const css = ruleBody('src/index.css', '.materials-sort');
    expect(css).toContain('font-size: max(var(--field-font-min), 0.82rem)'); // 데스크톱은 칩 글자 그대로, 터치 16px
    expect(css).toMatch(/border:\s*0/);
    expect(css).toMatch(/background-color:\s*transparent/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(cssFiles().map(read).join('\n')).not.toContain('.chip--select');
  });

  it('ⓑ 서재: 도구 줄에서 정렬 선택 상자를 걷고 「필터」 시트 안 라디오(묶음 제목 「정렬」)로 — 값 · 주소는 그대로', () => {
    const shelf = read('src/components/library/LibraryShelf.jsx');
    expect(sliceBetween(shelf, 'className="shelf-list-tools"', '</div>')).not.toMatch(/<select\b/);
    expect(shelf).not.toContain('id="library-sort"');
    const dialog = sliceBetween(shelf, 'function FilterDialog(', 'export default function LibraryShelf');
    expect(dialog).toContain('<fieldset className="shelf-sort-options"><legend>정렬</legend>');
    expect(dialog).toMatch(/<input type="radio" name="library-sort" value=\{value\} checked=\{draft\.sort===value\}/);
    // 바꾼 때만 sort를 싣는다 — 언어만 바꿔 적용해도 주소에 sort=newest가 붙지 않게(전과 같은 주소).
    expect(dialog).toContain("...(draft.sort!==filters.sort?{sort:draft.sort}:{})");
    expect(dialog).toContain("filters.sort==='level'?[...LIBRARY_SORTS,['level','급수순']]");
    const values = [...sliceBetween(shelf, 'const LIBRARY_SORTS=', ';').matchAll(/\['(\w+)','([^']+)'\]/g)].map((m) => [m[1], m[2]]);
    expect(values).toEqual([['newest', '최근 저장순'], ['opened', '최근 열어본 순'], ['title', '제목순']]);
    expect(read('src/lib/personalLibrary.js')).toContain("sort:['newest','title','opened','level'].includes(sort)?sort:'newest'");
    const css = read('src/components/library/library.css');
    expect(squash(ruleBody('src/components/library/library.css', '.shelf-filter-form .shelf-sort-options label'))).toContain('min-height:44px;font-size:16px');
    expect(css).not.toMatch(/\.shelf-list-tools select/);
    // 시트의 입력칸 규칙(폭 100% · 46px 상자)이 라디오를 덮지 않게
    expect(css).toContain('.shelf-dialog input:not([type=checkbox]):not([type=radio]),.shelf-dialog select{');
  });

  it('ⓒ 노트 단어 카드: 터치에서 표기 24 / 읽기 16 / 뜻 16 — 데스크톱 읽기 12px는 그대로', () => {
    const file = 'src/components/notes/study-notes.css';
    expect(ruleBody(file, '.note-word-fields .note-reading')).toContain('font-size:max(var(--field-font-min),12px)');
    expect(ruleBody(file, '.note-word-fields .note-spelling')).toContain('font-size:24px');
    expect(ruleBody(file, '.note-word-fields textarea')).toContain('font-size:max(var(--field-font-min),14px)');
  });

  it('ⓓ 크기를 물려받는(font: inherit) 입력칸은 그 규칙에 max(하한, 1em) — 라벨 12 · 13px를 물려받아 터치에서 확대되던 칸', () => {
    const INHERITED = [
      ['src/components/notes/study-notes.css', '.note-create input,.note-create select,.note-information input'], // 새 노트 13px
      ['src/components/notes/study-notes.css', '.note-candidate-tools input'], // 노트 단어 정리 「기본형」 11px
      ['src/components/classroom/classroom.css', '.class-study-history input'], // 수업 표현 기록 찾기 12px
      ['src/components/classroom/textbook-annotations.css', '.textbook-notes textarea'], // 교재 설명 14px
      ['src/components/books/reading-shell.css', '.manabi-reading-dialog input'], // 교재 「기억할 표현」 12px
      ['src/components/books/reading-shell.css', '.manabi-book-connect select'], // 이 과에 내 자료 연결 12px
      ['src/components/materials/material-composer.css', '.original-reader select'], // 원본 파일 · 지문 공부 12 · 13px
      ['src/components/web/review-room.css', '.review-scope-sheet__range select'], // 복습 범위 12px
    ];
    for (const [file, selector] of INHERITED) {
      const body = squash(ruleBody(file, selector));
      expect(body, `${file} ${selector}`).toContain('font:inherit;font-size:max(var(--field-font-min),1em)');
    }
  });

  it('ⓓ 글자 크기를 적지 않은 입력칸은 터치 블록에서 16px — 그룹 폼은 최소 폭 0으로 줄바꿈을 지킨다', () => {
    const touch = rulesOf(read('src/index.css')).filter((r) => r.at.length === 1 && r.at[0] === '@media (pointer: coarse)');
    expect(squash(touch.find((r) => r.selector === '.search-input, .board-class-navigation select')?.body || '')).toBe('font-size:16px;');
    expect(squash(touch.find((r) => r.selector === '.group-field')?.body || '')).toBe('font-size:16px;min-width:0;');
    // 주간 목표 줄(축 선택 · 수 · 정하기 · 취소)도 한 줄 — 축 선택 상자가 16px로 14px 커진 만큼 수 칸을 줄인다(데스크톱 90px 그대로).
    expect(touch.find((r) => r.selector === '.group-goal-target')?.body.trim()).toBe('width: 76px;');
    expect(rulesOf(read('src/index.css')).find((r) => r.selector === '.group-goal-target' && r.at.length === 0)?.body.trim()).toBe('width: 90px;');
    const groups = fieldTags().filter((t) => t.file === 'src/views/GroupsPage.jsx');
    expect(groups.length).toBe(7);
    for (const g of groups) {
      expect(g.text, `GroupsPage:${g.line}`).toMatch(/className="group-field( group-goal-target)?"/);
      expect(g.text).not.toMatch(/fontSize|minWidth/); // 인라인은 미디어 쿼리를 덮는다
    }
    for (const [file, anchor] of [['src/views/VocabList.jsx', '표현 목록 검색'], ['src/views/ViewerComments.jsx', 'commentInput']]) {
      const f = fieldTags().find((t) => t.file === file && t.text.includes(anchor));
      expect(f?.text, `${file} ${anchor}`).toContain('className="search-input"');
      expect(f.text).not.toMatch(/fontSize/);
    }
    expect(fieldTags().find((t) => t.file === 'src/components/classroom/ClassroomReader.jsx' && t.text.includes('수업 교재 과 선택'))).toBeDefined();
  });
});

describe('NATIVE-FEEL-001 ② 모달 · 어둠막이 떠 있는 동안 뒤 화면을 세운다(터치 기기만)', () => {
  const lock = () => {
    const r = rulesOf(read('src/index.css')).find((x) => x.selector.startsWith('html:has(:is('));
    expect(r, 'html:has(:is(…)) 고정 규칙이 없다').toBeDefined();
    return r;
  };
  const locked = () => lock().selector.match(/^html:has\(:is\((.*)\)\)$/)[1].split(',').map((s) => s.trim());

  it('터치 기기에서만 html을 세우고 당겨서 새로 고침도 막는다(마우스 화면은 스크롤 막대가 걷혀 본문이 밀린다)', () => {
    expect(lock().at).toEqual(['@media (pointer: coarse)']);
    expect(squash(lock().body)).toBe('overflow:hidden;overscroll-behavior:none;');
  });

  it('showModal로 연 dialog(:modal)는 모두 걸린다 — 읽기 설정 · 받아쓰기 · 원문 수정 · 서재 폴더 · 교재 대화 상자', () => {
    expect(locked()).toContain('dialog:modal');
  });

  it('화면 전체를 덮는 고정 어둠막(스크림)은 빠짐없이 목록에 있다 — 새 어둠막을 만들면 여기에 더한다', () => {
    // 전면(inset:0) 고정 + 어둠을 칠하는 규칙. 투명 클릭 받이(.pdf-detail-overlay · .rsheet-backdrop)와 그릇(.hz-portal)은 칠하지 않아 빠진다.
    const scrims = cssFiles().filter((f) => !/(^|\/)world\//.test(f)).flatMap((file) => rulesOf(read(file))
      .filter((r) => r.at.length === 0 && /position\s*:\s*fixed/.test(r.body) && /(?:^|;)\s*inset\s*:\s*0\s*(;|$)/.test(r.body))
      .filter((r) => /background(?:-color)?\s*:\s*(var\(--scrim\)|color-mix\([^;]*var\(--ink\))/.test(r.body))
      .map((r) => r.selector.trim()));
    expect(scrims.length).toBeGreaterThanOrEqual(9);
    const list = locked();
    expect(scrims.filter((s) => !list.includes(s))).toEqual([]);
  });

  it('목록은 실제로 있는 규칙만 가리킨다(죽은 항목 금지)', () => {
    const css = cssFiles().map(read).join('\n');
    for (const s of locked().filter((x) => x.startsWith('.'))) expect(css, s).toMatch(new RegExp(`(^|[\\s,}])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[{,]`));
  });

  it('모달 · 시트 안의 스크롤 칸은 overscroll-behavior: contain — 끝까지 민 손가락이 뒤 페이지로 넘어가지 않게(마우스 휠 포함)', () => {
    const SCROLL_BODIES = {
      'src/index.css': ['.modal__body'],
      'src/components/web/review-room.css': ['.review-scope-sheet'],
      'src/components/library/library.css': ['.shelf-dialog'],
      'src/components/books/reading-shell.css': ['.manabi-reading-dialog'],
      'src/components/classroom/classroom-reader.css': ['.class-copy-dialog'],
      'src/components/levels/word/level-word.css': ['.lw-sheet'],
      'src/components/profile/profile.css': ['.pf-sheet'],
      'src/components/goal/goal-sheet.css': ['.gs-sheet'],
      'src/components/materials/source-passage.css': ['.passage-dialog'],
    };
    const missing = [];
    for (const [file, selectors] of Object.entries(SCROLL_BODIES)) {
      const rules = rulesOf(read(file));
      for (const sel of selectors) {
        const mine = rules.filter((r) => r.selector === sel && r.at.length === 0);
        expect(mine.length, `${file} ${sel}`).toBeGreaterThan(0);
        const body = mine.map((r) => r.body).join(';');
        if (!/overflow(-y)?\s*:\s*(auto|scroll)/.test(body)) missing.push(`${file} ${sel}: 스크롤 칸이 아니다(목록 갱신)`);
        else if (!/overscroll-behavior\s*:\s*contain/.test(body)) missing.push(`${file} ${sel}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('NATIVE-FEEL-001 ③ 동적 뷰포트 — min-height 100vh에는 dvh 짝을 둔다', () => {
  it('min-height에 100vh를 쓰는 규칙은 같은 규칙에 100dvh 판을 함께 적는다(주소창이 보이는 휴대폰 탭에서 짧은 화면이 주소창만큼 스크롤된다)', () => {
    const missing = cssFiles().filter((f) => !/(^|\/)world\//.test(f)).flatMap((file) => rulesOf(read(file))
      .filter((r) => /(?:^|;)\s*min-height\s*:[^;]*\b100vh\b/.test(r.body) && !/(?:^|;)\s*min-height\s*:[^;]*\b100dvh\b/.test(r.body))
      .map((r) => `${file} ${r.selector}`));
    expect(missing).toEqual([]);
  });

  it('앱 셸 바깥 그릇(.manabi-app)과 로그인 화면이 실제로 짝을 진다', () => {
    expect(read('src/components/books/reading-shell.css')).toMatch(/\.manabi-app\{[^}]*min-height:100vh;min-height:100dvh;/);
    const auth = rulesOf(read('src/index.css')).find((r) => r.selector === '.auth-wrapper');
    expect(squash(auth.body)).toContain('min-height:calc(100dvh-var(--gnb-height))');
  });
});

describe('NATIVE-FEEL-001 ④ 채점하는 답칸은 휴대폰 자동 고침을 끈다', () => {
  // 자동 고침 · 예측 막대가 틀린 철자를 정답으로 바꾸고, 맞춤법 밑줄이 틀린 곳을 알려 주고, 첫 글자를 대문자로 바꾼다 —
  // 학습자가 스스로 떠올린 답을 채점해야 하는 칸에서는 답을 대신 써 준다(KanaTest가 먼저 끈 선례). 자유 작문 · 대화는 대상이 아니다.
  const GRADED = [
    ['src/views/StudySessionPage.jsx', 'value={typing}', 'input'],
    ['src/components/ChapterDrills.jsx', '정답 입력', 'input'],
    ['src/components/DictationPanel.jsx', '받아쓰기 입력', 'textarea'],
    ['src/components/KanaTest.jsx', '로마자 입력', 'input'],
  ];
  it.each(GRADED)('%s 답칸', (file, anchor, tag) => {
    const field = fieldTags().find((t) => t.file === file && t.tag === tag && t.text.includes(anchor));
    expect(field, `${file}에서 ${anchor} 칸을 찾지 못했다`).toBeDefined();
    expect(field.text).toMatch(/autoComplete="off"/);
    expect(field.text).toMatch(/autoCorrect="off"/);
    expect(field.text).toMatch(/autoCapitalize="off"/);
    expect(field.text).toMatch(/spellCheck=(\{false\}|"false")/);
  });

  it('초대 코드는 대문자 자판으로 열고 자동 고침을 끈다(6자 코드를 사전 단어로 바꾸지 않게)', () => {
    const field = fieldTags().find((t) => t.file === 'src/views/GroupsPage.jsx' && t.text.includes('초대 코드 6자'));
    expect(field.text).toMatch(/autoCapitalize="characters"/);
    expect(field.text).toMatch(/autoCorrect="off"/);
  });
});

describe('NATIVE-FEEL-001 ⑤ 글자 탭 · 로고의 누르는 자리(모양은 그대로, 투명 판만)', () => {
  const HIT = [
    ['src/components/levels/word/level-word.css', '.lw-tabs button'],
    ['src/components/web/web-shell.css', '.shelf-language-tabs button'],
  ];
  it.each(HIT)('%s %s — 간격 절반씩 투명 판, 끝 탭은 오른쪽으로 넘치지 않는다', (file, sel) => {
    const rules = rulesOf(read(file));
    expect(rules.some((r) => r.selector === sel && /position\s*:\s*relative/.test(r.body))).toBe(true);
    const before = rules.find((r) => r.selector === `${sel}::before`);
    expect(squash(before.body)).toBe("content:'';position:absolute;inset:0-11px");
    expect(rules.find((r) => r.selector === `${sel}:last-child::before`)?.body).toBe('right:0');
  });

  it('투명 판의 가로 확장(11px)은 탭 간격의 절반을 넘지 않는다 — 옆 탭의 판과 겹치면 누른 자리가 엉뚱한 탭으로 간다', () => {
    const gap = (file, sel) => Math.min(...rulesOf(read(file)).filter((r) => r.selector === sel).map((r) => r.body.match(/(?:^|;)\s*gap\s*:\s*(\d+)px/)).filter(Boolean).map((m) => Number(m[1])));
    expect(gap('src/components/levels/word/level-word.css', '.lw-tabs')).toBeGreaterThanOrEqual(22);
    expect(gap('src/components/web/web-shell.css', '.shelf-language-tabs')).toBeGreaterThanOrEqual(22);
  });

  it('밑줄 막대는 단추 offsetWidth를 잰다 — 투명 판(::before)은 폭에 들지 않아 막대 폭이 그대로다', () => {
    expect(read('src/components/levels/word/LevelWordScreen.jsx')).toContain('{ x: b.offsetLeft, w: b.offsetWidth }');
  });

  it('머리 글자 로고는 머리 줄 안에서 위아래로 넓힌다', () => {
    const rules = rulesOf(read('src/components/web/web-shell.css'));
    expect(rules.find((r) => r.selector === '.manabi-app .gnb__logo::before')?.body).toBe("content:'';position:absolute;inset:-12px -6px");
  });
});
