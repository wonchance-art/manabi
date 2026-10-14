# LEARN-HOME-AK-001 보고 — 메뉴 개편(배움 · 서재 · 산책) + 배움 대시보드 + 현황

브랜치 `claude/learn-home-ak` · 기준 `origin/claude/rev-scope-r1a`(#1447 — COPY-STD-001 병합분 `8255fdfd` · 게스트 /vocab 수정 `129f275b`까지 병합) · PR 없음 · 스키마/DB/환경 변수 변경 없음.

(1절 목업은 구현 전에 적었다. 정본 = `docs/design/mocks/ak/ak.html` + 프레임 4장. 정정(2026-10-11)과 D-X6(2026-10-12)이 목업보다 우선인 곳만 바꿨다.)

## 1. 텍스트 목업 (구현 전 기록)

### 1-1. 상단 메뉴 · 휴대폰 탭 막대

전 (main):
```
manabi.   [⌂ 오늘][▤ 교재][◎ 발견][↻ 복습][▥ 내 서재]   (아이콘만, 글자는 숨김)   ☾  ⌕  로그인
휴대폰 탭 막대(≤900):  오늘 · 교재 · 발견 · 복습 · 내 서재   (글자만)
```
후:
```
manabi.            배움   서재   산책                       ☾  ⌕  로그인
                   ‾‾‾‾  (지금 메뉴 = 글자 + 밑줄 2px)
휴대폰 탭 막대(≤900):   [▯▯]      [|||\]      [◎]
                        배움        서재        산책        ← 아이콘 + 글자, 지금 메뉴 = 로즈
```
- 소속: `/home` · `/vocab` · `/review` · `/study` · `/learn` · `/lessons` · `/books` → 배움, `/materials` · `/viewer` · `/library` · `/pdf` · `/epub` · `/groups` · `/study/library` → 서재, `/discover` · `/studies` · `/world` · `/suggestions` → 산책.
- 「대화」는 그리지 않는다(구분선도 없음). `/lessons` · `/vocab` 경로는 그대로 산다.

### 1-2. 배움(`/home`) — 넓은 화면(본문 672 = 4열 159 · 줄 146 · 간격 12)

전 (main): 「오늘」 에디토리얼(펼친 책 그림 · 이어서 읽기 버튼) / 복습 문단 / 읽을거리 2장 / 「학습을 이어가는 방법」 덱(예보 · 다시 읽기 · 함께 읽기) / 내 서재 줄.

후:
```
배움  (일본어●) (중국어)                                   현황 전체 →
┌─────────────────────────┐┌──────────────────────────────────┐
│ 일본어 N5            あ │││ 12/6(일) JLPT N4                  │
│ 07                      ││ D-58                      ● 11/29 │
├─────────────────────────┤│ ━━━●──────────────────────────── │
│ カフェは どこですか。    ││ 6 / 42과          하루 0.7과 · 7일 여유│
│ 카페는 어디예요?         │└──────────────────────────────────┘
│                         │┌───────────────┐┌───────────────┐
│ 6 / 42 ━── [이어서 읽기 →]││     60%       ││     12일      │
└─────────────────────────┘│   오늘 목표    ││  연속 · 쉼 2   │
                           └───────────────┘└───────────────┘
┌─────────────────────────┐┌──────────────────────────────────┐
│ 단어 복습        24개 대기 ││ 오늘 문단                         │
│                         ││                                  │
│        会議              ││  駅前の小さなパン屋で、             │
│        회의              ││  今日も同じパンを買いました。       │
│                복습하기 → ││                         시작하기 → │
└─────────────────────────┘└──────────────────────────────────┘
```
- 언어 칩 = 글자(「일본어」 · 「중국어」, `LANG_NAME_KO`) — 국기 없음(D-X6). 칩이 이어 읽기 · 단어 복습 · 오늘 문단의 언어를 정한다.
- 「24개 대기」 = `countReviewScope({…, scope:{lang}}).total`(그 언어 오늘 복습 + 오늘 시작 가능한 새 표현, 문법 제외). 칸 → `serializeReviewScope({lang})` = `/vocab?lang=Japanese`.
- 0개면 「N개 대기」 없이 최근 담은 표현만 돌려 보인다(숫자에 넣지 않음).
- 진행바 칸 → `/progress`. 목표가 없으면 「목표를 정하면 / 하루에 몇 과가 필요한지, 언제 끝날지 계산해 드려요 / [목표 정하기]」 → `/progress?goal=edit`(목표 편집은 현황의 한 모달).
- 「연속」 칸 title = aria 설명 「쉼: 7일 연속할 때마다 1개(최대 2개). 하루 빠지면 자동으로 써서 연속이 이어져요」. 기록 없음 = 「– / 연속」. 🛡 없음.

이어 읽기 네 상태(같은 C 모양, 머리 색 = 언어 색 `--ja/--zh/--en/--fr`):
```
일본어 교재   [일본어 N5 · 07 · あ] カフェは どこですか。/ 카페는 어디예요?  6 / 42 ━─ [이어서 읽기 →]
              (원어 제목이 없으면 한국어 제목이 주 제목, 부제 = 과 부제)
신규          [일본어 N5 · 01 · あ] 01과 제목                             0 / 42 ── [첫 페이지 열기 →]
서재 자료     [내 서재 · 중국어 · 汉] 北京的早餐 / HSK 2                    ············ [이어서 읽기 →]
산책 추천     [산책 추천 · 文]       편의점에서 쓰는 말 / 일본어 · N5         ············ [읽어 보기 →]
```
- 일본어 칩: 기존 정본 그대로(교재 기록 vs 서재 자료는 `chooseResume` 실제 시각 비교, 계정 · 판별 기록 `useReadingProgress(edition)`, 첫 렌더 후 목적지 고정). 다른 언어 칩: 그 언어의 서재 자료 → 없으면 그 언어 산책 추천 → 없으면 산책으로.
- 서재 자료의 「3 / 8」은 쪽 수 데이터가 없어 그리지 않는다(9절).

오늘 문단 세 상태:
```
준비됨(prefetched · 48시간 이내)   첫 문장(최대 3줄)                     시작하기 →
준비 전                            今日 · 会議 · ありがとう / 오늘 문단에 넣을 표현   시작하기 →   (예보 상위 3 — 누르면 기존 forecast_tap 기록)
신규                               시작하면 오늘 문단을 만들어요           시작하기 →
```
- 링크 `/study?lang=<칩 언어>`. 예보 탭 기록(`buildForecastTapEvent → logReviewEvents`)은 이 칸으로 옮긴다.

로그인 전:
```
배움
[이어 읽기 01 · 첫 페이지 열기 (2×2)] [오늘 문단 · 맛보기 — 예문 한 줄 · 시작하기 → (2×2)]
[로그인하면 여기에 쌓여요 / 단어 복습 · 오늘 목표 · 레벨 어휘 · 기록              [로그인] (4×1)]
```

격자 아래: 기존 「다시 읽기」 · 「함께 읽기」 덱(ContinueDeck)은 목업에 없다 — 9절 결정 참고.

### 1-3. 배움 — 휴대폰 390(본문 358 = 2열 · 줄 120 · 간격 12)

```
배움 (일본어●)(중국어)        현황 전체 →
┌ 이어 읽기 (머리 92) ──────────┐  1
├ 단어 복습 ────────────────────┤  2
├ 오늘 문단 ────────────────────┤  3
├ 진행바 (146) ─────────────────┤  4 ┐ 상태 묶음은 맨 아래 — 클래스 order
├ 오늘 목표 ──────┬ 연속 ────────┤  5 ┘ (.learn-order-status, nth-child 금지)
[ 배움 ][ 서재 ][ 산책 ]  탭 막대
```
- 가로 넘침 0(칩 두 개 + 「현황 전체 →」가 한 줄).

### 1-4. 현황(`/progress`) — 넓은 화면

```
← 배움
현황 (일본어●)(중국어)                                      [목표 수정]
[ 진행바 반쪽 (2×1)        ][ 오늘 목표 ][ 연속      ]
[ 히트맵 24주 (2×1)        ][ 이번 주   ][ 아는 단어 ]
[ 레벨 어휘 (2×2)          ][ 기억 건강 (2×2)        ]
```
- 묶음 제목 없음 · 간격 12.
- 히트맵: 최근 168일(24주 × 7) · 칸 10px · 간격 2px · 범례 없음 · 칸마다 「10월 9일 · 3개」 툴팁. 머리 「94일 · 1,372개」.
- 레벨 어휘(중국어): HSK 1 … HSK 7–9 줄, [막대: 아는 단어(로즈) / 복습 중(옅은 로즈)] [확보 수 / 전체 수] 열 정렬. 줄 → `/vocab?lang=Chinese&level=H2`. 계산 `haveWordSet` · `vocabCoverage`(HSK 2026 표 = `zhHskLevelOf`). 레벨 목록이 없는 언어: 「이 언어의 레벨 목록은 준비 중이에요」.
- 기억 건강: 선명 · 양호 · 흐릿 · 위험(색과 문구 그대로) + 복습 스케줄 7일. 「흐릿」 · 「위험」 → `/vocab?lang=…&state=fragile`. 칩 언어로 거른다.
- 아는 단어 = 칩 언어의 「이미 앎」 표시 수. 칩 언어가 레벨 어휘 · 기억 건강 · 아는 단어를 거른다. 복습 개수 칸은 없다.

### 1-5. 현황 — 휴대폰 390

```
← 배움
현황 (일본어●)(중국어)      [목표 수정]
[ 진행바                  ]
[ 오늘 목표 ][ 연속        ]
[ 이번 주   ][ 아는 단어    ]
[ 히트맵                  ]
[ 레벨 어휘                ]
[ 기억 건강                ]
```
- 한 격자를 펴고 클래스 `order`(진행바 1 · 오늘 목표 2 · 연속 3 · 이번 주 4 · 아는 단어 5 · 히트맵 6 · 레벨 어휘 7 · 기억 건강 8).

## 2. 구현 요약

| 영역 | 파일 |
|---|---|
| 메뉴 · 소속 · 탭 막대 | `src/lib/webNavigation.js` · `src/components/Layout.jsx` · `src/components/ActionIcon.jsx`(learn 아이콘) · `src/components/web/web-shell.css` |
| 배움 | `src/views/HomePage.jsx` · `src/components/learn/{ResumeTile,ParagraphTile,GoalTrackTile,LearnTiles,LangChips,useLearnLanguage}.jsx` · `learn.css` |
| 현황 | `src/app/(app)/progress/page.jsx` · `src/views/ProfileStats.jsx`(현황으로 되살림) · `src/components/learn/{LevelVocabCard,MemoryHealthCard}.jsx` |
| 순수 계산 | `src/lib/learnDashboard.js`(칩 언어 · 연속 · 오늘 목표 · 진행바 표시 · 오늘 문단 상태) · `src/lib/memoryHealth.js`(VocabStats에서 추출) · `src/lib/goalCatalog.js` |
| 공용 한도 입력 | `reviewScopeQuota`(`src/lib/reviewScope.js`, VocabPage의 remainingNew · scopeQuota 계산을 추출 — 배움 칸과 복습방이 같은 한도) |
| 과정 목록 | `src/app/api/goal-catalog/route.js`(force-static, 목표가 있을 때만 받음) |
| 데이터 | `readingCatalog`가 판 원고의 `title_ja`를 `titleJa`로 넘김(없으면 null → 한국어 제목이 주 제목) |
| 문구 | 「스트릭」 → 「연속」: CourseMapPage(aria · 라벨) · AdminPage 표 머리 · Layout 알림 본문, ProfileStats 🛡 제거 |
| 죽은 CSS | 예전 메트로(.bento · nth-child 휴대폰 순서 · review-tile · goal-track · lvprog · hm-*) 제거 — deadCss 계약, 뷰포트 쿼리 26 → 25(ui-conventions.md 갱신) |

## 3. 결정 (목업 · 인계 · 정정 · D-X6이 갈린 곳)

1. **언어 칩 = 글자(D-X6 우선)**: 인계의 「국기 칩」 대신 「일본어」 · 「중국어」(`LANG_NAME_KO`). 칩이 하나면 누를 수 없는 표지로만 둔다. 칩 목록 = 프로필 학습 언어, 비어 있으면 담은 표현이 많은 언어 순(복습방 기본 언어 규칙과 같은 결), 그것도 없으면 일본어. 고른 칩은 이 기기 `localStorage(learn_lang)`에만(편의 설정).
2. **단어 복습 칸(정정 우선)**: 인계의 「ReviewTile 그대로」 대신 `countReviewScope({…, scope:{lang}}).total`. 한도(quota)를 모르면 숫자를 쓰지 않는다(「전체」나 다른 산식으로 대신 세지 않음). 0개면 「N개 대기」 없이 최근 담은 표현만 돈다. 문법 제외. 칸 → `/vocab?lang=<칩>`. 배움 칸은 FSRS controller가 없어 `canLegacy` 기본값(R1-A §4가 정한 「배움 칸처럼 controller가 없는 화면」 경로) — 복습방과 숫자가 다를 수 있는 경우는 R1-A 엔진 규칙 범위 안이다.
3. **메뉴 소속(정정)**: /vocab · /review · /study · /learn에 더해 메뉴에서 빠진 **/lessons · /books · /progress도 배움** — 인계 §1 「/lessons는 배움 화면의 이어 읽기로 들어간다」와 같은 결.
4. **넓은 화면 메뉴 = 글자(목업 우선)**: 기존 셸은 아이콘만(글자 숨김)이었으나 목업은 가운데 글자 메뉴 + 밑줄. 휴대폰은 아이콘 + 글자 탭 막대.
5. **진행바**: 「6 / 42과」는 목표 과정(레퍼런스 정본 buildPlan)의 과 수다 — 목업 숫자(42)는 예시. 예상 완주일을 낼 수 없으면(최근 2주 진도 0) 신호 없이 「하루 N과 필요」. 신호: 예상 완주 ≤ 목표일 = 청, 늦으면 적 「N일 늦음」. 「완주 예상」 글자는 aria-label에만.
6. **목표 편집 자리 하나**: 현황의 「목표 수정」 = 예전 D-Day 모달(목표 · D-Day) 그대로. 배움의 「목표 정하기」 → `/progress?goal=edit`(모달이 열림). 예전 D-Day 타일은 진행바의 D-58로 흡수.
7. **이어 읽기 서재 자료 「3 / 8」**: 자료의 쪽 수 데이터가 `reading_progress`에 없어(last_token_idx만) 진도 숫자 · 막대를 그리지 않는다. 자료 언어 · 급수는 `processed_json` 메타 경로 스칼라 두 칸만 join(본문 JSON 미전송).
8. **원어 제목(Noto Serif JP)**: 앱 전역에 Serif JP가 로드돼 있지 않다(교재 문법 레이아웃 전용). 새 글꼴 패밀리는 배포 글꼴 사본(vendor) 갱신이 필요해 범위 밖 — 제목 · 숫자는 이미 로드된 Noto Serif KR(가나 · 한자 포함)로 그렸다.
9. **목업에 없는 기존 진입 — 다시 읽기 · 함께 읽기 덱**: 목업에는 없지만 이 둘의 유일한 입구가 홈이라 지우면 재독 · 그룹 입구가 끊긴다(이음새 신설 금지). 격자 아래에 기존 ContinueDeck으로 남기되, **그룹이 없는 계정의 「그룹을 만들거나…」 권유 카드는 띄우지 않는다**(`useGroupEntryItem({ invite:false })`). → 오너 확인 필요(9-1).
10. **「읽을거리」 두 장 목록 삭제**: 목업대로 뺐다. 추천은 이어 읽기의 넷째 상태(교재 · 서재 자료가 없는 언어의 추천 한 장)와 서재(MaterialsPage 오늘 추천)로 들어간다.
11. **레벨 어휘**: 정본 어휘 인덱스(`refVocabIndex`)는 중국어만 있다 — 급수 판정은 화면 정본 HSK 2026 표(`zhHskLevelOf`, H1…H7(7–9)) + `vocabCoverage` · `haveWordSet`. 막대 = 아는 단어(이미 앎 ∪ 학습에서 known) / 복습 중(담은 표현 포함 전체 확보), 숫자 = 확보 / 전체. 일본어 · 영어 · 프랑스어는 목업의 「이 언어의 레벨 목록은 준비 중이에요」(JLPT N급 표 없음).
12. **오늘 목표 0%**: 0은 크게 쓰지 않는다(「–」, 목업 신규 사용자 · 0 무표기 선례).
13. **로그인 전 배움**: 목업대로 이어 읽기 + 「오늘 문단 · 맛보기」(목업 예문 고정) + 「로그인하면 여기에 쌓여요」. 칩 · 현황 링크 없음. 현황은 「로그인이 필요해요」 + 로그인 버튼.
14. **히트맵 데이터**: 기존 정본(담은 날 = created_at, KST) 그대로, 168일. 「이번 주」는 칩과 무관(전 언어 거울 — 정정은 레벨 어휘 · 기억 건강 · 아는 단어만 거름).

## 4. 계약과 되돌림 증거

새 계약 `src/lib/__tests__/learnDashboard.test.js`(40) + 갱신 `webNavigation.test.js` · `continueDeck.test.js` · `performanceRepairs.test.js` P5 · `vocabularyLearningConsumers.test.js`.

| 계약 | 되돌린 실험 → 실패한 테스트 |
|---|---|
| 메뉴 셋 · 순서 | MAIN_NAV에서 배움 · 서재 순서 바꿈 → webNavigation 「has three menus in the approved order…」 |
| 소속 /vocab → 배움 | owner 정규식에서 vocab 제거 → 같은 테스트 |
| 숫자 출처 = countReviewScope | learnReviewCount를 projections 직접 세기로 → 「배움 화면이 개수를 직접 세지 않는다…」 |
| 문법 제외 | total + grammarDue → 같은 테스트 |
| 칸 주소 = serializeReviewScope | `` `/vocab?lang=${lang}` `` 손조립 → 「배움 칸 = /vocab?lang=<칩 언어>」 · 「손으로 조립한 /vocab? 주소가 없다」 |
| 기억 건강 fragile 주소 | 손조립 → 「현황 레벨 어휘 줄 = level 범위…」 · 손조립 금지 |
| 휴대폰 순서 = 클래스 | `.learn-order-status{order:3}` 삭제 → 「상태 묶음…맨 아래」 / nth-child로 바꿈 → 위 + 「어디에도 nth-child…」 |
| 국기 0 | LangChips에 🇯🇵 → 「src/components/learn/LangChips.jsx」 |
| 예보 탭 이음새 | `onForecastTap` 전달 제거 → continueDeck 「홈의 알림성 진입이 전부 덱으로 모인다…」 |
| 이어 읽기 목적지 고정 | `!choice.current` 조건 제거 → 「계정 · 판별 교재 기록, 실제 시각 비교, 첫 렌더 뒤 목적지 고정」 |
| 연속 · 방패 없음 | 「연속 · 🛡N」 → 「연속 — …방패 기호 없음」 |
| 홈이 ProfileStats 통째 import 금지(P4) | HomePage에 ProfileStats import → performanceRepairs P4 |
| 한도 입력 공용 | VocabPage에서 reviewScopeQuota 대신 다른 함수 → 「새 표현 한도 입력은 복습방과 같은 함수…」 |

(각 실험은 파일을 바꾼 뒤 해당 테스트만 돌리고 즉시 되돌렸다 — `exit=1`과 실패 테스트 이름 확인.)

## 5. 바뀐 기존 계약 (목적 유지, 단언만 갱신)

| 파일 | 전 | 후 |
|---|---|---|
| `webNavigation.test.js` | 다섯 메뉴 · /study → /vocab | 세 메뉴 · 순서 · /vocab · /review · /study · /learn · /lessons · /books · /progress → /home, /lessons · /vocab 경로 생존 |
| `focusedReader.test.js` | 다섯 라벨, /vocab prefetch false | 세 라벨, /home · /materials prefetch false(/vocab은 메뉴 밖 — P5가 칸을 지킴) |
| `libraryDiscovery.test.js` | /study → /vocab | /study → /home |
| `performanceRepairs.test.js` P5 | MAIN_NAV에 오늘 · 복습 · 내 서재 | 배움 · 서재(prefetch false), /vocab 없음, 단어 복습 칸 `prefetch={false}` |
| `guestLandingParity.test.js` | `href="/lessons"` · `href="/materials"` · `user ? '/vocab' : '/auth'` | 게스트 이어 읽기 = 발행 교재 첫 페이지(`bookHref`), 교재 정보 실패 시 `/lessons`, 로그인 권유 칸(`/auth`), `if (!user) return` 금지 유지 |
| `continueDeck.test.js` | 덱에 `key: 'forecast'` | 예보는 덱이 아니라 오늘 문단 칸 — 같은 알림 두 자리 금지 · forecast_tap 기록 유지 · `useGroupEntryItem({ invite: false })` |
| `studyGroups.test.js` | `useGroupEntryItem()` | `useGroupEntryItem({ invite: false })`(그룹이 있을 때만) |
| `suggestionRank.test.js` 홈 배선 | 상위 2장 · materialFit 사유 줄 | 칩 언어 한 장(순수 랭커) · 교재/자료 없을 때만 조회 · 자료 본문 미조회 |
| `queryDiet.test.js` | join `reading_materials(id, title)` 고정 · ProfileStats isVocabularyReviewDue | 메타 경로 스칼라(language · level)만 추가, 본문 JSON 금지 · 복습 칸은 LearnTiles |
| `profileStatsSelect.test.js` | ProfileStats의 ReviewTile · VocabStats | 조회 = HomePage(요약 snapshot), 렌더 = LearnTiles ReviewTile(word.id · word_text · meaning), 현황 = MemoryHealthCard |
| `weeklyTile.test.js` | `bento--1x1` · `weekly && <WeeklyTile` | `learn-stat`(1×1) · `weekly ? <WeeklyTile … : <StatTile value="–" label="이번 주"`(로드 전에도 같은 자리) |
| `goalPace.test.js` 배선 | GoalTrackCard · DdayTile | useGoalTrack(pace · countRecentDone · buildPlan · markProgress) · 진행바 칸 상시 · 목표 편집은 현황 모달 하나 |
| `goalVocab.test.js` 배선 | 궤도 카드 모달 열 때만 1.9MB 인덱스 | 배움은 어휘 표 · 이미 앎 조회 0, 현황 레벨 어휘는 중국어 칩일 때만 HSK 표(120KB) |
| `vocabularyLearningConsumers.test.js` | `fetchHomeData(…).dueCount === 1` | `learnReviewCount(…) === 1`(같은 회귀) · 언어 밖 0 · 한도 모르면 null |
| `uiConventions.test.js` | VIEWPORT_QUERY_CAP 26 | 25(죽은 .bento 600 블록 제거) |
| `vocabularyLearningUi.test.jsx` | `learning.rows : EMPTY_ROWS` | `ownLearning ? ownLearning.rows : EMPTY_ROWS` — 기준 브랜치 129f275b가 바꾼 표기(이 실패는 기준 브랜치에서 온 것) |

e2e 갱신: `smoke`(메뉴 글자 · 휴대폰 탭 막대 글자 · 새 「learn access」 게스트 배움/현황) · `learning-flow`(복습 메뉴 클릭 → 배움 → 단어 복습 칸 `/vocab?lang=French`, 클라이언트 이동 · 캐시 재조회 유지) · CI 밖: `list-home-clarity`(배움 제목 · 이어 읽기 칸 · 단어 복습 칸 실패/다시 시도 — 예전 「복습」 문단 상태 넷은 칸으로 대체) · `focused-reader`(읽기 메뉴 「배움」) · `web-v2`(정적 갱신) · `suggestion-reading`(홈 「읽을거리」 목록이 없어져 추천 읽기 화면 직행 — 진입 경로 검증은 약해짐, 추천 읽기 화면 검증은 그대로).

## 6. 검사 결과

- `npm test`(Node 24.21.0): 579 파일 · 6851 통과 · 실패 0(병합 뒤 최종).
- eslint 바뀐 파일 0 · `node scripts/check-content.mjs` 오류 0(경고 25 기존) · deadCss · uiConventions · copyStandard 통과.
- e2e(로컬 프로덕션 빌드 `npm run e2e:build`, 최종 빌드 = 병합 뒤):
  - `smoke` + `learning-flow`(자체 서버, PLAYWRIGHT_PORT=8881): 25 통과 · 6 건너뜀(기존 skip) · 실패 0.
  - CI 서재 목록 10파일 + `list-home-clarity` + `suggestion-reading`(서버 8879): 54/54 통과.
  - `focused-reader`(CI 밖): 메뉴 확인(「배움」 · Esc 초점) 통과 뒤 기존 뷰어 단계(단어 도구를 열면 본문 열 x가 340→160) 실패 — 셸 메뉴와 무관한 뷰어 배치 단언이라 이번 범위에서 손대지 않음.
- 화면 확인(합성 계정, 로컬 캡처 · 저장소 밖): 배움 1240 · 390, 현황 1240 · 390, 중국어 칩, 신규, 로그인 전 — 모두 가로 넘침 0(scrollWidth − innerWidth = 0), 콘솔 오류 0. 넓은 화면 격자 4열 159 · 줄 146 · 간격 12, 휴대폰 순서(배움: 이어 읽기 → 단어 복습 → 오늘 문단 → 진행바 → 오늘 목표 · 연속 / 현황: 진행바 → 오늘 목표 · 연속 → 이번 주 · 아는 단어 → 히트맵 → 레벨 어휘 → 기억 건강) 좌표로 확인. 단독 아이콘 버튼 없음(칩 · 버튼 높이 44 이상).
- 실계정 Preview 검수(수용 기준 8)는 **미수행** — PR · Preview는 지시대로 만들지 않았다.
- 번들: `/home` 12.2 kB(첫 로드 193 kB), `/progress` 8.86 kB(177 kB), `/api/goal-catalog` 정적.

## 7. 미룬 것

- 42과 원어 제목(`title_ja`) 콘텐츠 저작(대체 동작만 구현).
- 언어 색 정본 두 벌(textbookTheme ↔ web-shell) 통일 — 범위 밖(인계 §5).
- LANG-LABEL-001 §2(저장소 전역 국기 정리: refLangs · refGrammarManifest · StudyPlanPanel · GrammarReviewSession · refShared 등) — 별도 작업. 이번에는 AK 화면(배움 · 현황 · 메뉴)과 ProfileStats의 `LANG_FLAG` · `{plan.flag}`만 없앴다.
- Noto Serif JP/SC 앱 전역 로드(배포 글꼴 사본 갱신 필요).
- 서재 자료 쪽 수 진도(「3 / 8」) — 저장 데이터 없음.
- web-shell.css의 예전 「오늘」 화면 규칙(`.today-*`)은 이제 쓰이지 않는다(deadCss 계약은 index.css만 검사) — 정리는 별도.
- 렌더 정렬 실측(실제 웹폰트 2배 픽셀, 인계 §6)은 로컬 헤드리스가 Google Fonts 대신 대체 글꼴로 그려 수치 검수를 하지 못했다 — Preview 실기에서 목업 대조 필요.

## 8. 오너 확인이 필요한 것

1. 목업에 없는 「다시 읽기 · 함께 읽기」 덱을 배움 격자 아래에 남겼다(재독 · 그룹의 유일한 입구라서). 빼려면 다른 입구(서재 등)를 정해야 한다.
2. 「읽을거리」 두 장 목록은 목업대로 뺐다 — 추천은 이어 읽기 넷째 상태와 서재로만 들어간다.
3. 레벨 어휘는 중국어만(HSK 2026) — 일본어 N급 어휘 표가 없어 목업의 N5–N1 줄은 「준비 중」으로 나온다.
