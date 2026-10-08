# 뷰어 v2 AE-R2 — 문장 탭 선처리 구현 설계서

- 작성: 2026-10-07 KST · 설계 에이전트(코드 무변경, 이 문서만 커밋)
- 기준: main `5699a14a`(R0 #1352·#1355 병합) 위에 병합 예정인 #1354(`claude/viewer-r0-css` `9c369cc5`)·#1356(`claude/viewer-r0-sheet` `7c54a9ec`)을 **로컬에서 합친 상태**. 충돌 두 곳(ci.yml e2e 목록, `ViewerPage.jsx` 토큰 렌더의 `patternMark` 줄)은 두 쪽을 모두 살려 풀었다. 행 번호는 모두 이 합친 상태 기준이고, 실제 병합 뒤 몇 줄 밀릴 수 있다.
- 정본: VIEWER-V2-ROUNDS-001(이하 「정본」) §0.2·§2.2·§4·§10·§11. 그 위에 오너 결정 셋이 우선한다: ⑴ 단어창 「AI」 표시 없음(10-07 23:45) ⑵ R0 버그 9로 「탭하면 발음 보기」·「암기 확인」 제거 ⑶ R0 버그 11로 「만난 말」 = 새 단어 표시.
- 선행: AE-R1 설계서(`claude/viewer-v2-ae-r1` `c45559dd`, `docs/manabi-viewer-v2-ae-r1.md`). AE-R2는 AE-R1 PR②(골격·「번역」 버튼 제거)가 병합된 뒤를 전제로 한다.
- 측정: 코드 실측 + 해시 비용 실측(Node 24) + TanStack Query 5.95.2 소스 확인. 운영 DB·실계정·실제 Gemini 응답은 보지 않았다. 측정하지 못한 것은 「미측정」으로 적었다.

---

## 0. 결론

1. **「`runSelectedSentence(sel, true)` 재사용」은 그대로는 안 된다.** 이 함수는 패널 상태(`setLeftPanelText/Loading/Result`)를 바로 바꾸고 `selectionGate`로 다른 요청을 취소한다(`ViewerPage.jsx:1279-1300`). 선처리가 이것을 부르면 `leftActive`가 올라 시트가 [문장] 탭으로 넘어가고(`ViewerBottomSheet.jsx:5-7`), 열린 단어 상세 요청까지 끊긴다. **번역 핵심(교재 맵 → `viewer_tx` → AI)만 순수 모듈로 뽑아 TanStack Query 한 키로 감싸고**, 선처리·[문장] 탭·문장 막대 「번역」·드래그가 모두 그 키를 쓰게 한다. 이것이 「같은 경로 재사용」의 실제 모양이다(§2).
2. **single-flight는 TanStack Query가 이미 해 준다.** `queryClient.fetchQuery`는 같은 키의 진행 중 요청을 합친다. 키는 지금 localStorage 키 그대로 `viewerCacheKey('viewer_tx', cacheScope, 문장)` — 이미 `:v2:` 버전이 붙은 SHA-256이고 자르지 않는다(`viewerReliability.js:33-37`). 120자 자르기는 `ctxExplain.js:7-8`에만 있다(AE-R1이 그 버튼을 내린다).
3. **「시트를 닫아도 받기 완료」는 쿼리 함수가 `signal`을 쓰지 않으면 저절로 된다.** query-core 5.95.2는 관찰자가 0이 될 때 signal을 소비한 쿼리만 취소하고, 아니면 재시도만 멈춘다(`query-core/build/modern/query.js:148-162`). 단 앱 기본값이 `retry: 1`(`providers.jsx:13`)이고 `callGemini`가 용량 오류에 최대 4회 재시도한다(`gemini.js:67-87`) — 선처리 키는 `retry:false` + 재시도 0으로 묶어야 「AI 1회」가 성립한다.
4. **light 등급 경로는 이미 있다.** `callGemini(prompt, null, {tier:'light'})` → `/api/gemini` `resolveTier` → `callLLM('light')` → `gemini-3.5-flash-lite`(폴백 모델 없음, 그다음 Groq)(`llm.js:28-31`). 지금 번역은 기본 `standard`(`gemini.js:3`). 같은 키를 쓰므로 **선처리만 light로 하면 경로에 따라 품질이 갈린다** → 등급은 번역 경로 전체에 한 상수로 둔다(Q2).
5. **레이트 리밋은 IP가 아니라 사용자 단위다.** 주석은 「IP별」이지만 키는 `u:${authUser.id}`이고 인스턴스 메모리라 재시작 때 비워진다(`api/gemini/route.js:15-20,84`). 분당 60회는 유의어·상세 설명·더 쉽게·자세히·퀴즈와 **공유**한다. 선처리는 「서로 다른 줄에서 0.3초 이상 머문 카드 수」만큼 늘어 보통 분당 한 자릿수다. 429면 재시도하지 않고 조용히 포기한다.
6. **학습 이벤트 0은 「드래그 목록을 건드리지 않는다」로 지켜진다.** 뷰어의 만남 기록은 `dragTokens`가 생길 때만 남는다(`ViewerPage.jsx:998-1031`). 선처리는 `dragTokens`·`review_events`·`recordVocabEncounters`를 건드리지 않는다. [문장] 탭의 「단어별 뜻」도 드래그 재분석(`/api/analyze`)이 아니라 **자료 토큰**에서 만든다 — 재분석을 쓰면 탭을 여는 것만으로 만남이 기록된다(§3.3).
7. **「AA 계층」은 서버 `[llm]` 구조화 로그 + 인메모리 집계 + `/api/admin/llm-stats`다**(`llm.js:22-25,56-91`). 프록시는 route를 `'gemini-proxy'` 하나로 찍어(`api/gemini/route.js:167`) 선처리 호출을 구분하지 못하고, 적중률(탭을 열 때 준비됐나)은 클라이언트만 안다. `review_events` `source:'ui'`(architecture §4.9)는 「학습 이벤트 0」 합격과 「월 1만 건 미만」 전제에 걸려 쓰지 않는다 → 측정 수단은 Q3.
8. **같이 고칠 것 3건의 원인은 모두 확인됐다**(§5): 더 쉽게·자세히 초기화가 드래그 경로에만 있다 · 노트 저장이 탭 본문(`leftPanelText`)이 아니라 `selectedRangeText`를 쓴다 · 상세 설명·문맥 설명이 `base_form`(歉)으로 찾는다.
9. **AE-R1 Q1과의 관계**: AE-R1이 「[문장] 탭 누르기 = 기존 번역 경로」를 넣었으면 AE-R2는 그 트리거를 쿼리 구독으로 바꾸기만 하면 된다. 안 넣었으면 AE-R2 PR③이 넣는다. 어느 쪽이든 [문장] 탭은 **선처리 전이라도 누르면 바로 같은 키로 시작**한다(0.3초 대기 없음).
10. **세 PR로 나눈다**: ① 같이 고칠 것 3건(독립, 작음) → ② 번역 단일 키 + 선처리 + 측정(화면 변화 거의 0) → ③ [문장] 탭 재배치. ②는 AE-R1 PR② 뒤에 한다(§8).

---

## 1. 현행 지도

### 1.1 번역이 시작되는 다섯 길

| 길 | 트리거 | 호출 | 결과가 가는 곳 | 수업 모드 |
|---|---|---|---|---|
| 단어창 「번역」 버튼 | 사용자가 누름 | `runSelectedSentence(ctxSentenceOf(token), true)`(`ViewerPage.jsx:2329`) | 문장 탭(`sentenceTabSignal`) | `runSelectionAnalysis`(번역 + 재분석) |
| 문장 막대(¦) 탭 | 집중 꺼짐 또는 지정된 문장 재탭 | `runSelectionAnalysis(lineHead.text)`(`:3052`) | 번역 + 오른쪽 단어 목록(재분석) | 같음 |
| 문장 이동 막대 「번역」 | R0 버그 4 | `translatePickedSentence`(`:1389-1396`) → `runSelectionAnalysis` | 같음 | 막대 없음 |
| 드래그 범위 | 범위 확정 | `tokenRange.onSelect`(`:1053-1066`) → `runSelectionAnalysis` | 같음 | 같음 |
| ^/v 이동(집중 꺼짐) | 이동 | `moveSentence`(`:1137-1158`) → `runSelectionAnalysis` | 같음 | — |

AE-R1 PR②가 첫 번째 길(「번역」 버튼)을 지운다. 그 뒤 단어창에서 번역으로 가는 길은 [문장] 탭뿐이다.

### 1.2 `runSelectedSentence` 안(`:1279-1380`)

| 단계 | 코드 | 문제(선처리 관점) |
|---|---|---|
| 요청 문 열기 | `selectionGate.current.start()` — 진행 중인 다른 문장 요청을 **취소** | 선처리가 이것을 쓰면 사용자가 연 요청을 끊는다 |
| 45초 마감 | `setTimeout(...45000)` | 패널 문구를 바꾼다 |
| 상세 취소 | `if (!preserveOpenWord) detailGate.current.cancel()` | 단어 상세 요청을 끊을 수 있다 |
| 패널 상태 | `setLeftPanelText(sel); setLeftPanelLoading(true); setLeftPanelResult('')` | `leftActive` 상승 → 시트가 [문장] 탭으로 넘어감(`resolveSignalTransition`) |
| 교재 맵 | `lookupTranslation(locale==='ko' ? metadata.translations : null, sel)`(`:1312`, `bilingualSplit.js:138-148` — 정확 일치만, 여러 줄은 모든 줄이 있을 때만) | 재사용 |
| 캐시 | `viewerCacheKey('viewer_tx', cacheScope, sel)` → localStorage(`:1313-1315`) | 재사용 |
| AI | ko: `callGemini(buildContextPrompt(sel, langName), request.signal)` · 그 밖: `buildViewerSentencePrompt` + `parseViewerExplanation`(`:1320-1323`) | signal을 넘겨 사용자가 다른 단어를 누르면 끊긴다(`handleTokenClick`이 `selectionGate.cancel()`, `:745`) |
| 저장 | `localStorage.setItem(cacheKey, text)`(`:1331`) | 현재 요청일 때만 저장 → 끊기면 저장도 없다 |
| 단어 분석 | `explanationOnly`가 아니면 `/api/analyze` 재분석 + `dragTokens`(`:1337-1373`) | 만남 기록으로 이어진다(§3.3) |

부수 관찰:
- **카드 문장과 막대 문장의 키가 다르다.** 카드는 `ctxSentenceOf`(원문 줄 그대로, `:863-868`), 막대·이동은 `cleanLineText`(앞뒤 공백·`# ` 제목 표지 제거, `sentenceNav.js:8-10`)다. 제목 줄이나 앞뒤 공백이 있는 줄이면 같은 문장이 캐시를 두 번 만든다.
- **단어를 누르면 이전 문장의 번역이 탭에 남는다.** `handleTokenClick`은 `setLeftPanelLoading(false)`만 하고 `leftPanelText/Result`는 그대로 둔다(`:745-747`). 다른 줄의 단어를 열고 [문장] 탭을 보면 앞 문장의 번역이 보인다. AE-R2가 탭 내용을 카드 문장의 쿼리에서 그리면 함께 고쳐진다.
- **표시만 120자에서 자른다**: `leftPanelText.slice(0,120)+'…'`(`:2610`). 키는 자르지 않는다.

### 1.3 [문장] 탭이 지금 그리는 것(`leftPanelContent`, `:2601-2715`)

```
(로딩)   「번역 + 맥락 생성 중...」 — 탭 전체가 이 한 줄
(결과)   번역 · 맥락                              ← 제목
         "원문(120자 자름)"            [🔊][🎧]
         formatDetail(번역/맥락/말투)
         [🔤 더 쉽게 ▾]  → 펼치면 쉬운 문장
         [📖 자세히 ▾]   → 펼치면 문법 해설 · 정본 링크 · [노트에 저장] · 추가 질문
(없음)   「텍스트를 드래그하면 / 번역과 맥락이 여기에」
```

정본 §4의 순서(원문(누른 단어 칠) → 번역 → [더 쉽게][자세히] → 문형 → 단어별 뜻)와 비교하면: 누른 단어 칠 없음, 문형 없음, 단어별 뜻 없음(드래그면 오른쪽 탭에 목록), 로딩이 탭 전체를 덮음.

---

## 2. 목표 지도

### 2.1 부품

| 부품 | 재사용 | 새로 만들 것 | 위치 제안 |
|---|---|---|---|
| 번역 핵심 | `lookupTranslation`·`bookMeaningPanelText`(`bilingualSplit.js`), `viewerCacheKey`, `buildContextPrompt`·`buildViewerSentencePrompt`·`parseViewerExplanation`·`formatViewerExplanation`, `callGemini` | `fetchSentenceTranslation({sel, locale, language, translations, cacheKey, allowAi, tier})` — 교재 맵 → localStorage → (allowAi면) AI → localStorage 저장. **signal을 받지 않는다** | `src/lib/sentenceTranslation.js`(신규) |
| 쿼리 옵션 | TanStack Query(이미 의존성 5.95.2), 앱 `QueryClient` | `sentenceTranslationQuery({key, ...})` = `{queryKey:['viewer-sentence-tx', key], queryFn, retry:false, staleTime:Infinity, gcTime:30분}` | 같은 파일 |
| 문장 키 | `viewerCacheKey('viewer_tx', cacheScope, sel)`(형식 불변 — 기존 캐시·`learning-flow.e2e.mjs:794`의 사전 시드 키와 호환) | `canonicalSentence(text)` = `cleanLineText`(막대와 같은 정리). 키 계산은 문장당 1회 메모 | 같은 파일 |
| 선처리 훅 | `isSheetOpen`, `selectedToken`, `classStudyActive`, `user` | `useSentencePrefetch({open, lineKey, enabled, start})` — 같은 **줄**(`id_<줄>_`의 줄 번호)에 0.3초 머물면 `start()` 1회. 줄이 바뀌거나 닫히면 타이머 취소. 같은 줄의 다른 단어를 눌러도 타이머를 다시 세지 않는다 | `src/lib/useSentencePrefetch.js`(신규) |
| 사용자가 연 번역 | `runSelectedSentence`의 패널 상태·마감·재분석 부분 | 번역 부분만 `queryClient.fetchQuery(sentenceTranslationQuery(...))`로 교체 → 진행 중 선처리와 합쳐진다. 결과가 오면 `current()`일 때만 패널에 반영 | `ViewerPage.jsx` |
| [문장] 탭 표시 | `leftPanelContent` 골격, `formatDetail`, 듣기·받아쓰기 버튼, `easier`·`grammar` 훅 | 카드에서 연 경우 **카드 문장의 쿼리 상태**로 그린다(`useQuery(...{enabled: tabOpen})`). 순서 재배치·문형·단어별 뜻(§3) | `ViewerPage.jsx` + 순수 함수 `sentenceWordGlosses`(`src/lib/viewerSentenceGlosses.js`) |
| 측정 | 서버 `[llm]` 로그(AA R2) | 프록시 route 꼬리표(§4.2), 클라이언트 세션 집계(Q3) | `api/gemini/route.js`·`sentenceTranslation.js` |

### 2.2 흐름

```
단어 탭 ──► 카드 T0
   │
   ├─ (같은 줄 0.3초) ─► useSentencePrefetch.start()
   │                       └─ queryClient.prefetchQuery(key)   ← 관찰자 없음 · signal 미사용
   │                            ├─ 교재 맵 적중 → 끝(요청 0)
   │                            ├─ viewer_tx 적중 → 끝(요청 0)
   │                            └─ 로그인 사용자 → AI 1회(tier 상수, 재시도 0) → viewer_tx 저장
   │
   ├─ [문장] 탭 누름 ─► useQuery(key, enabled) — 이미 끝났으면 즉시, 진행 중이면 그 요청에 합류,
   │                    아직 안 시작했으면 지금 시작(0.3초 대기 없음)
   │
   ├─ 다른 줄 단어 탭 ─► 타이머 취소(시작 전이면 0회). 이미 시작한 요청은 끝까지 받아 저장
   └─ 시트 닫기       ─► 같음
```

### 2.3 키 설계

| 항목 | 값 | 근거 |
|---|---|---|
| 문장 | `canonicalSentence(ctxSentenceOf(token))` — 원문 **줄** 전체, 자르지 않음 | 교재 맵(`metadata.translations`)이 줄 단위이고, 기존 `viewer_tx` 캐시도 줄 단위다. AE-R1 문장 줄(한 문장)과의 관계는 Q1 |
| 범위(scope) | 기존 `cacheScope`(사용자·자료·언어·[설명 언어]·원문·`processed_json`, `ViewerPage.jsx:349-352`) | 계정/자료/판본/뜻이 바뀌면 다른 키(기존 원칙). 교정 1회로 그 자료의 키가 모두 바뀌는 것도 기존 그대로 |
| 버전 | `viewer_tx:v2:` 유지 | 프롬프트가 바뀌지 않는다. 등급(light)은 키에 넣지 않는다 — 넣으면 기존 캐시가 모두 무효가 되고 사용자당 한 번씩 AI 호출이 다시 생긴다. 등급을 나중에 올리면 그때 `v3`로 올린다 |
| TanStack 키 | `['viewer-sentence-tx', <viewer_tx 키 문자열>]` | localStorage 키와 1:1, 같은 키면 같은 요청 |
| 해시 비용 | 실측(Node 24, 이 컨테이너): 토큰 500개 2.0ms · 2,000개 8.8ms · 6,000개 21.5ms / 키 1개 | 범위에 원문·`processed_json` 전체가 들어가서다. 폰은 3~5배로 보고 0.3초 대기 안에 끝난다. 줄별 키는 메모(Map)해 같은 줄 재탭 때 다시 계산하지 않는다 |

### 2.4 등급(light)의 실제 경로

```
클라  callGemini(prompt, null, { tier: SENTENCE_TX_TIER })        gemini.js:67
  └─ POST /api/gemini { contents, tier }                           gemini.js:16-27
서버  인증(없으면 401) → 사용자 레이트 리밋(분당 60) → resolveTier    route.js:61-84,117
  └─ callLLM('light', contents, { route })                        route.js:165-168
       └─ TIERS.light = gemini-3.5-flash-lite, fallbacks []        llm.js:28-31
          → 실패 시 Groq(qwen, 키 있을 때) → `[llm]` 로그 1줄
```

지켜야 할 함정:
- `callGemini(prompt, signal, opts)`의 `opts`는 `callGeminiOnce`에서 `{tier, model, ...generationConfig}`로 펼쳐져 **나머지가 모두 `generationConfig`로 서버에 실린다**(`gemini.js:5,26`). 재시도 횟수 같은 새 옵션을 그대로 넣으면 Gemini가 모르는 필드로 400을 낸다. 새 옵션은 `callGemini`에서 먼저 빼고 넘긴다(예: `const {retries = 4, ...rest} = opts`).
- `llm.test.js:79-87`은 「클라는 `GEMINI_TIER`만 안다, 훅 3곳은 `{ tier: GEMINI_TIER }`」를 고정한다. 번역 등급 상수를 따로 두면 이 계약에 한 줄을 더한다(개정 목록 §6.1).

---

## 3. [문장] 탭

### 3.1 순서와 상태

| 칸 | 출처 | 준비 전 | 비고 |
|---|---|---|---|
| 원문 줄(누른 단어 칠) + 🔊 🎧 | 원문 줄 + 누른 토큰 위치(AE-R1 `sentenceAroundToken`이 주는 글자 위치 재사용) | T0 | 120자 자르기 없앰. 3줄 넘으면 단어 앞뒤만 보이고 …(AE-R1 문장 줄과 같은 예산 함수) |
| 번역 | 쿼리 | **이 칸에만** 「번역 중…」 한 줄(높이 예약) | 교재 맵이면 「📘 교재에 실린 뜻이에요.」 그대로. 게스트이고 캐시가 없으면 「로그인하면 번역을 볼 수 있어요」(Q4) |
| [더 쉽게] [자세히] | `easier`·`grammar` 훅 | 버튼은 T0(번역과 무관) | 문장 키별 초기화(§5.1) |
| 문형 | `visibleScan.hits` 중 이 줄 토큰에 걸린 것 | 문법 표시 켬일 때 T0 | AE-R1 「문형 한 줄」과 같은 요약 문구·`PatternCard` 재사용 |
| 단어별 뜻 | `processed_json` 이 줄 토큰(§3.3) | T0 | 탭 이름에는 표시 없음(정본) |

- 탭 이름은 「문장」 그대로이고 점·뱃지를 달지 않는다(v2-AE 2차 확정).
- 스켈레톤·스피너는 번역 칸에만(정본 §2.2, NN/g). 나머지 칸은 T0라 위치가 움직이지 않는다 — 번역이 늦게 와도 **원문 줄과 번역 칸 머리의 위치는 그대로**이고, 그 아래(더 쉽게…)만 밀린다. 번역 칸 높이는 「번역 중…」 한 줄만 예약한다(길이를 미리 알 수 없다).

### 3.2 무엇이 탭을 채우나

| 탭을 연 경로 | 탭 내용의 원천 |
|---|---|
| 카드에서 [문장] 탭 | 카드 문장의 쿼리(`useQuery`) — 선처리와 같은 키 |
| 문장 막대(¦)·이동 막대 「번역」·드래그 | 지금처럼 `runSelectionAnalysis` → 패널 상태. 번역 부분은 같은 키의 `fetchQuery`라 이미 선처리됐으면 요청 0 |
| 수업 모드 | 지금 그대로(`runSelectionAnalysis`·패널 상태). 선처리 0 |

두 원천을 한 렌더 함수가 받도록 `sentencePanel({text, highlight, status, result, glosses, patterns})` 형태로 정리하면 수업 화면(`ClassroomReader` `sentenceContent`)도 같은 마크업을 쓴다.

### 3.3 단어별 뜻 — 자료 토큰에서

- 함수: `sentenceWordGlosses(json, tokenIds)` → `[{text, reading, meaning, key}]`. 기호·개행 제외, **키는 `sep_link || base_form || text`**(이합사 O 조각 歉은 VO 道歉로 합쳐진다 — 지금 드래그 목록은 `base_form || text`로 합쳐 歉이 따로 남는다, `ViewerPage.jsx:1356`).
- 드래그 재분석 목록(`dragTokens`)을 쓰지 않는 이유: ① `/api/analyze` 요청이 생긴다(선처리 요청 수 계약과 충돌) ② `dragTokens`가 생기면 만남 기록이 남는다(`:998-1031`) — 「학습 이벤트 0」 위반 ③ 자료 토큰은 이미 화면의 뜻과 같다(교정 반영).
- 드래그·막대로 연 경우는 지금처럼 오른쪽 탭의 단어 목록이 있다. [문장] 탭의 단어별 뜻은 같은 범위 토큰으로 그린다(목록과 중복이지만 탭이 다르다 — 정본 순서 유지).

---

## 4. 기록 · 측정

### 4.1 학습 이벤트 0 — 무엇을 건드리지 않나

| 경로 | 선처리 | [문장] 탭 열기(카드 경로) |
|---|---|---|
| `review_events`(`logReviewEvents`) | 0 | 0 |
| 만남 기록(`recordVocabEncounters`, localStorage) | 0 — `dragTokens` 무변경 | 0 — 단어별 뜻은 자료 토큰 |
| `/api/analyze` 재분석 | 0 | 0 |
| FSRS·단어장·`token_corrections` | 0 | 0 |
| localStorage `viewer_tx` | 쓰기 1(결과) | 읽기 |

### 4.2 측정 — 적중률 · 낭비 호출

| 지표 | 정의 | 어디서 아나 |
|---|---|---|
| 선처리 시작 | 0.3초 조건을 채워 `prefetchQuery`를 부른 수 | 클라이언트 |
| 선처리 AI | 그중 교재 맵·캐시가 없어 AI까지 간 수 | 클라이언트 + 서버(route 꼬리표) |
| 탭 열기(카드 경로) | 카드에서 [문장] 탭을 연 수 | 클라이언트 |
| **적중** | 탭을 연 순간 쿼리가 `success` | 클라이언트 |
| 합류 | 탭을 연 순간 `fetching`(선처리 진행 중) — 적중률 분모에는 넣고 분자에는 넣지 않는다 | 클라이언트 |
| **낭비 호출** | 선처리 AI 중 그 문장 키의 탭이 세션 끝까지 한 번도 안 열린 수 | 클라이언트(세션 끝에 집계) |
| 비용 | 선처리 AI의 in/out 토큰 | 서버 `[llm]` 로그(route 꼬리표로 분리) |

목표: 적중률 80% 이상(정본). 낭비 호출은 목표값이 없고 보고만 한다(공개 선례가 없어서 재는 것이다 — 정본).

수단(설계 세션 결정 필요, Q3):
- **(가) 서버 route 꼬리표만**: `/api/gemini` 본문에 허용 목록 `purpose`(`'viewer-sentence'`·`'viewer-sentence-prefetch'`)를 받아 `route: 'gemini-proxy:<purpose>'`로 찍는다. 스키마 0, AA 로그·`llm-stats`가 그대로 나눠 센다. 적중률은 못 잰다.
- **(나) (가) + 클라이언트 세션 요약 1줄**: 자료를 떠날 때(`pagehide`) `navigator.sendBeacon`으로 `{starts, aiStarts, opens, hits, joins, wasted}` 숫자만 보내는 경량 경로(새 API 라우트, DB 0, `[viewer-prefetch]` 구조화 로그 1줄 + `llm-stats` 옆 인메모리 집계). 원문·단어·사용자 식별자는 싣지 않는다. 자료 세션당 1건.
- **(다) 측정 세션만**: 제품에는 (가)만 넣고, 적중률은 Preview에서 정상 실계정으로 정해진 읽기 대본(자료 3개 × 단어 탭 30회)을 돌려 개발자 도구 카운터(`window.__viewerPrefetchStats`, 개발·Preview 빌드만)로 잰다.
- 배제: `review_events` `source:'ui'` — 「학습 이벤트 0」 합격(e2e가 `review_events` POST 0을 본다)과 §4.9의 「하루 수 건·월 1만 건 미만」 전제에 맞지 않는다(카드 열기마다 생긴다).

제안: **(가) + (다)** 로 시작하고, 운영 적중률이 필요해지면 (나). 근거: 새 수집 경로는 개인정보 검토가 따로 필요하고, 정본이 요구한 것은 「잰다」이지 상시 수집이 아니다.

### 4.3 레이트 리밋 영향

- 키: 사용자(`u:<id>`), 분당 60, 인스턴스 메모리(재시작 때 초기화, 인스턴스가 여럿이면 실제 상한은 그보다 크다).
- 선처리 상한: 줄(문장)마다 1회, 같은 줄 재탭 0회, 캐시 적중 0회. 빠르게 넘기며 읽어도 0.3초 머문 서로 다른 줄 수만큼 — 실제 사용에서는 분당 한 자릿수로 본다(미측정).
- 429·503: 선처리는 재시도 0(정본 「AI 1회」), 실패는 조용히 버린다(캐시에 쓰지 않음). 사용자가 탭을 열면 그때 한 번 더 시도한다(사용자 행동 = 새 요청, 지금의 재시도 정책 유지).
- 다른 기능과 겹칠 때: 선처리가 60회 창을 먼저 채우는 일을 막기 위해 **클라이언트 상한**을 둔다(제안: 선처리 AI 분당 20회, 넘으면 그 분 동안 선처리 중지). 숫자는 개발 세션 제안값.

---

## 5. 같이 고칠 것 3건 — 현행 원인

### 5.1 더 쉽게 · 자세히가 문장이 바뀌어도 남는다

- 훅 안 초기화는 `requestScope`(언어·설명 언어·`cacheScope`) 변화에만 걸린다(`useEasierText.js:24-31`, `useGrammarDetail.js:57-63`). 문장은 범위에 없다.
- 문장이 바뀔 때 `grammar.reset()`·`easier.reset()`을 부르는 곳은 **드래그 확정 하나뿐**이다(`ViewerPage.jsx:1061-1062`). 막대(¦) 탭(`:3052`), ^/v 이동(`:1145`), 이동 막대 「번역」(`:1395`), 단어창 「번역」(`:2329`), 수업 출처 복원(`:2773`)은 부르지 않는다.
- 그래서 A 문장에서 [자세히]를 연 뒤 막대로 B 문장을 번역하면 B의 번역 아래에 A의 문법 해설이 남는다. 결과 캐시 키는 문장별이라 데이터는 섞이지 않고 **화면만** 낡는다.
- 고침: 두 훅이 결과와 함께 **그 결과의 문장**을 들고(`forText`), 표시할 때 `forText === 지금 탭 문장`이 아니면 닫힌 상태로 그린다. 진행 중 요청은 문장이 바뀌면 취소한다. 호출부마다 `reset()`을 흩어 부르는 방식보다 빠뜨릴 곳이 없다. 드래그 경로의 기존 `reset()` 쌍은 남긴다(`easierText.test.js:80` 계약).

### 5.2 노트 저장의 선택 문장이 비거나 낡는다

- `useGrammarNoteSave({selectedText: selectedRangeText, explanation: grammar.result})`(`ViewerPage.jsx:596-601`, `useGrammarNoteSave.js:9-18`).
- 해설은 탭 본문 `leftPanelText`로 만든다(`grammar.run(leftPanelText)`, `:2657`). 그런데 `selectedRangeText`는 막대·드래그·이동에서만 채워지고(`:736,1060,1143,1393,2773,3048`), 지정 해제 때 `''`가 된다(`:1272`). 단어창 「번역」 경로는 `leftPanelText`만 바꾸고 `selectedRangeText`는 그대로 둔다.
- 결과: 단어창에서 연 문장의 해설을 저장하면 `selected_text`가 `''`(지정 없음) 또는 **앞서 지정했던 다른 문장**이 된다. 열(`grammar_notes.selected_text`)은 `NOT NULL`이지만 빈 문자열은 통과한다(`supabase/migrations/20260329000500_reading_progress.sql:24`).
- 고침: 저장할 문장 = 해설을 만든 문장(§5.1의 `grammar.forText`). 비어 있으면 저장 버튼을 그리지 않는다. 이미 저장된 행은 손대지 않는다(보존).

### 5.3 이합사에서 설명이 `sep_link`가 아니라 `base_form`을 쓴다

- 토큰 구조: 이합사 O 조각(道了歉의 歉)은 `base_form = '歉'`, `sep_link = '道歉'`이고, 어휘 키는 `sep_link ?? base_form`이다(`tokenizeZh.js:97-103`, `ViewerPage.jsx:1718-1719`). 조회·저장·만남은 이미 이 규칙을 따른다.
- 어기는 곳:
  - 상세 설명 `fetchWordDetailText`: `const baseForm = token.base_form || token.text`로 localStorage 키·`/api/word-detail?base_form=`·프롬프트를 만든다(`wordDetail.js:52-53`) → 歉을 누르면 「歉」의 설명을 만들고 저장한다. 공유 `detail_text`가 歉 행에 붙을 수 있다.
  - 문맥 설명 `fetchCtxExplain`: `base: token.base_form`(`ctxExplain.js:47`). AE-R1이 카드 버튼을 내리지만 클라이언트 함수와 서버 분기는 남긴다고 했으므로 함께 고친다.
  - 한국어 상세(`ViewerPage.jsx:974,978`)는 `base_form`을 쓰지만 한국어 토큰에는 `sep_link`가 없어 영향 없음.
- 고침: 두 함수 모두 `lexKey = token.sep_link || token.base_form || token.text`. 프롬프트 표제도 VO(「道歉 (명사)」)로. 기존 localStorage `pdf_cache:detail:Chinese:歉` 같은 낡은 키는 읽지 않게 되고(지우지는 않는다), DB의 歉 행 `detail_text`는 손대지 않는다(보존 — 정리는 보고만).

---

## 6. 계약

### 6.1 개정 — 정본 §10 목록 + 빠진 파일

| 파일 | 걸리는 단언 | 개정 | 근거 절 |
|---|---|---|---|
| `src/lib/__tests__/bilingualSplit.test.js` 「뷰어 배선 — runSelectionAnalysis가 캐시·Gemini보다 먼저 translations를 본다」(`:128-141`) | `ViewerPage`의 `runSelectionAnalysis…useInlineReview` 조각 안에서 `lookupTranslation` → `viewerCacheKey('viewer_tx'` → `callGemini(buildContextPrompt(` 순서, `cached ? Promise.resolve() : callGemini(` 문자열 | **정본 §10에 없음.** 순서 단언을 새 모듈 `sentenceTranslation.js`로 옮기고, `ViewerPage`는 그 모듈의 쿼리를 쓴다는 단언으로 바꾼다. 「교재 맵 적중 → 번역 요청 0」 성질은 단위 테스트로 유지 | §4 순서 |
| `src/lib/server/__tests__/llm.test.js` 「클라는 GEMINI_TIER만 안다 — 호출부 3곳도 티어」(`:79-87`) | 훅 3곳 `{ tier: GEMINI_TIER }` | 정본 §10에 없음. 번역 등급 상수(예: `SENTENCE_TX_TIER`)를 `gemini.js`에 두고 「번역 경로는 그 상수를 body.tier로」 한 줄 추가. 기존 단언은 유지 | §4 모델 등급 |
| 같은 파일 `CALL_SITES` 프록시(`:43-45`) | `callLLM(resolved.tier, contents, {` | route 꼬리표(§4.2 가)를 넣으면 프록시 단언에 `route:` 허용 목록 한 줄 추가 | §4 기록 |
| `e2e/viewer-language-settings.e2e.mjs`(CI) `:212-218`·`:300-306` | 「UI만 바꾸면 설명 호출 수 불변」 — 기준 수를 잡는 시점이 카드 열고 0.3초 뒤라 선처리 요청이 기준 앞/뒤로 섞일 수 있다(경쟁) | 정본 §10에 없음. 기준을 잡기 전에 선처리 요청(문장 프롬프트 1건)이 도착할 때까지 기다린다. 단언 자체(UI 변경 = 추가 호출 0)는 유지 | §4 |
| `e2e/viewer-focus-move.e2e.mjs`(CI, #1356) `:319-329` | 이동 막대 「번역」 = 문장 요청 1·분석 1·그 밖 0 | 막대 경로에는 카드가 없어 선처리가 없다 → 무수정으로 서야 한다. 같은 파일의 390px 단어창 시나리오는 카드를 연 뒤 0.3초 넘게 머문다 → `/api/gemini` 1건이 생긴다. 이 파일은 요청 수를 그 시나리오에서 세지 않아 무수정 예상(확인 필요) | — |
| `e2e/learning-flow.e2e.mjs`(CI 밖) `:794,847` | 사전 시드한 `viewer_tx` 키로 「Gemini 0회」 | 키 형식 불변이라 무수정. 단 `canonicalSentence`가 원문 줄과 달라지는 줄(앞뒤 공백·제목)이면 시드 키를 맞춘다 | §2.3 |
| `src/lib/__tests__/easierText.test.js` `:80`, `grammarDetail.test.js` `:129` | 드래그 경로 `grammar.reset(); easier.reset();` | 유지(지우지 않는다). §5.1 고침은 더하기만 | §4 같이 고칠 것 |
| `src/views/__tests__/ctxExplainWiring.test.js` | AE-R1 개정분 | §5.3이 `ctxExplain.js`의 `base:` 값을 바꾸지만 이 파일에 `base` 값 단언은 없다(grep 0) → 추가 개정 없음 | — |
| `wordCardOrder.test.js`·`viewerSheetCard.test.js` 등 AE-R1 목록 | — | AE-R2는 단어 탭 마크업을 바꾸지 않는다 → 추가 개정 없음 | — |

### 6.2 새 계약

| 계약 | 파일(제안) | 방법 |
|---|---|---|
| 순서·게스트·자르기 없음 | `src/lib/__tests__/sentenceTranslation.test.js` | 순수 함수에 가짜 저장소·가짜 `callGemini`: 교재 맵 적중 → 저장소 읽기 0·AI 0 / 캐시 적중 → AI 0 / 게스트(`allowAi:false`) → AI 0·결과 `null` / 로그인 → AI 1·저장 1 / 500자 문장 두 개가 마지막 글자만 달라도 키가 다르다(자르기 없음) / `callGemini` 옵션에 재시도 0이 실리고 `generationConfig`로 새지 않는다 |
| single-flight · 닫아도 저장 | 같은 파일 | 실제 `QueryClient`로 `prefetchQuery` 두 번 + `fetchQuery` 한 번 → AI 1회. 관찰자를 붙였다 떼도(시트 닫기) 요청이 끝나고 저장소에 쓴다. 실패하면 재시도 0·저장 0 |
| 0.3초 머무름 | `src/lib/__tests__/useSentencePrefetch.test.js` | 가짜 타이머: 299ms에 닫기 → 0 / 같은 줄 다른 단어 → 타이머 유지(300ms에 1) / 다른 줄 → 다시 셈 / `enabled:false`(수업 모드) → 0 / 키 없음(무id 리스트 단어) → 0 |
| 학습 이벤트 0(소스) | `src/views/__tests__/sentencePrefetchWiring.test.js` | 선처리 경로 조각에 `logReviewEvents`·`recordVocabEncounters`·`setDragTokens`·`/api/analyze`·`setLeftPanel` 0. `classStudyActive`면 선처리 끔. **일부러 깨뜨려 FAIL 1회 확인**(ui-conventions §5) |
| AI 상한 · 이벤트 0(e2e) | `e2e/viewer-focus-move.e2e.mjs`에 시나리오 추가(CI 목록에 이미 있음) | 390px 집중 끔: 같은 줄 단어 3개를 차례로 탭하고 1초 대기 → `/api/gemini` 1건 / 다른 줄 단어를 탭하고 200ms 안에 닫기 → 0건 추가 / [문장] 탭 → 새 요청 0, 번역이 첫 프레임 안에 보임 / 전 과정 `rest/v1/review_events` POST 0, `/api/analyze` 0, 만남 localStorage 키 불변 |
| 탭 내용이 카드 문장 | 같은 e2e | 줄 0 단어로 [문장] 탭 확인 → 줄 2 단어 탭 → [문장] 탭의 원문이 줄 2, 번역 칸이 줄 2 결과(앞 문장 번역이 남지 않음, §1.2) |
| 더 쉽게·자세히 초기화 | e2e 같은 파일 + `grammarDetail.test.js` 단위 | A 문장 [자세히] 열기 → 막대로 B 문장 → 해설 닫힘. 훅 단위: `forText`가 다르면 `open:false` |
| 노트 문장 | `src/lib/__tests__/grammarNoteSave.test.js` | 저장 행 `selected_text` = 해설 만든 문장, 빈 문장이면 저장 버튼 없음 |
| 이합사 키 | `src/lib/__tests__/wordDetailKey.test.js`(신규 — 기존 `wordDetailFormat.test.js`는 서식·병음만 본다) | 歉(`sep_link:'道歉'`) → 요청 `base_form=道歉`, 캐시 키 `Chinese:道歉`. `ctxExplain` 본문 `base: '道歉'` |
| 단어별 뜻 | `src/lib/__tests__/viewerSentenceGlosses.test.js` | 기호·개행 제외, 歉이 道歉에 합쳐짐, 순서 보존, 교정된 뜻을 그대로 |

---

## 7. 선례 조사

| 사례 | 본 것 | 오픈소스·라이선스 | 우리 적용 | 판정 |
|---|---|---|---|---|
| instant.page | 링크에 65ms 머물면 미리 받는다 — 65ms 머문 사용자의 절반이 누른다는 관찰, 평균 300ms를 번다 | MIT(라이브러리) | 「머무름 = 의도 신호」 구조. 우리 신호는 「카드를 연 채 같은 문장 0.3초」로 더 늦고 비싸다(AI 호출) | 부분 채택(구조만) |
| Chrome Speculation Rules `eagerness: moderate` | 링크에 200ms 머물거나 pointerdown이면 미리 받기/렌더 | 웹 표준 | 「너무 이르면 낭비, 너무 늦으면 무용」의 기준값 근거. 비용이 큰 작업일수록 늦게 잡는다 → 0.3초 | 채택(값 근거) |
| TanStack Query `prefetchQuery`·취소 규칙 | 같은 키 진행 중 요청 합치기, 쓰지 않은 signal이면 언마운트해도 결과가 캐시에 남음 | MIT, 이미 의존성 | single-flight·「닫아도 받기 완료」를 새 코드 없이 | 채택 |
| Language Reactor | 자막 줄마다 기계 번역을 미리 붙여 보여 준다(Pro, 하루 분량 상한) | 비공개 | 「묻기 전에 준비」의 선례. 상한을 두는 것도 같다(우리는 분당 상한) | 부분 채택 |
| LingQ · Readlang 문장 번역 | 문장 번역은 사용자가 누를 때 요청 | 비공개 | 지금 우리 방식. 선처리 선례가 아님 | 비교용 |
| Gemini 암묵 캐시 | 4,096토큰 이상 프롬프트만 서버 캐시 | — | 문장 번역(수백 토큰)은 해당 없음 → 앱 수준 캐시(`viewer_tx`)가 유일한 절감 수단 | 채택(근거, v2-AE 1차와 같음) |
| `review_events` `source:'ui'` 계측(리포 §4.9) | 신규 테이블 없이 행동 계측 | 리포 관례 | 볼륨·「학습 이벤트 0」 합격과 충돌 | 배제(§4.2) |

단어를 누를 때 문장 번역을 뒤에서 미리 만드는 공개 선례는 v2-AE 1차 조사와 마찬가지로 찾지 못했다 → 적중률·낭비 호출을 잰다.

출처: [instant.page — intensity](https://instant.page/intensity) · [Chrome — Speculation Rules 개선](https://developer.chrome.com/blog/speculation-rules-improvements) · [Shopify — speculation rules 권장값](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-speculation-rules.md) · [TanStack Query v5 — Query Cancellation](https://tanstack.com/query/v5/docs/framework/react/guides/query-cancellation) · [Language Reactor 포럼 — 기계 번역 할당량](https://forum.languagelearningwithnetflix.com/t/question-about-premium-feature-machine-translations/8606).

---

## 8. PR 분할

| PR | 내용 | 위험 | 합격 기준 |
|---|---|---|---|
| **① 같이 고칠 것** | §5.1 더 쉽게·자세히 문장 키 · §5.2 노트 문장 · §5.3 이합사 키 | 낮음(각각 작은 경로, 데이터 읽기 키만 바뀜) | §6.2 해당 단위 + e2e 1건, 기존 계약 무수정, `npm test` 전체 green. AE-R1과 독립이라 먼저 내도 된다 |
| **② 번역 단일 키 + 선처리 + 측정** | `sentenceTranslation.js`·`useSentencePrefetch.js`, `runSelectedSentence` 번역 부분 교체, 카드 [문장] 탭이 쿼리를 구독(AE-R1 Q1 트리거가 있으면 그 자리), 등급 상수, 재시도 0, 클라이언트 상한, route 꼬리표(Q3 결정분) | 중간(번역 경로 전체가 한 모듈로 모인다. 화면은 거의 그대로) | 정본 §4 합격(같은 문장 AI ≤1, 0.3초 안에 닫으면 0, 학습 이벤트 0), §6.2 계약, 기존 번역 e2e(이동 막대·드래그·언어 설정) green, Preview에서 정상 실계정으로 적중률 측정표(§4.2) |
| **③ [문장] 탭 재배치** | §3 순서·원문 칠·번역 칸 진행 표시·문형·단어별 뜻, 120자 표시 자르기 제거, 탭 내용 = 카드 문장(낡은 번역 남지 않음) | 중간(표시 전용, 쓰기 경로 0) | 390·1280 실글꼴 스크린샷 시안 대조, 수업 모드 무변화 e2e, ko·ja·en 각 1건 |

- ②를 AE-R1 PR② 뒤에 두는 이유: 「번역」 버튼이 남아 있으면 같은 번역을 부르는 길이 하나 더 있어 요청 수 계약을 두 번 써야 한다.
- ②와 ③을 나누는 이유: ②는 요청·캐시·비용(신뢰성 축), ③은 화면(사용성 축)이다. 한 PR이면 측정표와 시안 대조를 한 번에 검수해야 한다.

---

## 9. 사양 모호 · 충돌

### 9.1 설계 세션에 물을 것 `[Claude][QUESTION][VIEWER-V2-ROUNDS-001]`

| # | 질문 | 근거 | 제안 |
|---|---|---|---|
| Q1 | **번역 단위**: 선처리·[문장] 탭의 「문장」은 원문 **줄**인가, AE-R1 문장 줄의 **한 문장**(。！？ 기준)인가? | 정본 §2.1 문장 줄 = 한 문장, §4 「자료 + 문장 키」. 교재 맵(`metadata.translations`)·`viewer_tx` 캐시·막대 이동 단위는 모두 줄이다 | **줄**. 한 문장 단위로 바꾸면 교재 맵이 여러 문장 줄에서 맞지 않고 기존 캐시가 모두 빗나간다. [문장] 탭 원문은 줄 전체를 보이되 누른 단어만 칠한다. 문단형 자료(한 줄이 여러 문장)에서는 번역이 길어져 T3(2.5초) 목표가 위험하다 — 측정표에 줄 길이별 지연을 함께 보고한다 |
| Q2 | **light 등급의 범위**: 선처리만 light인가, 번역 경로 전체인가? | 정본 §4 「모델 등급은 light로 시작」. 선처리와 사용자 요청이 같은 키를 쓰므로 선처리만 light면, 먼저 머문 문장은 light 번역, 바로 [문장] 탭을 연 문장은 standard 번역이 저장된다 | 경로 전체 한 상수(`SENTENCE_TX_TIER`)로 두고 light로 시작, 표본 비교(§10.2) 뒤 확정. 키 버전은 등급을 올릴 때 `v3` |
| Q3 | **측정 수단**: 「AA 계층 재사용」은 서버 `[llm]` 로그를 말하나? 적중률은 클라이언트에서만 아는데, 경량 수집 경로(DB 0, 숫자만)를 새로 둬도 되나? | 정본 §4 기록, `llm.js` AA R2, 리포 §4.9 | §4.2 (가) route 꼬리표 + (다) Preview 측정 세션. 운영 상시 수집 (나)는 필요해질 때 |
| Q4 | **게스트**: 캐시·교재 맵이 없을 때 [문장] 탭은? 지금은 `/api/gemini`가 401이라 「설명을 가져오지 못했어요」가 뜬다 | 정본 §4 「로그인 사용자만 AI」 | AI를 부르지 않고 「로그인하면 이 문장의 번역을 볼 수 있어요」 + 로그인 링크(기존 게스트 배너 문구 계열) |
| Q5 | **설명 언어를 바꿀 때**: 열린 카드의 선처리를 새 언어로 다시 하나? | `cacheScope`에 설명 언어가 들어가 키가 바뀐다. 지금도 언어를 바꾸면 열린 번역을 다시 요청한다(`ViewerPage.jsx:876-883`) | 다시 0.3초를 세고 1회(새 키). UI 언어만 바꾸면 키가 같아 0회 |
| Q6 | **문장 막대·드래그에도 선처리?** 정본은 「카드가 열리고」만 말한다 | 정본 §4 시작 조건 | 카드만. 막대·드래그는 사용자가 번역을 직접 부르는 길이라 선처리 이득이 없다 |

### 9.2 개발 세션이 정할 수 있는 것(제안값)

| 항목 | 제안값 |
|---|---|
| 머무름 | 300ms, 같은 줄 재탭은 타이머 유지 |
| 쿼리 | `retry:false`, `staleTime:Infinity`, `gcTime:30분`, signal 미사용 |
| `callGemini` 재시도 | 번역 쿼리는 0(`retries` 옵션을 `callGemini`에서 빼고 넘김) |
| 클라이언트 상한 | 선처리 AI 분당 20회, 넘으면 그 분 동안 중지 |
| 키 메모 | 줄 번호 → 키 Map, 자료·`cacheScope`가 바뀌면 비움 |
| 무id 리스트 단어 | 선처리 없음(드래그가 이미 번역을 불렀다) |
| 번역 칸 진행 표시 | 「번역 중…」 한 줄, 1초 안이면 문구만(스피너 없음) |
| 표시 원문 | 자르지 않고 3줄 예산 함수(AE-R1)로 단어 앞뒤 유지 |
| `localStorage` 용량 | `QuotaExceeded`면 쓰기 생략(지금과 같음). `viewer_tx` 정리(LRU)는 범위 밖 — 보고만 |

### 9.3 오너 결정이 필요한 새 범위

- 없음. 선처리·측정·light 시작은 정본 §11 확정 범위다. 다만 Q3에서 **운영 상시 수집 경로(나)**를 고르면 새 데이터 수집이라 오너 확인을 받는다.

---

## 10. 위험 · 보존

### 10.1 정본 §0.2

| 조건 | 지키는 방법 |
|---|---|
| FSRS·`review_events`·개인 뜻·출처·원문·판본·아는 단어·`user_verified` | 선처리·[문장] 탭 경로는 읽기와 `viewer_tx` 쓰기뿐. 소스 계약(§6.2)과 e2e 요청 감시 |
| 「이 문장 뜻」은 토큰 자리에만 | AE-R2는 뜻을 바꾸지 않는다(문맥 뜻 판정은 AD-R4 — 정본 §4) |
| `viewerDefaults` | 설정 키 추가 0(선처리는 설정이 아니다 — 끄는 옵션을 두지 않는다. 필요하면 Q로) |
| 수업 모드 | `classStudyActive`면 선처리 0, `runSelectionAnalysis`·패널 경로 그대로 |
| 기존 테스트 | §6.1 표대로만, PR 본문에 절 번호 |

### 10.2 품질 확인(AGENTS.md 공통 품질 — AI 결과 수락 기준)

- light 확정 전 비교: 중·일·한·영 각 15문장(교재 번역이 있는 문장 포함, 조정에 쓰지 않는 보류 5문장 별도), 기대 의미·금지 오답을 적은 표로 light vs standard를 비교한다. 같은 모델의 자기 채점만으로 확정하지 않는다(교재 번역 = 독립 근거).
- 교재 맵이 있는 문장은 AI를 부르지 않으므로 비교 대상은 교재 밖 문장이다.

### 10.3 언어별 회귀

| 언어 | 위험 | 대응 |
|---|---|---|
| 중국어 | 교재 맵 적중률이 높다(정제 교재) → 선처리 대부분이 요청 0 | 측정표에 「교재 맵/캐시/AI」 비율을 나눠 적는다 |
| 일본어 | 줄에 여러 문장이 흔하다(문단) → 번역이 길다 | Q1 |
| 한국어 | 설명 언어가 zh-CN·zh-TW(`buildViewerSentencePrompt` 경로), `cacheScope`에 설명 언어 포함 | 같은 모듈이 두 프롬프트를 고른다(지금 분기 그대로) |
| 영어 | 줄 = 문단인 기사 자료 | Q1, 클라이언트 상한 |

### 10.4 겹침

- `ViewerPage.jsx` `runSelectedSentence`·`leftPanelContent`·`handleTokenClick`: AE-R1 PR②(문장 줄·「번역」 제거), #1346(`selectSentenceSource`·`readerLineGroups`)과 같은 구역이다. **AE-R1 PR② 병합 뒤 착수**하고, #1346이 먼저 들어오면 `lineTokenIdsOf`를 단어별 뜻의 토큰 목록으로 재사용한다(중복 신설 금지).
- `ViewerBottomSheet.jsx`: [문장] 탭 누름 콜백(`onTabSelect`) prop 하나 추가 — PDF 뷰어(`PdfViewerPage.jsx`)는 넘기지 않으면 무변화.

---

## 11. 텍스트 목업

### 11.1 390px · zh · 壮观 카드에서 [문장] 탭(선처리 완료)

```
┌ 시트 min(55dvh,440px) ─────────────────────────┐
│ [단어│문장]           [^][v]  [⋯] [⤢] [✕]     │
├────────────────────────────────────────────────┤
│ 眼前的体育场比照片上更【壮观】。      [🔊][🎧] │ 원문 줄(자르지 않음), 누른 단어만 칠
│ ─ 번역                                         │
│ 눈앞의 경기장은 사진보다 더 웅장하다.          │ 교재 맵 적중(합성 자료 metadata.translations)
│ 📘 교재에 실린 뜻이에요.                        │
│ [🔤 더 쉽게] [📖 자세히]                        │
│ ─ 문형 · A 比 B 更 + 형용사 ›                   │ 문법 표시 켬 + 이 줄에 표지(比)
│ ─ 단어별 뜻                                     │
│ 眼前 yǎnqián 눈앞 · 体育场 tǐyùchǎng 경기장 ·   │ processed_json 토큰, 요청 0
│ 比 bǐ ~보다 · 照片 zhàopiàn 사진 · 上 shàng 위 · │
│ 更 gèng 더 · 壮观 zhuàngguān 웅장하다           │
└────────────────────────────────────────────────┘
```

### 11.2 390px · 준비 전에 연 경우(0.3초 안에 [문장] 탭, AI 경로)

```
│ 她尽量别熬夜，要【爱惜】身体。        [🔊][🎧] │ T0
│ ─ 번역                                         │
│ 번역 중…                                        │ ← 진행 표시는 이 칸에만(한 줄 높이 예약)
│ [🔤 더 쉽게] [📖 자세히]                        │ T0 (번역이 오면 이 아래가 밀린다)
│ ─ 단어별 뜻                                     │
│ 她 tā 그녀 · 尽量 jǐnliàng 되도록 · 别 bié ~하지 마라 · │
│ 熬夜 áoyè 밤을 새다 · 要 yào ~해야 한다 · 爱惜 àixī 아끼다 · 身体 shēntǐ 몸 │
```

### 11.3 1280px · 옆 패널 336px · [문장] 탭

```
                 본문 열                         ┌ 옆 패널 336px ────────────────┐
 眼前的体育场比照片上更壮观。                     │ [단어│문장]   [^][v][⋯][✕]   │
 她尽量别熬夜，要爱惜身体。                       ├───────────────────────────────┤
                                                  │ 眼前的体育场比照片上更【壮观】。│
                                                  │                     [🔊][🎧]  │
                                                  │ ─ 번역                         │
                                                  │ 눈앞의 경기장은 사진보다 더    │
                                                  │ 웅장하다.                      │
                                                  │ 📘 교재에 실린 뜻이에요.        │
                                                  │ [🔤 더 쉽게] [📖 자세히]        │
                                                  │ ─ 단어별 뜻                     │
                                                  │ 眼前 눈앞 · 体育场 경기장 · …   │
                                                  └───────────────────────────────┘
```

### 11.4 게스트 · 캐시 없음(Q4 제안)

```
│ ─ 번역                                         │
│ 로그인하면 이 문장의 번역을 볼 수 있어요 →      │ AI 요청 0 (지금: 401 → 「설명을 가져오지 못했어요」)
```

정본과 다른 점: (1) 단어별 뜻의 병음은 토큰 `furigana`에서 공백을 뺀 표기 예시다 — 표기 규칙(공백·성조 색)은 개발 세션이 단어창 규칙(R0 버그 2)에 맞춘다. (2) 원문 줄 오른쪽 🔊·🎧는 지금 있는 두 버튼(지정한 문장 듣기·받아쓰기)이다.
