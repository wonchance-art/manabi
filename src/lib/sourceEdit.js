// ③ 원문 수정 + 증분 재분석(오너 승인 2026-08-19) — 수정한 부분만 인식해서 처리.
//
// 성립 원리: 토큰 ID가 `id_{줄}_…`/`br_{줄}_…`/`failed_{줄}_…`로 줄번호를 품고,
// 부분 분석 파이프라인(analyzeText)이 failed_indices 줄만 분석하고 나머지는 줄번호
// 프리픽스로 기존 토큰을 재사용한다. 따라서 (1) 옛↔새 줄 매핑을 LCS로 구하고
// (2) 유지 줄의 토큰 ID를 새 줄번호로 리맵하면, 기존 파이프라인이 그대로 증분
// 분석기가 된다 — 재조립 순서·개행(br) 배치는 파이프라인이 매 실행 새로 만든다.
//
// diff는 repo의 diffChars(LCS) 선례를 줄 단위로 확장한 것(jsdiff·Myers 검토 후
// 의존성 0 유지). 줄 비교는 trim 기준 — 분석 입력이 trim이므로 공백만 바뀐 줄을
// 재분석하는 낭비를 막는다.

import { autoSplitParagraphs } from './splitParagraphs';

/**
 * 줄 단위 LCS — 유지 줄 매핑과 변경 줄 목록.
 * @returns {{ok:true, pairs:Map<number,number>, changedNew:number[], removedOld:number[]}
 *          |{ok:false, reason:string}}
 *   pairs: 옛 줄번호 → 새 줄번호(내용 불변 줄만). changedNew: 분석이 필요한 새 줄
 *   (수정·추가, 빈 줄 제외). removedOld: 사라진 옛 줄.
 */
export function diffLineMap(oldLines, newLines) {
  const a = (oldLines || []).map((l) => String(l ?? '').trim());
  const b = (newLines || []).map((l) => String(l ?? '').trim());
  const m = a.length;
  const n = b.length;
  // O(m·n) 가드 — 자료는 수백 줄 규모(부분 분석 UI와 동일 전제). 넘으면 정직하게 거절.
  if (m * n > 4_000_000) return { ok: false, reason: 'TOO_LARGE' };

  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const pairs = new Map();
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pairs.set(i - 1, j - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  const keptNew = new Set(pairs.values());
  const changedNew = [];
  for (let k = 0; k < n; k++) if (!keptNew.has(k) && b[k]) changedNew.push(k);
  const removedOld = [];
  for (let k = 0; k < m; k++) if (!pairs.has(k)) removedOld.push(k);
  return { ok: true, pairs, changedNew, removedOld };
}

const ID_RE = /^(id|br|failed)_(\d+)_(.+)$/;

/**
 * processed_json의 토큰 ID를 새 줄번호로 리맵 — 유지 줄만 남기고(삭제·수정 줄
 * 토큰은 폐기: 그 줄은 재분석되거나 소멸), failed_indices도 함께 옮긴다.
 * 불변식: 리맵 후 ID 중복 0(두 옛 줄이 한 새 줄로 접히면 자료 훼손) — 위반 시 거절.
 */
export function remapProcessedJson(json, pairs) {
  const seq = json?.sequence || [];
  const dict = json?.dictionary || {};
  const newSeq = [];
  const newDict = {};
  for (const oldId of seq) {
    const m = oldId.match(ID_RE);
    if (!m) {
      // 패턴 밖 레거시 ID — 재사용 필터에는 안 걸리지만 데이터 유실은 막는다
      newSeq.push(oldId);
      newDict[oldId] = dict[oldId];
      continue;
    }
    const oldIdx = parseInt(m[2]);
    if (!pairs.has(oldIdx)) continue;
    const newIdx = pairs.get(oldIdx);
    const newId = `${m[1]}_${newIdx}_${m[3]}`;
    const token = dict[oldId];
    newSeq.push(newId);
    newDict[newId] = token?.failed ? { ...token, original_line_idx: newIdx } : token;
  }
  if (new Set(newSeq).size !== newSeq.length) return { ok: false, reason: 'DUP_ID' };
  const failed = [];
  for (const idx of json?.failed_indices || []) if (pairs.has(idx)) failed.push(pairs.get(idx));
  failed.sort((x, y) => x - y);
  return { ok: true, json: { ...json, sequence: newSeq, dictionary: newDict, failed_indices: failed } };
}

/**
 * 편집 저장 계획 — 문단 자동분리(멱등) → 줄 diff → 리맵 → 분석 대상 산출.
 * selected가 [-1]이면 "재조립 전용": 분석할 줄이 없지만 줄 구조(개행 배치)가
 * 바뀌어 파이프라인의 재조립만 필요한 경우다 — 어떤 줄과도 매칭되지 않는 센티널이라
 * 전 문단이 재사용 경로를 타고 API 호출이 0회다.
 */
export function buildEditPlan(oldTextRaw, draft, processedJson) {
  const newText = autoSplitParagraphs(String(draft ?? ''));
  const oldText = String(oldTextRaw ?? '');
  if (newText === oldText) return { ok: true, noop: true, newText };
  const d = diffLineMap(oldText.split('\n'), newText.split('\n'));
  if (!d.ok) return { ok: false, reason: '변경이 너무 큽니다 — 전체 분석을 사용해주세요.' };
  const base = processedJson || { sequence: [], dictionary: {}, failed_indices: [] };
  const r = remapProcessedJson(base, d.pairs);
  if (!r.ok) return { ok: false, reason: '기존 분석을 옮길 수 없습니다 — 전체 분석을 사용해주세요.' };
  // 바뀐/추가 줄 ∪ (리맵된) 기존 실패 줄 — 실패 줄은 어차피 깨져 있어 함께 재시도
  const toAnalyze = [...new Set([...d.changedNew, ...r.json.failed_indices])].sort((x, y) => x - y);
  return {
    ok: true,
    noop: false,
    newText,
    summary: { changed: d.changedNew.length, removed: d.removedOld.length },
    analyzeCount: toAnalyze.length,
    selected: toAnalyze.length ? toAnalyze : [-1],
    remapped: r.json,
  };
}
