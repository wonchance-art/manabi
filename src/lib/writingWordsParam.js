/**
 * 작문 화면에 넘기는 말(연계 4 — 직접 쓴 말 창 「아직 안 써 본 말로 작문 ›」 · STATS-MAP-001).
 * /writing?words=近く,一緒に,楽しみ&lang=Japanese — 작문 화면이 「오늘 복습한 말」 칩 자리에 이 말들을 띄운다.
 * 주소는 누구나 만들 수 있으니 읽을 때 다시 좁힌다: 아는 언어만, 말은 다섯 개 · 한 말 40자까지, 겹침 제거.
 * 말의 뜻은 주소가 아니라 내 담은 말(snapshot)에서 찾는다 — 내 단어장에 없는 말은 칩이 되지 않는다.
 */
export const WRITING_WORDS_MAX = 5;
const LANGS = new Set(['Japanese', 'English', 'French', 'Chinese']);
const WORD_MAX = 40;

export function writingWordsHref({ words = [], language = null } = {}) {
  const params = new URLSearchParams();
  params.set('words', words.slice(0, WRITING_WORDS_MAX).join(','));
  if (LANGS.has(language)) params.set('lang', language);
  return `/writing?${params.toString()}`;
}

/** @returns {{ words: string[], language: string|null }} */
export function readWritingWords(searchParams) {
  const raw = searchParams?.get?.('words') || '';
  const lang = searchParams?.get?.('lang') || null;
  const words = [];
  for (const part of raw.split(',')) {
    const w = part.trim();
    if (!w || w.length > WORD_MAX || words.includes(w)) continue;
    words.push(w);
    if (words.length >= WRITING_WORDS_MAX) break;
  }
  return { words, language: LANGS.has(lang) ? lang : null };
}
