// 본문 위치로 바로 열기(BOOK-HASH-ENTRY-001): /books/japanese-n5#u01-start로 들어오면 첫 쪽이 계정 확인(sync)까지 'cover'라
// 표지(BookHome)가 비쳤다(390폭 ~34ms, 빌드 실측 2026-10-17 KST). 계약 = ① 하드 로드 감춤 한 줄(HASH_GATE)의 판정
// ② 붙은 뒤 그리기 전 hash로 첫 쪽 ③ 앵커 이동 · 진도 기록은 sync 뒤. 실제 표지 0프레임은 빌드 Playwright가 본다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { HASH_GATE, HASH_GATE_CSS, HASH_GATE_ID, HASH_GATE_PLAIN_CSS, announceFragmentUrl, coverPage, forgetRouterTree, lessonPage, pageFromHash, rememberRouterTree } from '../../components/books/bookEntryGate';

const ROOT = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(ROOT, 'src/components/books/BookReader.jsx'), 'utf8');
// 감춤 한 줄은 정본 문자열(bookEntryGate.HASH_GATE)을 그대로 vm에서 실행해 판정을 본다.
const gateFor = (hash, state = null, href = `https://manabi.test/books/japanese-n5${hash}`, existing = false) => {
  const appended = [];
  const document = { getElementById: () => (existing ? {} : null), createElement: () => ({}), head: { appendChild: (node) => appended.push(node) } };
  vm.runInNewContext(HASH_GATE, { location: { hash, href }, history: { state }, document });
  return appended;
};

describe('하드 로드 감춤 한 줄 — HASH_GATE', () => {
  it('본문 위치 hash면 표지를 감추는 style 하나를 head에 넣는다', () => {
    for (const hash of ['#u01-start', '#u29-patterns', '#reference-start', '#web-u02-start', '#%75%30%31-start']) {
      const nodes = gateFor(hash);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(HASH_GATE_ID);
      expect(nodes[0].textContent.startsWith(HASH_GATE_CSS)).toBe(true); // 과가 아닌 쪽은 아래에서 본다(+ HASH_GATE_PLAIN_CSS)
    }
  });
  it('표지 · 목차 · hash 없음 · 깨진 hash는 그대로(표지가 첫 화면)', () => {
    for (const hash of ['', '#', '#cover', '#toc', '#toc-part2', '#%E0%A4%A']) expect(gateFor(hash)).toHaveLength(0);
  });
  it('hash가 없어도 이 기록에 읽던 자리가 있으면 감춘다(계정 대조는 sync가 한다)', () => {
    const href = 'https://manabi.test/books/japanese-n5?edition=x';
    expect(gateFor('', { manabiBookPosition: { href } }, href)).toHaveLength(1);
    expect(gateFor('', { manabiBookPosition: { href: href + '&other' } }, href)).toHaveLength(0);
  });
  it('과가 아닌 쪽이면 과 머리 칸(부제 · 목표 · 과 번호)도 끈다 — 과 · 읽던 자리(hash 없음)는 그대로', () => {
    for (const hash of ['#reference-start', '#guide-start', '#culture-1']) expect(gateFor(hash)[0].textContent).toBe(HASH_GATE_CSS + HASH_GATE_PLAIN_CSS);
    for (const hash of ['#u01-start', '#u29-patterns', '#web-u02-start']) expect(gateFor(hash)[0].textContent).toBe(HASH_GATE_CSS);
    const href = 'https://manabi.test/books/japanese-n5';
    expect(gateFor('', { manabiBookPosition: { href } }, href)[0].textContent).toBe(HASH_GATE_CSS);
    expect(HASH_GATE_PLAIN_CSS).toBe(':root .book-entry-skeleton .book-entry-lesson{display:none}');
    for (const [id, lesson] of [['u01-start', true], ['u42-review', true], ['reference-start', false], ['guide-start', false], ['culture-1', false], ['cover', true]]) expect(lessonPage(id)).toBe(lesson);
  });
  it('이미 넣었으면 다시 넣지 않는다(교재 대기 골격과 BookReader가 둘 다 보낸다)', () => {
    expect(gateFor('#u01-start', null, undefined, true)).toHaveLength(0);
  });
  it('JS 판정(pageFromHash · coverPage)과 같은 규칙', () => {
    for (const [hash, page] of [['#u01-start', 'u01-start'], ['#web-u02-start', 'u02-start'], ['', 'cover'], ['#%E0%A4%A', 'cover'], ['#toc-part2', 'toc-part2']]) expect(pageFromHash(hash)).toBe(page);
    for (const hash of ['#u01-start', '#u29-patterns', '#reference-start', '#cover', '#toc', '', '#%E0%A4%A']) expect(gateFor(hash).length === 1).toBe(!coverPage(pageFromHash(hash)));
  });
  it('감춤 style = 표지(BookHome · 교재 대기 골격) 끄기 + 본문 골격 켜기, 평소 본문 골격은 꺼짐', () => {
    expect(HASH_GATE_CSS).toBe(':root .book-reader>.manabi-book-home,:root .manabi-book-home[aria-busy]{display:none}:root .book-entry-skeleton{display:block}');
    expect(fs.readFileSync(path.join(ROOT, 'src/components/books/reading-shell.css'), 'utf8')).toContain('\n.book-entry-skeleton{display:none}\n');
  });
  it('서버 · 하이드레이션 첫 그림은 표지 + 그 한 줄 + 꺼진 본문 골격(불일치 0), 첫 쪽이 정해지면 뗀다', () => {
    expect(source).toContain("{unit === 'cover' && !entryDecided && <><script dangerouslySetInnerHTML={{ __html: HASH_GATE }} /><BookReaderSkeleton gated /></>}");
    expect(source).toContain("const [pageId, setPageId] = useState('cover')");
    expect(source).toContain("import { HASH_GATE, announceFragmentUrl, coverPage, hashGate, pageFromHash, rememberRouterTree } from './bookEntryGate';");
  });
});

describe('붙은 뒤 그리기 전 — 첫 쪽 정하기', () => {
  const first = sliceBetween(source, '// 첫 쪽(BOOK-HASH-ENTRY-001)', 'const rememberPosition = useCallback(');
  it('layout effect에서 hash로 첫 쪽 · 앵커 대기를 정하고, 읽던 자리가 있으면 sync까지 감춘다', () => {
    expect(first).toContain('useLayoutEffect(() => {\n    const id = pageFromHash(window.location.hash);');
    expect(first).toContain('if (!coverPage(id)) { pendingAnchor.current = id; setPageId(id); setActive(id); }');
    expect(first).toContain('if (window.history.state?.manabiBookPosition?.href === window.location.href) hashGate(true);');
    expect(first).toContain('else setEntryDecided(true);');
    expect(first).toContain('useLayoutEffect(() => { if (entryDecided) hashGate(false); }, [entryDecided]);');
    expect(first).toContain('useLayoutEffect(() => () => hashGate(false), []);'); // 떠날 때 감춤을 남기지 않는다
  });
  it('sync도 같은 hash 해석(pageFromHash)을 쓰고, 끝나면 감춤을 푼다', () => {
    const sync = sliceBetween(source, 'const sync = (restorePosition, href = window.location.href) => {', '\n    };');
    expect(sync).toContain('let id = pageFromHash(new URL(href).hash);'); // 그 이동의 주소(BOOK-HASH-RACE-001)
    expect(sync).toContain('setEntryDecided(true);');
    expect(sync).not.toContain('decodeURIComponent'); // 해석은 pageFromHash 한 곳(HASH_GATE는 같은 규칙의 하드 로드판)
  });
  it('앵커 이동(과 그 뒤 진도 기록)은 계정 확인 뒤 — 첫 쪽을 먼저 정해도 읽던 자리 대조를 앞지르지 않는다', () => {
    const anchor = sliceBetween(source, '// 계정 확인(sync) 전에는 옮기지 않는다', 'let frame, cancelled = false;');
    expect(anchor).toContain('if (authLoading || !ready ||');
    expect(source).toContain('}, [authLoading, pageId, anchorRequest, sections, examples, unit, update, ready, measureToolbar, reference, rememberPosition]);');
  });
});

// 같은 문서 hash 이동의 라우터 경합(BOOK-HASH-RACE-001, 2026-10-17 KST): Next 라우터는 고유 hash 이동을 모른다(pushState 패치 밖).
// 앞서 걸린 라우터 갱신(읽던 자리 replaceState → ACTION_RESTORE, transition)이 늦게 들면 HistoryUpdater가 주소를 옛 hash로 되돌리고,
// 뒤이은 hashchange가 그 주소를 읽어 앞 과로 돌아갔다 — 빌드 Playwright 4배 감속에서 다른 과 이동 160회 중 8회(#guide-katakana-long ·
// #u03-study1 · #grammarIndex-1), 고친 뒤 0회. 계약: ① 이동 주소는 이벤트에서(지금 주소 아님) ② 라우터에 새 주소를 알린다.
describe('같은 문서 hash 이동 — 라우터가 옛 hash로 되돌려도 따라가지 않는다(BOOK-HASH-RACE-001)', () => {
  it('hashchange는 event.newURL로 sync하고, 먼저 라우터에 새 주소를 알린다 · popstate는 그때 주소로', () => {
    const handlers = sliceBetween(source, 'const pop = () =>', '// 떠날 때 자리 남기기');
    expect(handlers).toContain('const pop = () => { traversedHref = window.location.href; focusAfterMove.current = true; sync(true, traversedHref); };');
    expect(handlers).toContain('const href = event?.newURL || window.location.href;');
    expect(handlers).toContain('announceFragmentUrl(href);');
    expect(handlers).toContain('if (traversedHref === href) { traversedHref = null; return; }');
    expect(handlers).toContain('sync(false, href);');
    expect(handlers).not.toContain('sync(false);');
    // 알림은 같은 기록 이동 판정보다 먼저 — 앞으로 · 뒤로 이동도 라우터가 늘 마지막 주소를 쥔다.
    expect(handlers.indexOf('announceFragmentUrl(href);')).toBeLessThan(handlers.indexOf('if (traversedHref === href)'));
  });
  it('announceFragmentUrl: Next 표지(__NA · tree)를 빼고 넘겨 패치를 거치게 하고, 다른 주소의 읽던 자리는 남기지 않는다', () => {
    const calls = [];
    const href = 'http://x/books/japanese-n5?edition=e#guide-katakana-long';
    const run = (state) => {
      const before = globalThis.window;
      globalThis.window = { history: { state, replaceState: (data, unused, url) => calls.push({ data, url }) } };
      try { announceFragmentUrl(href); } finally { globalThis.window = before; }
      return calls.at(-1);
    };
    const tree = ['', {}];
    const same = run({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree, manabiBookPosition: { href, page: 'guide-katakana-long' }, other: 1 });
    expect(same).toEqual({ data: { manabiBookPosition: { href, page: 'guide-katakana-long' }, other: 1 }, url: href });
    const stale = run({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree, manabiBookPosition: { href: 'http://x/books/japanese-n5?edition=e#u03-study1', page: 'u03-study1' } });
    expect(stale).toEqual({ data: {}, url: href });
    // 고유 hash 이동의 새 기록은 state가 null — 패치가 붙일 표지가 없으니 패치에 한 번 넘긴 뒤 표지를 직접 찍는다
    // (`{}`로 남은 기록으로 뒤로 가면 Next onPopState가 !__NA로 새로 고친다 — a775 리뷰 2026-10-17 KST).
    const start = calls.length;
    run(null);
    expect(calls.slice(start)).toEqual([{ data: {}, url: href }, { data: { __NA: true }, url: href }]);
    // 표지가 이미 있으면(패치가 붙였거나 원래 있던 기록) 더 찍지 않는다.
    const marked = calls.length;
    run({ __NA: true });
    expect(calls.length - marked).toBe(1);
  });
});

// 「고유 hash 이동 → (RESTORE 커밋 전) 다른 경로로 이동 → 뒤로」(a775 리뷰 2026-10-17 KST): 표지만 찍힌 hash 기록으로 돌아오면
// Next traverse가 그 순간의 tree(/materials)를 써서 주소는 교재인데 화면은 /materials가 된다. 같은 문서에서 마지막으로 본 tree를
// 함께 찍는다. 아래 모형은 Next 15.5.21 app-router.js의 replaceState 패치(표지 없는 data → 지금 기록 표지 복사 · ACTION_RESTORE) ·
// onPopState(state 없음 → 무시, __NA 없음 → 새로 고침, 그 밖 → traverse(tree ?? 지금 tree)) 그대로다.
describe('hash 기록에 같은 문서 tree를 함께 찍는다(BOOK-HASH-RACE-001 후속)', () => {
  const BOOK = 'https://manabi.test/books/japanese-n5?edition=e';
  const T_BOOK = ['', { children: ['books', {}] }], T_MAT = ['', { children: ['materials', {}] }];
  function nextModel(first) {
    const entries = [{ url: first.url, state: first.state }]; let idx = 0;
    const out = { restores: [], reloads: 0, traversed: [], routerTree: first.state?.__PRIVATE_NEXTJS_INTERNALS_TREE };
    const original = { replace: (data, url) => { entries[idx] = { url: url ?? entries[idx].url, state: data && structuredClone(data) }; },
      push: (data, url) => { entries.splice(idx + 1); entries.push({ url, state: data && structuredClone(data) }); idx++; } };
    const history = {
      get state() { return entries[idx].state; },
      replaceState(data, _u, url) {
        if (data?.__NA || data?._N) return original.replace(data, url);
        data = data == null ? {} : data;
        const cur = entries[idx].state;
        if (cur?.__NA) data.__NA = cur.__NA;
        if (cur?.__PRIVATE_NEXTJS_INTERNALS_TREE) data.__PRIVATE_NEXTJS_INTERNALS_TREE = cur.__PRIVATE_NEXTJS_INTERNALS_TREE;
        if (url) out.restores.push({ url, tree: cur?.__PRIVATE_NEXTJS_INTERNALS_TREE });
        return original.replace(data, url);
      },
      // pushState 패치도 같은 규칙(app-router.js 309행): 표지 있으면 그대로, 없으면 지금 기록의 표지 · tree를 복사하고 RESTORE.
      pushState(data, _u, url) {
        if (data?.__NA || data?._N) return original.push(data, url);
        data = data == null ? {} : data;
        const cur = entries[idx].state;
        if (cur?.__NA) data.__NA = cur.__NA;
        if (cur?.__PRIVATE_NEXTJS_INTERNALS_TREE) data.__PRIVATE_NEXTJS_INTERNALS_TREE = cur.__PRIVATE_NEXTJS_INTERNALS_TREE;
        if (url) out.restores.push({ url, tree: cur?.__PRIVATE_NEXTJS_INTERNALS_TREE });
        return original.push(data, url);
      },
    };
    const env = {
      window: { history, location: { get href() { return entries[idx].url; } } },
      nativeHash: (url) => { original.push(null, url); }, // 브라우저가 처리하는 hash 이동: 새 기록 state = null
      linkTo: (url, tree) => { original.push({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree }, url); out.routerTree = tree; }, // HistoryUpdater pendingPush
      back: () => {
        idx--; const state = entries[idx].state;
        if (!state) return 'ignored';
        if (!state.__NA) { out.reloads++; return 'reload'; }
        const tree = state.__PRIVATE_NEXTJS_INTERNALS_TREE ?? out.routerTree; // restore-reducer: tree || state.tree
        out.traversed.push(tree); out.routerTree = tree; return 'traverse';
      },
      out, entries,
    };
    return env;
  }
  const withWindow = (env, fn) => { const before = globalThis.window; globalThis.window = env.window; try { return fn(); } finally { globalThis.window = before; } };

  it('hash 이동 → 커밋 전 /materials로 → 뒤로: 새로 고침 없이 교재 tree로 돌아온다', () => {
    forgetRouterTree();
    const env = nextModel({ url: `${BOOK}#u01-start`, state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK } });
    withWindow(env, () => {
      rememberRouterTree(); // BookReader가 붙을 때
      env.nativeHash(`${BOOK}#u02-start`);
      announceFragmentUrl(`${BOOK}#u02-start`); // hashchange
      // RESTORE가 커밋되기 전에 다른 경로로 — HistoryUpdater는 새 기록에만 쓰고 hash 기록은 다시 찍지 않는다.
      env.linkTo('https://manabi.test/materials', T_MAT);
      expect(env.back()).toBe('traverse');
    });
    expect(env.out.reloads).toBe(0);
    expect(env.out.traversed).toEqual([T_BOOK]); // T_MAT(그 순간 tree)가 아니다
    expect(env.entries[1].state).toEqual({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK });
  });

  it('기억한 tree가 다른 문서(검색어가 다른 주소)의 것이면 쓰지 않는다 — 표지만 찍는다', () => {
    forgetRouterTree();
    const env = nextModel({ url: 'https://manabi.test/books/japanese-n5?edition=other#u01-start', state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK } });
    withWindow(env, () => {
      rememberRouterTree();
      env.nativeHash(`${BOOK}#u02-start`); // 다른 판본 주소(같은 경로 · 다른 검색어)
      announceFragmentUrl(`${BOOK}#u02-start`);
    });
    expect(env.entries[1].state).toEqual({ __NA: true });
  });

  // go()는 같은 문서를 다른 검색어 주소로 옮길 수 있다(?edition 없이 들어오면 bookHref가 붙이고, returnTo는 안전한 값으로 바뀐다).
  // 옮긴 기록의 tree는 그 화면을 그린 tree다(book.edition 그대로) — Next 15 얕은 이동(표지 없는 pushState)도 똑같이 지금 tree를 복사한다.
  const NO_SEARCH = 'https://manabi.test/books/japanese-n5';
  it('go()의 얕은 이동 뒤에도: 그 기록에서 hash 이동 → 커밋 전 /materials → 뒤로가 교재 tree로 돌아온다', () => {
    forgetRouterTree();
    const env = nextModel({ url: `${NO_SEARCH}#u01-start`, state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK } });
    withWindow(env, () => {
      rememberRouterTree(); // BookReader가 붙을 때
      // go()와 같은 모양 — 지금 기록 state를 펼쳐 읽던 자리만 빼고 표지째 pushState(다른 검색어 주소)
      const navigationState = { ...env.window.history.state }; delete navigationState.manabiBookPosition;
      env.window.history.pushState(navigationState, '', `${BOOK}#u02-start`);
      rememberRouterTree(); // 그 기록에서 굴린 뒤 읽던 자리 기록(rememberPosition)
      env.nativeHash(`${BOOK}#u03-start`);
      announceFragmentUrl(`${BOOK}#u03-start`);
      env.linkTo('https://manabi.test/materials', T_MAT);
      expect(env.back()).toBe('traverse');
    });
    expect(env.out.reloads).toBe(0);
    expect(env.out.traversed).toEqual([T_BOOK]);
    expect(env.entries[1]).toEqual({ url: `${BOOK}#u02-start`, state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK } });
    expect(env.entries[2].state).toEqual({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK });
  });

  it('tree를 빼고 옮기는 길은 없다 — 표지 없이 넘기면 패치가 다시 복사하고, 표지만 남기면 traverse가 그 순간 tree(/materials)를 쓴다', () => {
    const viaPatch = nextModel({ url: `${NO_SEARCH}#u01-start`, state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK } });
    withWindow(viaPatch, () => viaPatch.window.history.pushState({}, '', `${BOOK}#u02-start`));
    expect(viaPatch.entries[1].state).toEqual({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK });
    expect(viaPatch.out.restores).toEqual([{ url: `${BOOK}#u02-start`, tree: T_BOOK }]);
    const markOnly = nextModel({ url: `${NO_SEARCH}#u01-start`, state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: T_BOOK } });
    withWindow(markOnly, () => {
      markOnly.window.history.pushState({ __NA: true }, '', `${BOOK}#u02-start`);
      markOnly.linkTo('https://manabi.test/materials', T_MAT);
      expect(markOnly.back()).toBe('traverse');
    });
    expect(markOnly.out.traversed).toEqual([T_MAT]); // 주소는 교재, 화면은 /materials — go()가 표지 · tree를 그대로 옮기는 이유
  });

  it('go()는 지금 기록의 Next 표지 · tree를 그대로 옮기고 읽던 자리만 뺀다', () => {
    const go = sliceBetween(source, 'const go = useCallback(', '}, [book.edition, unit, update, reference, rememberPosition]);');
    expect(go).toContain('const navigationState = { ...window.history.state };');
    expect(go).toContain('delete navigationState.manabiBookPosition;');
    expect(go).not.toMatch(/delete navigationState\.(?:__NA|__PRIVATE_NEXTJS_INTERNALS_TREE)/);
    expect(go).toContain("window.history.pushState(navigationState, '', destination.pathname+destination.search+destination.hash);");
  });

  it('BookReader가 붙을 때와 읽던 자리를 남길 때 tree를 기억한다', () => {
    expect(source).toContain("import { HASH_GATE, announceFragmentUrl, coverPage, hashGate, pageFromHash, rememberRouterTree } from './bookEntryGate';");
    const remember = sliceBetween(source, 'const rememberPosition = useCallback(', '}, [authLoading, book.edition, user?.id, reference]);');
    expect(remember).toMatch(/rememberRouterTree\(\);[^\n]*\n\s*window\.history\.replaceState\(\{ \.\.\.window\.history\.state, manabiBookPosition: position \}/);
    expect(source).toMatch(/rememberRouterTree\(\);[^\n]*\n\s*sync\(true\);\n\s*let traversedHref;/);
  });
});
