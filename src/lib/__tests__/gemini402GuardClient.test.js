import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { friendlyToastMessage, isServiceConfigError } from '../errorMessage';

vi.mock('react', () => ({ useCallback: fn => fn, useEffect: () => {}, useState: () => [false, vi.fn()] }));

// GEMINI-402-GUARD(2026-10-17 KST) 클라 쪽 — 안내 문구 · 재시도 없음 · 서버 음성 실패 기억 · 「(뜻 없음)」 화면 언어.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const BILLING_MSG = 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.';
// 음성 사례(리뷰 차단 1) — 보통 쿼터 초과 429. 「billing」이 들어 있어도 혼잡이다.
const GEMINI_QUOTA_MSG = 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.';
const GROQ_QUOTA_MSG = 'Rate limit reached for model `openai/gpt-oss-120b`. Please try again in 7m. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing';

describe('① 안내 · 클라 재시도', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('결제 · 크레딧은 「서비스 설정」 안내 — 429 · RESOURCE_EXHAUSTED로 와도 「붐빔」이 아니다. 보통 혼잡은 그대로', () => {
    const service = '서비스 설정에 문제가 있어요. 관리자에게 문의해 주세요.';
    expect(friendlyToastMessage(Object.assign(new Error(BILLING_MSG), { status: 402 }), '분석하지 못했어요.')).toBe(service);
    expect(friendlyToastMessage(Object.assign(new Error('RESOURCE_EXHAUSTED: ' + BILLING_MSG), { status: 429 }), 'x')).toBe(service);
    expect(friendlyToastMessage(Object.assign(new Error('API 요청 실패 (HTTP 402)'), { status: 402 }), 'x')).toBe(service);
    expect(friendlyToastMessage(new Error('The model is overloaded (503)'), 'x')).toBe('AI 서비스가 잠시 붐비고 있어요. 잠시 후 다시 시도해 주세요.');
    expect(isServiceConfigError(500, 'Internal Server Error')).toBe(false);
  });

  it('음성 — 쿼터 429(Gemini · Groq 「billing」 문구)는 서비스 설정 안내가 아니다', () => {
    for (const msg of [GEMINI_QUOTA_MSG, GROQ_QUOTA_MSG]) {
      expect(isServiceConfigError(429, msg)).toBe(false);
      expect(friendlyToastMessage(Object.assign(new Error(msg), { status: 429 }), 'x')).not.toBe('서비스 설정에 문제가 있어요. 관리자에게 문의해 주세요.');
    }
  });

  it('음성 — 쿼터 429는 callGemini가 지금처럼 다시 시도한다', async () => {
    // 백오프(5초~)만 0으로 줄인다 — 다른 타이머는 그대로.
    const realSetTimeout = globalThis.setTimeout;
    vi.stubGlobal('setTimeout', (fn, ms, ...args) => realSetTimeout(fn, ms >= 5000 ? 0 : ms, ...args));
    const fetchSpy = vi.fn(async () => ({ ok: false, status: 429, text: async () => JSON.stringify({ error: { message: GEMINI_QUOTA_MSG } }) }));
    vi.stubGlobal('fetch', fetchSpy);
    vi.resetModules();
    const { callGemini } = await import('../gemini.js');
    const err = await callGemini('p', undefined, { attempts: 2 }).catch((e) => e);
    expect(err.status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('callGemini — 결제 문구 429는 한 번만 부르고 바로 던진다(용량 재시도 4회 · 5/10/20초 백오프 없음)', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: false, status: 429, text: async () => JSON.stringify({ error: { message: BILLING_MSG } }) }));
    vi.stubGlobal('fetch', fetchSpy);
    vi.resetModules();
    const { callGemini } = await import('../gemini.js');
    const err = await callGemini('p').catch((e) => e);
    expect(err.status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('③ 서버 음성 「서비스 설정」 실패 기억', () => {
  let utterances, fetchAudio, mod;
  const serviceFail = { ok: false, status: 502, json: async () => ({ error: 'tts upstream failed', code: 'service_config' }) };
  const plainFail = { ok: false, status: 502, json: async () => ({ error: 'tts upstream failed' }) };
  const drain = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  beforeEach(async () => {
    utterances = [];
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('window', {
      fetch: (...a) => fetchAudio(...a), URL: { createObjectURL: () => 'blob:x' },
      speechSynthesis: { cancel: vi.fn(), getVoices: () => [], speak: u => utterances.push(u) },
      SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
      Audio: class { pause() {} play() { return Promise.resolve(); } },
    });
    vi.resetModules();
    mod = await import('../useTTS');
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('한 번 실패하면 다음 발음은 서버를 부르지 않고 바로 브라우저 음성', async () => {
    fetchAudio = vi.fn(async () => serviceFail);
    const tts = mod.useTTS();
    tts.speak('駅', 'Japanese'); await drain();
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    expect(utterances.map(u => u.text)).toEqual(['駅']);
    expect(mod.serverTtsSkipped()).toBe(true);
    tts.speak('猫', 'Japanese'); await drain();
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    expect(utterances.map(u => u.text)).toEqual(['駅', '猫']);
    mod.prefetchSpeech('犬', 'Japanese');
    expect(fetchAudio).toHaveBeenCalledTimes(1);
  });

  it('기억은 SERVER_TTS_SKIP_MS 동안만 — 지나면 다시 서버를 부른다', async () => {
    fetchAudio = vi.fn(async () => serviceFail);
    mod.useTTS().speak('駅', 'Japanese'); await drain();
    expect(mod.SERVER_TTS_SKIP_MS).toBe(10 * 60 * 1000);
    expect(mod.serverTtsSkipped(Date.now() + mod.SERVER_TTS_SKIP_MS + 1)).toBe(false);
  });

  it('표식 없는 실패(일시 502)는 기억하지 않는다 — 지금처럼 다음에도 서버를 먼저', async () => {
    fetchAudio = vi.fn(async () => plainFail);
    const tts = mod.useTTS();
    tts.speak('駅', 'Japanese'); await drain();
    tts.speak('猫', 'Japanese'); await drain();
    expect(fetchAudio).toHaveBeenCalledTimes(2);
    expect(mod.serverTtsSkipped()).toBe(false);
  });

  it('/api/tts는 결제 실패에만 code service_config를 단다(상태 502 · 문구 그대로)', () => {
    const route = sliceBetween(read('src/app/api/tts/route.js'), 'if (!res.ok) {', '}\n');
    expect(route).toContain("return Response.json({ error: 'tts upstream failed', ...(isServiceConfigError(res.status, errBody) ? { code: 'service_config' } : {}) }, { status: 502 });");
  });
});

describe('「(뜻 없음)」은 화면 언어를 따른다', () => {
  it('카드 뜻 자리가 vt를 거치고, 3개 언어 문구가 있다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("refMeaning || selectedToken.meaning || vt('(뜻 없음)')}");
    expect(viewer).not.toContain("selectedToken.meaning || '(뜻 없음)'");
    expect(read('src/lib/viewerMessages.js')).toMatch(/\['\(뜻 없음\)','（无释义）','（無釋義）'\]/);
  });
});
