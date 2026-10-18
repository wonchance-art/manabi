import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { hasWaitingBoundary, whenDocumentParsed } from '../documentParsed';
import { sliceBetween } from './helpers/sliceBetween';

// HYDRATION-AUTH-001 — 로그인 복원(AuthProvider 값 변경)은 스트리밍 HTML이 다 온 뒤에. 그 전에 바꾸면 아직 서버 HTML을 기다리는
// Suspense 경계가 클라이언트에서 새로 그려져 같은 섹션이 잠시 두 개가 된다(smoke 「N4 자동사」 .fr-check 2개, CI 간헐).
const read = file => fs.readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');
function fakeDocument(readyState) {
  const listeners = new Set();
  return { readyState, listeners,
    addEventListener: (type, fn) => { if (type === 'DOMContentLoaded') listeners.add(fn); },
    removeEventListener: (type, fn) => { if (type === 'DOMContentLoaded') listeners.delete(fn); },
    finish() { this.readyState = 'interactive'; for (const fn of [...listeners]) { listeners.delete(fn); fn(); } } };
}

describe('whenDocumentParsed', () => {
  it('문서가 아직 흘러오는 중이면 DOMContentLoaded까지 기다린다', () => {
    const doc = fakeDocument('loading'), fn = vi.fn();
    whenDocumentParsed(fn, doc);
    expect(fn).not.toHaveBeenCalled();
    doc.finish();
    expect(fn).toHaveBeenCalledOnce();
  });
  it('이미 파싱이 끝났으면 같은 틱에 부른다(기존 동기 흐름 유지)', () => {
    for (const state of ['interactive', 'complete']) {
      const fn = vi.fn();
      whenDocumentParsed(fn, fakeDocument(state));
      expect(fn).toHaveBeenCalledOnce();
    }
    const fn = vi.fn();
    whenDocumentParsed(fn, null);
    expect(fn).toHaveBeenCalledOnce();
  });
  it('취소하면 부르지 않는다(언마운트)', () => {
    const doc = fakeDocument('loading'), fn = vi.fn();
    const stop = whenDocumentParsed(fn, doc);
    stop();
    doc.finish();
    expect(fn).not.toHaveBeenCalled();
    expect(doc.listeners.size).toBe(0);
  });
});

describe('AuthProvider 첫 상태 변경 배선', () => {
  it('게스트 확정 · 세션 복원 모두 whenDocumentParsed 뒤에 값을 바꾼다', () => {
    const effect = sliceBetween(read('src/lib/AuthContext.jsx'), 'const hasSessionCookie =', '// 마운트 1회 세션 복원.');
    const guest = sliceBetween(effect, 'if (!hasSessionCookie) {', 'getSupabase()');
    expect(guest).toContain('whenDocumentParsed(() => { if (!cancelled) setLoading(false); })');
    expect(guest.replace(/whenDocumentParsed\(\(\) => \{ if \(!cancelled\) setLoading\(false\); \}\)/, '')).not.toContain('setLoading(');
    const session = sliceBetween(effect, 'getSupabase()', '.catch(');
    const gate = session.indexOf('whenDocumentParsed(() => resolve(client))');
    expect(gate).toBeGreaterThan(-1);
    expect(session.indexOf('client.auth.getSession()')).toBeGreaterThan(gate);
    expect(session.indexOf('attachAuthListener(client')).toBeGreaterThan(gate);
    expect(effect).toContain('stopWaiting();');
  });
});

// HYDRATION-UPDATE-001 — React 19.2는 도착한 조각을 경계에 붙이는 일을 묶어서 늦게 한다($RC가 표시를 「$~」로 바꾸고 $RV가 300ms 뒤
// 「$」로). 파싱이 끝난 뒤에도 「$~」 · 「$?」가 남았으면 다 붙을 때까지 기다린다 — 그 사이 Provider 값을 바꾸면 React가 서버 HTML을
// 버리고 새로 그렸다(교재 .book-reader 둘 · 내용 늦게 보임, 390 실측 2026-10-17 KST). 전환 갱신도 같은 경로라 기다리기가 맞다.
function streamDocument(readyState, marks) {
  const doc = fakeDocument(readyState);
  doc.comments = marks.map(data => ({ data }));
  doc.body = {};
  doc.createTreeWalker = () => { let i = -1; return { nextNode: () => doc.comments[++i] || null }; };
  return doc;
}
function fakeObservers() {
  const made = [];
  class FakeObserver { constructor(cb) { this.cb = cb; this.on = false; made.push(this); } observe() { this.on = true; } disconnect() { this.on = false; } fire() { this.cb([]); } }
  return { made, FakeObserver };
}

describe('기다리는 경계까지 — 「$?」 · 「$~」', () => {
  it('hasWaitingBoundary는 「$?」 · 「$~」만 기다림으로 본다(「$」 · 「$!」 · 「/$」는 아니다)', () => {
    expect(hasWaitingBoundary(streamDocument('complete', ['$', '/$', '$!']))).toBe(false);
    expect(hasWaitingBoundary(streamDocument('complete', ['$', '$~']))).toBe(true);
    expect(hasWaitingBoundary(streamDocument('complete', ['$?']))).toBe(true);
    expect(hasWaitingBoundary(fakeDocument('complete'))).toBe(false); // 걷기 API가 없으면 기다리지 않는다
  });
  it('파싱이 끝났어도 붙일 차례를 기다리는 경계가 있으면 붙은 뒤(「$」)에 부른다 — 한 번만', () => {
    const { made, FakeObserver } = fakeObservers();
    vi.stubGlobal('MutationObserver', FakeObserver);
    try {
      const doc = streamDocument('loading', ['$', '$~']), fn = vi.fn();
      whenDocumentParsed(fn, doc);
      doc.finish();
      expect(fn).not.toHaveBeenCalled();
      expect(made).toHaveLength(1);
      made[0].fire(); // 아직 「$~」
      expect(fn).not.toHaveBeenCalled();
      doc.comments[1].data = '$'; made[0].fire();
      expect(fn).toHaveBeenCalledOnce();
      expect(made[0].on).toBe(false);
      made[0].fire();
      expect(fn).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
  it('3초가 지나도 남아 있으면 그만 기다린다 · 취소하면 부르지 않는다', () => {
    vi.useFakeTimers();
    const { made, FakeObserver } = fakeObservers();
    vi.stubGlobal('MutationObserver', FakeObserver);
    try {
      const fn = vi.fn();
      whenDocumentParsed(fn, streamDocument('complete', ['$?']));
      vi.advanceTimersByTime(2999); expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1); expect(fn).toHaveBeenCalledOnce();
      const cancelled = vi.fn(), stop = whenDocumentParsed(cancelled, streamDocument('complete', ['$~']));
      stop(); vi.advanceTimersByTime(5000); made.at(-1).fire();
      expect(cancelled).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('MutationObserver가 없으면 기다리지 않는다(예전 동작)', () => {
    vi.stubGlobal('MutationObserver', undefined);
    try {
      const fn = vi.fn();
      whenDocumentParsed(fn, streamDocument('complete', ['$~']));
      expect(fn).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
});
