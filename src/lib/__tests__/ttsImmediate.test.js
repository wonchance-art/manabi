import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('react', () => ({ useCallback: fn => fn, useEffect: () => {}, useState: () => [false, vi.fn()] }));
import { immediateSpeechVoice, useTTS } from '../useTTS';

const ja = { lang: 'ja-JP', localService: true, voiceURI: 'local-ja' };
const en = { lang: 'en-US', localService: true, voiceURI: 'local-en' };
let voices, utterances, fetchAudio, played;
beforeEach(() => {
  voices = [en, ja]; utterances = []; played = [];
  fetchAudio = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['fixture']) }));
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('window', {
    fetch: fetchAudio, URL: { createObjectURL: () => 'blob:fixture' },
    speechSynthesis: { cancel: vi.fn(), getVoices: () => voices, speak: u => utterances.push(u) },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    Audio: class { pause() {} play() { played.push(this); return Promise.resolve(); } },
  });
  useTTS().stop();
});
afterEach(() => { useTTS().stop(); vi.unstubAllGlobals(); });
const drain = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('immediate word pronunciation', () => {
  it('speaks in the click call without any server request, preserving language/rate', () => {
    useTTS().speak('猫', 'Japanese', { preferBrowser: true, rate: 0.72, playbackRate: 0.8 });
    expect(fetchAudio).not.toHaveBeenCalled();
    expect(utterances).toHaveLength(1);
    expect(utterances[0]).toMatchObject({ text: '猫', lang: 'ja-JP', voice: ja, rate: 0.72 });
  });
  it('prefers a matching local voice, but preserves a valid explicit voice preference', () => {
    const remote = { lang: 'ja-JP', voiceURI: 'chosen-ja', localService: false };
    expect(immediateSpeechVoice([en, remote, ja], 'Japanese')).toBe(ja);
    expect(immediateSpeechVoice([en, remote, ja], 'Japanese', remote.voiceURI)).toBe(remote);
    expect(immediateSpeechVoice([en], 'Japanese', en.voiceURI)).toBeUndefined();
  });
  it('keeps the server path for long-form callers and when matching voices are absent', async () => {
    const tts = useTTS();
    tts.speak('long-server-fixture', 'Japanese');
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    expect(utterances).toHaveLength(0);
    await drain(); expect(played).toHaveLength(1);
    voices = [en];
    tts.speak('no-ja-fixture', 'Japanese', { preferBrowser: true });
    expect(fetchAudio).toHaveBeenCalledTimes(2);
    expect(utterances).toHaveLength(0);
  });
  it('a current native error uses the server, but cancellation/old errors cannot replay a word', async () => {
    const tts = useTTS();
    tts.speak('old-fixture', 'Japanese', { preferBrowser: true });
    const old = utterances[0];
    tts.speak('current-fixture', 'Japanese', { preferBrowser: true });
    old.onerror({ error: 'synthesis-failed' });
    utterances[1].onerror({ error: 'interrupted' });
    expect(fetchAudio).not.toHaveBeenCalled();
    utterances[1].onerror({ error: 'synthesis-failed' });
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    tts.stop(); await drain();
    expect(played).toHaveLength(0);
  });
  it('late server failure after a new immediate word cannot fall back to the previous word', async () => {
    let reject;
    fetchAudio.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }));
    const tts = useTTS();
    tts.speak('late-server-fixture', 'Japanese');
    tts.speak('new-fixture', 'Japanese', { preferBrowser: true });
    reject(new Error('slow-server')); await drain();
    expect(utterances.map(u => u.text)).toEqual(['new-fixture']);
  });
});
