# 실제 기억률 표 (TRUE-RET-001 · 오너 확정 · 2026-10-30 KST)

**무엇:** 복습 단계 단어를 다시 만났을 때 기억해 낸 비율(측정값)을 기간별 · 익히는 중/익숙별로 목표 90%와 나란히 보인다. **순환 정거장:** 자료 읽기 순환의 「FSRS 복습」 뒤 진단(받침: 동기 · 진단). 일정 · 기록은 바꾸지 않는 읽기 전용.
**계산 정본:** `src/lib/trueRetention.js`(`buildTrueRetention`) — 채점 판정 `isGradedReviewEvent` · 되돌림 `dropUndoneEvents` · 학습일
`learningDay`(04시) · 익숙 `MATURE_MIN_INTERVAL`(21) · 목표 `FSRS_POLICY.retention`을 가져다 쓴다. 새 카운터를 따로 짓지 않는다.
**이름 구분(이중 진실 방지):** 「유지율」 = 지금 기억할 확률의 **예측**(memoryHealth) · 「이번 주 정답」 = 모든 채점(weeklyReport) · 「실제 기억률」 = 복습 단계 카드의 **측정**. 셋은 다른 값이라 화면에서 같은 이름을 쓰지 않는다.

## 어디에 — 현황(`/progress`) 기억 건강 칸
격자(AK 목업 D-X6)는 그대로 두고 기억 건강 칸 맨 아래에 한 줄을 더한다. 누르면 이번 주 칸과 같은 `TileModal`로 표를 편다.
```
┌ 기억 건강 ─────────────────────── 유지율 87% ┐
│ ● 120 선명   ● 40 양호   ● 12 흐릿   ● 3 위험 │
│ 복습 스케줄  ▁ ▃ ▅ ▂ ▁ ▁ ▂                    │
│ 실제 기억률 · 지난 30일   91%  (목표 90%)   › │
└───────────────────────────────────────────────┘
── 눌렀을 때(모달) ──
실제 기억률
복습 단계 단어를 다시 만났을 때 기억해 낸 비율이에요. 「다시」를 누른 답만 못 떠올린 것으로 세요.
              익히는 중        익숙             전체
오늘          —                —                —
어제          88% (22)         95% (19)         91% (41)
지난 7일      89% (140)        93% (121)        91% (261)
지난 30일     88% (602)        94% (511)        91% (1,113)
지난 1년      90% (6,410)      93% (5,980)      91% (12,390)
전체          90% (7,002)      93% (6,231)      91% (13,233)
목표 90% — 오래 보면 이 근처에 모여요. 하루 값은 흔들리니 30일 줄을 보세요.
익숙 = 간격 21일 이상 · 괄호 = 답 수 · 연습 · 되돌린 답 · 학습 단계 답은 빼요.
(예전 일정 단어가 있을 때만) 예전 일정 단어 답 412개는 간격을 지난 날짜로 어림했어요.
── 빈 상태 ── 칸 줄 「실제 기억률 · 지난 30일   —」 → 모달 「아직 실제 기억률을 잴 복습이 없어요」 + [복습하기]
```
- 칸 줄은 30일 전체 칸만, 답 10개 미만이면 「—」. 언어 칩으로 거른다. 목표 대비 색 · 화살표는 없다(이번 주 카드 「거울이지 성적표가 아니다」).

## 세는 규칙 (모듈 머리말 · 계약 `trueRetention.test.js`가 정본)
- 셈: `source='vocab'` + 평가 1–4(새 일정 · 단어 · 인라인 · 산책 퀘스트) 또는 /study 어휘 문항(정오로 일정 변경). 맞힘 = 다시 말고 전부.
- 뺌: 연습(`practice`) · 목록 자기 확인(`level` · `hanzi`) · 산출 · 예열 · undo 마커와 그 원 채점 · 직전 간격 1일 미만(학습 · 재학습 단계 · 같은 날 재출제).
- 직전 간격: 새 일정 = `fsrs_operations.operation.previousCard`가 Review일 때 `scheduledDays`(정확). **예전 일정은 이벤트에 직전 간격이 없다** —
  같은 단어 직전 채점부터 지난 학습일 수로 어림(`estimated`로 따로 셈, 늦게 복습하면 익숙 쪽으로 쏠림). 쓰기 4곳(VocabPage · useInlineReview · QuestReview · studyExerciseBridge)이 `detail.prev_interval_days = cardIntervalDays(row)`를 실으면 정확해진다(모듈은 이미 읽는다 · 스키마 무변경).

## 조회 계획 (기존 경로 재사용 · 마이그레이션 없음)
| 재료 | 조회 | 비용(하루 40채점 가정) |
|---|---|---|
| 어휘 채점 | `review_events` `source=eq.vocab` · `created_at` 창 — `readCompleteLegacyRows` 정본 완전 조회(주간 리포트와 같은 길) | 30일 ≈ 1,200행 = 2쪽 |
| undo 마커 | `undoneReviewsRows.fetchUndoMarkers(sinceIso)` 그대로 | 1요청 |
| 직전 카드 | `fsrs_operations` `kind=in.(grade,undo)` · `received_at` 창, `previousCard` 상태 · 간격과 `undoneOperationId`만 골라 받음(본인 RLS SELECT 있음) | 30일 ≈ 1,200행 = 2쪽 |
- 칸 줄은 현황 진입 때 30일만. 1년 · 전체는 모달을 열 때 지연 조회(1년 ≈ 15,000행 · 15쪽 — 첫 화면에 얹지 않는다). 서버 집계 RPC는 1차 배제: SQL에 같은 규칙을 다시 쓰면 그게 이중 진실이다. 전체 기간이 무거우면 그때 오너 결정.

## 선례 조사 (Anki 24.11 True Retention)
| 항목 | 판정 | 근거 |
|---|---|---|
| 기간 6줄(오늘 · 어제 · 7 · 30 · 365일 · 전체), 학습일 경계 | 채택 | rslib retention.rs가 next_day_start 기준 −1/−2/−7/−30/−365일. 우리 04시 = Anki 기본 롤오버 |
| 익숙 = 직전 간격 ≥ 21일, 다시 = 실패 · 나머지 맞힘 | 채택 | 같은 파일 `MATURE_IVL = 21` · `button_chosen == 1`. 우리 카드 단계(D15)와 같은 경계 |
| 직전 간격 ≥ 1일 카드만 · 벼락치기 제외 | 채택 | `review_kind == Review` 또는 `last_interval >= 1` · `!is_cramming()` → 우리 연습(practice)이 벼락치기 자리 |
| 「하루 첫 답만 센다」(설명서 문구) | 부분 채택 | 설명서엔 있으나 코드엔 그런 거르기가 없다. 우리는 같은 날 재답이 간격 1일 미만으로 자연히 빠진다 |
| 표 안 목표 기억률 열 | 부분 채택 | Anki 표엔 열이 없고 도움말이 desired retention 설명으로 잇는다. 우리는 표 아래 한 줄 + 칸 줄 괄호 |
| 익히는 중/익숙/전체 · 보기 전환 | 부분 채택 | 3열 고정 · 전환 없음(좁은 화면 390px) |
| 코드 이식 | 배제 | AGPL-3.0(rslib) · Rust/Svelte라 결합 불가. 규칙만 옮겨 순수 JS로 새로 씀 |
근거: docs.ankiweb.net/stats.html · github.com/ankitects/anki/releases/tag/24.11(#3425) · rslib/src/stats/graphs/retention.rs · ts/routes/graphs/true-retention.ts

## 오너 결정 (2026-10-30 KST 「권장대로 ㄱㄱ. 기억 건강 칸에 한 줄로.」)
1. 자리: 기억 건강 칸 한 줄 + `TileModal` 표(격자 무변경) · 2. 이름 「실제 기억률」 · 3. 예전 일정 기록 보강 착수 — 쓰기 4곳이
   `...prevIntervalDetail(row)`(growthStats — `cardIntervalDays` 정본을 감쌈, 잴 수 없으면 칸 없음)를 detail에 덧붙인다.

## 구현 (계약 `trueRetentionUi.test.jsx`)
- 조회 `src/lib/trueRetentionRows.js`: 진입 때 `recent`(30학습일 — review_events 완전 조회 · undo 마커 · fsrs_operations grade/undo) = 최소 3요청,
  모달을 열 때 `all`(창 없음) 한 벌 더. detail · operation은 경로로 필요한 칸만 받는다. 긴 조회가 끝나면 칸 줄도 그것으로 센다(표와 같은 값).
- 화면: `MemoryHealthCard` 맨 아래 44px 단추 한 줄 → `ProfileStats`의 `TileModal`(제목 「실제 기억률」) 안 `TrueRetentionTable`.
  1년 · 전체 줄은 긴 조회 전 「…」, 실패면 「—」 + 다시 시도. 손님은 줄 없음.
