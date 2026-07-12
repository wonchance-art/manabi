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

// 섹션별 추가 예문(slug → 섹션index → [예문]) — 본편 챕터에 병합. 본문/원본 예문 불변.
import exOT from './grammar/ot_examples';
import exH1 from './grammar/h1_examples';
import exH2 from './grammar/h2_examples';
import exH3 from './grammar/h3_examples';
import exH4 from './grammar/h4_examples';
import exH5 from './grammar/h5_examples';
import exH6 from './grammar/h6_examples';

/** 챕터 섹션의 examples에 추가 예문을 덧붙임 (slug→섹션index 매칭) */
function withExtraExamples(chapters, extra) {
  if (!extra) return chapters;
  return chapters.map((ch) => {
    const e = extra[ch.slug];
    if (!e) return ch;
    return {
      ...ch,
      sections: (ch.sections || []).map((s, i) => {
        const add = e[i] || e[String(i)];
        if (!add || !add.length) return s;
        return { ...s, examples: [...(s.examples || []), ...add] };
      }),
    };
  });
}

import vocabH1 from './vocab/h1';
import vocabH2 from './vocab/h2';
import vocabH3 from './vocab/h3';
import vocabH4 from './vocab/h4';
import vocabH5 from './vocab/h5';
import vocabH6 from './vocab/h6';

// HSK 2.0 공식 어휘표 기반 보강 어휘 — 기존 테마 뒤에 병합
import vocabH1hsk from './vocab/h1_hsk';
import vocabH2hsk from './vocab/h2_hsk';
import vocabH3hsk from './vocab/h3_hsk';
import vocabH4hskA from './vocab/h4_hsk_a';
import vocabH4hskB from './vocab/h4_hsk_b';
import vocabH4hskC from './vocab/h4_hsk_c';
import vocabH5hskA from './vocab/h5_hsk_a';
import vocabH5hskB from './vocab/h5_hsk_b';
import vocabH5hskC from './vocab/h5_hsk_c';
import vocabH5hskD from './vocab/h5_hsk_d';
import vocabH5hskE from './vocab/h5_hsk_e';
import vocabH5hskF from './vocab/h5_hsk_f';
// HSK 2.0 6급 보강 — H6에만 빠져 있던 2.0 계보(빈도순 1,000개, 전 급 교차 중복 배제).
import vocabH6hskA from './vocab/h6_hsk_a';
import vocabH6hskB from './vocab/h6_hsk_b';
import vocabH6hskC from './vocab/h6_hsk_c';
import vocabH6hskD from './vocab/h6_hsk_d';
import vocabH6hskE from './vocab/h6_hsk_e';
// HSK 3.0 표준 보강 (drkameleon/complete-hsk-vocabulary, MIT) — 기존에 없던 급별 순증분.
import vocabH1hsk30 from './vocab/h1_hsk30';
import vocabH2hsk30 from './vocab/h2_hsk30';
import vocabH3hsk30 from './vocab/h3_hsk30';
import vocabH4hsk30 from './vocab/h4_hsk30';
import vocabH5hsk30 from './vocab/h5_hsk30';
import vocabH6hsk30 from './vocab/h6_hsk30';
// 원본 어휘 + HSK 보강 어휘를 '보강' 구분 없이 한 사전으로 — 품사별 자연 분류로 통합.
const POS_GROUPS = [
  { name: '명사', icon: '📦', pos: ['명사'] },
  { name: '대명사·지시', icon: '👉', pos: ['대명사', '대사'] },
  { name: '동사', icon: '🏃', pos: ['동사'] },
  { name: '형용사', icon: '🎨', pos: ['형용사'] },
  { name: '부사', icon: '⚡', pos: ['부사'] },
  { name: '수사·양사', icon: '🔢', pos: ['수사', '양사'] },
  { name: '개사·접속사·조사', icon: '🔗', pos: ['개사', '접속사', '조사'] },
  { name: '성어·관용구', icon: '📜', pos: ['성어', '관용구'] },
  { name: '표현·인사', icon: '💬', pos: ['표현', '감탄사'] },
];
// 한자 숫자값 — 수사를 0부터 크기순으로 정렬하기 위함
const NUM_VAL = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100, '千': 1000, '万': 10000, '亿': 100000000 };
function cnNumValue(zh) {
  if (![...zh].every(c => c in NUM_VAL)) return null;     // 순수 숫자 한자만
  let total = 0, section = 0, num = 0;
  for (const c of zh) {
    const v = NUM_VAL[c];
    if (v === 10 || v === 100 || v === 1000) { section += (num || 1) * v; num = 0; }
    else if (v >= 10000) { total += (section + num) * v; section = 0; num = 0; }
    else num = v;
  }
  return total + section + num;
}
const mergeVocab = (base, ...adds) => {
  const all = [...base.themes, ...adds.flatMap(a => a.themes)].flatMap(t => t.words);
  const seen = new Set();
  const buckets = new Map([...POS_GROUPS.map(g => [g.name, []]), ['기타', []]]);
  for (const w of all) {
    if (seen.has(w.zh)) continue;
    seen.add(w.zh);
    const g = POS_GROUPS.find(g => g.pos.includes(w.pos));
    buckets.get(g ? g.name : '기타').push(w);
  }
  // 수사·양사 — 숫자(0→)를 값 순으로 앞에, 양사 등은 뒤에 (안정 정렬)
  const numGroup = buckets.get('수사·양사');
  if (numGroup) {
    numGroup.sort((a, b) => {
      const va = cnNumValue(a.zh), vb = cnNumValue(b.zh);
      if (va != null && vb != null) return va - vb;
      if (va != null) return -1;
      if (vb != null) return 1;
      return 0;
    });
  }
  const themes = [...POS_GROUPS, { name: '기타', icon: '📚' }]
    .filter(g => buckets.get(g.name).length)
    .map(g => ({ name: g.name, icon: g.icon, words: buckets.get(g.name) }));
  return { ...base, themes };
};

import bunkeiH1 from './bunkei/h1';
import bunkeiH2 from './bunkei/h2';
import bunkeiH3 from './bunkei/h3';
import bunkeiH4 from './bunkei/h4';
import bunkeiH5 from './bunkei/h5';
import bunkeiH6 from './bunkei/h6';

/** 레벨 메타 — 학습 순서대로. key·short 모두 OT/H1~H6 (HSK 1~6급) */
export const ZH_LEVEL_META = [
  {
    key: 'OT', short: 'OT', label: 'OT 오리엔테이션', focus: '시작 전 워밍업',
    desc: '한어병음·성조·간체자·기본 어순 — 본격 학습 전에 알아야 할 중국어의 작동 원리.',
    color: '#868E96', bg: 'rgba(134,142,150,0.12)', line: 'rgba(134,142,150,0.35)',
  },
  {
    key: 'H1', short: 'H1', label: 'H1 기초', focus: '첫 문장 만들기',
    desc: '是·有와 기본 어순, 这/那와 양사, 의문사 — 자기소개와 일상 표현의 뼈대.',
    color: '#4C6EF5', bg: 'rgba(76,110,245,0.12)', line: 'rgba(76,110,245,0.35)',
  },
  {
    key: 'H2', short: 'H2', label: 'H2 초급', focus: '시간과 경험',
    desc: '了·过·在, 비교 比, 능원동사 — 했고·하는 중이고·할 수 있다를 말하기.',
    color: '#7048E8', bg: 'rgba(112,72,232,0.12)', line: 'rgba(112,72,232,0.35)',
  },
  {
    key: 'H3', short: 'H3', label: 'H3 중급', focus: '연결과 확장',
    desc: '把·被구문, 결과·방향·정도 보어, 복문 연결사 — 문장을 길게 엮기.',
    color: '#AE3EC9', bg: 'rgba(174,62,201,0.12)', line: 'rgba(174,62,201,0.35)',
  },
  {
    key: 'H4', short: 'H4', label: 'H4 상급', focus: '뉘앙스의 시작',
    desc: '복잡한 보어·가정/양보·관용 구문 — 논리적으로 주장하고 연결하기.',
    color: '#D6336C', bg: 'rgba(214,51,108,0.12)', line: 'rgba(214,51,108,0.35)',
  },
  {
    key: 'H5', short: 'H5', label: 'H5 고급', focus: '문어와 격식',
    desc: '서면어·성어 입문·고급 연결사 — 신문과 글을 읽고 쓰는 눈.',
    color: '#E03131', bg: 'rgba(224,49,49,0.12)', line: 'rgba(224,49,49,0.35)',
  },
  {
    key: 'H6', short: 'H6', label: 'H6 마스터', focus: '원어민의 영역',
    desc: '고급 성어·수사법·문체 변이 — 언어 너머의 문화까지.',
    color: '#A02840', bg: 'rgba(160,40,64,0.12)', line: 'rgba(160,40,64,0.35)',
  },
];

const registry = createRegistry(
  ZH_LEVEL_META,
  {
    OT: withExtraExamples(grammarOT, exOT),
    H1: withExtraExamples(grammarH1, exH1),
    H2: withExtraExamples(grammarH2, exH2),
    H3: withExtraExamples(grammarH3, exH3),
    H4: withExtraExamples(grammarH4, exH4),
    H5: withExtraExamples(grammarH5, exH5),
    H6: withExtraExamples(grammarH6, exH6),
  },
  {
    H1: mergeVocab(vocabH1, vocabH1hsk, vocabH1hsk30),
    H2: mergeVocab(vocabH2, vocabH2hsk, vocabH2hsk30),
    H3: mergeVocab(vocabH3, vocabH3hsk, vocabH3hsk30),
    H4: mergeVocab(vocabH4, vocabH4hskA, vocabH4hskB, vocabH4hskC, vocabH4hsk30),
    H5: mergeVocab(vocabH5, vocabH5hskA, vocabH5hskB, vocabH5hskC, vocabH5hskD, vocabH5hskE, vocabH5hskF, vocabH5hsk30),
    H6: mergeVocab(vocabH6, vocabH6hskA, vocabH6hskB, vocabH6hskC, vocabH6hskD, vocabH6hskE, vocabH6hsk30),
  },
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
const api = { ...registry, getBunkei, countBunkei };

export default api;
