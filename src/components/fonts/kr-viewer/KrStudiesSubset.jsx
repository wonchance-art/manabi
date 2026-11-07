import { preload } from 'react-dom';
import manifest from './studies-subsets.json';

// 지역학 문서별 첫 화면 한글 하위 집합(STUDIES-CLS-001) — 본문 400 · 제목 700 정적 파일 두 개를 첫 그림 전에 미리 받는다.
// 나머지 글자(첫 화면 밖 한글 · 한자 · 가나, STUDIES-REST-001)는 400 · 700 파일 둘로 — 미리 받지 않고 face만 둔다. 한자 17자가 Noto Sans KR 조각
// 12개 · 495KB를 끌어왔다(jp-culture 실측) — 같은 글꼴의 작은 파일로 바꿔 화면은 그대로 두고 바이트만 줄인다.
// 미리 받지 않으면 본문 한글이 시스템 글꼴로 그려졌다가 Noto Sans KR 조각(문서당 28개)이 4초 넘어 와서 줄이 다시 흘렀다
// (운영 CLS jp-culture 0.0063 · kr-culture 0.0124 · fr-overview 0.0636). 목록 밖 글자는 next/font 조각으로 넘어간다(같은 family의 unicode-range).
// CSS는 목록의 unicodeRange로 여기서 만든다 — 문서 26개의 CSS 파일을 따로 두지 않는다. 문서 HTML의 이 <style>은 머리의 next/font 시트보다
// 뒤에 오므로 같은 family · 굵기의 face 가운데 먼저 쓰인다(CSS Fonts 4).

/** 부분 → 굵기. 첫 화면(body · head)은 미리 받고, 나머지(rest400 · rest700 — 첫 화면 밖 한글 · 한자 · 가나, STUDIES-REST-001)는 미리 받지 않는다.
 * 나머지는 첫 화면 파일과 글자가 겹치지 않는다(겹치면 둘 다 받는다). 500 같은 다른 굵기는 next/font 그대로다. */
const WEIGHT_OF = Object.freeze({ ...manifest.weights, ...manifest.restWeights });
const PRELOADED = Object.freeze(Object.keys(manifest.weights));

export function studiesSubsetEntry(countryId, slug) {
  return manifest.docs[`${countryId}/${slug}`] || null;
}

/** 문서 하나의 @font-face — 목록에 있는 부분마다 한 줄(나머지가 없는 문서는 줄도 없다). */
export function studiesSubsetCss(entry) {
  return Object.entries(WEIGHT_OF).filter(([part]) => entry[part]).map(([part, weight]) => (
    `@font-face{font-family:'Noto Sans KR';font-style:normal;font-weight:${weight};font-display:swap;`
    + `src:url(${entry[part].woff2.href}) format('woff2');unicode-range:${entry[part].unicodeRange}}`
  )).join('');
}

export default function KrStudiesSubset({ countryId, slug }) {
  const entry = studiesSubsetEntry(countryId, slug);
  if (!entry) return null;
  for (const part of PRELOADED) {
    preload(entry[part].woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  }
  return <style dangerouslySetInnerHTML={{ __html: studiesSubsetCss(entry) }} />;
}
