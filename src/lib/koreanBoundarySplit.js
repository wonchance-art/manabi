// 뷰어 v2 AD-R3 §7.5 — 한국어 나누기 B안(오너 결정 2026-10-09) 순수 함수. 정본: docs/manabi-viewer-v2-ad-r3.md §7.4 안 B · §7.5.
//
// · 한국어 토큰은 어절이다(server/koreanAnalysis.js renderTokens가 어절이 아닌 토큰을 거부한다). 어절 안 분석은 morphology
//   [{form, function}]에만 있고, form은 표면 글자가 아닐 수 있다(했어요 = 하- + -였- + -어요).
// · 칼선 후보 = form이 표면에 **글자 그대로** 이어지는 형태소 경계만, **왼쪽부터**. 처음 어긋나는 형태소(축약·불규칙)부터
//   끝까지는 한 조각(합친 꼴)이다 — 「했」「불렀」 같은 단어 아닌 조각을 만들지 않는다. 합친 꼴에는 공식
//   「했어요 = 하다 + -였- + -어요 (줄어든 꼴)」을 보인다(문구는 화면이 vt()로 붙인다 — 여기서는 구조만).
// · 조각 뜻 = 기존 morphology function. 새 AI 호출·서버 분석 0. 기록·저장은 boundaryEditFlow(중·일·영과 같은 경로)가 한다.
// 브라우저·서버 공용 — 서버 전용 모듈·네트워크를 import하지 않는다(koreanBoundarySplit.test.js 계약).
import { analysisTokenLine } from './analysisCoverage';
import {
  boundaryLineEntries, boundarySpans, compactBoundaryText, readBoundaryEdits,
} from './boundaryEdits';

const HYPHEN = /^[-–]+|[-–]+$/gu;
const WORDISH = /[\p{L}\p{N}]/u;
const nfc = value => (typeof value === 'string' ? value.normalize('NFC').trim() : '');

/** 어절 토큰인가(공백·문장부호·실패·개행 아님, 공백 없음). */
export function koreanEojeolToken(token) {
  const text = typeof token?.text === 'string' ? token.text : '';
  return !!text && !token.failed && !token.whitespace && token.pos !== '기호' && token.pos !== '개행'
    && !/\s/u.test(text) && WORDISH.test(text);
}

/** morphology → [{form, fn, bare, stem}]. form 앞뒤 하이픈을 뗀 bare가 비거나 공백이 들면 그 항목은 형태소로 보지 않는다. */
export function koreanMorphemes(token) {
  const list = Array.isArray(token?.morphology) ? token.morphology : [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const form = nfc(item.form), bare = form.replace(HYPHEN, '');
    if (!bare || /\s/u.test(bare)) continue;
    out.push({ form, fn: typeof item.function === 'string' ? item.function.trim() : '', bare,
      stem: /[-–]$/u.test(form) && !/^[-–]/u.test(form) });
  }
  return out;
}

/**
 * 칼선 후보. 결과 {units: [{text, start, end, morphemes}], cuts: [어절 안 위치…]}. start·end·cuts는 어절 안 UTF-16 위치다.
 * 어절이 아니면 units: []. 칼선이 없으면 units = [어절 전체 한 조각](morphemes = 전체 형태소).
 */
export function koreanSplitUnits(token) {
  if (!koreanEojeolToken(token)) return { units: [], cuts: [] };
  const surface = token.text;
  const morphs = koreanMorphemes(token);
  const whole = { units: [{ text: surface, start: 0, end: surface.length, morphemes: morphs }], cuts: [] };
  // 분해형 표면(NFD)은 글자 그대로 비교가 성립하지 않는다 — 칼선 없음.
  if (morphs.length < 2 || surface.normalize('NFC') !== surface) return whole;
  const units = [];
  let at = 0, k = 0;
  for (; k < morphs.length; k++) {
    let piece = morphs[k].bare;
    // 첫 형태소를 기본형(먹다)으로 준 경우: 표면 앞부분이 「다」를 뺀 꼴과 같을 때만 그 꼴로 본다.
    if (k === 0 && !surface.startsWith(piece, at) && piece.length > 1 && piece.endsWith('다') && surface.startsWith(piece.slice(0, -1), at)) {
      piece = piece.slice(0, -1);
    }
    if (!surface.startsWith(piece, at) || at + piece.length >= surface.length) break;
    units.push({ text: piece, start: at, end: at + piece.length, morphemes: [morphs[k]] });
    at += piece.length;
  }
  let rest = morphs.slice(k);
  if (!rest.length) {
    // form이 표면보다 먼저 끝났다 — 남은 글자에 형태소가 없으므로 마지막 칼선도 두지 않는다.
    const last = units.pop();
    if (!last) return whole;
    at = last.start;
    rest = last.morphemes;
  }
  units.push({ text: surface.slice(at), start: at, end: surface.length, morphemes: rest });
  if (units.length < 2) return whole;
  return { units, cuts: units.slice(1).map(unit => unit.start) };
}

const termOf = morpheme => (morpheme.stem ? `${morpheme.bare}다` : morpheme.form);

/**
 * 합친 꼴 공식 {surface, terms, kind}. kind: 'contracted'(형태소 글자 수 합 > 표면 — 줄어든 꼴) ·
 * 'changed'(모양이 다름 — 모양이 바뀐 꼴) · null(표면 그대로). 형태소가 둘 미만이면 null.
 */
export function koreanFormula(unit) {
  const morphs = Array.isArray(unit?.morphemes) ? unit.morphemes : [];
  if (morphs.length < 2 || typeof unit?.text !== 'string') return null;
  const joined = morphs.map(m => m.bare).join('');
  const kind = joined === unit.text ? null : [...joined].length > [...unit.text].length ? 'contracted' : 'changed';
  return { surface: unit.text, terms: morphs.map(termOf), kind };
}

function shiftedSpan(span, from, to) {
  if (!span || typeof span !== 'object' || !Number.isInteger(span.start)) return undefined;
  const out = { ...span, start: span.start + from, end: span.start + to };
  if (Number.isInteger(span.lineStart)) { out.lineStart = span.lineStart + from; out.lineEnd = span.lineStart + to; }
  return out;
}

/**
 * 어절 토큰(eojeol)의 조각(units — 이웃한 칼선 후보 조각들)으로 새 토큰을 만든다. 뜻 = morphology function(여러 개면 ' · '),
 * 표제어 = 첫 형태소(어간이면 X다), 품사는 표제어가 어절 표제어와 같을 때만. 위치(sourceSpan·selectionGroup)는 어절 범위를
 * 같은 만큼 옮긴다(어절 안에는 공백이 없다). 설명 언어 표식은 어절 것을 그대로. 읽기(readings)는 싣지 않는다.
 */
export function koreanPieceToken(eojeol, units) {
  const from = units[0].start, to = units.at(-1).end;
  const text = eojeol.text.slice(from, to);
  const morphs = units.flatMap(unit => unit.morphemes);
  const head = morphs[0];
  const lemma = head ? termOf(head).replace(HYPHEN, '') : text;
  const eojeolLemma = eojeol.lemma || eojeol.base_form || null;
  const sourceSpan = shiftedSpan(eojeol.sourceSpan, from, to);
  const token = {
    text, surface: text, lemma, base_form: lemma || text,
    pos: eojeolLemma && lemma === eojeolLemma ? eojeol.pos ?? null : null,
    meaning: morphs.map(m => m.fn).filter(Boolean).join(' · '),
    language: 'Korean',
    ...(sourceSpan ? { sourceSpan } : {}),
    ...(eojeol.selectionGroup && sourceSpan ? { selectionGroup: `ko_${sourceSpan.lineIndex}_${sourceSpan.lineStart ?? sourceSpan.start}_${sourceSpan.lineEnd ?? sourceSpan.end}` } : {}),
    ...(eojeol.explanationLocale ? { explanationLocale: eojeol.explanationLocale } : {}),
    ...(eojeol.meaningLocale ? { meaningLocale: eojeol.meaningLocale } : {}),
    ...(eojeol.analysisVersion ? { analysisVersion: eojeol.analysisVersion } : {}),
    ...(morphs.length > 1 ? { morphology: morphs.map(m => ({ form: m.form, function: m.fn })) } : {}),
    boundary: 'user',
  };
  return token;
}

/** 어절 토큰의 칼선(어절 안 위치)이 후보 안에 있는지 · 조각 묶음. cuts가 후보 밖이면 null. 결과 [[unit…], …]. */
export function koreanPieceGroups(eojeol, cuts) {
  const { units, cuts: candidates } = koreanSplitUnits(eojeol);
  if (!units.length || !Array.isArray(cuts) || cuts.some(cut => !candidates.includes(cut))) return null;
  const groups = [[]];
  units.forEach((unit, k) => { if (k && cuts.includes(unit.start)) groups.push([]); groups.at(-1).push(unit); });
  return groups;
}

/**
 * 나눈 조각이면 {record, eojeol(원래 어절 토큰), baseId} — 지금 기록 구간 안에 있고 base 원래 토큰이 아닌 토큰. 아니면 null.
 */
export function koreanSplitRecordOf(json, tokenId) {
  const line = analysisTokenLine(tokenId);
  if (json?.metadata?.language !== 'Korean' || line === null) return null;
  const span = boundarySpans(boundaryLineEntries(json, line)).find(item => item.entry.id === tokenId);
  if (!span || span.end <= span.start) return null;
  for (const record of readBoundaryEdits(json)) {
    if (record?.line !== line || record.status === 'pending' || !Array.isArray(record.base) || record.base.length !== 1) continue;
    if (span.start < record.start || span.end > record.end || record.base[0]?.id === tokenId) continue;
    return { record, eojeol: record.base[0].token, baseId: record.base[0].id };
  }
  return null;
}

// ── 재분석 뒤 유지(§7.5 ④) — 한국어 분석기는 어절만 돌려주므로 뷰어 쪽에서 기록을 다시 적용한다 ──

/**
 * 분석 결과(json) 위에 한국어 경계 기록(edits — 줄 번호는 이미 새 원문 기준)을 다시 적용한다. takeLine(line)이 참인 줄(이번에
 * 다시 분석한 줄)의 기록만 본다 — 나머지 기록·토큰은 그대로. 기록마다:
 * · 그 자리가 이미 기록 칼선 그대로 나뉘어 있으면(재사용된 줄) 그대로 둔다.
 * · 그 자리(글자가 다르면 같은 줄에서 한 번만 나오는 같은 글자)가 어절 하나이고 기록 칼선이 그 어절의 후보 안이면 새 morphology로
 *   다시 나눈다 — base = [{id: 기록의 원래 id, token: 새 어절}], 조각 id = `id_<줄>_e<k>_<revision 8자>`.
 * · 아니면 pending(조용히 버리지 않는다).
 * 결과 {json, edits}. 바뀐 것이 없으면 입력 그대로.
 */
export function reapplyKoreanBoundaries(json, edits, { takeLine = () => true, revision = '' } = {}) {
  const list = Array.isArray(edits) ? edits : [];
  if (!list.length || json?.metadata?.language !== 'Korean' || !Array.isArray(json?.sequence)) return { json, edits: list };
  const rev = String(revision).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'k';
  const replaced = new Map(); // line → new entries
  const out = list.map(record => {
    if (!Number.isInteger(record?.line) || !takeLine(record.line)) return record;
    const pending = { ...record, status: 'pending' };
    const entries = replaced.get(record.line) || boundaryLineEntries(json, record.line);
    const spans = boundarySpans(entries);
    const compact = spans.map(span => compactBoundaryText(span.entry.token?.text)).join('');
    const text = typeof record.text === 'string' ? record.text : '';
    if (!text || !Array.isArray(record.cuts) || !record.cuts.length) return pending;
    let delta = null;
    if (compact.slice(record.start, record.end) === text) delta = 0;
    else {
      const first = compact.indexOf(text);
      if (first >= 0 && compact.indexOf(text, first + 1) < 0) delta = first - record.start;
    }
    if (delta === null) return pending;
    const s = record.start + delta, e = record.end + delta, want = record.cuts.map(cut => cut + delta);
    const inside = spans.filter(span => span.start >= s && span.end <= e && span.end > span.start);
    const edgesOk = spans.some(span => span.start === s) && spans.some(span => span.end === e);
    if (!edgesOk) return pending;
    const current = inside.slice(0, -1).map(span => span.end);
    const base = Array.isArray(record.base) && record.base.length === 1 ? record.base[0] : null;
    if (!base) return pending;
    if (inside.length > 1) {
      // 이미 나뉜 줄(재사용) — 칼선이 기록과 같고 모두 나눈 조각일 때만 그대로.
      const same = current.length === want.length && current.every((cut, k) => cut === want[k]) && inside.every(span => span.entry.token?.boundary === 'user');
      return same ? { ...record, start: s, end: e, cuts: want, status: 'applied' } : pending;
    }
    const target = inside[0];
    if (!target || target.start !== s || target.end !== e || !koreanEojeolToken(target.entry.token)) return pending;
    const groups = koreanPieceGroups(target.entry.token, want.map(cut => cut - s));
    if (!groups) return pending;
    const at = entries.indexOf(target.entry);
    const pieces = groups.map((units, k) => ({ id: `id_${record.line}_e${at + k}_${rev}`, token: koreanPieceToken(target.entry.token, units) }));
    replaced.set(record.line, [...entries.slice(0, at), ...pieces, ...entries.slice(at + 1)]);
    return { ...record, start: s, end: e, cuts: want, status: 'applied', base: [{ ...base, token: target.entry.token }] };
  });
  if (!replaced.size) return { json, edits: out };
  const sequence = [], dictionary = { ...json.dictionary }, done = new Set(), removed = [];
  for (const id of json.sequence) {
    const line = analysisTokenLine(id);
    if (!replaced.has(line) || id.startsWith('br_') || json.dictionary?.[id]?.pos === '개행') { sequence.push(id); continue; }
    removed.push(id);
    if (done.has(line)) continue;
    done.add(line);
    sequence.push(...replaced.get(line).map(entry => entry.id));
  }
  for (const id of removed) delete dictionary[id];
  for (const line of done) for (const entry of replaced.get(line)) dictionary[entry.id] = entry.token;
  return { json: { ...json, sequence, dictionary }, edits: out };
}
