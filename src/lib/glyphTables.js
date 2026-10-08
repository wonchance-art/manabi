// 자형 열 표 지연 로드 — AE-R3 T1(VIEWER-V2-ROUNDS-001 §2.2 · 설계서 §8). 배선: ViewerPage(중국어 자료를 열 때, PR ②).
// 중국어 자료를 열면 유휴 시간에 정체 표(hanjaTrad.json — 正 줄)와 일본어 표기 표(jaWords.json —
// 日 줄 ⑵, CC BY-SA 4.0)를 미리 받아 둔다. 한국어·일본어·영어 자료는 부르지 않는다(호출부 조건).
// 같은 표를 여러 번 불러도 요청은 한 번이다. 실패하면 캐시를 비워 다음 기회에 다시 받는다.

let zhengPromise = null;
let jaWordsPromise = null;

const settle = (p, reset) => p.then((m) => m.default || m).catch((err) => { reset(); throw err; });

/** 정체 표(hanjaTrad.json — s2t·s2tw·모호 판정). */
export function loadZhengTable() {
  if (!zhengPromise) zhengPromise = settle(import('./data/hanjaTrad.json'), () => { zhengPromise = null; });
  return zhengPromise;
}

/** 일본어 표기·요미 표(jaWords.json — JMdict 파생, CC BY-SA 4.0). */
export function loadJaWordsTable() {
  if (!jaWordsPromise) jaWordsPromise = settle(import('./data/jaWords.json'), () => { jaWordsPromise = null; });
  return jaWordsPromise;
}

/**
 * 유휴 시간에 두 표를 미리 받는다(requestIdleCallback, 없으면 setTimeout). 실패는 조용히 넘긴다 —
 * 표가 없으면 자형 열을 그리지 않을 뿐이다. 반환값 = 예약 취소 함수(자료를 닫을 때).
 * onLoad({zheng, jaWords})는 두 요청이 끝나면 한 번 불린다(받지 못한 표는 null). 취소한 뒤에는 부르지 않는다(PR ② 배선 —
 * 뷰어가 받은 표를 상태로 쥔다).
 * @param {{timeout?: number, scheduler?: {idle?: Function, cancelIdle?: Function}, onLoad?: Function}} [opts]
 */
export function prefetchGlyphTables({ timeout = 2000, scheduler, onLoad } = {}) {
  const idle = scheduler?.idle ?? (typeof requestIdleCallback === 'function' ? requestIdleCallback : null);
  const cancelIdle = scheduler?.cancelIdle ?? (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : null);
  let done = false;
  let cancelled = false;
  const run = () => {
    if (done) return;
    done = true;
    const both = [loadZhengTable().catch(() => null), loadJaWordsTable().catch(() => null)];
    if (onLoad) Promise.all(both).then(([zheng, jaWords]) => { if (!cancelled) onLoad({ zheng, jaWords }); });
  };
  if (idle) {
    const id = idle(run, { timeout });
    return () => { done = true; cancelled = true; if (cancelIdle) cancelIdle(id); };
  }
  const id = setTimeout(run, 0);
  return () => { done = true; cancelled = true; clearTimeout(id); };
}

/** 테스트용 — 캐시를 비운다. */
export function resetGlyphTablesForTest() {
  zhengPromise = null;
  jaWordsPromise = null;
}
