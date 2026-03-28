/**
 * Server-side YouTube helpers
 * Node.js 환경에서만 사용 (API Route, Cron)
 */
import { YoutubeTranscript } from 'youtube-transcript';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

// 학습 콘텐츠 채널 목록
// channel ID 확인: youtube.com/@handle → 채널 페이지 소스에서 "channelId" 검색
export const LEARNING_CHANNELS = {
  Japanese: [
    // Comprehensible Japanese: 일본어로만 진행, 자막 있음, N4-N3 수준
    { id: 'UCXo8kuOfFEPQRPqPMPAjHOQ', name: 'Comprehensible Japanese', level: 'N3 중급' },
    // Nihongo con Teppei for Beginners: 짧은 일본어 팟캐스트 스타일
    { id: 'UCwZkjXlspIGxMhMV0kAexeA', name: 'Nihongo con Teppei', level: 'N4 기본' },
  ],
  English: [
    { id: 'UCHaHD477h-FeBbVh9Sh7syA', name: 'BBC Learning English', level: 'B1 중급' },
    { id: 'UCsooa4yRKGN_zEE8iknghZA', name: 'TED-Ed', level: 'B2 상급' },
  ],
};

/**
 * YouTube Data API v3로 채널의 최근 인기 영상 검색
 * quota: 100 units per call
 */
export async function searchChannelVideos(channelId, apiKey, { maxResults = 5, langCode = 'ja' } = {}) {
  const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    type: 'video',
    videoCaption: 'closedCaption',
    order: 'viewCount',
    maxResults: String(maxResults),
    publishedAfter,
    key: apiKey,
  });

  const res = await fetch(`${YOUTUBE_API}/search?${params}`);
  if (!res.ok) {
    console.error(`YouTube search failed for channel ${channelId}:`, await res.text());
    return [];
  }

  const data = await res.json();
  return (data.items || []).map(item => ({
    videoId: item.id?.videoId,
    title: item.snippet.title,
    channelName: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
  })).filter(v => v.videoId);
}

/**
 * YouTube 자막 추출 (youtube-transcript 패키지 사용)
 */
export async function extractTranscript(videoId, langCode = 'ja') {
  try {
    // 요청 언어 우선, 없으면 자동 생성 자막 포함 전체에서 첫 번째
    const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: langCode,
    });

    if (!transcripts?.length) return null;

    const lines = transcripts.map(t =>
      t.text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim()
    ).filter(Boolean);

    // 8줄씩 문단으로 묶기
    const paragraphs = [];
    for (let i = 0; i < lines.length; i += 8) {
      paragraphs.push(lines.slice(i, i + 8).join(' '));
    }

    return paragraphs.join('\n');
  } catch (e) {
    console.error(`Transcript extraction failed [${videoId}]:`, e.message);
    return null;
  }
}

/**
 * NHK Web Easy 최신 기사 목록 가져오기
 * 일본어 학습에 최적화된 쉬운 일본어 뉴스 (N3-N4 수준)
 */
export async function fetchNHKEasyArticles(count = 5) {
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
    const articles = (data || []).slice(0, count);

    const results = [];
    for (const article of articles) {
      const newsId = article.news_id;
      if (!newsId) continue;

      const text = await fetchNHKEasyArticleText(newsId);
      if (!text) continue;

      results.push({
        videoId: newsId,       // video_id 컬럼 재사용
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

async function fetchNHKEasyArticleText(newsId) {
  try {
    const url = `https://www3.nhk.or.jp/news/easy/${newsId}/${newsId}.html`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www3.nhk.or.jp/news/easy/',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // 기사 본문 추출 (article 태그 안, ruby 태그 제거)
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (!articleMatch) return null;

    return articleMatch[1]
      .replace(/<rt>[^<]*<\/rt>/g, '')     // 후리가나 제거
      .replace(/<[^>]+>/g, '')              // 나머지 HTML 태그 제거
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return null;
  }
}
