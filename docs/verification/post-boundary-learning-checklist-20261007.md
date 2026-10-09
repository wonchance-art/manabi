# 경계 이후 정상 계정 검수표 — FSRS·공통 신규 한도·활동 기록

작성 2026-10-07 (KST) · 기준 main `978ff6b`(이후 main 변경은 문서·lint뿐, 운영 판본 `403cd66` 그대로) · 실행 담당 M09 · 배정 #1337 코멘트 6036022408 · 출처 #1337 코멘트 5995801702

- 운영 배포 판본 `403cd66`과 `978ff6b` 사이의 변경은 `AGENTS.md`·`CLAUDE.md` 두 파일뿐이다. 따라서 아래 코드 근거는 운영에서 돌고 있는 코드와 같다.
- 운영 DB 상태(M09 보고): FSRS 코어 `20261005132141`, admission/activity `20261005132233`, 한도 15, 두 시작 시각 모두 **2026-10-06 04:00 KST**.
- 이 문서는 검수 설계다. 여기 적힌 기대값은 저장소 코드와 `docs/verification/*` 문서에서 읽은 것이다. 이 문서를 썼다고 해서 검수가 수행된 것은 아니다.

---

## 0. 원칙과 사전 조건

### 0.1 공통 품질 실행 원칙(AGENTS.md 27~35행) 적용
| 축 | 이 검수에서 증거로 쓰는 것 | 대신할 수 없는 것 |
|---|---|---|
| 의미 | 첫 질문 영수증 → 정답 확인 → 평가 → 활동이 하나의 사용자 행동으로 이어지는지 | 상태 코드 200 |
| 보존 | QA 전후 지문(fingerprint)이 같고, 개인 항목에 새 기록이 0건인지 | 격리 환경 PGlite 픽스처 |
| 사용성 | 실제 화면의 문구·로딩·빈 상태·오류·키보드(1~4, Ctrl/⌘+Z)·좁은 화면(320/390) | 컴포넌트 단위 테스트 |
| 신뢰성 | 재시도·응답 유실·탭 2개·계정 전환·04:00 경계 | 합성 계정, 단일 백엔드 테스트 |
| 배포 | `/api/version`이 `403cd66…`인지 | 자동 Git 배포(이 배포는 실패했다) |

한 축이 통과해도 다른 축의 실패를 덮지 않는다. **미래 시각에 할 검수(04:00·09:00·D+1)는 실제로 해 보기 전에는 완료로 쓰지 않는다.**

### 0.2 사전 조건 (하나라도 빠지면 시작하지 않는다)
- [ ] P1 **실제 로그인한 정상 계정**(이하 QA 계정)으로 진행한다. 합성 계정은 계정 전환의 격리를 볼 때 보조로만 쓰고, 합격 근거로 세지 않는다.
- [ ] P2 운영 `/api/version` commit이 `403cd66d8d98…`이다. 다르면 이 검수표의 코드 근거를 다시 확인한다.
- [ ] P3 **QA 항목 접두어**를 정한다. 이 문서는 `qa-b1007-NN`(영어, 소문자, 뜻 `QA 경계 검수 NN`)을 쓴다. 개인 원문은 QA 항목에 쓰지 않는다.
- [ ] P4 **범위 격리**: 복습 큐는 `due` 순서로 개인 카드를 먼저 낸다(`fsrsQueueState`). 레거시 세션도 범위 안의 미평가 개인 항목을 승인(admit)한다. 그래서 아래 SQL Q4·Q5로 다음 두 값을 먼저 확인한다. **둘 중 하나라도 1 이상이면 그 경로의 검수를 멈추고, 범위 필터로 격리할 수 있는지 다시 확인한다.**
  - QA가 아닌 FSRS 카드 가운데 지금 출제 가능한 수
  - 사용할 복습 범위(시리즈 필터·교재 범위) 안에 있는, QA가 아닌 레거시 항목 가운데 지금 만기이거나 미평가인 수
  - 개인 카드가 한 번이라도 화면에 출제되면 첫 노출 영수증이 생긴다. 이것은 개인 항목을 평가한 것이다. 출제 직후 "나가기"를 눌러도 영수증은 환급되지 않는다.
- [ ] P5 QA를 하는 동안 QA 계정으로 **다른 학습을 하지 않는다**(읽기 완료·문법·작문은 `update_streak`과 `review_events`를 오염시킨다). 시작 시각 `qa_start`를 KST로 기록한다.
- [ ] P6 소진 검수를 하는 날은 QA 계정의 **그날 실제 신규 한도 15개를 QA가 모두 쓴다**. 오너 계정이라면 그 학습일의 신규 학습은 포기하는 셈이다. 일정을 미리 정한다.
- [ ] P7 브라우저는 Chrome 계열로 DevTools Network(Offline, 사용자 정의 throttling, Block request URL)와 Application → IndexedDB를 쓸 수 있어야 한다.
- [ ] P8 SQL은 §3의 **읽기 전용 세션**에서만 실행한다. QA 시작 전에 Q3·Q4·Q6·Q7·Q8 결과를 "기준값"으로 저장해 둔다. 저장 위치는 비공개 메모이고, 보고에는 차이만 쓴다.

### 0.3 QA 항목 준비
| 종류 | 만드는 방법 | 타는 경로 | 필요한 수 |
|---|---|---|---|
| F형(FSRS) | 단어장 → 수동 추가(`saveVocabulary`, 저장과 등록이 한 트랜잭션) | `/api/learning/fsrs` question → reveal → grade, `FsrsReviewSession` | (15 − 오늘 사용량) + 2 이상 |
| L형(레거시) | 비공개 QA 자료 뷰어에서 저장. 이 경로는 FSRS에 등록되지 않는다. 또는 활성화 전에 만든 QA 항목 | `/api/learning/admission` admit → 레거시 `handleScore` | 3 이상 |

- F형은 저장한 뒤 **30초가 지나야** 출제된다(`introduceFsrsCard`의 due는 저장 시각 + 30초). 30초 안에 출제되지 않는 것은 정상이다.
- 10-05에 M09가 만든 QA 항목(F형·L형)이 미평가 상태로 남아 있으면 재사용할 수 있다. Q5로 상태를 먼저 확인한다.

---

## 1. 단계별 절차 (정상 경로)

표기: **행동** → **기대 관찰(화면)** / **기대 관찰(SQL)**. 단계마다 KST 시각과 스크린숏 번호를 남긴다.

### S0 기준선
| # | 행동 | 기대(화면) | 기대(SQL) |
|---|---|---|---|
| S0.1 | 로그인 후 `/vocab`(단어장) 진입 | "오늘 할 일" 숫자가 보이고, 오류 배너가 없다 | Q3: `installed=enabled=active=fsrsEnabled=true`, `startsAt=2026-10-06 04:00 KST`, `limit=15`, `learningDay`=오늘 KST 학습일(04:00 기준), `used=fsrsUsed+legacyUsed`, `remaining=15−used` |
| S0.2 | 단어장 도구 → "하루 새 단어 한도" 선택 상자 확인 | 값 15. localStorage의 옛 값이 아니라 서버 `limit`이 표시된다 | 같음 |
| S0.3 | 기준 지문 저장 | — | Q6(개인 어휘·출처 지문), Q7(프로필 3필드 지문), Q8(개인 FSRS 지문), Q9(QA 기간 개인 `review_events` 0건) |

### S1 F형 첫 질문 → 정답 확인 → 평가
| # | 행동 | 기대(화면) | 기대(SQL) |
|---|---|---|---|
| S1.1 | F형 `qa-b1007-01` 수동 추가 | "단어를 추가했어요" 토스트. 30초 안에는 출제되지 않는다 | Q5: `enrolled=true`, `state=New`, `revision=0`, `firstQuestionAt=null`. 레거시 열은 `interval=0`, `repetitions=0`, `last_reviewed_at=null` 그대로 |
| S1.2 | 30초 뒤 "표현 N개 복습 →" 클릭 | FSRS 화면으로 바뀐다. 잠시 "복습 준비 중…"이 보인 뒤 단어와 "정답 확인하기"가 나온다. **뜻과 4버튼은 아직 보이지 않는다** | Q3: `used`·`fsrsUsed` +1, `remaining` −1. Q5: `firstQuestionAt`이 지금(KST), attempt phase=`question` |
| S1.3 | "정답 확인하기" | 뜻·출처 인용·4버튼(다시/어려움/알맞음/쉬움, 순서·색 기존 그대로, 한 줄)이 나오고 버튼마다 간격 라벨(30s/5m15s/10m/…)이 붙는다 | attempt phase=`revealed`, `revealedAt` 기록. `used`는 그대로 |
| S1.4 | 키 `3`(알맞음) | 다음 카드 또는 빈 상태가 된다. 진행 수 +1, 오류 없음. 프로필(스트릭) 표시가 새로 읽힌다 | Q5: `revision=1`, `state=Learning`, `reps=1`. Q10: 이 grade의 활동 영수증 **정확히 1건**. `effective_at`=revealedAt, 활동일=revealedAt의 **UTC 날짜**. Q7: 그 UTC 날짜가 `last_streak_date`보다 뒤이면 스트릭 규칙대로 갱신되고, 같은 날이면 바뀌지 않는다 |
| S1.5 | 320px·390px 폭에서 S1.2~S1.4 반복(새 F형 항목) | 4버튼이 한 줄에 들어가고 잘리지 않는다. 키보드 포커스가 보인다 | — |

### S2 L형 첫 질문 → 평가
| # | 행동 | 기대(화면) | 기대(SQL) |
|---|---|---|---|
| S2.1 | 격리 범위(P4)를 선택하고 복습 시작. 대기 중인 F형이 없을 때 | 단어가 보이기 전에 "복습 준비 중…"이 나온다. 단어는 **승인 영수증이 생긴 뒤에만** 나온다 | Q3: `legacyUsed` +1, `admittedLegacyCardIds` 수 +1. Q11: 승인 영수증 1건, `consumed=true` |
| S2.2 | 채점(알맞음) | 다음 카드로 넘어가고 오류가 없다 | 레거시 열(`interval`/`repetitions`/`next_review_at`/`last_reviewed_at`)이 전진한다. Q9: QA `item_key`의 `review_events` +1. `update_streak` 경로는 §6의 A3을 보고 결과를 그대로 기록한다 |
| S2.3 | F형 n개와 L형 m개가 섞인 날의 합계 확인 | — | `used = fsrsUsed + legacyUsed`. 두 경로가 **같은 15개 예산**을 나눠 쓴다 |

---

## 2. 경계 사례

### B1 한도 15 소진 이후
| # | 행동 | 기대 |
|---|---|---|
| B1.1 | 남은 한도(`remaining`)가 0이 될 때까지 F형·L형 신규를 하나씩 출제한다(각각 평가 또는 "다시") | 출제할 때마다 `used`가 정확히 1씩 늘고, 15에서 멈춘다 |
| B1.2 | 소진한 뒤 단어장 대시보드를 본다 | L형이 남아 있으면 "오늘 새 표현 한도에 도달했어요. 남은 N개는 다음에 익혀요."가 나온다. F형 미노출 New 카드는 큐에서 빠진다(`queue()` 조건 `remaining > 0`) |
| B1.3 | 소진한 뒤 복습 시작 | **이미 노출한 카드는 계속 나온다**: Learning 상태 카드, "다시"로 30초 뒤 다시 나오는 카드, 오늘 `firstQuestionAt`이 이미 있는 New 카드. 새로 노출되는 신규는 0개다. `used`는 15에서 변하지 않는다 |
| B1.4 | 탭 A에서 `remaining=1`인 상태로 탭 B를 연다. A에서 마지막 1개를 쓴 뒤, B에서 포커스를 바꾸지 않고 곧바로 출제를 시도한다(B의 화면 상태는 예전 값) | `question()`이 출제 전에 상태를 다시 읽으므로 B에서도 **신규가 출제되지 않는다**. 서버까지 가더라도 409 `fsrs_new_budget_exhausted`가 오고, 문제 DOM이 생기지 않는다. `used`는 15 그대로다. 화면 문구는 실제로 나온 그대로 기록한다(§6 A5) |
| B1.5 | 소진한 뒤 F형을 새로 저장하고 30초를 기다린다 | 저장은 성공한다(저장은 노출이 아니다). 출제는 되지 않는다. `firstQuestionAt=null`이 유지된다 |
| B1.6 | 다음 학습일 04:00 이후 | `remaining=15`로 돌아오고, B1.5 카드가 출제된다(B4 참고) |

### B2 같은 요청 재시도(멱등)
| # | 행동 | 기대 |
|---|---|---|
| B2.1 | 평가 버튼을 빠르게 두 번 누르거나 키 `3`을 연타한다 | grade 연산 1건, `revision`은 정확히 +1, 활동 영수증 1건 |
| B2.2 | 같은 F형 attempt를 탭 A와 B에서 함께 연다(B는 GET으로 같은 attempt를 이어받는다). 정답을 확인한 뒤 A는 3, B는 1을 누른다 | 서버 반영은 1건뿐이다. B는 `fsrs_revision_conflict`/`attempt_conflict`로 막히고, 화면이 다시 읽혀 현재 상태로 수렴한다. 두 번째 평가가 반영되면 **실패** |
| B2.3 | 같은 L형 카드를 두 탭에서 동시에 출제한다 | IndexedDB `manabi-learning-admission-v1`의 미확정 의도를 두 탭이 같이 쓰거나, 두 번째 요청이 `duplicate=true`·`consumed=false`로 처리된다. `legacyUsed`는 +1만 |
| B2.4 | 한도 변경 CAS: 탭 A·B를 연 상태에서 A가 15→10으로 바꾸고, B로 전환한 뒤 출제한다. **조건: Q2에서 한도가 계정별로 저장되는 것이 확인됐을 때만 한다(§6 A8)** | B는 포커스를 받으면 다시 읽어 10을 표시한다. 예전 `policyRevision`으로 출제되지 않는다. 마지막에 **15로 되돌리고** `limit=15`, `policyRevision`=시작값+2를 확인한다 |

### B3 오래 열어 둔 탭
| # | 행동 | 기대 |
|---|---|---|
| B3.1 | D−1 저녁에 단어장 탭을 열어 두고, 노트북 잠자기 등으로 04:00을 넘긴 뒤 복귀한다 | focus/visibility 이벤트로 admission과 FSRS를 다시 읽는다. `learningDay`가 D로 바뀌고 `remaining`이 다시 계산된다. 대시보드 숫자가 바뀐다 |
| B3.2 | D−1에 정답까지 확인한 F형 attempt를 열어 둔 채 D 04:00 이후에 평가한다 | 평가는 반영된다. 복습 시각은 **revealedAt**이며 도착 시각이 아니다. D의 예산은 쓰이지 않는다. 활동일은 revealedAt의 UTC 날짜 |
| B3.3 | 세션 토큰이 만료될 만큼 오래 둔 뒤 조작한다 | 401은 `fsrs_auth_required`로 표면화된다. 다시 로그인한 뒤 미확정 연산은 같은 ID로 재전송된다. **토큰 갱신이나 새로고침만으로는 `last_login_at`·스트릭이 바뀌지 않는다**(Q7). 명시적으로 로그인했을 때만 `last_login_at`이 바뀐다 |

### B4 04:00 직전·직후 학습일 (실제 시각에만 수행)
| # | 시각(KST) | 행동 | 기대 |
|---|---|---|---|
| B4.1 | 03:50 | Q3 실행, 화면 기록 | `learningDay` = D−1 |
| B4.2 | 03:55~03:59 | F형 신규 1개 출제 → 정답 확인(평가는 하지 않는다). L형 신규 1개 승인 → 화면을 둔다 | D−1의 `used` +2 |
| B4.3 | 04:00:30 이후 | 새로고침 없이 탭에 포커스한다. Q3 실행 | `learningDay`=D, `used`=0(D에 다른 사용이 없을 때), `remaining`=15 |
| B4.4 | 04:01 | B4.2의 F형을 평가한다 | 반영된다. D의 `used`는 0 그대로. 활동일은 revealedAt의 UTC 날짜(03:59 KST = 전날 18:59Z) |
| B4.5 | 04:02 | B4.2의 L형을 계속 진행하거나 다시 출제한다 | **문서 기대**: 이미 노출한 카드는 다시 차감하지 않는다(`consumed=false`). 차감되면 §6 A6에 따라 실패 후보로 기록하고 판정을 보류한다 |
| B4.6 | 04:05 | 시간대 확인 | 스트릭 날짜(UTC 자정 = **09:00 KST**)는 04:00에 바뀌지 않는다. 별도 B4.7 |
| B4.7 (선택) | 08:55 → 09:05 | 08:58에 정답 확인, 09:01에 평가 | 활동일은 revealedAt의 UTC 날짜(전날). 도착 시각 기준이 아니다 |

### B5 undo
| # | 행동 | 기대 |
|---|---|---|
| B5.1 | F형 평가 직후 Ctrl/⌘+Z 또는 ↶ | "되돌리기" 연산이 반영된다(revision +1). 기억 상태와 due가 **평가 직전 값으로 정확히 복원**된다. `firstQuestionAt`은 유지된다. `used`는 그대로(환급 없음). 활동 영수증은 남는다("실제 학습일은 유지") |
| B5.2 | undo 직후 같은 카드 출제 | 노출 쿨다운 때문에 30초 안에는 출제되지 않는다 |
| B5.3 | undo를 연타하거나 응답 유실 뒤 재시도 | undo 1건만 반영된다(같은 `undoPayload` ID) |
| B5.4 | 새로고침한 뒤 undo 시도 | undo 버튼이 비활성이다(단일 단계, 메모리 보관). 정상 동작이며 결함이 아니다 |
| B5.5 | L형 평가 후 undo | 레거시 5필드가 평가 직전 값으로 돌아간다. `review_events`에 `undo_of` 보상 이벤트가 1건 추가된다(원 이벤트는 남는다). 승인 영수증과 `legacyUsed`는 그대로. 같은 카드를 다시 출제해도 차감되지 않는다(`duplicate`/`consumed=false`) |

### B6 오프라인/응답 유실
| # | 행동 | 기대 |
|---|---|---|
| B6.1 | DevTools Offline 상태에서 복습 시작 | 문제가 보이지 않고, 오류와 "다시 시도"가 나온다. 서버 `used`는 그대로 |
| B6.2 | 온라인에서 출제와 정답 확인까지 한 뒤 Offline으로 바꾸고 평가 | 평가는 IndexedDB outbox에 durable하게 쌓이고(pending) 다음으로 넘어간다. 성공으로 보이게 꾸미지 않는다(대기 표시 또는 경고). 온라인으로 돌아오면 자동 flush로 반영 1건 |
| B6.3 | Offline에서 정답 확인(reveal) 시도 | 정답 확인은 온라인 영수증이 필요하다. 오류가 나오고 phase는 `question` 그대로다. 뜻이 보이면 **실패** |
| B6.4 | 응답 유실(grade): throttling 지연을 10초 이상으로 두고 평가를 누른 뒤 1~2초 안에 새로고침 | 다시 열면 outbox에서 같은 operationId가 재전송된다. 서버 반영은 정확히 1건(재전송은 `duplicate=true`). 활동 영수증 1건 |
| B6.5 | 응답 유실(첫 질문): 지연을 크게 두고 출제를 누른 뒤 Offline → 새로고침 → Online | 같은 의도·attempt를 이어받는다(`confirmQuestion`). `used`는 +1만. **다른 카드가 추가로 차감되면 실패** |
| B6.6 | Block request URL로 `/api/learning/admission` POST를 차단한 뒤 L형 출제 | 의도는 pending으로 남고 문제는 나오지 않는다. 차단을 풀고 "다시 시도"하면 같은 ID로 영수증 1건 |
| B6.7 | Offline에서 평가한 뒤 오프라인 상태로 새로고침하고, 다시 Online | outbox 항목(평가 영수증 포함)이 남아 있다가 1건으로 반영된다 |

### B7 계정 전환
| # | 행동 | 기대 |
|---|---|---|
| B7.1 | QA 계정에서 B6.2처럼 평가를 pending으로 둔 채 로그아웃하고 계정 B로 로그인(Online) | A의 pending이 B의 이름으로 전송되지 않는다. B 화면에 A의 단어·한도·문제가 나오지 않는다. 늦게 온 응답은 버려진다 |
| B7.2 | 계정 B의 한도·사용량 확인 | B의 `used`는 A와 독립이다(A의 소진이 B에 번지지 않는다) |
| B7.3 | 다시 A로 로그인 | A의 pending이 A의 이름으로 flush되어 1건 반영된다 |
| B7.4 | 로그아웃 없이 다른 탭에서 계정을 바꾼다 | 원래 탭은 `fsrs_account_changed`/`learning_admission_account_changed`로 거절되고, 다른 계정의 데이터를 쓰지 않는다 |
- 계정 B가 합성 계정이면 B7은 **격리 증거**로만 기록하고 정상 계정 합격 근거로는 세지 않는다.

---

## 3. 읽기 전용 확인 SQL

### 3.0 세션 가드 (반드시 이렇게만 실행한다)
```bash
# 읽기 전용 기본값으로 연결한다. 연결 문자열은 화면·로그에 남기지 않는다.
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' psql "$DB_URL_RO" -X -v ON_ERROR_STOP=1
```
```sql
\set qa_prefix 'qa-b1007-%'
\set qa_start '2026-10-0X 03:45:00+09'      -- QA 시작 KST로 기입
BEGIN TRANSACTION READ ONLY;
SHOW transaction_read_only;                  -- 반드시 on. off면 즉시 중단
-- 자기 QA 계정 ID를 출력하지 않고 변수에만 담는다(\gset은 결과를 표시하지 않는다)
SELECT id AS qa_uid FROM auth.users WHERE email = :'qa_email' \gset
SELECT (:'qa_uid')::uuid IS NOT NULL AS qa_bound;   -- true만 확인
-- ... 아래 쿼리 ...
ROLLBACK;
```
- 모든 쿼리는 `user_id = :'qa_uid'` 또는 `p_actor => :'qa_uid'`로 한정한다. ID·이메일·`word_text`·`meaning`·`quote`·`detail`은 **SELECT 목록에 넣지 않는다**. 카드는 `left(md5(id::text),8)`로만 표시한다.
- RPC 호출(Q3·Q4·Q8)이 읽기 전용 트랜잭션에서 `cannot execute ... in a read-only transaction` 오류를 내면, 그 함수가 쓰기를 한다는 뜻이다. **읽기 전용을 해제하고 다시 실행하지 않는다.** 그 쿼리는 미확인으로 남기고 §6에 기록한다.

### Q1 객체 목록 (데이터 없음, 이름·타입만)
```sql
SELECT c.relname, c.relkind,
       string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ', ' ORDER BY a.attnum) AS cols
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
  AND c.relname ~ '(fsrs|admission|activity|learning_)'
GROUP BY c.relname, c.relkind ORDER BY 1;
```
→ 아래 Q10·Q11의 `<activity_table>`·`<admission_receipt_table>`·열 이름을 이 결과로 채운다. 저장소에는 이 마이그레이션 SQL이 없다(§6 A1).

### Q2 함수 계약·권한
```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.provolatile AS vol, p.prosecdef AS definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_x,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_x,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_x,
       md5(pg_get_functiondef(p.oid)) AS body_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ~ '^(fsrs_|learning_)' OR p.proname = 'update_streak')
ORDER BY 1, 2;
```
기대: 변경 RPC(`learning_admit_legacy`, `learning_configure_admission`, `fsrs_apply_learning_operation` 등)는 `anon_x=false`, `auth_x=false`, `svc_x=true`. `fsrs_capabilities`는 `auth_x=true`. `update_streak`의 `auth_x` 값은 **그대로 기록**한다(§6 A3). `learning_configure_admission`의 인자에 actor가 있는지, 한도 저장 테이블(Q1)에 `user_id`가 있는지로 A8을 판정한다.

### Q3 공통 한도 상태 (계정 ID 제외)
```sql
SELECT s->>'installed' inst, s->>'enabled' en, s->>'active' act, s->>'fsrsEnabled' fsrs,
       to_char((s->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD HH24:MI') starts_kst,
       to_char((s->>'now')::timestamptz AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS') now_kst,
       s->>'learningDay' lday, s->>'limit' lim, s->>'policyRevision' rev,
       s->>'used' used, s->>'remaining' rem, s->>'fsrsUsed' f_used, s->>'legacyUsed' l_used,
       jsonb_array_length(s->'admittedLegacyCardIds') admitted_legacy_n,
       (s->>'used')::int = (s->>'fsrsUsed')::int + (s->>'legacyUsed')::int AS sum_ok,
       (s->>'remaining')::int = greatest(0, (s->>'limit')::int - (s->>'used')::int) AS rem_ok
FROM (SELECT public.learning_admission_status(p_actor => :'qa_uid'::uuid)::jsonb AS s) x;
```

### Q4 어휘·등록 스냅샷 요약 (QA와 개인을 나눠 센다)
```sql
WITH s AS (SELECT public.fsrs_vocabulary_snapshot(p_actor => :'qa_uid'::uuid)::jsonb AS j),
r AS (SELECT e FROM s, jsonb_array_elements(j->'rows') e),
g AS (SELECT e FROM s, jsonb_array_elements(j->'registry') e)
SELECT (r.e->>'word_text') LIKE :'qa_prefix' AS is_qa,
       (g.e->>'enrolled')::boolean AS enrolled, g.e->'card'->>'state' AS state,
       count(*) n,
       count(*) FILTER (WHERE g.e->>'firstQuestionAt' IS NOT NULL) first_q,
       count(*) FILTER (WHERE (g.e->>'enrolled')::boolean AND (g.e->>'nextQuestionAt')::timestamptz <= now()
                          AND (g.e->>'eligible')::boolean) fsrs_ready_now,
       count(*) FILTER (WHERE NOT (g.e->>'enrolled')::boolean AND r.e->>'last_reviewed_at' IS NULL) legacy_unreviewed,
       count(*) FILTER (WHERE NOT (g.e->>'enrolled')::boolean AND (r.e->>'next_review_at')::timestamptz <= now()) legacy_due
FROM r JOIN g ON g.e->>'cardId' = r.e->>'id'
GROUP BY 1,2,3 ORDER BY 1,2,3;
-- 스냅샷 완전성
SELECT j->>'enabled' en, j->>'complete' complete, jsonb_array_length(j->'rows') nrows,
       jsonb_array_length(j->'registry') nreg FROM (SELECT public.fsrs_vocabulary_snapshot(p_actor => :'qa_uid'::uuid)::jsonb j) s;
```
P4 판정: `is_qa=false`인 행의 `fsrs_ready_now`가 0이어야 한다. 사용할 범위 안의 `legacy_due`·`legacy_unreviewed`는 화면의 범위 숫자와 대조한다.

### Q5 QA 항목 상세 (해시 ID만)
```sql
WITH s AS (SELECT public.fsrs_vocabulary_snapshot(p_actor => :'qa_uid'::uuid)::jsonb AS j),
r AS (SELECT e FROM s, jsonb_array_elements(j->'rows') e WHERE e->>'word_text' LIKE :'qa_prefix'),
g AS (SELECT e FROM s, jsonb_array_elements(j->'registry') e)
SELECT left(md5(r.e->>'id'),8) card, r.e->>'language' lang, (g.e->>'enrolled') enrolled,
       g.e->'card'->>'state' state, g.e->'card'->>'revision' rev, g.e->'card'->>'reps' reps, g.e->'card'->>'lapses' lapses,
       to_char((g.e->>'firstQuestionAt')::timestamptz AT TIME ZONE 'Asia/Seoul','MM-DD HH24:MI:SS') first_q_kst,
       to_char((g.e->>'nextQuestionAt')::timestamptz AT TIME ZONE 'Asia/Seoul','MM-DD HH24:MI:SS') next_q_kst,
       g.e->'attempt'->>'phase' attempt_phase,
       r.e->>'interval' l_interval, r.e->>'repetitions' l_reps, (r.e->>'last_reviewed_at') IS NULL l_unreviewed,
       to_char((r.e->>'created_at')::timestamptz AT TIME ZONE 'Asia/Seoul','MM-DD HH24:MI') created_kst
FROM r JOIN g ON g.e->>'cardId' = r.e->>'id' ORDER BY created_kst;
```

### Q6 개인(비 QA) 어휘·출처 보존 지문
```sql
SELECT count(*) n_vocab, md5(string_agg(to_jsonb(v)::text, E'\n' ORDER BY v.id)) vocab_fp
FROM public.user_vocabulary v
WHERE v.user_id = :'qa_uid'::uuid AND v.word_text NOT LIKE :'qa_prefix';
SELECT count(*) n_ctx, md5(string_agg(to_jsonb(c)::text, E'\n' ORDER BY c.id)) ctx_fp
FROM public.vocabulary_contexts c JOIN public.user_vocabulary v ON v.id = c.vocabulary_id
WHERE c.user_id = :'qa_uid'::uuid AND v.word_text NOT LIKE :'qa_prefix';
```
기대: QA 전후 `n_*`와 `*_fp`가 **같다**. 다르면 열 단위로 나눠 원인을 찾는다. 찾을 때도 값은 출력하지 않고 열마다 md5만 비교한다.

### Q7 프로필 스트릭/프리즈 (보고에는 차이만)
```sql
SELECT md5(concat_ws('|', streak_count, last_streak_date, streak_freeze_count)) triple_fp,
       streak_count, last_streak_date, streak_freeze_count,
       to_char(last_login_at AT TIME ZONE 'Asia/Seoul','MM-DD HH24:MI') last_login_kst,
       md5((to_jsonb(p) - 'streak_count' - 'last_streak_date' - 'streak_freeze_count' - 'last_login_at')::text) other_fp
FROM public.profiles p WHERE p.id = :'qa_uid'::uuid;
```
기대: `other_fp`는 언제나 같다(관련 없는 프로필 필드를 건드리지 않는다). 3필드는 §1·§2에 적은 활동일 규칙대로만 바뀐다. `last_login_kst`는 명시적 로그인 때만 바뀐다.

### Q8 개인 FSRS 카드 보존 지문
```sql
WITH s AS (SELECT public.fsrs_vocabulary_snapshot(p_actor => :'qa_uid'::uuid)::jsonb AS j),
r AS (SELECT e FROM s, jsonb_array_elements(j->'rows') e WHERE e->>'word_text' NOT LIKE :'qa_prefix'),
g AS (SELECT e FROM s, jsonb_array_elements(j->'registry') e WHERE (e->>'enrolled')::boolean)
SELECT count(*) n_fsrs_personal,
       md5(string_agg(concat_ws('|', g.e->>'cardId', g.e->'card'::text, g.e->>'firstQuestionAt', g.e->'attempt'::text), E'\n' ORDER BY g.e->>'cardId')) fsrs_fp
FROM r JOIN g ON g.e->>'cardId' = r.e->>'id';
```
기대: QA 전후 같다. 개인 카드가 만기에 도달하는 것은 지문을 바꾸지 않는다(시각에 따라 변하는 필드가 아니다). 시각 때문에 바뀌는 필드가 있으면 그 필드를 빼고 다시 비교하고, 그 필드를 기록한다.

### Q9 QA 기간 `review_events` (원문·detail 제외)
```sql
SELECT (item_key LIKE :'qa_prefix') is_qa, source, correct, (detail ? 'undo_of') is_undo,
       to_char(created_at AT TIME ZONE 'Asia/Seoul','MM-DD HH24') hour_kst, count(*)
FROM public.review_events
WHERE user_id = :'qa_uid'::uuid AND created_at >= :'qa_start'::timestamptz
GROUP BY 1,2,3,4,5 ORDER BY 5,1;
```
기대: `is_qa=false`는 **0행**. F형 평가가 `review_events`를 만드는지 여부는 관찰값으로 기록한다(019 문서의 "오늘의 출력 단어"는 review event를 근거로 삼는다. §6 A10).

### Q10 활동 영수증 (Q1로 이름을 채운다)
```sql
-- 예: <activity_table>(user_id, operation_id, effective_at, activity_day, created_at …)
SELECT activity_day, count(*) n, count(DISTINCT operation_id) n_ops,
       to_char(min(effective_at) AT TIME ZONE 'Asia/Seoul','MM-DD HH24:MI:SS') first_eff_kst,
       to_char(max(created_at) AT TIME ZONE 'Asia/Seoul','MM-DD HH24:MI:SS') last_ins_kst
FROM public.<activity_table>
WHERE user_id = :'qa_uid'::uuid AND created_at >= :'qa_start'::timestamptz
GROUP BY 1 ORDER BY 1;
-- 중복 검출: 0행이어야 한다
SELECT left(md5(operation_id::text),8), count(*) FROM public.<activity_table>
WHERE user_id = :'qa_uid'::uuid GROUP BY 1 HAVING count(*) > 1;
-- baseline 1행 확인(존재·시각만)
```
기대: `n = n_ops` = QA 기간에 반영된 F형 grade 수(undo 포함 여부는 계약에서 확인). `activity_day = (effective_at AT TIME ZONE 'UTC')::date`.

### Q11 첫 노출/승인 영수증 (Q1로 이름을 채운다)
```sql
SELECT learning_day, kind /* fsrs|legacy */, count(*) n, count(DISTINCT card_id) n_cards,
       count(*) FILTER (WHERE consumed) n_consumed
FROM public.<admission_receipt_table>
WHERE user_id = :'qa_uid'::uuid AND created_at >= :'qa_start'::timestamptz
GROUP BY 1,2 ORDER BY 1,2;
-- 같은 학습일에 같은 카드가 두 번 차감되었는지: 0행이어야 한다
SELECT learning_day, left(md5(card_id::text),8), count(*) FROM public.<admission_receipt_table>
WHERE user_id = :'qa_uid'::uuid AND consumed GROUP BY 1,2 HAVING count(*) > 1;
```
기대: 학습일마다 `n_consumed`의 합이 Q3의 `used`와 같다.

---

## 4. 실패 신호표

| 실패 신호 | 의미 | 다음 행동 |
|---|---|---|
| 문제 단어가 승인 영수증이나 첫 질문 영수증보다 먼저 화면에 나온다(Q3 `used` 그대로인데 단어가 보인다) | 노출 전 영수증 계약 위반. 한도 우회가 가능하다 | 중단. 화면·시각을 기록. 020 롤백(신규 노출 중지) 검토 요청 |
| 정답 확인 전에 뜻·4버튼이 보이거나, Offline에서 정답 확인이 성공한다 | reveal 영수증 우회 | 중단. 재현 절차를 기록 |
| `used ≠ fsrsUsed+legacyUsed` 또는 `remaining ≠ 15−used` | 서버 상태가 서로 맞지 않는다 | 이 상태는 앱에서 거절되므로 화면은 "준비 중"/오류가 된다. SQL 결과만 보존하고 추가 조작을 멈춘다 |
| 16번째 신규가 출제된다(`used`>15) | 한도 경합 결함 | 중단. 탭 수·시각·operationId 해시를 기록. 020 롤백 검토 |
| 재시도·연타·유실 뒤 grade 2건, 활동 영수증 2건, `revision`이 +2 | 멱등 실패 | Q10 중복 쿼리 결과를 보존. 같은 사례를 다시 실행하지 않는다 |
| 응답 유실 뒤 다른 카드가 추가로 차감된다 | 의도 재사용 실패 | IndexedDB intentions 상태(status만)를 스크린숏. 결함 등록 |
| 04:00 이후에도 `learningDay`가 바뀌지 않거나 `remaining`이 복구되지 않는다 | 경계 계산이나 갱신 실패 | focus 후 Q3로 서버와 화면을 구분. 서버도 그렇다면 DB 결함, 화면만이면 타이머/갱신 결함 |
| B4.5에서 전날 승인한 L형이 재차감된다 | 문서("이미 도입한 카드는 재소모 없음")와 구현이 갈린다 | 판정 보류. §6 A6으로 계약 결정을 요청 |
| 활동일이 revealedAt이 아니라 도착 시각 기준이다(B3.2·B4.7) | 활동 시각 계약 위반 | 결함. 스트릭 재계산은 하지 않는다 |
| undo 뒤 스트릭·`last_streak_date`가 되돌아간다, 또는 `used`가 환급된다 | 문서 계약("실제 학습일 유지", "노출 비환급") 위반 | 결함 기록 |
| undo 뒤 기억/due가 평가 전 값과 다르다 | 보상 연산이 정확하지 않다 | Q5 전후 값을 보존. 결함 |
| Q6/Q8 지문이 바뀐다, Q9 `is_qa=false`가 1행 이상이다 | 개인 항목이 바뀌었거나 평가되었다 | **즉시 중단.** 어느 단계 뒤인지 좁힌다. 복구는 별도 승인 범위(덮어쓰기 금지) |
| Q7 `other_fp`가 바뀐다, 또는 새로고침만으로 `last_login_at`·스트릭이 바뀐다 | 읽기 전용 프로필 갱신 계약 위반 | 결함. 토큰 갱신과 명시적 로그인을 구분해 재현 |
| L형 평가 뒤 스트릭이 그 UTC 날짜에 처음 학습했는데도 바뀌지 않는다 | `update_streak` EXECUTE 축소로 레거시 경로가 조용히 실패했을 수 있다(§6 A3) | Q2 `auth_x`를 확인. 읽기 완료·문법 등 다른 경로도 영향이 있는지 기록. 결함 후보 |
| 계정 B 화면에 A의 단어·수치가 나오거나, A의 pending이 B로 전송된다 | 계정 격리 실패. 보안 수준 | 즉시 중단. 개인정보 노출 여부 확인. 롤백 검토 |
| 한도 소진·정책 충돌인데 "복습 저장 실패 — 연결을 확인해주세요"가 나온다 | 데이터는 정상이지만 문구가 틀렸다(§6 A5) | 사용성 결함으로 기록. 데이터 축 판정과 분리 |
| Q3·Q4 RPC가 읽기 전용 트랜잭션에서 쓰기 오류를 낸다 | "GET은 쓰지 않는다" 계약과 다르다 | 미확인으로 남기고 보고. 읽기 전용을 풀지 않는다 |
| `fsrs_storage_unavailable`/`fsrs_admission_unavailable`이 계속된다 | 계약 지문 불일치 또는 설치 손상(fail-closed) | 재시도하지 않는다. Q2 `body_md5`를 사후 해시 4/4와 대조 |

---

## 5. 보존 확인 항목

| 항목 | 확인 방법 | 기대 |
|---|---|---|
| 개인 항목의 뜻·기본형·언어·출처 자료 ID·생성 시각 | Q6 `vocab_fp` 전후 비교 | 같음 |
| 개인 출처 인용·번역·위치 | Q6 `ctx_fp` 전후 비교 | 같음 |
| 개인 레거시 일정(`interval`·`ease_factor`·`repetitions`·`next_review_at`·`last_reviewed_at`) | Q6에 포함 | 같음 |
| 개인 FSRS 기억·attempt·첫 질문 시각 | Q8 | 같음 |
| 개인 평가 기록 | Q9 `is_qa=false` 0행. 기존 행 수는 QA 이전 구간 `count(*)`를 전후 비교 | 새 행 0, 기존 행 수 같음 |
| QA F형의 레거시 열 | Q5 `l_interval=0`, `l_reps=0`, `l_unreviewed=true`. FSRS 평가 뒤에도 그대로 | 레거시 열에 FSRS 투영을 덮어쓰지 않는다 |
| 중복 저장 | 같은 `qa-b1007-01`을 다른 뜻으로 다시 저장 | 원래 뜻·일정 유지, 행 추가 없음(M09가 10-05에 확인. 경계 이후 1회만 다시 확인) |
| 스트릭/프리즈 3필드 | Q7 | 활동일 규칙에 따라서만 바뀐다. 같은 UTC 날짜에서는 바뀌지 않는다. 7의 배수가 되면 프리즈 +1(최대 2). undo로 되돌아가지 않는다 |
| 관련 없는 프로필 필드 | Q7 `other_fp` | 같음 |
| 설정 | 한도 `limit=15`. B2.4를 했다면 `policyRevision`=시작값+2 | 15로 복원됨 |
| QA 항목 후처리 | QA 항목은 지우지 않는다(영수증은 불변이다. 삭제는 이 승인 범위 밖이다). 필요하면 앱의 "제외" 기능만 쓰고, 그 결과도 Q5로 기록 | 개인 항목 영향 0 |

---

## 6. 계약이 모호하거나 서로 어긋나는 곳

- **A1 SQL 정본이 저장소에 없다.** `supabase/migrations`의 최신 파일은 `20260930154448`이다. 마이그레이션 `20261005132141`/`20261005132233`의 본문은 외부 증거 경로(`/workspace/cloud-services/...`)와 이슈 코멘트의 SHA256에만 있다. 그래서 테이블과 열 이름(Q10·Q11)은 Q1로 찾아야 하고, 이 검수표는 RPC 출력 계약을 기준으로 삼았다. 계약 테스트로 고정하려면 SQL 정본이 저장소에 있어야 한다.
- **A2 학습일 기준이 다섯 가지다.** ① 신규 예산 = KST 04:00, ② 활동/스트릭 = UTC 자정(= **KST 09:00**, `learningActivity.js`), ③ 성장 통계 = KST 자정, ④ 레거시 "미루기" = 브라우저 로컬 자정(`VocabPage.jsx handleSkip`), ⑤ 옛 localStorage 예산 = UTC. 사용자는 "04:00에 하루가 바뀐다"고 보지만, 스트릭은 09:00에 바뀐다. 문서상 의도된 분리이지만 사용자 화면에서 설명하지 않는다.
- **A3 `update_streak`의 EXECUTE를 축소했다는 보고 vs 클라이언트 호출.** M09는 "update_streak wrapper 변경과 EXECUTE 축소"가 의도한 변경이라고 보고했다. 그런데 `src/lib/streak.js`는 여전히 인증 사용자 권한으로 `supabase.rpc('update_streak', { uid })`를 부르고, 이 함수를 Viewer·GrammarReview·StudySession·WritingStudio·useReadingCompletion·progressStore(레거시 단어 채점)가 쓴다. `authenticated`의 EXECUTE가 회수되었다면 이 경로들은 **오류 표시 없이** `false`를 반환하고 스트릭을 올리지 못한다. Q2 `auth_x`와 S2.2로 확인한다.
- **A4 baseline 재생과 레거시 쓰기의 공존.** 활동 adapter는 "baseline 이후 영수증 일자만 순서대로 재생"한다. 이 재생이 baseline에서 매번 다시 계산하는 방식이라면, 영수증 없이 `update_streak`으로만 올라간 레거시 학습일이 FSRS 평가 때 덮일 수 있다. 증분 방식이라면 문제가 없다. 이 방식은 저장소에 없는 SQL에 달려 있다. 검수 사례: UTC 날짜 X에는 L형만 평가하고, X+1에는 F형만 평가한 뒤 스트릭이 +2인지 본다(이틀이 필요하다).
- **A5 오류 문구가 하나로 뭉쳐 있다.** `VocabReview.jsx:147`과 `FsrsReviewSession.jsx`는 한도 소진(409 `fsrs_new_budget_exhausted`), 정책 충돌, admission 대기, 실제 네트워크 오류를 모두 "복습 저장 실패 — 연결을 확인해주세요. 이 단어는 다음에 다시 나와요."로 보여 준다. 소진은 연결 문제가 아니므로 사용자가 잘못 이해한다. 사용성 결함 후보다(데이터 결함은 아니다).
- **A6 레거시 카드가 학습일을 넘겨 다시 출제될 때 차감하는지.** 020 문서는 "이미 도입한 New 카드는 다시 소모하지 않고 재개"라고 쓴다. 그런데 `admittedLegacyCardIds`가 오늘 것만인지 누적인지는 문서에 없다. `VocabPage`는 이 목록으로 "재개분"을 세므로, 범위가 오늘뿐이면 D−1에 승인한 L형이 D 화면의 예상 수에서 신규로 세어질 수 있다(B4.5).
- **A7 레거시 undo 주석.** `VocabPage.jsx`의 "세션 되감기 — … 신규 한도 복원" 주석은 호환 모드에서만 맞다. 활성 상태에서는 서버 영수증을 환급하지 않는다(020 문서와 일치). 주석 때문에 잘못 읽을 수 있다.
- **A8 "공통" 한도의 범위.** M09 보고는 "공통 새 단어 한도 15"이고, `learning_configure_admission`은 `p_actor`를 받는다. 계정별 정책 행인지, 전역 기본값에 계정별 덮어쓰기를 더한 것인지 저장소에서 확인할 수 없다. 전역이라면 B2.4(한도 변경)는 모든 사용자의 한도를 바꾼다. **Q1·Q2로 계정별임을 확인하기 전에는 B2.4를 하지 않는다.**
- **A9 기본값 결합.** `parseFsrsRequest`는 `dailyNewLimit`이 없으면 `DEFAULT_NEW_PER_DAY=15`로 채운 뒤 `admission.limit`과 같은지 요구한다. 지금 클라이언트는 이 값을 늘 보내므로 영향이 없다. 다만 한도가 15가 아닌 계정에서 이 필드를 생략한 요청은 정책 충돌로 거절된다.
- **A10 FSRS 평가와 `review_events`의 관계.** 019 문서는 "오늘의 출력 단어"를 "eligible·undo를 거른 review event"에서 고른다고 쓴다. 그런데 FSRS grade가 `review_events`를 만드는지는 저장소 코드에 보이지 않는다(SQL 안에 있을 수 있다). Q9에서 관찰값으로 기록하고 계약 결정을 요청한다.
- **A11 FSRS undo는 단일 단계이고 메모리에만 있다.** 새로고침하거나 같은 카드가 다시 출제되면(`question()`이 `lastGrade`를 지운다) undo를 할 수 없다. 레거시 undo도 단일 단계다. 문서의 "undo는 보상한다"는 서버 계약이고, 사용자가 언제 undo를 쓸 수 있는지는 정의되어 있지 않다.
- **A12 활성 이전에 정답을 확인한 attempt.** "에포크 이전의 reveal은 이력으로 남는다"(활동 없음). FSRS 코어는 10-05 22:21 KST쯤 켜졌고 admission은 10-06 04:00에 켜졌다. 그 사이에는 미노출 New 카드가 큐에서 빠지므로 해당 attempt가 있을 가능성은 낮다. 그래도 Q5에 `revealedAt < 10-06 04:00`인 QA attempt가 있으면, 그 평가에 활동 영수증이 없는 것은 정상이다.

---

## 7. 완료 판정 기준

### 7.1 "경계 이후 검수 완료"로 쓰려면 아래가 모두 실제로 관찰되어야 한다
1. P1~P8 충족. 특히 정상 계정에 실제로 로그인했고, P4 격리를 확인했다.
2. S1(F형) 첫 질문 → 정답 확인 → 평가와 S2(L형) 승인 → 평가가 각각 1회 이상 성공했다. 화면과 SQL(Q3·Q5·Q10·Q11)이 서로 맞는다.
3. B1 소진: `used`가 15에서 멈췄고, 16번째 신규 출제가 0건이다. 소진 뒤에도 이미 노출한 카드는 계속 복습된다. 두 탭 경합(B1.4)을 1회 확인했다.
4. B2 멱등: 연타(B2.1)와 두 탭(B2.2)에서 반영 1건·활동 1건.
5. B6.2·B6.4·B6.5: 오프라인 평가, 응답 유실(평가), 응답 유실(첫 질문)에서 반영과 차감이 각각 정확히 1회.
6. B5.1·B5.5: undo가 복원하고, 환급하지 않고, 학습일을 유지한다.
7. B7.1~B7.3: 계정 격리. 합성 계정을 썼다면 그 사실을 적는다.
8. **B4.1~B4.5를 실제 04:00 KST 전후에 수행했다**(예약이나 격리 테스트로 대신할 수 없다).
9. §5 보존 항목 전체 통과(Q6·Q8 지문이 같고, Q9 개인 행 0, Q7 `other_fp`가 같고, 한도 15로 복원).
10. §4 실패 신호 0건. 또는 사용성 결함(A5 같은 것)만 있다면 데이터·보존·신뢰성 축의 통과와 **따로** 보고했다.

### 7.2 "부분 완료"로만 쓸 수 있는 경우
- B4(04:00) 또는 B4.7(09:00)을 실제로 수행하지 않았다 → "경계 시각 검수 미완료"로 명시하고 다음 실행 시각을 정한다.
- A3·A4가 미확인이다 → 레거시 경로의 스트릭은 "미확인"으로 둔다.
- B2.4를 A8 때문에 건너뛰었다 → "한도 변경 CAS는 실계정에서 미확인"으로 둔다.

### 7.3 이 검수로 대신할 수 없는 것 (별도 증거가 필요하다)
- 프리즈 소모(하루 건너뛰기)와 7일 적립은 실제로 여러 날이 지나야 관찰할 수 있다. D/D+1 연속도 이틀이 필요하다(A4 사례 포함).
- 다른 물리 기기·다른 브라우저 사이의 동시성. 다중 사용자 부하와 잠금 비용(multi-backend).
- 모든 오프라인 조합 인증(위 B6 표본으로 일반화하지 않는다).
- M09-KO-DB-003 한국어 운영 저장 게이트. 간체·대만 번체 설명의 의미 품질.
- 자동 Git 배포 실패(Next/font)의 원인 해소.
- 020 롤백·018 전체 중지의 운영 실연(이번 범위가 아니다. 필요하면 별도 결정).
- 합성 계정·PGlite·Preview 결과·10-05 사전 검수를 경계 이후 정상 계정 검수로 계산하는 것.

### 7.4 보고 형식(권장)
- 단계마다 KST 시각, 결과(통과/실패/미수행), 스크린숏 번호, SQL 결과 요약(차이·불리언·카운트만).
- 개인 식별값·이메일·카드 원 ID·학습 원문·스트릭 절대값은 쓰지 않는다. "변화 없음 / +1 / 기대와 일치"로만 쓴다.
- 축(의미/보존/사용성/신뢰성/배포)마다 판정을 따로 쓰고, 미완료·미확인과 다음 담당을 끝에 적는다.
