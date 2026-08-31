/**
 * 오답 태그 유도 — 이벤트 1건 → 태그[] (v2-A R1, #1077 설계 §2).
 *
 * ── 원칙 P1: 저장 말고 유도
 *
 * `skillRung`이 세운 선례("rung은 DB 컬럼이 아니라 이벤트에서 유도되는 순수 함수")를
 * 그대로 잇는다. 태그를 적재하지 않으므로 ⑴ 규칙을 고치면 과거가 통째로 재계산되고
 * ⑵ 첫날부터 과거 이벤트 전부에 프로파일이 선다. 마이그레이션 0·새 source 0.
 *
 * LLM은 쓰지 않는다(설계 §6에서 배제) — 비용·비결정성도 문제지만 결정적인 건 **소급 불가**다.
 * 모델이 과거 이벤트를 다시 분류해 주지 않는 한 P1이 성립하지 않는다.
 *
 * ── 순수성을 지키는 방법: 해석기 주입
 *
 * 문법 이벤트의 `item_key`는 **챕터 slug일 수도 드릴 id일 수도** 있고(실측: 챕터 복습은
 * slug, `buildDrillReviewEvent`는 `drill.id`), 드릴 id를 챕터로 되돌리려면 콘텐츠
 * 레지스트리를 뒤져야 한다. 이 모듈이 그걸 알면 순수 함수가 아니게 되므로 **호출자가
 * 해석기를 넘긴다**(`deriveVocabRungs`가 콘텐츠 무의존을 위해 skillRung에 남은 것과 같은 결).
 *
 * ── R1의 축은 둘뿐 (설계 §2에서 좁힘)
 *
 * 설계는 `pos:{품사}` 축도 ✅ 즉시로 뒀지만 R1에는 **그걸 쓸 화면이 없다**. 리포트 한 줄이
 * 담을 수 있는 건 하나고, "명사가 약하다"보다 "듣고 쓰기가 약하다"가 훨씬 행동 가능한
 * 처방이다. 만들어 두고 안 쓰면 계약만 통과하는 죽은 축이 되므로, 소비처가 생기는
 * 라운드에서 함께 넣는다. `tone`은 설계대로 v2-C(음독 채점) 몫이다.
 *
 * ── R2에서 `glyph` 합류 (2026-08-31)
 * R2가 오답 응답(`detail.resp`)을 심어 글자 어긋남을 볼 수 있게 됐다. 조건은 좁다 —
 * 아래 glyphTags 주석 참조.
 */
import { diffChars } from './diffChars';

/**
 * 회상 방식 축 — **허용 목록**이다.
 *
 * qtype은 20종 가까이 적재되는데 대부분은 회상 방식이 아니다(도움 요청·푸시 열람·완독
 * 계측·자기채점·콘텐츠 고장 표식). 제외 목록으로 짜면 새 qtype이 생길 때마다 정체불명의
 * 축이 사용자 화면에 튀어나온다 — 허용 목록이면 **모르는 것은 조용한 쪽으로 떨어진다**
 * (G R1의 STRONG_SINGLE_KERNELS를 허용 목록으로 뒤집은 것과 같은 이유).
 */
export const RETRIEVAL_LABELS = {
  choice: '고르기',
  cloze: '빈칸 채우기',
  fill: '빈칸 고르기',
  typing: '직접 쓰기',
  listening: '듣고 쓰기',
  order: '어순 배열',
  match: '짝 맞추기',
  produce: '문장 만들기',
};

/**
 * 약점 집계에 넣을 이벤트인가.
 *
 * `weeklyReport.isGradedReviewEvent`(ui·dict 제외)보다 **좁다**. 그쪽은 정답률용이라
 * 그대로 두고(설계 §4 무변경 단언), 여기서만 더 걷어낸다:
 *  - `assist`/`explain`은 correct:false로 적재되지만 **오답이 아니라 도움 요청**이다.
 *    약점으로 세면 "막혀서 도움을 눌렀다"가 "그 유형에 약하다"로 둔갑한다.
 *  - `flash`·`self`는 자기채점이라 신뢰할 수 없다(skillRung이 flash 성공을 이미 배제).
 *  - `error`는 콘텐츠 고장 표식이다 — 사용자의 약점이 아니라 우리 결함이다.
 * 결과적으로 **허용된 qtype이 붙은 이벤트만** 남는다.
 */
export function isWeaknessEvent(event) {
  if (!event || !event.item_key) return false;
  const qtype = event.detail?.qtype;
  return Object.prototype.hasOwnProperty.call(RETRIEVAL_LABELS, qtype);
}

/**
 * 이벤트 1건 → 태그 목록.
 *
 * @param {object} event review_events 행 { source, item_key, correct, detail, created_at }
 * @param {object} [resolvers]
 * @param {(itemKey: string) => (string|null)} [resolvers.chapterOf] 문법 item_key → 챕터 slug
 * @returns {Array<string>} 예: ['retrieval:typing', 'pattern:ba-sentence']
 */
export function errorTags(event, { chapterOf } = {}) {
  if (!isWeaknessEvent(event)) return [];
  const tags = [`retrieval:${event.detail.qtype}`];

  if (event.source === 'grammar') {
    // 드릴 id는 그대로 두면 사용자에게 아무 말도 못 하는 문자열이다 — 챕터로 되돌려야
    // "이 챕터가 약하다"가 되고 챕터 링크도 걸린다. 못 되돌리면 이 축만 조용히 빠진다.
    const slug = chapterOf ? chapterOf(event.item_key) : event.item_key;
    if (slug) tags.push(`pattern:${slug}`);
  }

  for (const glyph of glyphTags(event)) tags.push(glyph);

  return tags;
}

/**
 * 표기 혼동 축 (v2-A R2) — **놓친 글자**만 센다.
 *
 * 조건이 좁다. ⑴ 오답이고 ⑵ `detail.resp`가 있고(R2가 심은 필드) ⑶ 어휘 회상이라
 * `item_key`가 곧 정답 표기인 qtype일 때만. 고르기·짝 맞추기는 응답이 보기 문자열이라
 * 글자 어긋남이 학습자의 표기 지식과 무관하고, 문법은 item_key가 슬러그라 정답이 아니다.
 *
 * `ins`(정답에만 있는 글자)만 취한다 — 잉여로 친 글자(`del`)는 오타·다른 단어라 표기
 * 약점의 근거가 얇다. 소급은 자연히 안전하다: 옛 이벤트엔 resp가 없어 이 축이 빠질 뿐이다
 * (P1 「저장 말고 유도」 — 규칙을 고치면 과거가 재계산된다).
 */
const GLYPH_QTYPES = new Set(['typing', 'listening']);
const GLYPH_CAP = 3;

function glyphTags(event) {
  if (event.correct) return [];
  if (event.source !== 'vocab') return [];
  if (!GLYPH_QTYPES.has(event.detail?.qtype)) return [];
  const resp = event.detail?.resp;
  const answer = event.item_key;
  if (typeof resp !== 'string' || !resp || typeof answer !== 'string' || !answer) return [];

  const missed = [];
  for (const seg of diffChars(resp, answer)) {
    if (seg.type !== 'ins') continue;
    for (const ch of seg.text) {
      if (missed.length >= GLYPH_CAP) break;
      if (!missed.includes(ch)) missed.push(ch);
    }
  }
  return missed.map((ch) => `glyph:${ch}`);
}

/** 태그의 축('retrieval'|'pattern')과 값을 가른다. 형태가 아니면 null. */
export function splitTag(tag) {
  if (typeof tag !== 'string') return null;
  const i = tag.indexOf(':');
  if (i <= 0 || i === tag.length - 1) return null;
  return { axis: tag.slice(0, i), value: tag.slice(i + 1) };
}

/** 태그 → 사람이 읽는 말. 낼 수 없으면 null — 화면은 그 줄을 그리지 않는다. */
export function tagLabel(tag, { chapterTitleOf } = {}) {
  const parts = splitTag(tag);
  if (!parts) return null;
  if (parts.axis === 'retrieval') return RETRIEVAL_LABELS[parts.value] || null;
  // 챕터 제목은 콘텐츠 레지스트리에 있다 — 그걸 안 든 화면은 이 축을 말할 수 없다.
  // `pattern:ba-sentence 9번 중 6번`은 사용자에게 아무 말도 아니다.
  if (parts.axis === 'pattern') return (chapterTitleOf ? chapterTitleOf(parts.value) : null) || null;
  return null;
}
