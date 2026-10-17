// 보기가 문제 낱말을 드러내지 않는다(STUDY-CHOICE-LEAK-001, 2026-10-17 KST).
// 합성 로그인 점검에서 /study 몸풀기 「マジ／マジで」의 정답 보기가 「진짜·레알 (「マジで?」=실화냐?)」였다 — 정본 뜻(slang_core)의
// 괄호 용례가 문제 낱말을 그대로 보였다. 규칙은 meaningClean.js(choiceMeaning · choiceLabels · choiceSet)가 정본이다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { choiceLabels, choiceMeaning, choiceSet, headClause, stripSourceLangInMeaning } from '../meaningClean';
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

describe('규칙 ①의 원어 = 문제 낱말의 글자 체계(데이터 감사 2026-10-17 KST)', () => {
  it('중국어 · 일본어 낱말: 한국어 설명 속 단위 · 약어 · 가운뎃점(・)은 원어가 아니라 남긴다', () => {
    expect(choiceMeaning('근(무게 단위, 500g)', '斤')).toBe('근(무게 단위, 500g)');
    expect(choiceMeaning('웨이보(중국 대표 SNS)', '微博')).toBe('웨이보(중국 대표 SNS)');
    expect(choiceMeaning('보양하다, (건강・기계를) 관리하다', '保养')).toBe('보양하다, (건강・기계를) 관리하다');
    expect(choiceMeaning(MAJI.meaning, MAJI.word_text)).toBe('진짜·레알'); // 가나 용례는 여전히 뺀다
  });
  it('영어 · 프랑스어 낱말: 라틴 용례를 뺀다', () => {
    expect(choiceMeaning('배고픔 (avoir faim 배고프다)', 'la faim')).toBe('배고픔');
  });
  it('괄호를 뺀 뒤 끝에 남는 구분 부호는 지운다', () => {
    expect(choiceMeaning('내일; (あす로도 읽으며 좀 더 격식)', '明日')).toBe('내일');
  });
  it('같은 문항의 오답 풀도 같은 낱말로 정리한다(배선)', () => {
    const src = read('src/lib/studySession.js');
    expect(src.match(/map\(m => choiceMeaning\(m, (w\.word_text|w\?\.word_text|row\.word_text)\)\)/g)).toHaveLength(3);
    expect(src).not.toContain('map(choiceMeaning)');
  });
});

describe('앞 절 · 겹친 괄호 · 꼬리 괄호(데이터 감사 2026-10-17 KST — 괄호 밖 누출 99건 · 짝 안 맞는 괄호 108건)', () => {
  it('괄호 밖 해설(「 — 」 · 한글 문장 끝 뒤)은 뺀다 — 문화 · 속어 뜻풀이가 문제 낱말을 해설 안에 담고 있었다', () => {
    expect(choiceMeaning('성격. 혈액형·MBTI 토크의 핵심 키워드. 「性格いい」=성격 좋다', '性格')).toBe('성격');
    expect(choiceMeaning('공부 — べんきょうする 공부하다', 'べんきょう')).toBe('공부');
    expect(choiceMeaning('U.S. 달러', 'dollar')).toBe('U.S. 달러'); // 약어 점은 문장 끝이 아니다
  });
  it('[ ] 괄호도 같은 규칙, 겹친 괄호는 안쪽부터', () => {
    expect(choiceMeaning('~해 버리다 [てしまう→ちゃう / でしまう→じゃう] (완료 뉘앙스)', '〜ちゃう／〜じゃう')).toBe('~해 버리다 (완료 뉘앙스)');
    expect(choiceMeaning("닭도리탕 (국립국어원은 '도리'를 일본어 とり(鳥·새·닭)로 보고 '도리다(도려내다)'설도)", 'とり')).toBe('닭도리탕');
  });
  it('뺄 괄호라도 「 — 」 앞이 한글 설명뿐이면 그 앞만 남긴다 — 뜻을 가르는 설명은 지킨다(こんにちは · こんばんは)', () => {
    expect(choiceMeaning('안녕하세요 (낮 인사 — 원래 「今日は(오늘은)…」의 앞만 남은 인사)', 'こんにちは')).toBe('안녕하세요 (낮 인사)');
    expect(choiceMeaning('안녕하세요 (저녁 인사 — 「今晩は(오늘 밤은)…」의 화석)', 'こんばんは')).toBe('안녕하세요 (저녁 인사)');
    expect(choiceMeaning('물 (찬물 — 식당에서는 お水)', '水')).toBe('물 (찬물)');
  });
  it('만남 후보의 앞 절은 괄호 밖 「 — 」에서만 자른다(headClause)', () => {
    expect(headClause('아버지 (남에게 자기 아버지를 말할 때 — 부를 때는 お父さん) — 덧붙임')).toBe('아버지 (남에게 자기 아버지를 말할 때 — 부를 때는 お父さん) ');
    expect(read('src/lib/studyMaterials.js')).toContain("const meaning = headClause(w?.ko || '').trim();");
  });
  it('짝 안 맞는 꼬리 괄호(만남 문항의 「 — 」 절단)는 뺀다', () => {
    expect(choiceMeaning('아버지 (남에게 자기 아버지를 말할 때', '父')).toBe('아버지');
  });
  it('앞 절에 한글 뜻이 없으면 자르지 않는다(약어 · 원어만 남는 것 방지)', () => {
    expect(choiceMeaning('TKG — 갓 지은 밥에 날달걀과 간장을 비벼 먹는 국민 소울푸드', 'たまごかけごはん')).toBe('TKG — 갓 지은 밥에 날달걀과 간장을 비벼 먹는 국민 소울푸드');
    expect(choiceMeaning('ㅋㅋ [笑→w→www] (채팅 웃음', 'w／ｗｗｗ')).toBe('ㅋㅋ');
  });
});

describe('규칙 ② choiceLabels · choiceSet — ①로도 남은 문제 낱말(한글 낱말 등)은 네 보기 모두에서 괄호를 뺀다', () => {
  it('앞 절 자체에 낱말이 있으면(「텔레비전, TV」 — 데이터 과제) 더 뺄 수 없어도 다른 보기 괄호는 모두 뺀다', () => {
    expect(choiceLabels(['텔레비전, TV', '라디오 (방송)', '역'], 'TV')).toEqual(['텔레비전, TV', '라디오', '역']);
  });
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
  it('답한 뒤에는 뜻 전문을 보여 준다 — 문항에 meaningFull을 싣고, 보기와 다를 때만 피드백 줄로(화면 검수 2026-10-17 KST)', () => {
    const [enc] = buildEncounterItems([{ ...MAJI, meaningFull: MAJI.meaning }], POOL, 'normal', 0);
    expect(enc.word.meaningFull).toBe(MAJI.meaning);
    expect(buildWarmupItems([], [], POOL, new Set(), [MAJI])[0].word.meaningFull).toBe(MAJI.meaning);
    const single = composeSession({ vocab: [{ id: 'a', ...MAJI }], meaningPool: POOL, vocabRungs: { 'マジ／マジで': 1 } }).items.find(it => it.word?.word_text === 'マジ／マジで');
    expect(single.word.meaningFull).toBe(MAJI.meaning);
    expect(single.word.meaning).toBe('진짜·레알');
    const page = read('src/views/StudySessionPage.jsx');
    const block = sliceBetween(page, "{item.type === 'vocab-choice' && (", '{/* ── 어휘: 단서회상');
    expect(block).toContain("{phase === 'feedback' && item.word.meaningFull && item.word.meaningFull !== item.word.meaning && (");
    expect(block).toContain('<div className="fr-quiz__answer">{item.word.meaningFull}</div>');
    expect(read('src/lib/studyParagraph.js')).toContain('meaning: answer, meaningFull: q.answer');
  });
  it('문단 문항 · 집중 연습(맥락) 보기도 같은 규칙을 쓴다', () => {
    const paragraph = read('src/lib/studyParagraph.js');
    expect(paragraph).toContain("import { choiceMeaning, choiceSet } from './meaningClean';");
    expect(paragraph).toContain('const set = choiceSet(cleanAnswer, cleanDistractors, q.key || q.prompt)');
    const vocabPage = read('src/views/VocabPage.jsx');
    expect(vocabPage).toContain('const labels = choiceLabels(shuffled.map(v => choiceMeaning(v.meaning, activeWord.word_text)), activeWord.word_text);');
    // 보기를 만드는 자리에 일반 정리(stripSourceLangInMeaning)가 남지 않는다.
    expect(read('src/lib/studySession.js').match(/stripSourceLangInMeaning\(/g)).toBeNull();
  });
});
