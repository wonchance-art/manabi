# 뷰어 v2 AD-R3 — 한 단어로 묶기 · 나누기 구현 설계서

- 작성: 2026-10-07 KST · 설계 에이전트. 코드는 바꾸지 않았고 이 문서만 커밋한다.
- 기준: main `db86e433`(R0 #1354·#1356·#1355 병합). 행 번호는 모두 이 커밋 기준이다. AE-R1(⋯ 메뉴)은 아직 병합되지 않았으므로, ⋯ 메뉴는 AE-R1 설계서(`claude/viewer-v2-ae-r1` `docs/manabi-viewer-v2-ae-r1.md` §8 PR③)가 만든다고 전제한다.
- 정본: VIEWER-V2-ROUNDS-001(이하 「정본」) §0.1·§0.2·§7·§10·§11. 그 위에 오너 결정 하나가 우선한다: **단어창 「AI」 표시 없음**(10-07 23:45). 따라서 정본 §7의 「문맥 AI 뜻(「AI」 표)」에서 표는 빼고 뜻만 둔다.
- 승인 범위: 중국어·일본어·영어의 묶기·나누기는 지속 실행 승인(2026-10-02) 안이다. **한국어 어절 칼선은 승인 밖이다.** 이 문서는 오너 확인용 목업 2안(§7.4)만 내고 구현 범위에는 넣지 않는다. → 2026-10-09 오너가 안 B를 골랐다. 한국어 어절 안 나누기 구현은 §7.5다(어절을 넘는 묶기는 여전히 미정).
- 측정: 코드 실측과 단위 수준 스크립트만 썼다(Node 24, vitest로 실제 `tokenizeZhLine`·refVocab 6,903항 실행). 빌드·e2e·운영 DB·실계정은 보지 않았다. 스크립트와 결과 JSON은 커밋하지 않았고 세션 scratchpad `ad-r34-measure/`에 있다(§2).

---

## 0. 결론

1. **「이 자료」 범위는 DB 변경 없이 된다.** 경계 교정은 `processed_json.metadata.viewerBoundaries`에 둔다. 쓰기는 이미 있는 원자적 교체 RPC `viewer_replace_analysis`를 쓴다(`supabase/migrations/20260908234552_viewer_reliability_atomic_operations.sql:2-37`). 이 RPC는 기대값 비교·소유자 확인·분석 임대 확인을 이미 한다. 이력은 `token_corrections`에 한 줄 더 쓴다. `token_corrections`는 `after_value.source`로 종류를 구분하는 선례가 있다(`api/explain/route.js:115-120` `ai_explain_suspect`). 재분석 보존기는 `meaning·furigana·reading·pos` 키만 읽으므로(`reanalysisPreservation.js:26-28`) 경계 기록이 뜻 보존을 건드리지 않는다.
2. **데이터 모델은 「구간별 칼선 + 원래 토큰 보관」이다.** 한 줄 안에서 서로 겹치지 않는 기록 `{line, start, end, text, cuts, base}`를 둔다. `start`·`end`는 공백을 뺀 글자 위치이고, `base`는 그 구간의 분석기 원래 토큰을 id째 보관한다. 새 칼선이 `base`의 칼선과 같아지면 기록을 지우고 `base`를 그대로 되살린다. 그래서 「나누기 → 다시 묶기」와 「묶기 → 다시 나누기」가 **id·뜻·병음까지 정확히 원상태**가 된다. 실제 분할로 검증했다: 예문 6,789문장에서 묶기 왕복 36,699회와 나누기 왕복 18,694회가 실패 0이다. 재절단(`请|把手|机关|机` → `把|手机|关机`)과 그 복원도 확인했다(§2.2).
3. **새 토큰의 뜻·병음·품사는 기존 분석 경로가 만든다.** `/api/analyze`에 `boundaries`를 더한다. 서버는 토큰화 직후 순수 함수 `applyBoundaryEdits`로 칼선을 적용하고, 그 뒤 사전 조회·뜻 조회·품사 판별·병음을 지금처럼 돈다(`analyze/route.js:89-287`). 묶기·나누기와 재분석이 같은 함수를 지나므로, **재분석 뒤 유지는 같은 길을 한 번 더 타는 것**이다. 중국어 병음은 줄 문맥으로 이미 글자마다 정해져 있어 이어 붙이거나 글자 수대로 나누면 된다(`splitZhToken` 선례, `disambiguateZhPos.js:170-179`).
4. **사용자가 묶은 토큰은 AI가 다시 쪼개면 안 된다.** 품사 판별기는 품사 단서가 없는 2글자 이상 토큰을 「단어성 판정」에 넣는다. 이것이 분리 판정이면 자동으로 쪼갠다(`disambiguateZhPos.js:57-61,139-142`, `analyze/route.js:235-240`). 묶은 토큰에 `boundary:'user'` 표식을 달고 이 경로에서 뺀다. 이 계약이 없으면 身体素质를 묶어도 다음 분석에서 판별기가 다시 가를 수 있다.
5. **저장 단어·출처·복습 일정은 쓰지 않는다. 다만 「원문으로 돌아가기」는 지금 깨진다.** 묶기·나누기는 `user_vocabulary`·`vocabulary_contexts`·`review_events`·FSRS를 건드리지 않는다. 그런데 저장 문맥의 위치 정보는 `{tokenId, surface}`이고(`server/learningContext.js:87`), 되돌아갈 때 쓰는 `readingSourceTarget`(`learningSources.js:109-148`)은 id가 없어지면 **토큰 경계에 맞는 표면**으로만 다시 찾는다. 身体를 저장한 뒤 身体素质로 묶으면 경계가 없어져 `null`이 된다. 그래서 경계 기록의 `base` id로 「지금 그 자리를 덮는 토큰」을 찾는 규칙을 하나 더한다(§4.3).
6. **팀 수업 사본에서는 묶기·나누기를 막는다.** 사본 갱신은 분할이 달라지면 「단어의 분석 단위가 달라졌어요」로 멈추게 돼 있다(`classCopyModel.js:28-55`). 학생이 사본에서 묶으면 이후 교재 갱신이 모두 막힌다. 사본 갱신이 경계 기록을 옮기도록 고치는 일은 다음 라운드로 미룬다(Q3).
7. **「내 다른 자료에도」는 새 표 하나(비파괴 추가)가 필요하다.** `user_segment_rules`다. jieba 사용자 사전(`add_word`)은 쓸 수 없다. jieba-wasm 사전은 프로세스 전역이고(`zhSuppress.js` 머리 주석), 서버리스 인스턴스는 여러 사용자가 함께 쓴다. 한 사람의 단어가 다른 사람의 분석에 샌다. 그래서 토큰화 뒤 후처리로 적용한다(`zhTokenFix.js`와 같은 층). SQL 초안·롤백·보존 검사는 §5.3에 있다.
8. **「공유 사전」은 관리자만 쓴다. 그런데 지금 있는 공유 사전 쓰기 API에는 관리자 검사가 없다.** `/api/dict-correct`는 로그인만 확인하고 service_role로 `user_verified` 행을 upsert한다(`api/dict-correct/route.js:15-81`). 경계 규칙의 공유 범위는 새 관리자 라우트(`requireAdmin`, `server/auth.js:27`)로만 쓰게 한다. dict-correct 문제는 범위 밖이라 보고만 한다(§12.3).
9. **사전 「등재」의 뜻을 좁혀야 한다(AD-R4와 공유).** 묶은 꼴이 사전에 없으면 분석 경로가 뜻을 받아 `morpheme_dictionary`에 `source:'gemini'`로 쌓는다(`fetchMeanings.js:274,301`). 그래서 gemini 행은 「사전 등재」의 근거가 될 수 없다. 사용자 한 명의 잘못 묶은 꼴이 모두의 자동 경계가 되기 때문이다. AD-R4 설계서 §5는 등재를 refVocab 표제어, `user_verified`·`jmdict*` 행, 코드 화이트리스트로 정의한다.
10. **PR은 넷이다.** ① 순수 함수와 계약(화면 변화 0) → ② 서버 적용과 재분석 연결(쓰기 경로이지만 UI 0) → ③ 이 자료 묶기·나누기 UI와 쓰기 → ④ 사용자 사전(DDL)과 공유 규칙(관리자). 쓰기 경로와 DDL을 서로 다른 PR로 나눈다(§9).

---

## 1. 현행 지도

### 1.1 토큰 구조 — `processed_json`

| 요소 | 형식 | 근거 |
|---|---|---|
| `sequence` | 토큰 id 배열. 줄 순서. id = `id_<줄>_<줄 안 순번>_<시각>`, 줄바꿈 `br_<줄>_<시각>`, 실패 `failed_<줄>_<시각>` | `analyzeText.js:195,212,228`, `analysisCoverage.js:2-5` |
| `dictionary[id]` | `{text, furigana, pos, meaning, base_form, sep_link?, pos_all?}`. 한국어는 `sourceSpan·selectionGroup·morphology·meaningLocale` 등을 더 갖는다 | `analyze/route.js:276-284`, `koreanAnalysis.js:136-160` |
| `sep_link` | 이합사 O 조각이 VO를 가리킨다(道了歉의 歉 → 道歉). 카드·저장 키는 `sep_link ?? base_form`이다 | `tokenizeZh.js:100-104`, `ViewerPage.jsx:1718-1719` |
| `metadata.viewerCorrections` | 재분석 뒤 이어 붙인 교정 필드 표식 `{id: ['meaning',…]}` | `reanalysisPreservation.js:17-22,68-70` |
| 줄 좌표 | id 접두가 원문 줄 번호다. 커버리지 검사가 줄별 토큰 글자를 공백 없이 원문과 대조한다 | `analysisCoverage.js:7-41` |
| 영어 공백 | 공백은 토큰이 아니다(`tokenizeEn.js:74-89`). 비교는 공백을 지우고 한다 | 같음 |

### 1.2 경계를 만드는 곳(서버)

| 언어 | 단계 | 근거 |
|---|---|---|
| 중국어 | jieba-wasm → `fixZhTagged`(되가름·오태그 화이트리스트) → 줄 병음 배분 → (라우트) OOV 분리 판정 `splitZhToken` | `tokenizeZh.js:50-112`, `zhTokenFix.js`, `zhSuppress.js`(전역 `add_word`), `analyze/route.js:235-240` |
| 일본어 | kuromoji → 읽기 수리 → 가나 분절 → 복합명사 재병합(`mergeJaCompounds`, 표제어이고 읽기가 하나일 때만) | `tokenizeJa.js:79`, `jaCompoundMerge.js:1-30` |
| 영어 | 정규식 토큰화 + lemma 후보. 구동사 처리는 없다 | `tokenizeEn.js:67-91` |
| 한국어 | LLM이 고정 어절 틀(공백 기준)에 맞춰 토큰을 낸다. 어절 안 분석은 `morphology`에만 둔다. 서버 검증이 어절 범위와 다른 토큰을 거부한다 | `koreanAnalysis.js:60-160`(특히 `:136-141`) |

### 1.3 교정 · 보존 장치

| 장치 | 하는 일 | 경계 교정과의 관계 | 근거 |
|---|---|---|---|
| `correctTokenMutation` | 토큰 하나의 `meaning·furigana·pos`를 덮고 `processed_json` 전체를 `update`한다. **기대값 비교가 없다.** 구간 자료는 `correct_source_passage_token` RPC를 쓴다. `token_corrections`에 이력을 쓴다 | 경계 교정은 `sequence`를 바꾸므로 이 경로를 쓰지 않는다(분석 배치 저장과 경합하면 덮어쓴다). 묶은 토큰의 뜻 수정에는 그대로 쓴다 | `ViewerPage.jsx:1491-1544`, `sourcePassage.js:126-137` |
| `promoteCorrection` | 「이 단어 전체에 적용」: `/api/dict-correct`로 공유 사전에 `user_verified`를 쓰고 단어장 뜻도 바꾼다 | 경계 교정은 부르지 않는다(§0.2 단어장 뜻 자동 덮기 금지) | `ViewerPage.jsx:1551-1584` |
| `token_corrections` | `material_id, token_id, user_id, before_value, after_value`. 본인 insert, 본인 또는 자료 소유자 읽기. update·delete 정책 없음(추가 전용 로그) | 경계 이력 행을 추가한다(`after_value.source:'boundary_edit'`) | `20260414000300_token_corrections.sql` |
| `preserveReanalysisTokens` | 같은 줄 · 같은 글자 위치 · 같은 표면의 토큰에만 이전 id와 교정값을 잇는다. 분할이 바뀐 토큰은 잇지 않는다 | 경계 교정이 재분석에서 다시 적용되면 묶은 토큰도 같은 위치·표면이므로 그 뜻 교정까지 이어진다. 계약 「changed segmentation은 잇지 않는다」(`reanalysisPreservation.test.js:33-39`)는 그대로 둔다 | `reanalysisPreservation.js:10-71` |
| `runPreservedReanalysis` | 교정 이력 전 페이지를 읽고, 실패하면 중단한다. 원래 `metadata`를 이어받아 분석하고 `viewer_replace_analysis`로 저장한다 | `metadata.viewerBoundaries`가 저절로 이어진다(`:172,198`). 분석 요청에 경계를 실어 보내는 일만 더한다 | `reanalysisPreservation.js:144-207` |
| 팀 사본 갱신 | 분할이 기준과 다르면 갱신을 멈춘다. 저장 문맥이 토큰 id를 쓰기 때문이다 | §0.6 | `classCopyModel.js:18-70` |

### 1.4 경계에 기대는 것들

| 무엇 | 경계가 바뀌면 | 근거 | 대응 |
|---|---|---|---|
| 저장 문맥 위치 `{tokenId, surface}` | 구성 토큰의 id가 없어진다 | `learningContext.js:87`, `learningSources.js:109-148` | §4.3 덮는 토큰 찾기 규칙 |
| 저장·복습 표시(본문 칠) | 身体를 저장했어도 身体素质 자리에서는 칠이 사라진다(새 단어로 보인다) | `ViewerPage.jsx:2090` `tokenDisplayState` | 묶기 확인 줄에 「단어장의 身体는 그대로 있어요」를 알린다(§6.2) |
| 읽기 위치 `reading_progress.last_token_idx` | `sequence` 길이가 줄면 그 줄 뒤로 최대 (묶은 수 − 1)칸 밀린다 | `useScrollRestore.js:31,60-69` | 허용(문단 안 오차). 보고만 |
| 만남 기록 | 드래그 목록 토큰의 `base_form`으로 남긴다. 묶은 뒤에는 묶은 꼴이 만남이 된다 | `ViewerPage.jsx:998-1031` | 의도한 결과. 기존 기록은 바꾸지 않는다 |
| 문형 밑줄·통계(아는 단어 %·새 단어 수) | 토큰에서 다시 계산된다 | — | 없음 |
| 분석 캐시(localStorage) | 같은 줄을 드래그 분석하면 옛 분할 결과가 나올 수 있다 | `viewerAnalysisCache.js` | 경계 교정 성공 때 `clearAnalysisCache`(교정 경로와 같은 규칙) |

---

## 2. 측정

### 2.1 분할 오류의 크기 — refVocab 표제어를 자기 예문에서 토큰화

refVocab 중국어 6,903항의 예문을 지금 토크나이저(`tokenizeZhLine`)에 넣었다. 그다음 2글자 이상 표제어가 예문에서 어떻게 나뉘는지 셌다.

| 결과 | 수 | 비율(위치를 찾은 5,702 기준) | 예 |
|---|---|---|---|
| 한 토큰 | 5,277 | 92.5% | — |
| **묶기가 필요**(이웃 토큰 2개 이상이 정확히 덮음) | 155 | 2.7% | 不客气 ← 不\|客气 · 踢足球 ← 踢\|足球 · 那时候 ← 那\|时候 · 有空儿 ← 有\|空儿 (2개 140 · 3개 14 · 4개 1) |
| **나누기가 필요**(더 긴 토큰 안에 들어 있음) | 251 | 4.4% | 王先生 ⊃ 先生 · 肚子疼 ⊃ 肚子 · 感兴趣 ⊃ 兴趣 · 打电话 ⊃ 电话 |
| **재절단이 필요**(경계를 가로지름) | 19 | 0.3% | 请\|把手\|机关\|机 · 你\|先进\|去 · 有无\|糖 · 开线\|上\|会议 |

- 재절단 19건 때문에 모델은 「묶기만」·「나누기만」이 아니라 **나누기와 묶기를 이어서 할 수 있어야** 한다. 구간별 칼선 모델은 이것을 같은 연산으로 처리한다.
- 3글자 이상 토큰 1,262개 중 652개는 표제어가 아니고, 그중 333개는 표제어 둘로 갈린다(王先生 → 王\|先生, 第一次 → 第一\|次).

### 2.2 왕복 정확 복원 — 프로토타입 검증

§3.2 모델을 60행짜리 프로토타입으로 짜서 같은 예문 6,789문장에 돌렸다(`ad-r34-measure/roundtrip.test.mjs`).

| 시험 | 횟수 | 실패 |
|---|---|---|
| 이웃 두 토큰 묶기 → 원래 칼선으로 나누기 → 원래 토큰 객체와 동일(같은 참조), 기록 0 | 36,699 | 0 |
| 2글자 이상 토큰을 글자마다 나누기 → 다시 묶기 → 동일, 기록 0 | 18,694 | 0 |
| 재절단 `请\|把手\|机关\|机\|。` → 나누기 2회 + 묶기 2회 → `请\|把\|手机\|关机\|。` → 원래 칼선으로 한 번에 되돌리기 → 동일 | 1 | 0 |

이 수치는 「토큰 배열 + 기록」의 성질만 증명한다. 뜻·병음 같은 서버 산출 필드는 되돌릴 때 `base`를 그대로 되살리므로 같아진다. 다만 저장(RPC)·재분석까지 포함한 왕복은 PR②·③의 단위·e2e 계약으로 다시 확인한다.

### 2.3 미측정

- 운영 자료에서 사용자가 실제로 묶기·나누기를 얼마나 할지(사용 빈도).
- 일본어·영어 분할 오류율(같은 방식의 표제어 대조는 일본어가 분석기 라운드 10에서 했다 — `jaCompoundMerge.js:5-7`, 미생존 7.2%).
- 한국어 형태소 경계 후보가 표면과 맞는 비율(§7.4에서 예로만 보인다).

---

## 3. 데이터 모델

### 3.1 기록 형식 — `processed_json.metadata.viewerBoundaries`

```jsonc
{
  "version": 1,
  "edits": [
    {
      "id": "b_7f3a9c21",          // 기록 id(이력·출처 연결용)
      "line": 0,                    // 원문 줄 번호(토큰 id 접두와 같은 좌표)
      "start": 5, "end": 9,         // 공백을 뺀 줄 글자 위치(UTF-16)
      "text": "身体素质",           // 그 구간의 공백 뺀 원문 — 재분석 때 확인용
      "cuts": [],                   // 구간 안 칼선(절대 위치). [] = 한 단어
      "base": [                     // 그 구간의 분석기 원래 토큰(id째)
        { "id": "id_0_3_1728", "token": { "text": "身体", "furigana": "shēn tǐ", "pos": "명사", "meaning": "신체, 몸", "base_form": "身体" } },
        { "id": "id_0_4_1728", "token": { "text": "素质", "furigana": "sù zhì", "pos": "명사", "meaning": "자질, 소양", "base_form": "素质" } }
      ],
      "status": "applied",          // applied | pending(재분석에서 적용 못 함)
      "at": "2026-10-08T10:00:00+09:00"
    }
  ]
}
```

- 위치를 공백 뺀 좌표로 두는 이유가 셋이다. (a) 중국어·일본어 분석 요청은 줄을 `trim()`해서 보낸다(`analyzeText.js:92`). (b) 영어는 공백이 토큰이 아니다. (c) 커버리지·출처 대조가 이미 공백을 지운 좌표를 쓴다(`analysisCoverage.js:7`, `learningSources.js:45`).
- 크기: 기록 하나가 토큰 2~4개 사본이라 수백 바이트다. 한 자료에 수십 개까지는 문제가 없다(상한 제안 200개, §11.2).

### 3.2 불변식과 연산

**불변식**
1. 한 줄 안의 기록은 서로 겹치지 않는다.
2. 기록의 `base`는 언제나 **분석기 원래 토큰**이다. 다른 기록의 결과물이 아니다.
3. 기록 구간의 양 끝은 현재 토큰 경계와 같다.

**편집 `editBoundaries(lineTokens, edits, {start, end, cuts})`**(순수 함수)
1. 구간과 겹치는 기존 기록을 모아 구간을 넓힌다.
2. 넓힌 구간의 `base`를 다시 만든다. 겹친 기록의 `base`와 기록 밖 현재 토큰(= 분석기 원래 토큰)을 순서대로 합친다.
3. 목표 칼선 = (넓힌 구간의 현재 칼선 중 새 구간 밖의 것) ∪ (새 구간 안의 요청 칼선).
4. **목표 칼선이 `base` 칼선과 같으면** 겹친 기록을 모두 지우고 `base` 토큰을 id째 되살린다. 서버 호출은 0이다.
5. 아니면 기록 하나로 합친다. 새 조각은 서버가 만든다(§3.4).

묶기 = `cuts: []`, 나누기 = `cuts: [칼선…]`, 재절단 = 나누기와 묶기를 잇달아 하는 것이다. 왕복이 정확한 이유는 4단계 하나다(§2.2 실측).

### 3.3 토큰 id

- 새 조각: `id_<줄>_e<k>_<리비전 8자>`. 접두가 `id_<줄>_`이라 줄 좌표 검사(`analysisCoverage.js:2-5`)와 재분석 id 이동(`reanalysisPreservation.js:39`)을 그대로 통과한다.
- 되살린 토큰: `base`의 원래 id. 저장 문맥이 원래 id를 가리키고 있으면 되돌린 뒤 정확히 다시 맞는다.

### 3.4 서버 적용 — `/api/analyze`의 `boundaries`

```
요청: { lines, language, boundaries?: [{ line: <문단 안 번호>, start, end, text, cuts, id }] }
응답: results[li] += { boundaryApplied: [{ id, status: 'applied'|'pending', base: [토큰…] }] }
```

- 적용 위치: 토큰화(`analyze/route.js:91-101`) **직후**, 기본형 수집(`:105-110`) **전**이다. 그래서 새 조각이 사전 조회·뜻 조회·품사 판별·병음 배분의 입력이 된다. 함수는 `src/lib/boundaryEdits.js`에 두고 서버·클라이언트가 같이 쓴다(서버 전용 import 금지).
- 순서: 공유 규칙(③) → 사용자 규칙(②) → 이 자료 기록(①). 뒤에 오는 것이 이긴다.
- 조각 필드:

| 언어 | text | base_form | furigana | pos |
|---|---|---|---|---|
| 중국어 | 원문 구간 | = text(이합사 조각이 섞이면 묶기를 막는다 §6.1) | 구성 토큰 병음을 이어 붙인다. 나누기는 글자 수대로 나눈다(`splitZhToken`과 같은 규칙) | 사전 → 품사 판별(일반 마크, **OOV 분리 판정 제외**) |
| 일본어 | 원문 구간 | 앞 조각의 표면 + 마지막 조각의 `base_form`(申し\|込ん → 申し込む, 映画\|館 → 映画館) | 묶기: 사전 reading(`jaYomiIndex` 역색인 선례) → 없으면 구성 읽기 연결. 나누기: 조각 사전 reading → 없으면 비워 두고 뜻 조회가 채움(`analyze/route.js:255-257` 일본어는 캐시 reading 우선) | 사전 |
| 영어 | 원문 구간(사이 공백 포함, `pick up`) | 첫 조각 lemma + 나머지 소문자(`picked up` → `pick up`) | IPA는 사전 | 사전. 영어 문맥 판별 occurrence 키(`disambiguateEnPos`)는 적용 뒤 순번으로 계산된다 |

- 표식: 적용된 조각에 `boundary: 'user'`(①) · `'user_rule'`(②) · `'shared_rule'`(③)을 단다. `collectZhPosMarks`는 이 표식이 있으면 `oov`를 달지 않고, 라우트는 `splitZhToken`을 적용하지 않는다(§0.4).
- 적용 실패: 구간 글자가 `text`와 다르거나 양 끝이 새 토큰 경계와 맞지 않으면 `pending`이다. 그 기록은 지우지 않고 남긴다. 「적용하지 못한 단어 경계 N개」를 재분석 결과에 알린다. 조용히 버리지 않는다.

### 3.5 재분석 뒤 유지

1. `runPreservedReanalysis`가 원래 `metadata`(`viewerBoundaries` 포함)를 `analyze`에 넘긴다(`reanalysisPreservation.js:172,181-182`). 이것은 지금도 그렇다.
2. `analyzeHybrid`가 원문 줄 변경(`diffLineMap`)을 반영해 기록의 줄 번호를 옮기고, 문단마다 해당 기록을 `boundaries`로 싣는다(`analyzeText.js:171-176` 요청 본문).
3. 서버가 적용한 결과와 새 `base`를 돌려준다. 클라이언트는 기록의 `base`를 새 분석기 토큰으로 바꾸고 `status`를 갱신한다.
4. `preserveReanalysisTokens`는 묶은 토큰도 같은 줄·위치·표면이라 이전 id와 뜻 교정을 잇는다. 이 함수 자체는 바꾸지 않는다.
5. 원문 줄이 바뀌어 `text`가 그 위치에 없으면, 같은 줄에서 `text`가 정확히 한 번 나올 때만 위치를 옮긴다. 아니면 `pending`이다.

---

## 4. 쓰기 경로와 보존

### 4.1 「이 자료」 묶기·나누기 한 번의 흐름

1. 클라이언트가 `editBoundaries`로 새 기록을 계산한다.
2. 4단계 복원이면 서버 호출 없이 `base`를 되살린다. 아니면 그 줄 하나만 `/api/analyze`에 `boundaries`와 함께 보낸다. 레이트 리밋은 사용자당 분당 20회다(`analyze/route.js:61-69`). 묶기는 드물어서 충분하다.
3. 새 `processed_json`을 만든다. 바뀐 구간 밖 토큰은 **기존 객체와 id 그대로**, 구간 안은 서버 조각, 기록은 `metadata.viewerBoundaries`에 둔다. `metadata.viewerRevision`을 새 시도 id로 바꾼다.
4. `viewer_replace_analysis(p_id, p_expected_raw = 지금 원문, p_expected_json = 지금 분석, p_raw = 같은 원문, p_json, p_attempt)`로 저장한다. 다른 창에서 바뀌었으면 `40001`로 거절되고, 분석 임대 중이면 거절된다. 둘 다 「다시 열어 확인해 주세요」로 알리고 화면은 그대로 둔다.
5. `token_corrections`에 이력 1행을 쓴다. `token_id` = 구간 첫 토큰 id, `before_value` = `{boundary:{line,start,end,text,cuts:이전}}`, `after_value` = `{source:'boundary_edit', id, cuts, scope}`. 실패해도 자료 저장은 유지한다(지금 교정 로그와 같은 규칙, `ViewerPage.jsx:1515-1528`).
6. `clearAnalysisCache`, `['material', id]` 무효화, 선택 토큰을 새 조각으로 바꾼다.

- **구간 자료(작성기 passage)**: `viewer_replace_analysis`가 소유자·임대를 확인하므로 기술적으로는 쓸 수 있다. 다만 구간 자료의 토큰 교정은 별도 RPC(`correct_source_passage_token`)를 쓰고 있어 같은 규칙인지 확인이 필요하다. 첫 PR에서는 구간 자료에서 메뉴를 숨긴다(Q4).

### 4.2 정본 §0.2 보존 — 무엇을 안 쓰나

| 보존 대상 | 지키는 방법 | 계약 |
|---|---|---|
| FSRS 일정·`review_events` | 경계 교정 경로에 `gradeInline`·`addToVocab`·`saveInlineVocabulary`·`recordVocabEncounters` 호출 0 | 소스 계약 + e2e 요청 감시(`/rest/v1/user_vocabulary`·`review_events`·`vocabulary_contexts` 쓰기 0) |
| 개인 뜻·출처 | `promoteCorrection`·`/api/dict-correct` 호출 0 | 같음 |
| 원문·판본 | `p_raw = p_expected_raw` | 단위: 저장 인자의 원문이 그대로 |
| 아는 단어 상태 | 경로에 `knownState` 호출 0 | 소스 계약 |
| `user_verified` 사전 뜻 | 사전 쓰기는 기존 뜻 조회의 미싱 upsert뿐이다(`ignoreDuplicates`, `user_verified` 덮지 않음 — `fetchMeanings.js:274`, `userVerifiedScope.test.js`) | 기존 계약 유지 |
| 이 문장 뜻은 그 토큰 자리에만 | 묶은 토큰 뜻 교정은 `correctTokenMutation` 그대로(토큰 하나) | 기존 |
| `viewerDefaults` | 설정 추가·변경 0 | — |

### 4.3 출처 되돌아가기 — `readingSourceTarget` 보완

지금 규칙(`learningSources.js:109-148`): ① id와 표면이 맞는 토큰 → ② 표면이 토큰 경계에 정확히 맞는 유일 위치 → ③ 기본형 유일 일치. 묶은 뒤 身体의 저장 문맥은 ①②③ 모두 실패한다.

추가 규칙(① 다음): **`locator.tokenId`가 `viewerBoundaries.edits[*].base[*].id`에 있으면, 그 기록 구간을 덮는 현재 토큰이 하나일 때 그 토큰을 돌려준다.** 저장한 인용문(`quote`)이 그 범위를 포함할 때만이다(지금 `inside` 검사와 같다). 되살리면 원래 id가 다시 있으므로 ①로 정확히 맞는다.

계약(`viewerContextReturn.test.js`에 추가): 저장 → 묶기 → 출처 열기 = 묶은 토큰 칠 · 다시 나누기 → 출처 열기 = 원래 토큰 칠.

### 4.4 팀 수업 사본

- 사본 자료(`/api/class/[team]/copy`가 만든 것)에서는 묶기·나누기 메뉴를 숨긴다. 이유는 §0.6이다.
- 교사가 원본에서 묶으면 다음 사본 갱신에서 학생 사본이 「분석 단위가 달라졌어요」로 멈춘다. 이것은 원본 소유자가 일으키는 일이다. 첫 PR에서는 **원본이 팀 수업에 연결돼 있으면 묶기 확인 줄에 「수업 사본 갱신이 멈출 수 있어요」를 덧붙인다**. 경계 기록을 사본 갱신에 옮기는 일은 다음 라운드다(Q3).

---

## 5. 적용 범위 3단

| 범위 | 기본 | 누가 | 저장 | 적용 시점 | DB |
|---|---|---|---|---|---|
| ① 이 자료 | ✔ | 자료 소유자(`canEditToken`, `ViewerPage.jsx:1728`) · 한국어 제외 | `metadata.viewerBoundaries` + `token_corrections` 이력 | 즉시 | 없음 |
| ② 내 다른 자료에도 | 선택 | 로그인 사용자 | `user_segment_rules`(신규) | **다음 분석부터**(새 자료 분석·재분석). 기존 자료는 바꾸지 않는다 | 신규 표 1 |
| ③ 공유 사전 | 선택(관리자에게만 보임) | `profiles.role='admin'` | `shared_segment_rules`(신규) | 모든 사용자의 다음 분석부터 | 신규 표 1 |

### 5.1 ② 사용자 규칙의 적용 규칙

- 규칙 = `{language, surface, cuts}`. `cuts`는 surface 안의 상대 위치이고, `[]`이면 한 단어다.
- 묶기 규칙: 줄의 공백 뺀 글자에서 `surface`가 나오고, **그 양 끝이 기본 토큰 경계와 맞을 때만** 묶는다. 경계 안쪽을 가로지르면 하지 않는다.
- 나누기 규칙: 토큰 표면이 `surface`와 정확히 같을 때만 나눈다.
- 순서는 긴 surface부터, 겹치면 먼저 맞은 것이 이긴다. 결정적이다.
- 위험: 사용자가 「个人」을 묶기 규칙으로 두면 一个人의 个+人(경계 일치)에도 걸린다. §2 실측에서 个+人 쌍은 예문에 23번 나왔다. 그래서 ② 확인 줄에 「다른 자료에서도 이 글자가 나오면 묶어요」를 적고, 규칙으로 묶인 토큰 카드에 「내 규칙으로 묶음 · [규칙 지우기]」를 둔다. 자동 적용 범위를 줄이려면 「같은 이웃 글자일 때만」 같은 문맥 조건을 붙일 수 있지만, 첫 판은 단순 규칙으로 한다(Q5).
- 읽기: `/api/analyze`가 사용자 JWT로 RLS 클라이언트를 만들어 읽는다(`api/explain/route.js:110-114` 선례). service_role로 `user_id`를 직접 거르지 않는다. 요청당 1회, `(user_id, language)` 색인.

### 5.2 ③ 공유 규칙

- 관리자 라우트 `/api/admin/segment-rules`(POST/DELETE, `requireAdmin`)만 쓴다. 읽기는 인증 사용자 전체.
- 지금 분할 화이트리스트(`ZH_WORD_SPLIT`·`ZH_KEEP_MERGED`·`ZH_SUPPRESS`)는 코드 + 계약 테스트로 관리된다. ③은 그것을 대신하지 않는다. 운영 중 빠른 교정 경로이고, 쌓인 규칙은 주기적으로 코드 화이트리스트로 옮긴다(PR로 계약 테스트와 함께). 이 순환은 개발 세션 제안값이다(§11.2).

### 5.3 SQL 초안 (PR④, `docs/sql/segment-rules.sql`)

```sql
-- 검수 후보. 운영 적용은 지속 실행 승인(2026-10-02)의 비파괴 DB 보완 조건(검수 SQL·보존 증거·복원 경로)을 따른다.
-- 새 표 2개와 정책만 추가한다. 기존 표·행·함수는 바꾸지 않는다.
BEGIN;
CREATE TABLE public.user_segment_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 language text NOT NULL CHECK (language IN ('Japanese','Chinese','English')),
 surface text NOT NULL CHECK (length(surface) BETWEEN 2 AND 40 AND surface = btrim(surface)),
 cuts int[] NOT NULL DEFAULT '{}' CHECK (cardinality(cuts) <= 39),
 source_material_id uuid REFERENCES public.reading_materials(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, language, surface)
);
CREATE INDEX user_segment_rules_lookup ON public.user_segment_rules (user_id, language);
ALTER TABLE public.user_segment_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_segment_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_segment_rules TO authenticated;
CREATE POLICY user_segment_rules_owner ON public.user_segment_rules FOR ALL TO authenticated
 USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE TABLE public.shared_segment_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 language text NOT NULL CHECK (language IN ('Japanese','Chinese','English')),
 surface text NOT NULL CHECK (length(surface) BETWEEN 2 AND 40 AND surface = btrim(surface)),
 cuts int[] NOT NULL DEFAULT '{}' CHECK (cardinality(cuts) <= 39),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 note text CHECK (note IS NULL OR length(note) <= 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (language, surface)
);
ALTER TABLE public.shared_segment_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_segment_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shared_segment_rules TO authenticated;
CREATE POLICY shared_segment_rules_read ON public.shared_segment_rules FOR SELECT TO authenticated USING (true);
-- 쓰기 정책 없음: 관리자 라우트(requireAdmin)가 서버에서 service_role로 쓴다.
NOTIFY pgrst, 'reload schema';
COMMIT;
```

- `cuts` 값 검사(0 < c < length, 오름차순)는 CHECK로 쓰기 번거로우므로 서버·클라이언트 공용 검증 함수에서 하고, 단위 계약으로 고정한다. 필요하면 PR④ 검수 때 트리거로 올린다.
- `reading_materials.id`의 타입: `viewer_replace_analysis`는 `bigint`를 받는데(`20260908234552…sql:3`) `token_corrections.material_id`는 `uuid`다(`20260414000300…sql:4`). **적용 전에 운영 스키마로 실제 타입을 확인한다**(읽기 전용, `docs/sql/prod-readonly-checks-20261007.sql` 방식). 맞지 않으면 `source_material_id`를 빼거나 타입을 맞춘다.

**보존 검사(적용 전후 같은 값이어야 한다, 읽기 전용)**

```sql
SELECT 'user_vocabulary' t, count(*), max(updated_at) FROM public.user_vocabulary
UNION ALL SELECT 'vocabulary_contexts', count(*), max(created_at) FROM public.vocabulary_contexts
UNION ALL SELECT 'review_events', count(*), max(created_at) FROM public.review_events
UNION ALL SELECT 'morpheme_dictionary', count(*), max(last_used_at) FROM public.morpheme_dictionary
UNION ALL SELECT 'token_corrections', count(*), max(created_at) FROM public.token_corrections;
-- (실제 열 이름은 적용 전 스키마로 확인)
```

**롤백(`docs/sql/segment-rules-rollback.sql`)**

```sql
-- 규칙 데이터만 사라진다. 자료의 이 자료 경계(processed_json)는 그대로다.
-- 실행 전에 두 표를 CSV로 내보내 보관한다(복원 = 위 SQL 재적용 + CSV 재삽입).
BEGIN;
DROP TABLE IF EXISTS public.shared_segment_rules;
DROP TABLE IF EXISTS public.user_segment_rules;
NOTIFY pgrst, 'reload schema';
COMMIT;
```

- 코드 쪽 안전장치: 표가 없으면(`PGRST205`/`42P01`) 분석은 규칙 없이 그대로 진행하고, ②③ 선택지는 숨긴다. 롤백해도 분석이 깨지지 않는다.

---

## 6. 화면

### 6.1 들어가는 곳과 조건

| 동작 | 들어가는 곳 | 조건 |
|---|---|---|
| 묶기 | ⓐ 본문 드래그(`useTokenRangeSelect`, `range = {start,end}` 시퀀스 인덱스 `useTokenRangeSelect.js:106-268`) → [문장] 탭 맨 위 「한 단어로 묶기」 · ⓑ 카드 ⋯ → 「옆 단어와 묶기」 | 같은 줄(사이에 `개행` 없음), 토큰 2~8개, 문장부호·공백 토큰 없음(`pos:'기호'` 또는 PUNCT), `failed` 없음, `sep_link` 조각이나 이합사 통짜(`base_form ≠ text`) 없음, 합친 글자 ≤ 12(중·일)·≤ 40(영), 자료 소유자, 비한국어, 팀 사본·구간 자료 아님 |
| 나누기 | 카드 ⋯ → 「나누기」 | 2글자 이상(영어는 공백 포함 묶은 토큰만), 위와 같은 소유·언어 조건 |
| 되돌리기 | 묶기·나누기 직후 뜻 줄 아래 한 줄 「묶었어요 · [되돌리기]」 | 그 토큰을 다시 열 때까지 |

- 드래그 경로는 지금 번역·단어 목록 분석을 시작한다(`ViewerPage.jsx:1053-1066`). 「한 단어로 묶기」는 그 결과 위에 버튼 하나를 더할 뿐이고, 드래그 동작은 바꾸지 않는다.
- 조건에 안 맞으면 버튼을 숨기지 않고 꺼진 채 이유를 쓴다(「문장부호를 넘어서는 묶을 수 없어요」). AD-R2의 「쓸 수 없는 옵션은 흐리게 + 이유」와 같은 규칙이다.

### 6.2 자리 구분 — 「글자 뜻만 보기」와 「나누기」

| | 글자 뜻만 보기(AE-R4 한자 창) | 나누기(AD-R3) |
|---|---|---|
| 여는 법 | 표제어 한자를 누름 | ⋯ 메뉴 → 나누기 |
| 본문 | 그대로 | 경계가 바뀐다 |
| 확인 | 없음(보기 전용) | 칼선을 고르고 [나누기]를 눌러야 저장 |

계약: 표제어 글자 누름 처리기(`toggleInspectChar`)에서 경계 편집 함수를 부르지 않는다(소스 계약). 나누기 패널은 ⋯ 메뉴 항목에서만 열린다.

### 6.3 텍스트 목업

**390px · 드래그 후 [문장] 탭 · 묶기**

```
┌ 시트 min(55dvh,440px) ─────────────────────────┐
│ [단어│문장]           [^][v]  [⋯] [⤢] [✕]     │
├────────────────────────────────────────────────┤
│ 运动员的【身体素质】非常好。                     │ 드래그 범위 칠(현행)
│ [⊕ 한 단어로 묶기]                              │ 44px, 조건을 만족할 때만 켜짐
│ 운동선수의 신체 조건이 아주 좋다.               │ 번역(현행 경로)
│ ─ 단어별 뜻                                     │
│  身体 신체 · 素质 자질                           │
└────────────────────────────────────────────────┘
```

**390px · [한 단어로 묶기]를 누른 뒤(같은 자리 확인 줄)**

```
│ 身体 + 素质 → 身体素质                          │
│ ◉ 이 자료만                                     │
│ ○ 내 다른 자료에도 (다음 분석부터)              │
│ ○ 모든 사용자 (관리자)                          │ 관리자에게만 보임
│ 단어장의 身体는 그대로 있어요.                  │ 구성 단어가 저장돼 있을 때만
│ [묶기]  [취소]                                   │
```

**390px · 묶은 뒤 카드**

```
┌────────────────────────────────────────────────┐
│ [단어│문장]           [^][v]  [⋯] [⤢] [✕]     │
├────────────────────────────────────────────────┤
│ 运动员的【身体素质】非常好。                     │
│ [명사]                                     🔊   │
│  shēn tǐ sù zhì                                 │
│  身   体   素   质                              │
│ 신체 조건                                   ✎   │ 사전에 없으면 분석 경로 뜻. 「AI」 표 없음(오너 결정)
│ 직접 묶은 단어 · [나누기]                        │ 정본 §7 목업 줄(Q1)
│ 묶었어요 · [되돌리기]                           │ 이번 열림 동안만
├══ 하단 고정 ════════════════════════════════════┤
│ 얼마나 알겠어요?                    ☐ 아는 단어 │
│ [1 다시][2 어려움][3 알맞음][4 쉬움]            │
└────────────────────────────────────────────────┘
```

**390px · ⋯ → 나누기**

```
│ 어디서 나눌까요?                                 │
│   身 ┊ 体 ┊ 素 ┊ 质                              │ 글자 사이마다 44px 누름 칸
│        ▲ 칼선(누르면 진하게, 여러 개 가능)        │
│ 身体 │ 素质                                      │ 미리 보기(칼선 반영)
│ [나누기]  [취소]                                 │ 칼선 0개면 [나누기] 꺼짐
```

**1280px · 옆 패널 336px · 나누기**

```
 본문 열                                         ┌ 옆 패널 336px ───────────────┐
 运动员的身体素质非常好。                         │ [단어│문장]  [^][v][⋯][✕]   │
                                                  ├───────────────────────────────┤
                                                  │ 运动员的【身体素质】非常好。   │
                                                  │ [명사]                    🔊  │
                                                  │  身   体   素   质             │
                                                  │ 신체 조건                 ✎  │
                                                  │ 어디서 나눌까요?              │
                                                  │   身 ┊ 体 ┃ 素 ┊ 质           │ ┃ = 고른 칼선
                                                  │ 身体 │ 素质                    │
                                                  │ [나누기] [취소]               │
                                                  ├═══════════════════════════════┤
                                                  │ 얼마나 알겠어요?  ☐ 아는 단어 │
                                                  └───────────────────────────────┘
```

**재분석 결과 알림(적용 못 한 기록이 있을 때)**

```
분석을 다시 했어요. 직접 고친 단어 경계 2개는 원문이 바뀌어 적용하지 못했어요. [보기]
```

---

## 7. 언어별 적용

### 7.1 중국어(1차)

- §3.4 표대로다. 이합사(`sep_link`)가 들어간 범위는 묶지 않는다. 道了歉처럼 떨어진 VO는 이미 `sep_link`로 이어져 있다.
- 숫자+양사(三个)·성씨+호칭(王先生)은 나누기로 해결한다. §2.1 실측에서 나누기 필요 251건 중 다수가 이 부류다.

### 7.2 일본어 — 복합어 · 送り仮名

| 경우 | 예 | 처리 |
|---|---|---|
| 복합명사가 갈림 | 天気\|予報 → 天気予報(복합명사 재병합이 못 한 표제어 밖 조합) | 묶기. 읽기 = 사전 → 구성 읽기 연결(てんき＋よほう) |
| 복합동사 · 送り仮名 | 申し\|込み → 申し込み · 取り\|扱い → 取り扱い | 묶기. `base_form` = 앞 표면 + 마지막 `base_form`(申し\|込ん\|だ에서 申し\|込ん을 묶으면 申し込む) |
| 과병합 | 映画館 → 映画\|館을 원할 때 | 나누기. 조각 읽기는 사전 → 없으면 뜻 조회 결과 |
| 활용 어미 | 食べ\|させ\|られ\|た | 묶기는 되지만 기본형이 食べさせられる가 되어 사전에 없을 수 있다. 막지 않고 뜻 조회에 맡긴다 |

일본어 글자 카드는 현행 유지다(정본 §0.2). 나누기 칼선은 가나 경계에도 둘 수 있다.

### 7.3 영어 — 구동사

- 붙어 있는 구동사(pick up, look after)만 묶는다. 묶은 토큰의 `text`는 원문 그대로 `pick up`(공백 포함)이다.
- 떨어진 구동사(pick it up)는 이웃이 아니라 묶지 않는다. 중국어 이합사처럼 `sep_link`로 잇는 방식은 다음 라운드다.
- 위험: 공백이 든 토큰이 처음 생긴다. 확인할 곳은 넷이다. (a) 본문 렌더의 단어 사이 간격, (b) `preserveReanalysisTokens`의 위치 계산(`token.text.length` 누적, `:35-36,47-48`) — 옛·새 분석에 같은 묶음이 있으면 서로 맞지만, PR②에서 공백 뺀 길이로 바꾸면 더 안전하다(Q6), (c) 커버리지 대조(공백 제거, 문제없음), (d) 저장 단어 표면 `pick up`. 영어 e2e 1건을 PR③에 둔다.

### 7.4 한국어 어절 칼선 — 오너 확인용 목업 2안(구현 범위 밖)

현행 사실:
- 한국어 토큰은 **어절**(공백 단위)이다. 서버가 어절 틀과 다른 토큰을 거부한다(`koreanAnalysis.js:136-141`). 그래서 나누기는 서버 분석이 아니라 뷰어 쪽 덮어씌우기가 된다.
- 어절 안 형태소는 `morphology[{form, function}]`에만 있다. `form`은 표면 글자가 아닐 수 있다. 축약·불규칙(했어요 = 하+였+어요, 도와요 = 돕+아요)이 그렇다.
- 한국어는 지금 토큰 편집 자체가 꺼져 있다(`legacyTokenEditingAllowed = materialLang !== 'Korean'`, `ViewerPage.jsx:276`).

**안 A — 음절마다 칼선**

```
│ 어디서 나눌까요?                                 │
│   도 ┊ 서 ┊ 관 ┊ 에 ┊ 서                          │ 모든 음절 사이에 칼선 칸
│ 도서관 │ 에서                                    │ 미리 보기
│ [나누기] [취소]                                  │
```
```
│ 어디서 나눌까요?                                 │
│   했 ┊ 어 ┊ 요                                    │
│ 했 │ 어요                                         │ 「하+였」은 음절 안이라 못 가른다
```
- 장점: 어떤 어절이든 같은 방식이다. 형태소 자료가 틀려도 쓸 수 있다.
- 단점: 학습자가 문법적으로 틀린 자리(도서|관에서)를 고를 수 있다. 그렇게 나눈 조각의 뜻은 AI가 새로 만들어야 한다.

**안 B — 형태소 경계 후보만**

```
│ 어디서 나눌까요?                                 │
│   도서관 ┊ 에서                                   │ morphology form이 표면에 그대로 있는 경계만
│ 도서관(명사) │ 에서(조사 · 장소)                  │ 조각마다 기존 morphology 설명을 붙인다
│ [나누기] [취소]                                  │
```
```
│ 어디서 나눌까요?                                 │
│   먹 ┊ 었 ┊ 어요                                  │ 먹었어요 = 먹+었+어요(표면과 일치)
```
```
│ 이 단어는 나눌 자리가 없어요.                     │
│ 했어요 = 하다 + -였- + -어요 (줄어든 꼴)           │ 축약이면 칼선 대신 분석 설명만
```
- 장점: 잘못된 칼선을 원천적으로 막는다. 조각 뜻은 이미 있는 `morphology` 설명을 쓴다. AI 호출이 늘지 않는다.
- 단점: 축약·불규칙(#1346 표본의 C 범주: 도와요·지으셨어요·하얘요·불렀어요·더워서)에서는 칼선이 없거나 일부만 있다. 형태소 자료가 틀리면 고칠 길이 없다.

설계 쪽 권고: **안 B**다. 한국어 학습자에게 「어절 = 어간 + 어미/조사」 구분이 학습 내용 자체이고, 기존 `morphology`를 재사용하므로 새 AI 경로가 없다. 축약 어절은 칼선 대신 설명을 보인다. 어절을 넘는 묶기(할 수 있다)는 이 결정과 별개로 한국어 승인 때 함께 정한다.

### 7.5 한국어 나누기 — B안 구현 (오너 결정 2026-10-09 「B안」)

- 작성: 2026-10-09 KST · 구현 세션. 기준 main `5975cd73`(PR①②③ #1373·#1377·#1383 병합 뒤). §7.4 안 B를 그대로 만든다.
- 범위: **한 어절 안 나누기만.** 어절을 넘는 묶기(할 수 있다)는 따로 남은 오너 질문이라 열지 않는다 — 한국어 자료에는 드래그 「한 단어로 묶기」와 ⋯ 「옆 단어와 묶기」가 지금처럼 없다.
- 새 AI 호출 0, DB 변경 0, 새 서버 경로 0. 칼선 후보와 조각 뜻은 이미 저장된 `morphology[{form, function}]`만 쓴다.

**① 칼선 후보 — 순수 함수 `koreanSplitUnits(token)`(`src/lib/koreanBoundarySplit.js`)**

1. form의 앞뒤 하이픈을 뗀다(`먹-` → 먹, `-었-` → 었).
2. **왼쪽부터** form이 표면에 글자 그대로 이어지는 동안만 칼선을 둔다. 처음 어긋나는 형태소(축약·불규칙)부터 끝까지는 한 조각(합친 꼴)이다. 칼선 뒤에 형태소가 남아 있을 때만 칼선이다(form이 먼저 끝나면 그 칼선도 두지 않는다).
3. 결과는 조각 단위 `units[{text, start, end, morphemes}]`와 칼선 `cuts`다. 합친 꼴 조각에는 공식 「했어요 = 하다 + -였- + -어요 (줄어든 꼴)」을 보인다. 어간 form(`하-`)은 공식에서 「하다」로 쓴다. 형태소 글자 수 합이 표면보다 길면 「줄어든 꼴」, 아니면 「모양이 바뀐 꼴」이다(목업의 「줄어든 꼴」은 했어요에는 맞지만 도와요 같은 ㅂ 불규칙에는 틀려서 둘로 나눴다).
4. 왜 왼쪽부터만인가: 오른쪽 어미까지 떼면(했│어요 · 불렀│어요) 앞에 「했」「불렀」처럼 단어가 아닌 조각이 남는다. 오너가 고른 목업 B도 했어요를 칼선 없이 설명만 보였다. 왼쪽부터만 자르면 앞 조각은 언제나 표면 그대로의 형태소이고, 합친 꼴은 마지막 조각(활용형 전체) 하나뿐이다.

| 어절 | morphology(예) | 결과 |
|---|---|---|
| 도서관에서 | 도서관 + 에서 | 도서관 │ 에서 |
| 먹었어요 | 먹- + -었- + -어요 | 먹 │ 었 │ 어요 |
| 공부했어요 | 공부 + 하- + -였- + -어요 | 공부 │ 했어요(= 하다 + -였- + -어요, 줄어든 꼴) — 일부만 |
| 했어요 | 하- + -였- + -어요 | 칼선 없음 · 「했어요 = 하다 + -였- + -어요 (줄어든 꼴)」 |
| #1346 C 범주 도와요 · 지으셨어요 · 하얘요 · 불렀어요 · 더워서 | 돕-+-아요 · 짓-+-으시-+-었-+-어요 · 하얗-+-아요 · 부르-+-었-+-어요 · 덥-+-어서 | 모두 칼선 없음 · 공식(도와요·더워서 = 모양이 바뀐 꼴, 나머지 = 줄어든 꼴) |
| morphology 없음 · 형태소 1개 · form이 표면을 다 덮지 못함 | — | 칼선 없음(형태소가 없으면 ⋯ 「나누기」 자체를 보이지 않는다) |

**② 조각 뜻** — 형태소 하나인 조각은 그 `function`이 뜻 줄이다. 여러 형태소인 조각(합친 꼴)은 뜻 줄에 공식을, 「문법 해설」에 형태소 목록을 보인다. 표제어는 어간이면 「X다」, 아니면 form이다. 품사는 조각 표제어가 어절 표제어와 같을 때만 어절 품사를 쓰고, 그 밖은 비운다(추측하지 않는다). 설명 언어 표식(`explanationLocale`·`meaningLocale`)은 어절 것을 그대로 쓴다.
- 지금 설명 언어가 어절 형태 분석의 언어와 다르면 ⋯ 「나누기」를 보이지 않는다. 이미 나눈 조각을 다른 설명 언어로 열면 문맥 설명(AI) 오버레이를 부르지 않고 「이 조각 설명은 분석한 설명 언어로만 있어요.」를 보인다. 조각 때문에 AI 호출이 늘지 않게 하려는 것이다.

**③ 저장 형식 — 중·일·영과 같은 기록, 조각은 뷰어가 만든다**
- 한국어 분석기(`/api/analyze/korean`)는 어절이 아닌 토큰을 거부한다(`koreanAnalysis.js` `renderTokens`). 그래서 서버 분석을 부르지 않는다. 기록은 §3.1 형식 그대로 `processed_json.metadata.viewerBoundaries.edits[{id, line, start, end, text, cuts, base:[원래 어절 토큰 1개], status}]`이다. `sequence`에서는 어절 자리를 조각 토큰(`id_<줄>_e<k>_<리비전>`, `boundary:'user'`)으로 바꾼다. 조각의 `sourceSpan`·`selectionGroup`은 어절 범위를 같은 만큼 옮겨 만든다(어절 안에는 공백이 없어 공백 뺀 좌표와 원문 좌표의 차이가 같다).
- 서버의 어절 검증은 분석 응답에만 걸린다. 저장 RPC `viewer_replace_analysis`는 `sequence`·`dictionary`의 모양과 기대값만 검사하고 토큰 단위는 보지 않는다(`20260908234552…sql:21-27`). DB 트리거·서버 저장 경로 중 한국어 토큰 단위를 검사하는 곳은 없다(`selectionGroup`·`sourceSpan` 검색 결과 분석기 두 곳뿐).
- 쓰기는 §4.1과 같다: 원자 교체 RPC 1회(원문 그대로) + `token_corrections` 1행(`after_value.source:'boundary_edit'`, `scope:'material'`). 같은 `commitBoundaryEdit`이 언어로 갈라, 한국어면 서버 대신 `morphology`로 조각을 만든다. 요청 칼선은 그 어절의 후보 칼선 안에 있어야 한다(아니면 거절, 쓰기 0).

**④ 새로고침 · 재분석 뒤 유지**
- 새로고침: `processed_json`에 저장되므로 그대로다.
- 재분석: 한국어 분석기는 어절만 돌려주므로 서버가 기록을 적용할 수 없다. 그래서 `runPreservedReanalysis`가 분석 결과 위에 **뷰어 쪽에서 다시 적용**한다(`reapplyKoreanBoundaries`). 순서는 다음과 같다. 줄 이동은 `mapBoundaryEdits`로 옮긴다. 다시 분석한 줄에서 그 자리(없으면 같은 줄에서 한 번만 나오는 같은 글자)의 새 어절 `morphology`로 후보를 다시 계산한다. 기록 칼선이 모두 후보 안에 있으면 다시 나누고, 조각 뜻은 새 `morphology`에서 가져온다. 아니면 `pending`이다. 알림과 [보기] 목록은 중·일·영과 같은 자리를 쓴다. 다시 분석하지 않은 줄(선택 재분석 밖, 재시도의 재사용 줄)은 그대로 둔다. 조각 id는 재분석 보존(`preserveReanalysisTokens`)의 같은 위치·같은 표면 규칙으로 이어진다.

**⑤ 되돌리기**
- 직후: 「나눴어요 · [되돌리기]」(§6.3과 같은 `undoBoundaryEdit`, 서버 호출 0).
- 나중: 조각 카드의 「나눈 조각 · [원래대로]」 = 칼선 0으로 편집 = `base`(원래 어절 토큰)를 id째 되살린다(§3.2 4단계). 조각에서 ⋯ 「나누기」를 열면 어절 전체 패널이 지금 칼선을 고른 채 열린다. 칼선을 바꾸면 다시 나누고, 모두 끄면 [원래대로]가 된다.

**⑥ 권한** — 중·일·영과 같다: 자료 소유자 · 분석 완료 · 재분석 중 아님 · 오프라인 사본 아님 · 수업 사본(`source_ref`·기기 사본)·구간 자료(passage)·수업 모드 제외. 비소유자에게는 ⋯·카드 줄이 없다.

**⑦ 보존 — 저장 단어 · FSRS · 출처 · 사전**
- 나누기·되돌리기 경로는 단어장·문맥·평가 이력·FSRS·아는 단어·제외·사전·전역 승격에 쓰지 않는다(§4.2 계약과 같은 요청 감시 e2e).
- **조각은 단어장 저장·등급 대상이 아니다.** 조각 카드 하단은 등급 대신 「나눈 조각은 단어장에 담지 않아요.」와 [원래대로]를 보인다. 한국어 저장은 이미 어절의 기본형(도서관에서 → 도서관)으로 담는다. 조각 저장은 어휘 뜻 생성(AI)을 부르므로 이번 범위 밖이다.
- 출처 돌아가기: 한국어 저장 문맥은 원문 글자 범위(`sourceSpan`)로 찾는다(`koreanSourceTarget`). 어절을 저장한 뒤 나누면 같은 범위 토큰이 없어진다. 그래서 **그 범위 시작에서 시작하는 나눈 조각들이 범위를 정확히 덮으면 첫 조각**으로 돌아가는 규칙을 하나 더한다(§4.3의 「묶은 자리 덮는 토큰」과 같은 생각). 원래대로 하면 정확 일치로 돌아간다.

**⑧ 화면 목업(390px)**

```
│ 저는 【도서관에서】 공부했어요.                   │ ⋯ → 나누기
│ 어디서 나눌까요?                                 │
│   도서관 ┊ 에서                                   │ 후보 칼선만(44px 칸)
│ 도서관 │ 에서                                     │ 미리 보기
│ · 도서관 — 명사. 책을 모아 둔 곳                   │ 조각마다 기존 morphology 설명
│ · 에서 — 장소를 나타내는 조사                      │
│ [나누기]  [취소]                                  │
```
```
│ 어디서 나눌까요?                                 │ 했어요에서 ⋯ → 나누기
│ 이 단어는 나눌 자리가 없어요.                     │
│ 했어요 = 하다 + -였- + -어요 (줄어든 꼴)            │
│ [나누기(꺼짐)]  [취소]                            │
```
```
│ [명사]  도서관                              🔊   │ 나눈 뒤 조각 카드
│ 명사. 책을 모아 둔 곳                             │ 뜻 줄 = morphology 설명
│ 나눈 조각 · [원래대로]                            │
│ 나눴어요 · [되돌리기]                             │ 이번 열림 동안만
├══ 하단 ═════════════════════════════════════════┤
│ 나눈 조각은 단어장에 담지 않아요.                 │ 등급 줄 대신
```

---

## 8. 계약

### 8.1 새로 심을 것

| 계약 | 파일(제안) | 방법 |
|---|---|---|
| 왕복 동일(정본 §10) | `src/lib/__tests__/boundaryEdits.test.js` | §2.2와 같은 성질: 묶기→나누기·나누기→묶기·재절단→복원 후 토큰 배열이 원래 객체와 같고(`toBe`), 기록이 0. 실제 `tokenizeZhLine` 결과 표본 고정 문장 20개 + 합성 영어·일본어 |
| 불변식 | 같은 파일 | 기록끼리 안 겹침, `base`는 분석기 토큰만, 구간 끝은 토큰 경계, 공백 뺀 좌표(영어 `pick up`) |
| 서버 적용 | `src/lib/server/__tests__/analyzeBoundaries.test.js` | `boundaries`를 주면 새 조각이 기본형 수집·사전 조회에 들어간다. 묶은 토큰에 `boundary:'user'`, `collectZhPosMarks`가 `oov`를 달지 않음, `splitZhToken` 미적용. 구간 글자가 다르면 `pending` + `base` 반환 |
| 재분석 뒤 유지 | `reanalysisPreservation.test.js`에 추가 | 묶은 토큰의 뜻 교정 → 재분석(서버 적용 목) → 같은 id·같은 뜻·`viewerBoundaries` 유지. 원문 줄 이동 뒤에도 유지. 기존 「changed segmentation은 잇지 않는다」 유지 |
| 출처 되돌아가기 | `viewerContextReturn.test.js`에 추가 | §4.3 |
| 저장·일정 불변 | `src/views/__tests__/boundaryEditWiring.test.js` + e2e | 경계 경로에 `addToVocab`·`saveInlineVocabulary`·`gradeInline`·`promoteCorrection`·`knownState` 호출 0(소스). e2e에서 `user_vocabulary`·`vocabulary_contexts`·`review_events` 쓰기 요청 0 |
| 원자 저장 | 같은 파일 | 경계 저장이 `viewer_replace_analysis`를 쓰고 `reading_materials` 직접 `update`를 쓰지 않음 |
| 자리 구분 | 같은 파일 | 글자 누름 처리기 안에 경계 편집 호출 0 |
| 조건 | `src/lib/__tests__/boundaryEligibility.test.js` | 줄바꿈·문장부호·이합사·실패·한국어·사본·구간·비소유자에서 묶기 불가 + 이유 문구 |
| 사용자 규칙 | `src/lib/__tests__/segmentRules.test.js`(PR④) | 경계 일치 때만 묶음, 정확 일치 때만 나눔, 긴 것 우선, 표가 없으면 무시 |
| 화면 문구 3개 언어 | `viewerMessages.test.js`(기존, 무수정) | 새 `vt()` 문구(「한 단어로 묶기」 「나누기」 「어디서 나눌까요?」 「묶었어요」 「되돌리기」 「이 자료만」 「내 다른 자료에도 (다음 분석부터)」 「모든 사용자 (관리자)」 「직접 묶은 단어」 등)는 ko·zh-CN·zh-TW 세 벌을 같이 넣는다 |
| e2e | `e2e/viewer-boundary-edit.e2e.mjs`(신규, CI 목록 추가) | 390px: 드래그 → 묶기 → 카드 표제어가 묶은 꼴 → 나누기(원래 칼선) → 본문·카드가 원래와 같음 → 새로고침 뒤 유지. 1280px 1건. 영어 `pick up` 1건 |

### 8.2 개정할 기존 계약

| 파일 | 걸리는 단언 | 개정 |
|---|---|---|
| 정본 §10 목록 | AD-R3는 「왕복 동일」 신설만 적혀 있다 | 아래가 빠져 있다 |
| `src/lib/server/__tests__/disambiguateZhPos.test.js` 「품사 단서 없는 다자 토큰만 단어성 판정(oov) 대상이다」(`:49`) | 표식 없는 토큰 기준 | 단언은 유지하고 「`boundary` 표식이 있으면 oov가 아니다」 케이스를 더한다(기존 단언 무수정) |
| `src/lib/__tests__/reanalysisPreservation.test.js` | 무수정 | 위 「재분석 뒤 유지」를 추가만 한다 |
| `src/lib/__tests__/analyzeTextRouting.test.js` | 요청 본문 형태를 고정한다면 `boundaries` 키 추가로 깨질 수 있다 | PR② 착수 때 확인. 키 추가는 정본 §7 「재분석해도 유지」를 근거로 적는다 |
| `src/lib/__tests__/viewerContextReturn.test.js` | 무수정 | 추가만 |
| `src/lib/__tests__/tokenRangeSelect.test.js` | 드래그 확정 콜백 | 무수정(버튼은 결과 화면에 더한다) |
| `src/lib/classCopyModel` 관련 테스트 | 무수정 | 사본에서 메뉴를 숨기므로 경로가 안 바뀐다 |

---

## 9. PR 분할

| PR | 내용 | 쓰기 경로 | 위험 | 합격 |
|---|---|---|---|---|
| ① 순수 함수 | `src/lib/boundaryEdits.js`(`editBoundaries`·`applyBoundaryEdits`·좌표 변환·조건 판정), `readingSourceTarget` 보완 | 없음 | 낮음(화면 변화 0) | §8.1 단위 계약 green, 왕복 표본 실패 0, `npm test` 전체 green |
| ② 서버·재분석 연결 | `/api/analyze` `boundaries`·`boundary` 표식·OOV 제외, `analyzeHybrid` 전달, 재분석 때 `base`·`status` 갱신, `pending` 알림 | 분석 결과(기존 경로) | 중간. UI 진입점이 없어 사용자 데이터에 기록이 생기지 않는다(기록 0이면 동작 동일) | 서버·재분석 계약 green. 기록이 없는 자료의 분석 결과가 바이트 단위로 같음(회귀 계약). 중·일·영 기존 e2e 무수정 통과 |
| ③ 이 자료 UI | 드래그 「한 단어로 묶기」, ⋯ 「옆 단어와 묶기」·「나누기」, 확인 줄(① 범위만), 되돌리기, 카드 「직접 묶은 단어」, `viewer_replace_analysis` 저장, `token_corrections` 이력 | `processed_json`(원자 RPC), `token_corrections` insert | 중간 | e2e 신규 green, 저장 단어·일정·출처 불변(요청 감시), 390·1280 스크린샷, Preview + 정상 실계정으로 묶기 → 새로고침 → 재분석 → 유지 확인 |
| ④ 규칙(②③ 범위) | `docs/sql/segment-rules.sql`·롤백, 분석 때 규칙 적용, 확인 줄 ②③, 규칙 지우기, 관리자 라우트 | 새 표 2(비파괴) | 중간(DDL) | SQL 검수·보존 검사 전후 동일·롤백 리허설(Preview DB), 표 없음 폴백 계약, 비관리자 403 |

- ③은 AE-R1 PR③(⋯ 메뉴)이 병합된 뒤 한다. ①②는 AE-R1과 독립이라 먼저 할 수 있다.
- ④는 ③과 따로 낸다. DDL 검수와 화면 검수를 섞지 않기 위해서다. ④가 늦어도 ③만으로 정본 §7 합격(왕복·재분석 유지·저장 불변)이 성립한다.

---

## 10. 선례 조사

| 사례 | 무엇 | 오픈소스·라이선스 | 우리 적용 | 판정 |
|---|---|---|---|---|
| jieba 사용자 사전(`load_userdict`·`add_word`·`suggest_freq`·`del_word`) | 단어를 넣거나 빈도를 조정해 분할을 바꾼다. `suggest_freq(('今天','天气'))`로 가르기도 한다 | MIT(fxsjy/jieba). 우리는 jieba-wasm(jieba-rs, MIT) | 개념(사용자 사전 = 범위 ②)은 채택. 구현은 배제: wasm 사전이 프로세스 전역이라 사용자별로 바꾸면 다른 사용자 분석에 샌다. 우리는 이미 전역 정적 목록에만 `add_word`를 쓴다(`zhSuppress.js`). 사용자별은 토큰화 뒤 후처리로 한다 | 부분 채택 |
| Hanbaobao(Du Chinese 계열 크롬 확장) | 커서 자리에서 나누기(Z), 고른 단어 묶기(X), 「모든 글에 적용」(N/M, 확인 팝업) | MIT(hkproj/hanbaobao) | 상호작용 모델(칼선 = 커서 나누기, 범위 묶기, 전역 적용은 확인 후)을 채택. 저장 방식은 문서에 없고 스택이 달라 코드 이식은 하지 않는다 | 부분 채택(UX) |
| LingQ 구(phrase) LingQ | 드래그해 구를 하나의 항목으로 저장. 구 안의 개별 단어도 따로 저장 가능 | 비공개 | 「구를 덮어씌우는 항목」 방식(토큰은 그대로)은 배제했다. 정본 §7은 경계를 실제로 바꾸고, 카드·저장·복습이 토큰 단위로 돈다. 「구성 단어 저장은 그대로」라는 점은 같다 | 배제(방식) · 원칙 일치 |
| Readlang 구 번역 | 드래그로 6~12단어 구 번역, 플래시카드로 남김 | 비공개 | 구 번역은 우리 [문장] 탭·AE-R2 몫이다. 경계 변경과 무관 | 배제 |
| Migaku 분석기 오류 | 사용자 교정 대신 분석기 피드백 채널로 받아 중앙에서 고친다 | 비공개 | 범위 ③(공유·관리자)과 같은 자리. 우리는 ①②로 사용자가 바로 고칠 수 있게 한다 | 부분(③만) |
| MeCab 경계 제약 해석(partial parsing) | 경계를 미리 박고 나머지를 해석한다 | BSD/LGPL/GPL 삼중 | 「칼선을 먼저 고정하고 사전·품사 단계는 그대로 돈다」가 §3.4와 같은 생각이다. kuromoji.js에는 이 기능이 없어 토큰화 뒤 적용한다 | 개념 채택 |
| Chinese Text Analyser | 단어 목록 최장 일치. 사용자가 바꾼 목록이 업그레이드 때 덮인다 | 비공개 | 교훈: 사용자 규칙은 배포 사전과 따로 저장해야 한다 → `user_segment_rules` 별도 표 | 교훈 채택 |
| Yomitan 스캔 파서 | 커서 위치부터 사전 최장 일치. 사용자 경계 저장 없음 | GPL-3.0 | 경계 저장 모델이 없고 GPL이다 | 배제 |
| Pleco 리더 | 문서 전체를 미리 분할하지 않고 탭할 때 묶는다 | 비공개 | 우리는 분석 결과를 저장·복습에 쓴다. 방식이 다르다 | 배제 |

출처: [jieba 문서](https://docsearch.algolia.com/mcp/docs/repo/fxsjy/jieba) · [Hanbaobao GitHub](https://github.com/hkproj/hanbaobao) · [LingQ 도움말 — 구 LingQ](https://lingq-support.groovehq.com/help/can-i-save-or-create-lingqs-for-phrases) · [Readlang 포럼 — 구 선택](https://forum.readlang.com/t/selecting-phrases/2245) · [Migaku 커뮤니티](https://migaku.com/community/m/1377650864390672416) · [Yomitan 고급 옵션(파서)](https://github.com/themoeway/yomitan/blob/master/docs/advanced-options.md) · [natto-py(MeCab 경계 제약)](https://pypi.org/project/natto-py/0.6.0/) · [Chinese Text Analyser 포럼](https://www.chinese-forums.com/forums/topic/44383-introducing-chinese-text-analyser/page/5/). Hanbaobao의 마지막 커밋 시점과 저장 방식은 확인하지 못했다(미확인).

---

## 11. 질문 · 제안값 · 오너 결정

### 11.1 설계 세션에 물을 것 `[Claude][QUESTION][VIEWER-V2-ROUNDS-001]`

| # | 질문 | 근거 | 제안 |
|---|---|---|---|
| Q1 | 카드의 「직접 묶은 단어 · [나누기]」 줄은 AE-R1의 「메타 문구 0」과 맞나? | 정본 §7 목업 vs §2.1 | 둔다. 출처 정직(경계를 사용자가 바꿨다)이고, AI 표와 달리 오너가 빼라고 하지 않았다. 문구는 「직접 묶은 단어」만, 나누기는 ⋯에도 있다 |
| Q2 | 묶은 꼴이 사전에 없을 때 「문맥 AI 뜻」을 AD-R3에서 바로 만드나? 지금 뜻 조회는 문장 없이 단어만 묻는다(`fetchMeanings.js:14-48`) | 정본 §7 「없으면 문맥 AI 뜻」 | AD-R3는 기존 뜻 조회(문맥 없음)를 쓰고, 문맥 뜻은 AD-R4의 「후보 밖 → 문맥 뜻」이 맡는다. 새 프롬프트를 두 군데 만들지 않기 위해서다 |
| Q3 | 팀 수업 사본에서 묶기를 막고, 원본에서 묶으면 경고만 하는 것으로 충분한가? | §0.6, `classCopyModel.js:28-55` | 예(첫 판). 사본 갱신에 경계 기록을 옮기는 일은 다음 라운드 |
| Q4 | 작성기 구간 자료(passage)에서도 첫 판에 묶기를 여나? | `correct_source_passage_token` 별도 RPC | 첫 판은 숨김 |
| Q5 | 사용자 규칙(②)에 문맥 조건(같은 이웃일 때만)을 붙이나? | §5.1 个人 위험 | 첫 판은 단순 규칙 + 카드 「규칙 지우기」 |
| Q6 | 재분석 보존기의 위치 계산을 공백 뺀 길이로 바꿔도 되나? 영어 묶음 토큰의 공백 때문이다 | `reanalysisPreservation.js:35-36,47-48` | PR②에서 바꾼다. 기존 계약이 그대로 통과하는지 확인한다 |
| Q7 | AD-R4의 기존 동작 「OOV 분리 판정 자동 적용」(AI 판단만으로 자동 분리)은 정본 §8 「AI 판단뿐이면 후보로만」과 어긋난다. AD-R4에서 같이 바꾸나? | `analyze/route.js:235-240`, AD-R4 설계서 §5.3 | AD-R4 설계서에서 다룬다 |

### 11.2 개발 세션이 정할 수 있는 것(제안값)

| 항목 | 제안값 |
|---|---|
| 묶기 상한 | 토큰 8개 · 글자 12(중·일) · 40(영) |
| 자료당 기록 상한 | 200개. 넘으면 「더 고치려면 재분석」 안내 |
| 새 id | `id_<줄>_e<k>_<리비전 8자>` |
| 이력 행 | `after_value.source = 'boundary_edit'`, `token_id` = 구간 첫 토큰 |
| ③ 규칙의 코드 이관 | 분기마다 `shared_segment_rules`를 `zhTokenFix` 화이트리스트로 옮기는 PR(계약 테스트 동반) |
| 되돌리기 | 뜻 줄 아래 한 줄. ⌘Z(`undoAny`)에는 묶지 않는다(AE-R1 §3.4와 같은 이유) |

### 11.3 오너 결정이 필요한 것

1. ~~한국어 어절 칼선: 안 A(음절마다) / 안 B(형태소 경계 후보만)~~ — **오너 결정 2026-10-09 「B안」**. 구현은 §7.5(어절 안 나누기만). 어절을 넘는 묶기는 아직 정하지 않았고 열지 않는다.
2. 공유 사전 쓰기 권한: 정본 §7은 「관리자만」인데 지금 `/api/dict-correct`(뜻 전역 적용)는 로그인 사용자 누구나 서버로 부를 수 있다. 경계 규칙 ③은 관리자 전용으로 만들 것이고, dict-correct의 권한 정리는 이 라운드 밖의 결정이다(§12.3).

---

## 12. 위험 · 보존

### 12.1 정본 §0.2

§4.2 표가 전부다. 요약하면, 경계 교정은 `processed_json`(원자 RPC)과 `token_corrections`(추가 전용)만 쓴다. ④는 새 표 두 개만 더한다.

### 12.2 수업 모드 · 언어 회귀

| 항목 | 위험 | 대응 |
|---|---|---|
| 수업 모드 | `classStudyActive`에서는 수업 전용 뜻·편집기가 카드를 차지한다 | ⋯ 메뉴의 묶기·나누기를 수업 모드에서 숨긴다(지금 ✎ 조건 `!classMeaning`과 같다, `ViewerPage.jsx:2194`) |
| 한국어 | 경계 편집 진입점 0 | 소스 계약(`legacyTokenEditingAllowed`) |
| 일본어 | 묶은 활용형의 기본형 오류 | 막지 않고 ✎로 고치게 한다. ja e2e 1건 |
| 영어 | 공백 든 토큰 | §7.3 네 곳 확인 + e2e 1건 |
| 기록 없는 자료 | PR②의 서버 변경이 기존 분석을 바꿀 위험 | 「기록 0이면 분석 결과 동일」 회귀 계약 |
| 동시 편집 | 분석 배치 저장과 경합 | `viewer_replace_analysis` 기대값 비교. 거절되면 화면 유지 + 다시 열기 안내 |

### 12.3 범위 밖 발견(보고만)

- `/api/dict-correct`(`api/dict-correct/route.js:15-81`)는 로그인만 확인하고 service_role로 공유 `morpheme_dictionary`를 `user_verified`로 덮는다. 화면은 자료 소유자에게만 이 옵션을 보이지만 서버에는 소유자·관리자 검사가 없다. `user_verified` 행은 자가 치유가 다시 덮지 않으므로(`disambiguateZhPos.js:219-241`) 잘못 쓰인 값이 계속 남는다. 별도 작업으로 권한을 정해야 한다.
- `correctTokenMutation`은 기대값 비교 없이 `processed_json` 전체를 `update`한다(`ViewerPage.jsx:1509-1511`). 분석 배치 저장과 경합하면 한쪽이 사라질 수 있다. 경계 교정은 원자 RPC를 쓰지만, 뜻 교정 경로의 경합은 기존 결함으로 남는다.
