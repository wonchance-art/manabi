/**
 * YouTube 공식 Data API v3 — 영상 **목록 · 판정**만(YT-API-001 · 2026-11-08 KST, 오너 b안 「권장대로」).
 *
 * 왜: 비공식 InnerTube 클라이언트(youtubei.js 17.2.0)의 getBasicInfo가 3/28부터 YouTube에서 UNPLAYABLE
 * (「The page needs to be reloaded」)을 받아 영어 · 일본어 영상 수집이 0건이었다. 공식 API는 계약된 표면이라
 * 다음 YouTube 변경에 덜 흔들린다. 설계 · 쿼터 근거 = docs/design/youtube-data-api-20261108.md.
 *
 * 하는 것: 핸들 → 업로드 재생목록 → 최신 영상 id · CC 검색 → 영상 판정(자막 유무 · 임베드 · 라이선스 · 오디오 언어).
 * 하지 않는 것: 자막 **본문**. 공식 API는 남의 영상 자막을 내려받을 수 없다(captions.download = 소유자 OAuth).
 *   그래서 수집 카드는 전부 「목록만 + 클릭 시 개인 자료」(youtube_ondemand)다 — 본문은 /api/import/link가 클릭 때 가져온다.
 *
 * 키(YOUTUBE_DATA_API_KEY, 서버 전용)가 없으면 null을 돌려 부르는 쪽이 0건으로 끝낸다(fail-closed · 오류 없음).
 * 키는 로그 · 오류 문구에 싣지 않는다. 네트워크는 deps.fetch로 바꿔 끼운다(테스트는 네트워크 없이).
 */

export const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
/** 자막 언어를 오디오 언어로 못 가를 때만 captions.list(영상당 50단위)를 부른다 — 소스당 상한. */
export const MAX_CAPTION_PROBES = 3;

/** 서버 환경의 키 — 없거나 비면 null. */
export function youtubeApiKey(env = process.env) {
  const key = String(env?.YOUTUBE_DATA_API_KEY || '').trim();
  return key || null;
}

/** 공식 API 한 번. 실패는 던진다(문구에 키를 싣지 않는다). */
export async function ytApi(endpoint, params, { key, fetch: doFetch = fetch } = {}) {
  const qs = new URLSearchParams({ ...params, key });
  const res = await doFetch(`${YT_API_BASE}/${endpoint}?${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.json())?.error?.errors?.[0]?.reason || ''; } catch { /* 본문 없음 */ }
    throw new Error(`youtube_api_${endpoint}_${res.status}${reason ? `_${reason}` : ''}`);
  }
  return res.json();
}

/** 핸들(@VOALearningEnglish) → { uploads, title }. 못 찾으면 null. 1단위. */
export async function channelUploads(handle, opts) {
  const forHandle = String(handle || '').replace(/^@?/, '@');
  const data = await ytApi('channels', { part: 'contentDetails,snippet', forHandle }, opts);
  const ch = data?.items?.[0];
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads;
  return uploads ? { uploads, title: String(ch?.snippet?.title || '').trim() } : null;
}

/** 재생목록 최신 영상 id(최대 50). 1단위. */
export async function playlistVideoIds(playlistId, max, opts) {
  const data = await ytApi('playlistItems', {
    part: 'contentDetails', playlistId, maxResults: String(Math.min(Math.max(max, 1), 50)),
  }, opts);
  return (data?.items || []).map((it) => it?.contentDetails?.videoId).filter(Boolean);
}

/** CC BY · 자막 있는 · 임베드 가능 영상 검색 → id. 100단위. */
export async function searchCcVideoIds(query, langCode, max, opts) {
  const params = {
    part: 'id', type: 'video', q: query, maxResults: String(Math.min(Math.max(max, 1), 50)),
    videoLicense: 'creativeCommon', videoCaption: 'closedCaption', videoEmbeddable: 'true',
  };
  if (langCode) params.relevanceLanguage = String(langCode).split('-')[0];
  const data = await ytApi('search', params, opts);
  return (data?.items || []).map((it) => it?.id?.videoId).filter(Boolean);
}

/**
 * 영상 판정 재료(최대 50개 한 번에, 1단위) → 정규화.
 * @returns {Array<{videoId,title,channel,thumbnailUrl,hasCaptions,embeddable,license,audioLanguage}>}
 */
export async function probeVideos(ids, opts) {
  if (!ids.length) return [];
  const data = await ytApi('videos', { part: 'snippet,contentDetails,status', id: ids.slice(0, 50).join(',') }, opts);
  return (data?.items || []).map(normalizeVideo).filter(Boolean);
}

export function normalizeVideo(item) {
  if (!item?.id) return null;
  const sn = item.snippet || {};
  const th = sn.thumbnails || {};
  return {
    videoId: item.id,
    title: String(sn.title || '').trim(),
    channel: String(sn.channelTitle || '').trim(),
    thumbnailUrl: (th.medium || th.high || th.default || {}).url || null,
    hasCaptions: item.contentDetails?.caption === 'true',
    embeddable: typeof item.status?.embeddable === 'boolean' ? item.status.embeddable : undefined,
    license: item.status?.license || null,
    audioLanguage: sn.defaultAudioLanguage || sn.defaultLanguage || null,
  };
}

/** 그 영상의 자막 트랙 언어(captions.list, 50단위). 실패면 null(모름). */
export async function captionLanguages(videoId, opts) {
  try {
    const data = await ytApi('captions', { part: 'snippet', videoId }, opts);
    return (data?.items || []).map((c) => c?.snippet?.language).filter(Boolean);
  } catch {
    return null;
  }
}

const base = (code) => String(code || '').split('-')[0].toLowerCase();

/**
 * 판정 재료 → isListable(youtubeChannel.js 정본)이 받는 probe 모양 { captionLangs, embeddable }.
 * 자막이 없으면 빈 목록(→ 거절). 오디오 언어가 langCode와 같으면 그 언어 자막이 있다고 본다(공식 API는 트랙 언어를 videos에 싣지 않는다).
 * 오디오 언어가 없거나 다르면 captions.list로 트랙 언어를 확인한다(상한 budget.left — 넘으면 거절, fail-closed).
 */
export async function listableProbe(video, langCode, opts, budget = { left: MAX_CAPTION_PROBES }) {
  if (!video?.hasCaptions) return { captionLangs: [], embeddable: video?.embeddable };
  const want = base(langCode);
  if (!want || base(video.audioLanguage) === want) return { captionLangs: [want || 'any'], embeddable: video.embeddable };
  if (budget.left <= 0) return { captionLangs: [], embeddable: video.embeddable };
  budget.left -= 1;
  const langs = await captionLanguages(video.videoId, opts);
  return { captionLangs: langs || [], embeddable: video.embeddable };
}
