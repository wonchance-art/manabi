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
 * ⚠ 두 번째 구멍(2026-10-13): R5의 뷰어는 `material.metadata.source`를 읽었는데, `reading_materials`에는
 * `metadata` 열이 없다. 저장하는 쪽(자료 추가 링크·추천 읽기)은 모두 `processed_json.metadata.source`에 쓴다.
 * 그래서 출처 줄이 한 번도 그려지지 않았다 → 읽는 자리를 {@link materialSource} 한 곳으로 모은다.
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
 * 자료 행에서 출처 기록을 꺼낸다. 저장 위치의 정본은 `processed_json.metadata.source`다
 * (MaterialAddPage initJson·suggestionReading의 `meta.source`). 행에 `metadata` 열은 없다.
 */
export function materialSource(material) {
  return material?.processed_json?.metadata?.source ?? null;
}

/**
 * 화면에 보이는 출처 한 줄의 재료. 렌더는 컴포넌트가 한다(링크를 걸어야 하므로).
 * 라이선스를 모르는 개인 반입분에도 **채널·원본 링크는 준다** — 법적 의무는 없지만
 * 「어디서 온 글인지」는 어차피 필요한 정보다.
 * @returns {{channel:string, license:string, url:string}|null}
 */
/**
 * 원본 링크는 https 유튜브 주소일 때만 건다. `processed_json`은 자료 소유자가 쓰는 값이라, 공개 자료의
 * 출처 줄이 다른 사람에게 임의 주소(피싱·data: 등)를 띄우는 통로가 되면 안 된다.
 */
export function safeYoutubeUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    const host = u.hostname.toLowerCase();
    const ok = u.protocol === 'https:' && !u.username && !u.password
      && (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com'));
    return ok ? u.href : '';
  } catch {
    return '';
  }
}

export function attributionParts(source) {
  if (!source || source.kind !== 'youtube') return null;
  const channel = String(source.channel || '').trim();
  const url = safeYoutubeUrl(source.url);
  if (!channel && !url) return null;
  return { channel, license: LICENSE_LABEL[source.license] || '', url };
}

/* ─────────────────────────────────────────────────────────────
 * 아오조라 정본 책(설계 §3.4) — 같은 「출처 한 줄」 문법의 문학 분기.
 * 데이터는 processed_json.metadata.literature(provider:'aozora')에 있다(scripts/build-literature.mjs가 만든다).
 * 青空文庫 취급 규준: 작품명·저자·底本 정보를 지우지 말 것, 바꿨다면 작업 이력을 남길 것(요망),
 * 「青空文庫」 이름은 출처 표시에 쓰되 관여·허락을 암시하지 말 것 — 그래서 「출처: 青空文庫」 한 줄만 쓴다.
 * ─────────────────────────────────────────────────────────────*/

const AOZORA_EDIT_CODES = ['ruby-reading-aid', 'chapter-split-by-manabi'];
const AOZORA_SMALL_KANA_EDIT = 'small-kana-as-full';
const AOZORA_UNPROOFREAD_EDIT = 'unproofread-source'; // aozoraMaterial.AOZORA_UNPROOFREAD_EDIT — 교정자 없는 입력본(오너 승인 수록) // aozoraMaterial.AOZORA_SMALL_KANA_EDIT — Unicode에 없는 작은 가나를 보통 크기로

/** 도서 카드 링크는 青空文庫 HTTPS 주소일 때만 건다 — 공개 자료 metadata에 임의 링크(javascript: 등)가 실려도 그리지 않는다. */
function aozoraCardHref(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'www.aozora.gr.jp' ? url.href : '';
  } catch {
    return '';
  }
}

/* Standard Ebooks 정본 책(LIT-SRC-EN-1) — 같은 「출처 한 줄」 문법. 판 기여는 CC0라 표기 의무는 없지만, 출처·판 링크·우리가 바꾼 점을
 * 밝힌다(아오조라와 같은 원칙). 판 링크는 standardebooks.org HTTPS 주소일 때만 건다. */
function standardEbooksHref(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'standardebooks.org' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Standard Ebooks 장의 출처 줄 재료 — 「원작 퍼블릭 도메인」은 권리 기록이 approved·public-domain일 때만.
 * @returns {{author:string, publishedYear:number|null, url:string, publicDomain:boolean, editNote:boolean, notesNote:boolean}|null}
 */
/* 번역본 정본(오너 「되는 언어로만」 2026-10-17 KST)의 번역 크레딧 — 권리 기록이 구조화된 번역자({name, publishedYear})일 때만.
 * 출처 줄에 「번역 George Long, 1862」로 원작 크레딧 뒤에 붙는다. 없으면 null(원어 원문). */
export function translatorCredit(literature) {
  const t = literature && typeof literature === 'object' ? literature.translator : null;
  if (!t || typeof t !== 'object' || typeof t.name !== 'string' || !t.name.trim()) return null;
  return { name: t.name.trim(), publishedYear: Number.isInteger(t.publishedYear) ? t.publishedYear : null };
}

export function standardEbooksAttributionParts(literature) {
  if (!literature || typeof literature !== 'object' || literature.provider !== 'standardebooks') return null;
  const rights = literature.rights && typeof literature.rights === 'object' ? literature.rights : {};
  const edits = Array.isArray(literature.edits) ? literature.edits : [];
  return {
    author: typeof literature.author === 'string' ? literature.author.trim() : '',
    publishedYear: Number.isInteger(literature.publishedYear) ? literature.publishedYear : null,
    url: standardEbooksHref(literature.url),
    publicDomain: rights.status === 'approved' && rights.basis === LICENSE_PUBLIC_DOMAIN,
    editNote: ['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted'].every((code) => edits.includes(code)),
    notesNote: edits.includes('notes-omitted'), // 미주를 뺀 판(모비 딕 등)
    translator: translatorCredit(literature),
  };
}

/* Wikisource 정본 책(LIT-SRC-WS-1) — 같은 「출처 한 줄」 문법. 원작은 퍼블릭 도메인이지만 위키문헌의 전사·교정은 CC BY-SA 4.0이라
 * 출처(위키문헌) · 원문 링크 · 라이선스 링크 · 우리가 바꾼 점을 밝힌다(저작자 표시 — 제목·출처·라이선스). 원문 링크는 zh/fr 위키문헌 HTTPS만. */
const WIKISOURCE_HOSTS = Object.freeze({ zh: 'zh.wikisource.org', fr: 'fr.wikisource.org', ko: 'ko.wikisource.org', en: 'en.wikisource.org' });
function wikisourceHref(value, wiki) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && Object.hasOwn(WIKISOURCE_HOSTS, wiki) && url.hostname === WIKISOURCE_HOSTS[wiki] ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Wikisource 장의 출처 줄 재료 — 「원작 퍼블릭 도메인」은 권리 기록이 approved·public-domain일 때만. license는 CC BY-SA 4.0일 때만 링크.
 * @returns {{wiki:string, author:string, publishedYear:number|null, url:string, publicDomain:boolean, ccBySa:boolean, editNote:boolean, scriptNote:boolean}|null}
 */
export function wikisourceAttributionParts(literature) {
  if (!literature || typeof literature !== 'object' || literature.provider !== 'wikisource' || !Object.hasOwn(WIKISOURCE_HOSTS, literature.wiki)) return null;
  const rights = literature.rights && typeof literature.rights === 'object' ? literature.rights : {};
  const edits = Array.isArray(literature.edits) ? literature.edits : [];
  return {
    wiki: literature.wiki,
    author: typeof literature.author === 'string' ? literature.author.trim() : '',
    publishedYear: Number.isInteger(literature.publishedYear) ? literature.publishedYear : null,
    url: wikisourceHref(literature.url, literature.wiki),
    publicDomain: rights.status === 'approved' && rights.basis === LICENSE_PUBLIC_DOMAIN,
    ccBySa: literature.license === 'CC-BY-SA-4.0',
    // 공공누리 제1유형 — 배포 기관(출처 표시 의무). 승인된 kogl-type1 기록일 때만
    kogl: rights.status === 'approved' && rights.basis === 'kogl-type1' && literature.license === 'KOGL-1' && typeof rights.holder === 'string' && rights.holder.trim() ? rights.holder.trim() : null,
    editNote: ['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted', 'notes-omitted'].every((code) => edits.includes(code)),
    scriptNote: edits.includes('script-variant-by-wikisource'),
    translator: translatorCredit(literature),
  };
}

/* 퍼블릭 도메인 전자책 사이트 정본 책(LIT-SRC-PD-1) — 같은 「출처 한 줄」 문법. 사이트 이름 · 작가 · 「한국에서 퍼블릭 도메인」 · 책 쪽 링크 ·
 * 우리가 바꾼 점. 사이트 저작권 표시는 그 나라 기준이라 우리는 한국 판정만 밝힌다. 링크는 그 사이트 HTTPS만. */
const PD_SITE_HOSTS = Object.freeze({ fp: 'www.fadedpage.com', gau: 'gutenberg.net.au' });
const PD_SITE_NAMES = Object.freeze({ fp: 'Faded Page', gau: 'Project Gutenberg Australia' });
/**
 * @returns {{site:string, siteName:string, author:string, publishedYear:number|null, url:string, publicDomain:boolean, editNote:boolean, notesNote:boolean}|null}
 */
export function pdSiteAttributionParts(literature) {
  if (!literature || typeof literature !== 'object' || literature.provider !== 'pdsite' || !Object.hasOwn(PD_SITE_HOSTS, literature.site)) return null;
  const rights = literature.rights && typeof literature.rights === 'object' ? literature.rights : {};
  const edits = Array.isArray(literature.edits) ? literature.edits : [];
  let url = '';
  try { const parsed = new URL(String(literature.url || '')); url = parsed.protocol === 'https:' && parsed.hostname === PD_SITE_HOSTS[literature.site] ? parsed.href : ''; } catch { url = ''; }
  return {
    site: literature.site,
    siteName: PD_SITE_NAMES[literature.site],
    author: typeof literature.author === 'string' ? literature.author.trim() : '',
    publishedYear: Number.isInteger(literature.publishedYear) ? literature.publishedYear : null,
    url,
    publicDomain: rights.status === 'approved' && rights.basis === LICENSE_PUBLIC_DOMAIN,
    editNote: ['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted'].every((code) => edits.includes(code)),
    notesNote: edits.includes('notes-omitted'),
    translator: translatorCredit(literature),
  };
}

/**
 * 아오조라 장의 출처 줄 재료. 「원작 퍼블릭 도메인」은 권리 기록이 approved·public-domain일 때만 쓴다(없는 권리를 주장하지 않는다).
 * 底本은 첫 줄(서명·출판사)만 — 들여쓴 연속 줄(발행일·판차)은 metadata에 남고 한 줄 표기에는 넣지 않는다.
 * @returns {{provider:string, sourceBook:string, inputter:string, proofreader:string, cardUrl:string, publicDomain:boolean, editNote:boolean, smallKanaNote:boolean, unproofreadNote:boolean}|null}
 */
export function literatureAttributionParts(literature) {
  if (!literature || typeof literature !== 'object' || literature.provider !== 'aozora') return null;
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const colophon = literature.colophon && typeof literature.colophon === 'object' ? literature.colophon : {};
  const rights = literature.rights && typeof literature.rights === 'object' ? literature.rights : {};
  const edits = Array.isArray(literature.edits) ? literature.edits : [];
  return {
    provider: '青空文庫',
    sourceBook: Array.isArray(colophon.sourceBook) ? text(colophon.sourceBook[0]) : '',
    inputter: text(colophon.inputter),
    proofreader: text(colophon.proofreader),
    cardUrl: aozoraCardHref(literature.cardUrl),
    publicDomain: rights.status === 'approved' && rights.basis === LICENSE_PUBLIC_DOMAIN,
    editNote: AOZORA_EDIT_CODES.every((code) => edits.includes(code)),
    smallKanaNote: edits.includes(AOZORA_SMALL_KANA_EDIT),
    unproofreadNote: edits.includes(AOZORA_UNPROOFREAD_EDIT),
  };
}
