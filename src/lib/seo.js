// 검색 · 공유 메타의 한 곳(LAUNCH-META-001, 2026-11-06 KST 운영 감사).
//
// 감사에서 본 것: 루트 레이아웃의 `alternates: { canonical: '/' }`가 모든 화면에 물려 지역학 문서 · 개인정보 처리방침 · 뷰어 자료가
// 전부 「정본 = 배움(/)」이라고 알렸고, og:url도 어디서나 첫 화면이었다. 화면이 openGraph를 따로 주면(뷰어 · 문법 · 레벨 목록)
// Next는 그 객체로 통째로 바꾸므로 공유 그림 · 사이트 이름 · 언어가 빠졌다. 사이트 지도 · robots.txt는 옛 기본 주소(이전 Vercel 이름)와
// 비공개 화면(/materials)을 실었다. 이 모듈이 그 넷을 한 곳에서 정한다.
//
// 정본 주소(호스트)는 siteUrl() 한 곳이다 — NEXT_PUBLIC_SITE_URL(운영 값 그대로), 없으면 DEFAULT_SITE_URL.
// www · apex 결정(오너 대기)이 나면 운영 환경 값 또는 아래 한 줄만 바꾼다. 다른 파일에 주소를 적지 않는다(계약 seoMeta.test.js).
export const DEFAULT_SITE_URL = 'https://manabi.co.kr';

/** 정본 출처(끝 / 없음). 화면 · 사이트 지도 · robots.txt · metadataBase가 모두 이 값을 쓴다. */
export function siteUrl(value = process.env.NEXT_PUBLIC_SITE_URL) {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_SITE_URL;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** 경로의 정본 주소 — 질의 · 조각은 버린다(정본은 경로 하나). */
export function canonicalFor(path = '/') {
  const clean = `/${String(path || '/').replace(/[?#].*$/s, '').replace(/^\/+/, '')}`;
  const trimmed = clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
  return `${siteUrl()}${trimmed}`;
}

// 공유 그림 — 루트 opengraph-image.jsx(그 파일의 alt · size · contentType과 같다 — 계약이 맞춘다). 화면이 openGraph를 주면
// Next는 파일 규칙 그림을 그 화면에 붙이지 않는다(resolve-metadata mergeStaticMetadata — 파일이 있는 층에만) — 그래서 여기서 직접 싣는다.
export const OG_IMAGE = Object.freeze({
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'manabi — 읽고, 담고, 제때 다시 만나는 외국어 서재',
  type: 'image/png',
});

/** 모든 화면 공통 openGraph(제목 · 설명은 넣지 않는다 — Next가 그 화면의 title · description을 물려준다). */
export const OG_DEFAULTS = Object.freeze({
  type: 'website',
  siteName: 'manabi',
  locale: 'ko_KR',
  images: Object.freeze([OG_IMAGE]),
});

/** 화면별 openGraph에 공통 값(그림 · 사이트 이름 · 언어 · 종류)을 깐다 — 화면 값이 이긴다. */
export function withOgDefaults(openGraph = {}) {
  return { ...OG_DEFAULTS, ...openGraph };
}

/**
 * 공개 화면 메타 — 자기 정본 주소 + og:url(= 정본) + 공통 openGraph. title · description은 그대로 두고,
 * og · twitter 제목 · 설명은 Next가 그 값을 물려준다(루트가 og · twitter 제목을 고정하지 않는다).
 */
export function publicMetadata(path, metadata = {}) {
  const url = canonicalFor(path);
  const { alternates, openGraph, ...rest } = metadata;
  return {
    ...rest,
    alternates: { ...alternates, canonical: url },
    openGraph: { ...withOgDefaults(openGraph), url },
  };
}

/**
 * 추천 읽을거리(RSS로 모은 외부 기사) 색인 여부 — 기본 끔(오케스트레이터 기본값 2026-11-06 KST).
 * 외부 저작물 본문을 우리 주소로 색인시키면 IP 정책(저작물 본문 복제 금지 — docs/policy-brand-content.md)과
 * 중복 콘텐츠 위험이 겹친다. 오너가 허용하면 이 한 줄을 true로 — 그때는 자기 정본(publicMetadata)으로 바뀐다.
 * 사이트 지도에는 어느 쪽이든 넣지 않는다(sitemapEntries.js — 넣을지는 별도 결정).
 */
export const INDEX_EXTERNAL_SUGGESTIONS = false;

/** 추천 읽을거리 한 편의 메타 — 위 스위치를 따른다. noindex여도 정본 주소는 글 한 편(돌아갈 곳 판과 무관)으로 둔다. */
export function suggestionMetadata(id, metadata = { title: '추천 읽을거리' }, indexed = INDEX_EXTERNAL_SUGGESTIONS) {
  const meta = publicMetadata(`/suggestions/${encodeURIComponent(id)}`, metadata);
  return indexed ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** 개인 · 로그인 · 앱 전용 화면 — 검색 결과에 싣지 않는다. */
export const PRIVATE_ROBOTS = Object.freeze({ index: false, follow: false });
export const PRIVATE_METADATA = Object.freeze({ robots: PRIVATE_ROBOTS });

/**
 * robots.txt Disallow — 계정 데이터 · 로그인 · 앱 전용 화면과 API. 경로 앞부분 일치다(`/study`는 `/studies`를 막지 않는다 —
 * 다섯째 글자부터 다르다). 각 화면은 따로 noindex 메타도 낸다(PRIVATE_METADATA) — 링크로 들어온 주소가 색인되지 않게.
 * `/home/member`는 로그인 판의 내부 경로다(주소창 /home은 middleware가 판을 고른다 — 막아도 /home은 그대로 열린다).
 */
export const ROBOTS_DISALLOW = Object.freeze([
  '/admin',
  '/api/',
  '/auth',
  '/class',
  '/conversation',
  '/embed',
  '/groups',
  '/home/member',
  '/materials',
  '/notes',
  '/offline',
  '/pdf',
  '/profile',
  '/progress',
  '/quick',
  '/review',
  '/study',
  '/vocab',
  '/world',
  '/writing',
]);

/**
 * 사이트 소개 한 줄(LAUNCH-META-004) — 루트 기본 설명 · 배움(/home) 설명 · 사이트 JSON-LD가 같은 문장을 쓴다.
 * 예전 루트 기본값은 「일본어·영어·프랑스어·중국어 학습 도구 — …」였다(영어 · 프랑스어는 지금 교재 · 과정 밖). 자기 설명이 없는 화면(404 등)이 이 문장을 물려받는다.
 */
export const SITE_DESCRIPTION = '읽으면서 배우는 일본어 · 중국어 — 한국인 학습자를 위한 무료 학습장. 모르는 말은 눌러서 뜻과 발음을 보고, 담아 둔 말은 잊을 때쯤 다시 만나요.';

/** 사이트 JSON-LD(WebSite) — 손님 배움 판에만 싣는다(검색 로봇이 보는 판). 운영 주체(Organization)는 운영자 정보가 정해진 뒤에 더한다. */
export function websiteJsonLd() {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: 'manabi', url: `${siteUrl()}/`, inLanguage: 'ko', description: SITE_DESCRIPTION };
}
