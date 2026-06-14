/**
 * 중국어 중추 레퍼런스 레지스트리
 * 문법(grammar/<level>.js) + 어휘(vocab/<level>.js)를 OT→H6(HSK 1~6급) 학습 순서로 묶음.
 * 콘텐츠는 코드가 단일 소스 — 형식은 SCHEMA.md 참고.
 */
import { createRegistry } from '../refRegistry';

import grammarOT from './grammar/ot';
import grammarH1 from './grammar/h1';
import grammarH2 from './grammar/h2';
import grammarH3 from './grammar/h3';
import grammarH4 from './grammar/h4';
import grammarH5 from './grammar/h5';
import grammarH6 from './grammar/h6';

import vocabH1 from './vocab/h1';
import vocabH2 from './vocab/h2';
import vocabH3 from './vocab/h3';
import vocabH4 from './vocab/h4';
import vocabH5 from './vocab/h5';
import vocabH6 from './vocab/h6';

import bunkeiH1 from './bunkei/h1';
import bunkeiH2 from './bunkei/h2';
import bunkeiH3 from './bunkei/h3';
import bunkeiH4 from './bunkei/h4';
import bunkeiH5 from './bunkei/h5';
import bunkeiH6 from './bunkei/h6';

/** 레벨 메타 — 학습 순서대로. key는 ASCII(OT/H1~H6), 화면 표기는 short(OT/1급~6급) */
export const ZH_LEVEL_META = [
  {
    key: 'OT', short: 'OT', label: 'OT 오리엔테이션', focus: '시작 전 워밍업',
    desc: '한어병음·성조·간체자·기본 어순 — 본격 학습 전에 알아야 할 중국어의 작동 원리.',
    color: '#868E96', bg: 'rgba(134,142,150,0.12)', line: 'rgba(134,142,150,0.35)',
  },
  {
    key: 'H1', short: '1급', label: '1급 기초', focus: '첫 문장 만들기',
    desc: '是·有와 기본 어순, 这/那와 양사, 의문사 — 자기소개와 일상 표현의 뼈대.',
    color: '#4C6EF5', bg: 'rgba(76,110,245,0.12)', line: 'rgba(76,110,245,0.35)',
  },
  {
    key: 'H2', short: '2급', label: '2급 초급', focus: '시간과 경험',
    desc: '了·过·在, 비교 比, 능원동사 — 했고·하는 중이고·할 수 있다를 말하기.',
    color: '#7048E8', bg: 'rgba(112,72,232,0.12)', line: 'rgba(112,72,232,0.35)',
  },
  {
    key: 'H3', short: '3급', label: '3급 중급', focus: '연결과 확장',
    desc: '把·被구문, 결과·방향·정도 보어, 복문 연결사 — 문장을 길게 엮기.',
    color: '#AE3EC9', bg: 'rgba(174,62,201,0.12)', line: 'rgba(174,62,201,0.35)',
  },
  {
    key: 'H4', short: '4급', label: '4급 상급', focus: '뉘앙스의 시작',
    desc: '복잡한 보어·가정/양보·관용 구문 — 논리적으로 주장하고 연결하기.',
    color: '#D6336C', bg: 'rgba(214,51,108,0.12)', line: 'rgba(214,51,108,0.35)',
  },
  {
    key: 'H5', short: '5급', label: '5급 고급', focus: '문어와 격식',
    desc: '서면어·성어 입문·고급 연결사 — 신문과 글을 읽고 쓰는 눈.',
    color: '#E03131', bg: 'rgba(224,49,49,0.12)', line: 'rgba(224,49,49,0.35)',
  },
  {
    key: 'H6', short: '6급', label: '6급 마스터', focus: '원어민의 영역',
    desc: '고급 성어·수사법·문체 변이 — 언어 너머의 문화까지.',
    color: '#A02840', bg: 'rgba(160,40,64,0.12)', line: 'rgba(160,40,64,0.35)',
  },
];

const registry = createRegistry(
  ZH_LEVEL_META,
  { OT: grammarOT, H1: grammarH1, H2: grammarH2, H3: grammarH3, H4: grammarH4, H5: grammarH5, H6: grammarH6 },
  { H1: vocabH1, H2: vocabH2, H3: vocabH3, H4: vocabH4, H5: vocabH5, H6: vocabH6 },
);

export const ALL_CHAPTERS = registry.ALL_CHAPTERS;
export const getLevelMeta = registry.getLevelMeta;
export const getGrammarChapters = registry.getGrammarChapters;
export const getChapter = registry.getChapter;
export const getVocab = registry.getVocab;
export const countVocab = registry.countVocab;

/** 문형 사전 — 챕터(이해)와 별개의 전수 커버 레이어 (SCHEMA.md 참고) */
const BUNKEI = { H1: bunkeiH1, H2: bunkeiH2, H3: bunkeiH3, H4: bunkeiH4, H5: bunkeiH5, H6: bunkeiH6 };

export function getBunkei(levelKey) {
  return BUNKEI[String(levelKey || '').toUpperCase()] || null;
}

export function countBunkei(levelKey) {
  const b = getBunkei(levelKey);
  if (!b) return 0;
  return b.themes.reduce((sum, t) => sum + t.items.length, 0);
}

// default export(레지스트리)에도 문형 사전 API 포함 — refLangs가 default를 펼쳐 쓰므로 필수
export default { ...registry, getBunkei, countBunkei };
