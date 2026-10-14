# REV-SCOPE-R1A 보고 — 복습 범위 · 개수 · 진입점

브랜치 `claude/rev-scope-r1a` · head `b773a0675740aaad18efd046449e9b6d7beb4ac3` · 기준 `origin/claude/zh-level-2026`(#1435) · 커밋 3(기능 2 + 보드 1) · 42파일 +1318/−278 · PR 없음 · 스키마/DB/환경 변수 변경 없음.

(1절 목업은 구현 전에 적었다)

## 1. 텍스트 목업 (구현 전 기록)

### 1-1. 복습방 머리 · 범위 막대 — 넓은 화면(1080px)

전 (main):
```
THE REVIEW ROOM
복습                                   읽다가 담은 표현을, 내가 쓰는 말로.
────────────────────────────────────────────────────────────────
┌ 오늘 할 일 ─────────────── 01 / RECALL ┐   02 / PATTERNS
│ 오늘 다시 볼 표현                       │   문법도 한 번 더.
│ 58  개의 표현                           │
│ 기억을 확인할 표현 50개 · 처음 익힐 표현 8개│
│ [표현 58개 복습 →]                       │
│ 복습 범위 · 전체 표현                     │   ← 전 언어 섞임, 덱은 설정 서랍 속
└─────────────────────────────────────────┘
… 설정 서랍: 덱 [전체 덱 ▾] · 단어 복습 방식 · 하루 새 단어 한도
목록(전체 보기): 언어 칩 [전체][일본어][중국어] · 급수 ▾  ← 목록만 거름
```

후 (R1-A):
```
THE REVIEW ROOM
복습 · 내 서재 자료 · 2개              읽다가 담은 표현을, 내가 쓰는 말로.
────────────────────────────────────────────────────────────────
언어  [일본어 9] [중국어 40●]                       ← byLang(countReviewScope)
범위  [HSK 2 ✕] [내 서재 자료 · 2개 ✕] [＋ 범위]      ← 칩 ✕ = 그 축 풀기, ＋ 범위 = 시트
┌ 이 범위에서 오늘 ───────── 01 / RECALL ┐   02 / PATTERNS
│ 오늘 다시 볼 표현                       │   문법도 한 번 더. (그대로 — 전 언어, 별줄)
│ 18  개의 표현                           │
│ 복습 14 · 새 표현 4                     │
│ 새 표현 · 오늘 10개 더(모든 언어 합쳐서)  │   ← 계정 한도 남은 수(D3)
│ [표현 18개 복습 →]                       │   ← 18 = 시작하는 줄 길이
│ (한도 막힘 시) 이 범위 새 표현 12개 · 오늘 시작 5개(새 표현 한도) · 나머지 7개는 내일 │
└─────────────────────────────────────────┘
설정 서랍: 단어 복습 방식 · 하루 새 단어 한도   ← 덱 선택 삭제(출처 · 사전 급수 덱으로 흡수)
목록(전체 보기): 언어 칩(전체 없음) · 급수 ▾  = 범위의 언어 · 급수를 그대로 바꾼다
```
- 세션 길이 칩 · 집중 연습 버튼 · 「종류」 칩 · 최근/고정은 그리지 않는다(R1-B · R2).

### 1-2. 휴대폰 390px

```
THE REVIEW ROOM
복습 · 교재 5–10과
──────────────────────
언어 [일본어 9●]
범위 [교재 5–10과 ✕] [＋ 범위]       ← 칩 줄은 줄바꿈(flex-wrap), 가로 넘침 없음
┌ 이 범위에서 오늘 ──────┐
│ 12 개의 표현            │
│ 복습 7 · 새 표현 5      │
│ [표현 12개 복습 →]       │
└────────────────────────┘
← 교재로 · 교재의 담은 표현
```
- 칩 ✕ 버튼과 ＋ 범위는 최소 44×44 터치 영역, ✕는 aria-label 「HSK 2 범위 풀기」.

### 1-3. 범위 시트(＋ 범위 / 칩 누름) — 대화상자, 넓은 화면은 가운데 · 390px는 화면 폭

```
범위 고르기 · 중국어                                   [닫기]
중국어 담은 표현 312개 중 42개(아는 단어 제외)
급수   [전체] [HSK 1 · 3] [HSK 2 · 18●] … [HSK 7–9 · 0] [미분류 · 6]     ← 중국어만. 다른 언어는 「급수는 중국어만 고를 수 있어요(일본어 N급은 준비 중)」
출처   [전체●] [사전 급수 덱] [내 서재 자료] [오늘 학습 · 4] [교재 — 중국어 교재 없음(회색)]
       (사전 급수 덱) [중국어 · H3 · 12] [중국어 · H4 · 3]
       (내 서재 자료) [✓ 北京的早餐 · 담음 28] [✓ 上海的地铁 · 담음 14] [我的周末 · 담음 9]
       (일본어 교재)  과 [5 ▾] – [10 ▾]
상태   [복습할 때 된 것● · 18] [새 표현만 · 4] [흐릿 · 위험 · 3]
[이 범위로 보기]
출처가 기록되지 않은 옛 표현은 「출처 · 전체」에서만 나와요.
```
- 각 선택지 숫자 = 그 선택을 적용한 범위의 오늘 개수(countReviewScope). 자료 목록 숫자만 「담음 N」(그 자료 출처로 저장한 표현 수 — 오늘 개수는 서버 조회 뒤에 확정).
- 「종류」 · 「이 범위 고정」은 그리지 않는다(R1-B · R2).

### 1-4. 상태 문구(§5-6, 범위 관련만)

| 상태 | 화면 |
|---|---|
| 0개 | 「이 범위엔 오늘 복습할 표현이 없어요 · HSK 2를 빼면 12개」 [급수 풀기] (집중 연습 버튼은 R1-B까지 숨김) |
| 못 읽음(조회 실패) | 「범위를 불러오지 못했어요. 전체로 바꾸지 않았어요.」 [다시 시도] [범위 풀기] — 시작 버튼 없음 |
| 주소 무효 | 「범위 주소를 읽지 못했어요. 전체로 바꾸지 않았어요.」 [범위 풀기] |
| 한도 막힘 | 「이 범위 새 표현 12개 · 오늘 시작 5개(새 표현 한도) · 나머지 7개는 내일」(교재 한 과면 「이 과 새 표현 …」) |

> 구현 후 실제 화면(로컬 프로덕션 빌드 + 합성 fixture) 스크린샷: (로컬 캡처, 저장소 밖)(room-1440 · room-390 · sheet-1440 · sheet-390 · zero-390 · closed-390 · invalid-390 · room-nolevel-*), (로컬 캡처, 저장소 밖) · `review-scope-sheet-390.png`. 390px · 1440px 모두 가로 넘침 0(scrollWidth − innerWidth = 0).
> 목업과 다른 점(결정): 한도 막힘 문구는 「이 과 표현 12개」 대신 「이 과 **새** 표현 12개」 — 12는 새 표현만 센 수라 복습 카드가 섞인 범위에서 오해가 없게. 0인 갈래는 적지 않는다(「복습 0」 금지 — 기존 learning-flow e2e 계약).

## 2. 범위 주소 문법 (구현)

정본: `src/lib/reviewScopeUrl.js`(서버 /vocab 페이지도 읽는 순수 모듈) — `parseReviewScope` ↔ `serializeReviewScope`. 개수 · 거르기는 `src/lib/reviewScope.js`(URL 모듈을 다시 내보냄).

| 파라미터 | 값 | 규칙 |
|---|---|---|
| `lang` | Japanese · Chinese · English · French · Korean | `LEARNING_LANGUAGES` 그대로(한국어 학습 계정이 잠기지 않게 Korean 포함). 없으면 null → 화면이 기본 언어로(학습 언어 → 담은 표현 가장 많은 언어). 교재 src면 Japanese, level이면 Chinese로 정해짐 |
| `level` | H1…H7 · NONE | HSK 2026 표(#1435 `zhHskLevelOf`, H7 = 7–9). 중국어 전용, 다른 언어 · N급 → 무효 |
| `src` | `book:japanese-n5:A-B`(1≤A≤B≤42, 앞자리 0 금지) · `deck:<encodeURIComponent(source_ref)>` · `material:<id>,<id>`(≤20, 중복 금지) · `note:<id>`(1개) · `study` | 하나만 |
| `state` | due(기본, 주소에서 생략) · new · fragile | fragile = 기한 된 복습 중 기억 확률 < 0.7(기억 건강 「흐릿 · 위험」과 같은 경계) |
| `returnTo` | 교재 범위에서만 `safeBookReturn` 통과 값 | 그 외 범위에서는 버림 |
| 호환 | `?book=japanese-n5&returnTo=` | = `src=book:japanese-n5:1-42` + 돌아갈 곳(같은 범위 객체) |
| 무효 | 위 규칙 위반 · 같은 키 반복 · book+src 동시 | `{explicit:true, invalid:true}` → 닫힘 화면(「범위 주소를 읽지 못했어요.」), 저장 설정 무변경 |
| 정본 순서 | lang · level · src · state · returnTo | 왕복 동일 문자열(계약) |

저장 범위: 명시 주소가 없을 때만 `localStorage.vocab_reviewScope`(같은 쿼리 문자열)에 저장 · 복원. 옛 `vocab_langFilter` · `vocab_levelFilter`는 새 키가 없을 때 한 번 읽기만(덱 값은 출처로 흡수돼 버림). 명시 주소 범위에서는 칩 · 시트로 바꿔도 저장하지 않는다.

## 3. 진입점 (주소 예)

| 진입점 | 주소 | 위치 |
|---|---|---|
| 교재 도구막대 「담은 표현」 → 채점 복습방 | `/vocab?lang=Japanese&src=book%3Ajapanese-n5%3A1-42&returnTo=%2Fbooks%2Fjapanese-n5%3Fedition%3D…%23u07-start` | `BookReader.jsx` 도구막대 |
| 교재 과 끝 「이 과 표현 복습 →」 | `/vocab?lang=Japanese&src=book%3Ajapanese-n5%3A7-7&returnTo=…` | `BookReader.jsx` 과 끝(모든 과) |
| 교재 마지막 과 「이 교재 표현 복습 →」 · 교재의 담은 표현 목록 | 교재 전체 범위(위와 같음) | 기존 링크, 주소만 새 문법 |
| 자료 뷰어 「N개 수집 · 이 자료 표현 복습」 | `/vocab?lang=Chinese&src=material%3A91` | `ViewerPage.jsx` 통계 줄(기존 「→ 단어장」 링크 자리) |
| 배움 칸(AK) | `/vocab?lang=Chinese` | AK가 `serializeReviewScope({lang})` + `countReviewScope` 사용 |
| 현황 레벨 어휘 · 기억 건강(AK) | `/vocab?lang=Chinese&level=H2` · `/vocab?lang=Japanese&state=fragile` | AK 정정 §3 |
| 옛 링크 | `/vocab?book=japanese-n5&returnTo=…` | 그대로 동작 |

복습방 안 「교재의 담은 표현」 링크(`/books/japanese-n5/review?edition=…&returnTo=…`)로 채점 없는 목록에도 갈 수 있다(교재 범위일 때).

## 4. countReviewScope (AK가 가져다 쓸 함수)

`countReviewScope({ snapshot, fsrsEntries, quota, scope, now, grammar?, levels?, sourceIds?, canLegacy?, reviewSupported?, fsrsEnabled?, pendingIds? })`
→ `{ status:'ready'|'pending', engine:'fsrs'|'legacy', due, newAllowed, newLocked, total, deferred, grammarDue, byLang, queue:{legacyIds, fsrsIds}, scopedIds, stored }`

- `snapshot` = `fetchVocabularyLearningRows` 결과(요약 `fields:'summary'`도 됨 — source_ref 추가). `fsrsEntries`를 안 주면 snapshot projection에서 만든다(배움 칸처럼 FSRS controller가 없는 화면용).
- `quota` = `{ active, remaining, admittedLegacyCardIds }` — 복습방은 기존 `remainingNew`(호환 모드 = 기기 한도, 아니면 서버 남은 수) 그대로.
- 급수 범위는 `levels`(loadZhHskLevels), 출처 조회 범위는 `sourceIds`가 있어야 ready — 없으면 pending(0, 빈 줄). 「전체」로 대신 세지 않는다.
- **R1-A 엔진 규칙(명시)**: 범위 안 FSRS 카드가 하나라도 출제 가능하면 세션 전체가 FSRS(기존 VocabPage 동작 유지). 그래서 total = FSRS 줄(복습 + 오늘 시작 가능한 새 카드)이고, 그 뒤로 밀린 예전 일정 카드는 `deferred`로 따로 낸다(복습방 문구 「예전 일정 표현 N개는 이 복습을 마친 뒤 이어서 나와요.」). FSRS가 없으면 total = 예전 일정 줄(복습 + 재개 새 표현 + 한도 안 새 표현) = `queue.legacyIds.length`. R1-B가 두 엔진 합치기와 함께 이 규칙을 바꾼다.
- byLang = 그 언어만 고른 범위(`{lang}`)의 total. grammarDue = grammar_review 중 그 언어 기한 지난 수(별줄, total 밖).
- 이전 화면 숫자는 「예전 일정 + FSRS」를 더했는데 시작은 한 엔진만 해서 숫자와 줄이 어긋났다 — 이번에 같은 규칙으로 맞췄다(혼합 계정에서 숫자가 줄어들 수 있음, 의도).

## 5. 계약 (설계 §8 R1-A 줄) — 되돌림 증거

새 계약 `src/lib/__tests__/reviewScope.test.js`(49) · `materialReviewScopeRoute.test.js`(14) · `bookReviewScopeRoute.test.js` 범위 추가(+9) · `bookReviewNavigation.test.js` 재작성(14).

| 계약 | 대상을 되돌린 실험 → 실패한 테스트 |
|---|---|
| 보이는 개수 = 시작 줄 길이(total = queue, 시작이 같은 queue) | A 시작 줄을 `deckScope`로 바꿈 → 「시작하는 줄 = 같은 계산의 queue」 실패 |
| 언어 밖 카드 0 | 범위 거르기에서 언어 조건 제거 → 엔진 규칙 · byLang · 상태/출처 3개 실패 |
| 무효 범위 닫힘 | 무효 lang을 null(전체)로 → `{"lang":"Spanish"}` 실패 |
| 조회 실패 · 판정 전 = 빈 줄(전체 아님) | 조회 없이 ready 반환 → 「pending — 전체를 대신 세지 않는다」 실패 |
| 조회 실패 · 판정 전 시작 금지 | `startSession` 가드에서 scopePending/scopeFailed 제거 → 「조회 실패 · 판정 전에는 시작하지 않고…」 실패 |
| 저장 설정 무변경 | 저장 effect의 `explicitScope` 조건 제거 → 「명시 범위 · 무효 범위는 저장 설정을 덮지 않는다」 실패 |
| 주소 왕복 동일 · 옛 ?book= | 옛 book 해석 제거 → 「옛 ?book= 링크…」 실패 / state=due 생략 제거 → 「정본 모양」 실패 |
| 새 표현 한도 반영 | 한도 무시 → 「새 표현 한도가 개수와 줄에 같이 걸린다」 실패 |
| R1-A 엔진 규칙대로 셈 | FSRS 분기 제거 → 엔진 규칙 · byLang 실패 |
| 숫자 출처 = countReviewScope(호출 지점) | VocabPage 안 `countReviewScope(` 1곳 · 범위 막대는 직접 세지 않음 · 화면 숫자/버튼 = session.total (소스 계약) |

메뉴 소속(복습 경로 = 배움) 계약은 AK가 `webNavigation.test.js`와 함께 심는다(이번에 메뉴 무변경).

## 6. 바뀐 기존 계약 (목적 유지, 단언만 갱신)

| 파일 | 전 | 후 |
|---|---|---|
| `refVocabWiring.test.js` | 급수 필터 = 목록 전용(`levelFilter !== 'all' && zhHskLevels`, `vocab_levelFilter` 저장) | 급수 = 범위 축 — 목록(`allVocab.filter(scopeMatcher.matches)`) · 개수 · FSRS 범위가 같은 거르기, 범위로 저장 |
| `reviewReliabilityFixes.test.js:48`(V-10) | `useState('all')`로 langFilter/seriesFilter | `useState(reviewScope.explicit ? reviewScope.scope : null)` + 저장 범위는 마운트 effect에서만 |
| `vocabularyLearningRows.test.js:32` | 요약 13칸 | 요약 14칸(+source_ref) · 필수 칸은 13칸 그대로(`VOCABULARY_LEARNING_REQUIRED_FIELDS`) |
| `bookReviewNavigation.test.js` | `?book=` 주소 · parseBookReview | 범위 주소 정본 왕복 · 옛 주소 호환 · 과 범위 요청 · 자료 범위 실패 닫힘 |
| `bookReviewScopeRoute.test.js` | 전체 교재만 | + 과 범위 `in('chapter_slug', …)` · 전체 범위는 과 조건 없음 · 잘못된 범위 400 |
| `reviewRoom.test.js` | workspace key = bookReview | key = 계정 + 범위 주소 |
| `zhHskLevelSites.test.js` | 급수 판정이 VocabPage 목록 필터에 | 범위 거르기 `wordZhLevel` → `zhHskLevelOf`(같은 조회) |
| `fsrsVocabIntegration.test.js` | `fsrsReview.enrolledIds.includes(v.id)` | 같은 가드를 `canLegacy` 입력으로 |
| `a11yAuditR1.test.js` | `aria-label="덱 선택"` | 덱 선택 삭제 확인 + 범위 막대의 이름(사전 급수 덱 · 칩 풀기 · 언어 aria-pressed) |
| `viewerChrome.test.js` · `wordCardOrder.test.js` | `/vocab` 「수집 → 단어장」 · 「✓ 단어장에 있음」 | 자료 범위 주소 「수집 · 이 자료 표현 복습」 · 「✓ 담은 표현에 있음」 |
| `vocabularyLearningUi.test.jsx:133` | 담기 화면 새 일정 등록 금지 | **무변경** |

e2e 갱신: `learning-flow-clarity`(도구막대 → 복습방 · 과 끝 링크 · 언어 = 범위 첫 축 시나리오 재작성 + 시트 390px/Esc 초점), `book-reading-reload`(도구막대 목적지 /vocab · 돌아가기 「← 교재로」), `learning-flow`(킥커 문구), `viewer-response` · `viewer-word-card`(✓ 담은 표현에 있음), `viewer-chrome`(정적 마크업 문구), `n5-review-return`(CI 밖 — 정적 갱신만: 도구막대 경로 · 닫힘 문구 · 다시 시도 · 저장 키 무변경 확인), `fixtures/learning-snapshot.mjs`(요약 source_ref).

## 7. 검사 결과

- `npm test`(Node 24.21.0): **573 파일 · 6747 통과 · 실패 0**(첫 회 실패 3 중 2는 이번 변경이 바꾼 계약 — 갱신, 1은 `studiesRefs.test.js` 60s 훅 flake — 단독 재실행 통과).
- eslint 바뀐 파일 0 · `node scripts/check-content.mjs` 오류 0(경고 25 기존) · `contractHygiene`(sliceBetween) 통과.
- e2e(로컬 프로덕션 빌드 `npm run e2e:build` + `next start -p 8879` + server-fetch-mock):
  - CI 목록 중 리뷰 · 교재 · 뷰어 관련 10파일: `learning-flow-clarity` · `book-reading-reload` · `textbook-reading-clarity` · `viewer-response` · `viewer-word-card` · `korean-learning` · `viewer-exclusion` · `learner-archive-links` · `viewer-language-settings` · `library-book-chapters` → 74 중 73 통과, 1 실패(`viewer-word-card` AE-R4 「display only: no writes」 — reading_progress POST 시점 flake, 첫 회 통과 · 단독 재실행 4/4 통과, 이번 변경과 무관한 경로).
  - 최종 빌드로 재실행: `learning-flow-clarity` · `book-reading-reload` · `textbook-reading-clarity` 19/19 통과.
  - `npm run e2e:learning`(learning-flow) 9/9 · `npm run e2e:chrome` 4/4.
  - `n5-review-return.e2e.mjs`는 CI 밖(별도 49002 백엔드 · macOS Chrome 경로)이라 실행하지 않고 정적 갱신만.
- 화면 확인: 1440 · 390 범위 막대 · 시트 · 0개 · 조회 실패 · 무효 주소 스크린샷((로컬 캡처, 저장소 밖)), 가로 넘침 0. 시트는 Esc로 닫히고 초점이 「＋ 범위」로 돌아온다(e2e).
- 실계정 Preview 검수(수용 기준 8: 중국어 범위 하나 · 교재 과 범위 하나)는 **미수행** — PR · Preview는 지시대로 만들지 않았다.

## 8. R1-B · AK · 뒤로 미룬 것과 이유

- **R1-B**: FSRS 독점 해제(두 엔진 한 줄) · 정렬 · 띄우기 · 처음 보는 표현 카드 · 세션 길이 칩 · 집중 연습(버튼은 0개 상태에서도 숨김) · 「종류」 칩 · 밀린 복습 규칙(줄과 개수를 함께 바꿔야 해서 — 개수만 적용하면 「보이는 개수 = 시작 줄」이 깨진다) · 뜻 없는 표현 제외 + 「뜻 채우기」 표시(줄에서 조용히 빼면 R1-A에서 복습이 사라져 보인다) · 나머지 §5-6 상태 문구 · 끝 화면 「읽던 자료로 돌아가기」(자료 returnTo는 받지 않음).
- **AK**: 메뉴 소속(`navigationOwner` /vocab · /review · /study · /learn → /home, `webNavigation.test.js`)과 그 계약 · 배움 칸(countReviewScope 호출 + 계약 호출 지점 추가) · 현황 레벨 어휘(HSK) · 기억 건강 진입 링크. 함수 · 주소 정본은 이번에 다 냈다(`serializeReviewScope`, `countReviewScope`, `fsrsEntriesFromSnapshot`).
- **R2**: 일본어 N급 · CEFR(지금은 무효 → 닫힘) · 최근 범위 · 고정 · 「노트」 출처 선택지(주소 · 조회는 지원, 시트에서는 자료와 구분할 정보가 없어 그리지 않음) · 문법 복습 언어 범위(`/review/grammar`가 언어를 받지 않아 복습방 문법 칸은 전 언어 그대로, `grammarDue`는 언어별로 계산해 AK 별줄용으로만 반환).
- 이름 통일 ⑧ 중 남긴 것: 토스트 · TokenEditPanel 「내 단어장에도 반영」 · 노트 게이트 「내 단어장」 · VocabRegisterCta 「단어장에 담기」 · 교재 홈 「담은 표현」 도구(목록 페이지로 그대로) — 다른 세션의 문구 표준 작업(claude/copy-std)과 겹치지 않게 범위 진입점과 ⑧의 명시 예시만 바꿨다.

## 9. 애매했던 것 — 결정

1. **level 값**: 인계는 H1…H6이지만 #1435 2026 표는 H1…H7(7 = 7–9) — 지시대로 H1…H7 · NONE.
2. **lang 값에 Korean 포함**: 설계는 4개 언어지만 한국어 학습 계정(능력 게이트)의 단어가 어느 범위에도 안 들어가 복습이 사라지므로 `LEARNING_LANGUAGES` 그대로 받았다.
3. **언어가 비어 있는 옛 행**: 저장 언어 우선, 비면 `detectLangConfident`(가나 · 프랑스어 부호)로만 판정 — 확신 못 하면 어느 범위에도 넣지 않는다(언어 밖 카드 0 우선).
4. **복습 기본 언어**: 주소 · 저장값이 없으면 프로필 학습 언어(그 언어에 담은 표현이 있을 때) → 담은 표현이 가장 많은 언어. 배움 언어 칩(AK)이 생기면 그 값을 주소로 넘긴다.
5. **목록(전체 보기)도 범위를 따른다**: 언어 「전체」 칩 없음. 목록의 언어 칩 · 급수 선택 = 범위 변경(언어를 바꾸면 그 언어만의 범위로 — 칩 숫자와 일치). 검색 · 정렬만 목록 전용.
6. **범위를 바꾸면 멈춘 줄은 버린다**(다른 범위의 카드가 이어 나오지 않게).
7. **fragile = 기한 된 복습 ∩ 기억 확률 < 0.7**: 기한 전 카드를 채점 복습으로 돌리면 일정이 바뀌므로(그건 집중 연습 = R1-B).
8. **시트의 자료 · 교재 후보 개수**: 서버 조회 전이라 오늘 개수 대신 「담음 N」(그 자료 출처로 저장한 수)과 「적용 뒤 확인」 안내. 급수 · 덱 · 오늘 학습 · 상태는 오늘 개수.
9. **요약 필드 source_ref**: 요약에는 싣되 필수 칸 검사에는 넣지 않았다(nullable 출처 메타가 없다고 snapshot 전체를 거부하면 화면 전체가 닫힌다 — 기존 고정 데이터 · 옛 행 보호).
10. **/vocab 서버 페이지 import 분리**: `reviewScope.js`가 HSK 훅 모듈을 끌어와 서버 컴포넌트 빌드가 깨져서, 주소 문법만 `reviewScopeUrl.js`로 분리(reviewScope.js가 다시 내보냄).
11. **혼합 계정의 숫자 변화**: 예전엔 화면 숫자 = 예전 일정 + FSRS 합인데 시작은 FSRS만이었다. 이제 같은 규칙으로 세므로 숫자가 줄 수 있고, 밀린 예전 일정 카드는 「이 복습을 마친 뒤 이어서 나와요」로 알린다.
