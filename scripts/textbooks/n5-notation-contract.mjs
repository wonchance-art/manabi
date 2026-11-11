// N5 「표기만 바꾼 파생 판본」 계약(N5-RENDERER-001 초안, 2026-11-11 KST) — 새 원고를 가나형으로 되돌리면 바탕 판본(8a8c)과 같아야 한다.
//   ⑴ 구조 · ID · 정답 위치: 관리자 편집과 같은 validateManuscript(바탕과 같은 모양 · 잠긴 필드 동일). 과 kanji 지도의 키 집합도 잠겨 있다
//      — 새 읽기는 지도에 키를 더하지 않고 문자열 안 {바탕|읽기}로 적는다(n5-markup.mjs).
//   ⑵ 모든 문자열: kanaForm(새, 과 지도) === kanaForm(옛, 과 지도). 낱말 · 조사 · 띄어쓰기 · 구두점 · 한국어 · 정답 문자열이 바뀌면 걸린다.
//   ⑶ 지도의 기존 읽기는 바꾸지 않는다(바꾸면 옛 문장의 가나형까지 달라진다).
// 그 밖에 A-2 「한자 전부 후리가나」 도달 정도는 위반이 아니라 보고(uncovered)로 돌려준다.
import { validateManuscript } from '../../src/lib/textbook/contract.js';
import { kanaForm } from './n5-markup.mjs';

const HAN = /\p{Script=Han}/u;
const INLINE_BASE = /\{([^{}|]+)\|[^{}|]+\}/gu;

function walk(a, b, path, visit) {
  if (typeof b === 'string' || typeof a === 'string') { visit(a, b, path); return; }
  if (Array.isArray(b)) { b.forEach((v, i) => walk(a?.[i], v, [...path, i], visit)); return; }
  if (b && typeof b === 'object') for (const k of Object.keys(b)) walk(a?.[k], b[k], [...path, k], visit);
}

/** 위반 목록(빈 배열 = 통과)과 A-2 미도달 한자(과별 수)를 돌려준다. */
export function notationOnlyReport(base, next) {
  const violations = [];
  const shape = validateManuscript(next, base);
  if (shape) violations.push({ kind: 'shape', path: '', detail: shape });
  const uncovered = new Map();
  walk(next, base, [], (after, before, path) => {
    const lessonIndex = path[0] === 'lessons' ? path[1] : null;
    const inMap = path[0] === 'lessons' && path[2] === 'kanji';
    if (inMap) { if (after !== before) violations.push({ kind: 'map-reading-changed', path: path.join('.'), before, after }); return; }
    const mapBefore = lessonIndex === null ? {} : base.lessons[lessonIndex]?.kanji || {};
    const mapAfter = lessonIndex === null ? {} : next.lessons?.[lessonIndex]?.kanji || {};
    if (typeof after !== 'string') { violations.push({ kind: 'missing', path: path.join('.') }); return; }
    if (after !== before && kanaForm(after, mapAfter) !== kanaForm(before, mapBefore)) violations.push({ kind: 'kana-form-differs', path: path.join('.'), before, after });
    // A-2 도달: 지도 키 · 인라인 읽기로 덮이지 않은 한자(새 원고 기준)
    if (lessonIndex !== null && HAN.test(after)) {
      const covered = kanaForm(after, mapAfter);
      const bare = [...covered].filter(ch => HAN.test(ch)).length;
      if (bare) uncovered.set(lessonIndex + 1, (uncovered.get(lessonIndex + 1) || 0) + bare);
    }
  });
  return { violations, uncovered: Object.fromEntries(uncovered) };
}

export const inlineBases = text => [...String(text ?? '').matchAll(INLINE_BASE)].map(m => m[1]);
