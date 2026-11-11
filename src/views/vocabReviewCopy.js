// 복습 준비 실패 문구 정본(WALL-STATES — wallStatesContracts 계약). 단어장 목록(VocabPage)과 복습 화면(VocabReview)이 함께 쓴다.
// 복습 화면은 「복습 시작」 뒤에만 받는 조각이라(BUNDLE-AUTH-001) 문구는 여기 따로 둔다 — VocabReview는 다시 내보낸다.
//
// 채점 저장 실패 문구(「복습 저장 실패 … 이 단어는 다음에 다시 나와요」)는 저장할 채점이 있을 때만
// 맞는 말이라, 저장 전 단계인 준비 실패에 쓰지 않는다.
export const REVIEW_PREP_FAILED = '복습을 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
