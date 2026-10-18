// 「그림 한 장 읽기」 해설 원문 받기 — 출처 응답 → 카탈로그 text (ART-P0-2).
//
// 해설은 출처에서 받은 그대로 싣고 SHA-256으로 묶는다(artCatalog.textSha256). 다만 출처마다 응답 모양이 달라
// 「그대로」의 뜻을 한 함수로 고정한다 — 시카고 미술관 description은 HTML 조각이라 태그를 벗기고,
// ColBase 解説은 평문이라 줄바꿈만 맞춘다. 낱말·문장부호는 어느 쪽도 바꾸지 않는다.
// 받는 일(네트워크)은 scripts/fetch-art-description.mjs·scripts/art/snapshot-sources.mjs가 하고, 이 파일은 순수 함수만 둔다.
//
// ART-AUTO-1: 출처표가 스냅샷 모양·라이선스·크레딧 줄까지 정한다 — 카탈로그 빌드(scripts/build-art.mjs)는
// src/content/art/sources/의 스냅샷과 entries/를 이 표로만 works.json으로 만든다. 크레딧·라이선스 문구는 이 파일 한 곳뿐이다.

import { ART_TEXT_LICENSE } from './artCatalog.js';

/** 받은 원문을 편집했다는 표기 — ColBase 규약이 편집·가공 사실을 따로 적으라고 한다(README 「출처와 라이선스」). */
export const ART_EDIT_NOTE = '편집: 서식 기호만 지우고 글자는 그대로';

/** ColBase 소장관(재팬서치 common.provider) → 크레딧의 소장관 이름. 모르는 소장관은 크레딧을 만들지 않는다(빌드 실패 — 표에 더한다). */
export const ART_COLBASE_HOLDERS = Object.freeze({ tnm: '도쿄 국립박물관' });

const ENTITIES = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' });

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      // NUL·범위 밖 코드 포인트는 글자로 풀지 않는다(fromCodePoint RangeError 방지).
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * 출처 문자열 → 카탈로그 해설 text. 문단은 빈 줄 하나로 나눈다.
 *   · 줄바꿈 CRLF·CR → LF, HTML 주석은 지우고, 문단 태그(</p><p>)는 빈 줄, <br>은 줄바꿈, 나머지 태그는 지운다(속 글자는 남긴다).
 *   · HTML 엔티티를 글자로 푼다.
 *   · 줄 끝 공백과 줄 앞 ASCII 공백·탭만 지운다 — 일본어 문단 머리 전각 공백(U+3000)은 원문 그대로 둔다.
 *   · 빈 줄이 여럿이면 하나로, 앞뒤 빈 줄은 지운다.
 */
export function artSourceText(raw) {
  if (typeof raw !== 'string') return '';
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/p>\s*<p\b[^>]*>/gi, '\n\n')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/?p\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/^[ \t]+/, '').replace(/[ \t\u00a0]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}

/**
 * 출처별 받는 곳 — API 주소, 응답에서 해설 문자열 꺼내기, 사람이 여는 원문 페이지.
 * 카탈로그 description.source 값이 키다(artCatalog의 source와 같은 이름).
 *
 * 스냅샷(ART-AUTO-1) — `snapshot(json, id)`은 받은 응답에서 빌드가 쓰는 필드와 출처 기록만 남긴다(원문 HTML은 받은 그대로).
 * 빌드는 스냅샷에서 `snapshotRaw`(해설 원문) → artSourceText, `snapshotUrl`(원문 페이지), `credit`(크레딧 줄), `license`를 얻는다.
 */
export const ART_SOURCES = Object.freeze({
  // 시카고 미술관 — description(HTML, CC BY 4.0). 영어만.
  aic: Object.freeze({
    languages: Object.freeze(['en']),
    apiUrl: (id) => `https://api.artic.edu/api/v1/artworks/${encodeURIComponent(id)}?fields=id,title,date_display,description`,
    rawText: (json) => json?.data?.description ?? '',
    pageUrl: (id) => `https://www.artic.edu/artworks/${encodeURIComponent(id)}`,
    license: ART_TEXT_LICENSE.CC_BY_4,
    snapshot: (json) => ({
      id: json?.data?.id,
      title: json?.data?.title ?? null,
      date_display: json?.data?.date_display ?? null,
      description: json?.data?.description ?? null,
    }),
    snapshotRaw: (snapshot) => snapshot?.description ?? '',
    snapshotUrl: (snapshot) => ART_SOURCES.aic.pageUrl(snapshot.id),
    credit: () => `Art Institute of Chicago(시카고 미술관) · ${ART_EDIT_NOTE}`,
  }),
  // ColBase — 재팬서치 항목 API(cobas-<번호>)의 common.description(일본어)·descriptionEn(영어). ColBase 자체 API는 키가 필요하다.
  colbase: Object.freeze({
    languages: Object.freeze(['ja', 'en']),
    apiUrl: (id) => `https://jpsearch.go.jp/api/item/${encodeURIComponent(id)}`,
    rawText: (json, language = 'ja') => (language === 'en' ? json?.common?.descriptionEn : json?.common?.description) ?? '',
    pageUrl: (id, json) => json?.common?.linkUrl ?? `https://jpsearch.go.jp/item/${encodeURIComponent(id)}`,
    license: ART_TEXT_LICENSE.JP_GOV_STANDARD_2,
    snapshot: (json, id) => {
      const common = json?.common ?? {};
      return {
        id: json?.id ?? id,
        linkUrl: common.linkUrl ?? null,
        provider: common.provider ?? null,
        title: common.title ?? null,
        temporal: common.temporal ?? null,
        contributor: common.contributor ?? null,
        description: common.description ?? null,
        ...(common.descriptionEn !== undefined ? { descriptionEn: common.descriptionEn } : {}),
      };
    },
    snapshotRaw: (snapshot, language = 'ja') => (language === 'en' ? snapshot?.descriptionEn : snapshot?.description) ?? '',
    snapshotUrl: (snapshot) => ART_SOURCES.colbase.pageUrl(snapshot.id, { common: snapshot }),
    credit: (snapshot) => {
      const holder = ART_COLBASE_HOLDERS[snapshot?.provider];
      return holder ? `ColBase(국립문화재기구) · ${holder} 소장 · 재팬서치 경유 · ${ART_EDIT_NOTE}` : null;
    },
  }),
  // 문화유산 온라인(文化遺産オンライン, 문화청) — 재팬서치 항목 API(bunka-<번호>)의 common.description(일본어, 평문).
  // 재팬서치 데이터베이스 정보(api/database/bunka)의 metadataRights가 「解説文：CC BY」(4.0)다. 건축·국가 지정 문화재 해설(ART-GENRE-001).
  // 문화청 자료(provider bunkazai)만 — 각 미술관이 올린 해설은 크레딧을 만들지 않는다(빌드 실패).
  bunka: Object.freeze({
    languages: Object.freeze(['ja']),
    apiUrl: (id) => `https://jpsearch.go.jp/api/item/${encodeURIComponent(id)}`,
    rawText: (json) => json?.common?.description ?? '',
    pageUrl: (id, json) => json?.common?.linkUrl ?? `https://jpsearch.go.jp/item/${encodeURIComponent(id)}`,
    license: ART_TEXT_LICENSE.CC_BY_4,
    snapshot: (json, id) => {
      const common = json?.common ?? {};
      return {
        id: json?.id ?? id,
        linkUrl: common.linkUrl ?? null,
        provider: common.provider ?? null,
        title: common.title ?? null,
        temporal: common.temporal ?? null,
        description: common.description ?? null,
      };
    },
    snapshotRaw: (snapshot) => snapshot?.description ?? '',
    snapshotUrl: (snapshot) => ART_SOURCES.bunka.pageUrl(snapshot.id, { common: snapshot }),
    credit: (snapshot) => (snapshot?.provider === 'bunkazai' ? `문화유산 온라인(문화청) · 재팬서치 경유 · ${ART_EDIT_NOTE}` : null),
  }),
});

/** 그림 캡션 끝에 붙는 라이선스 이름. 표에 없는 라이선스는 캡션을 만들지 않는다(빌드 실패). */
export const ART_IMAGE_LICENSE_LABEL = Object.freeze({ cc0: 'CC0', 'public-domain': 'Public domain', 'cc-by-4.0': 'CC BY 4.0' });

/**
 * 그림 출처 — public/art 파일을 어디서 받았나(ART-AUTO-1). 스냅샷 `sources/images/<작품 id>.json`의 `record`에서
 * 캡션(image.credit)과 라이선스를 만든다. 파일은 받은 바이트 그대로이고 스냅샷의 sha256으로 묶는다.
 */
export const ART_IMAGE_SOURCES = Object.freeze({
  // 메트로폴리탄 미술관 오픈 액세스 — objects API(CC0). isPublicDomain이 참일 때만 CC0.
  met: Object.freeze({
    apiUrl: (id) => `https://collectionapi.metmuseum.org/public/collection/v1/objects/${encodeURIComponent(id)}`,
    record: (json) => ({
      artistDisplayName: json?.artistDisplayName ?? null,
      title: json?.title ?? null,
      objectDate: json?.objectDate ?? null,
      creditLine: json?.creditLine ?? null,
      isPublicDomain: json?.isPublicDomain === true,
    }),
    sourceUrl: (json) => json?.objectURL ?? null,
    creditFields: Object.freeze(['artistDisplayName', 'title', 'objectDate', 'creditLine']),
    license: (record) => (record?.isPublicDomain === true ? 'cc0' : null),
    credit: (record, label) => `${record.artistDisplayName}. ${record.title}, ${record.objectDate}. The Metropolitan Museum of Art, ${record.creditLine}. ${label}`,
  }),
  // ColBase 사진 — 재팬서치 항목 API(cobas-<번호>). 항목의 contentsRightsType이 ccby일 때만 CC BY 4.0(오너 결정 2026-10-18 KST).
  // 파일은 contentsUrl의 slideshow_s(작은 미리보기) 대신 같은 경로의 slideshow_l(긴 변 700px 안팎)을 받은 바이트 그대로 둔다.
  colbase: Object.freeze({
    apiUrl: (id) => `https://jpsearch.go.jp/api/item/${encodeURIComponent(id)}`,
    record: (json) => {
      const common = json?.common ?? {};
      return {
        title: common.title ?? null,
        contributor: Array.isArray(common.contributor) ? common.contributor[0] ?? null : common.contributor ?? null,
        provider: common.provider ?? null,
        contentsRightsType: common.contentsRightsType ?? null,
        contentsUrl: Array.isArray(common.contentsUrl) ? common.contentsUrl[0] ?? null : null,
      };
    },
    sourceUrl: (json) => json?.common?.linkUrl ?? null,
    creditFields: Object.freeze(['title', 'contributor', 'provider']),
    license: (record) => (record?.contentsRightsType === 'ccby' && Object.hasOwn(ART_COLBASE_HOLDERS, record?.provider ?? '') ? 'cc-by-4.0' : null),
    credit: (record, label) => `${record.title} · ${record.contributor} · ${ART_COLBASE_HOLDERS[record.provider]} 소장 · ColBase(국립문화재기구) · ${label}`,
  }),
  // 위키미디어 공용 경유 미술관 디지털화본 — 공용 API는 요청 제한(429)이 잦아 record를 파일 페이지에서 손으로 옮긴다(ART-IMG-002).
  commons: Object.freeze({
    apiUrl: null,
    creditFields: Object.freeze(['artist', 'title', 'date', 'holder', 'accession']),
    license: (record) => record?.license ?? null,
    credit: (record, label) => `${record.artist}. ${record.title}, ${record.date}. ${record.holder}, ${record.accession}. ${label} (via Wikimedia Commons)`,
  }),
});
