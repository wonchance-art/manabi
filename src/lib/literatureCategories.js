// 정본 책 갈래(LIT-IMPORT-1 카테고리) — 카탈로그 규칙(scripts/lib/literature-catalog.mjs)과 산책 「고전 명작」(classicsShelf.js)이 같이 쓰는 정본.
// 앱 코드가 scripts/를 import하지 않도록 여기 두고, 카탈로그 규칙 모듈은 다시 내보내기만 한다.
/**
 * 카테고리(오너 「문학 책 리스트 카테고리화해서 정리」 → 「큰 카테고리에서 작은 카테고리로 들어가게」 2026-10-21 KST) — 작품의 형식으로 고른다
 * (주제 · 시대가 아니라). 큰 갈래(CATALOG_GROUPS) 셋 아래 작은 갈래(CATALOG_CATEGORIES) 아홉, 줄에는 작은 갈래 key 하나(큰 갈래는 거기서 나온다).
 * 모든 줄에 하나(수록 줄도 — 분류는 카탈로그가 매기는 것이라 entry.json의 사실과 겹치지 않는다). 순서가 목록의 차례다.
 * 경계: 장편 · 중편 · 단편 · 단편집은 모두 fiction(길이로 가르지 않는다 — 오너 「장편, 중단편은 그냥 소설로 통합」 2026-10-22 KST) · 서사시 · 산문시는 poetry ·
 * 옛이야기 · 동화 · 우화(짧은 이야기 모음 포함)는 tale · 어린 독자를 위한 긴 소설은 youth ·
 * 수필 · 기행 · 회고 수필은 essay · 자서전 · 일기 · 르포는 life · 철학 · 윤리 · 고전 사상은 thought · 정치 · 경제 · 사회 평론 · 선언서는 society.
 */
export const CATALOG_GROUPS = Object.freeze({ literature: '문학', young: '아동 · 청소년', nonfiction: '비문학' });
export const CATALOG_CATEGORIES = Object.freeze({
  fiction: Object.freeze({ group: 'literature', label: '소설' }),
  poetry: Object.freeze({ group: 'literature', label: '시' }),
  drama: Object.freeze({ group: 'literature', label: '희곡' }),
  tale: Object.freeze({ group: 'young', label: '동화 · 우화' }),
  youth: Object.freeze({ group: 'young', label: '아동 · 청소년 소설' }),
  essay: Object.freeze({ group: 'nonfiction', label: '수필 · 기행' }),
  life: Object.freeze({ group: 'nonfiction', label: '자서전 · 일기 · 르포' }),
  thought: Object.freeze({ group: 'nonfiction', label: '철학 · 사상' }),
  society: Object.freeze({ group: 'nonfiction', label: '사회 · 정치 · 경제' }),
});
/** 「문학 › 소설」 — 목록 머리 · 보기 줄에 쓴다. */
export const categoryPath = (key) => (Object.hasOwn(CATALOG_CATEGORIES, key ?? '') ? `${CATALOG_GROUPS[CATALOG_CATEGORIES[key].group]} › ${CATALOG_CATEGORIES[key].label}` : null);

