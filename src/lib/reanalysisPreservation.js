import { diffLineMap } from './sourceEdit';
import { analysisTokenLine, inspectAnalysisCoverage, mergeReanalysisLines } from './analysisCoverage';
import { canonicalViewerLocale } from './viewerLanguage';
import { exactSourceQuote } from './viewerLocalizedContext';

const tokenLine = id => analysisTokenLine(id) ?? NaN;

// 같은 원문 줄의 같은 글자 범위에만 이전 식별자와 수동 교정을 연결한다.
// 분할이 달라졌거나 문맥이 바뀐 토큰을 비슷한 단어에 억지로 연결하지 않는다.
export function preserveReanalysisTokens(material, text, result, corrections = []) {
  const old = material.processed_json || {};
  const incomplete = new Set(inspectAnalysisCoverage(material.raw_text || '', { ...old, failed_indices: [] }).missingIndices);
  const mapping = diffLineMap((material.raw_text || '').split('\n'), text.split('\n'));
  if (!mapping.ok) throw new Error('원문 변경 범위가 너무 커서 안전하게 연결하지 못했어요.');
  const patches = new Map();
  // 줄 이동 뒤에도 교정 필드 표시를 새 ID로 이어 준다. 교정 로그 자체는 바꾸지 않는다.
  for (const [id, fields] of Object.entries(old.metadata?.viewerCorrections || {})) {
    if (!Array.isArray(fields)) continue;
    const patch = {};
    for (const key of fields) if (['meaning', 'furigana', 'reading', 'pos'].includes(key) && old.dictionary?.[id]?.[key] !== undefined) patch[key] = old.dictionary[id][key];
    patches.set(id, patch);
  }
  // 로그는 최신 순. 현재 토큰에 실제 저장된 교정값을 기준으로 보존한다.
  for (const row of corrections) {
    if (!patches.has(row.token_id)) patches.set(row.token_id, {});
    for (const key of Object.keys(row.after_value || {})) {
      const value = old.dictionary?.[row.token_id]?.[key];
      if (['meaning', 'furigana', 'reading', 'pos'].includes(key) && value !== undefined) patches.get(row.token_id)[key] = value;
    }
  }
  const anchors = new Map(), offsets = new Map();
  for (const id of old.sequence || []) {
    const token = old.dictionary?.[id], line = Number(tokenLine(id));
    if (typeof token?.text !== 'string' || token.pos === '개행' || token.failed || incomplete.has(line) || !Number.isInteger(line) || !mapping.pairs.has(line)) continue;
    const start = offsets.get(line) || 0;
    offsets.set(line, start + token.text.length);
    const nextLine = mapping.pairs.get(line);
    anchors.set(JSON.stringify([nextLine, start, token.text]), {
      id: id.replace(/^(id|br|failed)_\d+_/, `$1_${nextLine}_`), patch: patches.get(id), token,
    });
  }
  offsets.clear();
  const sequence = [], dictionary = {}, viewerCorrections = {};
  for (const id of result.sequence || []) {
    const token = result.dictionary?.[id];
    if (!token || typeof token.text !== 'string') throw new Error('분석 결과에 빠진 항목이 있어요. 이전 분석을 유지합니다.');
    const line = Number(tokenLine(id)), start = offsets.get(line) || 0;
    if (token.pos !== '개행') offsets.set(line, start + token.text.length);
    const match = token.pos !== '개행' && anchors.get(JSON.stringify([line, start, token.text]));
    const target = match?.id || id;
    if (dictionary[target]) throw new Error('분석 결과의 식별자가 겹쳐 이전 분석을 유지합니다.');
    sequence.push(target);
    dictionary[target] = { ...token, ...(match?.patch || {}) };
    if (match?.patch && Object.hasOwn(match.patch, 'meaning') && old.metadata?.language === 'Korean') {
      const meaningLocale = canonicalViewerLocale(match.token.meaningLocale || match.token.explanationLocale
        || old.metadata.explanationLocale || 'ko');
      if (!meaningLocale) throw new Error('수정한 뜻의 설명 언어를 확인하지 못했어요. 이전 분석을 유지합니다.');
      dictionary[target].meaningLocale = meaningLocale;
      dictionary[target].explanationLocale = meaningLocale;
      // A preserved Korean meaning cannot relabel freshly generated Chinese morphology.
      if (token.explanationLocale !== meaningLocale) {
        delete dictionary[target].morphology;
        if (match.token.explanationLocale === meaningLocale && match.token.morphology) {
          dictionary[target].morphology = match.token.morphology;
        }
      }
    }
    if (match?.patch && Object.keys(match.patch).length) viewerCorrections[target] = Object.keys(match.patch);
  }
  return { ...result, sequence, dictionary, metadata: { ...result.metadata, viewerCorrections } };
}

// Final merges/remaps may reuse tokens with obsolete document offsets. Rebuild
// Korean spans only from the exact final raw source, including whitespace/CRLF.
function rebaseKoreanSourceSpans(text, json) {
  const lines = text.split('\n'), lineOffsets = [];
  let offset = 0;
  for (const line of lines) { lineOffsets.push(offset); offset += line.length + 1; }
  const cursors = new Map(), dictionary = {};
  for (const id of json.sequence) {
    const token = json.dictionary[id], lineIndex = tokenLine(id);
    const line = lines[lineIndex], lineStart = cursors.get(lineIndex) || 0;
    if (line === undefined) throw new Error('원문 위치를 확인하지 못했어요. 이전 분석을 유지합니다.');
    if (token.pos === '개행') {
      if (token.text !== '\n' || lineStart !== line.length || lineIndex >= lines.length - 1) {
        throw new Error('원문 줄바꿈이 일치하지 않아 이전 분석을 유지합니다.');
      }
    } else {
      if (line.slice(lineStart, lineStart + token.text.length) !== token.text) {
        throw new Error('원문 범위가 일치하지 않아 이전 분석을 유지합니다.');
      }
      cursors.set(lineIndex, lineStart + token.text.length);
    }
    dictionary[id] = { ...token, sourceSpan: {
      start: lineOffsets[lineIndex] + lineStart, end: lineOffsets[lineIndex] + lineStart + token.text.length,
      unit: 'utf16', lineIndex, lineStart, lineEnd: lineStart + token.text.length,
    } };
    if (exactSourceQuote(text, dictionary[id].sourceSpan, token.text) === null) {
      throw new Error('원문 문자 범위를 확인하지 못했어요. 이전 분석을 유지합니다.');
    }
  }
  if (json.sequence.map(id => dictionary[id].text).join('') !== text) {
    throw new Error('원문 전체가 일치하지 않아 이전 분석을 유지합니다.');
  }
  return { ...json, dictionary };
}

// Selective analysis changes document provenance, but untouched legacy tokens
// may rely on the old document locale. Pin their provenance before that fallback
// changes; freshly generated tokens keep their own explanation language.
function preserveRetainedKoreanLocales(original, result) {
  if (original.metadata?.language !== 'Korean') return result;
  const dictionary = { ...result.dictionary };
  for (const id of result.sequence) {
    const token = dictionary[id];
    if (!token || token !== original.dictionary?.[id] || token.pos === '개행') continue;
    const explanationLocale = canonicalViewerLocale(token.explanationLocale || original.metadata.explanationLocale || 'ko');
    const meaningLocale = canonicalViewerLocale(token.meaningLocale || explanationLocale);
    if (!explanationLocale || !meaningLocale) throw new Error('기존 뜻의 설명 언어를 확인하지 못했어요. 이전 분석을 유지합니다.');
    dictionary[id] = { ...token, explanationLocale, meaningLocale };
  }
  return { ...result, dictionary };
}

export function completeAnalysis(result, text) {
  if (result?.status !== 'completed' || result.failed_indices?.length || !Array.isArray(result.sequence) || !result.dictionary) return false;
  const coverage = inspectAnalysisCoverage(text, result);
  return coverage.validStructure && coverage.missingIndices.length === 0;
}

export async function replaceViewerAnalysis(client, material, rawText, json, attempt) {
  const { data, error } = await client.rpc('viewer_replace_analysis', {
    p_id: String(material.id), p_expected_raw: material.raw_text,
    p_expected_json: material.processed_json, p_raw: rawText, p_json: json, p_attempt: attempt,
  });
  if (error) {
    if (error.code === 'PGRST202') throw new Error('안전한 분석 저장 기능을 준비 중이에요. 기존 원문과 분석은 그대로 유지됩니다.');
    throw error;
  }
  if (!data?.material?.id) throw new Error('저장 결과를 확인하지 못했어요. 자료를 다시 열어 확인해 주세요.');
  return data.material;
}

export async function runPreservedReanalysis(client, material, signal, analyze, options = {}, onProgress) {
  const rawText = options.rawTextOverride ?? material.raw_text;
  if (!rawText?.trim()) throw new Error('원본 텍스트가 없습니다.');
  const checkAbort = () => { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); };
  checkAbort();
  const original = options.baseJsonOverride || material.processed_json;
  const coverage = inspectAnalysisCoverage(rawText, original);
  const selective = !options.fullReset && (options.resume || options.selectedLineIndices != null || original?.failed_indices?.length);
  if (selective && !coverage.validStructure) throw new Error('기존 분석의 줄 위치를 확인하지 못했어요. 원문은 유지됩니다. 전체 재분석을 사용해 주세요.');
  const selected = selective ? [...new Set([
    ...(options.selectedLineIndices || []), ...coverage.missingIndices,
  ])].sort((a, b) => a - b) : null;
  if (selected?.some(line => !Number.isInteger(line) || line < 0 || line >= rawText.split('\n').length)) throw new Error('분석할 줄의 위치가 올바르지 않아요.');
  const base = selected ? { ...original, failed_indices: selected } : null;
  if (selected) options.onRecoveryProgress?.({ completed: 0, total: selected.length });
  // 교정 이력을 읽지 못하면 교정을 잃을 수 있으므로 기존 자료를 유지하고 중단한다.
  const corrections = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await client.from('token_corrections').select('token_id, after_value')
      .eq('material_id', material.id).order('created_at', { ascending: false }).order('id').range(from, from + 499);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('교정 이력을 확인하지 못했어요.');
    corrections.push(...data);
    checkAbort();
    if (data.length < 500) break;
  }
  checkAbort();
  const attempt = crypto.randomUUID();
  const metadata = { ...original?.metadata, viewerRevision: attempt, updated_at: new Date().toISOString() };
  if (metadata.language === 'Korean' && options.explanationLocale !== undefined) {
    const locale = canonicalViewerLocale(options.explanationLocale);
    if (!locale) throw new Error('설명 언어를 확인해 주세요.');
    metadata.explanationLocale = locale;
  }
  // 삭제/줄 이동만 있으면 리맵된 분석을 그대로 검증한다. AI 재호출이 필요하지 않다.
  let result = selected?.length === 0
    ? { ...structuredClone(original), status: 'completed', failed_indices: [] }
    : await analyze(rawText, signal, {
    metadata, existingJson: base ? structuredClone(base) : null, concurrency: 8,
    onBatch: ({ currentJson }) => {
      checkAbort();
      onProgress?.(currentJson.last_idx);
      if (selected) {
        const missing = new Set(inspectAnalysisCoverage(rawText, currentJson).missingIndices);
        options.onRecoveryProgress?.({ completed: selected.filter(line => !missing.has(line)).length, total: selected.length });
      }
    },
  });
  checkAbort();
  if (selected?.length) result = preserveRetainedKoreanLocales(original,
    mergeReanalysisLines(rawText, original, result, selected));
  if (!completeAnalysis(result, rawText)) throw new Error('새 분석을 완료하지 못했어요. 기존 원문과 분석은 그대로 유지됩니다.');
  const provenance = Object.fromEntries(['targetLanguage', 'explanationLocale', 'analysisVersion', 'analysisEngine', 'analysisQuality']
    .filter(key => result.metadata?.[key] !== undefined).map(key => [key, result.metadata[key]]));
  const mergedMetadata = { ...result.metadata, ...metadata, ...provenance,
    viewerRevision: attempt, updated_at: metadata.updated_at };
  let json = preserveReanalysisTokens(material, rawText, { ...result, metadata: mergedMetadata }, corrections || []);
  if (metadata.language === 'Korean') json = rebaseKoreanSourceSpans(rawText, json);
  if (!completeAnalysis(json, rawText)) throw new Error('분석 연결을 확인하지 못했어요. 기존 원문과 분석은 그대로 유지됩니다.');
  checkAbort();
  options.onCommitting?.();
  const record = await replaceViewerAnalysis(client, material, rawText, json, attempt);
  return record;
}
