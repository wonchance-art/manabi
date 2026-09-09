/**
 * 팀 암호 해시 — 브라우저·서버 공용(Web Crypto, v2-AB R1/R2).
 *
 * 오너가 허브에서 암호를 정하면 **브라우저에서** PBKDF2-SHA256으로 해시해 루트 자료의
 * metadata.team.pwHash/pwSalt에 넣는다 — 평문은 저장·전송·로그 어디에도 남지 않는다(계약).
 * 학생 해제 라우트(서버)는 같은 함수로 후보를 해시해 `timingSafeEqual`로 비교한다.
 * Node 22의 globalThis.crypto.subtle이 브라우저와 같은 결과를 내는 것을 계약 테스트가
 * Node `pbkdf2Sync`와 대조해 고정한다.
 */

export const PBKDF2_ITERATIONS = 100_000;
export const PW_HASH_ALGO = 'pbkdf2-sha256';
const SALT_BYTES = 16;
const HASH_BITS = 256;

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export function hexToBytes(hex) {
  const clean = String(hex || '');
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) throw new Error('잘못된 hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** 새 솔트(hex 32자). */
export function makeSalt(cryptoImpl = globalThis.crypto) {
  const bytes = new Uint8Array(SALT_BYTES);
  cryptoImpl.getRandomValues(bytes);
  return toHex(bytes);
}

/** 암호 → hex 64자. 같은 (암호, 솔트)는 어디서 돌려도 같은 값. */
export async function hashPassword(password, saltHex, cryptoImpl = globalThis.crypto) {
  const subtle = cryptoImpl?.subtle;
  if (!subtle) throw new Error('이 환경에서는 암호를 처리할 수 없어요.');
  const key = await subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    HASH_BITS,
  );
  return toHex(new Uint8Array(bits));
}

/** 암호 규칙(설계 §0: 최소 6자). 공백만은 안 된다. */
export function validatePassword(password, min = 6) {
  const pw = String(password ?? '');
  if (pw.trim().length < min) return `암호는 ${min}자 이상이어야 해요.`;
  return null;
}
