# 분석 작업 사슬 끝 일 빠짐 — 원인 · 수정 · 확인 기록 (2026-11-12 KST, ANALYSIS-CHAIN-END-001)

## 증상

- 공개 일본어 63편 중 25편(id 45–67 · 73 · 74)의 `metadata.difficulty`가 비어 있다. 카드 난이도 한 줄(LAUNCH-FLOW-M2)이 빠진 회귀다.
- 25편은 모두 A-2 전환분이다(`backup_private.ja_kanji_a2_20261111` 25/25).
  - A-2 마이그레이션(20261111010000)은 의도대로 difficulty를 비웠다(「크론이 다시 센다」).
- 같은 날 반입한 VOA 26편도 비어 있다. 영어는 scale null이라 화면 변화는 0이다.

## 원인 (운영 읽기 전용 · Vercel 실행 로그)

- 11/11 03:30 KST 예약 실행: A-2 적용 전이라 후보 0이었다.
- 11/12 03:30 ~ 03:40 KST: VOA 26편 분석 사슬 tick 5개가 돌았다(5 · 7 · 7 · 4 · 3).
  - tick 5가 작업을 끝내고 `more: true`로 tick 6을 불렀다. 작업이 끝나면 「다른 작업이 기다릴 수 있다」는 뜻으로 true를 돌려준다.
  - tick 6은 실행 줄(observe.cron_runs) · 로그 어디에도 없다(03:40:47 이후 이 경로 로그 0).
  - 사슬 끝 일(뜻 채움 · 난이도 · 사슬 끝 줄)은 「다음 tick이 할 일 없음을 볼 때」만 돌았다. 그래서 마지막 kick 하나가 닿지 않으면 그날 통째로 빠진다.
  - kick 결과는 어디에도 남지 않았다. tick 6이 왜 사라졌는지(kick 실패인지, 시작 뒤 소멸인지)는 이번 기록으로 가릴 수 없다.

## 수정 (`src/app/api/cron/analysis-jobs/route.js` · `src/lib/server/analysisJobs.js`)

- 계산 · RPC는 그대로다. 정본 `materialDifficulty` → `difficultySummary` → `material_set_difficulty`를 쓰고, 새 계산식은 없다.
- ① 작업이 방금 끝난 tick(`runAnalysisTick`이 `done: true`):
  - 사슬 끝 일을 이 tick에서 먼저 한다.
  - 줄 · 점검을 남긴 뒤, 기다리는 다른 작업을 위해 한 번 부른다.
- ② 이어 갈 분석이 남았는데 kick이 실패하면(false) 사슬 끝 일을 이 tick에서 한다. 남은 장은 다음 예약 실행이 잇는다.
- ③ kick 결과를 실행 줄 `detail.kick`에 남긴다. 다음에 같은 일이 생기면 kick 실패인지, 시작 뒤 소멸인지 가를 수 있다.
- 계약 `materialDifficultyRefresh.test.js`: 라우트를 실제로 돌려 네 갈래를 확인한다.
  - 끝난 tick · kick 닿음 · kick 실패 · 할 작업 없음
  - **옛 라우트로 되돌리면 4개 실패**를 확인했다.

## 데이터

- 마이그레이션은 없다. 다음 예약 실행(11/13 03:30 KST 전후)은 할 분석이 없어 곧바로 사슬 끝 일을 한다.
- 대기 51편(일본어 25 · 영어 26) 중 id 순 첫 50에 일본어 25가 모두 든다.
- 기존 정본 경로가 채우므로 별도 쓰기는 하지 않는다.
- 확인: 실행 줄 `detail.difficulty.written` · 25편 difficulty version 1 · 운영 일본어 카드 한 장의 난이도 줄.
