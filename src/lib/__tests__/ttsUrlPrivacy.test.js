import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  TTS_TEXT_HEADER, TTS_TEXT_HEADER_MAX, TTS_TEXT_MAX, TTS_VOICES,
  decodeTtsText, encodeTtsText, normalizeTtsText, sha256Hex, ttsHash, ttsRequest,
} from '../ttsRequest';

// TTS-URL-001(2026-11-06 KST) — 서버 음성 요청이 문장을 주소(?text=)에 실어 접속 기록 · CDN 캐시 키에 남겼다.
// 지금: 주소 = 문장 해시(h) + lang, 문장 = x-tts-text 헤더. 같은 문장 → 같은 주소(캐시 적중 유지),
// 해시가 안 맞으면 서버가 거절(캐시에 다른 문장의 소리가 들어가지 않음), Vary에 문장 헤더 없음(캐시가 갈리지 않음).

const ROOT = join(process.cwd(), 'src');
const node256 = (s) => createHash('sha256').update(s).digest('hex');

describe('해시 · 인코딩 — 클라와 서버가 같이 쓰는 순수 함수', () => {
  it('sha256Hex = node:crypto(블록 경계 · 다국어 · 무작위)', () => {
    const samples = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(65), 'a'.repeat(1000),
      'Japanese|Kore|駅まで歩いて五分です。', 'Chinese|Kore|我们一起去图书馆吧', 'French|Aoede|Ça va très bien, merci !', '😀👍🏽 é'];
    for (const s of samples) expect(sha256Hex(s), JSON.stringify(s)).toBe(node256(s));
    for (let i = 0; i < 200; i++) {
      const bytes = randomBytes(i * 3);
      expect(sha256Hex(new Uint8Array(bytes))).toBe(node256(bytes));
    }
  });

  it('base64url 왕복 — 정규형 · 올바른 UTF-8만 풀린다', () => {
    for (const s of ['駅', 'Ça va', '😀 漢字 かな', 'a'.repeat(160)]) expect(decodeTtsText(encodeTtsText(s))).toBe(s);
    expect(encodeTtsText('駅')).toMatch(/^[A-Za-z0-9_-]+$/);
    const bad = Buffer.from([0xff, 0xfe, 0x41]).toString('base64url');
    for (const value of [bad, 'a+b/', 'QQ==', 'Q', '駅', null, undefined, 42]) expect(decodeTtsText(value), String(value)).toBeNull();
    expect(decodeTtsText('QR')).toBeNull(); // 'A'는 'QQ' — 끝 비트가 다른 비정규형은 받지 않는다
  });

  it('정규화 — NFC · 공백 · 160자, 자른 끝의 짝 잃은 서로게이트는 뗀다', () => {
    expect(normalizeTtsText('  駅  ')).toBe('駅');
    expect(normalizeTtsText('が')).toBe('が');
    expect(normalizeTtsText('あ'.repeat(200))).toHaveLength(TTS_TEXT_MAX);
    const astral = 'a'.repeat(159) + '😀';
    expect(normalizeTtsText(astral)).toBe('a'.repeat(159));
    // 최장 헤더(160자 × 3바이트)가 상한 안에 든다
    expect(encodeTtsText('駅'.repeat(TTS_TEXT_MAX)).length).toBeLessThanOrEqual(TTS_TEXT_HEADER_MAX);
  });
});

describe('요청 모양 — 같은 문장은 같은 주소, 주소에 문장 없음', () => {
  it('같은 문장(공백 · 정규화 차이 포함) → 같은 주소, 다른 문장 · 언어 → 다른 주소', () => {
    const a = ttsRequest('駅まで歩きます', 'Japanese');
    expect(ttsRequest('駅まで歩きます', 'Japanese')).toEqual(a);
    expect(ttsRequest('  駅まで歩きます ', 'Japanese').url).toBe(a.url);
    expect(ttsRequest('駅まで歩きました', 'Japanese').url).not.toBe(a.url);
    expect(ttsRequest('駅まで歩きます', 'Chinese').url).not.toBe(a.url);
    expect(a.url).toBe(`/api/tts?h=${node256('Japanese|Kore|駅まで歩きます')}&lang=Japanese`);
    expect(a.headers).toEqual({ [TTS_TEXT_HEADER]: Buffer.from('駅まで歩きます').toString('base64url') });
    expect(ttsRequest('   ', 'Japanese')).toBeNull();
  });

  it('주소에는 문장도 그 인코딩도 없다', () => {
    const text = 'Bonjour à tous';
    const { url, headers } = ttsRequest(text, 'French');
    expect(url).not.toMatch(/[?&]text=/);
    for (const piece of [text, encodeURIComponent(text), headers[TTS_TEXT_HEADER], 'Bonjour']) expect(url).not.toContain(piece);
  });

  it('어떤 클라 코드도 /api/tts 주소에 text= 를 만들지 않는다(주소는 ttsRequest 한 곳)', () => {
    const files = [];
    const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'content') walk(p); } else if (/\.(jsx?|mjs|tsx?)$/.test(name)) files.push(p); } };
    walk(ROOT);
    const users = files.filter((f) => readFileSync(f, 'utf8').includes('/api/tts')).map((f) => relative(ROOT, f).replaceAll('\\', '/')).sort();
    expect(users).toEqual(['app/api/tts/route.js', 'lib/ttsRequest.js', 'lib/useTTS.js']);
    for (const f of users) expect(readFileSync(join(ROOT, f), 'utf8'), f).not.toMatch(/api\/tts\?[^'"`\n]*text=|[?&]text=\$\{/);
    const client = readFileSync(join(ROOT, 'lib/useTTS.js'), 'utf8');
    expect(client).toContain("import { ttsRequest } from './ttsRequest';");
    expect(client.match(/window\.fetch\(/g)).toHaveLength(2);
    expect(client.match(/window\.fetch\(url, \{ headers: (request|tts)\.headers \}\)/g)).toHaveLength(2);
  });
});

describe('useTTS — 미리 받기가 해시 주소 + 헤더로 부른다', () => {
  let fetchAudio;
  beforeEach(() => {
    fetchAudio = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['wav']) }));
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('window', {
      fetch: (...a) => fetchAudio(...a), URL: { createObjectURL: () => 'blob:x' },
      Audio: class { pause() {} play() { return Promise.resolve(); } },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('같은 문장은 한 번만, 주소 = ttsRequest', async () => {
    vi.resetModules();
    const mod = await import('../useTTS');
    mod.prefetchSpeech('猫', 'Japanese');
    mod.prefetchSpeech('猫', 'Japanese');
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    const { url, headers } = ttsRequest('猫', 'Japanese');
    expect(fetchAudio).toHaveBeenCalledWith(url, { headers });
  });
});

describe('/api/tts — 해시와 문장을 묶어 받는다', () => {
  let upstream, GET;
  const call = (search, headers = {}) => GET(new Request(`http://localhost/api/tts?${search}`, { headers }));
  const valid = (text, lang = 'Japanese') => { const r = ttsRequest(text, lang); return [r.url.split('?')[1], r.headers]; };
  beforeEach(async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    upstream = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: Buffer.from([1, 2, 3, 4]).toString('base64') } }] } }] }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    vi.resetModules();
    ({ GET } = await import('../../app/api/tts/route.js'));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('맞는 해시 + 헤더 → 소리, 캐시 헤더 그대로, Vary에 문장 헤더 없음, 제공자엔 그 문장', async () => {
    const res = await call(...valid('駅まで歩きます'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/wav');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, s-maxage=31536000, immutable');
    expect(String(res.headers.get('vary') || '').toLowerCase()).not.toContain(TTS_TEXT_HEADER);
    const body = JSON.parse(upstream.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toMatch(/: 駅まで歩きます$/);
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(TTS_VOICES.Japanese);
  });

  it('해시가 다른 문장 · 다른 언어의 것이면 400 — 제공자를 부르지 않는다(캐시에 다른 소리가 들어가지 않음)', async () => {
    const [search] = valid('駅まで歩きます');
    const [, otherHeaders] = valid('駅まで走ります');
    expect((await call(search, otherHeaders)).status).toBe(400);
    expect((await call(search.replace('lang=Japanese', 'lang=Chinese'), valid('駅まで歩きます')[1])).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('주소에 문장(?text=) · 해시 없음 · 헤더 없음 · 정규화 안 됨 · 상한 초과 → 400', async () => {
    const [search, headers] = valid('駅');
    const long = 'あ'.repeat(TTS_TEXT_MAX + 1);
    const cases = [
      ['text=駅&lang=Japanese', {}],
      [`${search}&text=駅`, headers],
      ['lang=Japanese', headers],
      [search.replace(/h=[0-9a-f]+/, 'h=XYZ'), headers],
      [search, {}],
      [`h=${ttsHash('Japanese', ' 駅')}&lang=Japanese`, { [TTS_TEXT_HEADER]: encodeTtsText(' 駅') }],
      [`h=${ttsHash('Japanese', long)}&lang=Japanese`, { [TTS_TEXT_HEADER]: encodeTtsText(long) }],
      [search, { [TTS_TEXT_HEADER]: 'A'.repeat(TTS_TEXT_HEADER_MAX + 4) }],
    ];
    for (const [s, h] of cases) expect((await call(s, h)).status, s).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('상한 길이(160자 · 3바이트 글자)는 받는다', async () => {
    expect((await call(...valid('駅'.repeat(TTS_TEXT_MAX)))).status).toBe(200);
  });

  it('지원하지 않는 언어는 그대로 거절', async () => {
    const text = 'hi';
    expect((await call(`h=${ttsHash('Klingon', text)}&lang=Klingon`, { [TTS_TEXT_HEADER]: encodeTtsText(text) })).status).toBe(400);
  });
});
