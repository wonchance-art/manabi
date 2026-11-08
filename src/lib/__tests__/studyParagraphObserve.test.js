import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_SIGNALS, FIELDS, parseClientErrorBody } from '../errorEvent';
import { CLIENT_ERROR_ENDPOINT } from '../reportError';
import { fallbackReasonFromError, fallbackReasonFromResponse, PARAGRAPH_FALLBACK_KIND, reportParagraphFallback } from '../studyParagraphFallback';
import { sliceBetween } from './helpers/sliceBetween';
import { noteParagraphError, PARAGRAPH_ERROR_KIND, PARAGRAPH_ERROR_REASON, PARAGRAPH_ERROR_ROUTE } from '../server/studyParagraphObserve';

// STUDY-PARA-OBSERVE-001 — /study 오늘의 문단이 실패해 기본 세션으로 이어 갈 때(분모가 바뀌는 자리) 그 사유가 운영 기록에 남는다.
// 계약: ⑴ 브라우저 사유 분류 ⑵ 수신은 정해진 사유 코드만(자유 글 · 스택 · 오류 ID 버림) ⑶ 보내는 칸에 계정 · 재료가 없다
// ⑷ 서버 실패 경로 기록(응답 뒤 · 정해진 코드만) ⑸ 화면 쪽 폴백 호출마다 사유가 붙는다(화면 동작은 그대로).
const ROOT = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const REASONS = ['status_500', 'status_502', 'status_429', 'status_401', 'no_paragraph', 'too_few_items', 'timeout', 'network', 'map_error'];

describe('⑴ 브라우저 사유 분류', () => {
  it('fetch가 throw — 20초 시간 초과는 timeout, 나머지는 network', () => {
    expect(fallbackReasonFromError(new DOMException('signal timed out', 'TimeoutError'))).toBe('timeout');
    expect(fallbackReasonFromError(new DOMException('aborted', 'AbortError'))).toBe('timeout');
    expect(fallbackReasonFromError(new TypeError('Failed to fetch'))).toBe('network');
    expect(fallbackReasonFromError(undefined)).toBe('network');
  });
  it('응답 — 실패 상태는 status_NNN, 200인데 문단 없음은 no_paragraph, 문단이 있으면 null', () => {
    expect(fallbackReasonFromResponse({ ok: false, status: 502 }, {})).toBe('status_502');
    expect(fallbackReasonFromResponse({ ok: false, status: 500 }, { error: { message: '서버에 AI 키가…' } })).toBe('status_500');
    expect(fallbackReasonFromResponse({ ok: false, status: 0 }, {})).toBe('network');
    expect(fallbackReasonFromResponse({ ok: true, status: 200 }, {})).toBe('no_paragraph');
    expect(fallbackReasonFromResponse({ ok: true, status: 200 }, { paragraph: { sentences: [] } })).toBeNull();
  });
  it('분류 결과는 모두 수신이 받는 코드다', () => {
    for (const reason of REASONS) expect(CLIENT_SIGNALS[PARAGRAPH_FALLBACK_KIND].test(reason), reason).toBe(true);
  });
});

describe('⑵ 수신(/api/client-error) — 정해진 사유 코드만', () => {
  it.each(REASONS)('%s → 종류 · 사유 · 경로 · 배포 판만 남는다', (reason) => {
    const event = parseClientErrorBody({ kind: PARAGRAPH_FALLBACK_KIND, message: reason, route: '/study?source=mine', release: 'abc1234',
      stack: 'at secret (/x.js:1:2)', digest: '2483459876', userId: 'u-1' });
    expect(event).toEqual({ kind: PARAGRAPH_FALLBACK_KIND, message: reason, stack: null, digest: null, route: '/study', release: 'abc1234' });
  });
  it('자유 글 · 모양이 다른 코드 · 다른 study.* 종류는 받지 않는다', () => {
    for (const message of ['timeout because 食べる', 'status_5000', 'status_600', 'TIMEOUT', 'network ', 'u@x.com']) {
      expect(parseClientErrorBody({ kind: PARAGRAPH_FALLBACK_KIND, message }), message).toBeNull();
    }
    expect(parseClientErrorBody({ kind: 'study.paragraph_error', message: 'no_llm_key' })).toBeNull(); // 서버 종류는 브라우저가 못 쓴다
    expect(parseClientErrorBody({ kind: 'study.other', message: 'timeout' })).toBeNull();
    expect(parseClientErrorBody({ kind: 'constructor', message: 'timeout' })).toBeNull();
  });
  it('기존 종류(boundary.* · window.*)는 그대로', () => {
    expect(parseClientErrorBody({ kind: 'window.error', message: 'boom' })).toMatchObject({ kind: 'window.error', message: 'boom' });
    expect(parseClientErrorBody({ kind: 'server.render', message: 'spoof' })).toBeNull();
  });
});

describe('⑶ 보내기(reportParagraphFallback)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('sendBeacon 한 건 — FIELDS뿐, 메시지는 사유 코드, 경로는 쿼리 없음', async () => {
    vi.stubGlobal('window', { location: { pathname: '/study', href: 'https://manabi.app/study?source=mine' }, addEventListener() {} });
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    expect(reportParagraphFallback('status_502', { force: true })).toBe(true);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe(CLIENT_ERROR_ENDPOINT);
    const body = JSON.parse(await blob.text());
    expect(Object.keys(body).sort()).toEqual([...FIELDS].sort());
    expect(body).toMatchObject({ kind: PARAGRAPH_FALLBACK_KIND, message: 'status_502', stack: null, digest: null, route: '/study' });
    expect(parseClientErrorBody(body)).toMatchObject({ kind: PARAGRAPH_FALLBACK_KIND, message: 'status_502' }); // 수신이 받는 모양
  });
  it('정해진 코드가 아니면 보내지 않는다', () => {
    vi.stubGlobal('window', { location: { pathname: '/study' }, addEventListener() {} });
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    for (const reason of [undefined, '', 'boom', 'timeout extra']) expect(reportParagraphFallback(reason, { force: true })).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
  });
  it('개발 서버(운영 빌드 아님)에서는 보내지 않는다', () => {
    vi.stubGlobal('window', { location: { pathname: '/study' }, addEventListener() {} });
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    expect(reportParagraphFallback('timeout')).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
  });
});

describe('⑷ 서버 기록(noteParagraphError)', () => {
  it('응답 뒤(after)에 server · study.paragraph_error · 사유 코드 · 라우트 · 배포 판 한 줄', async () => {
    const record = vi.fn(async () => 'recorded');
    let scheduled;
    expect(noteParagraphError('unusable_output:live', { env: { NEXT_PUBLIC_BUILD_SHA: 'abc1234' }, record, schedule: (fn) => { scheduled = fn; } })).toBe('scheduled');
    expect(record).not.toHaveBeenCalled(); // 응답을 기다리게 하지 않는다
    await scheduled();
    expect(record).toHaveBeenCalledWith({ source: 'server', kind: PARAGRAPH_ERROR_KIND, message: 'unusable_output:live', stack: null, digest: null,
      route: PARAGRAPH_ERROR_ROUTE, release: 'abc1234' });
  });
  it('요청 밖(after가 throw)이면 바로 쓴다 · 기록이 실패해도 throw 없음', async () => {
    const record = vi.fn(() => Promise.reject(new Error('db down')));
    expect(noteParagraphError('no_llm_key', { env: {}, record, schedule: () => { throw new Error('outside request scope'); } })).toBe('direct');
    expect(record).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 0));
  });
  it('정해진 코드만 — 오류 원문 · 계정 ID는 들어갈 자리가 없다', () => {
    const record = vi.fn();
    for (const reason of ['exception:live', 'exception:prefetch', 'unusable_output:prefetch', 'assemble_error:prefetch', 'no_llm_key']) {
      expect(PARAGRAPH_ERROR_REASON.test(reason), reason).toBe(true);
    }
    for (const reason of [undefined, 'exception', 'exception:live u-1', 'TypeError: x', 'assemble_error:live']) {
      expect(noteParagraphError(reason, { record, schedule: (fn) => fn() }), reason).toBeNull();
    }
    expect(record).not.toHaveBeenCalled();
  });
});

describe('⑸ 화면 — 폴백 호출마다 사유가 붙는다(동작은 그대로)', () => {
  const src = read('src/views/StudySessionPage.jsx');
  it('applyFallback(…) 호출은 모두 사유를 넘기고, applyFallback은 기록 한 줄 뒤 기존 폴백을 그대로 한다', () => {
    const calls = [...src.matchAll(/applyFallback\(([^)]*)\)/g)].map((m) => m[1]).filter((arg) => arg !== 'reason');
    expect(calls.length).toBe(4); // fetch 실패 · 응답 실패 · 문항 부족 · 변환 실패
    for (const arg of calls) expect(arg.trim(), 'reason argument').not.toBe('');
    const body = sliceBetween(src, 'function applyFallback(reason) {', "setGenStatus('fallback');");
    expect(body).toMatch(/^function applyFallback\(reason\) \{\s*reportParagraphFallback\(reason\);/);
    expect(body).toContain('setQueue(prev => [...prev, ...fb, ...encounterItems]);');
  });
  it('문단 생성 요청 · 20초 시간 초과 · 채점 문항 3개 기준은 그대로', () => {
    expect(src).toContain("signal: AbortSignal.timeout(20000)");
    expect(src).toContain('if (mapped.gradedCount >= 3) {');
    expect(src).toContain("applyFallback('too_few_items');");
    expect(src).toContain("applyFallback('map_error');");
  });
});
