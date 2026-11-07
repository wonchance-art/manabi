// first-paint-ab.mjs 팔 파일 예 — 복습실 한글 하위 집합 미리 받기가 첫 그림에 드는 비용(VOCAB-SUBSET-SMALL-001에서 쓴 비교).
//   NODE_USE_ENV_PROXY=1 node scripts/perf/first-paint-ab.mjs --arms scripts/perf/arms/kr-subset-preload.example.mjs --path /vocab --rounds 5
// A = 운영 그대로 · N = 하위 집합 미리 받기(Link 머리글 + RSC :HL 힌트)만 뺀 판. 바꾼 문서도 앞단의 진짜 응답이라 대역 제한을 탄다.
const SUBSET = /\/fonts\/kr-viewer\/noto-sans-kr-[a-z]+\.[0-9a-f]+\.woff2/;

export default {
  A: {},
  N: {
    html: (html) => html.replace(/:HL\[\\"\/fonts\/kr-viewer\/[^\]]*\]\\n/g, ''),
    link: (value) => value.split(/,\s*(?=<)/).filter((part) => !SUBSET.test(part)).join(', '),
  },
};
