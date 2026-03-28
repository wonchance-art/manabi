/**
 * Server-side YouTube helpers
 * Node.js 환경에서만 사용 (API Route, Cron)
 */

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

// 학습 콘텐츠 채널 목록
// channel ID 확인: youtube.com/@handle → 채널 페이지 소스에서 "channelId" 검색
export const LEARNING_CHANNELS = {
  Japanese: [
    { id: 'UCRk5KoVGGMg_j7OMauS3v3w', name: 'NHK World Japan', level: 'N3 중급' },
    { id: 'UChG-6mHbSoIRNXESSKgQVdQ', name: 'JapanesePod101', level: 'N4 기본' },
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
 * YouTube 영상 페이지에서 자막 추출 (scraping)
 * YouTube Data API 없이 작동, 공개 자막만 가능
 */
export async function extractTranscript(videoId, langCode = 'ja') {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': langCode === 'ja' ? 'ja-JP,ja;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    // ytInitialPlayerResponse에서 caption track URL 추출
    const captionTracks = extractCaptionTracks(html);
    if (!captionTracks.length) return null;

    // 요청 언어 우선, 없으면 첫 번째 트랙
    const track = captionTracks.find(t => t.languageCode === langCode)
      || captionTracks.find(t => t.languageCode.startsWith(langCode.split('-')[0]))
      || captionTracks[0];

    if (!track?.baseUrl) return null;

    // timedtext XML 가져오기
    const captionRes = await fetch(track.baseUrl);
    if (!captionRes.ok) return null;

    const xml = await captionRes.text();
    return parseTimedtextXML(xml);
  } catch (e) {
    console.error(`Transcript extraction failed [${videoId}]:`, e.message);
    return null;
  }
}

function extractCaptionTracks(html) {
  try {
    // ytInitialPlayerResponse JSON 위치 찾기
    const marker = 'ytInitialPlayerResponse';
    const markerIdx = html.indexOf(marker);
    if (markerIdx === -1) return [];

    // { 시작 위치 찾기
    let start = html.indexOf('{', markerIdx);
    if (start === -1) return [];

    // 괄호 카운팅으로 JSON 끝 찾기 (최대 3MB만 스캔)
    let depth = 0, end = -1;
    const limit = Math.min(start + 3 * 1024 * 1024, html.length);
    for (let i = start; i < limit; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    if (end === -1) return [];

    const playerResponse = JSON.parse(html.substring(start, end + 1));
    return playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  } catch {
    return [];
  }
}

function parseTimedtextXML(xml) {
  const lines = [];
  for (const match of xml.matchAll(/<text[^>]*start="([^"]+)"[^>]*>([^<]*)<\/text>/g)) {
    const text = match[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (text) lines.push(text);
  }

  if (!lines.length) return null;

  // 8줄씩 한 문단으로 묶기
  const paragraphs = [];
  for (let i = 0; i < lines.length; i += 8) {
    paragraphs.push(lines.slice(i, i + 8).join(' '));
  }

  return paragraphs.join('\n');
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
