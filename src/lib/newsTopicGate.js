/**
 * 뉴스 주제 게이트 — 하드리밋 「중화권 정치 서술 완전 배제」의 **집행 지점** (v2-F R3, #1077).
 *
 * F R2에서 중국어를 못 켠 이유는 소스가 없어서가 아니라 **뉴스 피드가 정치 기사를 자동으로
 * 추천 카드에 올리기 때문**이었다. 그래서 개통의 선행 조건은 DB 행이 아니라 이 게이트다.
 *
 * ── 왜 allowlist(fail-closed)인가
 *
 * 키워드 denylist는 **미분류·미매칭 기사를 통과시킨다**. 「완전 배제」는 "걸린 것만 막는다"로는
 * 성립하지 않는다. 그래서 판정을 뒤집었다 — **안전 분류가 확인된 기사만 통과**시키고,
 * 카테고리가 아예 없는 기사는 **거부**한다. 놓치는 쪽(수확량 손실)이 새는 쪽보다 싸다.
 *
 * 판정 재료는 내 키워드 추측이 아니라 **위키 자신의 분류 체계**다. MediaWiki가 기사마다
 * 붙여 둔 카테고리를 쓰므로, 편집자 합의가 판정을 대신한다.
 *
 * ── 지역 처리
 *
 * 하드리밋의 「민감지역은 지리·외관만」에 맞춰, 대만·홍콩·마카오·티베트·신장 분류는
 * **주제와 무관하게** 막는다. 반면 `中国` 자체는 막지 않는다 — 그러면 zh 피드가 통째로
 * 사라져 게이트가 아니라 차단기가 된다. 대신 안전 분류 요건이 그대로 걸리므로,
 * 통과하는 것은 「중국 + 과학/체육/문화」류다.
 */

/** 정치·민감지역 분류. 하나라도 걸리면 **주제 무관 거부**. 번체·간체를 함께 싣는다. */
export const ZH_BLOCKED = Object.freeze([
  // 정치 일반
  '政治', '政府', '選舉', '选举', '軍事', '军事', '外交', '國會', '国会',
  '抗議', '抗议', '示威', '人權', '人权', '民主', '獨立', '独立', '戰爭', '战争',
  '法律', '法院', '審判', '审判', '共產黨', '共产党', '國民黨', '国民党',
  // 민감지역 — 지리·외관만(하드리밋)
  '兩岸', '两岸', '臺灣', '台灣', '台湾', '香港', '澳門', '澳门',
  '西藏', '新疆', '維吾爾', '维吾尔', '中南海',
]);

/** 안전 분류. **최소 하나**를 가져야 통과한다(미분류 = 거부). */
export const ZH_SAFE = Object.freeze([
  '科技', '科學', '科学', '體育', '体育', '文化', '藝術', '艺术',
  '娛樂', '娱乐', '健康', '醫學', '医学', '環境', '环境', '氣象', '气象',
  '交通', '教育', '音樂', '音乐', '電影', '电影', '天文', '生物',
]);

/** 이름 있는 게이트 — 소스 정의가 문자열로 고른다(에디션 표에 객체를 심지 않는다). */
export const GATES = Object.freeze({
  zhNonPolitical: Object.freeze({ safe: ZH_SAFE, blocked: ZH_BLOCKED }),
});

/**
 * `Category:政治` · `分类:科技` · `分類:體育` → `政治` · `科技` · `體育`.
 * 언어판마다 네임스페이스 표기가 달라 접두사를 떼고 비교한다.
 */
export function normalizeCategory(title) {
  return String(title ?? '').replace(/^\s*(Category|Categoría|Catégorie|分类|分類)\s*:\s*/i, '').trim();
}

/**
 * 통과 판정. `categories`는 MediaWiki `prop=categories`가 준 제목 배열.
 *
 * 부분 일치를 쓴다 — 실제 분류가 `科技新聞`·`日本政治`처럼 합성어라 완전 일치는 거의 안 맞는다.
 * 부분 일치의 오작동 방향은 둘 다 안전하다: 차단 목록이 넓게 걸리면 더 거부하고,
 * 안전 목록이 넓게 걸려도 차단 판정이 우선이라 정치 기사는 못 들어온다.
 */
export function passesTopicGate(categories, gate) {
  if (!gate) return true;                      // 게이트 없는 언어판(en·fr)은 그대로
  if (!Array.isArray(categories) || categories.length === 0) return false;  // 미분류 = 거부
  const names = categories.map(normalizeCategory).filter(Boolean);
  if (names.length === 0) return false;
  if (names.some((n) => gate.blocked.some((b) => n.includes(b)))) return false;
  return names.some((n) => gate.safe.some((s) => n.includes(s)));
}
