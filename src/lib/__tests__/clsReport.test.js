import { describe, expect, it, vi } from 'vitest';
import { CLS_REPORT_THRESHOLD, VITALS_ENDPOINT, buildClsEvent, connectionType, createClsTracker, installClsReporter, parseClsBody, selectorOf, sendClsEvent, viewportClass } from '../clsReport';

// RUM-CLS-001 — 실사용자 화면 밀림 기록(오케스트레이터 조건 2026-11-08 KST): 0.1 이하는 전송 0 · 칸은 경로 틀 · 값 · 출처 선택자 · 시각 ·
// 화면 폭 구간 · 연결 유형뿐(계정 · IP 원문 · 쿼리 없음) · 계산은 CLS 정의(세션 창 1초/5초 · 입력 직후 제외).
const node = (tag, cls) => ({ tagName: tag.toUpperCase(), className: cls });
const shift = (t, v, n = node('footer', 'site-footer'), extra = {}) => ({ startTime: t, value: v, hadRecentInput: false, sources: [{ node: n, previousRect: { width: 390, height: 100 }, currentRect: { width: 390, height: 100 } }], ...extra });

describe('CLS 계산 — 세션 창', () => {
  it('이동 사이 1초 넘게 벌어지면 새 창 · 가장 큰 창이 CLS · 입력 직후 이동은 뺀다', () => {
    const t = createClsTracker();
    t.add(shift(1000, 0.05)); t.add(shift(1500, 0.05)); // 창 1 = 0.10
    t.add(shift(3000, 0.116)); t.add(shift(3300, 0.086)); // 창 2 = 0.202
    t.add(shift(3400, 0.5, undefined, { hadRecentInput: true })); // 입력 직후 — 빼기
    expect(t.value()).toBeCloseTo(0.202, 6);
    expect(t.worst()).toEqual({ value: t.value(), source: 'footer.site-footer', time: 3000 });
  });
  it('창은 5초를 넘지 않는다', () => {
    const t = createClsTracker();
    for (let i = 0; i < 12; i++) t.add(shift(i * 900, 0.02)); // 0 · 0.9 · … · 9.9초 — 5초에서 끊긴다
    expect(t.value()).toBeCloseTo(0.12, 6); // 0–4.5초 6개
  });
  it('출처는 이동이 난 그때 읽는다 — 보낼 때 요소가 문서에서 빠져도 그대로(실제 빌드: 경로 이동 뒤 unknown이던 것)', () => {
    const t = createClsTracker();
    const n = node('div', 'manabi-page learn-page');
    const e = shift(3000, 0.33, n);
    t.add(e);
    e.sources[0].node = null; // 이동 뒤 요소가 사라짐
    expect(t.worst().source).toBe('div.manabi-page.learn-page');
  });
  it('출처는 가장 큰 이동의 가장 넓은 요소 — 태그 · 클래스 두 개만(id · 글 없음)', () => {
    expect(selectorOf({ tagName: 'DIV', className: 'learn-tile learn-resume lang-ja', id: 'secret', textContent: '글' })).toBe('div.learn-tile.learn-resume');
    expect(selectorOf({ tagName: 'svg', className: { baseVal: 'x' } })).toBe('svg');
    expect(selectorOf(null)).toBe('unknown');
  });
});

describe('보내기 — 0.1 이하는 전송 0', () => {
  const base = { route: '/viewer/12345?token=abc#x', value: 0.2017, source: 'footer.site-footer', time: 5899.4, viewport: 'phone', net: '4g', release: 'abc1234' };
  it(`문턱 ${CLS_REPORT_THRESHOLD}: 0.1 · 0.05 · 0은 기록을 만들지 않고 보내지 않는다`, () => {
    const nav = { sendBeacon: vi.fn(() => true) }; const fetchImpl = vi.fn();
    for (const value of [0, 0.05, 0.1]) {
      expect(buildClsEvent({ ...base, value })).toBeNull();
      expect(sendClsEvent({ ...base, value }, { nav, fetchImpl })).toBe(false);
    }
    expect(nav.sendBeacon).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('0.1 초과: 칸은 종류 · 묶음 열쇠(등급 · 폭 · 연결 · 출처) · 값/시각 · 경로 틀 · 판뿐 — 쿼리 · ID · 계정 없음', () => {
    const e = buildClsEvent(base);
    expect(e).toEqual({ kind: 'vitals.cls', message: 'cls needs-improvement phone 4g footer.site-footer', stack: 'value=0.2017 t=5899ms', route: '/viewer/:id', release: 'abc1234' });
    expect(buildClsEvent({ ...base, value: 0.3, viewport: 'pc', net: 'wifi' }).message).toBe('cls poor pc unknown footer.site-footer');
    const nav = { sendBeacon: vi.fn(() => true) };
    expect(sendClsEvent(base, { nav })).toBe(true);
    expect(nav.sendBeacon).toHaveBeenCalledWith(VITALS_ENDPOINT, expect.any(Blob));
  });
  it('화면 폭 768 이하 = phone · 연결은 정해진 낱말만', () => {
    expect(viewportClass(390)).toBe('phone'); expect(viewportClass(768)).toBe('phone'); expect(viewportClass(1280)).toBe('pc');
    expect(connectionType({ connection: { effectiveType: '3g' } })).toBe('3g');
    expect(connectionType({})).toBe('unknown');
  });
  it('설치: 경로가 바뀌면 앞 경로 몫을 끊어 보낸다 — 0.1 이하 경로는 보내지 않는다', () => {
    let cb; const listeners = {};
    class PO { constructor(fn) { cb = fn; } observe() {} }
    const win = { PerformanceObserver: PO, location: { pathname: '/home' }, innerWidth: 390, navigator: {}, document: { visibilityState: 'visible' }, addEventListener: (k, f) => { listeners[k] = f; } };
    const send = vi.fn();
    const routeChanged = installClsReporter({ win, send });
    cb({ getEntries: () => [shift(5899, 0.116), shift(6206, 0.086)] });
    routeChanged('/discover');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ route: '/home', source: 'footer.site-footer', time: 5899, viewport: 'phone', net: 'unknown' });
    cb({ getEntries: () => [shift(9000, 0.03)] }); // 새 경로 — 0.03
    listeners.pagehide();
    expect(send).toHaveBeenCalledTimes(1); // 0.1 이하 — 보내지 않음
  });
});

describe('수신 검사 — 브라우저를 믿지 않는다', () => {
  const ok = { kind: 'vitals.cls', message: 'cls needs-improvement phone 4g footer.site-footer', stack: 'value=0.2017 t=5899ms', route: '/home?utm=x', release: 'abc1234' };
  it('맞는 모양만 · 경로의 쿼리는 버린다', () => {
    expect(parseClsBody(ok)).toEqual({ ...ok, route: '/home' });
  });
  it('0.1 이하 · 등급과 값 어긋남 · 다른 종류 · 출처에 이상한 글자 · 빠진 칸은 null', () => {
    expect(parseClsBody({ ...ok, stack: 'value=0.1000 t=1ms', message: 'cls needs-improvement phone 4g x' })).toBeNull();
    expect(parseClsBody({ ...ok, stack: 'value=0.3000 t=1ms' })).toBeNull(); // needs-improvement라 했지만 0.30(poor)
    expect(parseClsBody({ ...ok, message: 'cls poor phone 4g footer.site-footer', stack: 'value=0.3000 t=1ms' })).toMatchObject({ message: 'cls poor phone 4g footer.site-footer' });
    expect(parseClsBody({ ...ok, kind: 'window.error' })).toBeNull();
    expect(parseClsBody({ ...ok, message: 'cls needs-improvement phone 4g <script>' })).toBeNull();
    expect(parseClsBody({ ...ok, route: undefined })).toBeNull();
    expect(parseClsBody([ok])).toBeNull();
  });
});
