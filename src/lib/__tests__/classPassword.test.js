import { describe, expect, it } from 'vitest';
import { pbkdf2Sync } from 'node:crypto';
import { PBKDF2_ITERATIONS, hashPassword, makeSalt, validatePassword, hexToBytes } from '../classPassword.js';

/**
 * 계약: 팀 암호(v2-AB R1/R2 — #1077 5603827169 §7 「암호는 평문 저장·전송·로그 0 — 해시만」).
 * 브라우저(Web Crypto)와 서버(Node)가 **같은 해시**를 내야 해제 라우트가 성립한다.
 */
describe('팀 암호 해시', () => {
  const salt = '0123456789abcdef0123456789abcdef';

  it('Web Crypto PBKDF2가 Node pbkdf2Sync와 같은 값을 낸다 — 기기·서버 어디서든 같은 해시', async () => {
    const hash = await hashPassword('수업암호123', salt);
    const node = pbkdf2Sync('수업암호123', Buffer.from(salt, 'hex'), PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
    expect(hash).toBe(node);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('반복 횟수는 10만 — 낮추면 무차별 대입이 싸진다', () => {
    expect(PBKDF2_ITERATIONS).toBe(100_000);
  });

  it('솔트가 다르면 같은 암호도 다른 해시 · 암호가 다르면 다른 해시', async () => {
    const a = await hashPassword('secret1', salt);
    const b = await hashPassword('secret1', 'ffffffffffffffffffffffffffffffff');
    const c = await hashPassword('secret2', salt);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('솔트는 16바이트 hex 32자, 매번 다르다', () => {
    const s1 = makeSalt();
    const s2 = makeSalt();
    expect(s1).toMatch(/^[0-9a-f]{32}$/);
    expect(s1).not.toBe(s2);
    expect(hexToBytes(s1)).toHaveLength(16);
    expect(() => hexToBytes('zz')).toThrow();
  });

  it('암호 규칙 — 6자 미만·공백만은 거절', () => {
    expect(validatePassword('12345')).toMatch(/6자/);
    expect(validatePassword('      ')).toMatch(/6자/);
    expect(validatePassword('123456')).toBeNull();
  });
});
