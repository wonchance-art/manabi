/**
 * /study를 조립할 학습 기록(FSRS snapshot)을 읽지 못했나(STUDY-UNAVAILABLE-001, 오너 「권장대로」 2026-10-17 KST).
 * 서버 FSRS 계층은 저장소 · snapshot 실패를 5xx + fsrs_* 코드로 던진다(fsrsLearning · fsrsVocabulary reject). 그때는 일반 오류 화면
 * (「문제가 발생했어요」) 대신 전용 안내를 보인다. 복습 없이 세션을 여는 길은 쓰지 않는다 — 일정이 어긋난다.
 * 인증(4xx)이나 다른 오류는 지금처럼 위로 던진다.
 */
export function isStudyStorageUnavailable(error) {
  return !!error && Number(error.status) >= 500 && /^fsrs_[a-z_]+$/.test(String(error.code || ''));
}

export const STUDY_UNAVAILABLE_COPY = Object.freeze({
  title: '오늘 학습을 불러오지 못했어요',
  body: '학습 기록에 잠시 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  retry: '다시 시도',
  vocab: '단어장으로',
});

/** 오프라인 동안만 진행 막대 아래 한 줄(STUDY-OFFLINE-LINE) — 답은 기기 보류함에 남았다가 연결되면 저장된다. */
export const STUDY_OFFLINE_LINE = '오프라인 — 답은 이 기기에 보관했다가 연결되면 저장해요';
