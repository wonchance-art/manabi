import { describe, expect, it } from 'vitest';
import enA1 from '../../content/english/vocab/a1.js';
import enNotes from '../../content/english/wordNotes.js';
import { LATIN_WORD_PICKS, latinWordsData } from '../latinWordsData.js';
import { latinSampleGroups } from '../latinLevelWords.js';
import { levelGroupsOf } from '../levelList.js';

// 영어 A1 단어 화면 — 예전 8개를 품은 생활 어휘 53개(#1588 Codex 1차 후보 이식, 2026-11-02 KST).
describe('영어 A1 단어 화면', () => {
  const OLD_PICKS = [[0, ['hello', 'welcome']], [2, 2], [4, ['be', 'go']], [5, 2]];
  const oldEntries = levelGroupsOf(latinSampleGroups(enA1, { lang: 'en', picks: OLD_PICKS, notes: enNotes })).flatMap((g) => g.entries);
  const data = latinWordsData('english', 'a1');
  const entries = levelGroupsOf(data.groups).flatMap((g) => g.entries);

  it('예전 여덟 카드의 대조 키 · 내용을 그대로 둔다(학습 기록 키 불변)', () => {
    expect(oldEntries).toHaveLength(8);
    for (const old of oldEntries) expect(entries.find((e) => e.word === old.word)).toEqual(old);
  });
  it('고른 표제를 빠짐없이 차례대로 싣고 대조 키가 겹치지 않는다', () => {
    const requested = LATIN_WORD_PICKS.english.A1.flatMap(([, words]) => words);
    expect(requested).toHaveLength(53);
    expect(entries.map((e) => e.word)).toEqual(requested);
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
    expect(entries.find((e) => e.word === 'good morning').key).toBe('good morning');
  });
  it('모든 카드에 표제 · 발음 · 뜻이 있고, mother(정본에 예문 없음)를 빼면 예문 · 번역이 있다', () => {
    for (const e of entries) {
      expect(e.word && e.reading && e.fullMeaning).toBeTruthy();
      if (e.word !== 'mother') expect(e.ex?.text && e.ex?.ko).toBeTruthy();
    }
  });
});
