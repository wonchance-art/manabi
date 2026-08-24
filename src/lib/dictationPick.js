/**
 * 자료 문장에서 받아쓰기 후보를 결정적으로 고른다.
 * 저장 단어가 주어지면 포함 단어 수를 우선하고, 모든 동률은 원문 순서를 유지한다.
 */
export function pickDictationSentences({ lines, savedSet, min = 6, max = 40, cap = 5 } = {}) {
  if (!Array.isArray(lines) || lines.length === 0 || cap <= 0) return [];

  const seen = new Set();
  const savedWords = savedSet instanceof Set
    ? [...savedSet].filter((word) => typeof word === 'string' && word.length > 0)
    : null;
  const candidates = [];

  lines.forEach((text, index) => {
    if (typeof text !== 'string' || seen.has(text)) return;
    seen.add(text);

    const length = text.replace(/\s/g, '').length;
    if (length < min || length > max) return;

    const savedCount = savedWords
      ? savedWords.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0)
      : 0;
    candidates.push({ index, text, savedCount });
  });

  if (savedWords) {
    candidates.sort((a, b) => b.savedCount - a.savedCount || a.index - b.index);
  }

  return candidates.slice(0, cap).map(({ index, text }) => ({ index, text }));
}
