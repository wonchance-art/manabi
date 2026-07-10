import { describe, it, expect, vi, beforeEach } from 'vitest';

// P2-8(resolved {error} 처리·재시도) + P1-4(계정 전환 stale pull 폐기·교차 기록 차단).
// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

// upsert 결과를 테스트마다 바꿔 {error} 분기를 검증하기 위한 제어형 목.
let upsertResult = { error: null };
const upsertCalls = [];
function makeBuilder() {
  const b = {
    select: () => b,
    eq: () => b,
    like: () => b,
    upsert: (rows) => { upsertCalls.push(rows); return Promise.resolve(upsertResult); },
    then: (resolve) => resolve({ data: [], error: null }),
  };
  return b;
}
vi.mock('../supabase', () => ({ supabase: { from: () => makeBuilder() } }));
vi.mock('../grammarSrs', () => ({ enqueueGrammarReview: vi.fn() }));

const {
  READING_KEY,
  markReadingPassedRemote,
  markReadingPassedLocal,
  loadPassedTexts,
  pullReadingProgress,
  pullApplies,
} = await import('../readingProgress');

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  globalThis.window = {};
  globalThis.localStorage = makeLocalStorage();
  upsertResult = { error: null };
  upsertCalls.length = 0;
});

// ── P2-8: markReadingPassedRemote 가 supabase {error} 를 확인해 성공/실패를 반환 ──
describe('markReadingPassedRemote — resolved {error} → 성공/실패 boolean(P2-8)', () => {
  it('error 없으면 true 반환', async () => {
    upsertResult = { error: null };
    expect(await markReadingPassedRemote('A', 'n5-tokyo-01')).toBe(true);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({ user_id: 'A', slug: 'rt:n5-tokyo-01', read: true });
  });

  it('error 있으면 false 반환 — 호출부가 재시도 UI 를 띄울 근거', async () => {
    upsertResult = { error: { message: 'network' } };
    expect(await markReadingPassedRemote('A', 'n5-tokyo-01')).toBe(false);
  });

  it('userId/id 누락은 upsert 없이 false', async () => {
    expect(await markReadingPassedRemote(null, 'n5-tokyo-01')).toBe(false);
    expect(await markReadingPassedRemote('A', null)).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('재시도는 push(upsert)부터 다시 — 실패 후 성공 시 upsert 가 2회 호출된다', async () => {
    upsertResult = { error: { message: 'boom' } };
    expect(await markReadingPassedRemote('A', 'n5-tokyo-01')).toBe(false); // 1회차 실패
    upsertResult = { error: null };
    expect(await markReadingPassedRemote('A', 'n5-tokyo-01')).toBe(true);  // 재시도 성공
    expect(upsertCalls).toHaveLength(2); // push 부터 다시 시도됨(pull/refresh 반복이 아님)
  });
});

// ── P1-4: stale pull 폐기 판정 ──
describe('pullApplies — 계정 전환 중 stale pull 폐기(P1-4)', () => {
  it('요청 uid 와 현재 uid 가 같을 때만 반영', () => {
    expect(pullApplies('A', 'A')).toBe(true);
    expect(pullApplies('A', 'B')).toBe(false); // 전환됨 → 폐기
    expect(pullApplies('A', undefined)).toBe(false); // 로그아웃 → 폐기
    expect(pullApplies(undefined, 'A')).toBe(false); // 요청 uid 없음(게스트 pull) → 미반영
  });

  it('A 로 건 pull 이 B 전환 후 도착해도 B 에 반영되지 않는다', () => {
    // 컴포넌트가 requestUid='A' 로 pull 을 걸고, 결과 도착 시 현재 uid 가 'B' 라면 setPassedSet 을 건너뛴다.
    const requestUid = 'A';
    const currentUidAtResolve = 'B'; // 그 사이 B 로 전환
    expect(pullApplies(requestUid, currentUidAtResolve)).toBe(false);
  });
});

// ── P1-4: 계정 전환 시 활성 문항 결과가 B 로 기록되지 않음(스코프 격리 로직 레벨) ──
describe('계정 전환 교차 기록 차단 — 활성 통과는 연 계정 스코프에만 기록(P1-4)', () => {
  it('A 세션에서 통과 기록한 결과는 B 집합에 나타나지 않는다', async () => {
    // A 로 활성 문항을 열고 통과 → A 스코프 키에만 기록
    markReadingPassedLocal('n5-tokyo-01', 'A');
    upsertResult = { error: null };
    expect(await markReadingPassedRemote('A', 'n5-tokyo-01')).toBe(true);
    expect(upsertCalls[0].user_id).toBe('A'); // 원격도 A 로만

    // B 로 전환(remount) 후 로드 — B 는 빈 집합, A 진도가 복제되지 않는다
    const changed = await pullReadingProgress('B');
    expect(changed).toBe(false);
    expect(loadPassedTexts('B').size).toBe(0);
    expect([...loadPassedTexts('A')]).toEqual(['n5-tokyo-01']);
  });

  it('레거시 무스코프 키가 있어도 전환 계정(B)에 자동 귀속되지 않는다', async () => {
    localStorage.setItem(READING_KEY, JSON.stringify(['orphan']));
    const changed = await pullReadingProgress('B');
    expect(changed).toBe(false);
    expect(loadPassedTexts('B').size).toBe(0); // 소유자 불명 레거시는 B 로 승계 안 됨(P2-9)
  });
});

// ── P2-7 경합: 직전 통과 동기화 중 다음 노드 완료 시 유실 없음(직렬화·로컬 우선 기록) ──
describe('통과 경합 — 로컬 우선 기록 + pull 이 로컬 전용 통과분을 모두 밀어올린다(유실 0)', () => {
  it('두 노드를 연속 통과 기록하면 둘 다 보존되고 pull 이 둘 다 upsert 한다', async () => {
    // 직전 통과(01) 동기화가 도는 사이 다음 노드(02)도 완료 — 둘 다 로컬에 남는다.
    markReadingPassedLocal('n5-tokyo-01', 'A');
    markReadingPassedLocal('n5-tokyo-02', 'A');
    expect([...loadPassedTexts('A')].sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-02']);

    upsertResult = { error: null };
    await pullReadingProgress('A'); // 서버 빈 응답 → 로컬 전용 통과분 전부 push
    // toPush 는 rt: slug 로 두 노드 모두 포함 — 유실 없이 서버로 올라간다
    const pushed = upsertCalls.find((c) => Array.isArray(c));
    expect(pushed.map((r) => r.slug).sort()).toEqual(['rt:n5-tokyo-01', 'rt:n5-tokyo-02']);
    expect([...loadPassedTexts('A')].sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-02']);
  });
});
