// 「그림 한 장 읽기」 작품 카탈로그 계약 (ART-P0-1, 2026-10-14 KST 오너 「좋아 가보자」).
// 설계: /mnt/project-files/notes/art-reading-mode.md §8–§17 (작품 정보 태그 = 개체 4종 + 큐레이션).
//
// 저장·네트워크 없는 순수 함수. 정본은 src/content/art/*.json(리포)이고, 이 파일은 그 정본이 지켜야 할 것을
// fail-closed로 검사하고, 작품 화면의 정보 카드에 쓸 값을 계산한다.
//
// 대표 사이트 대조(설계 §15–§16)에서 온 규칙:
//   · 「소장 ≠ 전시 중」 — 전시 여부는 수시로 바뀌는 값이라 **저장하지 않는다**(onView 류 키 금지). 카드는 늘 「소장처」.
//   · 같은 판화가 여러 곳에 있다 — 작품 1 : 소장처 N. 장소 역할은 소장(holding)·그림 속 장소(depicted)·제작지(made) 셋.
//   · 날짜는 출처마다 다르게 적는다 — 일본어 원문 표기(text)는 그대로 보이고, 영어 약식 표기는 연도 범위로 한국어를 만든다
//     (artDateDisplay). 정렬·묶음은 연도 범위로만.
//   · 해설 본문은 재사용이 허용된 라이선스만, 원문 해시로 묶는다(아오조라 textSha256 선례 — 손으로 고친 해설을 막는다).
//   · 이미지는 퍼블릭 도메인/CC0, 그리고 ColBase 사진(CC BY 4.0 — 캡션 필수)만. 그 밖은 그림 없이 해설만(IP 하드리밋 ⑴과 별개로 저작권 보호).
//     그림이 있는 작품은 작가가 ART_PD_DIED_BY년까지 세상을 떠났어야 한다 — 작품 자체의 저작권(사후 70년)이 어디서나 끝난 것만 싣는다.
//   · 장르(ART-GENRE-001, 2026-10-18 KST 오너 「권장대로 ㄱㄱ」) — 판화·회화·사진·건축. 장르가 작가 칸 이름(그림·촬영·설계)과
//     장소 요건(건축은 소장처 대신 소재지)을 정한다.

/** 해설 본문 라이선스 — 공개 자료로 담을 수 있는 것만. 모르는 값은 실패(fail-closed). */
export const ART_TEXT_LICENSE = Object.freeze({
  JP_GOV_STANDARD_2: 'jp-gov-standard-2.0', // ColBase 등 — 정부표준이용규약 2.0(CC BY 4.0 호환), 출처 명기
  CC_BY_4: 'cc-by-4.0', // 시카고 미술관 description 등
  CC_BY_SA_4: 'cc-by-sa-4.0', // 위키백과 발췌
  CC0: 'cc0',
});

/** 화면 출처 줄에 그대로 나가는 라이선스 이름. */
export const ART_TEXT_LICENSE_LABEL = Object.freeze({
  [ART_TEXT_LICENSE.JP_GOV_STANDARD_2]: '정부표준이용규약 2.0',
  [ART_TEXT_LICENSE.CC_BY_4]: 'CC BY 4.0',
  [ART_TEXT_LICENSE.CC_BY_SA_4]: 'CC BY-SA 4.0',
  [ART_TEXT_LICENSE.CC0]: 'CC0',
});

export const ART_IMAGE_LICENSES = Object.freeze(['public-domain', 'cc0', 'cc-by-4.0']);
/** 캡션 없이는 쓸 수 없는 그림 라이선스 — 저작자 표시가 이용 조건이다. */
const ART_IMAGE_ATTRIBUTION_REQUIRED = Object.freeze(['cc-by-4.0']);
/** 그림을 싣는 작품의 작가 사망 연도 상한 — 2026년 기준 사후 70년이 끝난 해(日本·EU·미국 모두 보호 기간이 지난 선). */
export const ART_PD_DIED_BY = 1955;
/** 작품 장르 → 정보 카드 작가 칸 이름. 건축은 설계자, 사진은 촬영자가 그 칸에 온다. */
export const ART_GENRE_ARTIST_ROLE = Object.freeze({ print: '그림', painting: '그림', photograph: '촬영', architecture: '설계' });
export const ART_GENRES = Object.freeze(Object.keys(ART_GENRE_ARTIST_ROLE));
/** 장소 역할 — 소장(holding)·그림 속 장소(depicted)·제작지(made)·소재지(located, 건축물이 서 있는 곳). */
export const ART_PLACE_ROLES = Object.freeze(['holding', 'depicted', 'made', 'located']);
export const ART_PLACE_KINDS = Object.freeze(['museum', 'temple', 'site', 'city', 'landscape']);
export const ART_DATE_CERTAINTY = Object.freeze(['exact', 'circa', 'range']);
export const ART_CURATION_KINDS = Object.freeze(['artist', 'period', 'theme']);

/** 저장하면 안 되는 키 — 전시 여부는 원문 링크로만 확인하게 한다(설계 §15-1). */
export const ART_FORBIDDEN_KEYS = Object.freeze(['onView', 'onDisplay', 'exhibited', 'gallery', 'room']);

/** 한도 — DailyArt 「설명이 길다」 선례(설계 §16-7). 해설은 200–600자 목표, 1,500자 상한. */
export const ART_LIMITS = Object.freeze({ descriptionMax: 1500, lifeMax: 400, terms: 3, lookFor: 3, hookMax: 40 });

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QID = /^Q[1-9]\d*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const LANGUAGE = /^(?:ja|zh|en|fr)$/;
/** 해설 출처 — scripts/fetch-art-description.mjs가 받는 곳(src/lib/artSource.js ART_SOURCES)과 같은 이름·id 형식. */
const SOURCE_ID = Object.freeze({ colbase: /^cobas-\d+$/, aic: /^\d+$/, bunka: /^bunka-\d+$/ });
/** 박물관 내부 메모(「(20131029_h21・22)」 같은 작업 번호)가 섞인 해설 — 공개 해설이 아니다(ART-P0-2 실측). */
/** 그림 파일 경로 — public/art 아래 파일(사이트 상대 주소). 지금 파일은 메트로폴리탄 미술관 오픈 액세스(CC0, images.metmuseum.org)에서,
 *  메트에 없는 亀戸梅屋舗만 레이크스 미술관 CC0 디지털화본을 위키미디어 공용(commons.wikimedia.org)에서 받았다.
 *  장르 확장(ART-GENRE-001)의 근대 회화·옛 사진은 ColBase(CC BY 4.0), 근대 건축은 국립국회도서관 디지털화본(퍼블릭 도메인, 공용 경유). */
export const ART_IMAGE_PATH = /^\/art\/[a-z0-9-]+\.(?:jpg|webp)$/;
const INTERNAL_MEMO = /\d{8}_h\d+/;
/** 읽기 표시 — ColBase(「宮＠みや＠は」「+かたきうち+」)·문화유산 온라인(「春草【しゆんそう】」). 원문 그대로 실으면 학습자에게 기호가 보인다.
 *  고치지 않고 싣지 않는다(ART-AUTO-001·ART-GENRE-001 실측). */
const READING_MARKS = /[＠@][\u3040-\u30ff]{1,12}[＠@]|\+[\u3040-\u30ff]{1,12}\+|【[\u3040-\u30ff]{1,12}】/;
/** 일본어 해설에 섞인 영어 문장(낱말 여섯 개 이상이 띄어쓰기로 이어짐, 숫자 낱말 포함) — 湖畔(cobas-159785)처럼 일본어·영어 해설이 한 칸에 이어 붙은 원문은 일본어 장이 될 수 없다. */
const ENGLISH_SENTENCE = /[A-Za-z]+(?:[ ,'’-]+(?:[A-Za-z]+|\d+)){5,}/;
/** 라틴 합자 글자(ﬁ · ﬂ 등 U+FB00–FB06) — 인쇄본에서 글을 뽑을 때 깨진 흔적이다(AIC 「Arrival of the Normandy Train」 「artiﬁ cial」 실측 2026-10-23 KST).
 *  학습자에게 깨진 낱말이 보이고 단어 찾기도 어긋난다 — 고치지 않고 싣지 않는다. */
const LIGATURES = /[\ufb00-\ufb06]/;

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isYear = (value) => Number.isInteger(value) && value >= -3000 && value <= 2100;

function isHttps(value) {
  if (!isText(value)) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function forbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) { value.forEach((item, index) => forbiddenKeys(item, `${path}[${index}]`, errors)); return; }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (ART_FORBIDDEN_KEYS.includes(key)) errors.push(`${path}.${key}: 전시 여부는 저장하지 않는다(소장 ≠ 전시 중)`);
    forbiddenKeys(child, `${path}.${key}`, errors);
  }
}

function checkName(name, path, errors) {
  if (!isObject(name) || !isText(name.native)) errors.push(`${path}.native 이름이 필요하다`);
  if (!isObject(name) || !isText(name.ko)) errors.push(`${path}.ko 이름이 필요하다`);
}

/** 원어 제목의 언어(화면 lang) — 없으면 일본어(우키요에 · 근대 일본 작품). 「The Bedroom」 같은 미술관 영어 제목은 en. */
export const artTitleLang = (title) => (typeof title?.lang === 'string' && LANGUAGE.test(title.lang) ? title.lang : 'ja');

function checkIds(list, kind, errors) {
  const ids = new Set();
  const qids = new Set();
  if (!Array.isArray(list)) { errors.push(`${kind}: 배열이어야 한다`); return ids; }
  list.forEach((item, index) => {
    const at = `${kind}[${index}]`;
    if (!isObject(item) || !ID.test(item.id ?? '')) { errors.push(`${at}.id: 케밥 케이스 id가 필요하다`); return; }
    if (ids.has(item.id)) errors.push(`${at}.id: 중복 ${item.id}`);
    ids.add(item.id);
    if (kind !== 'periods' && kind !== 'curations') {
      // 작품은 Wikidata 항목이 없을 수 있다(메이지 사진 낱장 등) — 없으면 키를 두지 않고, 있으면 형식·중복을 본다.
      if (kind === 'works' && item.wikidata === undefined) return;
      if (!QID.test(item.wikidata ?? '')) errors.push(`${at}.wikidata: Wikidata QID가 필요하다(표기 통합 정규 키)`);
      else if (qids.has(item.wikidata)) errors.push(`${at}.wikidata: 중복 ${item.wikidata}`);
      else qids.add(item.wikidata);
    }
  });
  return ids;
}

function checkPeriod(period, at, errors) {
  if (!isText(period.culture)) errors.push(`${at}.culture가 필요하다`);
  if (!isObject(period.label) || !isText(period.label.ko)) errors.push(`${at}.label.ko가 필요하다`);
  if (!isYear(period.startYear) || !isYear(period.endYear) || period.startYear > period.endYear) {
    errors.push(`${at}: startYear ≤ endYear 연도가 필요하다`);
  }
}

function checkArtist(artist, at, periodIds, errors) {
  checkName(artist.name, `${at}.name`, errors);
  if (!isYear(artist.born) || !isYear(artist.died) || artist.born > artist.died) errors.push(`${at}: born ≤ died 연도가 필요하다`);
  if (!isText(artist.life) || artist.life.length > ART_LIMITS.lifeMax) {
    errors.push(`${at}.life: 생애 요약은 1–${ART_LIMITS.lifeMax}자(우리가 쓴 한국어)`);
  }
  for (const id of artist.periods ?? []) if (!periodIds.has(id)) errors.push(`${at}.periods: 없는 시대 ${id}`);
}

function checkPlace(place, at, studiesPinIds, errors) {
  checkName(place.name, `${at}.name`, errors);
  const pin = place.links?.studiesPin;
  if (pin !== undefined && studiesPinIds && !studiesPinIds.has(pin)) errors.push(`${at}.links.studiesPin: 없는 지역학 핀 ${pin}`);
  if (!ART_PLACE_KINDS.includes(place.kind)) errors.push(`${at}.kind: ${ART_PLACE_KINDS.join('|')}`);
  const lat = place.lat;
  const lng = place.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    errors.push(`${at}: 좌표(lat·lng)가 필요하다`);
  }
}

function checkDescription(description, at, errors) {
  if (!isObject(description)) { errors.push(`${at}: 객체여야 한다`); return; }
  if (!LANGUAGE.test(description.language ?? '')) errors.push(`${at}.language: ja|zh|en|fr`);
  if (!Object.values(ART_TEXT_LICENSE).includes(description.license)) errors.push(`${at}.license: 허용 목록 밖 ${description.license}`);
  if (!Object.hasOwn(SOURCE_ID, description.source ?? '')) errors.push(`${at}.source: ${Object.keys(SOURCE_ID).join('|')}`);
  else if (!SOURCE_ID[description.source].test(description.sourceId ?? '')) errors.push(`${at}.sourceId: ${description.source} id 형식이 아니다`);
  if (!isHttps(description.sourceUrl)) errors.push(`${at}.sourceUrl: HTTPS 원문 주소가 필요하다`);
  if (!isText(description.credit)) errors.push(`${at}.credit: 크레딧 줄이 필요하다(출처 표기 의무)`);
  if (!isText(description.text) || description.text.length > ART_LIMITS.descriptionMax) {
    errors.push(`${at}.text: 해설 1–${ART_LIMITS.descriptionMax}자`);
  } else if (INTERNAL_MEMO.test(description.text)) errors.push(`${at}.text: 박물관 내부 메모가 섞인 해설은 싣지 않는다`);
  else if (READING_MARKS.test(description.text)) errors.push(`${at}.text: 읽기 표시(＠よみ＠·+よみ+·【よみ】)가 섞인 해설은 싣지 않는다`);
  else if (LIGATURES.test(description.text)) errors.push(`${at}.text: 합자 글자(ﬁ · ﬂ 등 — 원문 추출 깨짐)가 섞인 해설은 싣지 않는다`);
  else if (description.language === 'ja' && ENGLISH_SENTENCE.test(description.text)) errors.push(`${at}.text: 일본어 해설에 영어 문장이 섞여 있다(싣지 않는다)`);
  if (!SHA256.test(description.textSha256 ?? '')) errors.push(`${at}.textSha256: 원문 해시가 필요하다`);
}

function checkWork(work, at, refs, errors) {
  if (!refs.artistIds.has(work.artist)) errors.push(`${at}.artist: 없는 작가 ${work.artist}`);
  if (!ART_GENRES.includes(work.genre)) errors.push(`${at}.genre: ${ART_GENRES.join('|')}`);
  checkName(work.title, `${at}.title`, errors);
  if (isObject(work.title) && work.title.lang !== undefined && !LANGUAGE.test(work.title.lang)) errors.push(`${at}.title.lang: ja|zh|en|fr`);
  // 한 줄 이야기(DISCOVER-ART-001) — 고전 명작 「그림」 카드에 그림과 함께 보이는 우리가 쓴 한국어 화면 문구(작가 생애 요약과 같은 지위, 학습 원문 아님).
  if (work.hook !== undefined && (!isText(work.hook) || work.hook.length > ART_LIMITS.hookMax)) {
    errors.push(`${at}.hook: 한 줄 이야기는 1–${ART_LIMITS.hookMax}자(우리가 쓴 한국어)`);
  }
  const date = work.date;
  if (!isObject(date) || !isText(date.text)) errors.push(`${at}.date.text: 원문 표기가 필요하다`);
  else if (!isYear(date.startYear) || !isYear(date.endYear) || date.startYear > date.endYear) errors.push(`${at}.date: startYear ≤ endYear`);
  else if (!ART_DATE_CERTAINTY.includes(date.certainty)) errors.push(`${at}.date.certainty: ${ART_DATE_CERTAINTY.join('|')}`);
  if (isObject(date) && date.source !== undefined && !Object.hasOwn(SOURCE_ID, date.source)) errors.push(`${at}.date.source: 표기를 가져온 출처(${Object.keys(SOURCE_ID).join('|')})`);
  for (const id of work.periods ?? []) if (!refs.periodIds.has(id)) errors.push(`${at}.periods: 없는 시대 ${id}`);
  if (!isObject(work.medium) || !isText(work.medium.native)) errors.push(`${at}.medium.native: 재료·기법 원문이 필요하다`);

  const places = Array.isArray(work.places) ? work.places : [];
  const architecture = work.genre === 'architecture';
  places.forEach((entry, index) => {
    if (!refs.placeIds.has(entry?.place)) errors.push(`${at}.places[${index}]: 없는 장소 ${entry?.place}`);
    if (!ART_PLACE_ROLES.includes(entry?.role)) errors.push(`${at}.places[${index}].role: ${ART_PLACE_ROLES.join('|')}`);
    // 소장처는 그 기관의 소장품 기록 링크와 함께 — 전시 여부·자세한 정보는 이 링크에서 본다(저장하지 않으므로).
    if (entry?.role === 'holding' && !isHttps(entry.url)) errors.push(`${at}.places[${index}].url: 소장품 기록 HTTPS 링크가 필요하다`);
    // 건축물의 소재지는 그 건물의 문화재 기록 링크와 함께 — 소장처 대신 이 링크에서 자세한 정보를 본다.
    if (entry?.role === 'located' && !isHttps(entry.url)) errors.push(`${at}.places[${index}].url: 소재지는 문화재 기록 HTTPS 링크가 필요하다`);
    if (entry?.role === 'located' && !architecture) errors.push(`${at}.places[${index}].role: 소재지(located)는 건축 작품에만`);
  });
  if (architecture) {
    if (!places.some((entry) => entry?.role === 'located')) errors.push(`${at}.places: 건축은 소재지(located)가 하나 이상 필요하다`);
  } else if (!places.some((entry) => entry?.role === 'holding')) errors.push(`${at}.places: 소장처(holding)가 하나 이상 필요하다`);

  const descriptions = Array.isArray(work.descriptions) ? work.descriptions : [];
  if (descriptions.length === 0) errors.push(`${at}.descriptions: 해설이 하나 이상 필요하다`);
  descriptions.forEach((description, index) => checkDescription(description, `${at}.descriptions[${index}]`, errors));

  if (!Array.isArray(work.terms) || work.terms.length > ART_LIMITS.terms || !work.terms.every(isText)) {
    errors.push(`${at}.terms: 핵심 용어 0–${ART_LIMITS.terms}개`);
  }
  if (work.lookFor !== undefined && (!Array.isArray(work.lookFor) || work.lookFor.length > ART_LIMITS.lookFor || !work.lookFor.every(isText))) {
    errors.push(`${at}.lookFor: 찾아볼 것 0–${ART_LIMITS.lookFor}개`);
  }
  // 핵심 용어는 읽기 자료(첫 해설 — 책 장이 되는 해설)에 실제로 나오는 말이어야 한다 — 본문에서 만나야 단어 저장으로 이어진다.
  const reading = descriptions[0]?.text ?? '';
  for (const term of Array.isArray(work.terms) ? work.terms : []) {
    if (isText(term) && !reading.includes(term)) errors.push(`${at}.terms: 「${term}」가 읽기 해설(${descriptions[0]?.language ?? '없음'})에 없다`);
  }
  // 찾아볼 것은 그림을 보며 하는 질문 — 그림이 없으면 두지 않는다.
  if (Array.isArray(work.lookFor) && work.lookFor.length > 0 && !work.image) errors.push(`${at}.lookFor: 그림이 없으면 찾아볼 것을 두지 않는다`);
  if (work.image !== undefined && work.image !== null) {
    const image = work.image;
    if (!ART_IMAGE_LICENSES.includes(image?.license)) errors.push(`${at}.image.license: ${ART_IMAGE_LICENSES.join('|')}만(그 밖은 image 없이)`);
    if (ART_IMAGE_ATTRIBUTION_REQUIRED.includes(image?.license) && !isText(image?.credit)) errors.push(`${at}.image.credit: ${image.license} 그림은 캡션(저작자 표시)이 필요하다`);
    // 작품 자체의 저작권 — 그림을 싣는 작품은 작가 사후 70년이 어디서나 끝난 것만.
    const died = refs.artistDied?.get(work.artist);
    if (Number.isInteger(died) && died > ART_PD_DIED_BY) errors.push(`${at}.image: 작가가 ${died}년에 세상을 떠났다 — ${ART_PD_DIED_BY}년까지 떠난 작가의 작품만 그림을 싣는다`);
    // 그림 파일은 manabi가 직접 들고 있는 것만(public/art) — 미술관 서버에 바로 연결하면 그쪽 봇 차단에 끊긴다(ART-IMG-001 실측).
    if (!ART_IMAGE_PATH.test(image?.url ?? '')) errors.push(`${at}.image.url: /art/<이름>.jpg|webp(public/art에 둔 파일)만`);
    if (!isHttps(image?.sourceUrl)) errors.push(`${at}.image.sourceUrl: 그림을 받은 원본 페이지 HTTPS 주소가 필요하다`);
    if (!isText(image?.alt)) errors.push(`${at}.image.alt: 대체 텍스트가 필요하다(접근성)`);
    if (image?.credit !== undefined && !isText(image.credit)) errors.push(`${at}.image.credit: 캡션은 비어 있으면 안 된다`);
    // 원본 크기(선택) — 화면이 판형 비율로 자리를 미리 잡는다. 있으면 둘 다 양의 정수.
    if ((image?.width !== undefined || image?.height !== undefined)
      && !(Number.isInteger(image?.width) && image.width > 0 && Number.isInteger(image?.height) && image.height > 0)) {
      errors.push(`${at}.image: width·height는 둘 다 양의 정수`);
    }
  }
}

function checkCuration(curation, at, workIds, errors) {
  if (!ART_CURATION_KINDS.includes(curation.kind)) errors.push(`${at}.kind: ${ART_CURATION_KINDS.join('|')}`);
  // 책 언어 — 없으면 일본어. 책 장은 작품마다 이 언어의 해설이다(artBook.js).
  if (curation.language !== undefined && !LANGUAGE.test(curation.language)) errors.push(`${at}.language: ja|zh|en|fr`);
  if (!isObject(curation.title) || !isText(curation.title.ko)) errors.push(`${at}.title.ko가 필요하다`);
  const works = Array.isArray(curation.works) ? curation.works : [];
  if (works.length < 2) errors.push(`${at}.works: 두 점 이상`);
  if (new Set(works).size !== works.length) errors.push(`${at}.works: 중복 작품`);
  for (const id of works) if (!workIds.has(id)) errors.push(`${at}.works: 없는 작품 ${id}`);
}

/**
 * 카탈로그 전체 검사 — 오류 문자열 배열(빈 배열이면 통과). 작품 0점도 통과(ART-P0-1).
 * @param {{artists:Array, places:Array, periods:Array, works:Array, curations:Array}} catalog
 * @param {{studiesPinIds?: Set<string>}} [options] 주면 장소의 지역학 지도 핀 연결(links.studiesPin)도 대조한다.
 */
export function validateArtCatalog(catalog, { studiesPinIds = null } = {}) {
  const errors = [];
  if (!isObject(catalog)) return ['catalog: 객체여야 한다'];
  forbiddenKeys(catalog, 'catalog', errors);
  const periodIds = checkIds(catalog.periods, 'periods', errors);
  const artistIds = checkIds(catalog.artists, 'artists', errors);
  const placeIds = checkIds(catalog.places, 'places', errors);
  const workIds = checkIds(catalog.works, 'works', errors);
  checkIds(catalog.curations, 'curations', errors);
  const each = (list, kind, fn) => (Array.isArray(list) ? list : []).forEach((item, index) => {
    if (isObject(item)) fn(item, `${kind}[${index}]`);
  });
  each(catalog.periods, 'periods', (item, at) => checkPeriod(item, at, errors));
  each(catalog.artists, 'artists', (item, at) => checkArtist(item, at, periodIds, errors));
  each(catalog.places, 'places', (item, at) => checkPlace(item, at, studiesPinIds, errors));
  const artistDied = new Map((Array.isArray(catalog.artists) ? catalog.artists : []).filter(isObject).map((artist) => [artist.id, artist.died]));
  each(catalog.works, 'works', (item, at) => checkWork(item, at, { artistIds, artistDied, placeIds, periodIds }, errors));
  each(catalog.curations, 'curations', (item, at) => checkCuration(item, at, workIds, errors));
  return errors;
}

/** 해설 원문 해시 대조 — 카탈로그에 실린 text가 받은 원문 그대로인가(빌드·테스트용). */
export async function artDescriptionHashMismatches(catalog) {
  const { sha256Hex } = await import('./literatureCanonical.js');
  const mismatches = [];
  for (const work of catalog?.works ?? []) {
    for (const [index, description] of (work.descriptions ?? []).entries()) {
      if ((await sha256Hex(description.text)) !== description.textSha256) mismatches.push(`${work.id}.descriptions[${index}]`);
    }
  }
  return mismatches;
}

function yearSpan(from, to) {
  return from === to ? String(from) : `${from}–${to}`;
}

/** 가나·한자가 섞인 원문 표기(「江戸時代・安政4年(1857)」) — 일본어로 그대로 보인다. */
const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff]/;
const yearKo = (year) => (year < 0 ? `기원전 ${-year}` : String(year));

/**
 * 화면용 날짜 한 줄 — 「c. 1830/33」 같은 출처의 영어 약식 표기를 그대로 보이지 않는다.
 * 원문 표기에 가나·한자가 있으면 그대로(일본어), 아니면 연도 범위·확실성으로 한국어:
 *   exact 1857 → 「1857년」 · range 1830–1833 → 「1830–33년」(같은 세기면 끝 연도 앞 두 자리 생략) · circa → 「1830–33년경」 · 「1830년경」.
 */
export function artDateDisplay(date) {
  const text = typeof date?.text === 'string' ? date.text.trim() : '';
  if (JAPANESE_TEXT.test(text)) return text;
  const { startYear: from, endYear: to, certainty } = date ?? {};
  if (!isYear(from) || !isYear(to) || from > to) return text;
  let span = yearKo(from);
  if (to !== from) {
    const sameCentury = from >= 1000 && Math.floor(from / 100) === Math.floor(to / 100);
    span += `–${sameCentury ? String(to % 100).padStart(2, '0') : yearKo(to)}`;
  }
  return `${span}년${certainty === 'circa' ? '경' : ''}`;
}

/**
 * 작품 화면 정보 카드(설계 §12 목업) — 화면에 그릴 값만. 없는 작품이면 null.
 * 소장처 라벨은 늘 「소장처」다 — 「전시 중」이라고 말하지 않는다(전시 여부는 원문 링크에서 — 저장하지 않으므로 말할 수도 없다).
 */
export function artInfoCard(catalog, workId) {
  const work = catalog?.works?.find((item) => item.id === workId);
  if (!work) return null;
  const artist = catalog.artists.find((item) => item.id === work.artist) || null;
  const periodById = new Map(catalog.periods.map((item) => [item.id, item]));
  const placeById = new Map(catalog.places.map((item) => [item.id, item]));
  const placesFor = (role) => work.places
    .filter((entry) => entry.role === role && placeById.has(entry.place))
    .map((entry) => {
      const place = placeById.get(entry.place);
      return { id: place.id, name: place.name, city: place.city ?? null, lat: place.lat, lng: place.lng, links: place.links ?? {}, url: entry.url ?? null };
    });
  return {
    id: work.id,
    title: work.title,
    genre: work.genre,
    artist: artist && {
      id: artist.id,
      name: artist.name,
      years: yearSpan(artist.born, artist.died),
      life: artist.life,
      role: ART_GENRE_ARTIST_ROLE[work.genre] ?? null,
    },
    date: {
      text: work.date.text,
      display: artDateDisplay(work.date),
      // 원문 표기에 이미 시대 이름이 있으면(「江戸時代・安政4年(1857)」) 시대를 한 번 더 적지 않는다.
      periods: (work.periods ?? []).map((id) => periodById.get(id)?.label)
        .filter((label) => label && !(isText(label.native) && work.date.text.includes(label.native))),
    },
    medium: work.medium,
    holdings: placesFor('holding').map((place) => ({ ...place, label: '소장처' })),
    located: placesFor('located').map((place) => ({ ...place, label: '소재지' })),
    depicted: placesFor('depicted'),
    made: placesFor('made'),
    terms: work.terms,
    lookFor: work.lookFor ?? [],
    image: work.image && ART_IMAGE_LICENSES.includes(work.image.license) ? work.image : null,
    credits: work.descriptions.map((description) => ({
      language: description.language,
      credit: description.credit,
      license: ART_TEXT_LICENSE_LABEL[description.license] ?? null,
      sourceUrl: description.sourceUrl,
    })),
  };
}

/** 장소(소장처·그림 속 장소)에 이어진 작품 id — 「이 도시에서 둘러보기」·지도 핀 역방향. */
export function artWorksAtPlace(catalog, placeId, role = null) {
  return (catalog?.works ?? [])
    .filter((work) => work.places.some((entry) => entry.place === placeId && (role === null || entry.role === role)))
    .map((work) => work.id);
}

/** 큐레이션의 작품을 정해진 순서대로. 없는 큐레이션이면 빈 배열. */
export function artCurationWorks(catalog, curationId) {
  const curation = catalog?.curations?.find((item) => item.id === curationId);
  if (!curation) return [];
  const byId = new Map(catalog.works.map((work) => [work.id, work]));
  return curation.works.map((id) => byId.get(id)).filter(Boolean);
}

/** 연도 범위가 겹치는 작품 — 「같은 시대 다른 세계」 교차 큐레이션(설계 §9). */
export function artWorksOverlapping(catalog, startYear, endYear) {
  return (catalog?.works ?? [])
    .filter((work) => work.date.startYear <= endYear && work.date.endYear >= startYear)
    .sort((a, b) => a.date.startYear - b.date.startYear || a.id.localeCompare(b.id))
    .map((work) => work.id);
}
