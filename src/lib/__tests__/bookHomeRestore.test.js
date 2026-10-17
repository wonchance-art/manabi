// 교재 표지(책 목차) 뒤로 가기 자리(BOOK-HOME-RESTORE-001) — /books/japanese-n5 표지에서 다른 화면에 다녀오면 맨 위로 갔다
// (369px → 0px, abaa 보고 2026-10-17 KST — bfcache 이전부터). 원인 ① 표지에는 쪽(article)이 없어 rememberPosition이 아무것도
// 남기지 않았다 ② 돌아오면 sync가 'cover'를 정하고 앵커 효과가 표지를 늘 맨 위로 옮겼다(scrollRestoration은 manual).
// 고침 = LEVEL-RESTORE-001과 같은 방식: 이 기록(history entry)에 { 주소 · 세로 위치 · 전체 목차 펼침 }을 남기고 돌아오면 그 자리로.
// 계약 = 자리 값(순수 함수) + 감춤 판정과 분리 + 배선. 실제 복원은 e2e/book-reading-reload.e2e.mjs(CI 프로덕션 앱)가 본다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { BOOK_COVER_PLACE_KEY, HASH_GATE, announceFragmentUrl, bookCoverPlaceOf, readerEntry, withBookCoverPlace } from '../../components/books/bookEntryGate';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const reader = read('src/components/books/BookReader.jsx');
const home = read('src/components/books/BookHome.jsx');
const href = 'https://manabi.test/books/japanese-n5?edition=8a8c1c1f';

describe('표지 자리 값 — bookCoverPlaceOf · withBookCoverPlace', () => {
  it('Next의 기록 값(__NA · tree)과 읽던 자리는 그대로 두고 표지 자리만 얹는다', () => {
    const next = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['', {}], manabiBookPosition: { href, page: 'u03-start' } };
    const state = withBookCoverPlace(next, { href, y: 369, all: false });
    expect(state).toEqual({ ...next, [BOOK_COVER_PLACE_KEY]: { href, y: 369, all: false } });
    expect(next[BOOK_COVER_PLACE_KEY]).toBeUndefined(); // 원본을 바꾸지 않는다
    expect(withBookCoverPlace(null, { href, y: 1 })).toEqual({ [BOOK_COVER_PLACE_KEY]: { href, y: 1 } });
  });
  it('같은 주소의 자리만 돌려준다 — 같은 경로의 다른 hash · 다른 판본은 아니다', () => {
    const state = withBookCoverPlace({}, { href, y: 369, all: true });
    expect(bookCoverPlaceOf(state, href)).toEqual({ y: 369, all: true, open: null });
    expect(bookCoverPlaceOf(withBookCoverPlace({}, { href, y: 9, open: ['기초', '생활'] }), href)).toEqual({ y: 9, all: false, open: ['기초', '생활'] });
    expect(bookCoverPlaceOf(state, `${href}#u01-start`)).toBeNull();
    expect(bookCoverPlaceOf(state, href.replace('8a8c1c1f', '7f572327'))).toBeNull();
    expect(bookCoverPlaceOf(null, href)).toBeNull(); // 새로 들어온 기록(Next가 지운 값) — 맨 위
    expect(bookCoverPlaceOf({ __NA: true }, href)).toBeNull();
  });
  it('망가진 값은 버린다 — 펼침은 true일 때만', () => {
    for (const y of [-1, Number.NaN, Infinity, 2e6, '369', null]) expect(bookCoverPlaceOf(withBookCoverPlace({}, { href, y }), href)).toBeNull();
    expect(bookCoverPlaceOf(withBookCoverPlace({}, { href, y: 0, all: 'yes' }), href)).toEqual({ y: 0, all: false, open: null });
    expect(bookCoverPlaceOf(withBookCoverPlace({}, { href, y: 0, open: ['기초', 7, null, 'x'.repeat(201)] }), href).open).toEqual(['기초']);
    expect(bookCoverPlaceOf(withBookCoverPlace({}, { href, y: 0, open: Array.from({ length: 80 }, (_, i) => `p${i}`) }), href).open).toHaveLength(50);
  });
});

describe('본문 감춤 판정과 분리 — 표지 자리는 표지를 감추지 않는다', () => {
  it('HASH_GATE(하드 로드 감춤 한 줄)는 표지 자리만 있는 기록에서 아무것도 넣지 않는다', () => {
    const appended = [];
    const document = { getElementById: () => null, createElement: () => ({}), head: { appendChild: (node) => appended.push(node) } };
    vm.runInNewContext(HASH_GATE, { location: { hash: '', href }, history: { state: withBookCoverPlace({ __NA: true }, { href, y: 369 }) }, document });
    expect(appended).toEqual([]);
  });
  it('readerEntry(링크 이동 골격)도 표지로 판정한다', () => {
    const before = globalThis.window;
    globalThis.window = { location: { hash: '', href }, history: { state: withBookCoverPlace({}, { href, y: 369 }) } };
    try { expect(readerEntry()).toBe(false); } finally { globalThis.window = before; }
  });
  it('announceFragmentUrl은 다른 주소의 표지 자리를 새 hash 기록에 옮기지 않는다', () => {
    const calls = [];
    const before = globalThis.window;
    globalThis.window = { history: { state: { __NA: true, [BOOK_COVER_PLACE_KEY]: { href, y: 369 } }, replaceState: (data, unused, url) => calls.push({ data, url }) } };
    try { announceFragmentUrl(`${href}#u01-start`); } finally { globalThis.window = before; }
    expect(calls[0]).toEqual({ data: {}, url: `${href}#u01-start` });
  });
});

describe('배선 — BookReader · BookHome', () => {
  const remember = sliceBetween(reader, 'const rememberPosition = useCallback(current => {', '}, [authLoading, book.edition, user?.id, reference]);');
  it('남기기: 표지면 이 기록에 세로 위치 · 전체 목차 펼침 · 열린 파트를 쓴다(쪽 자리는 쓰지 않는다)', () => {
    expect(remember).toContain("if (unitRef.current === 'cover') {");
    expect(remember).toContain("const open = [...(root.current?.querySelectorAll('.manabi-book-home details[data-toc-part]') || [])].filter(group => group.open).map(group => group.dataset.tocPart);");
    expect(remember).toContain('window.history.replaceState(withBookCoverPlace(window.history.state, { href: window.location.href, y: Math.round(window.scrollY), all: tocAllRef.current, open }), \'\', window.location.href);');
    // 보류 중(되살리기 전) · 계정 확인 전에는 쓰지 않는다 — 남긴 자리를 맨 위 값으로 덮지 않게.
    expect(remember.indexOf('if (authLoading || pendingAnchor.current || dialog.current?.open) return;')).toBeLessThan(remember.indexOf("unitRef.current === 'cover'"));
  });
  it('unit은 ref로 읽는다 — rememberPosition 의존성이 바뀌면 sync 효과가 다시 돌아 앵커 이동이 되풀이된다', () => {
    expect(reader).toContain('}, [authLoading, book.edition, user?.id, reference]);');
    expect(reader).toContain('unitRef.current = unit; tocAllRef.current = tocAll;');
  });
  it('남기는 때: 굴리기 멈춤 · 링크 누름(capture) · 떠날 때(bfcache 아닌 길) · 책 안 이동', () => {
    const cover = sliceBetween(reader, "if (unit !== 'cover') return undefined;", '}, [unit, rememberPosition]);');
    expect(cover).toContain("window.addEventListener('scroll', scroll, { passive: true });");
    expect(cover).toContain("document.addEventListener('click', click, true);");
    expect(cover).toContain("if (event.target?.closest?.('a[href]')) rememberPosition();");
    expect(reader).toContain('const release = event => { if (!event?.persisted) rememberPosition();'); // pagehide 안 replaceState는 bfcache를 내쫓는다
    const go = sliceBetween(reader, 'const go = useCallback((id, originAnchor) => {', 'window.history.pushState(navigationState');
    expect(go.indexOf('rememberPosition();')).toBeLessThan(go.indexOf('const navigationState'));
    expect(go).toContain('delete navigationState.manabiBookPosition; delete navigationState[BOOK_COVER_PLACE_KEY];');
  });
  it('되살리기: 표지는 남긴 자리로(없으면 맨 위) — 표지를 늘 맨 위로 옮기던 분기는 없다', () => {
    const anchor = sliceBetween(reader, 'const position = pendingPosition.current;', 'pendingAnchor.current = null; pendingPosition.current = null;');
    expect(anchor).toContain("else if (id === 'cover') {");
    expect(anchor).toContain('const place = bookCoverPlaceOf(window.history.state, window.location.href);');
    expect(anchor).toContain('window.scrollTo({ top: place ? Math.min(place.y, Math.max(0, document.documentElement.scrollHeight - innerHeight)) : 0, behavior: \'instant\' });');
    expect(anchor).not.toContain("id === 'cover' || id === unit");
    expect(anchor).toContain("else if (id === unit || id === `${unit}-start`) window.scrollTo({ top: 0, behavior: 'instant' });");
  });
  it('전체 목차 펼침 · 열린 파트는 BookReader가 들고, 돌아오면(이동 · bfcache · 새로 고침) 그 기록의 값부터 — 높이가 같아야 같은 자리', () => {
    const sync = sliceBetween(reader, 'const sync = (restorePosition, href = window.location.href) => {', 'setEntryDecided(true);');
    expect(sync).toContain("const coverPlace = id === 'cover' && restorePosition ? bookCoverPlaceOf(window.history.state, href) : null;");
    expect(sync).toContain('if (coverPlace) { setTocAll(coverPlace.all); setTocOpen(coverPlace.open); }');
    expect(reader).toContain('showAll={tocAll} onShowAll={setTocAll} openParts={tocOpen}');
    expect(home).toContain('data-toc-part={group.title} open={openParts ? openParts.includes(group.title) : group.title === current.part}');
    expect(home).toContain('const showAll = onShowAll ? !!heldAll : ownAll, setShowAll = onShowAll || setOwnAll;');
    expect(home).toContain('onClick={() => setShowAll(true)}');
  });
});
