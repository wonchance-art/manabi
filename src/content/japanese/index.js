/**
 * 일본어 중추 레퍼런스 레지스트리 — N5→N1 학습 순서.
 * 형식은 SCHEMA.md 참고. 한국어 화자의 3대 자산(어순·조사·한자어)을 축으로 설계.
 */
import { createRegistry } from '../refRegistry';

import grammarOT from './grammar/ot';
import grammarN5 from './grammar/n5';
import grammarN4 from './grammar/n4';
import grammarN3 from './grammar/n3';
import grammarN2 from './grammar/n2';
import grammarN1 from './grammar/n1';

import vocabN5 from './vocab/n5';
import vocabN4 from './vocab/n4';
import vocabN3 from './vocab/n3';
import vocabN2 from './vocab/n2';
import vocabN1 from './vocab/n1';

import bunkeiN5 from './bunkei/n5';
import bunkeiN4 from './bunkei/n4';
import bunkeiN3 from './bunkei/n3';
import bunkeiN2 from './bunkei/n2';
import bunkeiN1 from './bunkei/n1';

/** 레벨 메타 — 가이드 로드맵과 같은 웜 그라데이션 */
export const JA_LEVEL_META = [
  {
    key: 'OT', label: 'OT 오리엔테이션', focus: '시작 전 워밍업',
    desc: '이미 아는 일본어·문자 체계·발음·한자 읽기 — 본격 학습 전 즐거운 워밍업.',
    color: '#868E96', bg: 'rgba(134,142,150,0.12)', line: 'rgba(134,142,150,0.35)',
  },
  {
    key: 'N5', label: 'N5 기초', focus: '기초 입문',
    desc: 'です/だ와 조사 は/が부터 — 본격 문법·어휘의 시작.',
    color: '#F5C34A', bg: 'rgba(245,195,74,0.12)', line: 'rgba(245,195,74,0.35)',
  },
  {
    key: 'N4', label: 'N4 기본', focus: '일상 회화',
    desc: '보통형·수수동사·조건·수동 — 일상 대화의 뼈대 완성.',
    color: '#F0A040', bg: 'rgba(240,160,64,0.12)', line: 'rgba(240,160,64,0.35)',
  },
  {
    key: 'N3', label: 'N3 중급', focus: '가교 단계',
    desc: '경어 입문·추량·복합 조사 — 자연스러운 일본어로 가는 다리.',
    color: '#E8763C', bg: 'rgba(232,118,60,0.12)', line: 'rgba(232,118,60,0.35)',
  },
  {
    key: 'N2', label: 'N2 상급', focus: '사회·직업적 언어',
    desc: '비즈니스 경어·문어체·유사 문형 정밀 구별 — 신문이 열린다.',
    color: '#D85840', bg: 'rgba(216,88,64,0.12)', line: 'rgba(216,88,64,0.35)',
  },
  {
    key: 'N1', label: 'N1 심화', focus: '원어민 수준',
    desc: '문어 문법·고전의 흔적·관용구 — 그리고 한일 번역의 미학.',
    color: '#C03C42', bg: 'rgba(192,60,66,0.12)', line: 'rgba(192,60,66,0.35)',
  },
];

const registry = createRegistry(
  JA_LEVEL_META,
  { OT: grammarOT, N5: grammarN5, N4: grammarN4, N3: grammarN3, N2: grammarN2, N1: grammarN1 },
  { N5: vocabN5, N4: vocabN4, N3: vocabN3, N2: vocabN2, N1: vocabN1 },
);

export const ALL_CHAPTERS = registry.ALL_CHAPTERS;
export const getLevelMeta = registry.getLevelMeta;
export const getGrammarChapters = registry.getGrammarChapters;
export const getChapter = registry.getChapter;
export const getVocab = registry.getVocab;
export const countVocab = registry.countVocab;

/** JLPT 문형 사전 — 챕터(이해)와 별개의 전수 커버 레이어 (SCHEMA.md 참고) */
const BUNKEI = { N5: bunkeiN5, N4: bunkeiN4, N3: bunkeiN3, N2: bunkeiN2, N1: bunkeiN1 };

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
