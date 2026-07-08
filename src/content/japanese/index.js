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

// JLPT 표준 커버리지 보강(W1: N5+N4) — 표제어 kana·급·품사(kuromoji)는 결정적, 뜻·예문만 생성.
import vocabN5jlptA from './vocab/n5_jlpt_a';
import vocabN5jlptB from './vocab/n5_jlpt_b';
import vocabN5jlptC from './vocab/n5_jlpt_c';
import vocabN4jlptA from './vocab/n4_jlpt_a';
import vocabN4jlptB from './vocab/n4_jlpt_b';
import vocabN4jlptC from './vocab/n4_jlpt_c';
import vocabN3jlptA from './vocab/n3_jlpt_a';
import vocabN3jlptB from './vocab/n3_jlpt_b';
import vocabN3jlptC from './vocab/n3_jlpt_c';
import vocabN3jlptD from './vocab/n3_jlpt_d';
import vocabN3jlptE from './vocab/n3_jlpt_e';
import vocabN3jlptF from './vocab/n3_jlpt_f';
import vocabN3jlptG from './vocab/n3_jlpt_g';
import vocabN3jlptH from './vocab/n3_jlpt_h';
import vocabN3jlptI from './vocab/n3_jlpt_i';
import vocabN3jlptJ from './vocab/n3_jlpt_j';
import vocabN2jlptA from './vocab/n2_jlpt_a';
import vocabN2jlptB from './vocab/n2_jlpt_b';
import vocabN2jlptC from './vocab/n2_jlpt_c';
import vocabN2jlptD from './vocab/n2_jlpt_d';
import vocabN2jlptE from './vocab/n2_jlpt_e';
import vocabN2jlptF from './vocab/n2_jlpt_f';
import vocabN2jlptG from './vocab/n2_jlpt_g';
import vocabN2jlptH from './vocab/n2_jlpt_h';
import vocabN2jlptI from './vocab/n2_jlpt_i';

// 표제어 정규화 — 접미 마커(～〜~)·공백 제거, 복수 표기(;／、)는 첫 형태 기준. 급 내 dedup 키.
function _normJa(ja) {
  let s = String(ja || '').trim();
  s = s.split(/[;；／、]/)[0].trim(); // 복수 표기는 첫 형태만
  return s.replace(/[～〜~]/g, '').replace(/\s+/g, ''); // 접미 마커·공백 제거
}
// 보강 리스트를 테마 배열로 정규화 — 배열(FR식) 또는 { themes }(ZH식) 모두 허용
const _jaThemes = (add) => (Array.isArray(add) ? add : (add && add.themes) || []);
/** 손작성 테마(base)에 보강 테마들을 병합. 같은 이름 테마는 합치고, 새 이름은 뒤에 추가. ja 기준 급 내 dedup. */
function mergeJaVocab(base, ...addLists) {
  const themes = base.themes.map((t) => ({ ...t, words: [...t.words] }));
  const byName = new Map(themes.map((t) => [t.name.trim(), t]));
  const seen = new Set();
  for (const t of themes) for (const w of t.words) seen.add(_normJa(w.ja));
  for (const additions of addLists) {
    for (const add of _jaThemes(additions)) {
      for (const w of add.words || []) {
        const k = _normJa(w.ja);
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
  {
    // W1 보강: vocabN5jlptA… 조립 후 mergeJaVocab(vocabN5, vocabN5jlptA, …) 형태로 여기 추가
    N5: mergeJaVocab(vocabN5, vocabN5jlptA, vocabN5jlptB, vocabN5jlptC),
    N4: mergeJaVocab(vocabN4, vocabN4jlptA, vocabN4jlptB, vocabN4jlptC),
    N3: mergeJaVocab(vocabN3, vocabN3jlptA, vocabN3jlptB, vocabN3jlptC, vocabN3jlptD, vocabN3jlptE, vocabN3jlptF, vocabN3jlptG, vocabN3jlptH, vocabN3jlptI, vocabN3jlptJ),
    N2: mergeJaVocab(vocabN2, vocabN2jlptA, vocabN2jlptB, vocabN2jlptC, vocabN2jlptD, vocabN2jlptE, vocabN2jlptF, vocabN2jlptG, vocabN2jlptH, vocabN2jlptI),
    N1: mergeJaVocab(vocabN1),
  },
);

export const ALL_CHAPTERS = registry.ALL_CHAPTERS;
export const getLevelMeta = registry.getLevelMeta;
export const getGrammarChapters = registry.getGrammarChapters;
export const getChapter = registry.getChapter;
export const getVocab = registry.getVocab;
export const countVocab = registry.countVocab;

// 어휘 병합 유틸 — 보강 파이프라인·단위테스트에서 사용
export { mergeJaVocab, _normJa };

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
