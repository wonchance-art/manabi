import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
vi.mock('react', () => ({ useCallback: (fn) => fn, useEffect: () => {}, useState: () => [false, vi.fn()] }));

// TTS-GAP-001(2026-10-17 KST) — 소리를 끝내 내지 못하는 세 빈틈.
//  ① 서버 음성이 막혔고 이 기기에 그 언어의 브라우저 음성이 없으면 무음 · 무안내였다 → 'no-voice' 알림(기존 같은 상황 문구)
//  ② 브라우저 음성 우선 경로에서 서버 재시도까지 실패하면 조용히 끝났다 → 'failed' 알림(문구는 오너 확정 전)
//  ③ iOS: 서버 응답 뒤의 브라우저 음성은 탭 밖이라 막힐 수 있다 → 서버가 쉬는 중이면 탭 안에서 바로, iOS는 탭 안에서 엔진을 한 번 열어 둔다

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const ja = { lang: 'ja-JP', localService: true, voiceURI: 'local-ja' };
const ko = { lang: 'ko-KR', localService: true, voiceURI: 'local-ko' };
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const fail502 = { ok: false, status: 502, json: async () => ({ error: 'tts upstream failed' }) };
const service502 = { ok: false, status: 502, json: async () => ({ error: 'tts upstream failed', code: 'service_config' }) };
const audioOk = { ok: true, blob: async () => new Blob(['wav']) };
const drain = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

let voices, utterances, fetchAudio, mod, notices, synth;
function stubWindow({ speech = true, ua = '' } = {}) {
  synth = { cancel: vi.fn(), resume: vi.fn(), getVoices: () => voices, speak: (u) => utterances.push(u) };
  vi.stubGlobal('window', {
    fetch: (...a) => fetchAudio(...a), URL: { createObjectURL: () => 'blob:x' },
    ...(speech ? { speechSynthesis: synth, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } } } : {}),
    Audio: class { pause() {} play() { return Promise.resolve(); } },
    navigator: { userAgent: ua, platform: ua ? 'iPhone' : 'Linux x86_64', maxTouchPoints: ua ? 5 : 0 },
  });
}
async function load(opts) {
  stubWindow(opts);
  vi.resetModules();
  mod = await import('../useTTS');
  notices = [];
  mod.onSpeechUnavailable((reason) => notices.push(reason));
}

beforeEach(async () => {
  voices = [ja]; utterances = [];
  fetchAudio = vi.fn(async () => fail502);
  vi.stubGlobal('localStorage', { getItem: () => null });
  await load();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('① 낼 수 있는 음성이 없으면 이유를 알린다', () => {
  it('서버 실패 + 한국어 브라우저 음성 없음 → 발화 0 · no-voice 1회', async () => {
    mod.useTTS().speak('안녕하세요', 'Korean');
    await drain();
    expect(utterances).toHaveLength(0);
    expect(notices).toEqual(['no-voice']);
  });

  it('서버 실패 + Web Speech 자체가 없음 → no-voice', async () => {
    await load({ speech: false });
    mod.useTTS().speak('駅', 'Japanese');
    await drain();
    expect(notices).toEqual(['no-voice']);
  });

  it('음성이 있으면 알리지 않는다 — 서버 실패 뒤 브라우저 음성이 난다(현행)', async () => {
    voices = [ja, ko];
    mod.useTTS().speak('안녕하세요', 'Korean');
    await drain();
    expect(utterances.map((u) => u.text)).toEqual(['안녕하세요']);
    expect(notices).toEqual([]);
  });

  it('서버가 성공하면 알림 0 · 브라우저 음성 0', async () => {
    fetchAudio = vi.fn(async () => audioOk);
    mod.useTTS().speak('안녕하세요', 'Korean');
    await drain();
    expect([utterances.length, notices.length]).toEqual([0, 0]);
  });
});

describe('② 둘 다 실패하면 조용히 끝내지 않는다', () => {
  it('브라우저 음성 우선 경로 — 발화 오류 → 서버 재시도 → 서버도 실패 → failed', async () => {
    mod.useTTS().speak('猫', 'Japanese', { preferBrowser: true });
    expect(utterances).toHaveLength(1);
    utterances[0].onerror({ error: 'synthesis-failed' });
    await drain();
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    expect(notices).toEqual(['failed']);
  });

  it('서버 우선 경로 — 서버 실패 → 대체 발화도 오류 → failed', async () => {
    mod.useTTS().speak('駅', 'Japanese');
    await drain();
    expect(utterances).toHaveLength(1);
    utterances[0].onerror({ error: 'synthesis-failed' });
    expect(notices).toEqual(['failed']);
  });

  it('취소 · 끼어듦 · 지난 탭의 실패는 알리지 않는다', async () => {
    const tts = mod.useTTS();
    tts.speak('駅', 'Japanese');
    await drain();
    utterances[0].onerror({ error: 'interrupted' });
    utterances[0].onerror({ error: 'canceled' });
    tts.speak('猫', 'Japanese'); // 새 탭 — 앞 발화의 늦은 오류는 지난 일
    utterances[0].onerror({ error: 'synthesis-failed' });
    expect(notices).toEqual([]);
    // 브라우저 우선 경로의 서버 재시도가 늦게 실패해도, 그 사이 새 탭이 있었으면 알리지 않는다
    let release;
    fetchAudio = vi.fn(() => new Promise((r) => { release = () => r(fail502); }));
    tts.speak('一', 'Japanese', { preferBrowser: true });
    utterances.at(-1).onerror({ error: 'synthesis-failed' });
    fetchAudio = vi.fn(async () => audioOk);
    tts.speak('二', 'Japanese');
    release();
    await drain();
    expect(notices).toEqual([]);
  });

  it('같은 이유는 SPEECH_NOTICE_GAP_MS 안에 한 번만 — 지나면 다시', async () => {
    expect(mod.notifySpeechUnavailable('no-voice', 1_000)).toBe(true);
    expect(mod.notifySpeechUnavailable('no-voice', 1_000 + mod.SPEECH_NOTICE_GAP_MS - 1)).toBe(false);
    expect(mod.notifySpeechUnavailable('failed', 1_500)).toBe(true); // 다른 이유는 따로
    expect(mod.notifySpeechUnavailable('no-voice', 1_000 + mod.SPEECH_NOTICE_GAP_MS)).toBe(true);
    expect(notices).toEqual(['no-voice', 'failed', 'no-voice']);
  });
});

describe('③ 탭 안에서 음성 엔진을 쓴다(iOS 사용자 동작 규칙)', () => {
  it('서버가 「서비스 설정」으로 쉬는 중이면 기다리지 않고 speak() 호출 안에서(동기) 브라우저 음성', async () => {
    fetchAudio = vi.fn(async () => service502);
    const tts = mod.useTTS();
    tts.speak('駅', 'Japanese');
    await drain(); // 첫 실패로 서버를 쉬게 한다
    expect(mod.serverTtsSkipped()).toBe(true);
    tts.speak('猫', 'Japanese');
    expect(utterances.map((u) => u.text)).toEqual(['駅', '猫']); // drain 없이 — 탭 처리 안에서 이미 발화
    expect(fetchAudio).toHaveBeenCalledTimes(1);
  });

  it('쉬는 중 + 낼 음성도 없으면 그 자리에서(동기) no-voice', async () => {
    fetchAudio = vi.fn(async () => service502);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const tts = mod.useTTS();
      tts.speak('안녕', 'Korean');
      await drain();
      expect(notices).toEqual(['no-voice']);
      vi.setSystemTime(Date.now() + mod.SPEECH_NOTICE_GAP_MS);
      tts.speak('하세요', 'Korean');
      expect(notices).toEqual(['no-voice', 'no-voice']); // drain 없이
      expect(fetchAudio).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('iOS — 서버 경로 탭 안에서 소리 없는 빈 발화로 엔진을 연다(resume 포함), 페이지당 한 번', async () => {
    await load({ ua: IOS_UA });
    fetchAudio = vi.fn(async () => audioOk);
    const tts = mod.useTTS();
    tts.speak('駅', 'Japanese');
    expect(utterances).toHaveLength(1); // 동기 — fetch 전에
    expect(utterances[0]).toMatchObject({ text: '', volume: 0 });
    expect(synth.resume).toHaveBeenCalledTimes(1);
    await drain();
    tts.speak('猫', 'Japanese');
    await drain();
    expect(utterances).toHaveLength(1);
  });

  it('iOS 판정 — iPhone · iPad(데스크톱 UA의 iPadOS 포함)만, 그 밖은 서버 경로에서 브라우저 음성을 건드리지 않는다', async () => {
    expect(mod.needsSpeechGesturePrime({ navigator: { userAgent: IOS_UA } })).toBe(true);
    expect(mod.needsSpeechGesturePrime({ navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 } })).toBe(true);
    expect(mod.needsSpeechGesturePrime({ navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 } })).toBe(false);
    expect(mod.needsSpeechGesturePrime({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 15)' } })).toBe(false);
    expect(mod.needsSpeechGesturePrime(null)).toBe(false);
    fetchAudio = vi.fn(async () => audioOk);
    mod.useTTS().speak('駅', 'Japanese');
    await drain();
    expect(utterances).toHaveLength(0);
  });
});

describe('안내 배선 · 문구', () => {
  it('providers가 토스트 안에 안내를 단다 — no-voice만 기존 같은 상황 문구, failed는 문구 확정 전이라 표에 없다', async () => {
    const providers = read('src/app/providers.jsx');
    expect(providers).toMatch(/<ToastProvider>\s*<SpeechUnavailableNotice \/>/);
    const notice = read('src/components/SpeechUnavailableNotice.jsx');
    expect(notice).toContain("export const SPEECH_NOTICES = Object.freeze({ 'no-voice': SPEECH_UNAVAILABLE_MESSAGE });");
    expect(notice).toContain("if (message) toast(message, 'warning');");
    const { SPEECH_UNAVAILABLE_MESSAGE } = await import('../errorMessage.js');
    expect(SPEECH_UNAVAILABLE_MESSAGE).toBe('이 기기에서는 소리를 낼 수 없어요.');
    // 새 문구가 아니다 — 레벨 화면의 같은 상황 문구 그대로(마침표만 토스트 문장으로)
    expect(read('src/views/LevelListPage.jsx')).toContain('이 기기에서는 소리를 낼 수 없어요<');
  });
});
