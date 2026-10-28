import fs from 'node:fs';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { earlyVocabularyUrl, hasAuthCookie, takeEarlyVocabulary, VOCAB_EARLY_KEY, VOCAB_EARLY_MAX_AGE_MS, VOCAB_EARLY_SCRIPT } from '../vocabularyEarly.js';
import { fetchVocabularyLearningRows } from '../vocabularyLearningRows.js';

const FULL = '/api/learning/vocabulary?view=learning', SUMMARY = `${FULL}&fields=summary`;
const actorId = 'learner';
const snapshot = () => ({ version: 1, actorId, enabled: true, registryAvailable: true, complete: true, now: '2026-10-03T12:00:00.000Z',
  rows: [{ id: 'word', user_id: actorId, language: 'Korean', word_text: '단어', interval: 0, ease_factor: null, repetitions: 0,
    base_form: null, created_at: null, source_material_id: null,
    next_review_at: '2026-10-03T15:00:00.000Z', last_reviewed_at: null, meaning: 'unchanged', source_sentence: 'original' }],
  registry: [{ cardId: 'word', userId: actorId, enrolled: false, card: null, known: false, excluded: false,
    eligible: true, nextQuestionAt: null, firstQuestionAt: null }] });
const ok = body => ({ ok: true, status: 200, json: async () => body });
afterEach(() => { delete globalThis[VOCAB_EARLY_KEY]; });

const PATHS = ['/japanese/vocab/n5', '/chinese/vocab/h1/', '/english/words/a1', '/french/words/a1', '/viewer/45', '/vocab', '/vocab/',
  '/home', '/home/', '/', '/materials', '/review', '/japanese/vocab', '/japanese/grammar/n5', '/viewer/45/x', '/vocabulary', '/homework'];

describe('VOCAB-EARLY-001 — 단어장 학습 읽기를 문서 머리에서 일찍 시작', () => {
  it('첫 화면이 바로 읽는 경로만 — 단어 레벨 · 뷰어 · 단어장은 전체, 홈은 요약, 그 밖은 보내지 않는다', () => {
    expect(PATHS.map(earlyVocabularyUrl)).toEqual([FULL, FULL, FULL, FULL, FULL, FULL, FULL,
      SUMMARY, SUMMARY, null, null, null, null, null, null, null, null]);
    expect(hasAuthCookie('theme=dark; sb-jdtowtxhexcweuxawrds-auth-token=base64-x')).toBe(true);
    expect(hasAuthCookie('sb-jdtowtxhexcweuxawrds-auth-token.0=base64-x; a=b')).toBe(true);
    expect(hasAuthCookie('theme=dark')).toBe(false);
    expect(hasAuthCookie('x-sb-ref-auth-token-old=1')).toBe(false);
  });

  it('머리 스크립트(손으로 옮긴 ES5)는 경로 · 쿠키마다 위 판정과 똑같이 보낸다 — 손님은 보내지 않는다', () => {
    for (const path of PATHS) for (const cookie of ['sb-ref-auth-token=base64-x', 'sb-ref-auth-token.0=x', 'theme=dark', '']) {
      const fetch = vi.fn(() => Promise.resolve({ ok: true }));
      const window = { fetch };
      vm.runInNewContext(VOCAB_EARLY_SCRIPT, { window, fetch, location: { pathname: path }, document: { cookie }, Date });
      const want = hasAuthCookie(cookie) ? earlyVocabularyUrl(path) : null;
      expect(window[VOCAB_EARLY_KEY]?.url ?? null, `${path} · ${cookie}`).toBe(want);
      expect(fetch.mock.calls, `${path} · ${cookie}`).toEqual(want ? [[want, { method: 'GET', credentials: 'same-origin', cache: 'no-store' }]] : []);
    }
  });

  it('뿌리 레이아웃 머리 스크립트 맨 앞에 붙는다 — localStorage가 막혀 뒤가 멈춰도 먼저 보낸다', () => {
    const layout = fs.readFileSync('src/app/layout.jsx', 'utf8');
    expect(layout).toContain('__html: `(function(){${VOCAB_EARLY_SCRIPT}${INSTALL_CAPTURE_SCRIPT}');
    expect(VOCAB_EARLY_SCRIPT.startsWith('try{') && VOCAB_EARLY_SCRIPT.endsWith('}catch(e){}')).toBe(true);
  });

  it('같은 주소 · 15초 안의 성공 응답만 한 번 넘기고 지운다 — 다른 주소 · 오래됨 · 실패 · 거절은 null', async () => {
    const target = {}, res = ok({});
    target[VOCAB_EARLY_KEY] = { url: FULL, at: 1000, res: Promise.resolve(res) };
    expect(await takeEarlyVocabulary(FULL, { now: 1000 + VOCAB_EARLY_MAX_AGE_MS, target })).toBe(res);
    expect(target[VOCAB_EARLY_KEY]).toBeUndefined();
    expect(takeEarlyVocabulary(FULL, { now: 2000, target })).toBeNull();
    for (const early of [{ url: SUMMARY, at: 1000, res: Promise.resolve(res) }, { url: FULL, at: 1000 - 1, res: Promise.resolve(res) }]) {
      target[VOCAB_EARLY_KEY] = early;
      expect(takeEarlyVocabulary(FULL, { now: 1000 + VOCAB_EARLY_MAX_AGE_MS, target })).toBeNull();
      expect(target[VOCAB_EARLY_KEY]).toBeUndefined();
    }
    target[VOCAB_EARLY_KEY] = { url: FULL, at: 1000, res: Promise.resolve({ ok: false, status: 401 }) };
    expect(await takeEarlyVocabulary(FULL, { now: 1000, target })).toBeNull();
    target[VOCAB_EARLY_KEY] = { url: FULL, at: 1000, res: Promise.reject(new TypeError('fetch failed')) };
    expect(await takeEarlyVocabulary(FULL, { now: 1000, target })).toBeNull();
  });

  it('fetchVocabularyLearningRows는 일찍 받은 응답을 새로 보내지 않고 쓰며(검증은 그대로), 실패면 지금처럼 보낸다', async () => {
    globalThis[VOCAB_EARLY_KEY] = { url: FULL, at: Date.now(), res: Promise.resolve(ok(snapshot())) };
    const fetchImpl = vi.fn();
    const loaded = await fetchVocabularyLearningRows(actorId, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loaded.rows[0].id).toBe('word');
    // 두 번째 읽기는 새로 보낸다(한 번만 넘김).
    fetchImpl.mockResolvedValue(ok(snapshot()));
    await fetchVocabularyLearningRows(actorId, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // 일찍 받은 것이 실패면 새로 보낸다.
    globalThis[VOCAB_EARLY_KEY] = { url: FULL, at: Date.now(), res: Promise.resolve({ ok: false, status: 503, json: async () => ({}) }) };
    await fetchVocabularyLearningRows(actorId, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // 다른 계정의 본문은 일찍 받았어도 지금처럼 거절한다.
    globalThis[VOCAB_EARLY_KEY] = { url: FULL, at: Date.now(), res: Promise.resolve(ok({ ...snapshot(), actorId: 'other' })) };
    await expect(fetchVocabularyLearningRows(actorId, { fetchImpl })).rejects.toThrow('owner_mismatch');
  });
});
