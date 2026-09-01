/**
 * 영상 출처 표기와 라이선스 등급 (v2-F R5, #1077 — 오너 "A ㄱㄱ", 2026-09-01).
 *
 * ── 왜 이 파일이 생겼나
 *
 * F R4는 「서버는 목록만, 복제는 개인이」로 갔다. 남의 자막을 서버가 담을 수 없어서다.
 * 그런데 **그 제약이 없는 자료**가 있다:
 *   · **퍼블릭 도메인** — VOA Learning English(미국 정부 저작물). 저작권 자체가 없다.
 *   · **CC BY** — 업로더가 재배포를 허용한 영상. `youtubei.js` 검색 필터가
 *     `features: ['creative_commons']`를 받는다(실측: types/Misc.d.ts → Innertube.js).
 *     규모도 있다 — YouTube-Commons가 CC-BY 영상 316만 편을 모았다.
 *
 * 이 둘은 **본문을 담아 공개 자료로 공유해도 된다**. 분석도 1회만 돌면 된다.
 * 단 **CC BY는 출처 표기가 의무**다 — 그래서 이 파일의 절반이 표기다.
 *
 * ⚠ 실측으로 알게 된 구멍: `metadata.source`는 **저장만 되고 어디에도 표시되지 않았다**.
 * 저장은 표기가 아니다. 라이선스가 요구하는 것은 **읽는 사람에게 보이는 것**이다.
 */

/** 검색으로 찾은 CC BY 영상 — 라이선스 재확인을 통과한 것만. */
export const CC_SOURCE = 'youtube_cc';
/** 설정으로 지정한 퍼블릭 도메인 채널(VOA) — 라이선스가 YouTube 표식이 아니라 법에서 온다. */
export const PD_SOURCE = 'youtube_pd';

export const LICENSE_CC_BY = 'cc-by';
export const LICENSE_PUBLIC_DOMAIN = 'public-domain';

/** 화면에 그대로 나가는 라이선스 이름. 모르는 값은 표시하지 않는다(거짓말 금지). */
const LICENSE_LABEL = {
  [LICENSE_CC_BY]: 'CC BY',
  [LICENSE_PUBLIC_DOMAIN]: '퍼블릭 도메인',
};

/** 본문을 담아 공개 자료로 둘 수 있는 출처인가. */
export function isShareableSource(source) {
  return source === CC_SOURCE || source === PD_SOURCE;
}

/** 그 출처가 실어야 하는 라이선스 코드. 공유 불가 출처는 null. */
export function licenseForSource(source) {
  if (source === CC_SOURCE) return LICENSE_CC_BY;
  if (source === PD_SOURCE) return LICENSE_PUBLIC_DOMAIN;
  return null;
}

/**
 * YouTube 라이선스 행의 **지역화된 문자열**이 CC 표시인가.
 *
 * 영상 단위 라이선스는 boolean 필드가 아니다 — 처음엔 `VideoInfo.license`를 찾았다고
 * 여겼는데 실측하니 그건 **`music_tracks` 안**(배경음악)이었다. 실제 값은
 * `secondary_info.metadata.rows`의 사람이 읽는 문자열이라, 세션 언어를 고정해도
 * 표기가 흔들릴 수 있다. 그래서 **판정은 fail-closed**다 — 확신 못 하면 false.
 */
export function isCreativeCommonsText(text) {
  const s = String(text || '').toLowerCase();
  if (!s) return false;
  // 'Creative Commons Attribution license (reuse allowed)' / 'クリエイティブ・コモンズ' 등
  if (s.includes('creative commons')) return true;
  if (s.includes('クリエイティブ')) return true;
  if (s.includes('크리에이티브 커먼즈')) return true;
  // 'Standard YouTube License'는 명백한 부정 — 부분 문자열로 새지 않게 못 박는다.
  return false;
}

/**
 * 화면에 보이는 출처 한 줄의 재료. 렌더는 컴포넌트가 한다(링크를 걸어야 하므로).
 * 라이선스를 모르는 개인 반입분에도 **채널·원본 링크는 준다** — 법적 의무는 없지만
 * 「어디서 온 글인지」는 어차피 필요한 정보다.
 * @returns {{channel:string, license:string, url:string}|null}
 */
export function attributionParts(source) {
  if (!source || source.kind !== 'youtube') return null;
  const channel = String(source.channel || '').trim();
  const url = String(source.url || '').trim();
  if (!channel && !url) return null;
  return { channel, license: LICENSE_LABEL[source.license] || '', url };
}
