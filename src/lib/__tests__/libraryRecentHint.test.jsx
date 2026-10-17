import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

// 서재 칸의 「지난번 0개」 기기 기억(2026-10-17 KST 실측): 서버 미리 받기가 빠진 첫 화면에서 골격이 섰다가 0개 모양으로
// 바뀌며 아래 칸 전체가 올라갔다 — 읽던 곳(골격 ~150px → 칸 없음, 390 CLS 0.113) · 대화(골격 한 줄 → 안내 한 줄, 0.045).
// 이 기기에서 지난번 0개였으면 받는 동안 0개 모양을 미리 그린다. 새 기기 · 있었던 계정 · 저장소 불가 · 서버가 그린 서재(hydration)는 골격.
// 바닥 링크(지난 이야기 · 복습 · …)는 목록이 온 뒤에 — 짧은 목록 골격 아래 보였다가 밀려나던 이동(0.047).
const h = vi.hoisted(() => ({ q: {} }));
vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({}), usePathname: () => '/materials' }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../../components/web/LibraryReaderLink', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }) => ({ data: undefined, isError: false, isPending: true, isSuccess: false, refetch: () => {}, ...h.q[queryKey[0]] }),
  useInfiniteQuery: () => ({ isPending: true }), useQueryClient: () => ({}),
}));

const { RecentReads } = await import('../../components/library/LibraryShelf');
const { default: ConversationShelf } = await import('../../components/library/ConversationShelf');
const { shelfHintKey } = await import('../../components/library/useShelfEmptyHint');
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const user = { id: 'u1' };
const withHints = (hints) => vi.stubGlobal('window', { localStorage: { getItem: (key) => hints[key] ?? null, setItem: () => {} } });
const recentSkeleton = (props = {}) => renderToStaticMarkup(createElement(RecentReads, { user, ...props })).includes('shelf-recent-skeleton');
const pending = { isPending: true, isSuccess: false, isError: false };
const conversations = (props = {}) => renderToStaticMarkup(createElement(ConversationShelf, { query: pending, ownerId: 'u1', ...props }));

afterEach(() => { vi.unstubAllGlobals(); h.q = {}; });

describe('기기 기억 열쇠 — 계정 · 칸별', () => {
  it('읽던 곳은 1f3d85bd와 같은 열쇠(기존 기록 그대로), 대화는 따로', () => {
    expect(shelfHintKey('recent', 'u1')).toBe('library-recent-seen:u1');
    expect(shelfHintKey('conversations', 'u1')).toBe('library-conversations-seen:u1');
  });
});

describe('읽던 곳 — 지난번 0개면 받는 동안 골격을 세우지 않는다', () => {
  it('받는 중: 지난번 0개면 골격 없음, 있었거나 기록 없음이면 골격', () => {
    withHints({ 'library-recent-seen:u1': '0' }); expect(recentSkeleton()).toBe(false);
    withHints({ 'library-recent-seen:u1': '1' }); expect(recentSkeleton()).toBe(true);
    withHints({}); expect(recentSkeleton()).toBe(true);
  });
  it('서버가 그린 서재(ssr)는 기기 기록을 읽지 않는다 — 서버 HTML과 같은 첫 그림(hydration)', () => {
    withHints({ 'library-recent-seen:u1': '0' }); expect(recentSkeleton({ ssr: true })).toBe(true);
  });
  it('저장소를 못 쓰면(사생활 창 등) 지금처럼 골격', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); } } });
    expect(recentSkeleton()).toBe(true);
  });
  it('받아 온 읽던 곳이 있으면 줄을 고르는 한 프레임은 여전히 골격(LOADING-SKELETON-001 그대로)', () => {
    withHints({ 'library-recent-seen:u1': '0' }); h.q['library-recent'] = { isPending: false, isSuccess: true, data: { items: [{ opened_at: '2026-10-17' }] } };
    expect(recentSkeleton()).toBe(true);
  });
});

describe('대화 — 지난번 0개면 받는 동안 0개 모양(입구 + 안내)', () => {
  it('받는 중: 지난번 0개면 골격 대신 「새 대화」 입구와 안내 한 줄, 기록 없음 · 있었음이면 골격', () => {
    withHints({ 'library-conversations-seen:u1': '0' });
    const empty = conversations();
    expect(empty).not.toContain('skeleton');
    expect(empty).toContain('새 대화');
    expect(empty).toContain('AI 튜터와 목표어로 이야기해요');
    withHints({ 'library-conversations-seen:u1': '1' }); expect(conversations()).toContain('skeleton');
    withHints({}); expect(conversations()).toContain('skeleton');
  });
  it('같은 예외: 서버가 그린 서재 · 저장소 불가 · 계정 모름은 골격', () => {
    withHints({ 'library-conversations-seen:u1': '0' });
    expect(conversations({ ssr: true })).toContain('skeleton');
    expect(conversations({ ownerId: undefined })).toContain('skeleton');
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); } } });
    expect(conversations()).toContain('skeleton');
  });
  it('읽던 곳 기록은 대화에 번지지 않는다(칸별 열쇠)', () => {
    withHints({ 'library-recent-seen:u1': '0' }); expect(conversations()).toContain('skeleton');
  });
});

describe('배선', () => {
  const hook = read('src/components/library/useShelfEmptyHint.js');
  const shelf = read('src/components/library/LibraryShelf.jsx');
  it('받은 결과(있음/없음)를 남기고, 기록 읽기는 첫 그림 한 번(useState) · 서버 그림 · 계정 없음 예외', () => {
    expect(hook).toContain("const seen=key&&query.isSuccess?(count>0?'1':'0'):null;");
    expect(hook).toContain('window.localStorage.setItem(key,seen)');
    expect(hook).toContain("const [hint]=useState(()=>!key||ssr||typeof window==='undefined'?null:readHint(key));");
    expect(hook).toContain("return hint==='0';");
  });
  it('두 칸이 같은 훅을 쓰고, LibraryPage가 서버 그림 여부를 넘긴다', () => {
    expect(sliceBetween(shelf, 'export function RecentReads(', 'function FilterDialog(')).toContain("useShelfEmptyHint('recent',user.id,ssr,recent,");
    expect(read('src/components/library/ConversationShelf.jsx')).toContain("useShelfEmptyHint('conversations',ownerId,ssr,query,");
    expect(shelf).toContain('<RecentReads user={user} ssr={ssr}/>');
    expect(shelf).toContain('<ConversationShelf query={conversations} ownerId={user.id} ssr={ssr}/>');
    expect(read('src/components/web/LibraryPage.jsx')).toContain('<LibraryShelf key={shelfUser.id} user={shelfUser} ssr={!!serverUserId}/>');
  });
  it('바닥 링크는 목록이 온 뒤(받는 중엔 없음)', () => {
    expect(shelf).toContain('{!list.isPending&&<footer className="shelf-footer">');
  });
});
