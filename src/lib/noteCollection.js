// Derive progress from the private note, never from the vocabulary/SRS counters.
export function noteCandidateState(row) {
  if (row.vocabularyId) return 'saved';
  if (row.excluded) return 'excluded';
  return 'pending';
}

export function canSaveNoteCandidate(row) {
  return noteCandidateState(row) === 'pending' && row.reviewed === true
    && !!row.text?.trim() && !!row.meaning?.trim();
}

export function noteCollectionSummary(candidates = []) {
  const summary = {pending: 0, saved: 0, excluded: 0, ready: 0, all: candidates.length};
  for (const row of candidates) {
    summary[noteCandidateState(row)]++;
    if (canSaveNoteCandidate(row)) summary.ready++;
  }
  return summary;
}

export function filterNoteCandidates(candidates, filter) {
  return filter === 'all' ? candidates : candidates.filter(row => noteCandidateState(row) === filter);
}

// Bounded queries for visible, owned notes. Do not fetch the canvas or words
// into the shelf. Older notes without a derived summary get a count-free link.
export async function fetchNoteCollectionProgress(client, owner, ids) {
  if (!owner || !ids.length) return {};
  const keys=[...new Set(ids.map(String))].filter(id=>/^\d{1,19}$/.test(id)),rows=[];
  for(let start=0;start<keys.length;start+=20){
    const {data, error} = await client.from('reading_materials')
      .select('id,note_summary:processed_json->metadata->studyNote->summary')
      .eq('owner_id', owner).eq('visibility', 'private')
      .eq('processed_json->metadata->studyNote->>version', '1').in('id', keys.slice(start,start+20));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return Object.fromEntries(rows.map(row => [String(row.id), {
    pending: Number.isInteger(row.note_summary?.pending) && row.note_summary.pending >= 0
      && row.note_summary.pending <= 300 ? row.note_summary.pending : null,
  }]));
}
