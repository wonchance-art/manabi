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
  if (lang === 'Japanese') {
    return analyzeJapanese(rawText, signal, { metadata, onBatch, existingJson });
  }
  return analyzeLineByLineGemini(rawText, signal, { metadata, onBatch, existingJson, concurrency });
}

/* ─────────────────────────────────────────────────────────────
 * 일본어: /api/analyze 엔드포인트 사용 (kuromoji + 공유 캐시)
 * ─────────────────────────────────────────────────────────────*/
async function analyzeJapanese(rawText, signal, { metadata, onBatch, existingJson }) {
  const lines = rawText.split('\n');
  const total = lines.length;
  const timestamp = Date.now();

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

  // 재시도 모드일 때 실패 안 한 줄은 기존 토큰 복원
  const lineStatus = new Array(total).fill(null); // 'success' | 'empty' | 'reuse' | 'failed' | null

  if (isRetry) {
    for (let i = 0; i < total; i++) {
      if (!failedSet.has(i)) {
        lineStatus[i] = lines[i].trim() ? 'reuse' : 'empty';
      }
    }
  }

  // 서버에 보낼 줄만 추림 (재시도 모드면 실패 줄만, 아니면 전체)
  const linesToAnalyze = [];
  for (let i = 0; i < total; i++) {
    if (lineStatus[i]) continue; // 이미 결정된 것 스킵
    if (!lines[i].trim()) { lineStatus[i] = 'empty'; continue; }
    linesToAnalyze.push({ idx: i, text: lines[i].trim() });
  }

  // 큰 덩어리를 서버 타임아웃(60s) 안에 처리하기 위해 청크 단위로 전송
  const CHUNK_SIZE = 20; // 20줄씩 한 번의 /api/analyze 호출

  for (let chunkStart = 0; chunkStart < linesToAnalyze.length; chunkStart += CHUNK_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const chunk = linesToAnalyze.slice(chunkStart, chunkStart + CHUNK_SIZE);

    let response;
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          lines: chunk.map(c => c.text),
          language: 'Japanese',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      response = data;
    } catch (e) {
      if (signal?.aborted) throw e;
      console.error('[analyzeJapanese] chunk failed:', e?.message);
      // 이 청크의 모든 줄을 failed로 표시
      for (const c of chunk) lineStatus[c.idx] = 'failed';
      continue;
    }

    // 서버 응답을 각 줄에 매핑
    response.results.forEach((result, i) => {
      const { idx, text } = chunk[i];
      // 서버의 토큰 id를 클라이언트 타임스탬프 기반으로 rewrite (재시도 시 충돌 방지)
      const newSequence = result.sequence.map((_, pIdx) => `id_${idx}_${pIdx}_${timestamp}`);
      const newDictionary = {};
      result.sequence.forEach((srvId, pIdx) => {
        newDictionary[newSequence[pIdx]] = result.dictionary[srvId];
      });
      lineStatus[idx] = { type: 'success', sequence: newSequence, dictionary: newDictionary, text };
    });
  }

  // 최종 조립 (원본 줄 순서대로)
  for (let idx = 0; idx < total; idx++) {
    const s = lineStatus[idx];

    if (s && typeof s === 'object' && s.type === 'success') {
      for (const id of s.sequence) {
        currentJson.sequence.push(id);
        currentJson.dictionary[id] = s.dictionary[id];
      }
      if (idx < total - 1) {
        const brId = `br_${idx}_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
      }
    } else if (s === 'empty') {
      if (idx < total - 1) {
        const brId = `br_${idx}_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
      }
    } else if (s === 'reuse') {
      const prefix1 = `id_${idx}_`;
      const prefix2 = `br_${idx}_`;
      const prefix3 = `failed_${idx}_`;
      const existing = (existingJson?.sequence || []).filter(id =>
        id.startsWith(prefix1) || id.startsWith(prefix2) || id.startsWith(prefix3)
      );
      existing.forEach(id => {
        currentJson.sequence.push(id);
        currentJson.dictionary[id] = existingJson.dictionary[id];
      });
    } else {
      // failed
      const failedId = `failed_${idx}_${timestamp}`;
      currentJson.sequence.push(failedId);
      currentJson.dictionary[failedId] = {
        text: lines[idx],
        pos: '미분석',
        failed: true,
        original_line_idx: idx,
      };
      if (idx < total - 1) {
        const brId = `br_${idx}_${timestamp}`;
        currentJson.sequence.push(brId);
        currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
      }
      currentJson.failed_indices.push(idx);
    }
    currentJson.last_idx = idx;

    // progress: 매 줄마다는 과하므로 주기적으로 저장
    if ((idx + 1) % 10 === 0 || idx === total - 1) {
      currentJson.metadata = {
        ...(currentJson.metadata || {}),
        updated_at: new Date().toISOString(),
      };
      await onBatch?.({ currentJson, processed: idx + 1, total });
    }
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
          const raw = await callGemini(buildTokenizationPrompt(line), signal);
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
