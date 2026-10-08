import { describe, expect, it } from 'vitest';
import { sentenceWordGlosses, sentencePanelTokenIds, sentencePanelOriginal, sentencePatternHits } from '../viewerSentenceGlosses.js';

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

  it('기호·개행·글자 없는 토큰·뜻 없는 토큰을 빼고 본문 순서를 지킨다', () => {
    const out = sentenceWordGlosses(dict, ['a', 'b', 'p', 'n', 'c', 'e', 'm', 'k'], { language: 'Chinese' });
    expect(out.map((g) => g.text)).toEqual(['眼前', '的', '他', '壮观']);
  });

  it('중국어 읽기는 음절 공백을 뺀 병음, 뜻은 토큰 뜻(교정 반영) 그대로', () => {
    const out = sentenceWordGlosses(dict, ['a', 'k'], { language: 'Chinese' });
    expect(out).toEqual([
      { key: '眼前', text: '眼前', reading: 'yǎnqián', meaning: '눈앞' },
      { key: '壮观', text: '壮观', reading: 'zhuàngguān', meaning: '웅장하다 (교정됨)' },
    ]);
  });

  it('이합사 O 조각(歉)은 VO(道歉)에 합쳐진다 — 표제는 VO, 조각 병음은 붙이지 않는다', () => {
    const out = sentenceWordGlosses(dict, ['c', 'v', 'l', 'o', 'p'], { language: 'Chinese' });
    expect(out.map((g) => [g.key, g.text, g.reading])).toEqual([['他', '他', 'tā'], ['道歉', '道歉', ''], ['了', '了', 'le']]);
    expect(out.find((g) => g.key === '道歉').meaning).toBe('사과하다');
    expect(out.some((g) => g.text === '歉')).toBe(false);
  });

  it('같은 어휘는 처음 나온 자리 하나만', () => {
    expect(sentenceWordGlosses(dict, ['a', 'c', 'x'], { language: 'Chinese' }).map((g) => g.meaning)).toEqual(['눈앞', '그']);
  });

  it('일본어는 본문 표면(활용형)과 표면과 다른 요미, 한국어·영어는 읽기 없음', () => {
    const ja = { a: tok('飲みました', { base_form: '飲む', furigana: 'のみました', meaning: '마셨습니다' }), b: tok('を', { meaning: '을', pos: '조사' }), c: tok('紅茶', { furigana: 'こうちゃ', meaning: '홍차' }) };
    expect(sentenceWordGlosses(ja, ['c', 'b', 'a'], { language: 'Japanese' }))
      .toEqual([{ key: '紅茶', text: '紅茶', reading: 'こうちゃ', meaning: '홍차' }, { key: 'を', text: 'を', reading: '', meaning: '을' }, { key: '飲む', text: '飲みました', reading: 'のみました', meaning: '마셨습니다' }]);
    const en = { a: tok('went', { base_form: 'go', furigana: 'gəʊ', meaning: '갔다' }), p: tok('.', { pos: '기호' }) };
    expect(sentenceWordGlosses(en, ['a', 'p'], { language: 'English' })).toEqual([{ key: 'go', text: 'went', reading: '', meaning: '갔다' }]);
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

  it('원문 줄과 맞지 않는 부분 문자열·빈 문장은 빈 범위', () => {
    expect(sentencePanelTokenIds({ text: '很好', rawLines, lineTokens })).toEqual([]);
    expect(sentencePanelTokenIds({ text: '', rawLines, lineTokens })).toEqual([]);
  });
});

describe('sentencePanelOriginal — 원문 줄(자르지 않음) + 누른 자리만 칠', () => {
  it('같은 단어가 두 번 나와도 누른 토큰 자리만', () => {
    const tokens = [{ id: 'a', text: '他' }, { id: 'b', text: '说' }, { id: 'c', text: '他' }, { id: 'd', text: '来' }];
    expect(sentencePanelOriginal({ text: '他说他来', tokens, tokenId: 'c' })).toEqual({ before: '他说', term: '他', after: '来' });
  });

  it('120자를 넘는 줄도 앞에서 자르지 않는다 — 예산 밖이면 단어 앞뒤를 남기고 …', () => {
    const head = '一'.repeat(100), tail = '二'.repeat(100);
    const tokens = [{ id: 'h', text: head }, { id: 'w', text: '壮观' }, { id: 't', text: tail }];
    const out = sentencePanelOriginal({ text: `${head}壮观${tail}`, tokens, tokenId: 'w' });
    expect(out.term).toBe('壮观');
    expect(out.before.startsWith('…')).toBe(true);
    expect(out.after.endsWith('…')).toBe(true);
    // 예산 안이면 그대로(120자 자르기 없음)
    const mid = '三'.repeat(50);
    expect(sentencePanelOriginal({ text: `${mid}壮观`, tokens: [{ id: 'm', text: mid }, { id: 'w', text: '壮观' }], tokenId: 'w' }))
      .toEqual({ before: mid, term: '壮观', after: '' });
  });

  it('누른 토큰이 없으면(막대·드래그) 칠 없이 전체 그대로', () => {
    const long = '四'.repeat(200);
    expect(sentencePanelOriginal({ text: long })).toEqual({ before: long, term: '', after: '' });
  });
});

describe('sentencePatternHits — 이 문장 토큰에 걸린 문형만', () => {
  it('본문 순서, 다른 줄 hit 제외, 스캔이 없으면(문법 표시 끔) 빈 목록', () => {
    const scan = { hits: [{ kernel: '比', tokenIds: ['id_0_3'] }, { kernel: '要', tokenIds: ['id_1_5'] }, { kernel: '更', tokenIds: ['id_0_6', 'id_0_7'] }] };
    expect(sentencePatternHits(scan, ['id_0_0', 'id_0_3', 'id_0_7']).map((h) => h.kernel)).toEqual(['比', '更']);
    expect(sentencePatternHits(null, ['id_0_3'])).toEqual([]);
    expect(sentencePatternHits(scan, [])).toEqual([]);
  });
});
