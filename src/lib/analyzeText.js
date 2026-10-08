import { callGemini, parseGeminiJSON, buildTokenizationPrompt } from './gemini';
import { canonizeTokenPos } from './server/posCanon';
import { boundaryParagraphRequest, readBoundaryEdits, settleBoundaryRecord } from './boundaryEdits';

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

  // 3. 문단 단위로 분석 → 즉시 DB 저장
  for (const para of paragraphs) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // 빈 줄 문단 → 개행만 추가
    if (para.empty) {
      const idx = para.lineIndices[0];
      if (!isKorean || idx < total - 1) {
        const brId = `br_${idx}_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = newlineToken(idx);
      }
      currentJson.last_idx = idx;
      processedLines++;
      continue;
    }

    // 재시도 모드: 이 문단의 모든 줄이 성공 상태면 기존 토큰 재사용
    const needsAnalysis = para.lineIndices.some(i => !isRetry || failedSet.has(i) || (isKorean && !reusableKoreanLine(i)));

    if (!needsAnalysis) {
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
      continue;
    }

    // 서버로 문단 전송
    const sentBoundaries = boundaryEdits.length ? boundaryParagraphRequest(boundaryEdits, para.lineIndices) : [];
    let response = null;
    try {
      const res = await fetch(isKorean ? '/api/analyze/korean' : '/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        signal,
        body: JSON.stringify({ lines: para.lines, language, ...(isKorean ? { explanationLocale } : {}),
          ...(sentBoundaries.length ? { boundaries: sentBoundaries.map(item => item.payload) } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (isKorean && (data?.metadata?.language !== language || data?.metadata?.explanationLocale !== explanationLocale ||
          data?.metadata?.analysisVersion !== 'ko-llm-v1')) throw new Error('analysis_metadata_mismatch');
      response = data;
    } catch (e) {
      if (signal?.aborted) throw e;
      console.error('[analyzeHybrid] paragraph failed:', e?.message);
    }

    // 문단 결과 조립
    for (let li = 0; li < para.lineIndices.length; li++) {
      const idx = para.lineIndices[li];
      const result = response?.results?.[li];

      const validKoreanLine = !isKorean || (Array.isArray(result?.sequence) && result?.dictionary &&
        result.sequence.map((id) => result.dictionary[id]?.text ?? '').join('') === lines[idx]);
      if (result && validKoreanLine) {
        const newSeq = result.sequence.map((_, pi) => `id_${idx}_${pi}_${timestamp}`);
        result.sequence.forEach((srvId, pi) => {
          currentJson.sequence.push(newSeq[pi]);
          const token = result.dictionary[srvId];
          currentJson.dictionary[newSeq[pi]] = isKorean ? { ...token,
            ...(token.sourceSpan ? { sourceSpan: { ...token.sourceSpan, lineIndex: idx,
              start: lineOffsets[idx] + token.sourceSpan.start, end: lineOffsets[idx] + token.sourceSpan.end,
              lineStart: token.sourceSpan.start, lineEnd: token.sourceSpan.end } } : {}),
            ...(token.selectionGroup ? { selectionGroup: `ko_${idx}_${token.sourceSpan?.start}_${token.sourceSpan?.end}` } : {}),
            ...(token.failed ? { original_line_idx: idx } : {}),
          } : token;
        });
        if (isKorean && (result.failed || result.sequence.some((id) => result.dictionary[id]?.failed))) {
          currentJson.failed_indices.push(idx);
        }
        // 경계 기록 갱신 — 서버가 줄마다 받은 순서대로 boundaryApplied를 돌려준다. base 새 id는 `id_<줄>_b<k>_<시각>`.
        let baseSeq = 0;
        sentBoundaries.filter(item => item.payload.line === li).forEach((item, k) => {
          boundaryEdits[item.index] = settleBoundaryRecord(boundaryEdits[item.index], result.boundaryApplied?.[k],
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

    // 문단 완료 → 즉시 DB 저장 (실시간 갱신)
    currentJson.metadata = {
      ...(currentJson.metadata || {}),
      updated_at: new Date().toISOString(),
    };
    await onBatch?.({ currentJson, processed: processedLines, total });
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
