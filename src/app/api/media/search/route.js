// POST /api/media/search — 「듣고 읽기」 실험용 영상 검색.
// body: { query }  — 검색어 또는 유튜브 영상/채널 URL.
//   · 영상 URL      → 그 영상 1개
//   · 채널 URL      → 채널 최신 영상들
//   · 그 외 텍스트  → 검색
// 반환: [{ videoId, title, channel, durationSec, thumbnailUrl, hasCaptions }] 최대 20개.
//
// 비공식 라이브러리(youtubei.js/Innertube) 사용 — 오너가 비상업 개인용 사용을 승인.
// 서버 전용(클라 번들 금지). 라이브러리 내부 예외가 500 스택으로 새지 않도록 전면 try/catch.

import { createClient } from '@supabase/supabase-js';
import { Innertube, Log } from 'youtubei.js';
import { parseYouTubeId } from '@/lib/listenSubtitles';
import { normalizeVideoList } from '@/lib/server/media';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// youtubei.js 내부 파서 경고([YOUTUBEJS][Text] 등) 소음 억제. 우리 [media/*] 로그는 유지.
Log.setLevel(Log.Level.NONE);

// Innertube 인스턴스는 재사용(생성 비용·토큰 획득). 첫 요청에서 lazy 생성.
let innertubePromise = null;
function getInnertube() {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({ retrieve_player: false }).catch((e) => {
      innertubePromise = null; // 실패 시 다음 요청에서 재시도
      throw e;
    });
  }
  return innertubePromise;
}

async function requireUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { error: '로그인이 필요합니다.', status: 401 };
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { error: '세션이 만료됐어요. 다시 로그인해주세요.', status: 401 };
  return { user };
}

// 채널 URL 판별: /channel/UC…, /@handle, /c/name, /user/name
function detectChannel(raw) {
  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (!(host === 'youtube.com' || host === 'm.youtube.com' || host.endsWith('.youtube.com'))) {
    return null;
  }
  const segs = url.pathname.split('/').filter(Boolean);
  if (segs.length === 0) return null;
  if (segs[0].startsWith('@')) return { type: 'handle', value: segs[0] };
  if (['channel', 'c', 'user'].includes(segs[0]) && segs[1]) {
    return { type: segs[0], value: segs[1] };
  }
  return null;
}

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const rl = rateLimit(getClientKey(request, auth.user.id), { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return Response.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 요청이에요.' }, { status: 400 });
  }
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query) return Response.json({ error: '검색어를 입력해주세요.' }, { status: 400 });

  try {
    const yt = await getInnertube();

    // 1) 영상 URL/ID → 그 영상 하나
    const directId = parseYouTubeId(query);
    if (directId) {
      try {
        const info = await yt.getBasicInfo(directId);
        const b = info?.basic_info || {};
        const results = [{
          videoId: b.id || directId,
          title: b.title || '',
          channel: b.channel?.name || b.author || '',
          durationSec: Number.isFinite(b.duration) ? b.duration : null,
          thumbnailUrl: pickThumb(b.thumbnail) || `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
          hasCaptions: Array.isArray(info?.captions?.caption_tracks)
            ? info.captions.caption_tracks.length > 0
            : null,
        }];
        return Response.json({ results });
      } catch {
        // 영상 정보 실패해도 최소 정보로 진행(플레이어는 videoId만으로 재생 가능)
        return Response.json({
          results: [{
            videoId: directId, title: '', channel: '', durationSec: null,
            thumbnailUrl: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`, hasCaptions: null,
          }],
        });
      }
    }

    // 2) 채널 URL → 채널 최신 영상
    const channel = detectChannel(query);
    if (channel) {
      const results = await searchChannelVideos(yt, channel);
      return Response.json({ results });
    }

    // 3) 일반 검색
    const search = await yt.search(query, { type: 'video' });
    const results = normalizeVideoList(search?.videos || [], 20);
    return Response.json({ results });
  } catch (err) {
    console.error('[api/media/search] error:', err?.message);
    return Response.json(
      { error: '영상을 검색하지 못했어요. 잠시 후 다시 시도하거나 직접 입력을 이용해주세요.' },
      { status: 502 }
    );
  }
}

function pickThumb(thumbs) {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return '';
  const withUrl = thumbs.filter((t) => t && t.url);
  return withUrl.length ? withUrl[withUrl.length - 1].url : '';
}

async function searchChannelVideos(yt, channel) {
  let channelId = channel.value;
  // handle(@name)·c·user는 검색으로 채널 id 해석
  if (channel.type !== 'channel') {
    try {
      const nav = await yt.resolveURL(
        channel.type === 'handle'
          ? `https://www.youtube.com/${channel.value}`
          : `https://www.youtube.com/${channel.type}/${channel.value}`
      );
      channelId = nav?.payload?.browseId || channelId;
    } catch {
      // 해석 실패 시 아래 getChannel에서 다시 시도
    }
  }
  const ch = await yt.getChannel(channelId);
  let videosTab = ch;
  try {
    if (typeof ch.getVideos === 'function' && ch.has_videos) videosTab = await ch.getVideos();
  } catch {
    videosTab = ch;
  }
  return normalizeVideoList(videosTab?.videos || ch?.videos || [], 20);
}
