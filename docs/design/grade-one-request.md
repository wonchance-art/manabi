# 단어 페이지 FSRS 채점 — 한 장 = 요청 한 번 (GRADE-ONE-REQUEST-001)

2026-10-30 KST · 오너 승인 「한 장 = 요청 한 번」 · DB 변경 없음(기존 함수만)

## 바뀐 것
- 단어 페이지(HSK/JLPT)는 카드 하나를 채점할 때 `POST /api/learning/fsrs` `{ action: 'answer', accountId, cardId, operationId, rating }` 하나만 보낸다.
  시각 · 판본 · 시도 · 입장 정책은 받지 않는다(서버 권한 그대로).
- 서버(`applyFsrsAnswer`)가 묻기 → 보이기 → 채점을 차례로 한다. 단계마다 자기 시계, 단건 연산과 같은 `parseFsrsRequest` · `transition` ·
  `fsrs_apply_learning_operation`(공통 `commitOperation`). DB에는 지금처럼 연산 셋이 `<탭 ID>:question|reveal|grade`로 남는다.
- 재전송(같은 탭 ID)은 `fsrs_read_state`의 최근 연산 이력에서 반영된 단계를 찾아 건너뛴다 — 다 반영됐으면 `duplicate: true` 영수증.
  같은 ID에 다른 평점은 `fsrs_operation_conflict`. 동시 재전송은 단건과 같은 확인(`fsrs_read_operation` → 같은 요청이면 잇기).
- 하루 새 단어 몫: 처음 묻는 New 카드인데 몫이 없으면 반영 없이 `fsrs_new_budget_exhausted`(본문에 `limit`). 반영 함수의 경합 거절도
  같은 이름. 단어 페이지는 이것을 `{ ok:false, reason:'new-limit', limit }`로 옮긴다(#1611 그대로).
- 차례가 아닌 카드는 `fsrs_card_not_due`(본문에 `nextQuestionAt`) — 곧 차례면(±6초) 3초 기다려 같은 탭 ID로 한 번 더(#1612 그대로).
- 열린 시도(복습실 · 끊긴 앞 탭)가 있으면 새 질문 없이 그 시도를 보이기 · 채점한다 — 컨트롤러 `question()`과 같은 동작.
- 되돌리기는 그대로 보낼함의 `undo` 하나: `targetOperationId = 응답의 grade.operationId`, `expectedRevision = grade.revision`.
- 단건 연산(복습실 등)의 요청 · 응답 · 오류 본문은 바뀌지 않는다. 복습실은 컨트롤러 흐름 그대로.

## 호출 수 (카드 한 장, 서버 코드 경로 기준)
| | 전(컨트롤러) | 후(answer) |
|---|---|---|
| HTTP | 6 (GET 목록 3 · POST 3) | **1** (POST) |
| 인증 getUser | 3 | 1 |
| fsrs_list_states(가장 무거움 ≈0.23 s) | 3 | **0** |
| learning_admission_status | 4 | 1 |
| fsrs_read_operation / fsrs_read_state | 3 / 3 | 0 / 1 |
| fsrs_apply_learning_operation | 3 | 3 |
| fsrs_capabilities(15초 공유) | 0–1 | 0–1 |
| 합 | **19–20** | **6–7** |

드문 경로의 추가: 연산 이력 100개가 꽉 찬 카드의 재전송(연산 읽기 ≤3) · 동시 재전송 확인(연산 1 + 상태 1) · 반영 응답에 quota가 없을 때 입장 1.

## 위험 · 남은 것
- 입장 정책(`expectedPolicyRevision` · `dailyNewLimit`)은 서버가 방금 읽은 값으로 채운다. 경합은 반영 함수가 같은 트랜잭션에서 다시 거절한다.
  전에도 단어 페이지는 묻기 직전에 다시 읽은 값을 보냈으므로 의미는 같다.
- 묻기 · 보이기 시각 간격이 왕복 시간(수백 ms)에서 서버 안 수 ms로 준다. 채점 시각 = 보인 시각(전과 같은 규칙). 응답 시간 분석에 이 간격을 쓰면 안 된다.
- 보낼함에 넣지 않는다 — 끊기면 `{ ok:false, error }`(전에도 묻기 · 보이기는 온라인이 필요했다). 응답 유실은 같은 탭 ID로 한 번 재전송.
- 세 반영이 한 함수 호출 안에서 차례로 돈다(약 1–1.5 s). 클라이언트 상한 15 s. 상한 뒤 재전송이 앞 요청과 겹쳐도 연산 ID로 하나만 남는다.
- 계약 테스트: `src/lib/server/__tests__/fsrsAnswer.test.js` · `src/lib/__tests__/gradeOneRequest.test.js`(전송자 → 경로 → 서버, DB만 대역).
