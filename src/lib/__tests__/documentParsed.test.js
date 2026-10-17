import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { whenDocumentParsed } from '../documentParsed';
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
