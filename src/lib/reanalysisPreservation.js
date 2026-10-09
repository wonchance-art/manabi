import { diffLineMap } from './sourceEdit';
import { analysisTokenLine, inspectAnalysisCoverage, mergeReanalysisLines } from './analysisCoverage';
import { canonicalViewerLocale } from './viewerLanguage';
import { exactSourceQuote } from './viewerLocalizedContext';
import { compactBoundaryText, readBoundaryEdits } from './boundaryEdits';

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
    // 뷰어 v2 AD-R4 §7: 뜻을 교정한 토큰은 교정값이 이기므로 서버의 「뜻 확인 필요」 표식(meaningCheck)을 지운다.
    if (match?.patch && Object.hasOwn(match.patch, 'meaning')) delete dictionary[target].meaningCheck;
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

// ── AD-R3 PR② 단어 경계 기록(metadata.viewerBoundaries)의 재분석 연결(§3.5) ──
// 기록 줄 번호는 material.raw_text 기준이다(원문 수정의 baseJsonOverride도 metadata는 옮기지 않는다).

const PATCH_KEYS = ['meaning', 'furigana', 'reading', 'pos'];
const renameLine = (id, line) => (typeof id === 'string' ? id.replace(/^(id|br|failed)_\d+_/, `$1_${line}_`) : id);
// AD-R3 PR③(PR② 판단 1): base id 줄 접두가 바뀌어도 옛 저장 문맥이 묶인 자리를 찾도록 원래 id를 별칭(was)으로 남긴다.
// boundaryCoveringToken이 id 또는 별칭으로 찾는다. 가장 최근 8개만 둔다(줄 이동이 거듭돼도 기록이 커지지 않게).
const BASE_ALIAS_LIMIT = 8;
function withAlias(entry, id) {
  if (!entry || id === entry.id) return entry;
  const was = [...new Set([...(Array.isArray(entry.was) ? entry.was : []), entry.id].filter(item => typeof item === 'string' && item !== id))]
    .slice(-BASE_ALIAS_LIMIT);
  return { ...entry, id, ...(was.length ? { was } : {}) };
}

/**
 * 기록의 줄 번호를 새 원문으로 옮긴다. 같은 줄(diffLineMap 쌍)은 그 줄로, 바뀐 줄은 앞뒤 유지 줄 사이 구간의 옛·새 줄 수가
 * 같을 때만 같은 순번의 줄로 옮긴다(줄 수정 1:1 — 그 줄은 다시 분석되고 서버가 글자 위치를 다시 확인한다). 그 밖(삭제·
 * 여러 줄이 얽힌 변경)은 줄을 잃은 pending(line: null)으로 남긴다 — 조용히 버리지 않는다. 줄이 옮겨지면 base id의 줄 접두도
 * preserveReanalysisTokens의 id 이동과 같이 바꾼다. 원문이 같으면 입력 그대로.
 */
export function mapBoundaryEdits(oldRaw, newRaw, edits) {
  if (oldRaw === newRaw) return edits;
  const oldLines = String(oldRaw ?? '').split('\n'), newLines = String(newRaw ?? '').split('\n');
  const mapping = diffLineMap(oldLines, newLines);
  if (!mapping.ok) throw new Error('원문 변경 범위가 너무 커서 안전하게 연결하지 못했어요.');
  const kept = [...mapping.pairs.keys()].sort((a, b) => a - b);
  const target = line => {
    if (!Number.isInteger(line) || line < 0 || line >= oldLines.length) return null;
    if (mapping.pairs.has(line)) return mapping.pairs.get(line);
    const before = kept.filter(k => k < line).at(-1) ?? -1, after = kept.find(k => k > line) ?? oldLines.length;
    const newBefore = before < 0 ? -1 : mapping.pairs.get(before);
    const newAfter = after >= oldLines.length ? newLines.length : mapping.pairs.get(after);
    return after - before === newAfter - newBefore ? newBefore + (line - before) : null;
  };
  return edits.map(record => {
    const line = target(record?.line);
    if (line === null) return { ...record, line: null, status: 'pending' };
    if (line === record.line) return record;
    return { ...record, line, base: (record.base || []).map(entry => withAlias(entry, renameLine(entry?.id, line))) };
  });
}

/**
 * 재분석 뒤 기록 확정: 결과에서 가져온 줄(전체 재분석 = 모든 줄, 선택 재분석 = 선택 줄)의 기록만 서버 적용 결과로 바꾼다.
 * 같은 문단이라 함께 분석됐어도 선택 밖 줄은 기존 토큰을 쓰므로 기록도 그대로 둔다(mergeReanalysisLines와 같은 규칙).
 */
function settleReanalysisBoundaries(mapped, analyzed, takeLine) {
  if (!Array.isArray(analyzed) || analyzed.length !== mapped.length) return mapped;
  return mapped.map((record, i) => (Number.isInteger(record?.line) && takeLine(record.line) ? analyzed[i] : record));
}

/**
 * 새 base 토큰에 옛 base id와 교정값을 잇는다(PR① 「PR②에서 정할 것」 1). preserveReanalysisTokens와 같은 규칙 —
 * 같은 줄(이동 반영)·같은 글자 위치(기록 안 공백 뺀 위치)·같은 표면일 때만. 교정 필드는 viewerCorrections 표시와 교정
 * 이력의 키, 값은 옛 base 토큰에 실제로 있던 것. 그래서 묶기 전에 저장한 단어의 문맥이 재분석 뒤에도 §4.3 규칙으로
 * 돌아가고, 다시 나누면 원래 id로 정확히 돌아간다.
 */
function preserveBoundaryBase(json, prior, mapped, oldMetadata, corrections) {
  const settled = readBoundaryEdits(json);
  const keys = id => {
    const out = new Set((oldMetadata?.viewerCorrections?.[id] || []).filter(key => PATCH_KEYS.includes(key)));
    for (const row of corrections) if (row.token_id === id) for (const key of Object.keys(row.after_value || {})) if (PATCH_KEYS.includes(key)) out.add(key);
    return out;
  };
  const offsets = base => { let at = 0; return base.map(entry => { const from = at; at += compactBoundaryText(entry?.token?.text).length; return from; }); };
  const edits = settled.map((record, i) => {
    if (record === mapped[i] || record?.status !== 'applied' || !Array.isArray(prior[i]?.base)) return record;
    const oldBase = mapped[i].base || [], oldAt = offsets(oldBase), newAt = offsets(record.base);
    return { ...record, base: record.base.map((entry, k) => {
      const j = oldBase.findIndex((old, n) => oldAt[n] === newAt[k]
        && compactBoundaryText(old?.token?.text) === compactBoundaryText(entry.token?.text));
      if (j < 0) return entry;
      const original = prior[i].base[j], patch = {};
      for (const key of keys(original?.id)) if (original?.token?.[key] !== undefined) patch[key] = original.token[key];
      return { id: oldBase[j].id, ...(Array.isArray(oldBase[j].was) ? { was: oldBase[j].was } : {}), token: { ...entry.token, ...patch } };
    }) };
  });
  return { ...json, metadata: { ...json.metadata, viewerBoundaries: { ...json.metadata.viewerBoundaries, edits } } };
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
  // AD-R3: 경계 기록을 새 원문 줄로 옮겨 분석 요청에 싣는다(analyzeHybrid가 문단마다 boundaries로 보낸다). 기록 0이면 무변경.
  const priorBoundaries = metadata.language === 'Korean' ? [] : readBoundaryEdits(original);
  const mappedBoundaries = priorBoundaries.length ? mapBoundaryEdits(material.raw_text || '', rawText, priorBoundaries) : null;
  if (mappedBoundaries) metadata.viewerBoundaries = { ...metadata.viewerBoundaries, edits: mappedBoundaries };
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
  const settledBoundaries = mappedBoundaries && (selected?.length === 0 ? mappedBoundaries
    : settleReanalysisBoundaries(mappedBoundaries, readBoundaryEdits(result), line => !selected || selected.includes(line)));
  if (selected?.length) result = preserveRetainedKoreanLocales(original,
    mergeReanalysisLines(rawText, original, result, selected));
  if (!completeAnalysis(result, rawText)) throw new Error('새 분석을 완료하지 못했어요. 기존 원문과 분석은 그대로 유지됩니다.');
  const provenance = Object.fromEntries(['targetLanguage', 'explanationLocale', 'analysisVersion', 'analysisEngine', 'analysisQuality']
    .filter(key => result.metadata?.[key] !== undefined).map(key => [key, result.metadata[key]]));
  const mergedMetadata = { ...result.metadata, ...metadata, ...provenance,
    viewerRevision: attempt, updated_at: metadata.updated_at };
  if (settledBoundaries) mergedMetadata.viewerBoundaries = { ...metadata.viewerBoundaries, edits: settledBoundaries };
  let json = preserveReanalysisTokens(material, rawText, { ...result, metadata: mergedMetadata }, corrections || []);
  if (settledBoundaries) json = preserveBoundaryBase(json, priorBoundaries, mappedBoundaries, material.processed_json?.metadata, corrections);
  if (metadata.language === 'Korean') json = rebaseKoreanSourceSpans(rawText, json);
  if (!completeAnalysis(json, rawText)) throw new Error('분석 연결을 확인하지 못했어요. 기존 원문과 분석은 그대로 유지됩니다.');
  checkAbort();
  options.onCommitting?.();
  const record = await replaceViewerAnalysis(client, material, rawText, json, attempt);
  return record;
}
