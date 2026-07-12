/**
 * 영어 중추 레퍼런스 레지스트리 — A1→C2 학습 순서.
 * 형식은 SCHEMA.md 참고. '아는데 안 되는' 한국 학습자의 운용 격차를 축으로 설계.
 */
import { createRegistry } from '../refRegistry';

import grammarOT from './grammar/ot';
import grammarA1 from './grammar/a1';
import grammarA2 from './grammar/a2';
import grammarB1 from './grammar/b1';
import grammarB2 from './grammar/b2';
import grammarC1 from './grammar/c1';
import grammarC2 from './grammar/c2';

import vocabA1 from './vocab/a1';
import vocabA2 from './vocab/a2';
import vocabB1 from './vocab/b1';
import vocabB2 from './vocab/b2';
import vocabC1 from './vocab/c1';
import vocabC2 from './vocab/c2';

import bunkeiA1 from './bunkei/a1';
import bunkeiA2 from './bunkei/a2';
import bunkeiB1 from './bunkei/b1';
import bunkeiB2 from './bunkei/b2';
import bunkeiC1 from './bunkei/c1';
import bunkeiC2 from './bunkei/c2';

/** 레벨 메타 — 틸 그라데이션 (기초 밝음 → 마스터 깊음) */
export const EN_LEVEL_META = [
  {
    key: 'OT', label: 'OT 오리엔테이션', focus: '시작 전 워밍업',
    desc: '이미 아는 영어·알파벳·파닉스·강세 — 진짜 처음부터, 즐겁게.',
    color: '#868E96', bg: 'rgba(134,142,150,0.12)', line: 'rgba(134,142,150,0.35)',
  },
  {
    key: 'A1', label: 'A1 기초', focus: '생존 영어',
    desc: 'be동사·SVO 어순·관사 — 한국어와 정면충돌하는 지점부터 정리.',
    color: '#3BC9DB', bg: 'rgba(59,201,219,0.12)', line: 'rgba(59,201,219,0.35)',
  },
  {
    key: 'A2', label: 'A2 초급', focus: '단순 소통',
    desc: '과거·미래·현재완료 입문 — 시제의 기초 체력 만들기.',
    color: '#22B8CF', bg: 'rgba(34,184,207,0.12)', line: 'rgba(34,184,207,0.35)',
  },
  {
    key: 'B1', label: 'B1 중급', focus: '일상 회화',
    desc: '현재완료 정복·가정문·관계대명사 — 중급의 관문 돌파.',
    color: '#15AABF', bg: 'rgba(21,170,191,0.12)', line: 'rgba(21,170,191,0.35)',
  },
  {
    key: 'B2', label: 'B2 상급', focus: '전문적 소통',
    desc: '가정문 3형·관사 심화·논리 연결어 — 글과 말의 격 올리기.',
    color: '#1098AD', bg: 'rgba(16,152,173,0.12)', line: 'rgba(16,152,173,0.35)',
  },
  {
    key: 'C1', label: 'C1 고급', focus: '유창한 구사',
    desc: '헤징·레지스터·정보구조 — 뉘앙스를 다루는 기술.',
    color: '#0C8599', bg: 'rgba(12,133,153,0.12)', line: 'rgba(12,133,153,0.35)',
  },
  {
    key: 'C2', label: 'C2 마스터', focus: '원어민 수준',
    desc: '수사·영어의 변이·문화 코드 — 언어 너머까지.',
    color: '#0B7285', bg: 'rgba(11,114,133,0.12)', line: 'rgba(11,114,133,0.35)',
  },
];

const registry = createRegistry(
  EN_LEVEL_META,
  { OT: grammarOT, A1: grammarA1, A2: grammarA2, B1: grammarB1, B2: grammarB2, C1: grammarC1, C2: grammarC2 },
  { A1: vocabA1, A2: vocabA2, B1: vocabB1, B2: vocabB2, C1: vocabC1, C2: vocabC2 },
);

export const ALL_CHAPTERS = registry.ALL_CHAPTERS;
export const getLevelMeta = registry.getLevelMeta;
export const getGrammarChapters = registry.getGrammarChapters;
export const getChapter = registry.getChapter;
export const getVocab = registry.getVocab;
export const countVocab = registry.countVocab;

/** 문형 사전 — 챕터(이해)와 별개의 전수 커버 레이어 (SCHEMA.md 참고) */
const BUNKEI = { A1: bunkeiA1, A2: bunkeiA2, B1: bunkeiB1, B2: bunkeiB2, C1: bunkeiC1, C2: bunkeiC2 };

export function getBunkei(levelKey) {
  return BUNKEI[String(levelKey || '').toUpperCase()] || null;
}

export function countBunkei(levelKey) {
  const b = getBunkei(levelKey);
  if (!b) return 0;
  return b.themes.reduce((sum, t) => sum + t.items.length, 0);
}

// default export(레지스트리)에도 문형 사전 API 포함 — refLangs가 default를 펼쳐 쓰므로 필수
const api = { ...registry, getBunkei, countBunkei };

export default api;
