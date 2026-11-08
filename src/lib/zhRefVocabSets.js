// 중국어 참고 사전(우리 사전)의 파일 목록 · 색인 규칙 — 화면(refVocabIndex · 'use client')과 정적 조각 경로(/api/zh-ref, 서버)가 같이 쓴다
// (ZH-REFVOCAB-SHARD-001). 이 파일은 지시어 없는 보통 모듈이다 — 클라이언트 표시('use client') 파일은 서버 경로에서 부를 수 없다.
// 목록을 원문으로 읽는 곳: scripts/build-zh-hanzi.mjs · src/lib/__tests__/zhHsk2026Fill.test.js.

// 항목의 level은 세트 파일 위치(옛 급수) — 중복 정리·정렬용이고 화면 급수가 아니다. 화면의 HSK 급수는
// zhHskLevel.js(HSK 2026 표)가 정본이다(ZH-LEVEL-2026-001).
const LEVEL_RANK = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6, H7: 7 }; // 그 외(LIFE 등) = 9

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

/** 세트 전부(낮은 급수 우선 규칙은 buildVocabIndex). 동적 import라 쓰는 곳에서만 받는다. */
export function loadZhRefVocabSets() {
  return Promise.all([
    import('../content/chinese/vocab/h1').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/vocab/h1_hsk').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/vocab/h1_hsk30').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/vocab/h1_hsk2026').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/vocab/h2').then((m) => ({ level: 'H2', mod: m })),
    import('../content/chinese/vocab/h2_hsk').then((m) => ({ level: 'H2', mod: m })),
    import('../content/chinese/vocab/h2_hsk30').then((m) => ({ level: 'H2', mod: m })),
    import('../content/chinese/vocab/h3').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/vocab/h3_hsk').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/vocab/h3_hsk30').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/vocab/h3_hsk2026').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/vocab/h4').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk30').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk2026').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk_a').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk_b').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h4_hsk_c').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/vocab/h5').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk30').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk2026').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_a').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_b').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_c').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_d').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_e').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h5_hsk_f').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/vocab/h6').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk30').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk2026').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_a').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_b').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_c').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_d').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/h6_hsk_e').then((m) => ({ level: 'H6', mod: m })),
    import('../content/chinese/vocab/expansion').then((m) => ({ level: 'LIFE', mod: m })),
    import('../content/chinese/vocab/h7_hsk2026_a').then((m) => ({ level: 'H7', mod: m })), // 7–9 통합 밴드 보강(level H7) — 목표 레벨(H1~H6) 커버리지에 세지 않는다
    import('../content/chinese/vocab/h7_hsk2026_b').then((m) => ({ level: 'H7', mod: m })),
    import('../content/chinese/vocab/h7_hsk2026_c').then((m) => ({ level: 'H7', mod: m })),
    import('../content/chinese/vocab/h7_hsk2026_d').then((m) => ({ level: 'H7', mod: m })),
    import('../content/chinese/vocab/h7_hsk2026_e').then((m) => ({ level: 'H7', mod: m })),
  ]);
}
