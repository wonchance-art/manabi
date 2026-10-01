// 표시의 원래 키는 삭제에 쓰고, 대조만 NFC/기본형으로 한다. 뜻이나 SRS는 고치지 않는다.
import { exclusionWord, scopedVocabularyExclusions } from './vocabularyExclusion';
export const KNOWN_LANGUAGES = { ja: 'Japanese', zh: 'Chinese', en: 'English', fr: 'French' };
export const normalizeKnownWord = word => String(word || '').normalize('NFC').trim();
export function knownWordKeys(rows, lang, token, exclusion) {
  const keys = new Set([normalizeKnownWord(token?.text || token?.word_text), exclusionWord(token)]);
  const entries = Array.isArray(exclusion) ? exclusion.filter(entry => entry.language === KNOWN_LANGUAGES[lang]
    && (keys.has(normalizeKnownWord(entry.word_text)) || (token?.id && (entry.vocabulary_id === token.id || entry.retired_vocabulary_ids?.includes(token.id))))) : [exclusion];
  return (rows || []).filter(row => row.lang === lang && (keys.has(normalizeKnownWord(row.word_text))
    || entries.some(entry => entry?.known_word_keys?.includes(row.word_text)))).map(row => row.word_text);
}
export function knownWordSetOf(rows, exclusions = [], lang = null) {
  const words = new Set((rows || []).filter(row => !lang || row.lang === lang).map(row => normalizeKnownWord(row.word_text)));
  for (const entry of exclusions) if (entry.language === KNOWN_LANGUAGES[lang]
    && entry.known_word_keys?.some(key => words.has(normalizeKnownWord(key)))) words.add(normalizeKnownWord(entry.word_text));
  return words;
}
export function updateKnownWords(rows, { lang, wordText, known, removeKeys = [] }) {
  const next = (rows || []).filter(row => row.lang !== lang || !removeKeys.includes(row.word_text));
  if (known && !next.some(row => row.lang === lang && row.word_text === wordText)) next.push({ lang, word_text: wordText });
  return next;
}
export function scopedKnownWords(rows, exclusions, vocab, scopeIds) {
  if (!scopeIds) return rows || [];
  const scoped = scopedVocabularyExclusions(exclusions, vocab, scopeIds);
  const words = vocab.filter(row => scopeIds.includes(row.id));
  return (rows || []).filter(row => words.some(word => word.language === KNOWN_LANGUAGES[row.lang]
    && knownWordKeys([row], row.lang, word).length) || scoped.some(entry => entry.language === KNOWN_LANGUAGES[row.lang]
      && entry.known_word_keys?.includes(row.word_text)));
}
