import { describe, expect, it } from 'vitest';
import { usableVocabReviewMode } from '../vocabStudy';

const expression = 'もう 本を 読みましたか。まだ 読んでいません。';
const fullSentence = { word_text: expression, source_sentence: expression };
const choices = [{ meaning: '벌써 읽었어요? 아직 읽지 않았어요.' }, { meaning: '역은 어디인가요?' }];

describe('복습 출제 단서', () => {
  it('N5 예문 전체를 담은 카드는 문장 전체를 가리지 않는다', () => {
    expect(usableVocabReviewMode('context', fullSentence, choices)).toBe('flash');
    expect(usableVocabReviewMode('context', { ...fullSentence, source_sentence: `「${expression}」` }, choices)).toBe('flash');
  });
  it('첫 카드 하나만 있으면 정답 하나짜리 객관식을 출제하지 않는다', () => {
    for (const mode of ['context', 'listening']) {
      expect(usableVocabReviewMode(mode, { word_text: '駅' }, [choices[0]])).toBe('flash');
    }
  });
  it('뜻이 중복되거나 비어 있는 보기도 회상 카드로 전환한다', () => {
    expect(usableVocabReviewMode('context', fullSentence, [choices[0], { meaning: ` ${choices[0].meaning} ` }])).toBe('flash');
    expect(usableVocabReviewMode('listening', fullSentence, [choices[0], { meaning: '' }])).toBe('flash');
  });
  it('단서가 남는 문맥과 문맥이 없는 단어 문제는 기존 선택형을 유지한다', () => {
    expect(usableVocabReviewMode('context', { word_text: '駅', source_sentence: '駅は どこですか。' }, choices)).toBe('context');
    expect(usableVocabReviewMode('context', { word_text: '駅' }, choices)).toBe('context');
    expect(usableVocabReviewMode('listening', fullSentence, choices)).toBe('listening');
  });
  it('플래시·직접 입력은 보존하며 기존 카드와 보기를 수정하지 않는다', () => {
    const before = JSON.stringify({ fullSentence, choices });
    for (const mode of ['flash', 'typing']) expect(usableVocabReviewMode(mode, fullSentence, choices)).toBe(mode);
    expect(JSON.stringify({ fullSentence, choices })).toBe(before);
  });
});
