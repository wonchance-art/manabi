import { recordReviewCompleted } from './learn/progressStore';
import { qtypeForItem } from './studySession';

/**
 * StudySession 문항을 F2 progressStore 복습 계약으로 변환한다.
 * UI 채점 결과와 저장 경계를 분리해 재출제는 호출부에서 계속 제외한다.
 */
export function buildStudyReviewRef({ correct, item, lang, rtMs = 0 }) {
  const effect = item?.effect;
  if (!effect) return null;

  const detailBase = {
    mode: 'study',
    qtype: qtypeForItem(item.type),
    rt_ms: rtMs,
  };

  if (effect.kind === 'vocab' && item.word?.word_text) {
    return {
      type: 'vocab',
      itemKey: item.word.word_text,
      lang,
      correct,
      detail: {
        word_id: item.word.id,
        meaning: item.word.meaning,
        ...detailBase,
      },
    };
  }

  if (effect.kind === 'grammar-due' && effect.srs?.slug) {
    return {
      type: 'grammar',
      itemKey: effect.srs.slug,
      lang,
      correct,
      detail: { ko: item.quiz?.ko, ...detailBase },
    };
  }

  if (effect.kind === 'new-chapter' && effect.meta?.slug) {
    return {
      type: 'grammar',
      itemKey: effect.meta.slug,
      lang,
      correct,
      detail: { ko: item.quiz?.ko, ...detailBase },
    };
  }

  if (effect.kind === 'reading' && effect.key != null) {
    return {
      type: 'reading',
      itemKey: String(effect.key).slice(0, 80),
      lang,
      correct,
      detail: detailBase,
    };
  }

  if (effect.kind === 'warmup' && effect.key) {
    return {
      type: 'vocab',
      itemKey: effect.key,
      lang,
      correct,
      detail: {
        ...detailBase,
        qtype: 'choice',
        warmup: true,
      },
    };
  }

  return null;
}

/**
 * 첫 시도 문항 완료를 F2 progressStore로 보낸다.
 *
 * 어휘는 기존 StudySession과 같은 rating(정답 3/오답 1)으로 FSRS를 계산한 뒤
 * nextStats를 함께 넘긴다. 계산 모듈 로드가 실패해도 정오답 이벤트는 남긴다.
 * userId가 없으면 progressStore의 게스트 폴백 경로가 처리한다.
 */
export async function recordStudyReviewCompleted(userId, { correct, item, lang, rtMs = 0 }) {
  const reviewRef = buildStudyReviewRef({ correct, item, lang, rtMs });
  if (!reviewRef) return;

  if (!userId || item.effect.kind !== 'vocab') {
    return recordReviewCompleted(userId, reviewRef);
  }

  let nextStats = {};
  try {
    const { calculateFSRS } = await import('./fsrs');
    const word = item.word;
    nextStats = calculateFSRS(correct ? 3 : 1, {
      interval: word.interval ?? 0,
      ease_factor: word.ease_factor ?? 0,
      repetitions: word.repetitions ?? 0,
      next_review_at: word.next_review_at,
    });
  } catch {
    // 이벤트 기록은 FSRS 모듈 로드 실패와 독립적으로 유지한다.
  }

  return recordReviewCompleted(userId, reviewRef, nextStats);
}
