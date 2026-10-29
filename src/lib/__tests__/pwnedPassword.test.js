// PWNED-PASSWORD-001 (2026-10-26 KST) — 유출 비밀번호 확인의 k-익명성 · 열린 실패 계약.
// 실제 API는 부르지 않는다(fetch는 전부 가짜).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPasswordPwned, rangeHasSuffix, sha1Hex, PASSWORD_CHECK_ENDPOINT, PASSWORD_CHECK_TIMEOUT_MS } from '../pwnedPassword';

// SHA-1('password') = 5BAA6 | 1E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD = 'password';
const FULL = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';
const PREFIX = FULL.slice(0, 5);
const SUFFIX = FULL.slice(5);
const OTHER = '0018A45C4D1DEF81644B54AB7F969B88D65';
const rangeBody = lines => lines.join('\r\n');
const okText = text => ({ ok: true, status: 200, text: async () => text });

afterEach(() => { vi.unstubAllGlobals(); });

describe('해시와 범위 비교', () => {
  it('SHA-1을 대문자 hex 40자로 만든다(Web Crypto)', async () => {
    expect(await sha1Hex(PASSWORD)).toBe(FULL);
  });

  it('접미사가 있고 횟수가 1 이상이면 유출, 패딩 줄(횟수 0)과 다른 접미사는 유출이 아니다', () => {
    expect(rangeHasSuffix(rangeBody([`${OTHER}:3`, `${SUFFIX}:10434004`]), SUFFIX)).toBe(true);
    expect(rangeHasSuffix(rangeBody([`${OTHER}:3`, `${SUFFIX.toLowerCase()}:2`]), SUFFIX)).toBe(true);
    expect(rangeHasSuffix(rangeBody([`${OTHER}:3`, `${SUFFIX}:0`]), SUFFIX)).toBe(false);
    expect(rangeHasSuffix(rangeBody([`${OTHER}:3`]), SUFFIX)).toBe(false);
    expect(rangeHasSuffix('', SUFFIX)).toBe(false);
  });
});

describe('isPasswordPwned — 보내는 것은 앞 5자뿐', () => {
  it('우리 라우트에 { prefix } 하나만 보내고, 비밀번호 · 전체 해시 · 접미사는 요청 어디에도 없다', async () => {
    const fetchImpl = vi.fn(async () => okText(rangeBody([`${SUFFIX}:5`])));
    expect(await isPasswordPwned(PASSWORD, { fetchImpl })).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(PASSWORD_CHECK_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ prefix: PREFIX });
    expect(init.credentials).toBe('omit');
    expect(init.cache).toBe('no-store');
    // 주소는 고정 경로(위) — 나머지 실린 것(본문 · 헤더) 어디에도 비밀번호 · 해시가 없다.
    const sent = JSON.stringify({ headers: init.headers, body: init.body });
    for (const secret of [PASSWORD, FULL, SUFFIX, FULL.toLowerCase(), SUFFIX.toLowerCase()]) expect(sent).not.toContain(secret);
  });

  it('목록에 없으면 false(통과)', async () => {
    const fetchImpl = vi.fn(async () => okText(rangeBody([`${OTHER}:7`, `${SUFFIX}:0`])));
    expect(await isPasswordPwned(PASSWORD, { fetchImpl })).toBe(false);
  });
});

describe('isPasswordPwned — 확인하지 못하면 null(열린 실패, 막지 않는다)', () => {
  it('네트워크 오류 · 라우트 오류 응답은 null', async () => {
    expect(await isPasswordPwned(PASSWORD, { fetchImpl: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) })).toBeNull();
    expect(await isPasswordPwned(PASSWORD, { fetchImpl: vi.fn(async () => ({ ok: false, status: 504, text: async () => '' })) })).toBeNull();
    expect(await isPasswordPwned(PASSWORD, { fetchImpl: vi.fn(async () => ({ ok: true, text: async () => { throw new Error('body'); } })) })).toBeNull();
  });

  it('응답이 제한 시간 안에 오지 않으면 요청을 끊고 null — 기본 제한은 2.5초', async () => {
    expect(PASSWORD_CHECK_TIMEOUT_MS).toBe(2500);
    let signal;
    const fetchImpl = vi.fn((_url, init) => { signal = init.signal; return new Promise(() => {}); });
    const started = Date.now();
    expect(await isPasswordPwned(PASSWORD, { fetchImpl, timeoutMs: 40 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(signal.aborted).toBe(true);
  });

  it('crypto.subtle이 없으면 요청하지 않고 null', async () => {
    vi.stubGlobal('crypto', {});
    const fetchImpl = vi.fn();
    expect(await isPasswordPwned(PASSWORD, { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('빈 비밀번호 · fetch 없음도 null', async () => {
    expect(await isPasswordPwned('', { fetchImpl: vi.fn() })).toBeNull();
    expect(await isPasswordPwned(PASSWORD, { fetchImpl: null })).toBeNull();
  });
});
