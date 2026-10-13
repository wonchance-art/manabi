import { describe, expect, it, vi } from 'vitest';

// 로그인 전 /vocab 크래시 회귀(2026-10-14 M09 #1447 Preview): query가 꺼져 learning이 없을 때
// `learning?.actorId === user?.id`가 undefined === undefined로 참이 되어 `learning.rows`를 읽던 문제.
// DOM 없이 훅을 직접 부른다 — React 훅은 단순 대역, react-query는 꺼진 query(data 없음) 대역
// (wallStatesBehavior.test.jsx의 하네스 선례).
const h = vi.hoisted(() => ({ user: null, learning: undefined }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, useRef: initial => ({ current: initial }), useMemo: fn => fn() };
});
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }) => (queryKey[2] === 'learning' ? { data: h.learning, isLoading: false, error: null, refetch: () => {} } : { data: undefined }),
  useMutation: () => ({ mutate: () => {}, mutateAsync: async () => {} }),
  useQueryClient: () => ({ invalidateQueries: () => {}, setQueryData: () => {}, getQueryData: () => undefined }),
}));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../ToastContext', () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock('../supabase', () => ({ supabase: {} }));

const { useVocabData } = await import('../useVocabData');

describe('useVocabData — 로그인 전 · 다른 계정 결과', () => {
  it('사용자가 없고 query 결과도 없으면 빈 목록을 돌려준다(크래시 없음)', () => {
    h.user = null; h.learning = undefined;
    const result = useVocabData();
    expect(result.vocab).toEqual([]);
    expect(result.projections).toEqual([]);
    expect(result.learningAvailable).toBe(false);
    expect(result.isOffline).toBe(false);
  });

  it('사용자가 없으면 남아 있는 결과도 읽지 않는다', () => {
    h.user = null; h.learning = { actorId: undefined, rows: [{ id: 1 }], projections: [], complete: true };
    expect(useVocabData().vocab).toEqual([]);
  });

  it('다른 계정의 결과는 읽지 않고, 내 결과만 읽는다', () => {
    h.user = { id: 'me' };
    h.learning = { actorId: 'other', rows: [{ id: 1 }], projections: [], complete: true };
    expect(useVocabData().vocab).toEqual([]);
    h.learning = { actorId: 'me', rows: [{ id: 2 }], projections: [], complete: true };
    const mine = useVocabData();
    expect(mine.vocab).toEqual([{ id: 2 }]);
    expect(mine.learningAvailable).toBe(true);
  });
});
