import { describe, expect, it } from 'vitest';
import { pickOutputWords } from '../outputWords.js';

// 계약: 산출 주입 후보(#1077-16+17) — KST 오늘·채점 판정(ui·dict 제외)·오답 우선·폴백.

const NOW = Date.parse('2026-08-23T20:00:00+09:00');
const vocab = [
  { id: 1, word_text: '駒', meaning: '장기말', language: 'Japanese', last_reviewed_at: '2026-08-23T09:00:00+09:00' },
  { id: 2, word_text: '峠', meaning: '고개', language: 'Japanese', last_reviewed_at: '2026-08-23T10:00:00+09:00' },
  { id: 3, word_text: '雪', meaning: null, language: 'Japanese', last_reviewed_at: '2026-08-22T10:00:00+09:00' },
  { id: 4, word_text: 'porte', meaning: '문', language: 'French', last_reviewed_at: '2026-08-23T11:00:00+09:00' },
];
const ev = (wid, correct, at, source = 'vocab') => ({ source, correct, created_at: at, detail: { word_id: wid } });

describe('pickOutputWords', () => {
  it('오늘 채점 이벤트 단어를 오답 우선·최근순으로 고르고 언어를 거른다', () => {
    const events = [
      ev(1, true, '2026-08-23T09:00:00+09:00'),
      ev(2, false, '2026-08-23T10:00:00+09:00'), // 오답 — 최우선
      ev(3, true, '2026-08-23T11:00:00+09:00'),
      ev(4, false, '2026-08-23T12:00:00+09:00'), // French — 언어 필터로 제외
    ];
    const picked = pickOutputWords({ vocabRows: vocab, events, language: 'Japanese', now: NOW });
    expect(picked.map((w) => w.id)).toEqual([2, 3, 1]); // 오답(2) → 최근 접촉순(3, 1)
    expect(picked[0]).toEqual({ id: 2, word_text: '峠', meaning: '고개' });
    expect(picked[1].meaning).toBeNull(); // 뜻 없는 행도 word_text로 포함
  });

  it('ui·dict 이벤트와 어제 이벤트는 세지 않는다(채점 판정·KST 오늘 경계)', () => {
    const events = [
      ev(1, true, '2026-08-23T09:00:00+09:00', 'ui'),
      ev(1, true, '2026-08-23T09:00:00+09:00', 'dict'),
      ev(2, true, '2026-08-22T23:59:00+09:00'), // 어제
    ];
    // 이벤트 매칭 0 → last_reviewed_at 오늘 폴백(1·2·4 중 Japanese만, 최근순)
    const picked = pickOutputWords({ vocabRows: vocab, events, language: 'Japanese', now: NOW });
    expect(picked.map((w) => w.id)).toEqual([2, 1]);
  });

  it('detail.word_id 없는 이벤트는 폴백 경로로 — cap과 빈 입력', () => {
    const picked = pickOutputWords({
      vocabRows: vocab,
      events: [{ source: 'vocab', correct: true, created_at: '2026-08-23T09:00:00+09:00', detail: {} }],
      language: 'Japanese',
      now: NOW,
      cap: 1,
    });
    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe(2); // 폴백에서 최근 복습순 1건
    expect(pickOutputWords({ vocabRows: [], events: [], now: NOW })).toEqual([]);
    expect(pickOutputWords({ now: NOW })).toEqual([]);
  });
});
