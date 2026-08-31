import { recordReviewCompleted } from './learn/progressStore';
import { qtypeForItem } from './studySession';

/**
 * StudySession 문항을 F2 progressStore 복습 계약으로 변환한다.
 * UI 채점 결과와 저장 경계를 분리해 재출제는 호출부에서 계속 제외한다.
 */
/** 오답 응답 적재 상한 — 진단에 필요한 건 글자 어긋남이지 장문이 아니다. */
export const RESP_MAX = 40;

/**
 * 오답 응답 정규화 (v2-A R2). **오답일 때만** 남긴다 —
 * 정답 응답은 진단 정보가 0이고, 적재하면 detail만 불린다.
 * 문자열이 아닌 응답(보기 객체 등)은 조용히 버린다: 글자 진단이 성립하지 않는다.
 */
export function normalizeResp(response) {
  if (typeof response !== 'string') return null;
  const trimmed = response.trim().slice(0, RESP_MAX);
  return trimmed || null;
}

export function buildStudyReviewRefs({ correct, item, lang, rtMs = 0, result = null, response = null }) {
  const effect = item?.effect;
  if (!effect) return [];

  // resp는 오답일 때만 — jsonb 안이라 스키마 변경 0이고, 기존 소비자는 모르는 키를
  // 무시한다(source·isGradedReviewEvent 무변경 = weeklyReport·growthStats 무영향).
  const resp = correct ? null : normalizeResp(response);
  const detailBase = {
    mode: 'study',
    qtype: qtypeForItem(item.type),
    rt_ms: rtMs,
    ...(resp ? { resp } : {}),
  };

  if (effect.kind === 'vocab-match' && Array.isArray(item.words)) {
    return item.words.map(word => {
      const pairResult = result?.pairResults?.find(
        pair => pair?.word?.word_text === word.word_text,
      );
      return {
        type: 'vocab',
        itemKey: word.word_text,
        lang,
        correct: pairResult ? pairResult.correct : correct,
        detail: {
          word_id: word.id,
          meaning: word.meaning,
          ...detailBase,
        },
      };
    }).filter(ref => ref.itemKey);
  }

  if (effect.kind === 'vocab' && item.word?.word_text) {
    return [{
      type: 'vocab',
      itemKey: item.word.word_text,
      lang,
      correct,
      detail: {
        word_id: item.word.id,
        meaning: item.word.meaning,
        // 만남 인지 문항 표지(rfc-adaptive-quiz §4.1) — word_id가 null이라 SRS 갱신은
        // progressStore의 기존 가드(detail.word_id 필수)가 자동으로 건너뛴다(FSRS 무접촉).
        ...(item.origin ? { origin: item.origin } : {}),
        ...detailBase,
      },
    }];
  }

  if (effect.kind === 'grammar-due' && effect.srs?.slug) {
    return [{
      type: 'grammar',
      itemKey: effect.srs.slug,
      lang,
      correct,
      detail: { ko: item.quiz?.ko, ...detailBase },
    }];
  }

  if (effect.kind === 'new-chapter' && effect.meta?.slug) {
    return [{
      type: 'grammar',
      itemKey: effect.meta.slug,
      lang,
      correct,
      detail: { ko: item.quiz?.ko, ...detailBase },
    }];
  }

  if (effect.kind === 'reading' && effect.key != null) {
    return [{
      type: 'reading',
      itemKey: String(effect.key).slice(0, 80),
      lang,
      correct,
      detail: detailBase,
    }];
  }

  if (effect.kind === 'warmup' && effect.key) {
    return [{
      type: 'vocab',
      itemKey: effect.key,
      lang,
      correct,
      detail: {
        ...detailBase,
        qtype: 'choice',
        warmup: true,
      },
    }];
  }

  return [];
}

/** 단일 문항 소비처를 위한 기존 공개 계약. 매칭은 첫 번째 쌍을 반환한다. */
export function buildStudyReviewRef(payload) {
  return buildStudyReviewRefs(payload)[0] || null;
}

/**
 * 첫 시도 문항 완료를 F2 progressStore로 보낸다.
 *
 * 어휘는 기존 StudySession과 같은 rating(정답 3/오답 1)으로 FSRS를 계산한 뒤
 * nextStats를 함께 넘긴다. 계산 모듈 로드가 실패해도 정오답 이벤트는 남긴다.
 * userId가 없으면 progressStore의 게스트 폴백 경로가 처리한다.
 */
export async function recordStudyReviewCompleted(userId, {
  correct,
  item,
  lang,
  rtMs = 0,
  result = null,
  response = null,
}) {
  const reviewRefs = buildStudyReviewRefs({ correct, item, lang, rtMs, result, response });
  if (reviewRefs.length === 0) return;

  let calculateFSRS = null;
  if (userId && reviewRefs.some(ref => ref.type === 'vocab')) {
    try {
      ({ calculateFSRS } = await import('./fsrs'));
    } catch {
      // 이벤트 기록은 FSRS 모듈 로드 실패와 독립적으로 유지한다.
    }
  }

  for (const reviewRef of reviewRefs) {
    if (!userId || reviewRef.type !== 'vocab') {
      await recordReviewCompleted(userId, reviewRef);
      continue;
    }

    const word = item.effect.kind === 'vocab-match'
      ? item.words.find(value => value.word_text === reviewRef.itemKey)
      : item.word;
    let nextStats = {};
    if (calculateFSRS && word) {
      nextStats = calculateFSRS(reviewRef.correct ? 3 : 1, {
        interval: word.interval ?? 0,
        ease_factor: word.ease_factor ?? 0,
        repetitions: word.repetitions ?? 0,
        next_review_at: word.next_review_at,
      });
    }
    await recordReviewCompleted(userId, reviewRef, nextStats);
  }
}
