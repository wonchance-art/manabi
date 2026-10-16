import { describe, expect, it } from 'vitest';
import { MISSING_ROUTE, ROUTES, kstStamp, routeSlug, summarize } from './ux-audit.mjs';
import { MAIN_NAV } from '../src/lib/webNavigation.js';

// /ux-review 0단계 기계 측정 — 판단 없이 후보 플래그만 낸다(.claude/commands/ux-review.md).
const row = (over = {}) => ({ viewport: 'desktop', route: '/home', finalPath: '/home', loadMs: 900, error: null, consoleErrors: [],
  overflowX: false, emptyBelowRatio: 0, spinnerVisible: false, loadingText: false, missingMainNav: [], ...over });

describe('점검 경로', () => {
  it('메인 메뉴 넷을 그대로 따라가고, 일부러 없는 경로로 404도 본다', () => {
    expect(ROUTES.slice(0, MAIN_NAV.length)).toEqual(MAIN_NAV.map(item => item.href));
    expect(ROUTES).toContain(MISSING_ROUTE);
  });
  it('파일 이름 · KST 시각', () => {
    expect(routeSlug('/')).toBe('root');
    expect(routeSlug('/conversation/new')).toBe('conversation_new');
    expect(kstStamp(new Date('2026-10-16T06:10:00Z'))).toBe('2026-10-16 15:10');
  });
});

describe('플래그', () => {
  it('정상 화면은 플래그 없음 — 로드 시간은 플래그로 쓰지 않는다(dev 컴파일 잡음)', () => {
    expect(summarize([row({ loadMs: 20000 })])).toEqual([]);
  });
  it('넘침 · 빈 화면 45% 이상 · 남은 대기 표시 · 콘솔 오류 · 메뉴 일부 누락을 잡는다', () => {
    const kinds = summarize([row({ overflowX: true, emptyBelowRatio: 0.63, spinnerVisible: true, consoleErrors: ['boom'], missingMainNav: ['대화'] })])
      .map(flag => flag.kind);
    expect(kinds).toEqual(['console-error', 'horizontal-overflow', 'empty-area', 'still-loading', 'nav-partial']);
    expect(summarize([row({ emptyBelowRatio: 0.44 })])).toEqual([]);
  });
  it('메뉴가 통째로 없는 화면(집중 읽기 등)은 누락으로 보지 않는다', () => {
    expect(summarize([row({ missingMainNav: MAIN_NAV.map(item => item.label) })])).toEqual([]);
  });
  it('404 시험 경로의 404 응답 로그는 정상으로 본다', () => {
    const missing = row({ route: MISSING_ROUTE, consoleErrors: ['Failed to load resource: the server responded with a status of 404 (Not Found)'] });
    expect(summarize([missing])).toEqual([]);
    expect(summarize([{ ...missing, consoleErrors: ['TypeError: x'] }]).map(flag => flag.kind)).toEqual(['console-error']);
  });
});
