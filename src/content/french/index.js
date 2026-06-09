/**
 * 프랑스어 중추 레퍼런스 레지스트리
 * 문법(grammar/<level>.js) + 어휘(vocab/<level>.js)를 A0→C2 학습 순서로 묶음.
 * 콘텐츠는 코드가 단일 소스 — 형식은 SCHEMA.md 참고.
 */
import { createRegistry } from '../refRegistry';

import grammarA0 from './grammar/a0';
import grammarA1 from './grammar/a1';
import grammarA2 from './grammar/a2';
import grammarB1 from './grammar/b1';
import grammarB2 from './grammar/b2';
import grammarC1 from './grammar/c1';
import grammarC2 from './grammar/c2';

import vocabA0 from './vocab/a0';
import vocabA1 from './vocab/a1';
import vocabA2 from './vocab/a2';
import vocabB1 from './vocab/b1';
import vocabB2 from './vocab/b2';
import vocabC1 from './vocab/c1';
import vocabC2 from './vocab/c2';

/** 레벨 메타 — 학습 순서대로. 색은 입문(파랑)→마스터(자주) 그라데이션 */
export const FR_LEVEL_META = [
  {
    key: 'A0', label: 'A0 입문', focus: '프랑스어 기초 상식',
    desc: '알파벳·발음·명사의 성·관사 — 본격 학습 전에 알아야 할 프랑스어의 작동 원리.',
    color: '#4DABF7', bg: 'rgba(77,171,247,0.12)', line: 'rgba(77,171,247,0.35)',
  },
  {
    key: 'A1', label: 'A1 기초', focus: '첫 문장 만들기',
    desc: 'être·avoir와 현재형, 부정문과 의문문 — 자기소개와 일상 표현의 뼈대.',
    color: '#4C6EF5', bg: 'rgba(76,110,245,0.12)', line: 'rgba(76,110,245,0.35)',
  },
  {
    key: 'A2', label: 'A2 초급', focus: '과거와 미래로 확장',
    desc: 'passé composé·imparfait·futur, 목적어 대명사 — 경험과 계획을 말하기.',
    color: '#7048E8', bg: 'rgba(112,72,232,0.12)', line: 'rgba(112,72,232,0.35)',
  },
  {
    key: 'B1', label: 'B1 중급', focus: '뉘앙스의 시작',
    desc: '조건법·접속법 입문, 관계대명사 심화 — 가정하고, 바라고, 연결하기.',
    color: '#AE3EC9', bg: 'rgba(174,62,201,0.12)', line: 'rgba(174,62,201,0.35)',
  },
  {
    key: 'B2', label: 'B2 상급', focus: '논리적인 프랑스어',
    desc: '접속법 심화·가정문·논리 연결사 — 주장하고 반박하는 글과 말.',
    color: '#D6336C', bg: 'rgba(214,51,108,0.12)', line: 'rgba(214,51,108,0.35)',
  },
  {
    key: 'C1', label: 'C1 고급', focus: '문어와 격식의 세계',
    desc: '단순과거·레지스터·논증 구조 — 신문과 문학을 읽는 눈.',
    color: '#E03131', bg: 'rgba(224,49,49,0.12)', line: 'rgba(224,49,49,0.35)',
  },
  {
    key: 'C2', label: 'C2 마스터', focus: '원어민의 영역',
    desc: '문학 시제·수사법·프랑스어권 변이 — 언어 너머의 문화까지.',
    color: '#A02840', bg: 'rgba(160,40,64,0.12)', line: 'rgba(160,40,64,0.35)',
  },
];

const registry = createRegistry(
  FR_LEVEL_META,
  { A0: grammarA0, A1: grammarA1, A2: grammarA2, B1: grammarB1, B2: grammarB2, C1: grammarC1, C2: grammarC2 },
  { A0: vocabA0, A1: vocabA1, A2: vocabA2, B1: vocabB1, B2: vocabB2, C1: vocabC1, C2: vocabC2 },
);

export const ALL_CHAPTERS = registry.ALL_CHAPTERS;
export const getLevelMeta = registry.getLevelMeta;
export const getGrammarChapters = registry.getGrammarChapters;
export const getChapter = registry.getChapter;
export const getVocab = registry.getVocab;
export const countVocab = registry.countVocab;
export default registry;
