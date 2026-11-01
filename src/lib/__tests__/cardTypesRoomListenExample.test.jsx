// CARD-TYPES-001 — 복습실 듣기 카드 = 예문(오너 승인 2026-11-01 KST). 단어 페이지에서 붙인 듣기 카드는 저장한 원문 문장이 없어 단어만 읽었다.
// 계약:
//   ① 읽을 글의 차례 — 원문 문장(source_sentence) > 그 단어의 레벨 예문 > 단어. 원문이 있으면 레벨 예문을 찾지도 않는다(읽기에서 담은 단어는 그대로).
//   ② 찾기 — 새 묶음 없이 단어 페이지가 받는 정적 응답 그대로(일본어 색인 → 레벨 묶음 · 중국어 급수 표 → 레벨 묶음 · 영어/프랑스어 A1). 못 찾거나 실패하면 단어.
//   ③ 지연 — 찾기 · 답 면 부품 · level-word.css는 동적 import 한 곳(listenExample)으로만. 복습실 첫 화면(VocabPage · FsrsReviewSession)에 정적 import 0.
//   ④ 답 면 — 레벨 예문으로 읽은 카드는 소리 단추 아래에 단어 페이지와 같은 Example(후리가나 · 해석). 문제 면에는 글자가 없다.
//   ⑤ 자동 1회 — 문제 면 단추와 같은 글(listenText)을, 찾는 동안은 기다렸다가 시도마다 한 번.
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FsrsReviewSession, { FsrsQuestionFace } from '@/components/vocab/FsrsReviewSession';
import RoomLevelExample, { ROOM_EXAMPLE_LANG } from '@/components/vocab/RoomLevelExample';
import { listenExampleKey, listenText, loadListenExample, resetListenExampleCache, useListenExample } from '@/components/vocab/listenExample';
import { JA_LEVEL_INDEX_URL, levelExampleOf, resetLevelExampleLookup } from '../levelExampleLookup';
import { levelWordsUrl } from '../levelWordsPayload';
import { jlptWordLang } from '@/views/JlptWordPage';
import { HSK_WORD_LANG } from '@/views/LevelWordPage';
import { ENGLISH_WORD_LANG, FRENCH_WORD_LANG } from '@/views/LatinWordPage';

vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor' }, loading: false }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
vi.mock('@/components/learning/VocabularyContexts', () => ({ default: () => null }));

const EX = { text: '夕方 友達と 約束が あります。', reading: 'ゆうがた ともだちと やくそくが あります', ko: '저녁에 친구와 약속이 있어요.',
  furi: '0,2,ゆうがた;3,2,ともだち;7,2,やくそく', seg: '2.,1-,2.,1-,1-,2.,1-,1-,4=ある,1-' };
const LEVEL_WORD = { id: 'w1', word_text: '約束', furigana: 'やくそく', meaning: '약속', language: 'Japanese', source_sentence: null };
const READER_WORD = { ...LEVEL_WORD, source_sentence: '明日は友達と約束がある。' };
const speak = vi.fn();
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const payload = (entries) => json({ version: 1, groups: [{ name: 'g', entries }] });

afterEach(() => { resetListenExampleCache(); resetLevelExampleLookup(); vi.restoreAllMocks(); });

describe('① 읽을 글의 차례 — 원문 문장 > 레벨 예문 > 단어', () => {
  it('listenText', () => {
    expect(listenText(READER_WORD, EX)).toBe(READER_WORD.source_sentence);
    expect(listenText(LEVEL_WORD, EX)).toBe(EX.text);
    expect(listenText(LEVEL_WORD, null)).toBe('約束');
    expect(listenText(LEVEL_WORD, { text: '' })).toBe('約束');
  });
  it('원문 문장이 있으면 찾지 않는다(열쇠 없음 · 받기 0)', async () => {
    expect(listenExampleKey(READER_WORD)).toBeNull();
    expect(listenExampleKey(LEVEL_WORD)).toBe('Japanese\u0000約束');
    const load = vi.fn();
    expect(await loadListenExample(READER_WORD, { load })).toEqual({ ex: null, View: null });
    expect(load).not.toHaveBeenCalled();
  });
});

describe('② 찾기 — 단어 페이지의 정적 응답 그대로', () => {
  it('일본어: 색인(JLPT 판 indexUrl) → 그 레벨 묶음(단어 페이지와 같은 주소) → 열쇠가 같은 항목의 ex · 묶음은 한 번만 받는다', async () => {
    expect(JA_LEVEL_INDEX_URL).toBe(jlptWordLang('N5').indexUrl);
    const fetchImpl = vi.fn(async (url) => {
      if (url === JA_LEVEL_INDEX_URL) return json({ version: 1, rows: [['約束', 'やくそく', '약속', 3], ['天気', 'てんき', '날씨', 5]] });
      if (url === levelWordsUrl('japanese', 'N3')) return payload([{ word: '約束', reading: 'やくそく', meaning: '약속', ex: EX }, { key: '準備', word: '準備〜', meaning: '준비', ex: { text: '準備します。' } }]);
      if (url === levelWordsUrl('japanese', 'N5')) return payload([{ word: '天気', reading: 'てんき', meaning: '날씨', ex: null }]);
      return json({}, 404);
    });
    expect(await levelExampleOf(LEVEL_WORD, { fetchImpl })).toEqual(EX);
    expect(await levelExampleOf({ ...LEVEL_WORD, word_text: '天気' }, { fetchImpl })).toBeNull(); // 예문 없는 항목
    expect(await levelExampleOf({ ...LEVEL_WORD, word_text: '無い' }, { fetchImpl })).toBeNull(); // 색인에 없는 단어
    expect(fetchImpl.mock.calls.map(([u]) => u)).toEqual([JA_LEVEL_INDEX_URL, levelWordsUrl('japanese', 'N3'), levelWordsUrl('japanese', 'N5')]);
  });
  it('compact 항목(열쇠가 표제어와 다른 줄 key)도 열쇠로 찾는다', async () => {
    const fetchImpl = vi.fn(async (url) => (url === JA_LEVEL_INDEX_URL ? json({ version: 1, rows: [['準備', 'じゅんび', '준비', 4]] })
      : payload([{ key: '準備', word: '準備〜', meaning: '준비', ex: { text: '準備します。', ko: '준비해요.' } }])));
    expect(await levelExampleOf({ ...LEVEL_WORD, word_text: '準備' }, { fetchImpl })).toEqual({ text: '準備します。', ko: '준비해요.' });
  });
  it('중국어: 급수 표 정본(zhHskLevel) → H 레벨 묶음 · 영어/프랑스어: A1 묶음 · 모르는 언어는 받지 않는다', async () => {
    const zh = { text: '我是学生。', reading: 'Wǒ shì xuésheng.', ko: '나는 학생이다.' };
    const zhFetch = vi.fn(async (url) => (url === levelWordsUrl('chinese', 'H1') ? payload([{ word: '我', reading: 'wǒ', meaning: '나', ex: zh }]) : json({}, 404)));
    expect(await levelExampleOf({ word_text: '我', language: 'Chinese' }, { fetchImpl: zhFetch })).toEqual(zh);
    expect(zhFetch).toHaveBeenCalledTimes(1);
    const en = { text: 'I keep my promise.', ko: '나는 약속을 지킨다.' };
    const enFetch = vi.fn(async (url) => (url === levelWordsUrl('english', 'A1') ? payload([{ word: 'promise', meaning: '약속', ex: en }]) : json({}, 404)));
    expect(await levelExampleOf({ word_text: 'promise', language: 'English' }, { fetchImpl: enFetch })).toEqual(en);
    const none = vi.fn();
    expect(await levelExampleOf({ word_text: '사과', language: 'Korean' }, { fetchImpl: none })).toBeNull();
    expect(none).not.toHaveBeenCalled();
  });
  it('받기 실패 · 시간 초과 → 단어로 읽는다(결과를 남기지 않아 다음에 다시 찾는다)', async () => {
    const fail = { levelExampleOf: vi.fn(async () => { throw new Error('offline'); }), default: RoomLevelExample };
    expect(await loadListenExample(LEVEL_WORD, { load: async () => fail })).toEqual({ ex: null, View: null });
    const slow = { levelExampleOf: () => new Promise(() => {}), default: RoomLevelExample };
    expect(await loadListenExample(LEVEL_WORD, { load: async () => slow, waitMs: 5 })).toEqual({ ex: null, View: null });
    const ok = { levelExampleOf: vi.fn(async () => EX), default: RoomLevelExample };
    expect(await loadListenExample(LEVEL_WORD, { load: async () => ok })).toEqual({ ex: EX, View: RoomLevelExample });
    expect(await loadListenExample(LEVEL_WORD, { load: async () => fail })).toEqual({ ex: EX, View: RoomLevelExample }); // 찾은 결과는 남는다
  });
});

describe('③ 지연 — 첫 화면 JS 밖', () => {
  const src = (f) => fs.readFileSync(f, 'utf8');
  it('찾기 · 답 면 부품 · level-word.css는 listenExample의 동적 import 한 곳으로만', () => {
    const session = src('src/components/vocab/FsrsReviewSession.jsx');
    const listen = src('src/components/vocab/listenExample.js');
    const page = src('src/views/VocabPage.jsx');
    for (const file of [session, listen, page, src('src/components/vocab/ReviewCardParts.jsx')]) {
      expect(file).not.toMatch(/^import [^;]*(RoomLevelExample|levelExampleLookup|levels\/word\/WordCard|level-word\.css|levelListData)/m);
    }
    expect(session).toContain("import { listenText, useListenExample } from './listenExample';");
    expect(listen).toContain("const loadRoomLevelExample = () => import('./RoomLevelExample');");
    expect(listen.match(/^import .*$/gm)).toEqual(["import { useEffect, useState } from 'react';"]);
    expect(src('src/components/vocab/RoomLevelExample.jsx')).toContain("import '@/components/levels/word/level-word.css';");
  });
  it('듣기 카드가 아니거나 원문 문장이 있으면 찾지 않는다 · 찾는 동안 pending · 찾은 뒤엔 첫 그림부터', async () => {
    const Probe = ({ word, active }) => JSON.stringify(useListenExample(word, active));
    const probe = (word, active) => JSON.parse(renderToStaticMarkup(<Probe word={word} active={active} />).replace(/&quot;/g, '"'));
    expect(probe(LEVEL_WORD, false)).toEqual({ pending: false, ex: null, View: null });
    expect(probe(READER_WORD, true)).toEqual({ pending: false, ex: null, View: null });
    expect(probe(LEVEL_WORD, true)).toEqual({ pending: true, ex: null, View: null });
    await loadListenExample(LEVEL_WORD, { load: async () => ({ levelExampleOf: async () => EX, default: RoomLevelExample }) });
    expect(probe(LEVEL_WORD, true)).toMatchObject({ pending: false, ex: EX });
  });
});

describe('④ 답 면 — 단어 페이지와 같은 Example(후리가나 · 해석)', () => {
  const example = { pending: false, ex: EX, View: RoomLevelExample };
  const face = (word, revealed, ex = example) => renderToStaticMarkup(<FsrsQuestionFace kind="listening" word={word} revealed={revealed} id="h" speak={speak} ttsSupported example={ex} />);
  it('문제 면에는 글자 없음 · 답 면은 소리 단추 → 예문(루비 · 해석) → 표제어', () => {
    const q = face(LEVEL_WORD, false);
    expect(q).not.toMatch(/夕方|友達|저녁에|約束|lw-ex/);
    const a = face(LEVEL_WORD, true);
    expect(a).toContain('<div class="lw-ex--answer review-card__level-ex" data-language="ja"><div class="lw-ex">');
    expect(a).toContain('<ruby>夕方<rt>ゆうがた</rt></ruby>');
    expect(a).toContain('<span class="lw-ex__ko">저녁에 친구와 약속이 있어요.</span>');
    expect(a).not.toContain('aria-label="예문 듣기"'); // 다시 듣기는 위 소리 단추(단어 페이지 답 면과 같다)
    expect(a).not.toContain('lw-ex__w'); // 예문 단어 창은 복습실에 없다
    expect(a.indexOf('review-card__play')).toBeLessThan(a.indexOf('lw-ex__text'));
    expect(a.indexOf('lw-ex__text')).toBeLessThan(a.indexOf('<ruby>約束<rt>やくそく</rt></ruby>'));
  });
  it('원문 문장이 있는 단어 · 예문을 못 찾은 단어는 지금 그대로(예문 칸 없음)', () => {
    expect(face(READER_WORD, true)).not.toContain('lw-ex');
    expect(face(LEVEL_WORD, true, { pending: false, ex: null, View: null })).not.toContain('lw-ex');
  });
  it('판 lang은 단어 페이지 판 정본과 같다', () => {
    const pick = (cfg) => ({ hw: cfg.hw, exReading: cfg.exReading });
    expect(ROOM_EXAMPLE_LANG).toEqual({ Japanese: pick(jlptWordLang('N3')), Chinese: pick(HSK_WORD_LANG), English: pick(ENGLISH_WORD_LANG), French: pick(FRENCH_WORD_LANG) });
  });
  it('세션 화면 — 찾은 예문이 있으면 답 면에 그린다', async () => {
    await loadListenExample(LEVEL_WORD, { load: async () => ({ levelExampleOf: async () => EX, default: RoomLevelExample }) });
    const review = (phase) => ({ current: { cardId: 'l1', kind: 'listening', vocabularyId: 'w1', word: LEVEL_WORD, phase, attempt: { id: 'a' }, card: {} },
      busy: false, error: null, ready: [], nextWakeAt: null, lastGrade: null, registryAvailable: true, enabled: true, completed: 0,
      controller: { question: vi.fn(), reveal: vi.fn(), grade: vi.fn(), undo: vi.fn(), leave: vi.fn(), refresh: vi.fn(), getSnapshot: () => ({}) } });
    const render = (phase) => renderToStaticMarkup(<FsrsReviewSession review={review(phase)} embedded cardId="l1" stepKey="s" onExit={() => {}} speak={speak} ttsSupported />);
    expect(render('question')).not.toContain('夕方');
    expect(render('revealed')).toContain('<span class="lw-ex__ko">저녁에 친구와 약속이 있어요.</span>');
  });
});

describe('⑤ 자동 1회 — 문제 면 단추와 같은 글', () => {
  it('단추와 자동 읽기가 같은 listenText · 찾는 동안 기다림 · 시도마다 한 번', () => {
    const src = fs.readFileSync('src/components/vocab/FsrsReviewSession.jsx', 'utf8');
    expect(src).toContain('<ListenFace speak={say} text={listenText(word, example?.ex)} />');
    expect(src).toContain('const sayText = sayAttempt && !example.pending ? listenText(word, example.ex) : null;');
    expect(src).toContain('if (!sayAttempt || sayText == null || said.current === sayAttempt) return;');
    expect(src).toContain('speak(sayText, word.language || detectLang(word.word_text));');
    expect(src).toMatch(/\}, \[sayAttempt, sayText\]\);/);
    expect(src).not.toMatch(/source_sentence \|\| word\.word_text/); // 차례는 listenText 한 곳
  });
});
