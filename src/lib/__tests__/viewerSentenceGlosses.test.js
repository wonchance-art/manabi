import { describe, expect, it } from 'vitest';
import { sentenceWordGlosses, sentencePanelTokenIds, sentenceTranslationParts } from '../viewerSentenceGlosses.js';

/**
 * 계약: [문장] 탭의 칸 재료 — 뷰어 v2 AE-R2 PR ③(설계서 docs/manabi-viewer-v2-ae-r2.md §3.1·§3.3·§6.2 「단어별 뜻」).
 * - 단어별 뜻은 자료 토큰에서: 기호·개행 제외, 순서 보존, 교정된 뜻 그대로, 이합사 O 조각(歉)은 VO(道歉)에 합쳐진다.
 * - 원문 줄은 자르지 않고 누른 자리만 칠한다(같은 단어가 여러 번 나와도 누른 곳). 3줄 예산 밖이면 단어 앞뒤만.
 */
const tok = (text, extra = {}) => ({ text, base_form: text, furigana: '', meaning: '', pos: '명사', ...extra });

describe('sentenceWordGlosses — 자료 토큰의 단어별 뜻', () => {
  const dict = {
    a: tok('眼前', { furigana: 'yǎn qián', meaning: '눈앞' }),
    b: tok('的', { furigana: 'de', meaning: '~의', pos: '조사' }),
    p: tok('。', { pos: '기호' }),
    n: tok('\n', { pos: '개행' }),
    c: tok('他', { furigana: 'tā', meaning: '그' }),
    v: tok('道', { base_form: '道歉', furigana: 'dào', meaning: '사과하다', pos: '동사' }),
    l: tok('了', { furigana: 'le', meaning: '완료', pos: '조사' }),
    o: tok('歉', { sep_link: '道歉', furigana: 'qiàn', meaning: '사과' }),
    e: tok('！', { pos: null }),
    x: tok('眼前', { furigana: 'yǎn qián', meaning: '눈앞(다시)' }),
    m: tok('上', { furigana: 'shàng' }), // 뜻 없음 — 뺀다
    k: tok('壮观', { furigana: 'zhuàng guān', meaning: '웅장하다 (교정됨)' }),
  };

  it('기호·개행·조사·글자 없는 토큰·뜻 없는 토큰을 빼고 본문 순서를 지킨다', () => {
    const out = sentenceWordGlosses(dict, ['a', 'b', 'p', 'n', 'c', 'e', 'm', 'k'], { language: 'Chinese' });
    expect(out.map((g) => g.text)).toEqual(['眼前', '他', '壮观']);
  });

  it('중국어 읽기는 음절 공백을 뺀 병음, 뜻은 토큰 뜻(교정 반영) 그대로', () => {
    const out = sentenceWordGlosses(dict, ['a', 'k'], { language: 'Chinese' });
    expect(out).toEqual([
      { key: '眼前', text: '眼前', reading: 'yǎnqián', meaning: '눈앞', tokenId: 'a' },
      { key: '壮观', text: '壮观', reading: 'zhuàngguān', meaning: '웅장하다 (교정됨)', tokenId: 'k' },
    ]);
  });

  it('이합사 O 조각(歉)은 VO(道歉)에 합쳐진다 — 표제는 VO, 조각 병음은 붙이지 않는다', () => {
    const out = sentenceWordGlosses(dict, ['c', 'v', 'l', 'o', 'p'], { language: 'Chinese' });
    expect(out.map((g) => [g.key, g.text, g.reading])).toEqual([['他', '他', 'tā'], ['道歉', '道歉', '']]);
    expect(out.find((g) => g.key === '道歉').meaning).toBe('사과하다');
    expect(out.some((g) => g.text === '歉')).toBe(false);
  });

  it('같은 어휘는 처음 나온 자리 하나만', () => {
    expect(sentenceWordGlosses(dict, ['a', 'c', 'x'], { language: 'Chinese' }).map((g) => g.meaning)).toEqual(['눈앞', '그']);
  });

  it('일본어는 본문 표면(활용형)과 표면과 다른 요미, 한국어·영어는 읽기 없음', () => {
    const ja = { a: tok('飲みました', { base_form: '飲む', furigana: 'のみました', meaning: '마셨습니다' }), b: tok('を', { meaning: '을', pos: '조사' }), c: tok('紅茶', { furigana: 'こうちゃ', meaning: '홍차' }) };
    expect(sentenceWordGlosses(ja, ['c', 'b', 'a'], { language: 'Japanese' }))
      .toEqual([{ key: '紅茶', text: '紅茶', reading: 'こうちゃ', meaning: '홍차', tokenId: 'c' }, { key: '飲む', text: '飲みました', reading: 'のみました', meaning: '마셨습니다', tokenId: 'a' }]);
    const en = { a: tok('went', { base_form: 'go', furigana: 'gəʊ', meaning: '갔다' }), p: tok('.', { pos: '기호' }) };
    expect(sentenceWordGlosses(en, ['a', 'p'], { language: 'English' })).toEqual([{ key: 'go', text: 'went', reading: '', meaning: '갔다', tokenId: 'a' }]);
  });
});

describe('sentencePanelTokenIds — 탭 문장의 토큰 범위', () => {
  const rawLines = ['# 제목 줄', '  眼前很好。 ', '我们去。'];
  const lineTokens = new Map([[0, [{ id: 'id_0_0' }]], [1, [{ id: 'id_1_0' }, { id: 'id_1_1' }]], [2, [{ id: 'id_2_0' }, { id: 'id_2_1' }]]]);
  const sequence = ['id_0_0', 'id_0_1', 'id_1_0', 'id_1_1', 'id_1_2', 'id_2_0', 'id_2_1'];
  const dictionary = { id_0_0: tok('# 제목 줄'), id_0_1: tok('\n', { pos: '개행' }), id_1_0: tok('眼前'), id_1_1: tok('很好。'), id_1_2: tok('\n', { pos: '개행' }), id_2_0: tok('我们'), id_2_1: tok('去。') };

  it('카드·막대 문장(정리한 원문 줄) = 그 줄 토큰', () => {
    expect(sentencePanelTokenIds({ text: '眼前很好。', rawLines, lineTokens })).toEqual(['id_1_0', 'id_1_1']);
    expect(sentencePanelTokenIds({ text: '제목 줄', rawLines, lineTokens })).toEqual(['id_0_0']);
  });

  it('드래그 범위 — 합성 텍스트가 탭 문장과 같을 때만 그 범위(여러 줄 포함)', () => {
    const range = { start: 3, end: 5 };
    expect(sentencePanelTokenIds({ text: '很好。\n我们', rawLines, lineTokens, sequence, dictionary, range })).toEqual(['id_1_1', 'id_1_2', 'id_2_0']);
    // 범위가 남아 있어도 탭 문장이 다르면(다른 경로로 연 문장) 범위를 쓰지 않는다.
    expect(sentencePanelTokenIds({ text: '我们去。', rawLines, lineTokens, sequence, dictionary, range })).toEqual(['id_2_0', 'id_2_1']);
  });

  it('문장 단위(마침표까지 한 문장)가 맞으면 줄 전체가 아니라 그 문장 토큰만 — 오너 선택 2026-10-24', () => {
    const sentences = [
      { key: '1:0', rawIdx: 1, text: '眼前', tokenIds: ['id_1_0'] },
      { key: '1:1', rawIdx: 1, text: '很好。', tokenIds: ['id_1_1'] },
    ];
    expect(sentencePanelTokenIds({ text: '很好。', rawLines, lineTokens, sentences })).toEqual(['id_1_1']);
    // 줄 전체 텍스트면 예전처럼 줄 토큰(막대가 줄 첫 문장만 가진 옛 저장 문장 호환)
    expect(sentencePanelTokenIds({ text: '眼前很好。', rawLines, lineTokens, sentences })).toEqual(['id_1_0', 'id_1_1']);
  });

  it('원문 줄과 맞지 않는 부분 문자열·빈 문장은 빈 범위', () => {
    expect(sentencePanelTokenIds({ text: '很好', rawLines, lineTokens })).toEqual([]);
    expect(sentencePanelTokenIds({ text: '', rawLines, lineTokens })).toEqual([]);
  });
});

describe('sentenceTranslationParts — 번역 줄과 회색 줄(제목 줄 없이, 맥락 없이)', () => {
  it('번역은 위, 말투는 아래 회색 줄, 맥락은 그리지 않는다(오너 10-24), 굵게는 걷는다', () => {
    expect(sentenceTranslationParts('**번역**\n오늘은 **날씨**가 좋다.\n\n**맥락**\n일상 서술문이에요.\n\n**말투**\n반말이에요.'))
      .toEqual({ translation: ['오늘은 날씨가 좋다.'], notes: ['반말이에요.'] });
    // 중국어 설명의 맥락 제목(语境 · 語境)도 같다.
    expect(sentenceTranslationParts('**翻译**\n今天天气很好。\n\n**语境**\n日常叙述。')).toEqual({ translation: ['今天天气很好。'], notes: [] });
    expect(sentenceTranslationParts('**翻譯**\n今天天氣很好。\n\n**語境**\n日常敘述。')).toEqual({ translation: ['今天天氣很好。'], notes: [] });
  });
  it('교재 뜻(📘 표시)은 번역 아래 회색 줄로, 제목 없는 결과는 그대로 번역', () => {
    expect(sentenceTranslationParts('**번역**\n좋은 아침.\n\n📘 교재에 실린 뜻이에요.')).toEqual({ translation: ['좋은 아침.'], notes: ['📘 교재에 실린 뜻이에요.'] });
    expect(sentenceTranslationParts('그냥 번역')).toEqual({ translation: ['그냥 번역'], notes: [] });
    expect(sentenceTranslationParts('')).toEqual({ translation: [], notes: [] });
  });
});
