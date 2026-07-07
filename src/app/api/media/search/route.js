// POST /api/media/search — 「듣고 읽기」 실험용 영상 검색.
// body: { query }  — 검색어 또는 유튜브 영상/채널 URL.
//   · 영상 URL      → 그 영상 1개
//   · 채널 URL      → 채널 최신 영상들
//   · 그 외 텍스트  → 검색
// 반환: [{ videoId, title, channel, durationSec, thumbnailUrl, hasCaptions }] 최대 20개.
//
// 비공식 라이브러리(youtubei.js/Innertube) 사용 — 오너가 비상업 개인용 사용을 승인.
// 서버 전용(클라 번들 금지). 라이브러리 내부 예외가 500 스택으로 새지 않도록 전면 try/catch.

import { Innertube, Log } from 'youtubei.js';
import { parseYouTubeId } from '@/lib/listenSubtitles';
import { normalizeVideoList, resolveSearchLang, extractCaptionLangs, extractEmbeddable, sortByUsability } from '@/lib/server/media';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { requireAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

// youtubei.js 내부 파서 경고([YOUTUBEJS][Text] 등) 소음 억제. 우리 [media/*] 로그는 유지.
Log.setLevel(Log.Level.NONE);

// Innertube 인스턴스는 재사용(생성 비용·토큰 획득). 첫 요청에서 lazy 생성.
// 학습 언어별로 세션 lang/location을 달리 심어야 하므로 언어 코드별로 캐시한다
// (기본 세션은 키 ''). SessionOptions.lang/location — Session.d.ts:111-119 근거.
const innertubeCache = new Map(); // key(langCode|'') → Promise<Innertube>
function getInnertube(session) {
  const key = session ? session.lang : '';
  if (!innertubeCache.has(key)) {
    const opts = { retrieve_player: false };
    if (session) { opts.lang = session.lang; opts.location = session.location; }
    const p = Innertube.create(opts).catch((e) => {
      innertubeCache.delete(key); // 실패 시 다음 요청에서 재시도
      throw e;
    });
    innertubeCache.set(key, p);
  }
  return innertubeCache.get(key);
}

// 검색어 분기 결과 상위 N개에 한해 caption_tracks 언어 코드를 뽑아 captionLangs로,
// 임베드(외부 재생) 가능 여부를 embeddable로 주석한다. 둘 다 같은 getBasicInfo
// 응답에서 추출하므로 추가 호출 비용 없음(playability_status·captions 동일 응답 포함).
// getBasicInfo는 영상당 watch 엔드포인트 1회 호출(Innertube.js) — 상위 8개 병렬,
// 개당 실패 무시(allSettled), 전체 4초 상한(Promise.race)으로 검색 응답 지연을 막는다.
async function annotateCaptionLangs(yt, results, { count = 8, timeoutMs = 4000 } = {}) {
  const targets = results.slice(0, count);
  if (targets.length === 0) return results;
  const work = Promise.allSettled(
    targets.map(async (v) => {
      const info = await yt.getBasicInfo(v.videoId);
      v.captionLangs = extractCaptionLangs(info);
      v.embeddable = extractEmbeddable(info); // true|false|undefined(미확인)
    })
  );
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  await Promise.race([work, timeout]);
  clearTimeout(timer);
  return results;
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
  const auth = await requireAdmin(request);
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

  // 학습 언어 → 세션 언어/지역 + 뱃지 대조용 코드
  const { code: langCode, session } = resolveSearchLang(body?.lang);

  try {
    const yt = await getInnertube(session);

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

    // 3) 일반 검색 — CC 필터(features:['subtitles'])로 자막 있는 영상만.
    //    SearchFilters.features?: Feature[] 에 'subtitles' 포함(types/Misc.d.ts:9,15).
    //    ※ URL 직접입력 분기(위)에는 적용하지 않음 — 검색어 분기 전용.
    const search = await yt.search(query, { type: 'video', features: ['subtitles'] });
    const results = normalizeVideoList(search?.videos || [], 20);
    // 상위 결과에 자막 언어 뱃지 주석(best-effort, 4초 상한).
    await annotateCaptionLangs(yt, results);
    // 바로 학습 가능한 것부터 — 요청 언어 자막 확인 > 재생 가능 > 미확인 > 임베드 차단.
    return Response.json({ results: sortByUsability(results, langCode), langCode });
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
