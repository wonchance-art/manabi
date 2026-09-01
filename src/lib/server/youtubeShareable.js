/**
 * 공유 가능한 영상 수집 — **본문까지 담는다** (v2-F R5, #1077, 오너 "A ㄱㄱ").
 *
 * F R4는 「서버는 목록만」으로 갔다. 남의 자막을 담을 수 없어서다. 이 파일은 **그 제약이
 * 없는 자료**를 다룬다 — 퍼블릭 도메인(VOA)과 CC BY. 둘은 재배포가 허용되므로 본문을
 * 담아 **공개 자료로 공유**할 수 있고, 그러면 분석도 1회만 돌면 된다.
 *
 * ── 판정은 fail-closed다
 *
 * 영상 라이선스는 boolean이 아니라 `secondary_info.metadata.rows`의 **사람이 읽는 문자열**이다
 * (처음엔 `VideoInfo.license`인 줄 알았는데 실측하니 `music_tracks` 안이었다 — 배경음악).
 * 그래서 확신 못 하면 **공유 등급을 주지 않는다**. 검색 필터가 CC라고 해도 행에서
 * 재확인되지 않으면 버린다 — 잘못 공개하는 쪽이 놓치는 쪽보다 훨씬 비싸다.
 *
 * ── 본문 취득은 기보유 부품 조립이다 (신규 파서 0)
 *
 * `selectCaptionTrack` → `withCaptionFormat` → `parseCaptionData`(media.js) →
 * `stripCueNoise` → `paragraphize`(linkImport.js). 뒤 둘은 **F R1 붙여넣기 경로와 같은
 * 정본**이라, 같은 영상이 어느 문으로 들어와도 본문 모양이 갈리지 않는다.
 */

import {
  parseCaptionData, selectCaptionTrack, withCaptionFormat,
} from './media.js';
import { paragraphize, stripCueNoise } from '../linkImport.js';
import { CC_SOURCE, PD_SOURCE, isCreativeCommonsText, licenseForSource } from '../videoAttribution.js';
import { isListable, probeBudget, toSuggestionArticle } from './youtubeChannel.js';

/**
 * 라이선스 행의 문자열을 꺼낸다. **행을 못 찾으면 null**(전체 텍스트를 훑지 않는다 —
 * 설명문에 'creative commons'가 들어간 영상을 CC로 오인하면 그게 곧 오공개다).
 * 세션 언어를 en으로 고정해 행 제목을 예측 가능하게 만든다(호출부 책임).
 */
export function readLicenseText(info) {
  const rows = info?.secondary_info?.metadata?.rows;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    const title = rowText(row?.title);
    if (!/licen[cs]e/i.test(title)) continue;
    const value = rowText(row?.contents) || rowText(row?.default_metadata_value);
    if (value) return value;
  }
  return null;
}

/** youtubei.js 텍스트 노드는 모양이 여럿이다 — 문자열·{text}·배열·runs. 넓게 받는다. */
function rowText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(rowText).filter(Boolean).join(' ');
  if (typeof node.toString === 'function' && typeof node.text === 'string') return node.text;
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.runs)) return node.runs.map((r) => r?.text || '').join('');
  return '';
}

/** 자막 트랙 → 문단 본문. 실패는 전부 null(호출부가 그 영상을 버린다). */
export async function fetchCaptionText(info, langCode, deps = {}) {
  const doFetch = deps.fetch || fetch;
  const { track } = selectCaptionTrack(info?.captions?.caption_tracks, langCode);
  if (!track?.base_url) return null;
  try {
    const res = await doFetch(withCaptionFormat(track.base_url, 'json3'), { cache: 'no-store' });
    if (!res.ok) return null;
    const cues = parseCaptionData(await res.text());
    if (!cues.length) return null;
    const lines = stripCueNoise(cues.map((c) => c.text).join('\n'));
    return lines.length ? paragraphize(lines) : null;
  } catch {
    return null;
  }
}

/** 본문 하한 — 이보다 짧으면 학습 자료가 아니라 자막 조각이다(F R1과 같은 결). */
export const MIN_BODY_CHARS = 200;
/** 자료 하나가 지나치게 길면 분석 비용이 튄다. F R1의 폼 상한과 같은 값. */
export const MAX_BODY_CHARS = 50000;

/**
 * 공유 등급 판정. **이 함수 하나가 오공개를 막는다.**
 *   · 퍼블릭 도메인은 **설정이 근거**다(VOA는 미국법에서 오지 저 YouTube 표식에서 오지 않는다)
 *   · CC는 **행에서 재확인**돼야 한다 — 검색 필터만으로는 등급을 주지 않는다
 * @returns {'youtube_pd'|'youtube_cc'|null} null이면 공유 불가
 */
export function shareableSource(config, licenseText) {
  if (config?.license === 'public-domain') return PD_SOURCE;
  if (isCreativeCommonsText(licenseText)) return CC_SOURCE;
  return null;
}

/**
 * CC BY + 자막 있는 영상을 검색해 **본문까지** 담아 온다.
 * 검색 필터는 `youtubei.js`가 그대로 지원한다(features: creative_commons·subtitles).
 */
export async function fetchYoutubeCc(count = 2, config = {}, deps = {}) {
  const { query, langCode, level } = config;
  if (!query) return [];
  const log = deps.log || ((...a) => console.warn('[cron/youtube-cc]', ...a));
  try {
    const { Innertube } = deps.innertube ? { Innertube: deps.innertube } : await import('youtubei.js');
    // 라이선스 행 제목이 'License'로 오도록 세션 언어를 고정한다 — 판정이 지역화 문자열에
    // 걸려 있어서, 언어가 흔들리면 전부 fail-closed로 떨어져 수확이 0이 된다.
    const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: false });

    const search = await yt.search(query, {
      type: 'video',
      features: ['subtitles', 'creative_commons'],
    });
    const { normalizeVideoList } = await import('./media.js');
    const videos = normalizeVideoList(search?.videos || search?.results || [], probeBudget(count));

    const out = [];
    for (const v of videos) {
      if (out.length >= count) break;
      let info;
      try { info = await yt.getBasicInfo(v.videoId); } catch { continue; }
      const article = await buildShareableArticle({ video: v, info, config, langCode, level }, deps);
      if (article) out.push(article);
    }
    if (out.length === 0) log(`CC 자막 영상 0건: "${query}"`);
    return out;
  } catch (e) {
    log(`수집 실패 "${query}": ${e?.message || e}`);
    return [];
  }
}

/**
 * 영상 하나 → 공개 자료 기사. 하나라도 어긋나면 null(자막·라이선스·길이).
 * 분리해 둔 이유: 채널 수집(퍼블릭 도메인)과 CC 검색이 **같은 판정**을 타야 하기 때문이다.
 */
export async function buildShareableArticle({ video, info, config, langCode, level }, deps = {}) {
  const { extractCaptionLangs, extractEmbeddable } = await import('./media.js');
  const probe = { captionLangs: extractCaptionLangs(info), embeddable: extractEmbeddable(info) };
  if (!isListable(probe, langCode)) return null;

  const source = shareableSource(config, readLicenseText(info));
  if (!source) return null;                       // 라이선스 미확인 = 공개 불가

  const body = await fetchCaptionText(info, langCode, deps);
  if (!body || body.length < MIN_BODY_CHARS) return null;

  return {
    ...toSuggestionArticle(video, { source, channelName: video.channel, level }),
    transcript: body.slice(0, MAX_BODY_CHARS),
    license: licenseForSource(source),
  };
}
