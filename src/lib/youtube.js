/**
 * Server-side YouTube helpers
 * Node.js 환경에서만 사용 (API Route, Cron)
 */
import { YoutubeTranscript } from 'youtube-transcript';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

// 학습용 YouTube 검색 쿼리
// 채널 ID 대신 키워드 검색 — 채널 ID 오류에 덜 민감
const SEARCH_QUERIES = {
  Japanese: [
    { q: 'やさしい日本語 ニュース', level: 'N3 중급' },
    { q: 'Japanese listening practice beginner', level: 'N4 기본' },
  ],
  English: [
    { channelId: 'UCHaHD477h-FeBbVh9Sh7syA', name: 'BBC Learning English', level: 'B1 중급' },
    { channelId: 'UCsooa4yRKGN_zEE8iknghZA', name: 'TED-Ed', level: 'B2 상급' },
  ],
};

/**
 * YouTube Data API v3 검색 (채널 또는 키워드)
 * quota: 100 units per call
 */
export async function searchVideos(apiKey, { channelId, q, maxResults = 5, langCode = 'ja' } = {}) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    maxResults: String(maxResults),
    key: apiKey,
    relevanceLanguage: langCode,
    publishedAfter: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60일
  });

  if (channelId) params.set('channelId', channelId);
  if (q) params.set('q', q);

  const res = await fetch(`${YOUTUBE_API}/search?${params}`);
  if (!res.ok) {
    console.error('YouTube search failed:', await res.text());
    return [];
  }

  const data = await res.json();
  return (data.items || []).map(item => ({
    videoId: item.id?.videoId,
    title: item.snippet.title,
    channelName: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    description: item.snippet.description || '',
  })).filter(v => v.videoId);
}

/**
 * YouTube 자막 추출
 * 1차: youtube-transcript 패키지
 * 2차: 영상 설명문 폴백 (200자 이상일 때)
 */
export async function extractTranscript(videoId, langCode = 'ja', description = '') {
  // 1차 시도: youtube-transcript
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: langCode });
    if (items?.length) {
      const lines = items.map(t =>
        t.text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\n/g, ' ').trim()
      ).filter(Boolean);

      const paragraphs = [];
      for (let i = 0; i < lines.length; i += 8) {
        paragraphs.push(lines.slice(i, i + 8).join(' '));
      }
      return paragraphs.join('\n');
    }
  } catch {
    // 자막 없음 또는 차단 — 폴백으로
  }

  // 2차 폴백: 영상 설명문 (학습 채널은 보통 스크립트 일부를 설명에 포함)
  if (description && description.length >= 200) {
    return description.trim();
  }

  return null;
}

/**
 * 일본어 + 영어 추천 영상 목록 수집
 * returns: { Japanese: [...], English: [...] }
 */
export async function fetchSuggestions(apiKey, count = 3) {
  const results = { Japanese: [], English: [] };

  // 일본어: 키워드 검색
  for (const query of SEARCH_QUERIES.Japanese) {
    if (results.Japanese.length >= count) break;
    const videos = await searchVideos(apiKey, { q: query.q, langCode: 'ja', maxResults: count });
    for (const v of videos) {
      if (results.Japanese.length >= count) break;
      const transcript = await extractTranscript(v.videoId, 'ja', v.description);
      results.Japanese.push({ ...v, level: query.level, transcript });
    }
  }

  // 영어: 채널 기반 검색
  for (const ch of SEARCH_QUERIES.English) {
    if (results.English.length >= count) break;
    const videos = await searchVideos(apiKey, {
      channelId: ch.channelId,
      langCode: 'en',
      maxResults: count,
    });
    for (const v of videos) {
      if (results.English.length >= count) break;
      const transcript = await extractTranscript(v.videoId, 'en', v.description);
      results.English.push({ ...v, channelName: ch.name, level: ch.level, transcript });
    }
  }

  return results;
}

/**
 * NHK Web Easy 최신 기사 목록 가져오기
 */
export async function fetchNHKEasyArticles(count = 3) {
  try {
    const res = await fetch('https://www3.nhk.or.jp/news/easy/top-list-data.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www3.nhk.or.jp/news/easy/',
        'Accept': 'application/json, */*',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();

    const results = [];
    for (const article of (data || []).slice(0, count * 2)) {
      if (results.length >= count) break;
      const newsId = article.news_id;
      if (!newsId) continue;

      const text = await fetchNHKArticleText(newsId);
      if (!text) continue;

      results.push({
        videoId: newsId,
        title: article.title,
        channelName: 'NHK Web Easy',
        thumbnail: article.news_image_uri || null,
        transcript: text,
      });
    }

    return results.length > 0 ? results : null;
  } catch (e) {
    console.error('NHK Easy fetch failed:', e.message);
    return null;
  }
}

async function fetchNHKArticleText(newsId) {
  try {
    const res = await fetch(`https://www3.nhk.or.jp/news/easy/${newsId}/${newsId}.html`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www3.nhk.or.jp/news/easy/',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (!match) return null;

    return match[1]
      .replace(/<rt>[^<]*<\/rt>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return null;
  }
}
