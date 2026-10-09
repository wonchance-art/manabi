// 표제어 훈음 루비 셀(VIEWER-V2-ROUNDS-001 §2.1 표제어 덩어리 · AE-R1 설계서 §2·§10.2) — 순수 함수.
// 별도 훈음 목록(ViewerHanjaReading)을 없애고 훈음을 한자 아래 루비로 되돌린다(v2-AD §3.2, 오너 확정).
// 조회는 R0+ 단일 함수 hanjaReadingsOf(정체 꼴로 찾기)를 그대로 쓴다 — 새 조회 경로를 만들지 않는다.
// 겹침 방지: 훈음이 글자 칸보다 넓으면 그 칸만 벌리고(--hun-n), 칸 폭 × 1.6을 넘으면 훈/음 두 줄.
// 폭은 글꼴 실측이 아니라 글자 종류로 어림한다(설계서 §5.1 실측: 13px 라벨 「몸 체」 30px ·
// 「기를 육」 43px = 한글 1em + 공백 0.3em). 실제 겹침 0은 e2e(실글꼴)가 판정한다.
// PR ①에서는 화면에 연결하지 않는다.

import { hanjaReadingsOf } from './hanjaKo.js';

export const HUN_RUBY_DEFAULTS = Object.freeze({
  glyphPx: 32, // word-fit 표제어 글자 칸(설계서 §5.1)
  hunPx: 13, // 훈음 라벨 글자 크기
  twoLineRatio: 1.6, // 칸 폭 × 1.6 초과면 훈/음 두 줄(설계서 §10.2)
  maxSpreadRatio: 3, // 칸은 글자 폭의 3배까지만 벌린다 — 그보다 긴 훈(긴 풀이)은 칸 안 줄바꿈
});

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿가-힣豈-﫿＀-｠]|[\u{20000}-\u{3fffd}]/u;

/** 라벨 폭 어림(훈음 글꼴 em) — 한글·한자 1, 공백 0.3, 그 밖 반각 0.55. */
export function hunLabelEm(text) {
  let em = 0;
  for (const ch of String(text ?? '')) em += WIDE.test(ch) ? 1 : /\s/u.test(ch) ? 0.3 : 0.55;
  return Math.round(em * 100) / 100;
}

/**
 * 표제어 글자별 훈음 루비 셀.
 * @param {string} word 표제어(기본형) — 호출 쪽이 중국어 + 한자 대조 켬일 때만 부른다(hanjaHunOf 조건).
 * @param {{koTable, hunTable, tradTable}} tables hanjaKo.json · hanjaHun.json · hanjaTrad.json
 * @returns {null | Array<{ch:string, label:string|null, hun:string|null, eum:string|null,
 *   lines:string[], em:number, hunN:number, spread:boolean, wrap:boolean}>}
 *   글자 수와 같은 길이(반복 글자·순서 보존). 라벨 없는 글자는 lines [] · hunN 0.
 *   표 미로드(ko·hun 표 없음)이거나 라벨이 하나도 없으면 null(빈 루비 줄 0).
 *   hunN = 셀 폭(훈음 글꼴 em, 넓은 줄 기준·상한 적용) — CSS `--hun-n`으로 칸을 벌린다.
 *   spread = 칸을 벌려야 하는가, wrap = 상한에 걸려 칸 안에서 줄바꿈하는가.
 */
export function hunRubyCells(word, tables = {}, options = {}) {
  const { koTable, hunTable } = tables || {};
  if (!koTable || !hunTable) return null;
  const { glyphPx, hunPx, twoLineRatio, maxSpreadRatio } = { ...HUN_RUBY_DEFAULTS, ...options };
  const readings = hanjaReadingsOf(word, tables);
  if (!readings.some((r) => r.label)) return null;
  const glyphEm = glyphPx / hunPx;
  const capEm = (glyphPx * maxSpreadRatio) / hunPx;
  return readings.map(({ ch, label, hun, eum }) => {
    if (!label) return { ch, label: null, hun: null, eum: null, lines: [], em: 0, hunN: 0, spread: false, wrap: false };
    const oneLine = hunLabelEm(label);
    let lines = [label];
    // 훈이 있는 라벨만 두 줄로 나눈다 — 라벨 = `${훈} ${음(두음)}`(hanjaHunEum 관례)
    if (hun && oneLine * hunPx > glyphPx * twoLineRatio && label.startsWith(`${hun} `)) {
      lines = [hun, label.slice(hun.length + 1)];
    }
    const em = Math.max(...lines.map(hunLabelEm));
    const spread = em > glyphEm;
    const width = spread ? Math.min(em, capEm) : glyphEm;
    return { ch, label, hun, eum, lines, em, hunN: Math.round(width * 100) / 100, spread, wrap: em > capEm };
  });
}
