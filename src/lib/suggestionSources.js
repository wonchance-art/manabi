/**
 * 추천 수집 소스 편성 — 순수 함수 (v2-F R2, #1077).
 *
 * 크론 라우트에 묻어 있던 두 결정을 끄집어냈다. 둘 다 **공급이 ja/en에 갇혀 있던 원인**이라
 * 계약으로 고정할 값어치가 있다:
 *   ① 기본값 보충 — 예전엔 `dbSources.length > 0 ? dbSources : DEFAULTS`라, DB에 ja/en 행이
 *      하나라도 있으면 기본값 전체가 죽었다. 새 언어를 코드로 열 방법이 없었다.
 *   ② 언어 그룹핑 — 예전엔 `{ Japanese: [], English: [] }` 고정이라, DB에 French 행을 넣어도
 *      `if (byLang[s.language])`에서 조용히 버려졌다. 진짜 병목이 여기였다.
 */

/**
 * 클릭 시점에 **개인 자료로** 가져오는 추천의 `source` 값 (v2-F R4).
 *
 * 이 값 하나가 「본문을 서버가 미리 복제해 두지 않았다」는 표식이다. 크론은 목록
 * (제목·채널·썸네일·videoId)만 담고 `transcript`는 NULL로 둔다 — 자막 복제는 사용자가
 * **자기 계정에** 할 때 비로소 일어난다. 선례(LingQ)와 같은 자리다.
 */
export const ONDEMAND_SOURCE = 'youtube_ondemand';

/** 이 추천이 클릭 시점 반입인가. `transcript` 유무로 보면 안 된다 — 글 소스도 NULL일 수 있다. */
export function isOnDemandSuggestion(s) {
  return s?.source === ONDEMAND_SOURCE;
}

/**
 * 기사 → `daily_suggestions.source` 라벨.
 *
 * 예전엔 크론 안에서 `videoId` 접두사 체인으로만 정했는데, 유튜브는 **videoId가 실제
 * 유튜브 id여야 한다**(클릭 시점에 그 id로 주소를 만든다). 접두사를 붙이면 그게 깨지므로
 * 소스가 스스로 라벨을 말하게 하고, 접두사 체인은 기존 글 소스용으로 남긴다.
 */
export function suggestionSourceLabel(article) {
  if (article?.source) return article.source;
  const id = article?.videoId || '';
  if (id.startsWith('qiita_')) return 'qiita';
  if (id.startsWith('devto_')) return 'devto';
  if (id.startsWith('nhk_')) return 'nhk';
  if (id.startsWith('wikinews_')) return 'wikinews';
  return 'wikipedia';
}

/** 추천 행 → 유튜브 주소. 클릭 시점 반입이 이 주소를 F R1 라우트에 넘긴다. */
export function suggestionVideoUrl(s) {
  const id = s?.video_id || s?.videoId || '';
  return id ? `https://www.youtube.com/watch?v=${id}` : '';
}

/**
 * DB `content_sources`에 그 언어 행이 하나도 없을 때 쓰는 기본 소스.
 * 언어별로 보충되므로 여기 언어를 추가하면 **배포만으로 그 언어 공급이 열린다** —
 * 오너의 DB 수작업이 필요 없다(하드리밋 「운영 DB 적용은 오너 수동」을 건드리지 않는다).
 *
 * Chinese는 일부러 없다 — 하드리밋 「중화권 정치 서술 완전 배제」. 뉴스 피드는 정치 기사를
 * 자동으로 추천 카드에 올리게 된다. `wikinews_zh` 디스패처는 있으니, 오너가 켜기로 하면
 * `content_sources`에 행 하나면 된다.
 */
export const DEFAULT_SOURCES = Object.freeze([
  Object.freeze({ language: 'Japanese', source_type: 'qiita',       config: { level: 'N2 상급' } }),
  Object.freeze({ language: 'Japanese', source_type: 'nhk_rss',     config: { level: 'N3 중급' } }),
  Object.freeze({ language: 'English',  source_type: 'devto',       config: { level: 'B1 중급' } }),
  Object.freeze({ language: 'French',   source_type: 'wikinews_fr', config: { level: 'B1 중급' } }),

  // ── U R4 소스 확장(#1077 5509440618 → 오너 「좋은 안 있으면 그걸로 적용」, 2026-09-05) ──
  // 주제 태그는 소스 자신의 분류에서 — NHK는 카테고리 피드(URL), Wikinews는 카테고리(categorymembers).
  // 기존 행은 그대로 두고 **더한다**(기존 6종 수집 결과 불변). DB가 그 언어를 아는 운영 환경에서는
  // 기본값이 잠자므로, 켜려면 content_sources 행이 필요하다 — 20260905100000_content_sources_r4.sql.
  // VOA·service-public(rss_text)은 피드 URL을 이 세션이 실측하지 못해 기본값에 넣지 않는다(오너 행으로만).
  Object.freeze({ language: 'Japanese', source_type: 'nhk_rss',     config: { feed: 'cat1', level: 'N3 중급' } }),   // 社会
  Object.freeze({ language: 'Japanese', source_type: 'nhk_rss',     config: { feed: 'cat3', level: 'N3 중급' } }),   // 科学・医療
  Object.freeze({ language: 'English',  source_type: 'wikinews',    config: { category: 'Health', level: 'B2 상급' } }),
  Object.freeze({ language: 'English',  source_type: 'wikinews',    config: { category: 'Science and technology', level: 'B2 상급' } }),
  Object.freeze({ language: 'French',   source_type: 'wikinews_fr', config: { category: 'Santé', level: 'B1 중급' } }),
  Object.freeze({ language: 'French',   source_type: 'wikinews_fr', config: { category: 'Environnement', level: 'B1 중급' } }),

  // ── 영상(v2-F R4) — 목록만 긷고 자막은 클릭 시점에 개인 자료로 ──
  //
  // 채널은 **핸들**로 적는다. 이 세션은 YouTube가 egress 차단이라 채널 ID를 확인하지
  // 못했고, 핸들이 틀리면 크론 로그에 소리 나게 남는다(조용한 0건보다 낫다).
  // `langCode`는 「그 언어 자막이 실제로 달린 영상만」 고르는 데 쓴다 — 이게 없으면
  // 클릭했을 때 자막이 없어 붙여넣기로 떨어진다.
  // VOA는 **미국 정부 저작물 = 퍼블릭 도메인**이라 본문을 담아 공개 자료로 둔다(F R5).
  // 근거가 법이지 YouTube 라이선스 표식이 아니므로 **설정으로 명시**한다.
  Object.freeze({
    language: 'English', source_type: 'youtube_channel',
    config: { handle: '@VOALearningEnglish', langCode: 'en', level: 'B1 중급', license: 'public-domain' },
  }),
  Object.freeze({
    language: 'Japanese', source_type: 'youtube_channel',
    config: { handle: '@cijapanese', langCode: 'ja', level: 'N4 초중급' },
  }),
  Object.freeze({
    language: 'Japanese', source_type: 'youtube_channel',
    config: { handle: '@Onomappu', langCode: 'ja', level: 'N3 중급' },
  }),
  Object.freeze({
    language: 'French', source_type: 'youtube_channel',
    config: { handle: '@innerFrench', langCode: 'fr', level: 'B1 중급' },
  }),

  // ── CC BY 검색(v2-F R5) — 재배포 허용분이라 본문을 담는다 ──
  // 채널 화이트리스트와 달리 **매일 다른 영상**이 걸린다. 라이선스 재확인을 통과한 것만
  // 남으므로 수확은 적을 수 있다 — 그게 fail-closed의 값이다.
  Object.freeze({
    language: 'Japanese', source_type: 'youtube_cc',
    config: { query: '日本語 学習', langCode: 'ja', level: 'N3 중급' },
  }),
  Object.freeze({
    language: 'English', source_type: 'youtube_cc',
    config: { query: 'english lesson', langCode: 'en', level: 'B1 중급' },
  }),
  Object.freeze({
    language: 'French', source_type: 'youtube_cc',
    config: { query: 'apprendre le français', langCode: 'fr', level: 'B1 중급' },
  }),
]);

/**
 * DB 행 + 기본값 → 이번 실행에서 돌릴 소스 목록.
 *
 * 「그 언어가 DB에 설정돼 있는가」와 「지금 켜져 있는가」는 다른 질문이다. 그래서 입력은
 * `is_active`로 거르지 않은 **전체 행**이어야 한다:
 *   · DB가 아는 언어 → 그 언어의 **활성 행만** 쓴다(의도적 비활성을 기본값이 되살리지 않는다)
 *   · DB가 모르는 언어 → 기본값으로 연다
 */
export function resolveActiveSources(dbSources, defaults = DEFAULT_SOURCES) {
  const rows = Array.isArray(dbSources) ? dbSources : [];
  const configuredLangs = new Set(rows.map((s) => s?.language));
  return [
    ...rows.filter((s) => s?.is_active),
    ...defaults.filter((d) => !configuredLangs.has(d.language)),
  ];
}

/** 소스 목록 → `Map<language, source[]>`. 언어 목록을 고정하지 않고 소스에서 유도한다. */
export function groupByLanguage(sources) {
  const byLang = new Map();
  for (const s of sources || []) {
    if (!s?.language) continue;
    if (!byLang.has(s.language)) byLang.set(s.language, []);
    byLang.get(s.language).push(s);
  }
  return byLang;
}
