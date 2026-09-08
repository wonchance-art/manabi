import { interruptedImportJson } from './materialImport';

const intents = new Map();
export function requestPassageAnalysis(ownerId, id) { intents.set(`${ownerId}:${id}`, Date.now()); }
export function takePassageAnalysis(ownerId, id) {
  const key = `${ownerId}:${id}`, time = intents.get(key); intents.delete(key);
  return !!time && Date.now() - time < 90000;
}

export async function runPassageAnalysis(client, material, signal, analyze, onSaved) {
  const attempt = crypto.randomUUID();
  const rpc = async json => {
    const { data, error } = await client.rpc('source_passage_analysis', { p_id: String(material.id), p_attempt: attempt, p_json: json });
    if (error) throw error;
    if (!data?.material?.id) throw new Error('PASSAGE_UNCERTAIN');
    if (!signal.aborted) onSaved?.(data.material);
    return data;
  };
  const claim = await rpc(null);
  if (!claim.acquired) return { ...claim.material.processed_json, __passageNotAcquired: true };
  const current = claim.material;
  let latest = current.processed_json;
  // Resume missing lines without changing established token IDs or saved expression sources.
  const present = new Set((latest.sequence || []).map(id => /^(?:id|br)_(\d+)_/.exec(id)?.[1]).filter(Boolean).map(Number));
  const missing = current.raw_text.split('\n').flatMap((line, i) => line.trim() && !present.has(i) ? [i] : []);
  const base = { ...latest, failed_indices: [...new Set([...(latest.failed_indices || []), ...missing])] };
  let queue = Promise.resolve();
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const result = await analyze(current.raw_text, signal, {
      metadata: latest.metadata, existingJson: latest.sequence?.length ? base : null, concurrency: 4,
      onBatch: ({ currentJson }) => {
        const snapshot = structuredClone(currentJson);
        queue = queue.then(async () => {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          latest = (await rpc({ ...snapshot, status: 'analyzing' })).material.processed_json;
        });
        return queue;
      },
    });
    await queue;
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return (await rpc(result)).material.processed_json;
  } catch (error) {
    await queue.catch(() => {});
    // Releasing this run is conditional; an expired run cannot overwrite its successor.
    await rpc(interruptedImportJson(current.raw_text, latest)).catch(() => {});
    throw error;
  }
}
