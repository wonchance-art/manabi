import { describe, it, expect, vi, beforeEach } from 'vitest';

// P2-7: 진도 localStorage 키를 사용자 스코프로 — 계정 전환 시 A→B 진도 복제 차단.
// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

// supabase — 체이너블 목: select/eq/like 는 빈 결과 thenable, upsert 는 resolve.
// (여기 관심사는 로컬 키 스코프이지 서버 병합이 아니므로 서버는 빈 응답으로 고정)
const queryResult = { data: [], error: null };
function makeBuilder() {
  const b = {
    select: () => b,
    eq: () => b,
    like: () => b,
    upsert: () => Promise.resolve({ error: null }),
    then: (resolve) => resolve(queryResult),
  };
  return b;
}
vi.mock('../supabase', () => ({ supabase: { from: () => makeBuilder() } }));
vi.mock('../grammarSrs', () => ({ enqueueGrammarReview: vi.fn() }));

const {
  READING_KEY,
  loadPassedTexts,
  persistPassedTexts,
  markReadingPassedLocal,
  pullReadingProgress,
} = await import('../readingProgress');

// 인메모리 localStorage + window 스텁(node 환경엔 둘 다 없음)
function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

beforeEach(() => {
  globalThis.window = {};
  globalThis.localStorage = makeLocalStorage();
});

const keyOf = (uid) => `${READING_KEY}:${uid || 'guest'}`;

describe('스코프 키 — 계정별 분리(A→B 복제 차단)', () => {
  it('markReadingPassedLocal(id, uid) 은 사용자 스코프 키에만 쓴다', () => {
    markReadingPassedLocal('n5-tokyo-01', 'A');
    expect([...loadPassedTexts('A')]).toEqual(['n5-tokyo-01']);
    expect(loadPassedTexts('B').size).toBe(0);   // 다른 계정엔 미유입
    expect(loadPassedTexts().size).toBe(0);       // 게스트도 무관
    expect(localStorage.getItem(keyOf('A'))).toContain('n5-tokyo-01');
    expect(localStorage.getItem(keyOf('B'))).toBe(null);
  });

  it('A 통과분이 있어도 B 로그인 시 B 집합은 비어 있다(복제 없음)', async () => {
    markReadingPassedLocal('n5-tokyo-01', 'A');
    markReadingPassedLocal('n5-tokyo-02', 'A');
    // B 로그인 = pullReadingProgress('B') — 서버 빈 응답·게스트 빈 상태
    const changed = await pullReadingProgress('B');
    expect(changed).toBe(false);
    expect(loadPassedTexts('B').size).toBe(0);        // B 는 여전히 빈 집합
    expect([...loadPassedTexts('A')].sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-02']); // A 키 불변
  });
});

describe('게스트 승계 — 로그인 시 1회 병합 후 게스트 비움', () => {
  it('게스트 진행분이 로그인 사용자로 승계되고 게스트 키는 비워진다', async () => {
    markReadingPassedLocal('n5-tokyo-01');            // 게스트(uid 없음)
    expect([...loadPassedTexts()]).toEqual(['n5-tokyo-01']);

    const changed = await pullReadingProgress('A');   // A 로그인
    expect(changed).toBe(true);                        // 승계로 A 집합이 커짐
    expect([...loadPassedTexts('A')]).toEqual(['n5-tokyo-01']); // A 로 승계
    expect(loadPassedTexts().size).toBe(0);            // 게스트 비워짐
  });

  it('승계는 1회 — 이후 다른 계정 B 로그인은 A 의 게스트 승계분을 못 받는다', async () => {
    markReadingPassedLocal('n5-tokyo-01');            // 게스트
    await pullReadingProgress('A');                    // A 가 승계·게스트 비움
    const changed = await pullReadingProgress('B');    // B 로그인 — 게스트 이미 빔
    expect(changed).toBe(false);
    expect(loadPassedTexts('B').size).toBe(0);
    expect([...loadPassedTexts('A')]).toEqual(['n5-tokyo-01']); // A 승계분 보존
  });

  it('재 pull 은 재승계하지 않는다(게스트 빈 상태 멱등)', async () => {
    markReadingPassedLocal('n5-tokyo-01');
    await pullReadingProgress('A');
    const again = await pullReadingProgress('A');
    expect(again).toBe(false);                         // 추가 변경 없음
    expect([...loadPassedTexts('A')]).toEqual(['n5-tokyo-01']);
  });
});

describe('레거시 무스코프 키 마이그레이션', () => {
  it('ja_reading_texts(콜론 없음) 발견 시 게스트 키로 이관 후 삭제', () => {
    localStorage.setItem(READING_KEY, JSON.stringify(['n5-tokyo-01', 'n5-tokyo-02']));
    // 로드 시점에 흡수 — 게스트 키로 이관되고 레거시 키는 사라진다
    expect([...loadPassedTexts()].sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-02']);
    expect(localStorage.getItem(READING_KEY)).toBe(null); // 레거시 키 삭제
  });

  it('레거시 + 기존 게스트 값은 합집합으로 병합된다', () => {
    persistPassedTexts(new Set(['g1']));               // 기존 게스트
    localStorage.setItem(READING_KEY, JSON.stringify(['n5-tokyo-01']));
    expect([...loadPassedTexts()].sort()).toEqual(['g1', 'n5-tokyo-01']);
    expect(localStorage.getItem(READING_KEY)).toBe(null);
  });

  it('레거시 키가 로그인 사용자에게도 게스트 경유로 승계된다', async () => {
    localStorage.setItem(READING_KEY, JSON.stringify(['n5-tokyo-01']));
    const changed = await pullReadingProgress('A');    // 레거시→게스트→A 승계
    expect(changed).toBe(true);
    expect([...loadPassedTexts('A')]).toEqual(['n5-tokyo-01']);
    expect(localStorage.getItem(READING_KEY)).toBe(null);
    expect(loadPassedTexts().size).toBe(0);            // 게스트 비움
  });
});
