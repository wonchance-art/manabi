/**
 * 채널 영상 목록 수집 — **목록만 긷고 자막 본문은 담지 않는다** (v2-F R4, #1077).
 *
 * ── 왜 목록만인가 (오너 확정 2026-09-01)
 *
 * 서비스가 서버에서 자막을 미리 긁어 저장하면, 그건 「사용자가 자기 학습용으로 사본을
 * 만드는 것」이 아니라 **서비스가 남의 자막 DB를 만드는 것**이 된다. 선례 조사에서
 * 그 자리를 택한 서비스가 하나도 없었다 — 확장(Language Reactor·Migaku)은 서버가
 * 콘텐츠를 안 만지고, 카탈로그(Lingopie·Yabla)는 계약하고, LingQ는 **사용자가 넣고
 * 기본 비공개**다. 우리는 LingQ 자리다(F R1이 이미 거기 있었다).
 *
 * ⇒ 크론은 **제목·채널·썸네일·videoId**만 담는다. 자막 복제는 사용자가 카드를 눌러
 * **자기 계정의 비공개 자료**를 만들 때 비로소 일어난다(`/api/import/link` — F R1).
 *
 * ── 그래서 여기서 자막에 손대는 유일한 지점
 *
 * 공식 Data API(youtubeDataApi.js — YT-API-001)로 **자막 유무 · 트랙 언어**만 읽어 「그 언어 자막이 달려 있나」를 본다(본문은 안 받는다).
 * 이게 없으면 자막 없는 영상이 카드로 올라가 클릭 시 붙여넣기로 떨어진다 —
 * 「클릭 하나」가 성립하지 않는다. 판정 못 하면 **버린다**(fail-closed).
 */

import {
  MAX_CAPTION_PROBES, channelUploads, listableProbe, playlistVideoIds, probeVideos, reportYoutubeFailure, scrubKey, youtubeApiKey,
} from './youtubeDataApi.js';

/** 후보를 이만큼까지만 훑는다(videos.list 한 번에 50개까지 — 상한은 쿼터 · 벽시계 여유). */
export const PROBE_MULTIPLIER = 6;
export const MAX_PROBES = 24;

/** 훑을 후보 수 — 자막 필터가 대부분을 떨구므로 원하는 수보다 넉넉히, 단 상한 안에서. */
export function probeBudget(count) {
  const n = Number.isFinite(count) && count > 0 ? count : 1;
  return Math.min(n * PROBE_MULTIPLIER, MAX_PROBES);
}

/**
 * 이 영상을 카드로 올릴 것인가.
 *   · 그 언어 자막이 없다 → ✗ (클릭해도 「클릭 하나」가 안 된다)
 *   · 임베드 명시적 불가 → ✗ (뷰어에서 영상을 못 띄운다. `undefined`=미확인은 통과)
 * @param {{captionLangs?:string[], embeddable?:boolean|undefined}} probe
 * @param {string} langCode 기본 코드('ja'). 빈 값이면 자막 요건을 걸지 않는다.
 */
export function isListable(probe, langCode) {
  if (probe?.embeddable === false) return false;
  const base = String(langCode || '').split('-')[0].toLowerCase();
  if (!base) return true;
  const langs = Array.isArray(probe?.captionLangs) ? probe.captionLangs : [];
  return langs.some((c) => String(c || '').split('-')[0].toLowerCase() === base);
}

/**
 * 정규화된 영상 → 크론이 `daily_suggestions`에 넣는 기사 모양.
 * **`transcript`를 넣지 않는다** — 이 한 줄이 이 라운드의 전부다.
 * `videoId`는 접두사 없이 **실제 유튜브 id** 그대로다(클릭 시점에 이 id로 주소를 만든다).
 */
export function toSuggestionArticle(video, { source, channelName, level } = {}) {
  return {
    videoId: video.videoId,
    title: video.title,
    channelName: video.channel || channelName || '',
    thumbnail: video.thumbnailUrl || null,
    level: level || null,
    source,
  };
}

/**
 * 채널의 최신 영상 중 「그 언어 자막 · 임베드 가능」인 것을 카드로(공식 Data API — YT-API-001).
 * 카드는 전부 목록만(transcript 키 없음, source youtube_ondemand) — 본문은 사용자가 누를 때 /api/import/link가 가져온다.
 * 퍼블릭 도메인 채널(VOA, config.license)도 같다: 공식 API로는 남의 자막 본문을 받을 수 없어 「본문을 담는 공개 자료」 갈래를 닫았다
 * (오너 b안 결정 2026-11-08 KST — 「목록만 + 클릭 시 개인 자료」). 키가 없으면 0건 · 로그 한 줄(fail-closed, 오류 아님).
 */
export async function fetchYoutubeChannel(count = 2, config = {}, deps = {}) {
  const { handle, langCode, level } = config;
  if (!handle) return [];
  const log = deps.log || ((...a) => console.warn('[cron/youtube]', ...a));
  const key = deps.apiKey !== undefined ? deps.apiKey : youtubeApiKey();
  if (!key) { log(`YouTube API 키 없음(YOUTUBE_DATA_API_KEY · YOUTUBE_API_KEY) — 건너뜀: ${handle}`); return []; }
  const opts = { key, fetch: deps.fetch || fetch, ledger: deps.ledger, now: deps.now };
  try {
    const channel = await channelUploads(handle, opts);
    if (!channel) { log(`핸들 해석 실패: ${handle}`); return []; }
    const ids = await playlistVideoIds(channel.uploads, probeBudget(count), opts);
    const videos = await probeVideos(ids, opts);
    const budget = { left: MAX_CAPTION_PROBES };
    const out = [];
    for (const v of videos) {
      if (out.length >= count) break;
      if (!isListable(await listableProbe(v, langCode, opts, budget), langCode)) continue;
      // 채널 수집에서는 채널 자신의 제목이 정본이다(옛 채널 탭 카드의 「12K views」가 채널명 자리에 들어갔던 실측 2026-10-16).
      out.push(toSuggestionArticle({ ...v, channel: channel.title || v.channel }, {
        source: 'youtube_ondemand',
        channelName: channel.title,
        level,
      }));
    }
    if (out.length === 0) log(`자막(${langCode}) 있는 영상 0건: ${handle}`);
    return out;
  } catch (e) {
    // 키 거절(400 · 403)은 그날 나머지 호출을 멈추고(ytApi) 운영 오류 기록에 하루 한 줄. 크론은 0건으로 계속 간다.
    log(`수집 실패 ${handle}: ${scrubKey(e?.message || e, key)}`);
    await reportYoutubeFailure(e, { key, ledger: deps.ledger, now: deps.now, record: deps.recordError });
    return [];
  }
}
