import { callGemini, parseGeminiJSON, buildTokenizationPrompt } from './gemini';

/**
 * 텍스트를 형태소 분석해 processed_json 구조를 생성합니다.
 *
 * - 실패해도 절대 중단하지 않음. 실패 줄은 failed 플레이스홀더로 보존.
 * - existingJson 전달 시 failed_indices 줄만 재시도 (성공 토큰 재사용).
 *
 * @param {string}      rawText
 * @param {AbortSignal} signal
 * @param {Object}      options
 * @param {Object}      options.metadata
 * @param {function}    options.onBatch   - ({ currentJson, processed, total }) => Promise<void>
 * @param {Object|null} options.existingJson - 재시도 시 기존 JSON 전달
 */
export async function analyzeText(rawText, signal, { metadata = {}, onBatch, existingJson = null } = {}) {
  const lines = rawText.split('\n');
  const total = lines.length;
  const timestamp = Date.now();
  const CONCURRENCY = 3;

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

  for (let i = 0; i < total; i += CONCURRENCY) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const batchIndices = [];
    for (let j = 0; j < CONCURRENCY && i + j < total; j++) batchIndices.push(i + j);

    const promises = batchIndices.map(async (idx) => {
      const line = lines[idx].trim();

      // 빈 줄
      if (!line) return { idx, type: 'empty' };

      // 재시도 모드: 실패하지 않은 줄은 기존 토큰 재사용
      if (isRetry && !failedSet.has(idx)) {
        return { idx, type: 'reuse' };
      }

      // Gemini 호출 (progressive backoff: 2s → 5s → 10s)
      const delays = [2000, 5000, 10000];
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const raw = await callGemini(buildTokenizationPrompt(line), signal);
          const payload = parseGeminiJSON(raw);
          return { idx, type: 'success', payload, line };
        } catch (e) {
          lastError = e;
          if (signal?.aborted) throw e;
          if (attempt < 2) {
            const isRate = e.message?.includes('429') || e.message?.includes('요청이 너무 많습니다');
            console.warn(`[analyzeText] line ${idx} attempt ${attempt + 1} failed: ${e.message}`);
            await new Promise(r => setTimeout(r, isRate ? delays[attempt] * 2 : delays[attempt]));
          }
        }
      }
      // 3회 모두 실패 → 실패 플레이스홀더
      console.error(`[analyzeText] line ${idx} permanently failed: ${lastError?.message}`);
      return { idx, type: 'failed', line };
    });

    const results = await Promise.all(promises);

    for (const res of results) {
      if (!res) continue;

      switch (res.type) {
        case 'empty': {
          if (res.idx < total - 1) {
            const brId = `br_${res.idx}_${timestamp}`;
            currentJson.sequence.push(brId);
            currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
          }
          currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
          break;
        }

        case 'reuse': {
          // 기존 JSON에서 이 줄의 토큰들을 필터링해 재사용
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
          // 원본 텍스트를 보존하되 failed 마킹
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

    const processed = Math.min(i + CONCURRENCY, total);
    const isLast = batchIndices[batchIndices.length - 1] >= total - 1;
    if (isLast) {
      currentJson.status = currentJson.failed_indices.length > 0 ? 'partial' : 'completed';
    }

    await onBatch?.({ currentJson, processed, total });
  }

  return currentJson;
}
