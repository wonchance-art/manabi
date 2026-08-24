import { describe, expect, it } from 'vitest';
import { pickDictationSentences } from '../dictationPick';

describe('pickDictationSentences', () => {
  it('공백을 제외한 길이의 양쪽 경계를 포함한다', () => {
    const lines = ['가 나다라마', '가나다라마', '가나다라마바', '가나다라마바사'];

    expect(pickDictationSentences({ lines, min: 5, max: 6 })).toEqual([
      { index: 0, text: '가 나다라마' },
      { index: 1, text: '가나다라마' },
      { index: 2, text: '가나다라마바' },
    ]);
  });

  it('포함된 저장 단어가 많은 문장을 먼저 고른다', () => {
    const lines = ['오늘은 맑습니다.', '오늘 학교에 갑니다.', '학교에서 친구를 만납니다.'];
    const savedSet = new Set(['오늘', '학교', '친구']);

    expect(pickDictationSentences({ lines, savedSet })).toEqual([
      { index: 1, text: '오늘 학교에 갑니다.' },
      { index: 2, text: '학교에서 친구를 만납니다.' },
      { index: 0, text: '오늘은 맑습니다.' },
    ]);
  });

  it('저장 단어 수가 같으면 원문 순서를 유지하고 cap을 적용한다', () => {
    const lines = ['사과를 먹습니다.', '학교에 갑니다.', '사과를 좋아합니다.'];
    const savedSet = new Set(['사과', '학교']);

    expect(pickDictationSentences({ lines, savedSet, cap: 2 })).toEqual([
      { index: 0, text: '사과를 먹습니다.' },
      { index: 1, text: '학교에 갑니다.' },
    ]);
  });

  it('정확히 같은 문장은 첫 등장만 남긴다', () => {
    const lines = ['중복 문장입니다.', '다른 문장입니다.', '중복 문장입니다.'];

    expect(pickDictationSentences({ lines })).toEqual([
      { index: 0, text: '중복 문장입니다.' },
      { index: 1, text: '다른 문장입니다.' },
    ]);
  });

  it('입력이 없거나 비어 있으면 빈 배열을 반환한다', () => {
    expect(pickDictationSentences()).toEqual([]);
    expect(pickDictationSentences({ lines: [] })).toEqual([]);
  });
});
