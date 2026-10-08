# 뷰어 v2 AE-R1 — 단어창 골격 구현 설계서

- 작성: 2026-10-07 KST · 설계 에이전트(코드 무변경, 이 문서만 커밋)
- 기준 브랜치: `claude/viewer-r0-integration` `3e62884f`(R0 버그 PR 4개 + R0+ 통합, main 미병합). 행 번호는 모두 이 커밋 기준이다.
- 정본: VIEWER-V2-ROUNDS-001(이하 「정본」) §2·§3·§10·§11. **배치는 오너 확정이라 다시 설계하지 않는다.** 이 문서는 현재 코드 위에 그 배치를 얹는 방법, 데이터 출처, 계약, PR 분할, 정본끼리·정본과 코드의 충돌을 다룬다.
- 개정 2026-10-07 23:45 KST: 오너 결정으로 단어창 「AI」 표 폐기(정본 §2.1 뜻 줄 예외, AD-R3·AD-R4 포함) — §2 뜻 줄 · §3.1 · §3.2-4 · §10.1 Q4 반영.
- 측정: e2e 목 빌드(`npm run e2e:build`, 글꼴은 목 — 실글꼴 아님) + 합성 자료 실측. 운영 DB·실계정은 보지 않았다. 측정하지 못한 것은 「미측정」으로 적었다.

---

## 0. 결론

1. **세 PR로 나눈다.** ① 미리 받기·순수 함수(화면 변화 0) → ② 골격·제거·계약(표시 전용, 쓰기 경로 무변경) → ③ 사전 뜻 탭 교정·되돌리기·⋯ 메뉴(쓰기 경로). 쓰기 경로를 표시 변경과 섞지 않는 것이 분할 근거다(§8).
2. **시트 높이는 이미 정본 값이다.** `min(55dvh,440px)` / 펼침 `85dvh`가 `reader-controls.css:121-122`에 있다. 고칠 것은 높이가 아니라 **그 안의 첫 화면 구성**이다(§6).
3. **지금도 첫 화면 위쪽(메타·표제어·뜻)은 이동 0이다**(§5 실측, 390·1280, 네트워크 보류 포함). T0를 막는 것은 넷이다: (a) 기본형 표제어 읽기가 사전 조회 뒤에 와서 루비 줄이 생기며 뜻이 밀린다(코드 근거, 미측정), (b) 일본어 대조 블록이 사전 응답 뒤 높이를 −16~+25px 바꿔 그 아래를 움직인다(실측), (c) 자료를 열자마자 누르면 훈음 표가 아직 없을 수 있다, (d) 사전 뜻 목록이 `morpheme_dictionary` 탭마다 단건 조회(T2)다. (a)(d)는 **자료 열 때 표제어 일괄 조회로 `['token-dict', lang, key]` 캐시를 미리 채우면** 기존 조회 경로를 그대로 쓰면서 T0로 당겨진다. 더 큰 문제는 **예산**이다 — 390 시트에서 본문이 254px뿐이라 문장 줄 3줄 + 뜻 2줄이면 14px 넘친다(§5.1).
4. **문장 자르기 유틸은 없다.** 지금 「문장」은 `raw_text`의 줄 전체다(`ctxSentenceOf`, `ViewerPage.jsx:863-868`). 줄 안 토큰 순서로 누른 자리의 글자 위치를 구하고 `。！？；…`로 자르는 순수 함수를 새로 둔다. 지금의 강조는 `splitSentenceAroundWord`가 **같은 단어를 모두** 칠한다(`ViewerPage.jsx:2307`) — 정본 위반이다.
5. **사전 뜻 목록의 재료는 이미 카드에 온다.** `editDictEntry.meanings`(≤3, 뜻별 `pos` 선택)와 `refVocab.word`(ko·pos·ex)다. 합치기·칠하기·「문맥상」 판정은 순수 함수 하나로 만든다. 교정은 `TokenEditPanel`이 쓰는 `correctTokenMutation`(`ViewerPage.jsx:1491`) 그대로다. **되돌리기 경로는 지금 없다**(토스트에 행동 버튼도 없다) — 새로 만든다(§3.4).
6. **다음 복습 날짜는 카드가 이미 안다.** `savedWords.projectionsById.get(row.id).review.nextQuestionAt`(`vocabularyDueIndex.js:27-30`). 추가 조회가 없다.
7. **「번역」 버튼을 지우면 AE-R2 전까지 단어 탭에서 문장 해석으로 가는 길이 없어진다.** [문장] 탭은 지금 비어 있다. AE-R1에서는 **[문장] 탭을 누르는 것이 기존 번역 경로(`runSelectedSentence(sel, true)`)를 부르게** 하자고 제안한다. 설계 세션 질문 Q1이다.
8. **소스 계약 「이 문장에서 0」은 그대로 쓰면 깨진다.** 품사 칩 툴팁 「이 문장에서는 동사로 쓰였어요」(`TokenPosLabel.jsx:23`, 테스트 2개가 이 문구를 고정)가 단어 탭 안에 있다. 계약은 보이는 글자와 버튼 이름으로 좁힌다.
9. **정본 §10 개정 목록에 빠진 파일이 있다.** `hanjaKo.test.js` 뷰어 배선 3건, `synAntWiring.test.js`, `wordCardFit.test.js` ④, CI e2e `learning-flow`·`viewer-language-settings`·`viewer-hun-layout`이다. 목록은 §7에 있다.
10. **#1346(열린 PR)과 같은 줄을 만진다.** 한국어 뜻 줄, 「번역」 버튼, `sentences` 메모다. **#1346을 먼저 병합하고 AE-R1 PR②를 그 위에 다시 맞추는 순서**를 권한다(§11.3).

---

## 1. 현행 지도 — 지금 단어창이 그리는 것

렌더 경로는 하나다. `renderWordDetailCard(classAction, classMeaning)`(`ViewerPage.jsx:2181-2585`) → `renderRightPanelContent`(`:2587`) → 두 곳에서 쓴다.

| 경로 | 위치 | 들어가는 인자 |
|---|---|---|
| 시트 / 옆 패널(일반) | `ViewerBottomSheet` `rightContent`(`:3381`) | `classAction` 자리에 **교재 설명** `<details className="reader-card-notes" open={annotationOpen}>`를 넣는다. 이름은 classAction이지만 일반 모드에서는 교재 설명이다. |
| 수업 화면 | `ClassroomReader` `wordContent(...)`(`ClassroomReader.jsx:195`) | `classAction` = 수업 상세 + 교재 설명, `classMeaning` = `{meaning, editor}` |
| PDF 뷰어 | `PdfViewerPage.jsx:433` | 같은 `ViewerBottomSheet`를 쓰지만 이 카드는 아니다. 머리줄을 바꿀 때 영향을 받는다. |

시트 자체: `ViewerBottomSheet.jsx`(48행). 머리 = 탭 `[단어][문장]` + 문장 이동 ^/v(`barNav`, R0 버그 4) + ⤢ + ✕. 1120px 이상 컨테이너에서는 같은 요소가 336px 옆 패널이 된다(`reader-controls.css:136-141`, `.manabi-app`에서는 `height:auto`, `:324-327`).

### 1.1 블록 순서(일반 모드, 위에서 아래)

| # | 블록 | 조건 | 데이터 출처 | 코드 | 접힘 | 수업 모드 |
|---|---|---|---|---|---|---|
| 1 | 메타 줄: 품사 칩 · 「기본형」 폴백 · (ko) 표면→기본형 · 급수 | 항상 | `token.pos`·`pos_all`, `headFallback`, `refVocab.level` | `:2184-2193`, `TokenPosLabel` | — | 같음 |
| 2 | 표제어(폭맞춤·루비) + 듣기 | 일반 모드 | `headText`(`:1760`), `headReading`(`:1762`, 기본형이면 사전 `reading`), `splitRuby` | `:2194-2263`, CSS `index.css:4441-4513` | — | `TeachingWord` + `<details>표시</details>`(`:2194`) |
| 2a | 영어 IPA | en + reading | `token.reading` | `:2260` | — | `:2304` |
| 3 | 뜻 줄 + ✎ | 일반 모드 | zh/ja/en: `token.meaning`(`contextualMeaning`, `viewerReliability.js:2`) · ko: `useViewerExplanation`(AI) | `:2264-2278` | — | `classMeaning.editor` |
| 3a | `TokenEditPanel`(뜻·발음 수정) | ✎ 누름, 자료 소유자, 비한국어 | `editDictEntry`, `buildMeaningOptions` | `:2279-2303`, `TokenEditPanel.jsx` | 토글 | 수업 뜻 편집기로 대체 |
| 4 | 「문장 속 쓰임」: 원문 줄 인용(같은 단어 **모두** `<mark>`) | 본문 토큰이거나 리스트 단어에 문맥이 있을 때 | `ctxSentenceOf`(`:863`) = `raw_text` **줄 전체** | `:2306-2308` | — | 같음 |
| 4a | 「이 문장에서」 AI 설명 | zh, 버튼을 누른 뒤 | `/api/explain` token 분기(`ctxExplain.js`) | `:2312-2326` | — | 같음 |
| 4b | 액션 줄 `[번역] [이 문장에서는?]` | 문장이 있을 때 | `runSelectedSentence(sel,true)` / 수업이면 `runSelectionAnalysis` · `runCtxExplain` | `:2328-2331` | — | 번역 = `runSelectionAnalysis` |
| 5 | (ko) 「분석 결과는 자동 생성되었어요」 + 문법 해설 | ko | `localizedWord.morphology` | `:2336` | — | 같음 |
| 6 | 훈음 목록 `<dl class="reader-hun">` | zh + 한자 대조 켬 + 표 3개 로드 | `listHanjaHunEum`(R0+ 정체 조회) | `:2337`, `ViewerHanjaReading.jsx`, CSS `reader-controls.css:100-103,474` | — | 숨김 |
| 7 | `classAction` 슬롯(일반 = 교재 설명 `<details>`) | 교재 설명이 있을 때 | `TextbookAnnotations` | `:2338`, `:3381` | **접힘** | 수업 상세 |
| 8 | 일본어 대조(일본식 자형 · 같은 뜻 · AI 찾기) | zh | `hanjaJa.json` + `editDictEntry.meanings[0].ja` + `/api` AI | `:2339`, `ViewerJapaneseReference.jsx` | 일반=section, 수업=`<details>` | 접힘 |
| 9 | 글자 카드(구성·이야기·다시 만나기·획수) | 표제어 한자를 누름 | `charDetail`·`charEtym`(+ `hanjaEtym`·`hanjaStory` 지연 로드) | `:2341-2446`, CSS `index.css:4514~` | 토글 | 같음 |
| 10 | 사전 예문(「사전 예문」 또는 「사전의 다른 뜻 · ko」) | `refVocab.word.ex` | refVocab | `:2452-2470`, `ViewerReferenceExample.jsx` | 일반=section, 수업=`<details>` | 접힘 |
| 11 | 유의어·반의어 | `synAntEligible` | Gemini + localStorage(`synAnt.js`) | `:2472-2474` | **`<details>`**(열 때 조회) | 같음 |
| 12 | 한자 정보(우리 사전 노트) | `refVocab.word.hanja` && 한자 대조 꺼짐 | refVocab | `:2475-2477` | 일반=section | `<details>` |
| 13 | 관련 문형 후보(`PatternCard`) | 문법 표시 켬 + 이 토큰이 표지 | `visibleScan.byToken` | `:2481-2483` | — | 같음 |
| 14 | 상세 설명 / [상세 설명 보기] | 항상 | `fetchWordDetailText`(localStorage → `/api/word-detail` → Gemini) | `:2485-2493`, `wordDetail.js` | 버튼 | 같음 |
| 15 | 하단 `.reader-card-actions` | 로그인·저장 지원 | 아래 표 | `:2497-2583` | — | 같음 |

하단(15)의 분기:

| 상태 | 지금 그리는 것 | 코드 |
|---|---|---|
| 한국어 저장 미지원 | 안내 한 줄 | `:2498` |
| 로그인 · 저장 지원 | 「얼마나 알겠어요?」 + `[아는 단어]`(`aria-pressed`) | `:2499-2508` |
| 저장 + **legacy 복습 시점**(`isTokenInlineDue`, legacyOnly) | 경고색 상자 안 4등급(`gradeInline`) | `:2511-2532` |
| 게스트 + 팀 사본 | 로그인 CTA | `:2533-2545` |
| ko 뜻 충돌 | 「이 문맥 추가」 | `:2546-2548` |
| 저장(복습 전·또는 FSRS 코호트 복습 시점) | `[✓ 단어장에 있음](disabled)` + `[이 문맥 추가]` | `:2551-2560` |
| 미저장 | 4등급(`addToVocab`, 부제 「1분 후」 등) | `:2561-2580` |

### 1.2 지금 단어 탭 안의 접힘·버튼(일반 모드, zh)

- 접힘: 유의어·반의어 `<details>`(11), 교재 설명 `<details>`(7, 교재 자료만), 글자 카드는 토글이지만 `details`는 아니다. 실측 개수는 §5.
- 버튼: 듣기, ✎(소유자), 번역, 이 문장에서는?, 일본어 대응 찾기(사전에 대응이 없을 때), 유의어·반의어(summary), 상세 설명 보기, 표제어 글자(`role=button`), 하단 등급·아는 단어.

---

## 2. 목표 지도 — 칸별 재사용 · 신설 · 데이터

표기: **T0** = 탭 직후 첫 프레임에 그릴 수 있음(네트워크 0). **T0\*** = 자료 열 때 미리 받으면 T0.

| 칸 | 재사용 | 새로 만들 것 | 데이터 · 지금 T0인가 | 수업 모드 |
|---|---|---|---|---|
| 머리줄 `[단어│문장] ^ v ⋯ ⤢ ✕` | `ViewerBottomSheet` 머리(`:31`) | `menu` 슬롯 prop(기본 `null` — PDF 뷰어 무영향). 단어 탭일 때만 ⋯ | — | `viewer-inspector--board`도 같은 컴포넌트. 메뉴 내용은 수업 모드에서 지금의 ✎ 조건과 같게 숨김 |
| 문장 줄 | `ctxSentenceOf`(줄 찾기), `json.sequence`·`dictionary` | `sentenceAroundToken()` 순수 함수(§4), `.reader-card-sentence` 15px 회색, 누른 자리만 `<mark>`(배경+굵게) | 원문·토큰 = **T0** | 같은 줄 표시(공통 배치). 수업 전용 버튼은 이 줄에 넣지 않는다 |
| 칩 줄(품사·급수 + 🔊 줄 끝) | `TokenPosLabel`, `refLevelLabel`, 듣기 버튼(`:2262`) | 듣기 버튼을 표제어 옆에서 칩 줄 끝으로 옮김(44px) | `pos` = T0 · 급수 = refVocab(자료 열 때 `useRefVocabEntry`가 이미 로드, `refVocabIndex.js:79-86`) = **T0\*** | `TeachingWord` 쪽 듣기 그대로 |
| 표제어 덩어리(기본형 · 병음 위 · 훈음 아래) | `splitRuby`, `fitDivisor`, `word-fit` 격자, `headPicked`, `hanjaReadingsOf`(R0+ 단일 조회) | **훈음 루비 셀**: 글자마다 `<span class="word-fit__hun">`(한자 아래), 칸 벌림 `--hun-n`(훈음 글자 수), 넘치면 훈/음 두 줄. 자형 열 자리(AE-R3)는 `grid-template-columns: 1fr auto`의 빈 열로만 둔다 | 표면 = token 읽기 **T0**. 기본형(이합사 VO·활용형)이면 사전 `reading` = **T2 → T0\***(일괄 조회). 훈음 표 = 한자 대조 켰을 때 자료 열 때 이미 로드(`:1664-1678`) = **T0\*** | `TeachingWord` 유지 |
| 뜻 줄(20px 굵게 + ✎) | 뜻 줄 `:2264-2278`, ✎ `toggleTokenEditing` | 「ⓘ 문맥과 다를 수 있어요」 자리(AD-R4 전까지 그리지 않음). **「AI」 표는 만들지 않는다**(오너 결정 2026-10-07 23:45 KST — Q4) | `token.meaning` = **T0** · ko는 `useViewerExplanation`(AI) = T3 → 한 줄 높이 예약 | `classMeaning.editor` 유지 |
| 문형 한 줄 「문형 · … ›」 | `visibleScan.byToken`, `PatternCard` | 한 줄 요약(`hit.kernel` + 첫 문형 제목), 누르면 그 자리에 `PatternCard` | 문형 인덱스는 문법 표시를 켰을 때만 로드(`:1593-1602`) → 켜져 있으면 **T0** | 같음 |
| 사전 뜻 목록 | `editDictEntry.meanings`, `refVocab.word`, `splitSentenceAroundWord`(예문 강조), `buildMeaningOptions`(교정 후보와 같은 합치기) | `buildSenseList()` 순수 함수(§3.2), 칠한 줄 + 「문맥상」, 예문은 그 뜻 바로 아래 | 사전 = **T2 → T0\***(일괄 조회). refVocab = T0\*. 게스트는 `morpheme_dictionary` RLS가 막는다(인증 사용자만 읽기, 마이그레이션 `20260415000200`) → refVocab만 | 수업 모드에서도 공통 배치로 보인다(뜻 출처 `classMeaning`은 뜻 줄만) |
| 한자 정보 | `:2475-2477` | 자리만 이동(사전 뜻 다음), 접힘 0 | refVocab = T0\* | `<details>` 유지 |
| 교재 설명 | `annotationContent`(`:3381`) | 일반 모드에서 `<details>` → `<section>`(라벨 + 가는 선) | `TextbookAnnotations` | `classAction` 그대로 |
| 더 알아보기 `[✦ 비슷한 말 찾기] [✦ 자세한 설명]` | `fetchSynAnt`, `renderSynAntChips`, `fetchWordDetail`, `formatDetail` | 요청 버튼 2개. 캐시가 있으면 버튼 대신 내용(§3.3) | 캐시 확인: 유의어 = localStorage(해시 키, 비동기 수 ms) · 설명 = localStorage 동기 + `morpheme_dictionary.detail_text`(일괄 조회에 넣지 말고 단건 조회에 `detail_text` 추가) | 같음 |
| 출처 줄 「일본어 읽기 · JMdict (EDRDG) · CC BY-SA 4.0」 | `dataCredits.js` 문구 | 카드 맨 아래 작은 줄 | 사전 행 `source`가 `jmdict*`일 때만. **운영 0건**(`dataCredits.js:10-11`, 오너 조회 10-07) → AE-R1에서는 사실상 안 보인다 | 같음 |
| 하단 | `save-grade__header`, `SAVE_GRADES`, `gradeInline`, `addToVocab`, `SaveContextButton`, 아는 단어 `aria-pressed` | 아는 단어를 등급 줄 오른쪽 체크 모양으로, 저장(복습 전) 한 줄 「✓ 단어장에 있음 · 다음 복습 10월 12일 [이 문맥 추가] ☐ 아는 단어」 | 저장 상태·다음 복습 = `savedWords`(자료 열 때 조회) = **T0\*** | 같음 |
| ⋯ 메뉴 | `toggleTokenEditing` | 메뉴 버튼 + 목록(지금은 「뜻·발음 수정」 하나, AD-R3에서 묶기·나누기) | — | 수업 뜻 편집 중엔 숨김(`!classMeaning`) |
| 글자 카드(AE-R4 전까지) | `:2341-2446` 그대로 | 위치만 표제어 바로 아래로 | 같음 | 같음 |

### 2.1 없어지는 것 — 위치와 제거 영향

| 없어지는 것 | 지금 위치 | 다른 곳에서 쓰나 | 제거 영향 |
|---|---|---|---|
| 「번역」 버튼 | `ViewerPage.jsx:2329` | 같은 경로는 문장 이동 막대 「번역」(`:1441`), 문장 막대 재탭, 드래그 | **AE-R2 전까지 단어 탭 → 문장 해석 길이 끊긴다.** Q1. CI e2e `viewer-language-settings.e2e.mjs:281`이 이 버튼(句子翻譯)을 누른다 → 개정 |
| 「이 문장에서는?」 버튼 · 「이 문장에서」 설명 | `:2312-2326`, `:2330` | `runCtxExplain`·`ctxExplain` 상태(`:854-896`)는 카드 전용. `fetchCtxExplain`(`ctxExplain.js`)·`/api/explain` token 분기는 이 버튼만 부른다 | 클라이언트 상태·버튼 제거. 서버 분기와 `ctxExplain.js`는 **남긴다**(AD-R4가 대체할 때까지 계약 유지, 정본 §3 「기록이 비는 것을 감수」). `ctxExplainWiring.test.js` 서버·클라이언트 묶음 유지 |
| 「해석」 칩, [문장] 탭의 처리 표시 | **지금 코드에 없다**(grep 0) | — | v2-AE 1차 시안에만 있었다. 할 일 없음. 「다시 생기지 않는다」만 계약 |
| 「문맥상 · 사전 ①」 문구 | **지금 코드에 없다** | — | 계약만 |
| 일본어 대조 블록 | `:2339`, `ViewerJapaneseReference.jsx`(42행) | ViewerPage만 import. `hanjaJa.json` 로드(`:1691-1696`)는 글자 카드 日 칩도 쓴다 | 마운트만 제거, 컴포넌트 파일은 AE-R3까지 남김 제안. **AE-R3 전까지 「일본어 대응」과 AI 찾기가 화면에서 사라진다** → Q2. `hanjaKo.test.js` 2건 개정 |
| 별도 훈음 목록 | `:2337`, `ViewerHanjaReading.jsx`, CSS `reader-controls.css:100-103,474` | ViewerPage만 | 컴포넌트·CSS 삭제. `viewerHanjaReading.test.js`(순수 렌더 4건)는 루비 셀 함수 테스트로 대체 |
| 카드 아래 글자 카드 | `:2341-2446` | — | AE-R1은 **삭제가 아니라 표제어 아래로 이동**(정본 §3). 삭제는 AE-R4 |
| 「관련 문형 후보」 블록 제목 | `:2482` | — | 문형 한 줄로 대체 |
| 유의어 `<details>` · 「상세 설명 보기」 | `:2472`, `:2493` | `synAntExpanded`(`:835`)는 이 details 전용 | 「더 알아보기」 요청 버튼으로 |
| 교재 설명 `<details>` | `:3381` | 수업 화면은 별도 | 일반 모드 section |
| 사전 예문 단독 블록 · 「사전의 다른 뜻 · …」 | `:2452`, `ViewerReferenceExample.jsx` | ViewerPage만 | 사전 뜻 목록에 흡수. 컴포넌트는 수업 모드 `<details>` 분기가 남으면 유지 |

---

## 3. 데이터 확인

### 3.1 출처별 사실

| 데이터 | 구조 | 조회 경로 · 캐시 | 근거 |
|---|---|---|---|
| `morpheme_dictionary.meanings` | `[{meaning, priority, pos?, ja?, en_pos_v?}]` ≤3. 뜻별 `pos`는 zh·en만(정본 품사 밖이면 뗌). zh 첫 뜻에 `ja:{form,yomi,diff?,warn}` 또는 `null`. 행 `pos`는 겸류면 `동사·명사`. `source`: `gemini`·`user_verified`·`jmdict`·`jmdict_en`. `detail_text` 열 | 카드: `useQuery(['token-dict', lang, sep_link‖base_form‖text])`, `select('meanings, reading, pos')`, `staleTime 60s`, zh는 시트 열림마다·ja/en은 편집 중이거나 기본형일 때만 켜짐(`:1739-1756`). **자료 단위 일괄 조회 없음.** 수업 화면은 따로 같은 조회(`ClassroomReader.jsx:127`). RLS 읽기 = 인증 사용자만 | `fetchMeanings.js:184-259`, 마이그레이션 `20260415000200`·`20260417000100` |
| 토큰 뜻(이 문장 뜻) | `processed_json.dictionary[id].meaning` — 분석 때 `pickZhMeaning(cached.meanings, pos)`(문맥 품사와 같은 뜻 우선, 없으면 첫 뜻) · ja는 첫 뜻 · en은 문맥 판별 | 자료와 함께 옴 = T0 | `analyze/route.js:271-276`, `disambiguateZhPos.js:203` |
| refVocab | `{zh, pinyin, ko, pos, ex:{zh,pinyin,ko}, hanja?}` + level. zh만(30청크) | `loadRefVocabIndex` 언어별 1회, ViewerPage 마운트 때 시작 | `refVocabIndex.js:31-86` |
| 「AI 문맥 뜻」 판별 근거 | **필요 없어졌다** — 「AI」 표 폐기(오너 결정 2026-10-07 23:45 KST, Q4). 참고로 근거도 **없다.** 토큰에 출처 표시 필드가 없고, 사용자 교정도 `processed_json`을 덮을 뿐 표시가 남지 않는다(`token_corrections` 이력은 있으나 클라이언트가 읽지 않음 — `['token-corrections']` 키는 무효화만, `:1537`). 사전 뜻 자체도 대부분 `source:'gemini'`다 | — | `correctTokenMutation` `:1491-1544` |
| 다음 복습 날짜 | `projection.review.nextQuestionAt`(ISO) | `savedWords`(`/api/learning/vocabulary?view=learning`, 자료 열 때) → `buildVocabularyWordIndex`의 `projectionsById` | `vocabularyDueIndex.js:13-31`, `vocabularyLearningRead.js:65-80` |
| 유의어 캐시 | `pdf_cache:synant:v1:` + SHA-256(언어, [기본형, 뜻, 읽기]) | localStorage, 키 계산이 비동기 | `synAnt.js:40-77` |
| 상세 설명 캐시 | localStorage `pdf_cache:detail:${lang}:${base_form‖text}` → `/api/word-detail`(`detail_text`) → Gemini | 키가 `base_form`이다(사전 키는 `sep_link‖base_form`) — 이합사 O 조각에서 키가 갈린다(기존 결함, 범위 밖이면 보고만) | `wordDetail.js:52-70` |

실측으로 드러난 현행 결함 하나: 壮观의 토큰 뜻 「웅장하다, 장관이다」와 refVocab `ko` 「장관이다, 웅장하다」는 같은 뜻인데, `referenceMatchesContext`(`viewerReliability.js:11-17`)가 문자열 완전 일치로 비교해 지금 카드가 예문 머리를 **「사전의 다른 뜻 · 장관이다, 웅장하다」**로 단다(§5.1 블록 덤프). 아래 정규화가 이것을 고친다. `referenceMatchesContext`의 기존 단위 계약(병음이 다르면 다른 뜻)은 유지한다.

### 3.2 사전 뜻 목록 — `buildSenseList` 제안

입력: `dictEntry`, `refWord`, `token`, `language`. 출력: `[{pos, items:[{meaning, current, example?, source:'dict'|'ref'}]}]`.

1. 사전 뜻을 순서대로 넣는다. 뜻 `pos`가 없으면 행 `pos`의 첫 후보로 묶는다(ja는 행 `pos`).
2. refVocab `ko`를 정규화 비교로 합친다. 같으면 그 줄에 `example = ref.ex`를 붙이고, 다르면 refVocab `pos` 묶음 끝에 한 줄을 더한다.
3. 정규화 제안: NFC → 괄호 보충 `(…)`·`（…）` 제거 → `[,;、，/]`로 나눠 다듬은 조각 집합 → **집합이 같으면 같은 뜻**. 「장관이다, 웅장하다」 = 「(경관이) 웅장하다, 장관이다」. 부분 겹침은 합치지 않는다(오합 방지).
4. `current` = `token.meaning`과 정규화가 같은 줄. 없으면 칠한 줄이 0이다(「문맥상」은 사전 줄과 같을 때만). 「AI」 표·판정 함수는 만들지 않는다(오너 결정 2026-10-07 23:45 KST — Q4).
5. 번호 ①②③은 묶음을 넘어 이어 센다(정본 목업 ① 형용사, ② 명사).
6. `buildMeaningOptions`(`tokenEditOptions.js:9`)와 같은 트림·중복 제거 규칙을 쓴다. 두 함수가 같은 집합을 내는지 단위 계약을 둔다(교정 후보와 목록이 어긋나지 않게).

### 3.3 더 알아보기 — 캐시가 있으면 내용

| 항목 | 캐시 확인 | 표시 |
|---|---|---|
| 비슷한 말 | 카드 열림 때 `synAntCacheKey`를 계산해 localStorage만 본다(네트워크 0). 있으면 칩 줄(유의어/반의어 구분 줄 유지), 없으면 `[✦ 비슷한 말 찾기]` | 누르면 지금 `fetchSynAnt` |
| 자세한 설명 | localStorage 동기 확인 + 단건 사전 조회에 `detail_text`를 더해 받는다(일괄 조회에는 넣지 않는다 — 최대 4,000자) | 있으면 `formatDetail` 본문, 없으면 `[✦ 자세한 설명]` → 지금 `fetchWordDetail` |

### 3.4 「다른 뜻을 누르면 이 자리 뜻으로 교정」 — 재사용 경로

- 쓰기: `correctTokenMutation.mutate({tokenId, corrections:{meaning, pos?}})`(`:1491`). `buildTokenCorrections`(`tokenEditOptions.js:47`)로 바뀐 필드만 만든다. 뜻 줄의 pos가 있으면 같이 교정(TokenEditPanel 칩과 같은 규칙).
- 부수 효과: `processed_json` 갱신(자료 소유자만 — `canEditToken` `:1728`), `token_corrections` 이력 insert, 분석 캐시 비움, `selectedToken` 갱신. **단어장 뜻은 건드리지 않는다**(전역 적용 `promoteCorrection`은 부르지 않는다 — 정본 §0.2 「저장한 뜻은 자동으로 덮어쓰지 않는다」).
- 되돌리기: 지금 없다. 토스트(`ToastContext.jsx:12`)는 행동 버튼을 받지 않는다. 제안 = 교정 직후 뜻 줄 아래 「뜻을 바꿨어요 · [되돌리기]」 한 줄(그 토큰을 다시 열 때까지). 되돌리기 = 직전 값(`beforeToken`의 meaning·pos)으로 같은 mutation 1회. ⌘Z(`undoAny`)에는 묶지 않는다(저장·등급 취소와 의미가 섞인다).
- 소유자가 아닌 사용자(공개 자료 열람자), 한국어(`legacyTokenEditingAllowed=false`), 수업 모드에서는 줄을 누를 수 없다(표시만). Q3.

---

## 4. 문장 줄

| 항목 | 현황 | 제안 |
|---|---|---|
| 문장 단위 유틸 | 없다. 「문장」 = 줄(`sentenceNav.js` 주석, `ctxSentenceOf`). 비슷한 정규식은 지역 상수뿐(`ListenControls.jsx:38`, `storyScript.js:10`) | 새 순수 함수 `sentenceAroundToken({rawLine, lineTokens, tokenIndex})` → `{before, term, after, start, end, clipped}`. 파일 제안 `src/lib/viewerSentenceLine.js` |
| 누른 자리 위치 | 토큰 id = `id_<줄>_<줄 안 순번>_<시각>`(`analyze/route.js:242`). 줄 안 토큰은 `json.sequence` 순서 | 줄의 토큰을 순서대로 `rawLine.indexOf(text, cursor)`로 따라가 누른 토큰의 글자 위치를 얻는다. 공백·누락 토큰에 견딘다(영어 공백 처리 미검증 — 이 방식이 그 위험을 피한다). 못 찾으면 `splitSentenceAroundWord` 첫 일치로 내려간다 |
| 자르기 | — | 경계 `[。！？；…]+` 뒤 닫는 따옴표 `[」』”’）)]*`까지 한 문장. 라틴 자료는 `[.!?;](?=\s|$)` 추가(약어 오탐 감수 — 개발 세션 결정). 한 줄에 경계가 없으면 줄 전체 |
| 무id 리스트 단어 | `__viewerSentence`(카드 열 당시 문맥) | 같은 함수에 토큰 위치 없이 넣고 첫 일치만 칠한다 |
| 3줄 초과 | — | 글자 예산(제안: CJK 60자 · 라틴 160자. 근거: 390 시트 본문 내용 폭 332px ÷ 15px ≈ 22자/줄 실측 → 3줄 66자에서 문장부호 여유를 뺌. 옆 패널 336px도 내용 폭이 비슷해 같은 예산) 안에서 단어 앞뒤를 남기고 양 끝 `…`. 안전망으로 `-webkit-line-clamp:3`. 예산 판정은 순수 함수(단위 테스트), 실제 줄 수는 e2e |
| 칠하기 | 지금 `<mark>`가 같은 단어 전부 | 누른 자리 하나만 `<mark class="reader-card-sentence__term">`(배경 `--reader-selected` + 굵게) |

---

## 5. T0 · 자리 예약 · 이동 0 — 실측

### 5.1 현행 실측 (통합 브랜치 `3e62884f`, e2e 목 빌드, 2026-10-07 KST)

조건: 합성 자료 「眼前的体育场比照片上更壮观。」(zh)·「今日は天気がとてもいいです。」(ja), 문장 집중 끔, 사전 응답 800ms 지연(합성 행), 스크립트 `scratchpad/ae-r1-measure/measure.e2e.mjs`(커밋 안 함). 시각은 `el.click()` 뒤 rAF 2회(=첫 프레임, 22~37ms), 0.3s, 1s, 3s.

**390×844 시트(zh 壮观, 한자 대조 끔)** — 단위 px, `top/높이`

| 요소 | 첫 프레임 | 3s | 이동 |
|---|---|---|---|
| 시트 | 396/440 | 같음 | 0 |
| 머리 | 397/55 | 같음 | 0 |
| 본문 보이는 높이 / 내용 높이 | 254 / 590 | 254 / 574 | 내용 −16 |
| 메타(품사·급수) | 468/24(줄 상자 40) | 같음 | 0 |
| 표제어 | 508/62.4 | 같음 | 0 |
| 뜻 줄 | 578.4/33 | 같음 | 0 |
| 「문장 속 쓰임」 | 627.4/89.5 — **아래 끝 717 > 본문 끝 706, 첫 화면에서 잘림** | 같음 | 0 |
| 일본어 대조 | 732.9/67.6 「불러오는 중… 대응어 확인 중…」 | 51.6 「壮観 기존 사전」 | 높이 −16(0.3s엔 +3) |
| 예문·더보기 | 816.5 | 800.5 | **−16** |
| 하단(고정) | 705.6/129.4 = 안내 줄 44 + 등급 56 + 여백 | 같음 | 0 |
| 등급 4버튼 | 768.6–825, 모두 화면 안 | 같음 | 0 |

- 体育场(사전 행 없음): 일본어 대조 70.8 → 95.6(「일본어 대응 찾기」 버튼이 생김) → 아래 블록 **+25px**.
- 한자 대조 켬: 훈음 목록 `dl.reader-hun`이 원문 아래(728.9/33.8)에 **첫 프레임부터** 있다(표는 자료 열 때 받음). 본문 내용 636px.
- 1280×900 옆 패널: 패널 80/796, 본문 608/636, 블록 순서·이동 양상 같음.
- ja 天気: 사전 조회 0회(표면=기본형이면 ja는 조회 안 함), 일본어 대조 없음, 본문 395px, 이동 0.
- **네트워크 보류**(자료 연 뒤 `morpheme_dictionary`·`/api/**` 붙잡음): 메타·표제어·뜻·원문·훈음은 첫 프레임에 다 있다. 일본어 대조가 3초 뒤에도 「대응어 확인 중…」으로 남는다.
- 첫 프레임 접힘: `details` 1개(유의어·반의어), `aria-expanded=false` 0개. 본문 버튼: 글자(壮·观), 발음 듣기, 문장 번역, 이 문장에서는?, 상세 설명 보기(+ 体育场은 일본어 대응 찾기).
- 머리줄 폭(390, 문장 집중 끔): 패널 374, 머리 372, 탭 묶음 108(탭 50×2), ⤢ 44, ✕ 44. ^/v(44×2)와 ⋯(44)를 더하면 108+88+132+간격 16+패딩 16 = **360 ≤ 372 — 한 줄에 든다**(여유 12px). 문장 집중 켬 상태에서 ⋯를 더한 실측은 PR②에서.
- 표제어 글자 폭 32px(`word-fit` 32px). 훈음 13px 라벨 폭: 「몸 체」 30 · 「기를 육」 43 · 「마당 장」 43 → **2~3음절 훈은 글자 폭(32)을 넘는다** — 루비로 되돌리면 칸 벌림(`--hun-n`)이 흔하게 걸린다. 원문 인용은 지금 14px / 줄 높이 24.5px, 본문 내용 폭 332px.
- 기본형 표제어(이합사 道→道歉, 활용형)의 이동은 이번에 재지 않았다(미측정). 코드상 `headFallback`이 조회 뒤에만 정해지고(`:1764`) 읽기가 오면 `word-fit--noruby`(줄 높이 1.2)에서 루비 줄 높이(1.9)로 바뀌므로 뜻 줄이 약 0.7em(약 22px) 밀린다 — 코드 근거 추정.

**결론**: 지금 첫 화면 위쪽(메타·표제어·뜻)은 이미 이동 0이다. 움직이는 것은 그 아래 일본어 대조와 예문(±16~25px)이고, 원문 인용은 첫 화면에 다 들어가지 않는다. AE-R1에서 문장 줄을 맨 위로 올리면 **첫 화면 예산이 빠듯하다**:

| 390 시트 예산 | px |
|---|---|
| 시트 440 − 머리 55 − 하단 129 = 본문 보이는 높이 | **254**(실측) |
| 위 여백 | 16 |
| 문장 줄 15px × 1.6 = 줄당 24 → 1줄 / 3줄 | 24 / 72 |
| 칩 줄 24 + 간격 8 | 32 |
| 표제어(병음+글자 62) + 훈음 루비(약 18) + 간격 8 | 88 |
| 뜻 1줄(20px × 1.5) | 30 |
| **합계 — 문장 1줄 / 3줄** | **190 / 238** (여유 64 / 16) |
| 뜻이 2줄이면 문장 3줄에서 | 268 — **넘침 14px** |

→ 계약은 「문장 3줄 + 뜻 1줄」로 잡고, 뜻 2줄·문장 3줄이 겹치는 경우를 위한 여유는 하단 등급 부제(`save-grade__sub`)를 390px에서 숨겨 12px, 칩 줄 아래 간격을 줄여 확보하는 안을 개발 세션이 실측으로 정한다(Q9).

### 5.2 칸별 높이 예약

| 칸 | 늦게 오는 것 | 예약 방법 |
|---|---|---|
| 표제어 루비(병음) | 기본형 사전 `reading` | 기본형이고 조회 전이면 `word-fit--noruby`를 붙이지 않는다 → `line-height:1.9`가 루비 자리를 이미 잡는다(`index.css:4453-4454`). 조회 뒤 읽기가 없을 때만 noruby. 일괄 조회로 대부분 T0 |
| 훈음 루비 | 훈음 표 3개(한자 대조 켬) | 한자 대조가 켜져 있으면 표 로드 전에도 훈음 줄 높이를 비워 둔다(`data-hun="reserved"`). 표는 자료 열 때 이미 받는다 |
| 뜻 줄(ko) | AI 문맥 뜻 | 한 줄 높이 `min-height`. 그 아래가 밀리는 것은 첫 화면 위쪽(문장·칩·표제어·뜻)이 아니라 허용 |
| 사전 뜻 목록 | 단건 조회(일괄 조회 실패 때) | 뜻 줄 아래라 위쪽 이동에 영향 없음. 스켈레톤 금지(정본 §2.2) — 빈 자리 1줄만 |
| 문형 한 줄 | 인덱스 | 문법 표시를 켰을 때 자료 열 때 로드 — T0 |
| 하단 | `savedWords` 로드 전 | 버튼은 지금처럼 비활성으로 그린다. 저장 상태가 나중에 바뀌면 하단 높이가 바뀌지만 본문 위쪽은 고정(본문이 위에서 시작) |

### 5.3 미리 받기 — 위치

| 무엇 | 지금 | 제안 |
|---|---|---|
| 표제어 사전 행 | 탭마다 단건(`:1739`) | 자료 열 때(분석 완료·로그인) 자료의 고유 `sep_link‖base_form`을 100개씩 `.in('base_form', chunk)`로 받아 `queryClient.setQueryData(['token-dict', lang, key], row‖null)`로 **기존 캐시를 채운다**. 카드 쪽 조회 코드는 그대로(재사용). `staleTime`은 일괄 쪽에도 같은 60s → 자료가 오래 열려 있으면 탭 때 단건 재조회가 백그라운드로 돈다(표시는 캐시 먼저). 선택 열: `base_form, meanings, reading, pos, source`. 요청 수는 고유 표제어 ÷ 100 |
| 훈음 표 | 한자 대조 켬 또는 글자 카드 열림 때 | 그대로(이미 자료 열 때). 꺼진 사용자에게는 받지 않는다(245+146+59KB) |
| refVocab | 마운트 때 | 그대로 |
| `hanjaJa.json` | zh 시트 열림 때 | AE-R1에서 일본어 대조를 내리면 글자 카드 열림 때만으로 좁힐 수 있다(바이트 절약). AE-R3에서 다시 판단 |

---

## 6. 시트 높이와 R0 버그 4 정합

| 항목 | 현황(통합 브랜치) | AE-R1 |
|---|---|---|
| 기본 높이 | `height:min(55dvh,440px)`, `max-height:calc(100dvh - 90px)`(`reader-controls.css:121`), 1119px 이하 컨테이너는 화면 키보드·가시 높이 반영(`:225`) | **그대로.** 소스 계약으로 고정 |
| 펼침 | `.is-expanded {height:85dvh}`(`:122`), 머리 위로 끌기 45px 또는 ⤢ | 그대로 |
| 낮은 화면(높이 500 이하) | `55dvh`, `max-height:calc(100dvh - 180px)`(`:192`) | 그대로 |
| 머리 | R0 버그 4: 460px 이하에서 한 줄 nowrap, 390px 머리 55px(보고서·이번 실측 모두 55) | ⋯ 44px가 한 칸 더 들어간다. 실측 폭 합: 탭 묶음 108 + ^/v 88 + ⋯·⤢·✕ 132 + 간격 16 + 패딩 16 = **360 ≤ 372**(여유 12px). 한 줄 유지. 320px 화면은 302px라 넘친다 — 320에서는 ⤢를 숨기고(끌어 올리기로 대체) 재실측 |
| 옆 패널(1120px 이상) | `height:auto; max-height:calc(100dvh - 104px)`(`:325`) | 내용 높이라 「첫 화면」 개념이 없다. 하단은 패널 안 아래 고정 그대로 |
| 수업 보드 시트 | `min(58dvh,480px)`, 768 이하 `min(52dvh,440px)` | 그대로(정본 범위 밖) |

---

## 7. 계약 개정 계획

근거 표기는 PR 본문에 「VIEWER-V2-ROUNDS-001 §절」로 쓴다.

### 7.1 개정 — 정본 §10 목록

| 파일 · 테스트 | 바뀌는 단언 | 유지하는 단언 |
|---|---|---|
| `wordCardOrder.test.js` 「본문 블록 순서 — 뜻 → 日 → 예문 → 유의어 → 한자 노트」 | §2 순서: 문장 줄 → 칩 → 표제어 → 뜻 → 문형 → 사전 뜻 목록 → 한자 정보 → 교재 설명 → 더 알아보기 → 출처 줄. `<ViewerJapaneseReference`·`<summary>한자 정보</summary>`(일반) 기준점 제거 | — |
| 같은 파일 「액션 영역」 | `runCtxExplain(...)`·「상세 설명 보기」 포함 → 0 / 「✦ 자세한 설명」 포함 | `aria-pressed={selectedKnown}`, 「✓ 단어장에 있음」, 전폭 단독 버튼 0, actrow ≥ 2(게스트·저장 줄) |
| 같은 파일 「표제어 = 기본형」「사전 reading」「`hanjaHunOf(headText)`」「메타 줄」「예문 강조」「저장 경로 불변」 | — | **전부 유지**(정본 §10). `hanjaHunOf`는 이름을 유지하고 반환을 글자별 셀(`hanjaReadingsOf`)로 바꾸면 문자열 단언이 그대로 선다 |
| 같은 파일 「일본어 대조가 자형과 의미를 구분」 | 컴포넌트 파일을 남기면 무수정. 지우면 AE-R3 자형 열 계약으로 대체 | — |
| 같은 파일 「유의어와 반의어는 구분된 줄」 | — | 유지(`syn-ant__row`) |
| `ctxExplainWiring.test.js` 「카드 배선」 3건 | 「이 문장에서는?가 유일한 트리거」 → 카드 안 `이 문장에서는?`·`runCtxExplain` 0, `fetchCtxExplain` import 0 | 서버 배선 4건·클라이언트 캐시 1건 유지 |
| `viewerSheetCard.test.js` ③ 「발음은 표제어와 같은 줄」 | 듣기가 칩 줄 끝 → 「칩 줄과 같은 줄」 | 닫기 한 곳, svg 아이콘, ✏️ 이모지 0 |
| 같은 파일 ③ 「편집이 뜻 옆」「뜻이 메타보다 크다」 | 뜻 20px(1.25rem) 굵게 — 숫자만 확인 | 유지 |
| 같은 파일 ⑤ 「병음 앵커는 보존하고 훈음은 루비 안에서 제거한다」 | `rt-hun` 금지 → 훈음 루비 셀 존재(클래스 이름은 `rt-hun`이 아닌 새 이름이면 금지 단언은 남겨도 된다) | 병음 앵커 `bottom:calc((0.5/1.9)*100%)` 동조 |
| 같은 파일 ⑤ 「훈음을 뜻과 원문 뒤에 제공」「각 라벨은 셀 안에서 줄바꿈」 | `<ViewerHanjaReading` 위치 단언 → 루비 셀이 표제어 안, 넘침은 칸 벌림(`--hun-n`) 또는 두 줄. 「절대배치·잘라내기 금지」는 루비 셀에 그대로 적용 | 절대배치·`text-overflow`·`overflow:hidden` 금지 |
| 같은 파일 ⑤ 「일본어 대응은 기존 조회 유지」 | 컴포넌트를 남기면 무수정 | — |
| `viewerHanjaReading.test.js` 4건 | 컴포넌트 삭제와 함께 루비 셀 함수 테스트로 이관(빈 표 0, 반복 글자·순서 보존, 음만 폴백, 마크업 이스케이프 — 같은 4개 성질) | 성질 4개 |
| `viewerReliability.test.js` | 새 `buildSenseList` 단언(칠한 줄 = 토큰 뜻, 사전 뜻으로 바꿔치기 0) | 「contextual sense를 사전 뜻으로 대체하지 않는다」 유지 |
| `viewerJapaneseReference.test.js` | AE-R1 무수정(요미 보존은 AE-R3) | 전부 |

### 7.2 개정 — 정본 §10에 **없는** 파일(보고 필요)

| 파일 | 걸리는 단언 | 개정 |
|---|---|---|
| `hanjaKo.test.js` 「훈음(①)도 같은 토글 아래 지연 로드」 | ViewerPage에 `listHanjaHunEum` 문자열 | 루비가 `hanjaReadingsOf`를 쓰면 문자열 → `hanjaReadingsOf`(R0+ 단일 조회 계약은 그대로 선다) |
| 같은 파일 「일본식 자형 — 글자 카드와 일본어 대조 보존」 | `word={headText}`·`jaTable={hanjaJaTable}`(대조 블록 props) | 대조 블록 제거 시 글자 카드 日 칩 단언만 남김 |
| 같은 파일 「대조 블록은 뜻 아래」 | `<ViewerJapaneseReference` 위치 | 삭제(§2.1 근거) |
| `synAntWiring.test.js` 「펼칠 때 조회」 | `onToggle` details | 요청 버튼 클릭 때 조회 + 캐시 있으면 바로 표시 |
| `wordCardFit.test.js` ④ 「글자 패널」 | 글자 카드 마크업 위치 | 위치만(표제어 아래). 내용 단언 유지 |
| `e2e/viewer-hun-layout.e2e.mjs`(CI) | `.reader-hun`·`dt/dd`·「원문 다음 훈음」 순서 | 루비 셀 선택자. **겹침 0(1440·390·320·200%)·정체 조회 골든(技术 재주 술, 一点 검은 점 점)·등급 4버튼·듣기 1개는 유지** |
| `e2e/learning-flow.e2e.mjs`(CI) `:789-791` | 「유의어·반의어」 글자를 눌러 칩 확인 | 캐시를 시드하므로 누르지 않아도 칩이 보인다 → 클릭 제거, 칩 표시만 |
| `e2e/viewer-language-settings.e2e.mjs`(CI) `:281` | `.reader-card-context`의 句子翻譯 버튼 | Q1 결정에 따라 [문장] 탭 누르기로 |
| `e2e/viewer-language-settings.e2e.mjs`(CI) `:202-205` | `.word-detail-card__known` `aria-pressed` | 클래스·`aria-pressed` 유지하면 무수정 |
| `e2e/viewer-exclusion.e2e.mjs`(CI) `:81` | `.save-grade__header` 기하 | 클래스 유지 시 무수정. 높이 단언이 있으면 확인 필요 |
| `e2e/viewer-focus-move.e2e.mjs`(CI) | 머리 ≤ 56px, 표제어·뜻·등급 스크롤 없이 | **유지**(⋯ 추가 후에도 통과해야 한다) |
| 로컬 QA `viewer-reading-controls.e2e.mjs`·`viewer-reliability.e2e.mjs`(CI 밖) | 「문장 속 쓰임」「상세 설명 보기」 | 같은 PR에서 문구만 맞춘다 |
| `TokenPosLabel.test.jsx`·`viewerTokenPosLocale.test.jsx` | 툴팁 「이 문장에서는 … 쓰였어요」 | **무수정.** 새 계약을 이 툴팁과 겹치지 않게 쓴다(Q5) |

### 7.3 새로 심을 계약

| 계약 | 파일(제안) | 방법 |
|---|---|---|
| 첫 화면 기하 | `e2e/viewer-word-card.e2e.mjs`(신규, CI 목록 추가) — 또는 `viewer-focus-move.e2e.mjs`에 더하기 | 390×844, 시트 440px, 스크롤 0에서 `.reader-card-sentence`·칩 줄·표제어·뜻·하단이 모두 보이는 영역 안. zh 미저장·ja 미저장 = 등급 4버튼, zh 저장(복습 전) = 저장 줄. 저장 상태는 `legacyLearningSnapshot({rows:[…]})`에 행 1개를 넣어 만든다(합성) |
| 경로 보류 | 같은 파일 | 자료를 열고 미리 받기가 끝난 뒤 `**/rest/v1/**`·`**/api/**`를 응답 없이 붙잡고 탭 → 2 rAF 뒤 위 요소가 모두 있다. JS 청크(`/_next/`)는 붙잡지 않는다(미리 받기 이후라는 정본 전제) |
| 이동 0 | 같은 파일 | 탭 직후 rAF2·0.3s·1s·3s(사전·번역 응답을 늦게 풀어 줌)에서 문장·칩·표제어·뜻 `top`이 같다(0px) |
| 접힘 0 · 버튼 0 | `wordCardOrder.test.js`(소스) + e2e | 소스: 일반 모드 카드 조각에 `<details`·`aria-expanded={false}` 0(수업 분기 제외). e2e: `#inspector-word` 안 `details`·`[aria-expanded=false]` 0 |
| 문구 0 | `wordCardOrder.test.js` | 카드 조각의 **JSX 텍스트·버튼 이름**에 「번역」(단어 탭)·「이 문장에서는?」·「이 문장에서」(제목)·「문맥상 · 사전」·「해석」 칩 0. `TokenPosLabel` 툴팁은 별도 파일이라 조각 밖 |
| 문장 줄 단위 | `src/lib/__tests__/viewerSentenceLine.test.js` | 한 줄 두 문장에서 둘째 문장만, 같은 단어 두 번 중 누른 것만 칠함, 경계 없는 줄 = 줄 전체, 3줄 예산 초과 = 양 끝 `…`이고 단어 보존, 무id = 첫 일치 |
| 사전 뜻 목록 | `src/lib/__tests__/viewerSenseList.test.js` | 정규화 합치기(괄호·순서), 부분 겹침은 안 합침, 칠한 줄 = 토큰 뜻, 예문은 합친 줄 아래, ≤3+ref 1, `buildMeaningOptions`와 집합 일치 |
| 훈음 루비 겹침 0 | `viewer-hun-layout.e2e.mjs` 개정 | 글자 셀과 훈음 셀 사각형이 서로·이웃 칸과 겹치지 않음, 1440·390·320·200%. **실글꼴 조건**은 목 빌드로 못 채운다 — §11.4 |
| 저장 경로 불변 | `wordCardOrder.test.js` 기존 | 유지 + `buildSenseList`·교정 경로가 `addToVocab`·`saveInlineVocabulary`에 닿지 않음 |
| 화면 문구 3개 언어 | `viewerMessages.test.js`(기존, 무수정) | 새 `vt('…')` 문구(「사전 뜻 · {n}개」「문맥상」「더 알아보기」「✦ 비슷한 말 찾기」「✦ 자세한 설명」「다음 복습 {date}」「뜻을 바꿨어요」「되돌리기」「문형」 등)는 `viewerMessages.js`에 ko·zh-CN·zh-TW 세 벌을 같이 넣어야 기존 계약 「covers each migrated static ViewerPage label」이 통과한다 |
| 시트 높이 | `viewerSheetCard.test.js` ④에 추가 | `min(55dvh,440px)`·`85dvh` 문자열 고정 |
| 교정 되돌리기(PR③) | `src/views/__tests__/senseCorrection.test.js` + e2e | 다른 뜻 탭 → `correctTokenMutation` 1회(`meaning`·`pos`만), 단어장 `update` 0, 되돌리기 → 이전 값 1회, 소유자 아님 = 탭 불가 |

---

## 8. PR 분할

| PR | 내용 | 위험 | 합격 기준 |
|---|---|---|---|
| **① 데이터·순수 함수** | `sentenceAroundToken`, `buildSenseList`, 훈음 루비 셀 계산, 표제어 일괄 조회 → `token-dict` 캐시 채우기, `savedWords`에서 다음 복습 날짜 꺼내는 함수 | 낮음(화면 변화 0, 읽기 요청만 추가) | 단위 계약 3파일 green, 일괄 조회 요청 수 = ⌈고유 표제어/100⌉(e2e 요청 계수), 기존 카드 무변화(기존 e2e 무수정 통과), `npm test` 전체 green |
| **② 골격·제거** | §2 배치 전부(문장 줄·칩·표제어+훈음 루비·뜻·문형 한 줄·사전 뜻 목록(표시만)·한자 정보·교재 설명·더 알아보기·출처 줄·하단), 접힘 0, 버튼 정리, 글자 카드 이동, 일본어 대조·훈음 목록 제거, [문장] 탭 트리거(Q1), §7 계약 개정·신설 | 중간(화면 전면 변경, 쓰기 경로 0) | 정본 §3 합격 전부(첫 화면 기하·경로 보류·이동 0·접힘 0·버튼 0·문장 줄·훈음 겹침 0·저장 경로 불변), ko·ja·en 회귀 e2e green, 390·1440 스크린샷 시안 대조, Preview + 정상 실계정 검수 |
| **③ 교정·메뉴** | 사전 뜻 줄 탭 → 이 자리 교정, 되돌리기, 머리줄 ⋯ 메뉴(「뜻·발음 수정」) | 중간(`processed_json`·`token_corrections` 쓰기) | 교정 1회·되돌리기 1회 정확성, 단어장·FSRS·`user_verified` 불변(요청 감시), 소유자 아님 = 쓰기 0, 실계정에서 교정 → 재열람 유지 확인 |

- 한 PR로 하지 않는 이유: ②가 크다(카드 400행 재배치 + 계약 10여 파일). 쓰기 경로(③)를 섞으면 검수에서 표시 회귀와 데이터 회귀를 한 번에 봐야 한다.
- ②를 더 쪼개지 않는 이유: 제거와 골격을 나누면 중간 상태(옛 블록 + 새 블록이 함께)가 배포 가능한 화면이 아니다.
- ③은 ② 없이도 낼 수 있지만, 탭할 줄이 ②에서 생기므로 순서는 ② → ③.

---

## 9. 선례 조사

| 사례 | 공개 정보 | 오픈소스·라이선스 | 우리 적용 | 판정 |
|---|---|---|---|---|
| LingQ 단어 패널 | 단어를 누르면 오른쪽 패널에 인기 뜻 최대 3개, 그중 골라 내 뜻으로 저장 | 비공개 | 「뜻 후보 중 고르기」 = 우리 사전 뜻 목록의 줄 탭 교정과 같은 동작. 다만 LingQ는 고른 뜻이 **카드 뜻**이 되고, 우리는 **이 자리 뜻**만 바꾸고 단어장은 안 덮는다(정본 §0.2) | 부분 채택(동작만) |
| Readlang | 단어 탭 → 번역 팝업 + 이전 문맥, 저장 단위가 문장과 함께 | 비공개 | 문맥 문장을 카드에 함께 두는 것은 이미 우리 계약(문장 줄). 팝업 레이아웃은 데스크톱 전제 | 배제(레이아웃), 원칙은 기존 |
| Migaku 팝업 | 사전 항목·읽기·빈도·예문·AI 설명, 상태 5종(밑줄 색), 숫자 키로 상태 변경 | 비공개 | 숫자 키 등급은 이미 `SAVE_GRADES` 키 1~4. 상태 밑줄은 AD-R2 몫 | 배제(이미 있음) |
| Yomitan 팝업 | 사전별 항목, 품사·뜻 번호 목록, 음성, Anki 내보내기 | GPL-3.0(yomidevs/yomitan) | 품사별 번호 목록은 우리 B안과 같은 관례. 코드 이식은 GPL 전염 + 사전 데이터 모델 불일치(우리는 jsonb ≤3) | 배제(코드), 관례만 확인 |
| Zhongwen(크롬 확장) | 마우스 오버 → CC-CEDICT 뜻, 고른 글자 강조 | GPL-2.0(cschiller/zhongwen) | 「누른 자리만 칠」 = 문장 안 위치 강조. 코드 불필요(우리 토큰 위치가 이미 있다) | 배제(코드) |
| Pleco 팝업 리더 | 표제어·병음·뜻 번호 목록, PLC 사전에 품사·예문 | 비공개 | 표제어 고정 크기 선례는 이미 채택(`index.css:4442-4445` 주석). 품사별 목록 구체 배치는 공개 자료로 미확인 | 미확인 |
| 바텀시트 단계 높이(Material 3 half-expanded, iOS detents medium/large) | 두 단계(절반·전체) 또는 고정 높이 | 플랫폼 가이드 | 우리 `min(55dvh,440px)`/`85dvh` 두 단계와 같은 구조. 새로 할 것 없음 | 채택(이미 반영) |
| NN/g 스켈레톤 지침(1초 안이면 표시 안 함) | 정본 §2.2가 인용 | — | T2 칸에 스켈레톤 금지, 빈 자리 예약만 | 채택(정본) |

출처: [LingQ 도움말 — 뜻 여러 개](https://lingq-support.groovehq.com/help/how-do-i-lingq-a-word-with-more-than-one-meaning) · [LingQ Hint](https://lingq-support.groovehq.com/help/what-is-the-hint-what-should-i-put-in-this-field) · [Readlang 블로그](https://blog.readlang.com/2015/03/17/auto-highlight-words.html) · [Migaku 기본](https://magenta-dirigible-0d8.notion.site/Migaku-Basics-8db656fa80f44a5993000eeb77176357) · [Yomitan GitHub](https://github.com/yomidevs/yomitan) · [Zhongwen GitHub](https://github.com/cschiller/zhongwen/wiki) · [Pleco 매뉴얼](https://android.pleco.com/manual/240/basictut.html) · [Android BottomSheetBehavior](https://developer.android.com/reference/com/google/android/material/bottomsheet/BottomSheetBehavior.html) · [SwiftUI detents](https://www.donnywals.com/presenting-a-partially-visible-bottom-sheet-in-swiftui-on-ios-16/). Pleco·Migaku의 세부 배치는 검색 결과로 확인하지 못했다(미확인).

---

## 10. 사양 모호 · 충돌

### 10.1 설계 세션에 물을 것 `[Claude][QUESTION][VIEWER-V2-ROUNDS-001]`

| # | 질문 | 근거 | 제안 |
|---|---|---|---|
| Q1 | 「번역」 버튼을 없애면 AE-R2 전까지 단어 탭에서 그 문장 해석을 여는 길이 없다. [문장] 탭은 비어 있다(「텍스트를 드래그하면」 안내, `ViewerPage.jsx:2705`). AE-R1에서 **[문장] 탭을 누르면 기존 번역 전용 경로(`runSelectedSentence(sel,true)`)를 부르게** 해도 되나? | 정본 §2.1 「문장 해석은 [문장] 탭으로」, §4 선처리는 AE-R2 | 예. 경로·캐시·AI 호출 조건은 지금 버튼과 같다(탭이 트리거). AE-R2가 0.3초 선처리를 그 앞에 얹는다 |
| Q2 | 일본어 대조 블록을 AE-R1에서 내리면 AE-R3까지 「일본어 대응」과 AI 찾기가 화면에서 없어진다. 공백을 감수하나, 아니면 AE-R3까지 블록을 사전 뜻 목록 아래에 두나? | 정본 §2.1 없어지는 것 vs §3 자형 열은 「자리만」 | AE-R3 착수가 바로 이어지면 감수. 아니면 유지 후 AE-R3에서 교체 |
| Q3 | 사전 뜻 줄을 눌러 교정하는 것은 자료 소유자만 가능하다(`reading_materials` RLS, `canEditToken`). 공개 자료 열람자·한국어·수업 모드에서는 표시만 하나? | 정본 §2.1 「다른 뜻을 누르면 교정」 | 표시만(누름 영역 없음). 열람자용 개인 교정은 새 범위 |
| Q4 | ~~「AI」 표 판정 근거가 지금 데이터에 없다 — AE-R1은 판정 함수와 자리만 둘까?~~ **결정됨(오너 2026-10-07 23:45 KST, #1337 기록 예정): 단어창 「AI」 표시는 없앤다.** 정본 §2.1 뜻 줄 예외의 「AI」 표는 폐기(AD-R3·AD-R4 포함). 판정 함수·자리도 만들지 않는다. 「사전 목록 밖 뜻」 구분이 필요한 다른 용도(「문맥상」은 사전 줄과 같을 때만)는 그대로 | 정본 §2.1 뜻 줄 예외, §8 | 폐기 — `buildSenseList`에 AI 판정 없음 |
| Q5 | 소스 계약 「단어 탭 안 이 문장에서 0」이 품사 칩 툴팁 「이 문장에서는 동사로 쓰였어요」와 겹친다(그 문구는 테스트 2개가 고정). 계약을 보이는 텍스트·버튼 이름으로 좁혀도 되나? | 정본 §3 합격, `TokenPosLabel.jsx:23` | 예. 툴팁은 유지 |
| Q6 | 「문형 · … ›」을 누르면 「그 자리에서 문형 카드가 열린다」 — 펼침이면 `aria-expanded=false`가 생겨 「접힘 0」과 충돌한다 | 정본 §2.1 문형 한 줄 vs 접힘 0 | 비모달 팝오버(`aria-haspopup="dialog"`, 한자 창과 같은 방식)로 열기. 또는 문형 줄만 계약 예외 |
| Q7 | 「미저장·복습 시점 = 등급」인데, FSRS 코호트 카드는 지금 뷰어에서 인라인 평가를 막는다(`isTokenInlineDue` legacyOnly, `fsrsLegacyBoundary`). 그 카드가 복습 시점이면 저장 줄 「다음 복습 오늘」로 두나? | 정본 §2 하단, `ViewerPage.jsx:215-217` | 저장 줄 + 「복습 차례」 문구. 인라인 평가 확대는 학습 기록 경로 변경이라 하지 않는다 |
| Q8 | 정본 목업 예문(景色十分壮观 경치가 매우 장관이다)과 실제 refVocab 예문(瀑布的景色非常壮观。 폭포의 경치가 매우 웅장해요.)이 다르다. 목업은 예시이고 데이터는 refVocab 그대로 맞나? | `h6_hsk30.js:997` | 예(데이터 무변경) |
| Q9 | 저장(복습 전) 줄에서 등급 4버튼 대신 한 줄인데, 지금 있는 등급 부제(「1분 후」 등, `save-grade__sub`)는 미저장 등급에 남기나? 목업에는 없다 | 정본 §2 목업 | 남긴다(정보·제목 툴팁과 같은 문구). 첫 화면이 모자라면 390px에서만 숨김 |

### 10.2 개발 세션이 정할 수 있는 것(제안값)

| 항목 | 제안값 |
|---|---|
| 문장 경계(라틴) | `[.!?;](?=\s|$)`, 약어 오탐 감수 |
| 3줄 예산 | CJK 60자 · 라틴 160자 + `line-clamp:3` 안전망 |
| 뜻 정규화 | §3.2(집합 동일만 합침) |
| 일괄 조회 단위 | 100개/요청, 실패 시 조용히 단건 경로로 |
| 머리줄 폭 | 390은 그대로 든다(360/372). 320 컨테이너(302px)에서는 ⤢ 숨김 — 재실측 후 확정 |
| 390 첫 화면 예산 | 문장 3줄 + 뜻 1줄을 계약으로. 넘치면 390에서 등급 부제 숨김(−12px)·칩 아래 간격 축소 |
| `classAction` 인자 | `annotation`과 `classAction`을 따로 받게 이름 정리(지금은 일반 모드에서 교재 설명이 classAction으로 들어온다) |
| 되돌리기 UI | 뜻 줄 아래 한 줄 「뜻을 바꿨어요 · [되돌리기]」 |
| 출처 줄 | 사전 행 `source`가 `jmdict*`일 때만(운영 0건이라 사실상 숨김). 선택 열에 `source` 추가 |
| 훈음 두 줄 기준 | 훈음 셀 폭 > 칸 폭 × 1.6이면 훈/음 두 줄 |
| ⋯ 메뉴 | 버튼 + 목록(`aria-haspopup="menu"`), 메뉴 항목 하나여도 메뉴로(AD-R3가 더한다) |

### 10.3 오너 결정이 필요한 새 범위

- 공개 자료 **열람자**가 「이 자리 뜻」을 고치는 개인 교정(지금 저장소는 자료 소유자 `processed_json`뿐) — 새 데이터 구조라 승인 밖.
- FSRS 코호트 카드의 뷰어 인라인 평가 허용(Q7) — 학습 기록 경로 변경이라 승인 밖.

---

## 11. 위험 · 보존

### 11.1 정본 §0.2 보존 조건

| 조건 | 지키는 방법 |
|---|---|
| FSRS 일정·review_events | 하단 `gradeInline`·`addToVocab` 호출부 무변경, 다음 복습 날짜는 읽기만. 계약: 저장 경로 불변(기존) |
| 개인 뜻·출처 | 사전 뜻 교정이 `promoteCorrection`(단어장 update)을 부르지 않는다 — PR③ 요청 감시 e2e |
| 원문·판본 | 문장 줄은 읽기 전용, `raw_text` 무변경 |
| 아는 단어 | `knownState.mutation` 호출 그대로, 모양만 체크 |
| `user_verified` 사전 뜻 | 교정은 토큰만(`dict-correct` 호출 0) |
| 이 문장 뜻은 토큰 자리에만 | `correctTokenMutation`은 `tokenId` 하나 |
| `viewerDefaults` | 설정 키 추가·변경 0 |
| 수업 모드 | `classStudyActive` 분기(TeachingWord·`<details>표시`·한자 정보 details·`classAction`·`classMeaning.editor`·`runSelectionAnalysis`) 유지. 공통 배치만 같이 |
| 기존 테스트 | §7 표대로만 개정, PR 본문에 절 번호 |

### 11.2 언어별 회귀 위험

| 언어 | 위험 | 대응 |
|---|---|---|
| 한국어 | 뜻 줄이 AI(T3), 사전 뜻 목록 없음(`morpheme_dictionary`가 ko 미지원 — 조회 `enabled: materialLang !== 'Korean'`), 문법 해설 블록(`:2336`)의 자리, ✎ 없음. #1346이 뜻 줄을 세 칸으로 바꾼다 | 사전 뜻 목록 숨김, 문법 해설은 뜻 줄 아래 유지, 뜻 줄은 #1346 구조를 그대로 받는다 |
| 일본어 | 루비가 요미(分散配置, `--yomi-n`) — 훈음 루비는 zh 전용(`hanjaHunOf`가 zh만)이라 ja 표제어 격자 무변경. 사전 뜻은 뜻별 pos 없음 → 행 pos로 묶음. 글자 카드 현행 유지(정본 §0.2) | ja e2e 1건(미저장 첫 화면) |
| 영어 | IPA 줄(`:2260`), 뜻별 pos 필수(`en_pos_v`), 문장 경계 라틴 규칙 | en 첫 화면 e2e(선택) |

### 11.3 #1346(`claude/korean-word-meaning`, head `8269ec75`)과의 겹침

| 겹치는 자리 | #1346 | AE-R1 |
|---|---|---|
| 뜻 줄(`:2264-2278`) | ko 뜻을 「단어장에 있음 뜻 · 기본형 뜻 · 맥락 뜻」 세 칸으로 | 뜻 줄을 20px 한 줄 + ✎로 |
| 「번역」 버튼(`:2329`) | 수업 분기에 `selectSentenceSource(...)` 추가 | 버튼 제거(수업 분기는 Q1·§11.1에 따라 유지) |
| `sentences` 메모(`:1071`) | `readerLineGroups`로 나누고 `lineTokenIdsOf` 추가 | 문장 줄이 줄 토큰 목록을 쓴다 — **#1346의 `lineTokenIdsOf`를 재사용**하면 중복 신설이 없다 |
| `contextWord`·`koreanSaveReady` | 기본형 뜻 후보 경로 | 하단 저장 줄이 부른다(호출부만) |

순서 제안: #1346 병합 → AE-R1 ① 무충돌(새 파일 위주) → ②를 #1346 반영 main에 맞춰 작성. ko 뜻 줄은 #1346의 세 칸을 「메타 문구 0」 규칙에 맞게 라벨만 정리할지 설계 세션 확인(Q10으로 넘길 수 있음 — #1346 범위 결정과 엮여 있어 이번 질문 목록에는 넣지 않았다).

### 11.4 측정 한계

- e2e 목 빌드의 글꼴은 목(`google-fonts-mock.cjs`)이고 이 컨테이너에는 CJK Noto 글꼴이 없다. 정본의 「실글꼴」 기하(훈음 겹침 0, 시안 대조)는 배포 Preview에서 `viewer-reading-controls.e2e.mjs`의 실글꼴 확인 방식으로 해야 한다.
- 저장(복습 전) 상태 첫 화면은 합성 스냅샷에 행이 필요해 이번에 재지 않았다(미측정).

---

## 12. 텍스트 목업 (실제 코드 데이터로 채움)

데이터: 문장·토큰은 `e2e/viewer-focus-move.e2e.mjs`의 합성 자료(정본 예문과 같은 문장), refVocab은 실제 콘텐츠 파일, 훈음은 R0+ 조회(`hanjaReadingsOf`) 실행 결과, 사전 행은 **합성**(운영 DB 미조회).

### 12.1 390px · zh 미저장 · 壮观 · 한자 대조 켬

```
┌ 시트 min(55dvh,440px) ─────────────────────────┐
│ [단어│문장]           [^][v]  [⋯] [⤢] [✕]     │ 머리 한 줄 ≤56px
├────────────────────────────────────────────────┤
│ 眼前的体育场比照片上更【壮观】。                 │ 15px 회색, 壮观만 칠함
│ [형용사·명사→형용사] [HSK 6]               🔊   │ 칩 줄(TokenPosLabel·refLevelLabel)
│  zhuàng   guān                                  │ token.furigana
│   壮       观                                   │ word-fit, 자형 열 자리(빈 열)
│ 씩씩할 장  볼 관                                │ 훈음 루비(hanjaReadingsOf)
│ 웅장하다, 장관이다                          ✎   │ token.meaning, 20px 굵게
│ ─ 사전 뜻 · 2개                                  │
│  형용사 ① 웅장하다, 장관이다          문맥상    │ ← 칠한 줄(합성 사전 행 = refVocab ko와 집합 동일 → 합침)
│           瀑布的景色非常【壮观】。               │ refVocab ex(예문 강조 = splitSentenceAroundWord)
│           폭포의 경치가 매우 웅장해요.           │
│  명사   ② 장관, 웅장한 경관                     │
├══ 하단 고정 ════════════════════════════════════┤
│ 얼마나 알겠어요?                    ☐ 아는 단어 │
│ [1 다시][2 어려움][3 알맞음][4 쉬움]            │
└────────────────────────────────────────────────┘
(첫 화면 밖, 스크롤) ─ 한자 정보(없음: refVocab에 hanja 없음) · ─ 더 알아보기 [✦ 비슷한 말 찾기][✦ 자세한 설명]
```

정본과 다른 점: (1) 예문이 refVocab 실제 값(Q8). (2) 사전 뜻 ①이 「(경관이) 웅장하다, 장관이다」가 아니라 합성 값 — 운영 사전 행은 확인하지 않았다. (3) 품사 칩은 지금 `TokenPosLabel`이 겸류를 「후보 전체 + 문맥 강조」로 그린다(정본 목업은 한 칩). 칩 표시 규칙은 바꾸지 않는다. (4) 예산(§5.1): 문장 1줄·뜻 1줄이라 본문 약 190/254px — 「사전 뜻 · 2개」 머리까지 첫 화면에 보인다. (5) 「기를 육」(43px)처럼 훈이 글자 폭 32px를 넘으면 그 칸만 벌어진다(실측 폭).

### 12.2 1280px · 옆 패널 336px · zh 미저장 · 壮观

```
                 본문 열                         ┌ 옆 패널 336px (height:auto) ─┐
 眼前的体育场比照片上更壮观。                     │ [단어│문장]   [^][v][⋯][✕]   │ ⤢ 없음(옆 패널)
                                                  ├───────────────────────────────┤
                                                  │ 眼前的体育场比照片上更【壮观】。│
                                                  │ [형용사…] [HSK 6]         🔊  │
                                                  │  zhuàng  guān                  │
                                                  │   壮      观                   │
                                                  │ 씩씩할 장 볼 관                │
                                                  │ 웅장하다, 장관이다         ✎  │
                                                  │ ─ 사전 뜻 · 2개               │
                                                  │  형용사 ① 웅장하다, 장관이다  │
                                                  │                     문맥상    │
                                                  │      瀑布的景色非常【壮观】。  │
                                                  │      폭포의 경치가 매우 웅장해요.│
                                                  │  명사   ② 장관, 웅장한 경관    │
                                                  │ ─ 더 알아보기                  │
                                                  │ [✦ 비슷한 말 찾기][✦ 자세한 설명]│
                                                  ├═══════════════════════════════┤
                                                  │ 얼마나 알겠어요?  ☐ 아는 단어 │
                                                  │ [1 다시][2 어려움][3 알맞음][4 쉬움]│
                                                  └───────────────────────────────┘
```

정본과 다른 점: 옆 패널은 내용 높이라 「첫 화면」 제약이 없다. 336px에서 「문맥상」이 같은 줄에 안 들어가면 줄 끝 다음 줄로 내려간다(위 그림) — 개발 세션이 폭 실측 후 결정.

### 12.3 390px · ja 미저장 · 天気

```
┌──────────────────────────────────────────────┐
│ [단어│문장]          [^][v] [⋯] [⤢] [✕]     │
├──────────────────────────────────────────────┤
│ 今日は【天気】がとてもいいです。               │
│ [명사]                                   🔊  │ 급수 없음(refVocab zh 전용)
│  てんき                                       │ 요미(分散配置 그대로)
│  天気                                         │ 훈음 루비 없음(zh 전용)
│ 날씨                                      ✎  │
│ ─ 사전 뜻 · 2개                                │
│  명사 ① 날씨                        문맥상    │ 행 pos로 묶음(ja는 뜻별 pos 없음)
│       ② 좋은 날씨                             │ 합성 사전 행
│ (출처 줄: 사전 행 source=jmdict일 때만 — 운영 0건)│
├══════════════════════════════════════════════┤
│ 얼마나 알겠어요?                  ☐ 아는 단어 │
│ [1 다시][2 어려움][3 알맞음][4 쉬움]          │
└──────────────────────────────────────────────┘
```

정본과 다른 점: 정본에 ja 목업이 없다. 일본어 글자 카드는 현행 유지(표제어 한자 누르면 아래에 열림).

### 12.4 390px · zh 저장(복습 전) · 体育场

```
┌──────────────────────────────────────────────┐
│ [단어│문장]          [^][v] [⋯] [⤢] [✕]     │
├──────────────────────────────────────────────┤
│ 眼前的【体育场】比照片上更壮观。               │
│ [명사] [HSK 2]                           🔊  │
│   tǐ    yù    chǎng                           │
│   体    育    场                              │
│ 몸 체 기를 육 마당 장                          │ 「기를 육」이 글자 폭보다 넓으면 그 칸만 벌림(--hun-n)
│ 경기장, 스타디움                          ✎  │
│ ─ 사전 뜻 · 1개                                │
│  명사 ① 경기장, 스타디움            문맥상    │ refVocab만(사전 행 없음 가정)
│       比赛在【体育场】举行。                   │
│       경기는 경기장에서 열려요.                │
├══════════════════════════════════════════════┤
│ ✓ 단어장에 있음 · 다음 복습 10월 12일          │ nextQuestionAt → KST 날짜
│ [이 문맥 추가]                    ☐ 아는 단어 │ 390px에서 한 줄이 넘치면 두 줄
└──────────────────────────────────────────────┘
```

정본과 다른 점: 정본은 저장 줄을 한 줄로 그렸다. 390px에서 「✓ 단어장에 있음 · 다음 복습 10월 12일」(약 190px) + 「이 문맥 추가」(44px 버튼, 약 90px) + 「☐ 아는 단어」(약 90px) + 여백이면 372px를 넘을 수 있다 — 넘치면 두 줄. 날짜 문자열은 예시(합성).
