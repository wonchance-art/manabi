import { describe, expect, it } from 'vitest';
import {
  GLOSS_MAX, LONG_BLOCK_CHARS, bookTranslation, cachedTranslationText, glossMeaning, isLongBlock, paragraphTranslations,
  pickPrintOption, PRINT_KINDS, PRINT_PAPER_CSS, printAttributionLines, printLevelLabel, printParagraphs, printRubyShown,
  printWordState, selectGlosses, sentencesByLine,
} from '../printSheet.js';

// 인쇄 학습지 선택 규칙(PRINT-SHEET-001) — 문단 · 뜻풀이 · 아는 단어 · 번역 · 급수 · 출처.
const T = 1700000000000;
function material(lines, language = 'Japanese') {
  const sequence = [];
  const dictionary = {};
  lines.forEach((tokens, line) => {
    tokens.forEach(([text, pos, meaning, base_form, furigana], n) => {
      const id = `id_${line}_${n}_${T}`;
      sequence.push(id);
      dictionary[id] = { text, pos, meaning: meaning || '', base_form: base_form || text, furigana: furigana || null };
    });
    if (line < lines.length - 1) {
      sequence.push(`br_${line}_${T}`);
      dictionary[`br_${line}_${T}`] = { text: '\n', pos: '개행' };
    }
  });
  const raw = lines.map((tokens) => tokens.map(([text]) => text).join('')).join('\n');
  return { json: { sequence, dictionary, status: 'completed', metadata: { language } }, raw };
}

const JA = material([
  [['朝', '명사', '아침', '朝', 'あさ'], ['から', '조사', '~부터'], ['雨', '명사', '비', '雨', 'あめ'], ['が', '조사', '이/가'],
    ['降っ', '동사', '내리다', '降る', 'ふる'], ['て', '조사', '~해서'], ['いる', '동사', '~하고 있다', 'いる'], ['。', '기호']],
  [],
  [['雨', '명사', '비', '雨', 'あめ'], ['の', '조사', '~의'], ['音', '명사', '소리', '音', 'おと'], ['が', '조사', '이/가'],
    ['聞こえ', '동사', '들리다', '聞こえる', 'きこえる'], ['ます', '조동사', '~합니다', 'ます'], ['。', '기호']],
]);

describe('문단 — 뷰어 줄 묶음과 같다', () => {
  it('원문 한 줄 = 한 문단, 빈 줄은 건너뛴다', () => {
    const paragraphs = printParagraphs(JA.json, JA.raw);
    expect(paragraphs.map((p) => p.rawIdx)).toEqual([0, 2]);
    expect(paragraphs[0].tokens.map((t) => t.text).join('')).toBe('朝から雨が降っている。');
    expect(paragraphs[0].lineText).toBe('朝から雨が降っている。');
  });

  it('띄어 쓰는 언어는 원문 간격을 토큰 앞 gap으로 싣는다 · # 제목 표지는 빼고 제목 단계를 단다', () => {
    const json = {
      sequence: ['id_0_0_1', 'id_0_1_1', 'br_0_1', 'id_1_0_1', 'id_1_1_1', 'id_1_2_1'],
      dictionary: {
        id_0_0_1: { text: '#', pos: '기호' }, id_0_1_1: { text: 'Title', pos: '명사' }, br_0_1: { text: '\n', pos: '개행' },
        id_1_0_1: { text: 'Hello', pos: '명사' }, id_1_1_1: { text: 'world', pos: '명사' }, id_1_2_1: { text: '.', pos: '기호' },
      },
    };
    const [head, body] = printParagraphs(json, '# Title\nHello world.');
    expect(head.heading).toBe(1);
    expect(head.tokens.map((t) => t.text)).toEqual(['Title']);
    expect(body.tokens.map((t) => t.gap)).toEqual(['', ' ', '']);
  });
});

describe('뜻풀이 — 처음 나온 모르는 내용어, 문단마다 8개까지', () => {
  it('조사 · 기호 · 조동사 · 보조 용언(いる)은 싣지 않는다', () => {
    const [first] = selectGlosses(printParagraphs(JA.json, JA.raw), { language: 'Japanese' });
    expect(first.items.map((g) => g.word)).toEqual(['朝', '雨', '降る']);
    // 표제어는 기본형, 읽기는 그 기본형의 읽기(분석기 furigana) — 활용형 降っ에 ふる를 붙이지 않는다.
    expect(first.items[2]).toMatchObject({ word: '降る', reading: 'ふる', meaning: '내리다', pos: '동사' });
    expect([...first.refs.values()]).toEqual([1, 2, 3]);
  });

  it('앞 문단에서 풀이한 말은 다시 싣지 않는다(첫 등장만)', () => {
    const [, second] = selectGlosses(printParagraphs(JA.json, JA.raw), { language: 'Japanese' });
    expect(second.items.map((g) => g.word)).toEqual(['音', '聞こえる']);
  });

  it(`한 문단에 ${GLOSS_MAX}개를 넘지 않는다`, () => {
    const many = material([[...Array.from({ length: 12 }, (_, i) => [`語${i}`, '명사', `뜻${i}`, `語${i}`, 'ご']), ['。', '기호']]]);
    const [only] = selectGlosses(printParagraphs(many.json, many.raw), { language: 'Japanese' });
    expect(only.items).toHaveLength(GLOSS_MAX);
    expect(only.items.at(-1).word).toBe('語7');
  });

  it('뜻이 없는 토큰 · 제목 줄은 싣지 않는다', () => {
    const m = material([[['謎', '명사', '', '謎', 'なぞ'], ['の', '조사', '~의'], ['本', '명사', '책', '本', 'ほん'], ['を', '조사', '을/를'], ['読む', '동사', '읽다', '読む', 'よむ'], ['。', '기호']]]);
    const paragraphs = printParagraphs(m.json, m.raw);
    expect(selectGlosses(paragraphs, { language: 'Japanese' })[0].items.map((g) => g.word)).toEqual(['本', '読む']);
    expect(selectGlosses([{ ...paragraphs[0], heading: 1 }], { language: 'Japanese' })[0].items).toEqual([]);
  });

  it('아는 단어 · 담은 단어는 뺀다(뷰어 「모르는 단어만」과 같은 판정) — 손님(기록 없음)은 아무것도 빼지 않는다', () => {
    const paragraphs = printParagraphs(JA.json, JA.raw);
    const savedWords = { byKey: new Map([['Japanese:base:降る', { id: 1, language: 'Japanese' }]]), surfaces: new Set(), bases: new Set() };
    const knownWordSet = new Set(['朝']);
    const isFamiliar = (token) => { const s = printWordState(token, { savedWords, knownWordSet, language: 'Japanese' }); return s.isKnown || s.isSaved; };
    expect(selectGlosses(paragraphs, { language: 'Japanese', isFamiliar })[0].items.map((g) => g.word)).toEqual(['雨']);
    const guest = (token) => { const s = printWordState(token, { language: 'Japanese' }); return s.isKnown || s.isSaved; };
    expect(selectGlosses(paragraphs, { language: 'Japanese', isFamiliar: guest })[0].items).toHaveLength(3);
  });

  it('다른 언어로 담은 같은 글자는 담은 단어가 아니다(언어별 색인)', () => {
    const token = { text: '雨', base_form: '雨' };
    const savedWords = { byKey: new Map([['Chinese:surface:雨', { id: 2, language: 'Chinese' }]]) };
    expect(printWordState(token, { savedWords, language: 'Japanese' }).isSaved).toBe(false);
    expect(printWordState(token, { savedWords, language: 'Chinese' }).isSaved).toBe(true);
  });

  it('중국어 표제어 = 사전 키, 읽기 = 음절 공백을 뺀 병음', () => {
    const zh = material([[['朋友', '명사', '친구', '朋友', 'péng you'], ['的', '조사', '~의'], ['我', '대명사', '나', '我', 'wǒ'], ['。', '기호']]], 'Chinese');
    const [only] = selectGlosses(printParagraphs(zh.json, zh.raw), { language: 'Chinese' });
    expect(only.items).toEqual([expect.objectContaining({ word: '朋友', reading: 'péngyou', meaning: '친구' })]);
  });

  it('뜻은 앞의 두 뜻까지 한 줄로', () => {
    expect(glossMeaning('가다; 떠나다; 진행하다')).toBe('가다; 떠나다');
    expect(glossMeaning('')).toBe('');
  });
});

describe('읽기 표시 — 전부 · 모르는 단어만 · 없음', () => {
  it('pronHiddenFor와 같은 판정', () => {
    expect(printRubyShown('all', { isKnown: true, isSaved: true })).toBe(true);
    expect(printRubyShown('unknown', { isKnown: false, isSaved: false })).toBe(true);
    expect(printRubyShown('unknown', { isKnown: true, isSaved: false })).toBe(false);
    expect(printRubyShown('unknown', { isKnown: false, isSaved: true })).toBe(false);
    expect(printRubyShown('none', { isKnown: false, isSaved: false })).toBe(false);
  });
});

describe('번역 — 교재 맵 → 이 기기의 뷰어 번역, 없으면 빈 줄', () => {
  const paragraphs = printParagraphs(JA.json, JA.raw);
  const units = sentencesByLine(JA.json, JA.raw, 'Japanese');

  it('교재 맵은 줄 전체 정확 일치, 아니면 줄의 모든 문장이 있을 때만', () => {
    expect(bookTranslation({ '朝から雨が降っている。': '아침부터 비가 내리고 있다.' }, paragraphs[0], units.get(0))).toBe('아침부터 비가 내리고 있다.');
    expect(bookTranslation({ '朝から雨が': '부분' }, paragraphs[0], units.get(0))).toBeNull();
    expect(bookTranslation(null, paragraphs[0], units.get(0))).toBeNull();
  });

  it('기기 사본(viewer_tx)은 문장 키로 읽기만 하고, 번역 줄만 싣는다 — 없거나 실패 표식이면 그 문단은 빈 줄', async () => {
    const store = new Map([['k:雨の音が聞こえます。', '**번역**\n빗소리가 들립니다.\n\n**맥락**\n도서관 장면이에요.']]);
    const reads = [];
    const storage = { getItem: (key) => { reads.push(key); return store.get(key) ?? null; }, setItem: () => { throw new Error('쓰지 않는다'); } };
    const keyOf = async (sentence) => `k:${sentence}`;
    const map = await paragraphTranslations({ paragraphs, units, translations: null, keyOf, storage });
    expect(map.get(2)).toEqual({ text: '빗소리가 들립니다.', source: 'device' });
    expect(map.has(0)).toBe(false); // 없음 → 빈 줄 두 줄
    expect(reads).toEqual(['k:朝から雨が降っている。', 'k:雨の音が聞こえます。']);
    expect(cachedTranslationText('\u0000viewer-sentence:failed')).toBeNull();
    expect(cachedTranslationText('**번역**\n교재 뜻\n\n📘 교재에 실린 뜻이에요.')).toBe('교재 뜻');
  });

  it('키를 만들 수 없거나(설명 언어가 여럿) 저장소가 막혀도 던지지 않고 교재 맵만 쓴다', async () => {
    const translations = { '雨の音が聞こえます。': '빗소리가 들린다.' };
    const map = await paragraphTranslations({ paragraphs, units, translations, keyOf: null, storage: null });
    expect([...map.entries()]).toEqual([[2, { text: '빗소리가 들린다.', source: 'book' }]]);
    const broken = { getItem: () => { throw new Error('SecurityError'); } };
    expect((await paragraphTranslations({ paragraphs, units, translations: null, keyOf: async (s) => s, storage: broken })).size).toBe(0);
  });
});

describe('급수 · 판형 · 긴 묶음 · 출처', () => {
  it('중국어 HSK 2026(정본 라벨) · 일본어 JLPT N5–N1 · 그 밖은 없음', () => {
    expect(printLevelLabel('Chinese', '朋友', { zhLevels: { 朋友: 1, 嫦娥: 7 } })).toBe('HSK 1');
    expect(printLevelLabel('Chinese', '嫦娥', { zhLevels: { 嫦娥: 7 } })).toBe('HSK 7–9');
    expect(printLevelLabel('Chinese', '没有', { zhLevels: {} })).toBeNull();
    expect(printLevelLabel('Japanese', '雨', { jaLevels: new Map([['雨', 5]]) })).toBe('N5');
    expect(printLevelLabel('Japanese', '雨', { jaLevels: null })).toBeNull();
    expect(printLevelLabel('English', 'rain', {})).toBeNull();
  });

  it('B5는 JIS B5(182×257mm) · 주소 값은 목록 안에서만', () => {
    expect(PRINT_PAPER_CSS.B5).toBe('182mm 257mm');
    expect(pickPrintOption('study', PRINT_KINDS, 'text')).toBe('study');
    expect(pickPrintOption('<script>', PRINT_KINDS, 'text')).toBe('text');
  });

  it('긴 묶음 = 원문 글자 × 칸 폭 배수가 기준 초과', () => {
    const para = (n) => ({ tokens: [{ text: '字'.repeat(n) }] });
    expect(isLongBlock(para(LONG_BLOCK_CHARS))).toBe(false);
    expect(isLongBlock(para(LONG_BLOCK_CHARS + 1))).toBe(true);
    expect(isLongBlock(para(80), { cellScale: 1.84 })).toBe(true);
  });

  it('출처 줄은 metadata.source가 있으면 늘 싣는다(링크 대신 주소) · 없으면 없음', () => {
    const lines = printAttributionLines({ processed_json: { metadata: { source: {
      kind: 'youtube', channel: 'NHK', license: 'cc-by', url: 'https://www.youtube.com/watch?v=abc',
    } } } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^출처: NHK · .+ · https:\/\/www\.youtube\.com\/watch\?v=abc$/);
    expect(printAttributionLines({ processed_json: { metadata: { source: { kind: 'youtube', url: 'javascript:alert(1)', channel: '' } } } })).toEqual([]);
    expect(printAttributionLines({ processed_json: { metadata: {} } })).toEqual([]);
  });
});

describe('printParagraphs — 본문 첫 줄이 자료 제목과 같으면 빼고 다시 찍지 않는다', () => {
  const json = { sequence: ['id_0_0', 'br_0', 'id_1_0'], dictionary: { id_0_0: { text: '雨の日' }, br_0: { text: '\n', pos: '개행' }, id_1_0: { text: '朝です。' } } };
  it('같으면 빼고, 다르면 그대로', () => {
    expect(printParagraphs(json, '雨の日\n朝です。', { title: '雨の日' }).map((p) => p.lineText)).toEqual(['朝です。']);
    expect(printParagraphs(json, '雨の日\n朝です。', { title: '晴れ' }).map((p) => p.lineText)).toEqual(['雨の日', '朝です。']);
    expect(printParagraphs(json, '雨の日\n朝です。').map((p) => p.lineText)).toEqual(['雨の日', '朝です。']);
  });
});
