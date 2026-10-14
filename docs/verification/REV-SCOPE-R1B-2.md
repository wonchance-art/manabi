# REV-SCOPE-R1B-2 — 학습 단계 정책 anki-v2 (1분 · 10분)

범위: 인계 §R1-B 「학습 단계 Anki 기본(1분 · 10분) 정책 전환」(오너 REV-SCOPE 3판 D1–D15 「권장대로 승인」 2026-10-10,
이 스레드 「여기서 진행」 2026-10-14). R1-B-1(#1450)이 미룬 마지막 조각이다. **운영 DB에는 적용하지 않았다** —
SQL 검수 · 오너 확인 뒤 별도(인계 §6-3 「FSRS SQL 읽기 전용 확인 → 비파괴 SQL 별도 승인 → 코드 전환」).

## 1. 읽기 전용 확인 결과 (M09 운영 정의 fixture, 2026-10-10 관찰본)

정책값을 검사하는 곳은 세 군데이고, 학습 단계 30초를 박아 둔 곳은 세 군데다. 그래서 SQL 손질이 필요하다.

| 자리 | 지금 | 바꿈 |
|---|---|---|
| `fsrs_private.valid_card` | `policyVersion = 'anki-seconds-v1'`만 · New 하한 소개 + 30초 | 두 정책 · New 하한 = 카드 정책 첫 단계(30초 · 1분) |
| `public.fsrs_apply_operation` (enroll) | due = 소개 + 30초 | due = 소개 + 카드 정책 첫 단계 |
| `public.fsrs_save_manual_vocabulary` | due = 소개 + 30초 | 같은 규칙 |
| `public.fsrs_capabilities` | `'anki-seconds-v1'` | `'anki-v2'` |
| 지문 | — | `settings.contract_hash` · `manual_save_settings.contract_hash` 재게시. admission · activity 지문은 그대로(끝에서 확인) |

바꾸지 않는 것: 취소 · 중단 뒤 30초 재질문 대기(`next_question_at`), 테이블 · 권한 · 트리거, 학습자 행.

## 2. 코드 (이 PR)

- `fsrsScheduler.js`: `FSRS_POLICIES`(anki-seconds-v1 30초 · 10분 / anki-v2 60초 · 10분, 재학습 10분).
  `validateFsrsCard`는 두 정책을 받고 New 하한 · 단계 수는 카드 정책으로 본다.
  `introduceFsrsCard(at, { policyVersion })`, `previewFsrsRatings(card, at, { policyVersion })`에서
  `policyVersion`은 채점 뒤 정책이고, 생략하면 카드 정책을 쓴다.
- 서버(`fsrsLearning.js` · `learningAdmission.js` · `fsrsVocabulary.js`): `fsrs_capabilities`가 알린 정책값을 받는다.
  모르는 값이면 멈춘다(`fsrs_storage_unavailable`). 새 카드와 다음 채점 결과는 그 정책으로 만든다.
  학습 · 재학습 중인 예전 카드는 다음 채점 때 **같은 단계 순번**으로 넘어간다. 예: 학습 1단계 「어려움」은 10분.
- 중단 뒤 재질문 30초는 학습 단계와 분리했다(`FSRS_RETRY_SECONDS`). SQL `next_question_at`과 같은 값이다.
- 첫 질문 영수증 검사(`vocabularyLearningRead.js`): New 카드는 그 정책의 첫 단계를 쓴다.
  채점된 카드는 정책이 바뀌었을 수 있으므로 가장 짧은 첫 단계(30초)로 본다.

SQL을 적용하기 전에는 서버가 계속 `anki-seconds-v1`을 알린다. 그래서 이 코드를 배포해도 화면 · 일정 변화는 0이다.

## 3. 검증

- `node supabase/tests/fsrs-anki-v2-policy.mjs`(CI 추가) — PGlite + M09 fixture:
  1. 적용 전: anki-v2 카드는 무효이고, 예전 카드를 anki-v2로 넘기는 채점은 `invalid_fsrs_transition`으로 거절된다.
  2. 적용 뒤:
     - 네 지문이 고정되고 알리는 정책은 anki-v2다.
     - 예전 정책 카드 4상태(New · Learning · Review · Relearning)의 유효 수는 4 그대로다.
     - 학습 중 예전 카드를 「다시」로 채점하면 anki-v2 학습 0단계 · 1분이 된다.
     - 직접 담기의 due는 소개 + 1분이다. anki-v2 New가 30초면 거절된다.
     - 다시 적용하면 정의 확인에서 멈춘다.
  3. 복원:
     - anki-v2 카드가 있으면 알리는 정책만 되돌린다. 두 정책 검사는 그대로 두므로 유효 수가 유지된다.
     - anki-v2 카드가 없으면 네 함수 본문 MD5가 관찰본과 같아진다.
- `fsrsScheduler.test.js`:
  - anki-v2 1분 · 5.5분 · 10분, 재학습 10분.
  - 예전 카드 → 정책을 알리면 같은 단계로 넘어간다.
  - 정책을 알리지 않으면 이전 동작 그대로다.
  - 모르는 정책은 거절된다.
- `fsrsLearning.test.js`: 서버가 anki-v2를 알리면 등록 1분 · 다음 채점이 anki-v2이고, 모르는 정책은 거절된다.

## 4. 적용 순서 (오너 확인 뒤)

1. 이 PR을 운영에 배포한다. 예전 앱은 `'anki-v2'`를 모르는 정책으로 보고 새 일정 복습을 멈추기 때문에 SQL보다 먼저다.
2. `docs/sql/fsrs-anki-v2-policy.sql`을 한 트랜잭션으로 실행한다.
   - 운영 정의가 관찰본과 다르면 아무것도 바꾸지 않고 멈춘다.
   - 기존 카드가 하나라도 무효가 되면 전체를 되돌린다.
3. 파일 끝의 확인 쿼리를 KST 시각과 함께 기록한다(정책 · 지문 · 카드 수 · 유효 수 · anki-v2 수).
   인계 수용 기준 「학습 단계 전환 전후 값(한도 사용 · 남음, 카드 유효 수)」에 해당한다.
4. 복원: `docs/sql/fsrs-anki-v2-policy-rollback.sql`.

## 5. 남긴 것

- 관리자 지표에서 연습 기록을 빼는 SQL(R1-B-1 기록 §8-2)은 이 SQL에 넣지 않았다. 범위가 다르다.
- 화면 미리보기 중 재개된 질문(`useFsrsReview` 재개 경로)은 카드 정책으로 계산한다.
  정답 보기 뒤에는 서버 미리보기(지금 정책)를 쓰므로, 차이는 SQL 적용 직후 이미 열려 있던 질문 하나의 표시 시간뿐이다.
