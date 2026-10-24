// 문장 이동(▲ 위 / ▼ 아래) — 지정 가능한 문장 목록과 이동 대상 계산(오너 승인 2026-08-19).
import { locateLineTokens, splitSentenceRanges } from './viewerSentenceLine.js';
// "문장"의 단위는 문장 막대(¦)가 붙는 단위와 동일해야 한다: 본문 줄 중 토큰이 있고
// 정리된 텍스트가 2자 이상인 줄. 여기 조건이 렌더(ViewerPage lineHead)와 어긋나면
// 버튼이 막대 없는 줄로 이동하는 불일치가 생긴다 — 계약 테스트로 동조를 지킨다.

/** 렌더와 동일한 줄 텍스트 정리(헤딩 마커 제거) */
export function cleanLineText(rawLine) {
  return (rawLine ?? '').trim().replace(/^#{1,3}\s/, '');
}

/**
 * 지정 가능한 문장 목록 — [{ rawIdx, text, firstTokenId }] (본문 순서).
 * lineGroups: [{ rawIdx, tokenIds }] (ViewerPage가 sequence에서 파생하는 것과 동일 구조)
 */
export function pickableSentences(lineGroups, rawLines) {
  const out = [];
  for (const group of lineGroups || []) {
    if (!group.tokenIds?.length) continue;
    const text = cleanLineText(rawLines?.[group.rawIdx]);
    if (text.length < 2) continue; // 막대(¦)와 동일 임계 — 구두점 홀로 남은 줄 등 제외
    out.push({ rawIdx: group.rawIdx, text, firstTokenId: group.tokenIds[0] });
  }
  return out;
}

/**
 * 마침표까지 한 문장 단위(오너 선택 2026-10-24 KST 「전부 문장 단위」) — 줄(문단) 하나를 단어 카드 문장 줄과 같은 경계
 * (splitSentenceRanges)로 나눈다. 지정 · ▲▼ · 막대(¦) · [문장] 탭 · 듣기 · 저장 출처 문장이 모두 이 단위를 쓴다.
 * 줄 조건은 pickableSentences와 같다(토큰 있고 정리 텍스트 2자 이상). 토큰은 줄 안 순서로 위치를 찾아 자기 문장에 넣고,
 * 위치를 못 찾은 토큰은 앞 토큰의 문장을 따른다. 정리 텍스트가 2자 미만인 조각(홀로 남은 。 · 」)은 앞 문장에 붙인다.
 * 원문 줄과 토큰이 전혀 맞지 않으면(낡은 분석) 줄 전체를 한 문장으로 둔다.
 * @param {Array<{rawIdx:number, tokenIds:string[]}>} lineGroups
 * @param {string[]} rawLines
 * @param {{dictionary?:object, language?:string}} [options]
 * @returns {Array<{key:string, rawIdx:number, text:string, lineText:string, firstTokenId:string, tokenIds:string[]}>}
 */
export function pickableSentenceUnits(lineGroups, rawLines, { dictionary, language } = {}) {
  const out = [];
  for (const group of lineGroups || []) {
    if (!group.tokenIds?.length) continue;
    const raw = String(rawLines?.[group.rawIdx] ?? '');
    const lineText = cleanLineText(raw);
    if (lineText.length < 2) continue;
    const whole = () => out.push({ key: `${group.rawIdx}:0`, rawIdx: group.rawIdx, text: lineText, lineText, firstTokenId: group.tokenIds[0], tokenIds: [...group.tokenIds] });
    const spots = locateLineTokens(raw, group.tokenIds.map((id) => String(dictionary?.[id]?.text ?? '')));
    if (!spots.some(Boolean)) { whole(); continue; }
    const ranges = splitSentenceRanges(raw, { language });
    const buckets = ranges.map(() => []);
    let at = 0;
    group.tokenIds.forEach((id, i) => {
      const spot = spots[i];
      if (spot) { at = 0; while (at < ranges.length - 1 && spot.start >= ranges[at].end) at += 1; }
      buckets[at].push(id);
    });
    const units = [];
    let carry = [];
    ranges.forEach((range, i) => {
      if (!buckets[i].length) return;
      const text = cleanLineText(raw.slice(range.start, range.end));
      if (text.length < 2) {
        if (units.length) { const last = units[units.length - 1]; last.tokenIds.push(...buckets[i]); last.text = cleanLineText(`${last.text}${text}`); }
        else carry.push(...buckets[i]);
        return;
      }
      units.push({ text, tokenIds: [...carry, ...buckets[i]] });
      carry = [];
    });
    if (!units.length) { whole(); continue; }
    if (carry.length) units[units.length - 1].tokenIds.push(...carry);
    units.forEach((unit, n) => out.push({ key: `${group.rawIdx}:${n}`, rawIdx: group.rawIdx, text: unit.text, lineText, firstTokenId: unit.tokenIds[0], tokenIds: unit.tokenIds }));
  }
  return out;
}

// 지정 열쇠의 순서 — 문장 단위는 「줄:순번」, 예전 줄 번호(숫자)는 그 줄의 첫 문장으로 본다.
const order = (value) => (typeof value === 'string' ? value.split(':').map(Number) : [Number(value), 0]);
const before = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
const keyOf = (sentence) => sentence.key ?? sentence.rawIdx;

/**
 * 현재 지정(문장 열쇠 「줄:순번」 또는 줄 번호)에서 dir(+1 아래 / -1 위)만큼 이동한 대상.
 * 경계 밖이면 null(버튼은 비활성 — 순환 없음). 현재 지정이 목록에 없으면
 * (예: 지정 줄이 재분석으로 사라짐) 방향 기준 가장 가까운 문장으로 회복한다.
 */
export function adjacentSentence(sentences, current, dir) {
  if (!sentences?.length || current == null) return null;
  const i = sentences.findIndex((s) => keyOf(s) === current);
  if (i !== -1) return sentences[i + dir] ?? null;
  // 회복 경로: 아래 이동이면 현재보다 뒤 첫 문장, 위 이동이면 앞 마지막 문장
  const at = order(current);
  return dir > 0
    ? sentences.find((s) => before(at, order(keyOf(s)))) ?? null
    : [...sentences].reverse().find((s) => before(order(keyOf(s)), at)) ?? null;
}
