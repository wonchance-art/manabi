// 실사용자 화면 밀림(CLS) 기록(RUM-CLS-001, 2026-11-08 KST) — 측정 앞단 36회로도 재현되지 않은 /home 첫 방문 푸터 0.20 같은 밀림을
// 실제 방문에서 잡는다. 기존 운영 오류 기록(observe.error_events — ERROR-OBSERVE-001 · CSP 보고)의 연장이다.
//
// 보내는 것: 0.1을 넘는 방문만(「개선 필요」 이상 — web.dev 기준). 칸은 경로 틀(쿼리 · ID 없음) · CLS 값 · 가장 큰 이동의 출처 선택자
// (태그 · 클래스만) · 그 시각 · 화면 폭 구간(폰/PC) · 연결 유형(effectiveType)뿐. 계정 · IP · 쿼리 · 글 내용은 없다.
// 계산은 CLS 정의 그대로(세션 창 — 이동 사이 1초 · 창 최대 5초, 입력 직후 500ms 이동 제외). 새 패키지 없이 PerformanceObserver로 —
// next/web-vitals(useReportWebVitals)는 원인 출처(attribution)를 주지 않고, 앱 안 이동(경로 바뀜)마다 끊지 않는다.
import { sanitizeRoute } from './errorEvent';

export const CLS_REPORT_THRESHOLD = 0.1;
export const CLS_POOR = 0.25;
export const VITALS_ENDPOINT = '/api/vitals';
export const CLS_KIND = 'vitals.cls';
const NETS = new Set(['slow-2g', '2g', '3g', '4g']);
const SELECTOR = /^[a-z0-9_.-]{1,80}$/;

/** 이동 출처 요소 → 「태그.클래스1.클래스2」(id · 글 · 속성 없음). 쓸 수 없는 글자는 버린다. */
export function selectorOf(node) {
  if (!node || typeof node.tagName !== 'string') return 'unknown';
  const tag = node.tagName.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const classes = typeof node.className === 'string'
    ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((c) => c.toLowerCase().replace(/[^a-z0-9_-]/g, '')).filter(Boolean)
    : [];
  const out = [tag || 'el', ...classes].join('.').slice(0, 80);
  return SELECTOR.test(out) ? out : 'unknown';
}

/** 화면 폭 → 'phone'(768 이하 — docs/ui-conventions.md 태블릿 세로 경계) · 'pc'. */
export const viewportClass = (width) => (Number(width) <= 768 ? 'phone' : 'pc');

/** navigator.connection.effectiveType → 정해진 낱말만, 모르면 'unknown'. */
export function connectionType(nav) {
  const t = nav?.connection?.effectiveType;
  return NETS.has(t) ? t : 'unknown';
}

/**
 * CLS 세션 창 계산기 — layout-shift 항목을 차례로 넣는다. 입력 직후 이동(hadRecentInput)은 뺀다.
 * worst(): 가장 큰 창의 { value, source, time } — source는 그 창에서 가장 큰 이동의 가장 넓은 출처 요소, time은 그 이동 시각(ms).
 */
export function createClsTracker() {
  let win = null; // { value, first, last, top: { value, entry } }
  let best = null;
  const take = (entry) => {
    if (!entry || entry.hadRecentInput || !(entry.value > 0)) return;
    const t = entry.startTime;
    if (!win || t - win.last > 1000 || t - win.first > 5000) win = { value: 0, first: t, last: t, top: null };
    win.value += entry.value;
    win.last = t;
    if (!win.top || entry.value > win.top.value) win.top = { value: entry.value, entry };
    if (!best || win.value > best.value) best = { value: win.value, top: win.top };
  };
  return {
    add: take,
    value: () => (best ? best.value : 0),
    worst() {
      if (!best) return { value: 0, source: 'unknown', time: 0 };
      const entry = best.top.entry;
      const area = (s) => (s?.currentRect?.width || 0) * (s?.currentRect?.height || 0) + (s?.previousRect?.width || 0) * (s?.previousRect?.height || 0);
      const source = [...(entry.sources || [])].sort((a, b) => area(b) - area(a))[0];
      return { value: best.value, source: selectorOf(source?.node), time: Math.round(entry.startTime) };
    },
    reset() { win = null; best = null; },
  };
}

/**
 * 보낼 기록 한 건 — 0.1 이하면 null(보내지 않는다). message는 묶음 열쇠(등급 · 화면 폭 · 연결 · 출처)라 같은 밀림은 한 시간 한 줄로 모인다.
 * 값 · 시각은 stack 칸(묶음 열쇠 밖)에 둔다.
 */
export function buildClsEvent({ route, value, source, time, viewport, net, release } = {}) {
  if (!(Number(value) > CLS_REPORT_THRESHOLD) || !Number.isFinite(Number(value))) return null;
  const path = sanitizeRoute(route);
  if (!path) return null;
  const band = value > CLS_POOR ? 'poor' : 'needs-improvement';
  const vp = viewport === 'phone' ? 'phone' : 'pc';
  const n = NETS.has(net) ? net : 'unknown';
  const src = SELECTOR.test(String(source || '')) ? source : 'unknown';
  const t = Math.max(0, Math.min(999999, Math.round(Number(time) || 0)));
  return {
    kind: CLS_KIND,
    message: `cls ${band} ${vp} ${n} ${src}`,
    stack: `value=${Math.min(Number(value), 9.9999).toFixed(4)} t=${t}ms`,
    route: path,
    release: typeof release === 'string' && /^[a-z0-9]{3,40}$/.test(release) ? release : null,
  };
}

const MESSAGE = /^cls (poor|needs-improvement) (phone|pc) (slow-2g|2g|3g|4g|unknown) [a-z0-9_.-]{1,80}$/;
const STACK = /^value=(\d\.\d{4}) t=(\d{1,6})ms$/;

/** 수신 경로용 — 받은 JSON을 같은 규칙으로 다시 검사한다(브라우저를 믿지 않는다). 0.1 이하 · 모양이 틀리면 null. */
export function parseClsBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (body.kind !== CLS_KIND || typeof body.message !== 'string' || typeof body.stack !== 'string') return null;
  if (!MESSAGE.test(body.message)) return null;
  const m = STACK.exec(body.stack);
  if (!m || !(Number(m[1]) > CLS_REPORT_THRESHOLD)) return null;
  const route = sanitizeRoute(typeof body.route === 'string' ? body.route : '');
  if (!route) return null;
  const band = Number(m[1]) > CLS_POOR ? 'poor' : 'needs-improvement';
  if (!body.message.startsWith(`cls ${band} `)) return null; // 등급과 값이 어긋나면 버린다
  const release = typeof body.release === 'string' && /^[a-z0-9]{3,40}$/.test(body.release) ? body.release : null;
  return { kind: CLS_KIND, message: body.message, stack: body.stack, route, release };
}

/** 한 건 보내기(브라우저). 보냈으면 true. 0.1 이하 · 모양 틀림이면 보내지 않는다. 무엇이 잘못돼도 throw하지 않는다. */
export function sendClsEvent(input, { nav = typeof navigator !== 'undefined' ? navigator : null, fetchImpl = typeof fetch === 'function' ? fetch : null } = {}) {
  try {
    const event = buildClsEvent(input);
    if (!event) return false;
    const body = JSON.stringify(event);
    if (nav && typeof nav.sendBeacon === 'function' && nav.sendBeacon(VITALS_ENDPOINT, new Blob([body], { type: 'application/json' }))) return true;
    if (fetchImpl) {
      fetchImpl(VITALS_ENDPOINT, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'content-type': 'application/json' } }).catch(() => {});
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 브라우저에 건다(한 번). 경로마다 따로 센다 — 앱 안 이동으로 경로가 바뀌면 앞 경로 몫을 끊어 보내고 새로 센다. 화면을 떠날 때(숨김 · pagehide)도 보낸다.
 * 돌려주는 함수 routeChanged(path)를 경로가 바뀔 때 부른다. 운영 빌드에서만 보낸다(개발 서버는 보내지 않는다).
 */
export function installClsReporter({ win = typeof window !== 'undefined' ? window : null, send = sendClsEvent } = {}) {
  if (!win || typeof win.PerformanceObserver !== 'function') return () => {};
  const tracker = createClsTracker();
  let route = win.location?.pathname || '/';
  const flush = () => {
    const w = tracker.worst();
    if (w.value > CLS_REPORT_THRESHOLD) {
      send({ route, value: w.value, source: w.source, time: w.time, viewport: viewportClass(win.innerWidth), net: connectionType(win.navigator), release: process.env.NEXT_PUBLIC_BUILD_SHA });
    }
    tracker.reset();
  };
  try {
    const po = new win.PerformanceObserver((list) => { for (const entry of list.getEntries()) tracker.add(entry); });
    po.observe({ type: 'layout-shift', buffered: true });
  } catch {
    return () => {};
  }
  win.addEventListener?.('visibilitychange', () => { if (win.document?.visibilityState === 'hidden') flush(); });
  win.addEventListener?.('pagehide', flush);
  return (path) => {
    if (!path || path === route) return;
    flush();
    route = path;
  };
}
