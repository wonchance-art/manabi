/**
 * 서버 음성(/api/tts) 요청 모양 — 클라(useTTS)와 서버(api/tts/route)가 같이 쓰는 한 곳(TTS-URL-001, 2026-11-06 KST).
 *
 * 왜: 예전 요청은 문장을 주소의 text 쿼리 값으로 실어, 학습자가 들은 문장이 접속 기록 · CDN 캐시 키에 남았다.
 * 지금은 주소에 문장 대신 그 해시만 싣는다.
 *   GET /api/tts?h=<sha256(lang|voice|문장)>&lang=<언어>   +   요청 헤더 x-tts-text: <문장의 UTF-8 base64url>
 *  - CDN 캐시 키는 주소(메서드 · URL · 호스트 · 배포)다 — 같은 문장은 같은 주소라 지금처럼 캐시에 맞는다.
 *    응답에 `Vary: x-tts-text`를 달지 않는다(달면 헤더 값마다 캐시가 갈린다). 근거: Vercel 문서 「Cache keys」
 *    https://vercel.com/docs/caching/cdn-cache/purge#cache-keys · 「Vary header」 https://vercel.com/docs/caching/cdn-cache#vary-header
 *  - 캐시에 없으면 서버가 헤더의 문장으로 해시를 다시 계산해 주소의 h와 다르면 400으로 거절한다. 그래서 주소 h에 저장된 소리는
 *    언제나 h를 만든 그 문장의 소리다 — 캐시 적중이 다른 문장의 소리를 돌려줄 수 없다.
 *  - 음성(voice)을 해시에 넣는다 — 언어의 음성을 바꾸면 주소가 바뀌어 옛 음성의 캐시가 섞이지 않는다.
 * 해시는 동기 순수 SHA-256이다 — 단어 탭의 동기 경로(받아 둔 소리 확인 · iOS 탭 안 발화)를 바꾸지 않고, http 개발 주소처럼
 * crypto.subtle이 없는 곳에서도 같게 돈다. 서버 · 클라가 같은 함수를 쓰고, 계약 테스트가 node:crypto와 대조한다.
 */

// 언어별 프리셋 음성(Gemini prebuilt voices) — 서버가 고르고, 클라는 해시에 넣는다.
export const TTS_VOICES = Object.freeze({
  Korean: 'Kore',
  Japanese: 'Kore',   // 또렷하고 차분한 톤 — 일본어 학습 예문에 적합
  English: 'Puck',    // 경쾌하고 명료한 톤
  French: 'Aoede',    // 부드러운 톤 — 프랑스어 억양과 잘 어울림
  Chinese: 'Kore',    // 중국어 자료실 개통(#965) — 성조가 또렷한 차분한 톤
});

export const TTS_TEXT_MAX = 160; // 정규화 뒤 UTF-16 길이(예전 서버의 slice(0, 160)과 같다)
export const TTS_TEXT_HEADER = 'x-tts-text';
// 160자 × UTF-8 최대 3바이트(서로게이트 쌍 2자 = 4바이트) = 480바이트 → base64url 640자. 그보다 긴 헤더는 풀어 보지도 않는다.
export const TTS_TEXT_HEADER_MAX = TTS_TEXT_MAX * 4; // 480바이트 × 4/3 = 640

/** 서버로 보낼 문장 — NFC · 앞뒤 공백 제거 · 160자. 자른 끝에 짝 잃은 서로게이트가 남으면 뗀다. */
export function normalizeTtsText(text) {
  let value = String(text ?? '').normalize('NFC').trim().slice(0, TTS_TEXT_MAX);
  if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1);
  return value;
}

const utf8 = (s) => new TextEncoder().encode(s);

export function encodeTtsText(text) {
  let binary = '';
  for (const byte of utf8(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → 문장. 정규형(다시 인코딩하면 같은 값)이고 올바른 UTF-8일 때만, 아니면 null. */
export function decodeTtsText(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) return null;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return encodeTtsText(text) === value ? text : null;
  } catch { return null; }
}

// ── SHA-256(FIPS 180-4) — 동기 · 순수 ──
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

export function sha256Hex(input) {
  const bytes = typeof input === 'string' ? utf8(input) : input;
  const length = bytes.length;
  const padded = Math.ceil((length + 9) / 64) * 64;
  const buffer = new Uint8Array(padded);
  buffer.set(bytes);
  buffer[length] = 0x80;
  const view = new DataView(buffer.buffer);
  view.setUint32(padded - 8, Math.floor(length / 0x20000000));
  view.setUint32(padded - 4, (length * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let offset = 0; offset < padded; offset += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, (word) => word.toString(16).padStart(8, '0')).join('');
}

/** 주소의 h — 언어 · 음성 · 정규화한 문장을 묶는다. */
export const ttsHash = (language, text) => sha256Hex(`${language}|${TTS_VOICES[language] || ''}|${text}`);

/** 서버 음성 요청 — 주소(캐시 키)와 문장을 실은 헤더. 문장이 비면 null. */
export function ttsRequest(text, language) {
  const value = normalizeTtsText(text);
  if (!value) return null;
  return {
    url: `/api/tts?h=${ttsHash(language, value)}&lang=${encodeURIComponent(language)}`,
    headers: { [TTS_TEXT_HEADER]: encodeTtsText(value) },
  };
}
