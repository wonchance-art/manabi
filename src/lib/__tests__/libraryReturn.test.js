import { describe, it, expect } from 'vitest';
import { safeLibraryReturn, safeReaderReturn, libraryReaderHref, librarySearchHref, readerReturnLabel, readerReturnHref, readerReturnTarget, GUEST_READER_RETURN } from '../libraryReturn';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';
const read = file => fs.readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

// READER-RETURN-001 — 「함께 읽는 글 → 뷰어 → ← 함께 읽는 글」은 /materials?tab=public을 거치지 않고 곧장 /discover?view=reading으로 간다
// (경유하면 화면이 세 번 바뀌고 위치를 잃었다). 저장되는 returnTo는 그대로 /materials?tab=public…, 이동할 때만 바꾼다.
describe('reader return link destination (readerReturnHref)', () => {
  it('공개 목록 복귀는 /discover?view=reading + 공개 목록 키만(고정 순서)', () => {
    expect(readerReturnHref('/materials?tab=public&q=school&shown=40&restoreY=520')).toBe('/discover?view=reading&q=school&shown=40&restoreY=520');
    expect(readerReturnHref('/materials?restoreY=7&pinned=1&unread=1&sort=new&level=N5&lang=Japanese&q=%EC%97%AD&tab=public'))
      .toBe('/discover?view=reading&q=%EC%97%AD&lang=Japanese&level=N5&sort=new&unread=1&pinned=1&restoreY=7');
    expect(readerReturnHref('/materials?tab=public')).toBe('/discover?view=reading');
  });
  it('개인 키(tab · tools · scope · collection · outline · kind · state)는 복사하지 않는다', () => {
    expect(readerReturnHref('/materials?tab=public&tools=1&scope=all&collection=c1&outline=1&kind=pdf&state=trashed&view=owned&q=a'))
      .toBe('/discover?view=reading&q=a');
  });
  it('서재 · 수업 복귀는 바이트 단위로 그대로(safeReaderReturn과 같음)', () => {
    for (const value of ['/materials?view=owned&q=caf%C3%A9&shown=48&restoreY=840', '/materials', '/materials?collection=folder&restoreY=10',
      '/class/class-1?day=2026-09-10&view=history', '/class/class-1/live?day=2026-09-10', '/class/class-1?view=history&q=x&restoreY=90']) {
      expect(readerReturnHref(value)).toBe(safeReaderReturn(value));
    }
    expect(readerReturnHref('/materials?view=owned&restoreY=90')).toBe('/materials?view=owned&restoreY=90');
  });
  it.each(['https://evil.test/materials?tab=public', '//evil.test/materials?tab=public', 'javascript:alert(1)', '/discover?view=reading&q=x', '/discover', null])('악성 · 범위 밖 입력은 /materials: %s', value => {
    expect(readerReturnHref(value)).toBe('/materials');
  });
  it('저장 주소 · 라벨은 바뀌지 않는다 — returnTo는 여전히 /materials?tab=public…, 라벨은 「← 함께 읽는 글」(행선지 이름 — 「발견」 화면은 「산책」으로 바뀌었다, 2026-10-22 KST)', () => {
    const href = libraryReaderHref('/viewer/12', '/materials?tab=public&q=school', 520);
    expect(new URL(href, 'https://manabi.invalid').searchParams.get('returnTo')).toBe('/materials?tab=public&q=school&restoreY=520');
    expect(readerReturnLabel('/materials?tab=public&q=school')).toBe('← 함께 읽는 글');
  });
  it('배선 — 복귀 링크 · 대화 지우기 뒤 이동이 readerReturnHref를 쓴다(라벨 · 맥락 판정은 back 기준)', () => {
    const link = sliceBetween(read('src/components/web/LibraryReturnLink.jsx'), 'export function LibraryReturnLink');
    expect(link).toContain('const target = readerReturnTarget(returnTo, { guest });');
    expect(link).toContain('href={target.href}');
    expect(link).toContain('const back = safeReaderReturn(returnTo);');
    expect(link).toContain('readerReturnLabel(back)');
    const remove = sliceBetween(read('src/views/ViewerPage.jsx'), 'const deleteConversation = useCallback', 'const handleConversationTurn');
    expect(remove).toContain("noteRouter.push(readerReturnHref(originalParams.get('returnTo')))");
    expect(remove).not.toContain('safeReaderReturn(');
  });
  it('위치 복원은 한 훅(useRestoreScroll) — 서재와 함께 읽는 글(public만)이 같이 쓰고, 옛 공개 주소 리다이렉트는 남는다', () => {
    const hook = read('src/lib/useRestoreScroll.js');
    for (const piece of ['y > 1000000', 'performance.now() - started > 10000', 'requestAnimationFrame(restore)', "behavior: 'instant'",
      "url.searchParams.delete('restoreY')", 'window.history.replaceState', "addEventListener('wheel', stop", "addEventListener('touchstart', stop", "addEventListener('keydown', stop"]) {
      expect(hook).toContain(piece);
    }
    const library = sliceBetween(read('src/components/web/LibraryPage.jsx'), 'export default function LibraryPage', 'const {user,loading}');
    expect(library).toContain("useRestoreScroll(params.get('restoreY'));");
    expect(library).toContain("query.set('view','reading');router.replace(`/discover?${query}`)");
    expect(library).not.toContain('requestAnimationFrame');
    const lazy = sliceBetween(read('src/components/web/LazyMaterialsPage.jsx'), 'export default function LazyMaterialsPage');
    expect(lazy).toContain("useRestoreScroll(props.libraryView === 'public' ? params.get('restoreY') : null);");
  });
});
describe('library navigation without mixing learning progress',()=>{
  it('names the validated destination, including public browsing and class history',()=>{
    expect(readerReturnLabel('/materials?tab=public&q=school')).toBe('← 함께 읽는 글');
    expect(readerReturnLabel('/materials?view=owned&collection=folder')).toBe('← 내 서재');
    expect(readerReturnLabel('/class/class-a?view=history')).toBe('← 수업 기록');
    expect(readerReturnLabel('/class/class-a/live?day=2026-09-10')).toBe('← 수업 진행');
    expect(readerReturnLabel('https://evil.test/materials?tab=public')).toBe('← 내 서재');
  });
  it('returns classroom notes to the same class and date without broadening composer redirects',()=>{
    expect(safeReaderReturn('/class/class-1/live?day=2026-09-10&next=https://evil.test')).toBe('/class/class-1/live?day=2026-09-10');
    expect(safeReaderReturn('/class/class-1/live?day=2026-02-30')).toBe('/class/class-1/live');
    expect(safeLibraryReturn('/class/class-1/live')).toBe('/materials');
    expect(safeReaderReturn('/materials?view=owned&restoreY=90')).toBe('/materials?view=owned&restoreY=90');
  });
  it('keeps the class history destination after reading a saved lesson note',()=>{
    expect(safeReaderReturn('/class/class-1?view=history')).toBe('/class/class-1?view=history');
    expect(safeReaderReturn('/class/class-1?day=2026-09-10&view=history&next=https://evil.test')).toBe('/class/class-1?day=2026-09-10&view=history');
    expect(safeReaderReturn('/class/class-1?view=admin&next=https://evil.test')).toBe('/class/class-1');
    expect(safeLibraryReturn('/class/class-1?view=history')).toBe('/materials');
  });
  it.each(['//evil.test/class/a/live','https://evil.test/class/a/live','/class/a/../admin','/class/a/live#bad','/class/a/live/../../admin','/class/a/board','/class/a%2fb/live','javascript:alert(1)'])('rejects unsafe reader return: %s',value=>{
    expect(safeReaderReturn(value)).toBe('/materials');
  });
  it('search always leads to a view that renders the search input',()=>{
    expect(librarySearchHref({id:'member'})).toBe('/materials?view=owned#library-search');
    expect(librarySearchHref(null)).toBe('/materials?tab=public#library-search');
  });
  it.each(['https://evil.test','//evil.test','/materials/add','/materials/../admin','/materials?x=1#bad','javascript:alert(1)',null])('rejects unrelated redirects: %s',v=>{
    expect(safeLibraryReturn(v)).toBe('/materials');
  });
  it('preserves permitted filters, expanded rows and list position, strips arbitrary parameters',()=>{
    expect(safeLibraryReturn('/materials?view=owned&q=caf%C3%A9&shown=48&restoreY=840&next=evil')).toBe('/materials?view=owned&q=caf%C3%A9&shown=48&restoreY=840');
  });
  it('keeps precise PDF pages and token source parameters while adding a return destination',()=>{
    const href=libraryReaderHref('/pdf/file-id?page=7','/materials?view=owned&q=hello',320);
    const parsed=new URL(href,'https://manabi.invalid');
    expect(parsed.searchParams.get('page')).toBe('7');expect(parsed.searchParams.get('returnTo')).toBe('/materials?view=owned&q=hello&restoreY=320');
    expect(libraryReaderHref('/viewer/123?sourceToken=x#word','/materials')).toContain('sourceToken=x');
    expect(libraryReaderHref('/viewer/123?sourceToken=x#word','/materials')).toMatch(/#word$/);
    expect(libraryReaderHref('/books/japanese-n5#u03','/materials')).toBe('/books/japanese-n5#u03');
  });
});

// 손님 「←」 = 산책(뷰어 기능 감사 2026-10-17 KST) — 아이콘 버튼이라 그림은 같고 이름 · 툴팁 · 이동처만 바뀐다.
describe('guest reader return (readerReturnTarget)', () => {
  it('맥락 없는 손님은 산책으로 — 없음 · 빈 값 · 거절된 주소', () => {
    expect(GUEST_READER_RETURN).toEqual({ href: '/discover', label: '← 산책' });
    for (const value of [null, undefined, '', 'https://evil.test/materials?tab=public', '/admin']) {
      expect(readerReturnTarget(value, { guest: true }), String(value)).toEqual({ href: '/discover', label: '← 산책', guestDefault: true });
    }
  });
  it('쓸 수 있는 returnTo가 있으면 손님도 그쪽이 우선 — 발견 · 그대로 받은 /materials · 수업', () => {
    expect(readerReturnTarget('/materials?tab=public&q=school', { guest: true })).toEqual({ href: '/discover?view=reading&q=school', label: '← 함께 읽는 글', guestDefault: false });
    expect(readerReturnTarget('/materials', { guest: true })).toEqual({ href: '/materials', label: '← 내 서재', guestDefault: false });
    expect(readerReturnTarget('/class/class-a?view=history', { guest: true }).label).toBe('← 수업 기록');
  });
  it('회원 · 로그인 확인 중(guest=false)은 지금 그대로', () => {
    for (const value of [null, '', '/materials?view=owned', '/materials?tab=public&q=school']) {
      expect(readerReturnTarget(value), String(value)).toEqual({ href: readerReturnHref(value), label: readerReturnLabel(value), guestDefault: false });
    }
  });
  it('배선 — 뷰어의 「←」 넷이 확인된 손님 판정과 같은 목표를 쓰고, 아이콘(children)은 그대로 그린다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('const { user, profile, fetchProfile, isAdmin, loading: authLoading } = useAuth();');
    expect(viewer).toContain('const guestReader = !user && !authLoading;');
    expect(viewer).toContain("const backTarget = readerReturnTarget(originalParams.get('returnTo'), { guest: guestReader });");
    expect(viewer.split('guest={guestReader} aria-label={vt(backTarget.label)}').length - 1).toBe(4);
    expect(sliceBetween(viewer, '<LibraryReturnLink className="viewer-back-link viewer-back-link--icon"', '</LibraryReturnLink>'))
      .toContain('title={vt(backTarget.label)} data-icon-action><ActionIcon name="back"/>');
    expect(viewer).not.toContain('readerReturnLabel(');
    const link = sliceBetween(read('src/components/web/LibraryReturnLink.jsx'), 'export function LibraryReturnLink');
    expect(link).toContain("{target.guestDefault || label === '← 내 서재' ? children || target.label : label}");
    expect(read('src/lib/viewerMessages.js')).toContain("['← 산책','← 漫步','← 漫步']");
  });
});
