import { describe, it, expect, vi, beforeEach } from 'vitest';

// P2-5: pullReadingProgress 의 toPush bulk upsert resolved {error} 처리 —
//   실패 시 게스트 원본 키 보존·SRS 백필 중단·오류 전파(재시도 UI 연결, refresh 반복 금지).
// P3-8: writeSetToKey 가 setItem 예외를 잡되 성공 여부를 반환 — 목적지 쓰기 성공 후에만 원본 삭제/초기화.
// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

// 제어형 supabase 목 — select/like 는 빈 결과 thenable, upsert 결과는 upsertResult 로 바꾼다.
let upsertResult = { error: null };
const upsertCalls = [];
function makeBuilder() {
  const b = {
    select: () => b,
    eq: () => b,
    like: () => b,
    upsert: (rows) => { upsertCalls.push(rows); return Promise.resolve(upsertResult); },
    then: (resolve) => resolve({ data: [], error: null }), // 서버 빈 응답(로컬 전용 통과분 → push 유발)
  };
  return b;
}
vi.mock('../supabase', () => ({ supabase: { from: () => makeBuilder() } }));
vi.mock('../grammarSrs', () => ({ enqueueGrammarReview: vi.fn() }));

const { READING_KEY, loadPassedTexts, pullReadingProgress } = await import('../readingProgress');
const { enqueueGrammarReview } = await import('../grammarSrs');

// 인메모리 localStorage — failKey 에 대한 setItem 은 throw(용량 초과·프라이빗 모드 모사)
function makeLocalStorage(failKey) {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { if (failKey && k === failKey) throw new Error('quota exceeded'); store.set(k, String(v)); },
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

const guestKey = `${READING_KEY}:guest`;
const legacyKey = `${READING_KEY}:legacy`;
const ukey = (uid) => `${READING_KEY}:${uid}`;

beforeEach(() => {
  globalThis.window = {};
  globalThis.localStorage = makeLocalStorage();
  upsertResult = { error: null };
  upsertCalls.length = 0;
  enqueueGrammarReview.mockClear();
});

// ── P2-5: bulk upsert resolved {error} ──
describe('pullReadingProgress — toPush bulk {error} 처리(P2-5)', () => {
  it('bulk 실패 시 게스트 원본 키 보존·SRS 백필 미실행·오류 전파', async () => {
    localStorage.setItem(guestKey, JSON.stringify(['n5-tokyo-01'])); // 게스트 진행분(승계 대상)
    upsertResult = { error: { message: 'bulk failed' } };

    // 오류는 호출부로 전파돼 "push 부터 재시도" UI 에 연결된다(반환값으로 흘려보내지 않음)
    await expect(pullReadingProgress('A')).rejects.toThrow();

    // 게스트 원본 키는 비워지지 않는다 — 재시도 근거 보존
    expect(JSON.parse(localStorage.getItem(guestKey))).toEqual(['n5-tokyo-01']);
    // SRS 백필은 push 성공 전엔 실행되지 않는다(서버가 통과를 모르는 채 큐 등록 금지)
    expect(enqueueGrammarReview).not.toHaveBeenCalled();
    // 로컬 uk 에는 승계분이 이미 영속돼 데이터 유실은 없다
    expect([...loadPassedTexts('A')]).toEqual(['n5-tokyo-01']);
  });

  it('재시도(bulk 성공)로 회복 — 게스트 비움·백필 실행', async () => {
    localStorage.setItem(guestKey, JSON.stringify(['n5-tokyo-01']));
    upsertResult = { error: { message: 'bulk failed' } };
    await expect(pullReadingProgress('A')).rejects.toThrow(); // 1회차 실패
    expect(JSON.parse(localStorage.getItem(guestKey))).toEqual(['n5-tokyo-01']); // 게스트 잔존

    upsertResult = { error: null };
    await pullReadingProgress('A'); // 재시도 성공(throw 없음)
    expect(loadPassedTexts('A').has('n5-tokyo-01')).toBe(true); // 데이터 보존
    expect(localStorage.getItem(guestKey)).toBe(JSON.stringify([])); // 이제 게스트 비움(승계 완료)
    // 백필이 이번에 실행된다(rt: slug 등록)
    expect(enqueueGrammarReview).toHaveBeenCalledWith('A', 'Japanese', 'rt:n5-tokyo-01');
  });

  it('push 불필요(로컬 전용 통과분 없음)면 오류 없이 정상 완료', async () => {
    // 게스트·로컬 모두 비어 서버 빈 응답 → toPush 없음 → bulk 미호출 → throw 없음
    const changed = await pullReadingProgress('A');
    expect(changed).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });
});

// ── P3-8: writeSetToKey 성공 여부 반환 → 목적지 쓰기 성공 후에만 원본 삭제/초기화 ──
describe('localStorage 쓰기 실패 후 원본 보존(P3-8)', () => {
  it('레거시 이관: 목적지(:legacy) 쓰기 실패 시 원본 무스코프 키를 삭제하지 않는다', () => {
    globalThis.localStorage = makeLocalStorage(legacyKey); // :legacy 쓰기만 실패
    localStorage.setItem(READING_KEY, JSON.stringify(['orphan'])); // 소유자 불명 레거시(콜론 없음)

    loadPassedTexts(); // 게스트 로드 → migrateLegacyReadingKey 시도

    // 목적지 쓰기 실패 → 원본 보존(다음 기회 재이관)
    expect(JSON.parse(localStorage.getItem(READING_KEY))).toEqual(['orphan']);
    expect(localStorage.getItem(legacyKey)).toBe(null); // 격리 키엔 쓰이지 못함
  });

  it('레거시 이관: 목적지 쓰기 성공 시에만 원본이 삭제된다(정상 경로)', () => {
    localStorage.setItem(READING_KEY, JSON.stringify(['orphan']));
    expect([...loadPassedTexts()]).toEqual(['orphan']); // 격리 키로 이관돼 게스트 화면 표시
    expect(localStorage.getItem(READING_KEY)).toBe(null);            // 원본 삭제됨
    expect(JSON.parse(localStorage.getItem(legacyKey))).toEqual(['orphan']); // 격리 키 보관
  });

  it('게스트 승계: 사용자 키(목적지) 쓰기 실패 시 게스트 원본 키를 비우지 않는다', async () => {
    globalThis.localStorage = makeLocalStorage(ukey('A')); // 사용자 키 쓰기만 실패
    localStorage.setItem(guestKey, JSON.stringify(['g1']));

    await pullReadingProgress('A');

    // 목적지(uk) 쓰기 실패 → 게스트 원본 보존(승계 미완, 다음 기회 재시도)
    expect(JSON.parse(localStorage.getItem(guestKey))).toEqual(['g1']);
    expect(localStorage.getItem(ukey('A'))).toBe(null); // uk 는 쓰이지 못함
  });
});
