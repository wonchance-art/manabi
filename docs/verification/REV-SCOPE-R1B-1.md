# REV-SCOPE-R1B-1 보고 — 복습 세션 · 카드 (코드만, DB 무접촉)

브랜치 `claude/rev-scope-r1b` · 기준 `origin/main` 39bb5905(#1447 R1-A · #1448 AK 포함) · 기능 커밋 5575c789(48 files changed, 2529 insertions(+), 682 deletions(-)) + 보드 1 + 이 기록 1 · PR 없음 · 스키마/DB/환경 변수 변경 없음.
범위: 인계 §R1-B-1(오너 REV-SCOPE 3판 D1–D15 「권장대로 승인」 10-10 · 「넘겨」 10-11). **R1-B-2(학습 단계 anki-v2 · FSRS SQL)는 하지 않았다** — `fsrsScheduler` 정책값 · step plan · SQL 무변경, 학습 단계는 지금 정책(anki-seconds-v1: 30초 · 10분)을 그대로 따른다.

(1절 목업은 구현 전에 적었다)

## 1. 텍스트 목업 (구현 전 기록 — 2026-10-13 KST)

### 1-1. 복습방 「이 범위에서 오늘」 카드

전 (main, R1-A):
```
이 범위에서 오늘                                   01 / RECALL
오늘 다시 볼 표현
58 개의 표현
복습 50 · 새 표현 8
[표현 58개 복습 →]                    ← FSRS 카드가 하나라도 있으면 FSRS만 세고 시작
새 표현 · 오늘 10개 더(일본어 · 중국어 합쳐서)
예전 일정 표현 12개는 이 복습을 마친 뒤 이어서 나와요.
멈춘 복습 이어가기 · 3 / 20 →          ← 메모리에만 — 새로고침하면 사라짐
```

후 (R1-B-1):
```
이 범위에서 오늘                                   01 / RECALL
오늘 다시 볼 표현
58 개의 표현
복습 50 · 새 표현 8                    ← 두 엔진 합, 숫자 = 줄 길이(countReviewScope)
세션 길이  [5분 · 약 20개●] [50개] [전부 58]   ← 58 > 20일 때만. 서로 다른 카드 수
[표현 20개 복습 →]  [집중 연습]          ← 버튼 숫자 = 시작하는 줄 길이(길이 칩 적용)
새 표현 · 오늘 10개 더(일본어 · 중국어 합쳐서)
(밀린 복습) 밀린 복습부터 — 잊기 쉬운 순서로. 오늘은 새 표현을 쉬어요(밀린 복습 46 · 하루 평균 12).
(한도 막힘) 이 범위 새 표현 12개 · 오늘 시작 5개(새 표현 한도) · 나머지 7개는 내일 [지금 집중 연습으로 보기]
(뜻 없음) 뜻이 없는 표현 3개는 복습에서 빠져요. [뜻 채우기]       ← 누르면 목록(전체 보기) · 뜻 없는 표현에 「뜻 채우기」
(집중 연습 보조 안내) 복습 58개 먼저 하면 일정에 반영돼요.
멈춘 복습 이어 하기 (7 / 20) →          ← 세션 저장소(새로고침 · 24시간)
```
0개: 「이 범위엔 오늘 복습할 표현이 없어요 · HSK 2를 빼면 12개」 [급수 풀기] [집중 연습]

### 1-2. 복습 카드 (두 엔진 공통 규격) — 390px

앞면:
```
← 나가기   ▓▓▓░░░░░░  3 / 18          [🔈]  [↶]     ← 🔈/🔇 소리(기기별 기억) · 44px
┌────────────────────────────┐
│ 복습 · 단어                  │
│           早餐              │                  ← 읽기 · 뜻 없음
│  [정답 확인하기 · Space]      │
└────────────────────────────┘
[다시][어려움][알맞음][쉬움]   ← 하단 고정, 뒷면 전엔 잠김(disabled)
```
뒷면:
```
│ 복습 · 단어                  │
│     早餐   (일본어는 漢字 위 후리가나 ruby)
│   아침 식사                  │
│   zǎo cān   [▷ 듣기]         │   ← 음성 불가면 ▷ 숨김 · 영어/프랑스어는 읽기 줄 없이 ▷만
│   北京的早餐 · 원문 보기 ↗     │   ← 출처 없으면 숨김(기존 VocabularyContexts)
│ 뜻이나 발음 중 하나라도 막혔다면 다시 │   ← 판정 대상 아님/읽기 없음: 「뜻을 못 떠올렸다면 다시」
│ [아는 단어]   [스킵 →](예전 일정만) │
[다시 30s][어려움][알맞음][쉬움]   ← 펼친 뒤 0.3초 입력 무시
(아는 단어 누름) 아는 단어로 옮겼어요 [되돌리기]
```

### 1-3. 처음 보는 표현 카드 (새 표현 첫 등장 — 채점 없음)
```
┌────────────────────────────┐
│ 처음 보는 표현                │
│           早餐              │
│   아침 식사                  │
│   zǎo cān   [▷ 듣기]         │
│   北京的早餐 · 원문 보기 ↗     │
│ [다음 →]                     │
│ 잠시 뒤 다시 물어볼게요         │
└────────────────────────────┘
```
→ 3장 뒤 같은 표현을 채점 카드로 다시 묻는다(FSRS = 첫 질문 · 학습 단계 30초/10분 그대로, 예전 일정 = 세션 내 재질문 · 첫 채점부터 일정 반영).

### 1-4. 집중 연습
```
← 나가기   ▓▓▓▓▓░░░  7 / 42
집중 연습 · 일정은 바뀌지 않아요
방식  [스스로 확인●] [뜻 쓰기] [듣고 고르기]     ← 기존 타이핑 · 리스닝 모드가 여기로
┌────────────────────────────┐
│ 집중 연습 · 7 / 42            │
│           早餐              │
│  [뜻 보기 · Space]            │
│  (펼친 뒤) 아침 식사 · zǎo cān  │
│  [몰랐어요]  [알았어요]         │
└────────────────────────────┘
```
끝: 「집중 연습 42개 · 몰랐어요 9」 「일정은 바뀌지 않았어요. 「몰랐어요」 표현은 「흐릿 · 위험」 범위에 나와요.」 [흐릿 · 위험 보기] [목록으로]

### 1-5. 끝 화면
전: 「이번 표현 복습을 마쳤어요」 · 복습한 표현 / 숙련 표현 / 전체 표현 · 7일 일정 · [새 자료 읽기][교재 둘러보기]
후:
```
중국어 · HSK 2 · 내 서재 자료
오늘 몫 끝                         (길이 칩으로 잘랐으면 「20개 끝 · 오늘 몫 38개 남음」 [이어서 38개])
18개 · 다시 4
「다시」 4개는 잠시 뒤 다시 나와요      ← FSRS 학습 단계 카드가 남았을 때만, [잠시 뒤 이어 하기](시각 표시)
[읽던 자료로 돌아가기]  [범위 밖 중국어 22개 이어서]
익숙 표현 N (21일 이상) · 앞으로 7일 복습 일정
[목록으로]
```
(「전체 복습 끝」이라고 하지 않는다 — 기존 계약 유지)

> 구현 후 실제 화면(로컬 프로덕션 빌드 + 합성 fixture, e2e `learning-flow-clarity` R1-B 시나리오): 방 · 앞면 · 뒷면 · 처음 보는 표현 · 끝 · 집중 연습 390px, 뒷면 · 끝 · 집중 연습 1440px — 가로 넘침 0(`scrollWidth ≤ innerWidth + 1`).
> 목업과 다른 점(결정): ① 시작 버튼 라벨은 목업 「복습 시작 →」 대신 기존 「표현 N개 복습 →」 유지(보이는 개수 = 시작 줄 길이를 버튼이 말한다 · 기존 e2e 계약). ② 뒷면 보기 단추는 「정답 확인하기」 유지 + 「· Space」 안내(aria-hidden — 접근 이름은 그대로). ③ 끝 화면에 7일 일정 · 익숙 표현 수는 남겼다.

## 2. 구현 요약

| 항목 | 구현 | 위치 |
|---|---|---|
| 두 엔진 한 줄 | `countReviewScope`가 FSRS · 예전 일정 카드를 `orderReviewQueue`로 한 줄(`queue.items`)로 만든다. 「FSRS 카드가 있으면 세션 전체 FSRS」(`setTab('fsrs')`) 삭제. 채점은 카드마다 원래 경로(예전 일정 = `handleScore` → `recordReviewCompleted`, 새 일정 = FSRS controller `question(cardId)` · `reveal` · `grade`) | `reviewScope.js` · `reviewQueue.js` · `VocabPage.jsx` · `useFsrsReview.js`(`question(cardId)`) · `FsrsReviewSession.jsx`(embedded) |
| 순서 · 끼우기 · 띄우기 | 기한 지난 복습 = 지금 기억 확률 낮은 순(두 엔진 모두 snapshot `vocabularyRetrievability` — forecast.js 방식), FSRS 학습 · 재학습 단계 카드는 앞. 새 표현은 복습 3장마다 1장. 같은 출처 단위(교재 과 `chapter_slug` · 자료 `source_material_id` · 덱 `source_ref`)의 새 표현끼리 4장 이상 | `reviewQueue.orderReviewQueue` · 교재 범위 조회가 단어별 과를 함께 준다(`/api/learning/book-review?scope=1` → `chapters`) |
| 처음 보는 표현 | 아직 시작 안 한 새 표현의 첫 등장 = 채점 없는 카드(「처음 보는 표현」 · 「다음 →」 · 「잠시 뒤 다시 물어볼게요」). 넘기면 3장 뒤 채점 단계: FSRS = 첫 질문(학습 단계 30초 · 10분 그대로, 단계가 오면 지금 카드 뒤에 다시 끼움), 예전 일정 = 세션 내 재질문(줄 메타데이터만, 일정 저장 없음 — 그 첫 채점부터 일정 반영). 예전 일정 처음 보는 표현은 입장권(admission)으로 한도 1을 쓴다(증거 모델 §2-1) | `reviewQueue.initialSteps · insertAfterIntro · insertLearningStep` · `ReviewCardParts.ReviewIntroCard` |
| 카드 앞뒤 | 앞면 = 글자만(읽기 · 뜻 · 소리 없음), 뒷면 = 뜻 + 읽기(일본어 한자어 = 한자 위 후리가나 ruby, 중국어 = 병음, 영어 · 프랑스어 = 발음 표기 작게) + ▷ 듣기 + 원문(출처 없으면 없음). 버튼은 넷뿐. 문구 「뜻이나 발음 중 하나라도 막혔다면 다시」 / 판정 대상 아님 · 읽기 없음 「뜻을 못 떠올렸다면 다시」. 두 엔진 같은 규격(FSRS 화면에도 듣기) | `reviewCard.js` · `ReviewCardParts.jsx` · `VocabReview.jsx` · `FsrsReviewSession.jsx` |
| 채점 막대 | 화면 최하단 고정(fixed — M09 6158372690 판정 뒤 sticky에서 바꿈), 뒷면 전 잠금(disabled), 펼친 뒤 0.3초 입력 무시(버튼 · 키 1–4) | `useScoreArmed` · `.review-grade-bar` |
| 소리 | 세션 시작 단추에서 오디오 열기(무음 재생 — iOS), 다음 카드 소리 미리 받기(서버 음성 캐시), 🔈/🔇 기기별 기억, 자동 재생은 포인터 · 단축키로 펼칠 때만(보조기술 · 키보드 활성화 = click detail 0 → 자동 재생 안 함, 뜻 · 읽기는 aria-live 글), 음성 불가면 ▷ 숨김 | `useTTS.prefetchSpeech · unlockSpeechAudio` · `reviewCard.shouldAutoplay` |
| 아는 단어 | 카드의 「아는 단어」 → 바로 빼고 하단 「아는 단어로 옮겼어요 [되돌리기]」(8초) — 기존 `useKnownWords` 표시 · 해제 경로 | `VocabPage.markKnownInSession` |
| 세션 길이 | 「5분 · 약 20개 · 50개 · 전부 N」 = 서로 다른 카드 수(20개 초과일 때만), 줄 앞에서 자름. 버튼 숫자 = 시작 줄 길이. 진행 n / N도 서로 다른 카드(처음 보는 표현 · 재질문 · 「다시」 재노출 · 학습 단계 제외) | `sessionLengthOptions · sliceSession · stepProgress` |
| 이어 하기 | 세션 저장소 `vocab_review_resume:<계정>` = `{scopeKey, cardIds, index, startedAt}`(cardIds = [끝낸 …, 남은 …], index = 끝낸 수). 다시 열 때 다른 곳에서 채점된 카드(마지막 채점 > startedAt) · 복습 불가 카드는 건너뛰고 24시간 지나면 버림. 「멈춘 복습 이어 하기 (n / N)」. 메모리 이어 하기를 대체 | `readResume · writeResume · restoreResume` |
| 밀린 복습 | 그 언어 전체의 기한 지난 복습 > 기준 × 2면 그 언어 새 표현 0(계정 한도 차감 없음) · 「밀린 복습부터 — 잊기 쉬운 순서로. 오늘은 새 표현을 쉬어요(밀린 복습 N · 하루 평균 M).」 기준 = 지난 14일 하루 평균(아래 결정 3) | `backlogBaseline · isBacklogged` · `countReviewScope.backlog` |
| 집중 연습 | 범위 안 표현 전체(기한 무관, 새 표현만 · 흐릿 범위는 그 상태만, 잊기 쉬운 순). 갈래: 스스로 확인(몰랐어요 / 알았어요) · 뜻 쓰기 · 듣고 고르기(기존 타이핑 · 리스닝이 여기로 — 본 복습은 플래시뿐, 설정 서랍의 「단어 복습 방식」 삭제). FSRS · 예전 일정 · 새 표현 한도 호출 0회, 기록 = `review_events` `{source:'practice', item_key: 단어 id, detail:{qtype, scope, result}}`. 유형 큐(🎯) 처방도 집중 연습으로 연다 | `practiceEvents.js` · `VocabPage.startPractice · handlePractice` |
| 종류 | 읽을 때만 판별(저장 없음): 문장 = 표현이 담은 맥락 문장과 같음(예문 담기) 또는 。！？.!?로 끝남(닫는 따옴표 뒤 포함), 나머지 단어. 카드 머리 「복습 · 단어」, 범위 축 `type=word|sentence`(주소 · 시트 「종류」 · 칩) | `reviewCard.expressionKind` · `reviewScopeUrl` |
| 카드 단계(D15) | 신규 · 학습 · 익히는 중(간격 21일 미만) · 익숙(21일 이상) · 재학습. 간격 = 다음 예정일 − 마지막 복습일(일, 버림) — FSRS = scheduledDays, 예전 = next_review_at − last_reviewed_at(interval 칸 = 안정도는 안 씀). `wordStage` 대체, `deckStats`(범위 구성 줄) · 목록 점 · 상세 배지 · 현황 「익숙」 · 끝 화면 함께. `KNOWN_WORD_MIN_INTERVAL = 7` 그대로 | `growthStats.js` · `VocabPage` · `VocabList` · `VocabStats` · `index.css` |
| 끝 화면(§5-5) | 범위 이름 · 「오늘 몫 끝」(길이 칩으로 잘랐으면 「20개 끝 · 오늘 몫 N개 남음」 [이어서 N개]) · 「N개 · 다시 M」 · FSRS 학습 단계가 남으면 「「다시」 N개는 잠시 뒤 다시 나와요」 [잠시 뒤 이어 하기](다시 물을 때가 되면 켜짐) · [읽던 자료로 돌아가기](자료 하나 범위 · 교재는 기존) · [범위 밖 중국어 N개 이어서] · 「전체 복습 끝」 금지 유지 | `VocabReview.ReviewFinished` |
| 상태 12종(§5-6) | 0개(+[집중 연습]) · 못 읽음 · 한도 막힘(+[지금 집중 연습으로 보기]) · 밀린 복습 · 멈춤/새로고침 · 뜻 없는 표현(줄에서 빼고 「뜻이 없는 표현 N개는 복습에서 빠져요. [뜻 채우기]」 → 목록 「뜻 없는 표현만」 · 행 「뜻 채우기」 = 편집) · 출처 없는 표현(원문 보기 없음 — 기존) · 아는 단어 되돌리기 · 오프라인/저장 실패(미전송 안내 「연결되면 이어서 보낼게요.」) · 음성 불가(▷ 숨김) · 기존 모드(집중 연습 갈래, 문맥은 뒷면 원문으로 흡수) · 문법 별줄 「문법 N개 →」 | `ReviewScopeBar.ReviewScopeNotice` · `OfflineNotice` · `VocabList` · `VocabPage` |

## 3. 결정(애매했던 것)

1. **FSRS 새 표현의 처음 보는 표현 카드는 서버를 부르지 않는다**(노출은 회상이 아니다 — FSRS 계약). 한도는 3장 뒤 첫 질문에서 서버가 차감한다. 예전 일정은 입장권 경로가 카드마다 있어 처음 보는 표현에서 차감한다(같은 카드 재질문은 중복 입장권 — 추가 차감 없음).
2. **이미 시작한 새 표현**(오늘 입장권을 받은 예전 카드 · 첫 질문을 받은 FSRS 카드)은 처음 보는 표현 없이 바로 묻는다.
3. **밀린 복습 기준은 snapshot에서 잰다** — 지난 14일 안에 마지막 채점이 있는 카드 수 ÷ 14(두 엔진 공통). FSRS 채점은 `review_events`에 남지 않아 기록 표본으로는 두 엔진을 같이 셀 수 없고, 배움 칸(AK)도 같은 함수 · 같은 입력으로 같은 수를 내야 한다(원칙 3). 「14일 기록이 없으면 20」 = 지난 14일 채점이 없거나 그 언어의 가장 오래된 표현이 14일 미만. 카드당 1이라 실제 복습 수보다 작게 잡혀 기준이 엄격해질 수 있다 → 오너 확인 항목.
4. **밀린 복습이면 이미 시작한 새 표현도 0**(인계 「그 언어 새 표현 0」 문언). 막힌 수는 newLocked로 센다.
5. **흐릿 범위 + 연습 「몰랐어요」**: 복습(채점) 줄은 기한이 된 것만(기한 전 채점 = 일정 변경 → 집중 연습 몫, R1-A 결정 7 유지), 집중 연습은 기한 무관.
6. **헷갈린 표현 · 약점에 넣는 연습 기록**: 「몰랐어요」 = 오답, 정답이 정해진 문항 = 정오 그대로, 「알았어요」(자기 채점 성공)는 넣지 않는다(skillRung이 플래시 성공을 무시하는 것과 같은 이유). 유형 축(약점 프로파일)은 기존 허용 목록이라 self가 자연히 빠진다.
7. **연습 기록에 `detail.word_id`를 넣지 않는다** — M09 `fsrs_private.guard_legacy_event`가 word_id가 FSRS 카드면 source와 무관하게 막는다(PGlite로 확인, 아래 6절). 단어 id는 `item_key`에만.
8. **재대결(⚔ 헷갈린 말)은 그대로 채점 경로**(예전 일정 플래시) — 일정 반영 여부를 바꾸는 일이라 이번에 옮기지 않았다(오너 확인 항목). 유형 큐(🎯)는 타이핑 · 리스닝 처방이라 집중 연습으로 옮겼다.
9. **R1-A 계약 「보이는 개수 = 시작 줄 길이」**: 큰 숫자 = 범위의 오늘 몫(total = queue.items 길이), 버튼 숫자 = 길이 칩을 적용해 실제로 시작하는 줄 길이(sliceSession). 칩이 「전부」면 같다.
10. **자동 재생 판정**: 화면 읽기 프로그램을 직접 감지할 방법이 없어 click `detail === 0`(보조기술 · 키보드 활성화)이면 자동 재생하지 않는다. 단축키(Space)는 화면을 보는 키보드 사용자라 재생.
11. **예전 일정 카드 단계**: 분 단위 학습 단계가 없어 신규 · 익히는 중 · 익숙만 나온다(재학습 구분 불가).
12. **종류 판별의 「예문 담기」**: 맥락 표(vocabulary_contexts) 대신 행의 `source_sentence === word_text`로 본다(교재 예문 담기가 그렇게 저장 — 기존 `usableVocabReviewMode` 선례). 요약 snapshot(배움 칸)에는 source_sentence가 없지만 배움 칸은 종류 축을 쓰지 않는다.

## 4. 계약(설계 §8 R1-B 줄) — 되돌림 증거

새 계약: `reviewQueue.test.js`(17) · `reviewCard.test.js`(8) · `practiceEvents.test.js`(10) · `reviewSessionR1B.test.jsx`(15) · `reviewScope.test.js` R1-B 블록(+6) · `supabase/tests/practice-review-events.mjs`(로컬 PGlite).
아래는 대상 코드를 실제로 되돌려 돌린 결과(스크립트로 18건, 전부 실패 → 원복 확인).

| 계약 | 되돌린 것 | 실패한 테스트 |
|---|---|---|
| 두 엔진 한 줄(FSRS 독점 없음) | FSRS가 있으면 FSRS만 | reviewScope 「R1-B-1: … 한 줄」 · byLang · 「두 엔진이 한 줄」 |
| 순서 = 기억 확률 낮은 순 | 기억 확률 정렬 제거 | reviewQueue 「기억 확률이 낮은 순」 |
| 새 표현 복습 3장마다 | 끼우기 제거 | reviewQueue 「3장마다」 · 「끼우기 간격」 |
| 같은 출처 4장 띄우기 | 띄우기 무시 | reviewQueue 「4장 이상 띄운다」 · reviewScope 「같은 과(chapter_slug)」 |
| 새 표현 첫 등장 = 채점 없는 카드 | 처음 보는 표현 제거 | reviewQueue 「첫 등장은 채점 없는 카드」 |
| 밀린 복습 → 새 표현 0 | 규칙 끔 | reviewScope 「밀린 복습」 |
| 뜻 없는 표현 제외 | 포함 | reviewScope 「뜻 없는 표현」 |
| 연습 기록 형식(word_id 없음) | word_id 추가 | practiceEvents 「형식」(+ PGlite에서 `fsrs_legacy_event_blocked`) |
| 읽는 곳: 주간 리포트 제외 | isGradedReviewEvent에서 practice 제외 삭제 | practiceEvents 「isGradedReviewEvent」 |
| 읽는 곳: 숙련 사다리 포함(graded만) | 사다리가 연습 미독 | practiceEvents 「숙련 사다리」 |
| 읽는 곳: 헷갈린 표현 포함 | 매핑 제거 | practiceEvents 「헷갈린 표현」 |
| 집중 연습 일정 · 한도 0회 | 연습 핸들러에 recordReviewCompleted | reviewSessionR1B 「연습 경로는 … 부르지 않는다」 · 「실제 연습 핸들러」 |
| 앞면 읽기 없음 | 앞면에도 후리가나 | reviewSessionR1B 「앞면에는 읽기 · 뜻 · 소리가 없고」 |
| 발음 문구는 판정 대상만 | 항상 발음 문구 | reviewCard 「일본어 한자어 · 중국어만」 · reviewSessionR1B 「판정 대상이 아니면」 |
| 세션 길이 = 시작 줄 길이 | 버튼 = total | reviewScope 「복습방 숫자 · … countReviewScope」 |
| 이어 하기: 다른 곳 채점 건너뜀 | 건너뛰기 제거 | reviewQueue 「새로고침 뒤 … (n / N)」 |
| 카드 단계 21일 | 경계 30 | growthStats 「간격 21일」 · 「새 일정 카드는 상태」 |
| 채점 막대 잠금 | 잠금 없음 | reviewSessionR1B 「채점 막대는 … 잠겨 있다」 |

화면 흐름(e2e, CI 목록 안 `learning-flow-clarity`): 한 줄 시작 → 앞면(읽기 · 뜻 없음 · 잠금) → Space 뒷면(후리가나 えき · 발음 문구) → 채점 → 새로고침 「멈춘 복습 이어 하기 (1 / 3)」 → 처음 보는 표현 → 재질문 → 「오늘 몫 끝」 → 집중 연습 「몰랐어요」 = `review_events` practice 한 줄, `user_vocabulary` 쓰기 3회 그대로.

## 5. 바뀐 기존 계약(목적 유지, 단언만 갱신)

| 파일 | 전 | 후 |
|---|---|---|
| `growthStats.test.js`(단계) | 초기 · 학습 중(7, 아는 단어와 같은 상수) · 숙련(30), interval(안정도) 기준 | 신규 · 학습 · 익히는 중 · 익숙(21, 자기 상수) · 재학습, 간격(next − last / scheduledDays). 아는 단어 7은 분리 · 유지 단언 |
| `vocabularyLearningRead.test.js:33` | FSRS Review 카드 = `learning` | `young`(scheduledDays < 21) |
| `vocabularyLearningUi.test.jsx` 53–54 · 93 · 99 · 109 · 122행 | 「숙련」 · 「초기」 라벨, 끝 화면 「숙련 표현」 | 「학습」 · 「익히는 중」 · 「익숙 0」, 「익숙 표현(21일 이상)」(줄 수 동일 — **133행 무변경**) |
| `reviewScope.test.js` | R1-A 엔진 규칙(FSRS 독점 · deferred 4) · byLang 중국어 1 · 버튼 `session.total` · 시작 `startSession(session.queue.legacyIds…, { includeFsrs: true })` | 한 줄(engine mixed · deferred 0) · 중국어 5 · 버튼 `sessionCards.length`(sliceSession) · 시작 `startSession(null, { items: sessionCards })`. 픽스처 created_at을 14일 미만으로(밀린 복습 규칙과 범위 계약 분리 — 규칙 자체는 새 계약이 잡음) |
| `fsrsVocabIntegration.test.js` | 질문 화면에 채점 버튼 없음 · 소스에 `tab === 'fsrs'` | 채점 막대는 있으나 4개 모두 disabled · 뜻/읽기 없음 · `setTab('fsrs')` 없음 · 섞인 줄 안 `<FsrsReviewSession … embedded cardId={currentStep.id}` |
| `reviewUndo.test.js` | 재노출 `q[q.length - 1] === last.wordId` · `currentWord.id ? 'wrong'` · `handleScore(3)` · 키 효과 `tab !== 'review'` | 단계 객체 `q[q.length - 1]?.id` · `keyWord.id` · `score(3)`(본 복습/집중 연습) · `tab !== 'review' && tab !== 'practice'` |
| `reviewRoom.test.js` | 끝 화면 「이번 표현 복습을 마쳤어요」 · `if (!workspaceAlive.current) return;` | 「오늘 몫 끝」 · startSession 안 `|| !workspaceAlive.current) return;`(rung 조회 삭제로 await 뒤 가드가 한 곳) |
| `reviewReliabilityFixes.test.js` | `useState('auto')` reviewMode | `practiceMode` `useState('flash')` + `sessionLength` 마운트 복원 |
| `confusedQueue.test.js` | `.eq('source', 'vocab')` | `.in('source', ['vocab', 'practice'])`(14일 창 유지) |
| `weakDrill.test.js` | `setReviewMode(weakDrill.mode)` · `startSession(weakDrill.words…` | `startPractice(…, { mode: weakDrill.mode })` · `setPracticeMode(mode)` |
| `a11yAuditR1.test.js` | `aria-label="복습 방식"`(셀렉트) | `role="group" aria-label="연습 방식"` + `aria-pressed` |
| `undoneReviews.test.js` | VocabPage `dropUndoneEvents(data).slice().reverse()`(자동 모드 rung 조회) | 그 조회 삭제(본 복습 플래시뿐) — 남은 조회는 마커 붙인 헷갈린 표현 조회 |

e2e 갱신: `learning-flow`(처음 보는 표현 → 재질문 · 「뜻을 못 떠올렸다면 다시」), `korean-learning`(처음 보는 표현 · 「오늘 몫 끝」), `learning-flow-clarity`(R1-B 시나리오 추가), CI 밖 정적 갱신만: `review-room`(「문법 1개 →」 · 「멈춘 복습 이어 하기」 · 설정 서랍 라벨), `reading-loop`(방식 셀렉트 제거), `n5-review-return`(「오늘 몫 끝」).

## 6. `review_events` 읽는 곳 전수(§6-1 ⑤ 표) — 확인 결과

| 읽는 곳 | 연습 기록 | 근거 |
|---|---|---|
| 숙련 사다리 `skillRung.deriveVocabRungs`(오늘 학습 `studyMaterials`) | 포함 — choice · cloze · typing · listening만(item_key = 단어 id로 대조), self 제외 | `countsForSkillLadder` |
| 난이도 다이얼 EWMA(`studyMaterials`) | 포함 — 정답 정해진 문항만, self 제외(ui · dict 제외 유지) | `countsForDifficulty` |
| 헷갈린 표현 `confusedVocabWords`(복습방 재대결 · 유형 큐) | 포함 — 몰랐어요 · 오답(+정답 정해진 문항의 정답) | `practiceAsWeaknessEvents` · 복습방 조회 source vocab+practice |
| 주간 약점 세션 `buildWeaknessMaterials`(`studyMaterials`) | 포함 — 같은 매핑 | 〃 |
| 약점 프로파일(유형 축) `weaknessProfile`(현황 · 복습방 🎯 · `weaknessRows`) | 포함 — 기존 허용 목록이라 정답 정해진 문항만, self는 축 없음, 글자 축(glyph)은 source vocab만 | `errorTags.isWeaknessEvent` |
| 약한 문법 챕터 `weakChapterSet`(뷰어 · 오늘 학습) | 무관 — pattern 축은 grammar만 | |
| 흐릿 범위(state=fragile) | 포함 — 지난 14일 몰랐어요 · 오답 | `practiceFragileIds` → `countReviewScope.fragileIds` |
| 주간 리포트 `buildWeeklyReport`(현황 · 학습 그룹 · 오늘 학습 주간 회고) | 제외 | `isGradedReviewEvent`에 practice 제외 추가 |
| 산출 단어 `useOutputWords` · `outputWords` | 제외 | `isGradedReviewEvent` |
| 알림 시각 추정 `push.fetchRecentSessionTimes` | 제외 | `.neq('source', 'practice')` 추가 |
| 콜드스타트 `deriveColdStart`(오늘 학습) | 제외 | `isPracticeEvent` 필터 추가 |
| 워밍업 · 최근 출제 키(오늘 학습) | 제외 | source vocab만 읽음(기존) |
| 펫 `world/pet.js` | 제외 | source vocab만(기존) |
| 읽기 속도 `readingSpeedRows` | 제외 | source reading만(기존) |
| 푸시 하루 상한 `pushSend.hasSentToday` | 제외 | source ui · item_key '-'(기존) |
| undo 마커 `undoneReviewsRows` | 제외 | source ui · qtype undo(기존) |
| 드릴 지난 성적 `ChapterDrills` | 제외 | item_key ∈ 드릴 id(단어 UUID와 겹치지 않음) |
| 미전송 큐 중복 제거 · undo 보상 `reviewOutbox` | 무관 | source + item_key + 시각 대조 / source vocab 원본만 찾음 |
| 히트맵(현황) | 무관 | review_events가 아니라 담은 날짜(created_at) |
| `studyMetrics.js` | 무관 | 호출처 없음 |
| DB 함수(M09): `guard_legacy_event` · FSRS enroll 검사 · undo op | 무관 | detail.word_id · source vocab · ui undo만 봄 — 연습 기록은 word_id 없음(PGlite 확인) |
| DB `guard_excluded_review_event` | 무관 | source vocab만 |
| DB `guard_korean_learning_contract` | 한국어 기록은 Korean 저장 준비가 있어야 들어감(기존 규칙 그대로 — 복습방은 `reviewSupported`로 한국어 미지원 계정에서 연습 대상에서 뺌) | |
| **DB 관리자 지표 `admin_funnel` · `admin_daily_*` · `admin_v3_metrics` · `admin_content_health`** | **포함됨(제외 못 함)** — SQL이 source를 거르지 않거나(퍼널 · 일별 세션 수) `source <> 'ui'`만 거른다(콘텐츠 건강도에 단어 UUID item_key가 나올 수 있음) | DB 함수 변경 = 이번 범위 밖 → 7절 오너 확인 |

PGlite(로컬, `node supabase/tests/practice-review-events.mjs`): M09 fixture에서 FSRS 등록 카드 · 예전 일정 카드 각각 연습 기록 4종이 세 트리거를 통과(8행), 같은 기록에 `detail.word_id`(FSRS 카드)를 넣으면 `fsrs_legacy_event_blocked`. → 스키마 변경 없이 동작, word_id를 빼는 근거.

## 7. 검사 결과

- `npm test`(Node 24.21.0): **587 파일 · 6972 통과 · 실패 0**(첫 회 실패 1 = 이번 변경이 바꾼 계약 `undoneReviews.test.js` — 갱신).
- eslint 바뀐 · 새 파일 0(경고 0) · `node scripts/check-content.mjs` 오류 0(경고 25 기존) · `contractHygiene`(sliceBetween) 통과.
- 로컬 PGlite `node supabase/tests/practice-review-events.mjs` PASS(6절).
- 되돌림 실험 18건 전부 실패 → 원복(4절).
- e2e(로컬 프로덕션 빌드 `NODE_OPTIONS=--max-old-space-size=6144 npm run e2e:build` + `next start -p 8895` + server-fetch-mock):
  - CI 「서재 과 추가·관리」 단계 목록 19파일 전부: **157 통과 · 실패 0**(`library-book-chapters` · `library-management`는 `COMPOSER_TEST_MODULES`를 넣어 다시 돌려 8/8 — 첫 회는 환경 변수 누락으로 시작 전 중단).
    그 안 `learning-flow-clarity` 새 R1-B 시나리오 · `korean-learning`(처음 보는 표현 · 「오늘 몫 끝」) 포함.
  - `npm run e2e:learning` 9/9(처음 회는 새 자동 재생이 합성 환경의 `/api/tts` 500을 콘솔 오류로 남겨 실패 → 이 시험에 합성 무음 음성 경로를 두고, 「포인터로 펼치면 한 번 재생」을 단언으로 추가).
  - `npm run e2e`(smoke) 22개 중 16 통과 · 실패 0(나머지는 기존 skip).
  - 390 · 1440px 가로 넘침 0(R1-B 시나리오의 방 · 앞 · 뒤 · 처음 보는 표현 · 끝 · 집중 연습, 기존 범위 막대 · 시트 시나리오 포함). 아이콘 단추(🔈 · ↶ · ▷ · 칩)는 44px 이상 · 접근 이름 있음.
  - CI 밖 `review-room` · `reading-loop` · `n5-review-return`은 별도 백엔드가 필요해 실행하지 않고 정적 갱신만.
- 실계정 Preview 검수(수용 기준 공통 — FSRS 카드 · 예전 일정 카드 둘 다 확인)는 **미수행** — PR · Preview는 지시대로 만들지 않았다.

## 8. 뒤로 미룬 것과 이유

- **R1-B-2**(학습 단계 anki-v2 · `valid_card`/`fsrs_capabilities`/지문 재게시 SQL · PGlite enabled/ready 검증 · 30초 시각 문서/fixture 갱신): 인계대로 SQL 검수 · 오너 확인 뒤 별도. 이번 줄 · 카드는 학습 단계 값을 읽지 않는다(FSRS가 정한 due로 다시 끼울 뿐)라 정책이 바뀌어도 코드 수정이 필요 없다.
- **관리자 지표 SQL이 연습 기록을 센다**(6절 마지막 줄) — DB 함수 수정이라 이번 범위 밖.
- **PGlite 확인 스크립트를 CI에 넣기**: `.github/workflows/ci.yml`에 한 줄이면 되지만 워크플로 파일 변경은 push 권한 범위가 달라 이번에 넣지 않았다.
- 교재 밖 범위(언어 전체 등)의 띄우기 단위는 자료 · 덱만 안다 — 교재 과는 교재 범위 조회에서만 받는다(언어 전체 범위에서 교재 새 표현은 출처 키가 없어 띄우지 않음). 맥락 요약을 snapshot에 싣는 일은 R2.
- 종류 직접 바꾸기 · 문형 · 「최근 · 고정」 범위 · 읽기 자동 채우기(kuromojin · pinyin-pro) — 설계대로 R2.
- 소리 미리 받기는 서버 음성 캐시만(Web Speech는 미리 받을 것이 없음).
- 재대결(⚔)을 집중 연습으로 옮길지 — 3절 결정 8.

## 9. 오너 확인 항목

1. **[결정 2026-10-14 · 하한 10 적용 — REV-SCOPE-BACKLOG-FLOOR-001]** **밀린 복습 기준의 하한**: 문언대로 「지난 14일 하루 평균 × 2」를 적용하면, 14일 넘게 쓴 가벼운 사용자(예: 14일에 3장 복습 → 평균 0.2)는 밀린 복습 1장만 있어도 새 표현이 멈춘다. 지금은 문언 그대로(하한 없음, 기록이 없거나 14일 미만이면 20). 하한(예: 20)을 둘지 결정이 필요하다. 측정은 snapshot의 「14일 안 마지막 채점 카드 수」라 실제 복습 수보다 작게 잡힌다(3절 결정 3).
2. **관리자 지표에서 연습 기록 제외 SQL**: `admin_funnel`(세션 도달) · 일별 세션 수 · `admin_content_health`(item_key별 오답률 — 단어 UUID가 섞일 수 있음)에 `source <> 'practice'`를 넣는 비파괴 SQL을 R1-B-2 SQL과 함께 낼지.
3. **재대결(⚔ 헷갈린 말)**: 지금은 일정에 반영되는 채점(기한 전 카드 포함). 원칙 4(일정 반영 = 복습, 기한 무관 = 집중 연습)에 맞춰 집중 연습으로 옮길지.
4. **세션 길이 기본값**: 목업대로 「5분 · 약 20개」(기기별 기억). 20개를 넘는 범위에서는 첫 시작이 20장으로 잘리고 끝 화면에 「이어서 N개」가 나온다.
