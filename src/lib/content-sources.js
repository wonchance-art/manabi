/**
 * 콘텐츠 소스 — Wikipedia API (무료, 키 불필요, 차단 없음)
 *
 * Simple English Wikipedia: CEFR A2-B1 수준으로 작성된 학습자용 영어
 * 일본어 Wikipedia: 일본어 학습용 (N3-N2 수준)
 *
 * API 문서: https://www.mediawiki.org/wiki/API:Main_page
 */

const WIKI_UA = 'ManabiApp/1.0 (language-learning; contact@example.com)';

/**
 * Wikipedia에서 랜덤 기사 목록 가져오기
 * @param {'en'|'ja'|'simple'} lang  - 'simple' = Simple English Wikipedia
 */
async function fetchRandomWikiArticles(lang, count = 5) {
  const host = lang === 'simple'
    ? 'https://simple.wikipedia.org'
    : `https://${lang}.wikipedia.org`;

  // random 네임스페이스 0 = 일반 기사
  const url = `${host}/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=${count}&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.query?.random || []).map(p => ({ pageid: p.id, title: p.title }));
}

/**
 * Wikipedia 기사 전문 가져오기 (plain text)
 */
async function fetchWikiArticleText(lang, title) {
  const host = lang === 'simple'
    ? 'https://simple.wikipedia.org'
    : `https://${lang}.wikipedia.org`;

  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: 'true',    // plain text (HTML 제거)
    exsectionformat: 'plain',
    titles: title,
    format: 'json',
    origin: '*',
    exlimit: '1',
  });

  const res = await fetch(`${host}/w/api.php?${params}`, {
    headers: { 'User-Agent': WIKI_UA },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page?.extract) return null;

  // 너무 짧거나 disambiguation 페이지 제외
  const text = page.extract.trim();
  if (text.length < 300 || text.includes('may refer to:') || text.includes('이(가) 가리키는')) {
    return null;
  }

  // 앞 3000자만 (Gemini 분석에 충분)
  return text.slice(0, 3000);
}

/**
 * Simple English Wikipedia 기사 3개 가져오기 (영어 학습용)
 */
export async function fetchEnglishArticles(count = 3) {
  const candidates = await fetchRandomWikiArticles('simple', count * 3);
  const results = [];

  for (const page of candidates) {
    if (results.length >= count) break;
    const text = await fetchWikiArticleText('simple', page.title);
    if (!text) continue;

    results.push({
      videoId: `wiki_en_${page.pageid}`,
      title: page.title,
      channelName: 'Simple English Wikipedia',
      thumbnail: null,
      transcript: text,
      level: 'B1 중급',
    });
  }

  return results;
}

/**
 * 일본어 Wikipedia 기사 3개 가져오기 (일본어 학습용)
 */
export async function fetchJapaneseArticles(count = 3) {
  const candidates = await fetchRandomWikiArticles('ja', count * 3);
  const results = [];

  for (const page of candidates) {
    if (results.length >= count) break;
    const text = await fetchWikiArticleText('ja', page.title);
    if (!text) continue;

    results.push({
      videoId: `wiki_ja_${page.pageid}`,
      title: page.title,
      channelName: '日本語 Wikipedia',
      thumbnail: null,
      transcript: text,
      level: 'N3 중급',
    });
  }

  return results;
}
