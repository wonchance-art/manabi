import { describe, expect, it } from 'vitest';
import a1 from '../../content/english/vocab/a1.js';
import notes from '../../content/english/wordNotes.js';
import { ENGLISH_A1_PICKS } from '../../content/english/wordDeckA1.js';
import { latinSampleGroups } from '../latinLevelWords.js';
import { levelGroupsOf } from '../levelList.js';

describe('영어 A1 단어 화면 1차 후보', () => {
  const original = latinSampleGroups(a1, { lang: 'en', picks: [[0, ['hello', 'welcome']], [2, 2], [4, ['be', 'go']], [5, 2]], notes });
  const groups = latinSampleGroups(a1, { lang: 'en', picks: ENGLISH_A1_PICKS, notes });
  const oldEntries = levelGroupsOf(original).flatMap((g) => g.entries);
  const entries = levelGroupsOf(groups).flatMap((g) => g.entries);

  it('기존 여덟 카드의 대조 키·내용을 보존한다', () => {
    for (const old of oldEntries) expect(entries.find((e) => e.word === old.word)).toEqual(old);
  });
  it('지정한 표제를 빠짐없이 싣고 정규화된 키 충돌을 막는다', () => {
    const requested = ENGLISH_A1_PICKS.flatMap(([, words]) => words);
    expect(entries.map((e) => e.word)).toEqual(requested);
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
    expect(entries.find((e) => e.word === 'good morning').key).toBe('good morning');
  });
  it('모든 후보에 표제·IPA·뜻이 있고, 기존 mother를 제외하면 대응 예문이 있다', () => {
    for (const e of entries) {
      expect(e.word && e.reading && e.fullMeaning).toBeTruthy();
      if (e.word !== 'mother') expect(e.ex?.text && e.ex?.ko).toBeTruthy();
    }
  });
});
