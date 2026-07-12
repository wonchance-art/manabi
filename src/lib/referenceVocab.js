export const REFERENCE_VOCAB_PAGE_SIZE = 150;
export const SAVED_WORD_QUERY_CHUNK_SIZE = 150;

export function takeThemeWords(themes, limit = REFERENCE_VOCAB_PAGE_SIZE) {
  let remaining = Math.max(0, Number(limit) || 0);
  const visible = [];

  for (const theme of themes || []) {
    if (remaining === 0) break;
    const words = Array.isArray(theme?.words) ? theme.words : [];
    const slice = words.slice(0, remaining);
    if (slice.length > 0) {
      visible.push({ ...theme, words: slice, totalWords: words.length });
      remaining -= slice.length;
    }
  }

  return visible;
}

export function chunkSavedWords(words, chunkSize = SAVED_WORD_QUERY_CHUNK_SIZE) {
  const size = Math.max(1, Number(chunkSize) || SAVED_WORD_QUERY_CHUNK_SIZE);
  const unique = [...new Set((words || []).filter(word => typeof word === 'string' && word.length > 0))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += size) chunks.push(unique.slice(i, i + size));
  return chunks;
}

export async function fetchSavedWordSet(client, userId, words, chunkSize = SAVED_WORD_QUERY_CHUNK_SIZE) {
  if (!client || !userId) return new Set();
  const chunks = chunkSavedWords(words, chunkSize);
  if (chunks.length === 0) return new Set();

  const results = await Promise.all(chunks.map(chunk => client
    .from('user_vocabulary')
    .select('word_text')
    .eq('user_id', userId)
    .in('word_text', chunk)));

  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
  return new Set(results.flatMap(result => result.data || []).map(row => row.word_text).filter(Boolean));
}
