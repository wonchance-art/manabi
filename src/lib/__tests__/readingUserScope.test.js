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

// P2-9: 레거시 무스코프 키는 소유자 불명이라 게스트가 아니라 **격리 키(:legacy)** 로 가둔다.
// 게스트 화면 진도 표시에만 읽기 병합하고, 계정 승계·서버 upsert·백필 대상에서는 전면 제외한다.
describe('레거시 무스코프 키 격리(P2-9)', () => {
  const legacyKey = `${READING_KEY}:legacy`;

  it('ja_reading_texts(콜론 없음) 발견 시 격리 키로 이관 후 원본 삭제', () => {
    localStorage.setItem(READING_KEY, JSON.stringify(['n5-tokyo-01', 'n5-tokyo-02']));
    // 게스트 로드 시 흡수 — 격리 키로 이관되고 원본 무스코프 키는 사라진다(게스트 화면엔 표시)
    expect([...loadPassedTexts()].sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-02']);
    expect(localStorage.getItem(READING_KEY)).toBe(null);         // 원본 무스코프 키 삭제
    expect(JSON.parse(localStorage.getItem(legacyKey)).sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-02']); // 격리 키에 보관
  });

  it('게스트 화면엔 격리분 + 진짜 게스트값이 합집합으로 표시(격리분은 게스트 키로 새지 않음)', () => {
    persistPassedTexts(new Set(['g1']));               // 업그레이드 후 진짜 게스트 진행
    localStorage.setItem(READING_KEY, JSON.stringify(['n5-tokyo-01']));
    expect([...loadPassedTexts()].sort()).toEqual(['g1', 'n5-tokyo-01']); // 화면 병합 표시
    // 격리분은 게스트 키(승계 대상)로 유입되지 않는다 — 게스트 키엔 g1 만 남는다
    expect(JSON.parse(localStorage.getItem(`${READING_KEY}:guest`))).toEqual(['g1']);
    expect(JSON.parse(localStorage.getItem(legacyKey))).toEqual(['n5-tokyo-01']);
  });

  it('레거시 격리분은 로그인 사용자에게 승계되지 않는다(소유자 불명 자동 귀속 금지)', async () => {
    localStorage.setItem(READING_KEY, JSON.stringify(['n5-tokyo-01']));
    const changed = await pullReadingProgress('A');    // 레거시는 격리 → A 승계 없음
    expect(changed).toBe(false);
    expect(loadPassedTexts('A').size).toBe(0);         // A 는 레거시를 받지 않는다
    expect(localStorage.getItem(READING_KEY)).toBe(null); // 원본은 격리 키로 이관됨
    expect([...loadPassedTexts()]).toEqual(['n5-tokyo-01']); // 게스트 화면엔 여전히 표시
  });

  it('레거시는 비승계, 업그레이드 후 진짜 게스트 신규분만 승계된다', async () => {
    localStorage.setItem(READING_KEY, JSON.stringify(['legacy-1'])); // 소유자 불명 레거시
    markReadingPassedLocal('guest-new');                            // 업그레이드 후 게스트 진행
    const changed = await pullReadingProgress('A');
    expect(changed).toBe(true);
    expect([...loadPassedTexts('A')]).toEqual(['guest-new']);       // 게스트 신규분만 승계
    expect(loadPassedTexts('A').has('legacy-1')).toBe(false);       // 레거시는 미승계
    expect([...loadPassedTexts()]).toEqual(['legacy-1']);           // 게스트 화면엔 레거시만 남아 표시
  });
});
