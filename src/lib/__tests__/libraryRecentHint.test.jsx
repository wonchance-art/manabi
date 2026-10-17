import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

// 서재 「읽던 곳」 골격의 접힘(2026-10-17 KST 실측): 서버 미리 받기가 빠진 첫 화면에서 읽던 곳이 없는 계정은
// 골격(~150px)이 섰다가 접히며 아래 칸 전체가 올라갔다(390 CLS 0.11 · 1440 0.08). 이 기기에서 지난번 0개였으면
// 받는 동안 골격을 세우지 않는다. 새 기기 · 있었던 계정 · 서버가 그린 서재(hydration)는 지금처럼 골격.
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
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const user = { id: 'u1' };
const withHint = (value) => vi.stubGlobal('window', { localStorage: { getItem: (key) => (key === 'library-recent-seen:u1' ? value : null), setItem: () => {} } });
const skeleton = (props = {}) => renderToStaticMarkup(createElement(RecentReads, { user, ...props })).includes('shelf-recent-skeleton');

afterEach(() => { vi.unstubAllGlobals(); h.q = {}; });

describe('읽던 곳 골격 — 지난번 0개였던 계정은 받는 동안 세우지 않는다', () => {
  it('받는 중: 지난번 0개면 골격 없음, 있었거나 기록 없음이면 골격', () => {
    withHint('0'); expect(skeleton()).toBe(false);
    withHint('1'); expect(skeleton()).toBe(true);
    withHint(null); expect(skeleton()).toBe(true);
  });
  it('서버가 그린 서재(ssr)는 기기 기록을 읽지 않는다 — 서버 HTML과 같은 첫 그림(hydration)', () => {
    withHint('0'); expect(skeleton({ ssr: true })).toBe(true);
  });
  it('저장소를 못 쓰면(사생활 창 등) 지금처럼 골격', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); } } });
    expect(skeleton()).toBe(true);
  });
  it('받아 온 읽던 곳이 있으면 줄을 고르는 한 프레임은 여전히 골격(LOADING-SKELETON-001 그대로)', () => {
    withHint('0'); h.q['library-recent'] = { isPending: false, isSuccess: true, data: { items: [{ opened_at: '2026-10-17' }] } };
    expect(skeleton()).toBe(true);
  });
  it('배선: 받은 결과(있음/없음)를 계정별 기록으로 남기고, 서버가 그린 서재 여부를 LibraryPage가 넘긴다', () => {
    const shelf = read('src/components/library/LibraryShelf.jsx');
    const recent = sliceBetween(shelf, 'export function RecentReads(', 'function FilterDialog(');
    expect(recent).toContain("const seen=recent.isSuccess?(recent.data?.items?.length>0?'1':'0'):null;");
    expect(recent).toContain('window.localStorage.setItem(recentHintKey(user.id),seen)');
    expect(shelf).toContain('<RecentReads user={user} ssr={ssr}/>');
    expect(read('src/components/web/LibraryPage.jsx')).toContain('<LibraryShelf key={shelfUser.id} user={shelfUser} ssr={!!serverUserId}/>');
  });
});
