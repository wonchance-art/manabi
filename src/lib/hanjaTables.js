// 한자 훈음 · 음 · 정체 표 지연 로드 정본(HANJA-LAZY-001 — 로그인 점검 F3① ㉣, 오너 「권장대로」 2026-10-25 KST).
// 세 표(hanjaKo.json 음 ≈80KB gz · hanjaHun.json 훈 ≈52KB gz · hanjaTrad.json 정체)는 뷰어 첫 JS에 싣지 않는다 —
// 일본어 자료에도 늘 실리던 무게였다(TeachingWord → teachingWordLayout 정적 import 사슬). 표가 필요한 모든 곳
// (뷰어 · 판서 미리보기 · 단어 목록 · 글자 칸 · 한자 판)이 이 모듈 하나로 받는다: 표마다 요청 한 번 · 약속(promise) 한 벌.
// 실패하면 그 표의 약속을 비워 다음 기회에 다시 받는다.
//
// hanjaTablesNow()는 지금까지 받은 표를 동기로 돌려준다(받기 전에는 null). 표가 들어올 때마다 새 객체로 바뀌어
// useSyncExternalStore 스냅숏으로 쓸 수 있다(useHanjaTables). 판서 캔버스처럼 훈음 글자를 저장하는 곳은
// hanjaTablesEager.js를 정적으로 불러 표를 먼저 채운다(지연 로드 중 빈 훈음이 저장되면 남는다).

const IMPORTERS = {
  ko: () => import('./data/hanjaKo.json'),
  hun: () => import('./data/hanjaHun.json'),
  trad: () => import('./data/hanjaTrad.json'),
};
const KEY = { ko: 'koTable', hun: 'hunTable', trad: 'tradTable' };
export const HANJA_TABLE_NAMES = Object.freeze(['ko', 'hun', 'trad']);

const EMPTY = Object.freeze({ koTable: null, hunTable: null, tradTable: null });
let promises = {};
let snapshot = EMPTY;
const listeners = new Set();

function settle(name, table) {
  const key = KEY[name];
  if (snapshot[key] !== table) {
    snapshot = Object.freeze({ ...snapshot, [key]: table });
    for (const listener of [...listeners]) listener();
  }
  return table;
}

/** 표 하나('ko' · 'hun' · 'trad') — 한 번만 받는다. 같은 표를 여러 번 불러도 같은 약속을 돌려준다. */
export function loadHanjaTable(name) {
  if (!IMPORTERS[name]) return Promise.reject(new Error(`unknown hanja table: ${name}`));
  promises[name] ||= IMPORTERS[name]()
    .then((m) => settle(name, m.default || m))
    .catch((err) => { promises[name] = null; throw err; });
  return promises[name];
}

/** 언어별로 훈음 조회에 필요한 표 — 중국어는 정체 꼴로 찾으므로(R0+) 정체 표까지, 일본어는 음 · 훈만. 그 밖은 없음. */
export function hanjaTableNamesFor(language) {
  if (language === 'Chinese') return HANJA_TABLE_NAMES;
  if (language === 'Japanese') return ['ko', 'hun'];
  return [];
}

/** 여러 표를 함께 — { koTable, hunTable, tradTable }(부르지 않은 표는 지금 가진 값 · 없으면 null). */
export function loadHanjaTables(names = HANJA_TABLE_NAMES) {
  return Promise.all(names.map(loadHanjaTable)).then(() => snapshot);
}

/**
 * 첫 그림 뒤 유휴 시간에 names의 표를 받아 둔다(requestIdleCallback, 없으면 setTimeout 0 — timeout 안에는 반드시 돈다).
 * 실패는 조용히 넘긴다(필요한 상호작용에서 다시 받는다). 반환값 = 예약 취소 함수.
 * @param {string[]} names
 * @param {{timeout?: number, scheduler?: {idle?: Function, cancelIdle?: Function}}} [opts]
 */
export function preloadHanjaTables(names, { timeout = 2000, scheduler } = {}) {
  if (!names.length) return () => {};
  const idle = scheduler?.idle ?? (typeof requestIdleCallback === 'function' ? requestIdleCallback : null);
  const cancelIdle = scheduler?.cancelIdle ?? (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : null);
  let done = false;
  const run = () => { if (done) return; done = true; loadHanjaTables(names).catch(() => {}); };
  if (idle) {
    const id = idle(run, { timeout });
    return () => { done = true; if (cancelIdle) cancelIdle(id); };
  }
  const id = setTimeout(run, 0);
  return () => { done = true; clearTimeout(id); };
}

/** 지금까지 받은 표(동기). 받기 전 표는 null. 표가 들어올 때만 새 객체가 된다. */
export function hanjaTablesNow() {
  return snapshot;
}

/** names의 표가 모두 들어왔는지. */
export function hasHanjaTables(names, tables = snapshot) {
  return names.every((name) => !!tables[KEY[name]]);
}

/** 표가 들어올 때마다 부른다. 반환값 = 구독 해제. */
export function subscribeHanjaTables(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 이미 정적으로 실은 표를 채운다(hanjaTablesEager.js 전용 — 판서 캔버스). 같은 약속 · 같은 스냅숏을 쓴다. */
export function seedHanjaTables(tables) {
  for (const name of HANJA_TABLE_NAMES) {
    const table = tables[KEY[name]];
    if (!table) continue;
    settle(name, table);
    promises[name] = Promise.resolve(table);
  }
}

/** 테스트용 — 캐시를 비운다. */
export function resetHanjaTablesForTest() {
  promises = {};
  snapshot = EMPTY;
}
