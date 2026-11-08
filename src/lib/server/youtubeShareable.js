/**
 * CC BY 영상 검색 수집(v2-F R5 → YT-API-001 · 2026-11-08 KST).
 *
 * 처음(F R5)에는 재배포가 허용된 CC BY · 퍼블릭 도메인 영상의 자막 **본문까지** 담아 공개 자료로 두었다.
 * 그 경로는 비공식 클라이언트(youtubei.js)의 자막 트랙 URL에 기대고 있었고, 3/28부터 YouTube가 그 응답을 막아 수확이 0이었다.
 * 공식 Data API는 남의 영상 자막 본문을 내려받지 못한다(captions.download = 소유자 OAuth) — 그래서 오너 b안 결정(11/8)대로
 * CC 검색도 「목록만 + 클릭 시 개인 자료」(youtube_ondemand)로 바꾼다. 이미 저장된 CC · PD 공개 자료의 출처 표기(videoAttribution.js)는 그대로다.
 *
 * ── 라이선스 판정은 여전히 fail-closed다
 * 검색 필터(videoLicense=creativeCommon)를 믿지 않고, 영상마다 videos.list의 status.license === 'creativeCommon'을 다시 본다.
 * 목록만 담더라도 「CC 검색」이라 이름 붙인 소스가 표준 라이선스 영상을 올리지 않게 한다.
 */

import { isListable, probeBudget, toSuggestionArticle } from './youtubeChannel.js';
import {
  MAX_CAPTION_PROBES, listableProbe, probeVideos, reportYoutubeFailure, scrubKey, searchCcVideoIds, youtubeApiKey,
} from './youtubeDataApi.js';

/** 공식 API 라이선스 값 중 CC BY만 통과(fail-closed). */
export function isCreativeCommonsLicense(license) {
  return license === 'creativeCommon';
}

/** CC BY + 그 언어 자막 + 임베드 가능 영상 → 목록 카드. 키가 없으면 0건 · 로그 한 줄(오류 아님). */
export async function fetchYoutubeCc(count = 2, config = {}, deps = {}) {
  const { query, langCode, level } = config;
  if (!query) return [];
  const log = deps.log || ((...a) => console.warn('[cron/youtube-cc]', ...a));
  const key = deps.apiKey !== undefined ? deps.apiKey : youtubeApiKey();
  if (!key) { log(`YouTube API 키 없음(YOUTUBE_DATA_API_KEY · YOUTUBE_API_KEY) — 건너뜀: "${query}"`); return []; }
  const opts = { key, fetch: deps.fetch || fetch, ledger: deps.ledger, now: deps.now };
  try {
    const ids = await searchCcVideoIds(query, langCode, probeBudget(count), opts);
    const videos = await probeVideos(ids, opts);
    const budget = { left: MAX_CAPTION_PROBES };
    const out = [];
    for (const v of videos) {
      if (out.length >= count) break;
      if (!isCreativeCommonsLicense(v.license)) continue;          // 검색 필터만으로는 통과시키지 않는다
      if (!isListable(await listableProbe(v, langCode, opts, budget), langCode)) continue;
      out.push(toSuggestionArticle(v, { source: 'youtube_ondemand', channelName: v.channel, level }));
    }
    if (out.length === 0) log(`CC 자막 영상 0건: "${query}"`);
    return out;
  } catch (e) {
    log(`수집 실패 "${query}": ${scrubKey(e?.message || e, key)}`);
    await reportYoutubeFailure(e, { key, ledger: deps.ledger, now: deps.now, record: deps.recordError });
    return [];
  }
}
