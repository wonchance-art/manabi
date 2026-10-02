// 제외는 숙련도·FSRS 점수가 아니다. 기존 저장 기본형만 대조하고 언어를 추측하지 않는다.
export const VOCABULARY_LANGUAGES = ['Japanese', 'Chinese', 'English', 'French', 'Korean'];
export const exclusionWord = token => String(token?.sep_link || token?.base_form || token?.word_text || token?.text || '').normalize('NFC').trim();
export const exclusionKey = (language, word) => `${language || 'Unknown'}\u0000${String(word || '').normalize('NFC').trim()}`;
export const isVocabularyExcludedError = error => error?.code === '55000' && /vocabulary_excluded/.test(error.message || '');

export async function loadVocabularyExclusions(client, userId) {
  const items = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.from('vocabulary_exclusions').select('id,language,word_text,vocabulary_id,retired_vocabulary_ids,known_word_keys,created_at')
      .eq('user_id', userId).order('id').range(offset, offset + 199);
    if (error) throw error;
    items.push(...(data || []));
    if ((data || []).length < 200) return items;
  }
}

export function findVocabularyExclusion(rows, { vocabularyId, language, word }) {
  if (vocabularyId) {
    const linked = rows.find(row => row.vocabulary_id === vocabularyId || row.retired_vocabulary_ids?.includes(vocabularyId));
    if (linked) return linked;
  }
  // 저장 카드 ID를 우선하고, 같은 언어·기본형은 자료/카드의 별칭에도 적용한다.
  // 표기 편집 시 서버가 연결된 제외 키를 함께 갱신한다.
  if (!VOCABULARY_LANGUAGES.includes(language)) return null;
  return rows.find(row => exclusionKey(row.language, row.word_text) === exclusionKey(language, word)) || null;
}

export function updateVocabularyExclusions(rows, result) {
  const next = rows.filter(row => row.id !== result.entry.id && (result.excluded
    || !VOCABULARY_LANGUAGES.includes(result.entry.language)
    || exclusionKey(row.language, row.word_text) !== exclusionKey(result.entry.language, result.entry.word_text)));
  if (result.excluded) next.push(result.entry);
  return next;
}

export function scopedVocabularyExclusions(rows, words, scopeIds) {
  if (!scopeIds) return rows;
  const ids = new Set(scopeIds);
  const keys = new Set(words.filter(word => ids.has(word.id) && VOCABULARY_LANGUAGES.includes(word.language))
    .map(word => exclusionKey(word.language, exclusionWord(word))));
  return rows.filter(entry => ids.has(entry.vocabulary_id) || keys.has(exclusionKey(entry.language, entry.word_text)));
}
