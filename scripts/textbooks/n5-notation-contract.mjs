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

// 오변환 안전망(2026-11-11 KST) — 가나형이 같아도 뜻이 틀린 표기를 경고로 뽑는다(위반 아님 · 표 검수와 별개의 한 번 더).
// 실측: 「いけません」 → 「{池|いけ}ません」은 가나형 계약을 통과한다. 그래서 「명사로만 쓰이는 낱말의 한자를 그 명사 읽기로 적고,
// 바로 뒤에 동사 · 형용사 활용 어미가 붙은 조합」을 찾는다. 낱말 · 품사 · 읽기는 책 lexicon(spellings · pos · ja)에서 온다.
const INFLECTION = /^(?:ま[すせしょ]|な(?:い|かっ|く|けれ)|て(?!ん)|た(?![ちくべ])|る|れ|ろ|よう)/u;
const NOUN_ONLY = pos => /명사|조수사|접미사/u.test(pos || '') && !/동사|형용사/u.test(pos || '');
const INLINE_ALL = /\{([^{}|]+)\|([^{}|]+)\}/gu;

/** 새 원고에서 바뀐 문자열마다 (한자 덩어리, 읽기, 뒤따르는 글자)를 훑어 명사 읽기 + 활용 어미 조합을 돌려준다. */
export function misreadWarnings(base, next) {
  const nouns = new Map();
  for (const entry of base.lexicon || []) if (NOUN_ONLY(entry.pos)) for (const s of entry.spellings || []) {
    if (!/\p{Script=Han}/u.test(s)) continue;
    if (!nouns.has(s)) nouns.set(s, []);
    nouns.get(s).push({ id: entry.id, reading: entry.ja });
  }
  const warnings = [];
  const check = (path, token, reading, after) => {
    const m = after.match(INFLECTION);
    if (!m) return;
    const hit = (nouns.get(token) || []).find(n => n.reading === reading);
    if (hit) warnings.push({ path, token, reading, ending: m[0], lexicon: hit.id, context: `${token}${after.slice(0, 6)}` });
  };
  walk(next, base, [], (after, before, path) => {
    if (typeof after !== 'string' || after === before || path[0] !== 'lessons' || path[2] === 'kanji') return;
    const map = next.lessons?.[path[1]]?.kanji || {};
    const keys = Object.keys(map).filter(k => k && map[k]).sort((a, b) => b.length - a.length || a.localeCompare(b));
    const at = path.join('.');
    let last = 0;
    const plain = (text, offset, full) => {
      for (let i = 0; i < text.length;) {
        const key = keys.find(k => text.startsWith(k, i));
        if (key) { check(at, key, map[key], full.slice(offset + i + key.length).replace(INLINE_ALL, (_, _b, r) => r)); i += key.length; }
        else i += String.fromCodePoint(text.codePointAt(i)).length;
      }
    };
    for (const m of after.matchAll(INLINE_ALL)) {
      plain(after.slice(last, m.index), last, after);
      check(at, m[1], m[2], after.slice(m.index + m[0].length).replace(INLINE_ALL, (_, _b, r) => r));
      last = m.index + m[0].length;
    }
    plain(after.slice(last), last, after);
  });
  return warnings;
}
