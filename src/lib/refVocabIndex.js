'use client';
// 레퍼런스 어휘 인덱스(오너 승인 ②) — "우리가 갖고 있는 단어 사전"(콘텐츠 정본)의
// 급수·뜻·병음·예문·한자 노트를 단어 키로 조회한다. 급수는 단어의 고정 사실이라
// 저장하지 않고 표시 시점에 계산한다(오너 확정: 자동 분류·필터 방식 — 스키마 무변경,
// 기존 저장 단어 소급 적용, 복습 큐 오염 없음).
// 콘텐츠 전체는 무겁기 때문에 언어별 1회 지연 로드(뷰어·단어장에서 쓸 때만).

import { useEffect, useState } from 'react';

const LEVEL_RANK = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 }; // 그 외(LIFE 등) = 9

/** 세트 배열 → word 인덱스. 중복 단어는 낮은 급수(먼저 배우는 쪽)가 이긴다. */
export function buildVocabIndex(sets) {
  const map = new Map();
  for (const { level, mod } of sets) {
    const data = mod?.default || mod;
    for (const theme of data?.themes || []) {
      for (const w of theme.words || []) {
        if (!w?.zh) continue;
        const prev = map.get(w.zh);
        if (!prev || (LEVEL_RANK[level] || 9) < (LEVEL_RANK[prev.level] || 9)) {
          map.set(w.zh, { level, word: w });
        }
      }
    }
  }
  return map;
}

let zhIndexPromise = null;

/** 언어별 인덱스 로드 — 현재 중국어(승인 범위). 미지원 언어는 null. */
export function loadRefVocabIndex(language) {
  if (language !== 'Chinese') return Promise.resolve(null);
  zhIndexPromise ||= Promise.all([
    import('../content/chinese/vocab/h1').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/vocab/h1_hsk').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/vocab/h1_hsk30').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/vocab/h2').then((m) => ({ level: 'H2', mod: m })),
    import('../content/chinese/vocab/h2_hsk').then((m) => ({ level: 'H2', mod: m })),
    import('../content/chinese/vocab/h2_hsk30').then((m) => ({ level: 'H2', mod: m })),
    import('../content/chinese/vocab/h3').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/vocab/h3_hsk').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/vocab/h3_hsk30').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/vocab/h4').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk30').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk_a').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk_b').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk_c').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h5').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk30').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_a').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_b').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_c').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_d').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_e').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_f').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h6').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk30').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_a').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_b').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_c').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_d').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_e').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/expansion').then((m) => ({ level: 'LIFE', mod: m })),
  ]).then(buildVocabIndex);
  return zhIndexPromise;
}

/** 급수 라벨 — H1~H6은 'HSK n', 그 외는 '생활'(expansion 등). */
export function refLevelLabel(level) {
  const m = /^H([1-6])$/.exec(level || '');
  return m ? `HSK ${m[1]}` : level ? '생활' : null;
}

/** 단어의 사전 항목 조회 훅 — 인덱스는 언어별 1회 로드 후 캐시. */
export function useRefVocabEntry(language, word) {
  const [index, setIndex] = useState(null);
  useEffect(() => {
    let alive = true;
    loadRefVocabIndex(language).then((ix) => { if (alive) setIndex(ix); }).catch(() => {});
    return () => { alive = false; };
  }, [language]);
  if (!word || !index) return null;
  return index.get(word) || null;
}
