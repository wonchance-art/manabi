import { callGemini, parseGeminiJSON, buildTokenizationPrompt } from './gemini';

/**
 * 텍스트를 형태소 분석해 processed_json 구조를 생성합니다.
 *
 * @param {string} rawText - 분석할 원문
 * @param {AbortSignal|null} signal - AbortController signal
 * @param {Object} options
 * @param {Object} options.metadata - processed_json에 포함할 메타데이터
 * @param {function} options.onBatch - 각 배치 완료 후 호출되는 async 콜백
 *   ({ currentJson, processed, total, failed }) => Promise<void>
 * @returns {Promise<Object>} 최종 processed_json
 */
export async function analyzeText(rawText, signal, { metadata = {}, onBatch } = {}) {
  const lines = rawText.split('\n');
  const timestamp = Date.now();
  const CONCURRENCY = 5;
  let currentJson = {
    sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata,
  };

  for (let i = 0; i < lines.length; i += CONCURRENCY) {
    const batchIndices = [];
    for (let j = 0; j < CONCURRENCY && i + j < lines.length; j++) batchIndices.push(i + j);

    const promises = batchIndices.map(async (idx) => {
      const line = lines[idx].trim();
      if (!line) return { idx, success: true, empty: true };

      let failCount = 0;
      while (failCount < 3) {
        try {
          const raw = await callGemini(buildTokenizationPrompt(line), signal);
          return { idx, success: true, payload: parseGeminiJSON(raw) };
        } catch (e) {
          if (signal?.aborted) throw e;
          failCount++;
          if (failCount >= 3) return { idx, success: false };
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    });

    const results = await Promise.all(promises);
    let batchFailed = false;

    for (const res of results) {
      if (!res || !res.success) { batchFailed = true; continue; }
      if (res.empty) {
        if (res.idx < lines.length - 1) {
          const brId = `br_${res.idx}_${timestamp}`;
          currentJson.sequence.push(brId);
          currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
        }
        currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
      } else if (res.payload) {
        res.payload.sequence.forEach((oldId, pIdx) => {
          const newId = `id_${res.idx}_${pIdx}_${timestamp}`;
          currentJson.sequence.push(newId);
          currentJson.dictionary[newId] = res.payload.dictionary[oldId];
        });
        if (res.idx < lines.length - 1) {
          const brId = `br_${res.idx}_${timestamp}`;
          currentJson.sequence.push(brId);
          currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
        }
        currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
      }
    }

    const processed = Math.min(i + CONCURRENCY, lines.length);
    const isLast = batchIndices[batchIndices.length - 1] === lines.length - 1;

    if (batchFailed) {
      currentJson.status = 'failed';
      await onBatch?.({ currentJson, processed, total: lines.length, failed: true });
      return currentJson;
    }

    if (isLast) currentJson.status = 'completed';
    await onBatch?.({ currentJson, processed, total: lines.length, failed: false });
  }

  return currentJson;
}
