/**
 * 프랑스어 중추 레퍼런스 레지스트리
 * 문법(grammar/<level>.js) + 어휘(vocab/<level>.js)를 A0→C2 학습 순서로 묶음.
 * 콘텐츠는 코드가 단일 소스 — 형식은 SCHEMA.md 참고.
 */
import { createRegistry } from '../refRegistry';

import grammarA0 from './grammar/a0';
import grammarA1 from './grammar/a1';
import grammarA1Expansion from './grammar/a1_expansion';
import grammarA1Pronunciation from './grammar/a1_pronunciation';
import grammarA1SandwichPilot from './grammar/a1_sandwich_pilot';
import grammarA2 from './grammar/a2';
import grammarB1 from './grammar/b1';
import grammarB2 from './grammar/b2';
import grammarC1 from './grammar/c1';
import grammarC2 from './grammar/c2';
import grammarSceneEmergency from './grammar/scene_emergency';
import grammarSceneTravel from './grammar/scene_travel';

import vocabA0 from './vocab/a0';
import vocabA1 from './vocab/a1';
import vocabA2 from './vocab/a2';
import vocabB1 from './vocab/b1';
import vocabB2 from './vocab/b2';
import vocabC1 from './vocab/c1';
import vocabC2 from './vocab/c2';

// FLELex(루뱅대 CEFR 등급 어휘 자원) 기반 보강 — 빈도 상위 어휘를 본편과 자연스럽게 병합
import flelexA1 from './vocab/a1_flelex';
import flelexA2 from './vocab/a2_flelex';
import flelexB1 from './vocab/b1_flelex';
import flelexB2 from './vocab/b2_flelex';
// 2차 보강 — FLELex 등급을 실제 빈도로 보정(일상어 B1·B2 내림) + C1·C2 채우기
import flelexB1r from './vocab/b1_flelex2';
import flelexB2r from './vocab/b2_flelex2';
import flelexC1 from './vocab/c1_flelex';
import flelexC2 from './vocab/c2_flelex';

// 표제어 정규화(관사·괄호 제거) — 보강 어휘가 본편과 겹치면 버림
const _frArt = /^(l'|d'|s'|le |la |les |un |une |des |du |de la |de l'|de |au |aux |à |se |s')+/i;
function _normFr(s) {
  s = String(s || '').trim().toLowerCase().replace(/’/g, "'").replace(/\([^)]*\)/g, ' ');
  let p = s.split(/[/,]| ou /)[0].trim(), prev;
  do { prev = p; p = p.replace(_frArt, '').trim(); } while (p !== prev);
  return p.replace(/[.!?…»«"]/g, '').trim();
}
/** 본편 어휘에 보강 테마(FLELex)들을 병합. 같은 이름 테마는 합치고, 새 이름은 뒤에 추가. */
function mergeFrVocab(base, ...addLists) {
  const themes = base.themes.map((t) => ({ ...t, words: [...t.words] }));
  const byName = new Map(themes.map((t) => [t.name.trim(), t]));
  const seen = new Set();
  for (const t of themes) for (const w of t.words) seen.add(_normFr(w.fr));
  for (const additions of addLists) {
    if (!additions || !additions.length) continue;
    for (const add of additions) {
      for (const w of add.words) {
        const k = _normFr(w.fr);
        if (seen.has(k)) continue;
        seen.add(k);
        let t = byName.get(add.name.trim());
        if (!t) { t = { name: add.name, icon: add.icon, words: [] }; themes.push(t); byName.set(add.name.trim(), t); }
        t.words.push(w);
      }
    }
  }
  return { ...base, themes };
}

import bunkeiA1 from './bunkei/a1';
import bunkeiA2 from './bunkei/a2';
import bunkeiB1 from './bunkei/b1';
import bunkeiB2 from './bunkei/b2';
import bunkeiC1 from './bunkei/c1';
import bunkeiC2 from './bunkei/c2';

/** 레벨 메타 — 학습 순서대로. 색은 입문(파랑)→마스터(자주) 그라데이션 */
export const FR_LEVEL_META = [
  {
    key: 'A0', short: 'OT', label: 'OT 오리엔테이션', focus: '시작 전 워밍업',
    desc: '알파벳·발음·명사의 성·관사 — 본격 학습 전에 알아야 할 프랑스어의 작동 원리.',
    color: '#868E96', bg: 'rgba(134,142,150,0.12)', line: 'rgba(134,142,150,0.35)',
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
  { A0: grammarA0, A1: [...grammarA1, ...grammarA1Expansion, ...grammarA1Pronunciation, ...grammarSceneEmergency, ...grammarSceneTravel.filter(ch => ch.level === 'A1'), ...grammarA1SandwichPilot], A2: grammarA2, B1: grammarB1, B2: grammarB2, C1: grammarC1, C2: grammarC2 },
  {
    A0: vocabA0,
    A1: mergeFrVocab(vocabA1, flelexA1),
    A2: mergeFrVocab(vocabA2, flelexA2),
    B1: mergeFrVocab(vocabB1, flelexB1, flelexB1r),
    B2: mergeFrVocab(vocabB2, flelexB2, flelexB2r),
    C1: mergeFrVocab(vocabC1, flelexC1),
    C2: mergeFrVocab(vocabC2, flelexC2),
  },
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
