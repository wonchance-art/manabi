import { callGemini, parseGeminiJSON, buildTokenizationPrompt } from './gemini';
import { canonizeTokenPos } from './server/posCanon';
import { boundaryParagraphRequest, compactBoundaryText, readBoundaryEdits, settleBoundaryRecord } from './boundaryEdits';
import { locateLineTokens, splitSentenceRanges } from './viewerSentenceLine';
import { applyMaterialRubyLocks } from './aozoraRuby';
import { applyMaterialReviewHints } from './literatureReviewHints';

// /api/analyze 입력 캡 미러 — route.js의 MAX_LINES·MAX_LINE_LEN과 같은 값(analyzeLongLines.test.js가 핀).
// 서버는 캡을 넘은 줄에 truncated 표식을 단다. 자료 분석은 캡 안으로 나눠 보내 표식이 오지 않게 한다.
export const ANALYZE_MAX_LINES = 100;
export const ANALYZE_MAX_LINE_LEN = 200;
// 문단을 넘어 한 요청에 묶을 때의 요청당 글자 예산(중·일·영). 서버에는 글자 캡이 없지만 요청당 예산이 있다 —
// 문맥 품사 판별 MAX_MARKS=120(중·영) · 뜻 조회 MAX_MISSING=100 · 35초 마감. 넘친 단어는 문맥 품사·뜻 없이 저장되므로
// 100줄을 꽉 채우지 않고 예산 안에서 묶는다. 실측(2026-10-12, 실제 토크나이저): 중국어 판별 대상 ≈0.24개/자 → 400자 ≈ 100개,
// 영어(사전 채워진 상태) ≈0.05개/자 → 2000자 ≈ 100개, 일본어는 판별이 없어 뜻 조회(캐시 의존)만 — 800자.
export const ANALYZE_PACK_MAX_CHARS = { Chinese: 400, Japanese: 800, English: 2000 };
// 429(분당 20회 초과) — Retry-After(초)만큼 기다렸다가 다시 보낸다. 값이 없거나 이상하면 기본, 너무 길면 상한.
export const RATE_LIMIT_RETRIES = 2;
const RETRY_AFTER_DEFAULT_SEC = 5;
const RETRY_AFTER_MAX_SEC = 60;
const CLAUSE_END = /[、，,;；:：]/u;
const SPACE = /\s/u;

/**
 * 서버 줄 캡을 넘는 줄(중·일·영)을 요청 조각 [{start, end}](UTF-16, end 제외)로 나눈다. 캡 안이면 줄 전체 한 조각.
 * 칼선 우선순위: 문장 끝(splitSentenceRanges — 문장을 캡 안에서 최대한 묶는다) → 공백 → 、，,;: 뒤 → 캡 자리.
 * canCut(p)가 false인 자리(단어 경계 기록 구간 안)는 자르지 않는다. 조각 양 끝 공백은 뺀다(공백은 토큰이 아니다).
 */
export function splitAnalysisLine(line, { language, maxLen = ANALYZE_MAX_LINE_LEN, canCut = () => true } = {}) {
  const text = String(line ?? '');
  if (text.length <= maxLen) return [{ start: 0, end: text.length }];
  const sentenceEnds = new Set(splitSentenceRanges(text, { language }).map((range) => range.end));
  const tests = [(p) => sentenceEnds.has(p), (p) => SPACE.test(text[p]), (p) => CLAUSE_END.test(text[p - 1]), () => true];
  const segments = [];
  let start = 0;
  for (;;) {
    while (start < text.length && SPACE.test(text[start])) start += 1;
    if (start >= text.length) break;
    let end = text.length;
    if (end - start > maxLen) {
      const limit = start + maxLen;
      const cutAt = (test) => {
        for (let p = limit; p > start; p -= 1) {
          const code = text.charCodeAt(p);
          if (code >= 0xDC00 && code <= 0xDFFF) continue; // 서로게이트 쌍 안쪽은 자르지 않는다
          if (test(p) && canCut(p)) return p;
        }
        return -1;
      };
      end = tests.reduce((found, test) => (found > 0 ? found : cutAt(test)), -1);
      if (end < 0) end = limit; // 모든 자리가 기록 구간 안(기록은 40자 이하라 실제로는 없다) — 그 기록은 pending이 된다
    }
    let trimmed = end;
    while (trimmed > start && SPACE.test(text[trimmed - 1])) trimmed -= 1;
    segments.push({ start, end: trimmed });
    start = end;
  }
  return segments.length ? segments : [{ start: 0, end: text.length }];
}

/**
 * 요청 줄 하나(앞뒤 공백 뺀 원문 줄)를 조각 [{text, offset, sent: []}]로 — 칼선은 단어 경계 기록 구간 안에 두지 않는다.
 * offset = 조각 앞의 공백 뺀 글자 수(기록 좌표 단위 · 조각 좌표 + offset = 줄 좌표). records = 그 줄 기록 [{start, end}](줄 좌표).
 * homes[k] = 기록 k를 실을 조각(한 조각이면 그 조각, 여러 조각이면 구간이 다 든 조각, 없으면 null).
 * 자료 분석(analyzeHybrid)과 경계 편집(boundaryEditFlow.commitBoundaryEdit)이 같이 쓴다 — 두 경로의 조각이 갈리지 않게.
 */
export function analysisLineUnits(text, records = [], { language, split = true } = {}) {
  const at = p => compactBoundaryText(text.slice(0, p)).length;
  const ranges = split ? splitAnalysisLine(text, { language,
    canCut: p => !records.some(record => record.start < at(p) && at(p) < record.end) }) : [{ start: 0, end: text.length }];
  const units = ranges.map(range => ({ text: text.slice(range.start, range.end), offset: at(range.start), sent: [] }));
  const homes = records.map(({ start, end }) => (units.length === 1 ? units[0] : units.find(unit => Number.isInteger(start)
    && Number.isInteger(end) && start >= unit.offset && end <= unit.offset + compactBoundaryText(unit.text).length)) ?? null);
  return { units, homes };
}

/** 기록 요청 항목(줄 좌표) → 요청 line번째 조각 좌표. offset 0이면 좌표 그대로(줄 번호만). */
export const boundaryToUnit = (payload, unit, line) => (unit.offset ? { ...payload, line, start: payload.start - unit.offset,
  end: payload.end - unit.offset, cuts: Array.isArray(payload.cuts) ? payload.cuts.map(cut => cut - unit.offset) : payload.cuts }
  : { ...payload, line });

/** 서버 boundaryApplied 항목(조각 좌표) → 줄 좌표. applied가 아니거나 offset 0이면 그대로. */
export const boundaryFromUnit = (applied, unit) => (unit?.offset && applied?.status === 'applied' && Number.isInteger(applied.start)
  && Number.isInteger(applied.end) && Array.isArray(applied.cuts)
  ? { ...applied, start: applied.start + unit.offset, end: applied.end + unit.offset, cuts: applied.cuts.map(cut => cut + unit.offset) }
  : applied);

/** 429 응답의 Retry-After(초)를 기다릴 ms로 — 없거나 숫자가 아니면 기본 5초, 1~60초로 자른다. headers가 없는 응답도 받는다. */
export function retryAfterMs(res) {
  let raw = null;
  try { raw = res?.headers?.get?.('Retry-After') ?? null; } catch { raw = null; }
  const text = raw == null ? '' : String(raw).trim();
  const sec = /^\d+(\.\d+)?$/.test(text) ? Number(text) : RETRY_AFTER_DEFAULT_SEC;
  return Math.min(Math.max(sec, 1), RETRY_AFTER_MAX_SEC) * 1000;
}

/** ms 기다리기 — signal이 끊기면 곧바로 AbortError. */
function waitAbortable(ms, signal) {
  return new Promise((resolve, reject) => {
    const abortError = () => new DOMException('Aborted', 'AbortError');
    if (signal?.aborted) { reject(abortError()); return; }
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { signal?.removeEventListener?.('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

/** fetch — 429면 Retry-After만큼 기다렸다가 RATE_LIMIT_RETRIES번까지 다시 보낸다. 그래도 429면 그 응답을 돌려준다(호출부가 실패 처리). */
export async function fetchWithRateLimitRetry(url, init, signal) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, init);
    if (res?.status !== 429 || attempt >= RATE_LIMIT_RETRIES) return res;
    await waitAbortable(retryAfterMs(res), signal);
  }
}

/**
 * 분석 토큰이 줄 전체를 덮는가 — 잘리거나 어긋난 줄을 '완료'로 저장하지 않는다(커버리지 정본 inspectAnalysisCoverage 쪽 판정).
 * 토큰은 줄 안에 순서대로 있어야 하고, 토큰 사이·뒤 빈틈은 일·중이면 공백뿐, 영어면 영숫자가 없어야 한다
 * (영어 토크나이저는 공백과 — ’ % 같은 기호를 토큰으로 내지 않는다 — 그 빈틈까지 실패로 보면 정상 줄이 깨진다).
 */
export function tokensCoverLine(line, texts, language) {
  const spots = locateLineTokens(line, texts);
  if (spots.some((spot, k) => !spot && texts[k] && texts[k] !== '\n')) return false;
  const gapOk = (gap) => (language === 'English' ? !/[A-Za-z0-9]/.test(gap) : !gap.trim());
  let cursor = 0;
  for (const spot of spots) {
    if (!spot) continue;
    if (!gapOk(line.slice(cursor, spot.start))) return false;
    cursor = spot.end;
  }
  return gapOk(line.slice(cursor));
}

/**
 * 텍스트를 형태소 분석해 processed_json 구조를 생성합니다.
 *
 * - 일본어: /api/analyze (kuromoji + 공유 캐시) — 빠르고 저렴
 * - 영어: /api/gemini 기존 경로 (형태소 분석을 Gemini에 의존)
 * - 실패해도 절대 중단하지 않음. 실패 줄은 failed 플레이스홀더로 보존.
 * - existingJson 전달 시 failed_indices 줄만 재시도 (성공 토큰 재사용).
 */
/**
 * 최종 상태 판정 — 성공 토큰이 하나도 없으면 'failed'.
 * 전량 실패를 'partial'로 두면 UI가 "분석 완료(재시도 필요)"라고 말해 실패를 가린다
 * (#969 — 중국어 EPUB 전량 실패가 '완료'로 표시된 사고).
 */
export function resolveAnalysisStatus(dictionary, failedCount, totalLines) {
  const hasSuccess = Object.values(dictionary || {}).some((t) => t && !t.failed && t.pos !== '개행');
  if (totalLines > 0 && !hasSuccess) return 'failed';
  return failedCount > 0 ? 'partial' : 'completed';
}

export async function analyzeText(rawText, signal, { metadata = {}, onBatch, existingJson = null, concurrency = 6 } = {}) {
  const lang = metadata?.language || existingJson?.metadata?.language;
  // 일본어·영어 모두 공유 캐시 경로 사용 (Phase 2)
  if (lang === 'Japanese' || lang === 'English' || lang === 'Chinese') {
    return analyzeHybrid(rawText, signal, { metadata, onBatch, existingJson, language: lang });
  }
  if (lang === 'Korean') {
    return analyzeHybrid(rawText, signal, { metadata, onBatch, existingJson, language: lang });
  }
  // 기타 언어는 기존 Gemini per-line (fallback)
  return analyzeLineByLineGemini(rawText, signal, { metadata, onBatch, existingJson, concurrency });
}

/* ─────────────────────────────────────────────────────────────
 * 일본어/영어: /api/analyze 엔드포인트 사용 (kuromoji or 공백 분할 + 공유 캐시)
 * ─────────────────────────────────────────────────────────────*/
async function analyzeHybrid(rawText, signal, { metadata, onBatch, existingJson, language }) {
  const lines = rawText.split('\n');
  const total = lines.length;
  const timestamp = Date.now();
  const isKorean = language === 'Korean';
  const explanationLocale = metadata?.explanationLocale ?? existingJson?.metadata?.explanationLocale ?? 'ko';
  const lineOffsets = [];
  let sourceOffset = 0;
  for (const line of lines) {
    lineOffsets.push(sourceOffset);
    sourceOffset += line.length + 1;
  }
  const newlineToken = (idx) => ({ text: '\n', pos: '개행', ...(isKorean ? {
    surface: '\n', language, sourceSpan: { start: lineOffsets[idx] + lines[idx].length,
      end: lineOffsets[idx] + lines[idx].length + 1, unit: 'utf16', lineIndex: idx },
  } : {}) });

  const isRetry = !!(existingJson?.failed_indices?.length) && (!isKorean ||
    (existingJson?.metadata?.language === language && existingJson?.metadata?.explanationLocale === explanationLocale &&
      existingJson?.metadata?.analysisVersion === 'ko-llm-v1'));
  const failedSet = new Set(isRetry ? existingJson.failed_indices : []);
  const existingLineIds = (idx) => (existingJson?.sequence || []).filter(id =>
    [`id_${idx}_`, `br_${idx}_`, `failed_${idx}_`].some(prefix => id.startsWith(prefix)));
  const reusableKoreanLine = (idx) => {
    const tokens = existingLineIds(idx).map(id => existingJson.dictionary?.[id]).filter(token => token?.pos !== '개행');
    let offset = 0;
    for (const token of tokens) {
      if (!token || token.failed || typeof token.text !== 'string' || token.sourceSpan?.unit !== 'utf16' ||
          token.sourceSpan.lineStart !== offset || token.sourceSpan.lineEnd !== offset + token.text.length) return false;
      offset += token.text.length;
    }
    return offset === lines[idx].length && tokens.map(token => token.text).join('') === lines[idx];
  };

  // 1. 문단 분리 — 빈 줄 기준으로 그룹핑
  const paragraphs = []; // [{ lineIndices: [0,1,2], lines: ['...','...'] }]
  let currentPara = { lineIndices: [], lines: [] };
  for (let i = 0; i < total; i++) {
    if (isKorean ? lines[i] === '' : !lines[i].trim()) {
      if (currentPara.lineIndices.length > 0) {
        paragraphs.push(currentPara);
        currentPara = { lineIndices: [], lines: [] };
      }
      paragraphs.push({ lineIndices: [i], lines: [''], empty: true });
    } else {
      // 한국어 요청은 단일 LLM 출력 캡 안의 작은 배치. 긴 줄은 별도 요청에서 정직하게 실패한다.
      if (isKorean && currentPara.lines.length && (currentPara.lines.length >= 8 || lines[i].length > 200 ||
          currentPara.lines.some((line) => line.length > 200) ||
          currentPara.lines.reduce((sum, line) => sum + line.length, 0) + lines[i].length > 1600)) {
        paragraphs.push(currentPara);
        currentPara = { lineIndices: [], lines: [] };
      }
      currentPara.lineIndices.push(i);
      currentPara.lines.push(isKorean ? lines[i] : lines[i].trim());
    }
  }
  if (currentPara.lineIndices.length > 0) paragraphs.push(currentPara);

  // 2. auth 토큰 미리 가져오기
  let authHeader = {};
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authHeader = { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {}

  let currentJson = {
    sequence: [],
    dictionary: {},
    last_idx: -1,
    status: 'analyzing',
    metadata: isKorean ? { ...(existingJson?.metadata || {}), ...metadata, language, targetLanguage: 'ko',
      explanationLocale, analysisVersion: 'ko-llm-v1', analysisEngine: 'llm', analysisQuality: 'unreviewed' }
      : metadata || existingJson?.metadata || {},
    failed_indices: [],
  };
  // AD-R3 단어 경계(§3.5): 재분석이 넘긴 metadata.viewerBoundaries(줄 번호는 이미 새 원문 기준)를 문단 요청에 싣고,
  // 서버 적용 결과로 기록을 갱신한다. 한국어는 승인 밖이라 싣지도 바꾸지도 않는다. 기록이 없으면 요청·결과가 현행 그대로다.
  const boundaryEdits = isKorean ? [] : [...readBoundaryEdits(currentJson)];

  let processedLines = 0;

  // 3. 문단 계획 — 분석할 문단은 요청 줄(조각)을 미리 만든다. 서버 줄 캡(ANALYZE_MAX_LINE_LEN)을 넘는 중·일·영 줄은 문장 단위
  // 조각으로 나눠 보내고 결과를 원래 줄로 잇는다(id_<줄>_<순번>은 줄 안에서 이어 매긴다 — 보통 분석한 줄과 같은 모양).
  // 경계 기록은 그 구간이 든 조각에 조각 좌표로 싣고, 칼선은 기록 구간 안에 두지 않는다. 한국어는 나누지 않는다(현행).
  const homeOf = new Map(); // 기록 항목 → 실은 조각
  const allSent = []; // 실은 기록 항목(문단 순서 · 문단 안은 기록 목록 순서)
  const plans = paragraphs.map((para) => {
    if (para.empty) return { para, kind: 'empty' };
    // 재시도 모드: 이 문단의 모든 줄이 성공 상태면 기존 토큰 재사용
    if (!para.lineIndices.some(i => !isRetry || failedSet.has(i) || (isKorean && !reusableKoreanLine(i)))) return { para, kind: 'reuse' };
    const sentBoundaries = boundaryEdits.length ? boundaryParagraphRequest(boundaryEdits, para.lineIndices) : [];
    const units = []; // 요청 한 줄 = {text, offset(조각 앞 공백 뺀 글자 수), sent(이 조각에 실은 기록, 기록 목록 순서)}
    const lineUnits = para.lines.map((text, li) => {
      const records = sentBoundaries.filter(item => item.payload.line === li);
      // 한 조각이면 지금처럼 그 줄 기록을 모두 싣는다(옮김·pending은 서버가 정한다). 여러 조각이면 구간이 든 조각에만.
      const { units: own, homes } = analysisLineUnits(text, records.map(item => item.payload), { language, split: !isKorean });
      units.push(...own);
      records.forEach((item, k) => { if (homes[k]) { homes[k].sent.push(item); homeOf.set(item, homes[k]); } });
      return own;
    });
    allSent.push(...sentBoundaries);
    return { para, kind: 'analyze', sentBoundaries, units, lineUnits };
  });

  // 4. 요청 묶기 — 중·일·영은 분석할 문단의 조각을 문단을 넘어 한 요청에 묶는다(≤ANALYZE_MAX_LINES줄 · 언어별 글자 예산).
  // 서버는 사용자당 분당 20회라, 문단마다 한 번씩 보내면 20문단 넘는 자료가 429로 partial이 됐다(2026-10-12 실계정 재현).
  // 재사용 문단은 보내지 않는다. 한국어는 문단(8줄 · 1600자 배치) = 요청 그대로다.
  const charBudget = ANALYZE_PACK_MAX_CHARS[language] ?? ANALYZE_PACK_MAX_CHARS.English;
  const requests = [];
  let chunk = null;
  for (const plan of plans) {
    if (plan.kind !== 'analyze') continue;
    if (isKorean) chunk = null;
    for (const unit of plan.units) {
      if (!chunk || chunk.units.length >= ANALYZE_MAX_LINES
          || (!isKorean && chunk.units.length && chunk.chars + unit.text.length > charBudget)) {
        chunk = { units: [], chars: 0 };
        requests.push(chunk);
      }
      chunk.units.push(unit);
      chunk.chars += unit.text.length;
    }
  }

  // 5. 조립 — 문단 순서 그대로. 분석 문단은 조각 결과가 다 모였을 때 잇는다(문단이 요청 둘에 걸칠 수 있다).
  const unitResults = new Map();
  const emit = (plan) => {
    const { para } = plan;
    // 빈 줄 문단 → 개행만 추가
    if (plan.kind === 'empty') {
      const idx = para.lineIndices[0];
      if (!isKorean || idx < total - 1) {
        const brId = `br_${idx}_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = newlineToken(idx);
      }
      currentJson.last_idx = idx;
      processedLines++;
      return;
    }

    if (plan.kind === 'reuse') {
      // 기존 토큰 복원
      for (const idx of para.lineIndices) {
        const prefixes = [`id_${idx}_`, `br_${idx}_`, `failed_${idx}_`];
        const existing = (existingJson?.sequence || []).filter(id =>
          prefixes.some(p => id.startsWith(p))
        );
        existing.forEach(id => {
          currentJson.sequence.push(id);
          const token = existingJson.dictionary[id];
          currentJson.dictionary[id] = isKorean ? (token.pos === '개행' ? newlineToken(idx) : { ...token,
            sourceSpan: { ...token.sourceSpan, lineIndex: idx,
              start: lineOffsets[idx] + token.sourceSpan.lineStart, end: lineOffsets[idx] + token.sourceSpan.lineEnd },
          }) : token;
        });
        currentJson.last_idx = idx;
      }
      // 문단 사이 개행
      const lastIdx = para.lineIndices[para.lineIndices.length - 1];
      if (!isKorean && lastIdx < total - 1) {
        const brId = `br_${lastIdx}_end_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
      }
      processedLines += para.lineIndices.length;
      return;
    }

    // 문단 결과 조립
    const { sentBoundaries, lineUnits } = plan;
    for (let li = 0; li < para.lineIndices.length; li++) {
      const idx = para.lineIndices[li];
      const results = lineUnits[li].map(unit => unitResults.get(unit));
      const result = results[0];

      // 한국어: 토큰을 이으면 원문 줄과 같아야 한다(현행). 중·일·영: 조각이 하나라도 없거나 잘렸거나(truncated)
      // 줄을 다 덮지 못하면 실패(복구 가능)로 남긴다 — 뒷부분이 사라진 줄을 조용히 '완료'로 저장하지 않는다.
      const validLine = isKorean
        ? !!result && Array.isArray(result.sequence) && !!result.dictionary &&
          result.sequence.map((id) => result.dictionary[id]?.text ?? '').join('') === lines[idx]
        : results.every(item => item && Array.isArray(item.sequence) && item.dictionary && !item.truncated) &&
          tokensCoverLine(para.lines[li], results.flatMap(item => item.sequence.map(id => item.dictionary[id]?.text ?? '')), language);
      if (validLine) {
        let pi = 0;
        for (const item of results) {
          for (const srvId of item.sequence) {
            const newId = `id_${idx}_${pi++}_${timestamp}`;
            currentJson.sequence.push(newId);
            const token = item.dictionary[srvId];
            currentJson.dictionary[newId] = isKorean ? { ...token,
              ...(token.sourceSpan ? { sourceSpan: { ...token.sourceSpan, lineIndex: idx,
                start: lineOffsets[idx] + token.sourceSpan.start, end: lineOffsets[idx] + token.sourceSpan.end,
                lineStart: token.sourceSpan.start, lineEnd: token.sourceSpan.end } } : {}),
              ...(token.selectionGroup ? { selectionGroup: `ko_${idx}_${token.sourceSpan?.start}_${token.sourceSpan?.end}` } : {}),
              ...(token.failed ? { original_line_idx: idx } : {}),
            } : token;
          }
        }
        if (isKorean && (result.failed || result.sequence.some((id) => result.dictionary[id]?.failed))) {
          currentJson.failed_indices.push(idx);
        }
        // 경계 기록 갱신 — 서버가 조각마다 받은 순서대로 boundaryApplied를 돌려준다. 좌표는 줄 좌표로 되돌린다.
        // base 새 id는 `id_<줄>_b<k>_<시각>`. 실을 조각이 없던 기록은 조용히 버리지 않고 pending(settleBoundaryRecord).
        let baseSeq = 0;
        sentBoundaries.filter(item => item.payload.line === li).forEach((item) => {
          const unit = homeOf.get(item);
          const applied = unit ? unitResults.get(unit)?.boundaryApplied?.[unit.sent.indexOf(item)] : undefined;
          const shifted = boundaryFromUnit(applied, unit);
          boundaryEdits[item.index] = settleBoundaryRecord(boundaryEdits[item.index], shifted,
            () => `id_${idx}_b${baseSeq++}_${timestamp}`);
        });
      } else {
        // 실패
        const failedId = `failed_${idx}_${timestamp}`;
        currentJson.sequence.push(failedId);
        currentJson.dictionary[failedId] = {
          text: lines[idx],
          pos: isKorean ? null : '미분석',
          failed: true,
          original_line_idx: idx,
          ...(isKorean ? { surface: lines[idx], language, explanationLocale, analysisVersion: 'ko-llm-v1',
            sourceSpan: { start: lineOffsets[idx], end: lineOffsets[idx] + lines[idx].length,
              lineStart: 0, lineEnd: lines[idx].length, unit: 'utf16', lineIndex: idx } } : {}),
        };
        currentJson.failed_indices.push(idx);
      }

      // 줄 사이 개행
      if (idx < total - 1) {
        const brId = `br_${idx}_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = newlineToken(idx);
      }
      currentJson.last_idx = idx;
    }

    processedLines += para.lineIndices.length;
    if (sentBoundaries.length) {
      currentJson.metadata = { ...currentJson.metadata, viewerBoundaries: { ...currentJson.metadata.viewerBoundaries, edits: [...boundaryEdits] } };
    }
  };
  let emitted = 0;
  const emitReady = () => {
    const before = emitted;
    while (emitted < plans.length && (plans[emitted].kind !== 'analyze'
        || plans[emitted].units.every(unit => unitResults.has(unit)))) emit(plans[emitted++]);
    return emitted > before;
  };

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  for (const { units } of requests) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const sent = new Set(units);
    const boundariesBody = allSent.filter(item => sent.has(homeOf.get(item)))
      .map(item => boundaryToUnit(item.payload, homeOf.get(item), units.indexOf(homeOf.get(item))));
    let response = null;
    try {
      const res = await fetchWithRateLimitRetry(isKorean ? '/api/analyze/korean' : '/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        signal,
        body: JSON.stringify({ lines: units.map(unit => unit.text), language, ...(isKorean ? { explanationLocale } : {}),
          ...(boundariesBody.length ? { boundaries: boundariesBody } : {}) }),
      }, signal);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (isKorean && (data?.metadata?.language !== language || data?.metadata?.explanationLocale !== explanationLocale ||
          data?.metadata?.analysisVersion !== 'ko-llm-v1')) throw new Error('analysis_metadata_mismatch');
      response = data;
    } catch (e) {
      if (signal?.aborted) throw e;
      console.error('[analyzeHybrid] request failed:', e?.message);
    }
    units.forEach((unit, k) => unitResults.set(unit, response?.results?.[k] ?? null));

    // 요청 완료 → 다 모인 문단까지 잇고 즉시 DB 저장(실시간 갱신 · 뒤 요청이 실패해도 앞 진행은 남는다)
    if (emitReady()) {
      currentJson.metadata = {
        ...(currentJson.metadata || {}),
        updated_at: new Date().toISOString(),
      };
      await onBatch?.({ currentJson, processed: processedLines, total });
    }
  }
  emitReady();

  // 저자 루비 잠금(아오조라 정본 책, 설계 §3.3) — 유일한 분석 경로 끝에서 적용해 재분석·재시도에도 다시 덮인다.
  // metadata.literature.rubyLocks가 없으면 무변경. 정확히 한 토큰과 맞는 루비만, 원문과 어긋나면 하나도 적용하지 않는다.
  if (language === 'Japanese') {
    const locked = applyMaterialRubyLocks(rawText, currentJson);
    if (locked.diagnostics?.skipped) console.warn('[analyzeHybrid] ruby locks skipped:', locked.diagnostics.skipped);
    currentJson = locked.json;
    // 정본 책 검수 힌트(AOZORA-P0-4) — 「뜻 확인 필요」 표식 + 문맥 뜻 제안만 붙인다(뜻은 그대로, 관리자가 목록에서 확정).
    currentJson = applyMaterialReviewHints(rawText, currentJson).json;
  }

  currentJson.status = resolveAnalysisStatus(currentJson.dictionary, currentJson.failed_indices.length, total);
  currentJson.metadata = {
    ...(currentJson.metadata || {}),
    updated_at: new Date().toISOString(),
  };
  await onBatch?.({ currentJson, processed: total, total });

  return currentJson;
}

/* ─────────────────────────────────────────────────────────────
 * 영어: 기존 Gemini per-line 경로 (Phase 2에선 그대로 유지)
 * ─────────────────────────────────────────────────────────────*/
async function analyzeLineByLineGemini(rawText, signal, { metadata, onBatch, existingJson, concurrency }) {
  const lines = rawText.split('\n');
  const total = lines.length;
  const lang = metadata?.language || existingJson?.metadata?.language || 'Japanese';
  const timestamp = Date.now();
  let currentConcurrency = concurrency;
  const MIN_CONCURRENCY = 2;
  let capacityErrorStreak = 0;

  const isRetry = !!(existingJson?.failed_indices?.length);
  const failedSet = new Set(isRetry ? existingJson.failed_indices : []);

  let currentJson = {
    sequence: [],
    dictionary: {},
    last_idx: -1,
    status: 'analyzing',
    metadata: metadata || existingJson?.metadata || {},
    failed_indices: [],
  };

  for (let i = 0; i < total; i += currentConcurrency) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const batchIndices = [];
    for (let j = 0; j < currentConcurrency && i + j < total; j++) batchIndices.push(i + j);

    const promises = batchIndices.map(async (idx) => {
      const line = lines[idx].trim();
      if (!line) return { idx, type: 'empty' };
      if (isRetry && !failedSet.has(idx)) return { idx, type: 'reuse' };

      const MAX_ATTEMPTS = 5;
      let lastError = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const raw = await callGemini(buildTokenizationPrompt(line, lang), signal);
          const payload = parseGeminiJSON(raw);
          return { idx, type: 'success', payload, line };
        } catch (e) {
          lastError = e;
          if (signal?.aborted) throw e;
          if (attempt < MAX_ATTEMPTS - 1) {
            const msg = (e.message || '').toLowerCase();
            const isCapacity = msg.includes('high demand') || msg.includes('overloaded') ||
              msg.includes('unavailable') || msg.includes('503') || msg.includes('resource_exhausted');
            const isRate = msg.includes('429') || msg.includes('too many') || msg.includes('요청이 너무');
            const baseDelay = isCapacity ? 5000 : isRate ? 2000 : 1000;
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }
      console.error(`[analyzeText] line ${idx} permanently failed: ${lastError?.message}`);
      return { idx, type: 'failed', line };
    });

    const results = await Promise.all(promises);

    const failedInBatch = results.filter(r => r.type === 'failed').length;
    if (failedInBatch >= batchIndices.length / 2) {
      capacityErrorStreak++;
      if (capacityErrorStreak >= 2 && currentConcurrency > MIN_CONCURRENCY) {
        const newConc = Math.max(MIN_CONCURRENCY, Math.floor(currentConcurrency / 2));
        console.warn(`[analyzeText] capacity pressure. concurrency ${currentConcurrency} → ${newConc}`);
        currentConcurrency = newConc;
        capacityErrorStreak = 0;
        await new Promise(r => setTimeout(r, 3000));
      }
    } else {
      capacityErrorStreak = 0;
    }

    for (const res of results) {
      if (!res) continue;
      switch (res.type) {
        case 'empty':
          if (res.idx < total - 1) {
            const brId = `br_${res.idx}_${timestamp}`;
            currentJson.sequence.push(brId);
            currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
          }
          currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
          break;
        case 'reuse': {
          const prefix1 = `id_${res.idx}_`;
          const prefix2 = `br_${res.idx}_`;
          const prefix3 = `failed_${res.idx}_`;
          const existing = (existingJson?.sequence || []).filter(id =>
            id.startsWith(prefix1) || id.startsWith(prefix2) || id.startsWith(prefix3)
          );
          existing.forEach(id => {
            currentJson.sequence.push(id);
            currentJson.dictionary[id] = existingJson.dictionary[id];
          });
          currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
          break;
        }
        case 'success': {
          res.payload.sequence.forEach((oldId, pIdx) => {
            const newId = `id_${res.idx}_${pIdx}_${timestamp}`;
            currentJson.sequence.push(newId);
            // X 게이트: 모델이 준 pos가 정본 밖이면 토큰은 살리고 pos만 null(「미상」 관례)
            currentJson.dictionary[newId] = canonizeTokenPos(res.payload.dictionary[oldId], lang);
          });
          if (res.idx < total - 1) {
            const brId = `br_${res.idx}_${timestamp}`;
            currentJson.sequence.push(brId);
            currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
          }
          currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
          break;
        }
        case 'failed': {
          const failedId = `failed_${res.idx}_${timestamp}`;
          currentJson.sequence.push(failedId);
          currentJson.dictionary[failedId] = {
            text: res.line,
            pos: '미분석',
            failed: true,
            original_line_idx: res.idx,
          };
          if (res.idx < total - 1) {
            const brId = `br_${res.idx}_${timestamp}`;
            currentJson.sequence.push(brId);
            currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
          }
          currentJson.failed_indices.push(res.idx);
          currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
          break;
        }
      }
    }

    const processed = Math.min(i + currentConcurrency, total);
    const isLast = batchIndices[batchIndices.length - 1] >= total - 1;
    if (isLast) {
      currentJson.status = resolveAnalysisStatus(currentJson.dictionary, currentJson.failed_indices.length, total);
    }
    currentJson.metadata = {
      ...(currentJson.metadata || {}),
      updated_at: new Date().toISOString(),
    };
    await onBatch?.({ currentJson, processed, total });
  }

  return currentJson;
}
