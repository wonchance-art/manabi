/**
 * 콘텐츠 소스 — Wikimedia APIs (무료, 키 불필요, 차단 없음)
 *
 * wikipedia_good:
 *   - lang: 'simple' → Simple English Wikipedia Good Articles (A2-B1)
 *   - lang: 'ja'     → 日本語 Wikipedia 秀逸な記事 (N2-N1)
 *
 * wikinews:
 *   - lang: 'en'     → English Wikinews 최신 기사 (B2)
 */

const WIKI_UA = 'ManabiApp/1.0 (language-learning)';

// ── 공통 유틸 ──────────────────────────────────────────────────

async function wikiFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
  if (!res.ok) return null;
  return res.json();
}

/** Wikipedia/Wikinews 기사 전문 plain text 가져오기 */
async function fetchArticleText(host, title) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: 'true',
    exsectionformat: 'plain',
    titles: title,
    format: 'json',
    origin: '*',
  });

  const data = await wikiFetch(`${host}/w/api.php?${params}`);
  if (!data) return null;

  const page = Object.values(data.query?.pages || {})[0];
  if (!page?.extract) return null;

  const text = page.extract.trim();
  // 너무 짧거나 동음이의 페이지 제외
  if (text.length < 200 || text.includes('may refer to:') || text.includes('이(가) 가리키는')) {
    return null;
  }

  return text.slice(0, 3000);
}

/** 카테고리 구성원 목록 가져오기 (최대 500개) */
async function fetchCategoryMembers(host, categoryTitle, limit = 200) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: categoryTitle,
    cmlimit: String(limit),
    cmnamespace: '0',
    format: 'json',
    origin: '*',
  });

  const data = await wikiFetch(`${host}/w/api.php?${params}`);
  return (data?.query?.categorymembers || []).map(p => p.title);
}

// ── 소스별 fetcher ─────────────────────────────────────────────

/**
 * Simple English Wikipedia Good Articles
 * 학습자용으로 검토된 고품질 기사 (A2-B1 수준)
 */
export async function fetchSimpleGoodArticles(count = 3) {
  const titles = await fetchCategoryMembers(
    'https://simple.wikipedia.org',
    'Category:Good articles',
    300,
  );
  if (!titles.length) return [];

  // 랜덤 샘플링
  const shuffled = titles.sort(() => Math.random() - 0.5);
  const results = [];

  for (const title of shuffled) {
    if (results.length >= count) break;
    const text = await fetchArticleText('https://simple.wikipedia.org', title);
    if (!text) continue;

    results.push({
      videoId: `wiki_simple_${encodeURIComponent(title)}`,
      title,
      channelName: 'Simple English Wikipedia',
      thumbnail: null,
      transcript: text,
      level: 'B1 중급',
    });
  }

  return results;
}

/**
 * 日本語 Wikipedia 秀逸な記事 (Featured Articles)
 * 편집자가 선정한 고품질 일본어 기사 (N2-N1 수준)
 */
export async function fetchJapaneseFeaturedArticles(count = 3) {
  const titles = await fetchCategoryMembers(
    'https://ja.wikipedia.org',
    'Category:秀逸な記事',
    200,
  );
  if (!titles.length) return [];

  const shuffled = titles.sort(() => Math.random() - 0.5);
  const results = [];

  for (const title of shuffled) {
    if (results.length >= count) break;
    const text = await fetchArticleText('https://ja.wikipedia.org', title);
    if (!text) continue;

    results.push({
      videoId: `wiki_ja_${encodeURIComponent(title)}`,
      title,
      channelName: '日本語 Wikipedia 秀逸な記事',
      thumbnail: null,
      transcript: text,
      level: 'N2 상급',
    });
  }

  return results;
}

/**
 * English Wikinews — 최신 뉴스 기사 (B2 수준)
 * 실제 시사 뉴스, 저널리즘 영어
 */
export async function fetchWikinews(count = 3) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'recentchanges',
    rcnamespace: '0',
    rclimit: String(count * 4),  // 일부 실패 감안해 여유분 요청
    rctype: 'new',
    format: 'json',
    origin: '*',
  });

  const data = await wikiFetch(`https://en.wikinews.org/w/api.php?${params}`);
  const articles = data?.query?.recentchanges || [];

  const results = [];
  for (const article of articles) {
    if (results.length >= count) break;
    const text = await fetchArticleText('https://en.wikinews.org', article.title);
    if (!text) continue;

    results.push({
      videoId: `wikinews_${encodeURIComponent(article.title)}`,
      title: article.title,
      channelName: 'English Wikinews',
      thumbnail: null,
      transcript: text,
      level: 'B2 상급',
    });
  }

  return results;
}

// ── source_type 디스패처 (cron에서 사용) ──────────────────────

export async function fetchFromSource(source, count = 3) {
  const { source_type, config = {} } = source;
  const lang = config.lang || 'simple';

  switch (source_type) {
    case 'wikipedia_good':
      return lang === 'ja'
        ? fetchJapaneseFeaturedArticles(count)
        : fetchSimpleGoodArticles(count);

    case 'wikinews':
      return fetchWikinews(count);

    // 이전 버전 호환
    case 'wikipedia_random':
      return lang === 'ja'
        ? fetchJapaneseFeaturedArticles(count)
        : fetchSimpleGoodArticles(count);

    default:
      return [];
  }
}

// 이전 코드와의 호환성 유지
export const fetchEnglishArticles  = fetchSimpleGoodArticles;
export const fetchJapaneseArticles = fetchJapaneseFeaturedArticles;
