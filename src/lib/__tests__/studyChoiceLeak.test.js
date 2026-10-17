// 보기가 문제 낱말을 드러내지 않는다(STUDY-CHOICE-LEAK-001, 2026-10-17 KST).
// 합성 로그인 점검에서 /study 몸풀기 「マジ／マジで」의 정답 보기가 「진짜·레알 (「マジで?」=실화냐?)」였다 — 정본 뜻(slang_core)의
// 괄호 용례가 문제 낱말을 그대로 보였다. 규칙은 meaningClean.js(choiceMeaning · choiceLabels · choiceSet)가 정본이다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { choiceLabels, choiceMeaning, choiceSet, stripSourceLangInMeaning } from '../meaningClean';
import { buildEncounterItems, buildWarmupItems, composeSession } from '../studySession';

const read = (f) => fs.readFileSync(f, 'utf8');
const SOURCE = /[ぁ-ゟァ-ヿ一-鿿]/;
const MAJI = { word_text: 'マジ／マジで', meaning: '진짜·레알 (「マジで?」=실화냐?)' };
const POOL = ['역', '학교', '전철', '열받는다·빡친다 (속이 부글부글. 「ムカムカ」에서)'];

describe('규칙 ① choiceMeaning — 원어 · 인용 괄표가 든 괄호는 한글이 섞여도 뺀다(문제 낱말과 상관없이 모든 보기에)', () => {
  it('マジ 사례: 괄호 용례가 빠지고 뜻만 남는다', () => {
    expect(choiceMeaning(MAJI.meaning)).toBe('진짜·레알');
    expect(choiceMeaning('열받는다·빡친다 (속이 부글부글. 「ムカムカ」에서)')).toBe('열받는다·빡친다');
  });
  it('문제 낱말이 없는 괄호: 원어가 들었으면 빼고(어느 보기든 같은 규칙), 한글만이면 남긴다', () => {
    // 한글만 있는 괄호는 철자를 드러낼 수 없고 가까운 보기를 가르는 정보(과거형 · 존댓말 등)라 남긴다.
    expect(choiceMeaning('달리다 (과거형)')).toBe('달리다 (과거형)');
    expect(choiceMeaning('항목 (1)')).toBe('항목 (1)');
    // 원어가 든 괄호는 그 보기의 문제 낱말이 아니어도 뺀다 — 정답만 괄호가 사라지면 「괄호 없는 보기 = 정답」이 된다.
    expect(choiceMeaning('기차 (「汽車」와 구별)')).toBe('기차');
  });
  it('NFC로 비교 · 출력한다(분해형 한글 입력도 같은 결과)', () => {
    expect(choiceMeaning('진짜·레알 (「マジで?」=실화냐?)'.normalize('NFD'))).toBe('진짜·레알');
  });
  it('일반 뜻 정리(stripSourceLangInMeaning)는 그대로 — 단어장 표시는 용례를 보존한다', () => {
    expect(stripSourceLangInMeaning(MAJI.meaning)).toBe(MAJI.meaning);
  });
});

describe('규칙 ② choiceLabels · choiceSet — ①로도 남은 문제 낱말(한글 낱말 등)은 네 보기 모두에서 괄호를 뺀다', () => {
  it('한 보기 괄호에 낱말이 있으면 전부에서 괄호를 뺀다(한쪽만 다르지 않게)', () => {
    expect(choiceLabels(['분위기 파악 (눈치가 빠르다)', '밥 (식사)', '학교', '역'], '눈치')).toEqual(['분위기 파악', '밥', '학교', '역']);
  });
  it('낱말이 없으면 그대로', () => {
    expect(choiceLabels(['달리다 (과거형)', '학교 (초등)', '역'], 'はしった')).toEqual(['달리다 (과거형)', '학교 (초등)', '역']);
  });
  it('괄호를 빼서 보기가 겹쳐 오답이 둘 미만이면 문항이 성립하지 않는다(null)', () => {
    expect(choiceSet('눈 (눈치)', ['눈', '역'], '눈치')).toBeNull();
    expect(choiceSet('진짜·레알', ['역', '학교', '전철'], 'マジ／マジで')).toEqual({ correct: '진짜·레알', options: ['진짜·레알', '역', '학교', '전철'] });
  });
});

describe('/study 문항에 배선 — 정답 · 보기 · 채점 기준이 같은 값', () => {
  const noLeak = (item) => {
    expect(item.options).toContain(item.word.meaning); // 채점은 opt === item.word.meaning
    for (const opt of item.options) {
      expect(opt).not.toMatch(SOURCE);
      expect(opt).not.toContain('マジ');
    }
  };
  it('만남 문항(buildEncounterItems)', () => {
    const [item] = buildEncounterItems([MAJI], POOL, 'normal', 0);
    expect(item.word.meaning).toBe('진짜·레알');
    noLeak(item);
  });
  it('몸풀기(buildWarmupItems — 레벨 사전 폴백)', () => {
    const items = buildWarmupItems([], [], POOL, new Set(), [MAJI]);
    expect(items).toHaveLength(1);
    noLeak(items[0]);
  });
  it('어휘 문항(composeSession — 뜻 고르기 · 짝 맞추기)', () => {
    const vocab = [{ id: 'a', ...MAJI }, { id: 'b', word_text: '駅', meaning: '역' }, { id: 'c', word_text: '学校', meaning: '학교' }, { id: 'd', word_text: '電車', meaning: '전철' }];
    const { items } = composeSession({ vocab, meaningPool: POOL });
    const match = items.find(it => it.type === 'vocab-match');
    expect(match.words.map(w => w.meaning)).toContain('진짜·레알');
    for (const w of match.words) expect(w.meaning).not.toMatch(SOURCE);
    // 넷이 안 되면 낱개 뜻 고르기(rung 1 = 인지)
    const single = composeSession({ vocab: vocab.slice(0, 1), meaningPool: POOL, vocabRungs: { 'マジ／マジで': 1 } }).items.find(it => it.word?.word_text === 'マジ／マジで');
    expect(single.type).toBe('vocab-choice');
    noLeak(single);
  });
  it('문단 문항 · 집중 연습(맥락) 보기도 같은 규칙을 쓴다', () => {
    const paragraph = read('src/lib/studyParagraph.js');
    expect(paragraph).toContain("import { choiceMeaning, choiceSet } from './meaningClean';");
    expect(paragraph).toContain('const set = choiceSet(cleanAnswer, cleanDistractors, q.key || q.prompt)');
    const vocabPage = read('src/views/VocabPage.jsx');
    expect(vocabPage).toContain('const labels = choiceLabels(shuffled.map(v => choiceMeaning(v.meaning)), activeWord.word_text);');
    // 보기를 만드는 자리에 일반 정리(stripSourceLangInMeaning)가 남지 않는다.
    expect(read('src/lib/studySession.js').match(/stripSourceLangInMeaning\(/g)).toBeNull();
  });
});
