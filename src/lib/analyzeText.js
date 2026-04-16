import { callGemini, parseGeminiJSON, buildTokenizationPrompt } from './gemini';

/**
 * 텍스트를 형태소 분석해 processed_json 구조를 생성합니다.
 *
 * - 일본어: /api/analyze (kuromoji + 공유 캐시) — 빠르고 저렴
 * - 영어: /api/gemini 기존 경로 (형태소 분석을 Gemini에 의존)
 * - 실패해도 절대 중단하지 않음. 실패 줄은 failed 플레이스홀더로 보존.
 * - existingJson 전달 시 failed_indices 줄만 재시도 (성공 토큰 재사용).
 */
export async function analyzeText(rawText, signal, { metadata = {}, onBatch, existingJson = null, concurrency = 6 } = {}) {
  const lang = metadata?.language || existingJson?.metadata?.language;
  // 일본어·영어 모두 공유 캐시 경로 사용 (Phase 2)
  if (lang === 'Japanese' || lang === 'English') {
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

  const isRetry = !!(existingJson?.failed_indices?.length);
  const failedSet = new Set(isRetry ? existingJson.failed_indices : []);

  // 1. 문단 분리 — 빈 줄 기준으로 그룹핑
  const paragraphs = []; // [{ lineIndices: [0,1,2], lines: ['...','...'] }]
  let currentPara = { lineIndices: [], lines: [] };
  for (let i = 0; i < total; i++) {
    if (!lines[i].trim()) {
      if (currentPara.lineIndices.length > 0) {
        paragraphs.push(currentPara);
        currentPara = { lineIndices: [], lines: [] };
      }
      paragraphs.push({ lineIndices: [i], lines: [''], empty: true });
    } else {
      currentPara.lineIndices.push(i);
      currentPara.lines.push(lines[i].trim());
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
    metadata: metadata || existingJson?.metadata || {},
    failed_indices: [],
  };

  let processedLines = 0;

  // 3. 문단 단위로 분석 → 즉시 DB 저장
  for (const para of paragraphs) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // 빈 줄 문단 → 개행만 추가
    if (para.empty) {
      const idx = para.lineIndices[0];
      const brId = `br_${idx}_${timestamp}`;
      currentJson.sequence.push(brId);
      currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
      currentJson.last_idx = idx;
      processedLines++;
      continue;
    }

    // 재시도 모드: 이 문단의 모든 줄이 성공 상태면 기존 토큰 재사용
    const needsAnalysis = para.lineIndices.some(i => !isRetry || failedSet.has(i));

    if (!needsAnalysis) {
      // 기존 토큰 복원
      for (const idx of para.lineIndices) {
        const prefixes = [`id_${idx}_`, `br_${idx}_`, `failed_${idx}_`];
        const existing = (existingJson?.sequence || []).filter(id =>
          prefixes.some(p => id.startsWith(p))
        );
        existing.forEach(id => {
          currentJson.sequence.push(id);
          currentJson.dictionary[id] = existingJson.dictionary[id];
        });
        currentJson.last_idx = idx;
      }
      // 문단 사이 개행
      const lastIdx = para.lineIndices[para.lineIndices.length - 1];
      if (lastIdx < total - 1) {
        const brId = `br_${lastIdx}_end_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
      }
      processedLines += para.lineIndices.length;
      continue;
    }

    // 서버로 문단 전송
    let response = null;
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        signal,
        body: JSON.stringify({ lines: para.lines, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      response = data;
    } catch (e) {
      if (signal?.aborted) throw e;
      console.error('[analyzeHybrid] paragraph failed:', e?.message);
    }

    // 문단 결과 조립
    for (let li = 0; li < para.lineIndices.length; li++) {
      const idx = para.lineIndices[li];
      const result = response?.results?.[li];

      if (result) {
        const newSeq = result.sequence.map((_, pi) => `id_${idx}_${pi}_${timestamp}`);
        result.sequence.forEach((srvId, pi) => {
          currentJson.sequence.push(newSeq[pi]);
          currentJson.dictionary[newSeq[pi]] = result.dictionary[srvId];
        });
      } else {
        // 실패
        const failedId = `failed_${idx}_${timestamp}`;
        currentJson.sequence.push(failedId);
        currentJson.dictionary[failedId] = {
          text: lines[idx],
          pos: '미분석',
          failed: true,
          original_line_idx: idx,
        };
        currentJson.failed_indices.push(idx);
      }

      // 줄 사이 개행
      if (idx < total - 1) {
        const brId = `br_${idx}_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
      }
      currentJson.last_idx = idx;
    }

    processedLines += para.lineIndices.length;

    // 문단 완료 → 즉시 DB 저장 (실시간 갱신)
    currentJson.metadata = {
      ...(currentJson.metadata || {}),
      updated_at: new Date().toISOString(),
    };
    await onBatch?.({ currentJson, processed: processedLines, total });
  }

  currentJson.status = currentJson.failed_indices.length > 0 ? 'partial' : 'completed';
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
            currentJson.dictionary[newId] = res.payload.dictionary[oldId];
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
      currentJson.status = currentJson.failed_indices.length > 0 ? 'partial' : 'completed';
    }
    currentJson.metadata = {
      ...(currentJson.metadata || {}),
      updated_at: new Date().toISOString(),
    };
    await onBatch?.({ currentJson, processed, total });
  }

  return currentJson;
}
