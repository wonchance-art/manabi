# 영어 트랙 전수 평가

> 평가 기준 커밋: `d9d70110300acd157089b85d2a5678b68b70c281`
>
> 범위: `src/content/english/`의 문법·장면·확장, 문형 사전, 어휘 전부
>
> 성격: report-only. 이 평가는 콘텐츠를 수정하지 않는다.

## 1. 종합 등급: D

영어 트랙은 A1~C2의 문법, 실용 장면, 문형, 어휘를 한 흐름으로 묶은 범위와
재사용성은 좋다. 특히 문형 585항목과 어휘 1,382항목은 필수 필드가 안정적으로
채워져 있고, 대다수 예문은 의미 전달과 레벨별 검색에 사용할 수 있다.

그러나 입문 발음 챕터가 `/z/`의 조음, `ee`, 비강세 모음 축약을 사실과 다르게
절대 규칙으로 가르친다. 이 규칙은 이후 모든 발음 학습의 바탕이므로 국소 오탈자보다
위험하다. 여행 알레르기 장면에서는 `shellfish`를 `조개류`로 좁혀 번역해 갑각류를
누락할 수 있다. 또한 현재완료, 상태동사, 조건절 `will`, 총칭 관사, 영국 영어의
`t`를 예외 없는 규칙처럼 설명하는 부분과 C2 구절 IPA의 구조적 불완전성이 확인됐다.
따라서 핵심 규칙과 안전 의미를 재검수하기 전에는 전체 트랙 배포를 보류하는 D다.

| 평가축 | 등급 | 판정 |
|---|---|---|
| 언어 정확성 | D | 기초 발음 규칙과 알레르기 의미에 치명 오류, 시제·상·관사에 중요 과잉 단정 |
| 발음·IPA | D | OT의 음운 설명 오류와 C2 구절 IPA 10/10 불완전 |
| 커리큘럼 정합 | C | 폭넓고 순서는 대체로 좋으나 draft 상태를 지운 채 7챕터를 공개 |
| 한국어 설명 | C | 설명은 친절하나 해요체 계약 위반 100/1,890문자열(5.29%) |
| 예문 자연성 | B- | 대다수는 사용 가능하나 여행 장면에 번역투·가상 화폐 표현이 반복 |
| 범위·분량 | A | 문법 68챕터, 문형 585항목, 어휘 1,382항목을 A1~C2로 제공 |

등급 기준은 A=배포 가능, B=경미한 교정 후 가능, C=중요 교정 필요,
D=핵심 규칙 또는 안전 의미의 재검수 전 배포 보류다.

## 2. 전수 범위와 방법

공식 nvm Node 22에서 각 모듈을 직접 import해 객체 전체를 재귀 순회하고, 소스
파일·행 기반 정적 검사와 수동 언어 검수를 함께 수행했다.

| 영역 | 전수 실측 |
|---|---:|
| 영어 소스 | 18,327행 |
| 문법 | 10파일, 68챕터, 287섹션 |
| 문형(`bunkei`) | 6팩, 65테마, 585항목, 예문 쌍 1,170개 |
| 어휘 | 6팩, 97테마, 1,382항목 |
| 어휘 IPA | 1,382/1,382 필드 존재 |

레벨별 구성은 다음과 같다.

| 레벨 | 문법 챕터/섹션 | 문형 테마/항목 | 어휘 테마/항목 |
|---|---:|---:|---:|
| OT | 13/69 | — | — |
| A1 | 9/35 | 10/81 | 21/272 |
| A2 | 10/39 | 12/95 | 18/233 |
| B1 | 11/42 | 13/126 | 27/296 |
| B2 | 10/40 | 12/111 | 12/198 |
| C1 | 9/36 | 11/111 | 9/237 |
| C2 | 6/26 | 7/61 | 10/146 |

검사는 다음을 포함한다.

1. 모든 챕터의 제목·요약·본문·표·팁·주의·예문·이야기·퀴즈·IPA·한국어를
   순회했다.
2. 모든 문형의 `pattern/conn/ko/ex/ex2/note/ch`와 모든 어휘의
   표제어·IPA·뜻·품사·예문을 읽었다.
3. 영·미 발음 혼재와 강세, 관사·가산성, 시제·상, 구동사 뜻, 전치사 결합,
   불규칙 활용을 별도 체크리스트로 다시 검수했다.
4. 중복 표제어와 IPA를 정규화 비교하고, 장면별 발화의 IPA 완전성을 계수했다.
5. 한국어 설명 필드를 재귀 순회해 해요체 계약을 정량화했다.
6. `scripts/lint-content.mjs`를 실행했다. 기준 커밋은 활성 콘텐츠 138개,
   오류 0, 경고 0이다.

자동 검사는 의미·화용을 보증하지 않으므로 최종 판정은 권위 자료와 대조한 수동
검수를 우선했다. 변이로 인정되는 표현은 오류에서 제외했다. 예를 들어
`pay by cash`는 `pay in cash`보다 덜 전형적일 수 있으나 Cambridge 사전에 허용
변이로 실려 있어 오류로 세지 않았다.

## 3. 치명(Critical)

### EN-C01 — OT 발음 규칙의 분류 기준을 다시 써야 함

`grammar/ot.js`의 발음 입문은 개별 발음 오탈자가 아니라, 문자와 소리의 관계를
예외 없는 규칙으로 제시하는 방식 자체가 잘못됐다.

| 위치 | 현재 내용 | 무엇이 왜 틀렸는가 | 표준 및 교정 방향 |
|---|---|---|---|
| `grammar/ot.js:123` | 미국식 Z `[ziː]`를 “혀 떨림”으로 설명 | `/z/`는 혀를 떠는 trill이 아니라 유성 치경 마찰음이다 | IPA 분류대로 “혀끝·치경 사이 마찰 + 성대 울림”으로 설명 |
| `grammar/ot.js:252-256` | 새로 배울 영어 자음은 `/f v r l θ ð/` 여섯 개뿐이고 나머지는 한국어와 거의 일치 | 한국어 음소와 영어 `/z ʃ ʒ tʃ dʒ w/` 등의 대립·조음도 일대일 대응하지 않는다 | “우선순위 여섯 개”라고 범위를 제한하고 동일음 단정을 제거 |
| `grammar/ot.js:350-359` | `ee`는 “언제나” `/iː/` | `been`은 미국 표준에서 `/bɪn/`, 영국에서도 `/biːn/`과 `/bɪn/` 변이가 있다 | 자주 `/iː/`이지만 예외가 있다고 가르치고 사전 확인을 기본값으로 |
| `grammar/ot.js:443-447` | 비강세 모음은 전부 힘 빠진 `/ə/`로 뭉개며 또박또박 발음하면 외국인 티 | 비강세 음절에도 `/ɪ/`, `/i/` 등 여러 모음이 남는다. `effect`의 첫 음절은 `/ɪ/`, `coffee`의 끝은 `/i/`다 | 모음 약화의 대표 결과가 schwa라고 설명하되 모든 비강세 모음과 동일시하지 않기 |

국제음성학회 차트는 `/z/`를 voiced alveolar fricative로 분류하며 trill과 별도
범주로 둔다. Cambridge의
[`been`](https://dictionary.cambridge.org/us/dictionary/english/been),
[`effect`](https://dictionary.cambridge.org/pronunciation/english/effect),
[`coffee`](https://dictionary.cambridge.org/pronunciation/english/coffee)
전사만으로도 “언제나”와 “모두 schwa”는 성립하지 않는다. OT-02~05는 단어 몇
개를 고치는 대신, 철자 규칙을 빈도 높은 경향과 예외로 나누고 영·미 기준을 명시해
다시 설계해야 한다.

### EN-C02 — 알레르기 장면의 `shellfish → 조개류`는 안전 의미 오류

오류는 다음 위치에 반복된다.

- `grammar/scene_travel.js:1006-1013`
- `grammar/scene_travel.js:1099-1112`

영어 `shellfish`는 조개만 뜻하지 않는다. Cambridge는 lobster, crab, shrimp 같은
갑각류와 mussel, oyster 같은 연체동물을 함께 예로 든다. 이를 한국어 `조개류`로
옮기면 새우·게 알레르기가 있는 학습자가 자신의 위험 범주를 잘못 좁혀 이해할 수
있다. 미국 FDA의 법적 “major food allergen” 표기에서는 crustacean shellfish를
특정하지만, 일반 shellfish와 법적 세부 범주는 일치하지 않으므로 실전 장면에서는
더 구체적으로 묻는 편이 안전하다.

한국어는 최소한 `갑각류와 연체동물류`로 풀고, 실제 알레르기는
`shrimp/crab/lobster` 또는 `mollusks`처럼 해당 식품을 개별 확인하도록 안내해야
한다. 기준은 Cambridge
[`shellfish`](https://dictionary.cambridge.org/dictionary/english/shellfish)와
FDA의 [식품 알레르기 표시 안내](https://www.fda.gov/consumers/consumer-updates/have-food-allergies-read-label)다.

## 4. 중요(Important)

| ID | 위치 | 현재 문제 | 판정 및 표준 |
|---|---|---|---|
| EN-I01 | `grammar/a1.js:11-22` | `주어 + be + 보어`를 SVO라고 표기 | 보어는 목적어가 아니다. copular clause는 SVC 또는 subject–linking verb–subject complement로 구분해야 한다. Cambridge [subject complements](https://dictionary.cambridge.org/grammar/british-grammar/subject-complements) 기준 |
| EN-I02 | `grammar/a1.js:440-452` | `know/love/like/want/need`는 진행형 금지라고 절대화 | 상태동사는 보통 단순형이지만 임시적·변화된 의미에서는 일부 진행형이 가능하다. Cambridge [state/action verbs](https://dictionary.cambridge.org/us/grammar/british-grammar/verbs-state-action)는 `I'm not liking this book`, `She's loving the CD`를 제시 |
| EN-I03 | `grammar/a2.js:445-455` | 불규칙 활용표의 `go–went–gone (been)` | `been`은 `be–was/were–been`의 과거분사다. `have been to`는 방문 경험 구문이지 `go`의 과거분사가 아니다. Cambridge [불규칙 동사표](https://dictionary.cambridge.org/grammar/british-grammar/table-of-irregular-verbs), [go/gone/been](https://dictionary.cambridge.org/grammar/british-grammar/word-choice-go-gone-and-been) 기준 |
| EN-I04 | `grammar/a2.js:482-494` | “시점 부사와 현재완료는 같은 문장에 못 산다” | 금지되는 것은 `yesterday/in 2020` 같은 끝난 과거 시점이다. `today/this week/this year`처럼 끝나지 않은 기간은 현재완료와 결합한다. Cambridge [present perfect](https://dictionary.cambridge.org/us/grammar/british-grammar/present-perfect-simple) 기준으로 용어를 “끝난 과거 시점”으로 제한해야 함 |
| EN-I05 | `grammar/a2.js:636-644` | `always/never`는 이동 금지, 지정석에서만 가능 | `Always keep a copy`처럼 명령문 문두, `I will love you always`처럼 문미가 가능하고, `Never have I…` 문두 도치도 표준이다. Cambridge [always](https://dictionary.cambridge.org/us/grammar/british-grammar/always), [부사 위치](https://dictionary.cambridge.org/us/grammar/british-grammar/adverbs-and-adverb-phrases) 기준 |
| EN-I06 | `grammar/b1.js:113-122` | if/when절 안 `will` 금지를 “철칙”으로 제시 | 보통 조건·시간절에는 현재형을 쓰지만, 의지·고집·정중한 요청 또는 결과를 나타낼 때 if절의 `will/would`가 가능하다. Cambridge [conditional exceptions](https://dictionary.cambridge.org/grammar/british-grammar/second-conditional)처럼 기본 규칙과 예외를 분리해야 함 |
| EN-I07 | `grammar/b2.js:191-203` | 본문은 총칭 3형을 가르치면서 “가산명사의 총칭은 반드시 복수”라고 결론 | 같은 섹션의 `the + 단수`, `a + 단수`와 직접 모순된다. 회화 기본값이 무관사 복수라고 표현하고 “반드시”를 삭제 |
| EN-I08 | `grammar/c1.js:99-117` | `may≈50%`, `might/could≈30%` 등 고정 확률표 | 양태는 문맥·억양·화자 태도에 좌우되고 화자 사이 서열 판단도 다르다. Cambridge [may/might/could](https://dictionary.cambridge.org/grammar/british-grammar/may-might-and-could)도 원어민 간 확신도 판단이 다름을 명시한다. 숫자는 설명용 예시이지 표준 의미값이 아니라고 밝혀야 함 |
| EN-I09 | `grammar/c2.js:147-152` | 영국 영어는 `t`를 또렷이 지킨다고 단정 | 영국 영어에도 glottal stop, 탈락 등 여러 실현이 널리 존재한다. BBC [Pronunciation Lounge: /t/](https://downloads.bbc.co.uk/learningenglish/features/the_pronunciation_lounge/pron_lounge_episode_6_transcript_.pdf)처럼 미국 flap과 영국의 단일 대조가 아니라 변이 지도로 설명 |
| EN-I10 | `vocab/c2.js:51-60` | 10개 속담·관용구의 IPA가 표제 구절 전체가 아니라 1~2단어만 전사 | 예: `The elephant in the room`에 `[ˈelɪfənt]`만 있다. 같은 표제어의 C1 전사는 `vocab/c1.js:246`에서 전체 구절이다. IPA가 전체 표제어 전사라는 데이터 계약을 지키거나 별도 `focusIpa` 필드가 필요 |
| EN-I11 | `grammar/scene_travel.js:109-159,305-355,502-552,699-749,896-945,1093-1143` | 이야기 발화 48/48에 IPA 없음 | 같은 파일의 문형 예문 30/30과 `scene_emergency.js` 이야기 발화 17/17에는 IPA가 있다. 여행 장면의 발음 학습만 끊기는 구조 불일치 |
| EN-I12 | `grammar/expansion.js:8,13-16,82-85,143-146,204-207,265-268,326-329,387-390`; `index.js:32-34,79-84` | `DRAFT_UNWIRED`와 `*-draft-*`인 7챕터에서 status를 제거한 뒤 공개 레지스트리에 포함 | lint는 이를 활성 138개로 집계한다. 실제 공개 상태라면 draft 표지를 제거하고, 미완료라면 registry에서 제외해 상태 의미를 보존해야 함 |

별도 체크리스트 결과, B1 구동사 팩의 핵심 뜻 배정과 전치사 결합에서 확정적인
오배정은 찾지 못했다. 불규칙 활용은 EN-I03의 `gone (been)` 표기 외에는
검수한 3단 변화에서 확정 오류를 찾지 못했다. 영·미 IPA는 어휘 팩 전체가 대체로
rhotic한 미국식 축에 있고 `/ɒ/`, `/əʊ/`가 무작위로 섞이는 광범위한 혼용은
검출되지 않았다. 지적하지 않은 항목까지 오류라는 뜻은 아니다.

## 5. 한국어 설명 품질

### 문체

직접 번역문 `ko`와 대화 발화는 제외하고, 설명 성격의
`title/summary/body/tip/pitfall/vsKo/etym/note/desc`를 재귀 순회했다.
총 1,890문자열 중 `습니다/합니다/됩니다/입니다`가 들어간 문자열은 100개,
발생 수도 100회다. 해요체 계약 위반률은 **5.29%**다.

| 영역 | 설명 문자열 | 위반 문자열 | 비율 |
|---|---:|---:|---:|
| 문법·장면·확장 | 1,193 | 100 | 8.38% |
| 문형 | 535 | 0 | 0% |
| 어휘 | 162 | 0 | 0% |
| 합계 | 1,890 | 100 | 5.29% |

대표 위치는 `grammar/a1.js:10,125,284,452,494,515,530,564`,
`grammar/a2.js:51,186,370,378,408`, `grammar/b1.js:55,77,122,231`이다.
제목의 선언체, 인용된 격식 예문, 설명자의 문체가 섞여 있으므로 단순 문자열 치환보다
설명 필드별 문맥 교정이 필요하다.

### 한국어 의미 대응

| 위치 | 문제 | 권장 |
|---|---|---|
| `grammar/scene_travel.js:1010-1012,1101-1112` | `shellfish`를 `조개류`로 축소 | 갑각류와 연체동물을 구분해 개별 알레르겐까지 확인 |
| `grammar/ot.js:123` | `/z/`를 “혀 떨림”으로 묘사 | “치경 마찰 + 성대 울림” |
| `grammar/a2.js:448` | `gone (been)`을 한 활용 칸에 병치 | `gone`은 go의 p.p., `been`은 be의 p.p.이며 방문 경험 구문이라고 분리 |

그 밖의 한국어 번역은 대체로 원문의 시제·높임·화행을 보존했다. 특히 여행 장면은
질문과 응답의 역할이 명확하고, 문형 팩의 한국어 설명은 짧고 검색 가능성이 좋다.

## 6. 예문 자연성 표본

다음은 문법적으로 해석 가능하더라도 실제 장면에서 덜 전형적이거나 교육용
placeholder가 드러나는 표본이다.

| 위치 | 현재 | 더 자연스러운 방향 |
|---|---|---|
| `grammar/scene_travel.js:26,122` | `Here is my passport and arrival card.` | 두 문서를 병렬로 건네면 `Here are my passport and arrival card.`; 구어 축약 `Here's…`와 완전형의 수 일치를 구분 |
| `grammar/scene_travel.js:44,132` | `I'm here for tourism.` | 입국 답변은 `I'm here on vacation/holiday.` 또는 `I'm here for sightseeing.`가 더 자연스러움 |
| `grammar/scene_travel.js:328-329` | `It is twelve units.` / `12단위예요.` | 실제 통화명 `It's twelve dollars/euros.` 또는 일반화가 필요하면 `The fare is 12.` |
| `grammar/scene_travel.js:484-491,544` | `keep my luggage until four` | 이해 가능하나 숙소 맥락에서는 `store/hold my luggage`가 의도를 더 정확히 드러냄 |
| `grammar/scene_travel.js:670,741` | `There is too much noise in my room.` | `My room is too noisy.` 또는 `There's a lot of noise coming into my room.` |
| `grammar/scene_travel.js:933-944` | `The vegetable soup is light and warm.` / `I will bring them soon.` | `The vegetable soup is a light option.` / 주문 응답은 `I'll bring those right out.` |

반대로 `pay by card`, `pay in cash`, `at/on the weekend`, `in (the) hospital`처럼
지역·결합 변이가 문맥상 명시된 사례는 자연성 오류로 세지 않았다.

## 7. 챕터별 판정

`A`는 해당 챕터에서 확정적 중요 오류를 찾지 못했다는 뜻이지, 모든 방언·문체 변이를
보증한다는 뜻은 아니다. expansion 7챕터의 B는 본문 언어보다 공개 상태 문제다.

### OT·실용 장면

| order/slug | 등급 | 챕터별 판정 |
|---|---|---|
| OT-1 `ot-01-word-order` | A | 한국어와 영어 기본 어순 대비가 명료함 |
| OT-2 `ot-02-alphabet` | D | `/z/` 조음 설명 오류(EN-C01) |
| OT-3 `ot-03-phonics-consonants` | C | “새 소리 여섯 개뿐” 과잉 단정(EN-C01) |
| OT-4 `ot-04-phonics-vowels` | D | `ee` 예외 없는 규칙(EN-C01) |
| OT-5 `ot-05-stress-rhythm` | D | 모든 비강세 모음을 schwa로 일반화(EN-C01) |
| OT-6 `ot-06-scene-directions-transport` | A | 요청·길 안내 문형과 이야기 IPA가 안정적 |
| OT-7 `ot-07-scene-illness-lost-property` | A | 응급·분실 화행과 이야기 IPA가 안정적 |
| OT-8 `ot-08-scene-airport-immigration` | B | 번역투 표본과 이야기 IPA 누락 |
| OT-9 `ot-09-scene-airport-tickets-transfers` | B | 가상 `units`, 이야기 IPA 누락 |
| OT-10 `ot-10-scene-accommodation-check-in-out` | B | `keep luggage`와 이야기 IPA 누락 |
| OT-11 `ot-11-scene-accommodation-requests-problems` | B | 소음 표현과 이야기 IPA 누락 |
| OT-12 `ot-12-scene-restaurant-ordering-recommendations` | B | 일부 대본투와 이야기 IPA 누락 |
| OT-13 `ot-13-scene-restaurant-allergies-payment` | D | 안전 의미 오류 EN-C02와 이야기 IPA 누락 |

### A1·A2

| order/slug | 등급 | 챕터별 판정 |
|---|---|---|
| A1-1 `a1-01-be-verb` | C | SVC를 SVO로 표기(EN-I01) |
| A1-2 `a1-02-present-simple` | A | 3인칭 단수와 do-support 설명이 안정적 |
| A1-3 `a1-03-articles` | A | 특정성·첫 언급 구분이 입문 수준에 적절 |
| A1-4 `a1-04-plural-countable` | A | 복수·가산성 기본 규칙이 안정적 |
| A1-5 `a1-05-pronouns-possessive` | A | 대명사 격과 소유 구분이 명료함 |
| A1-6 `a1-06-present-continuous` | C | 상태동사 진행형을 예외 없이 금지(EN-I02) |
| A1-7 `a1-07-questions-negatives` | A | be/do 세계 분리가 교육적으로 유효 |
| A1-8 `a1-08-prepositions-basic` | A | at/on/in의 입문 공간 비유가 유용함 |
| A1-9 `a1-draft-09-demonstratives-one` | B | 내용은 양호하나 draft 상태로 공개(EN-I12) |
| A2-1 `a2-01-past-simple` | A | 불규칙 과거와 `-ed` 발음 기본이 안정적 |
| A2-2 `a2-02-past-continuous` | A | 배경·사건 대비가 명료함 |
| A2-3 `a2-02-future` | B | 내용은 양호하나 앞 챕터와 slug 번호 중복 |
| A2-4 `a2-03-comparatives` | A | 비교급·최상급과 than/of 범위가 적절 |
| A2-5 `a2-04-modals-basic` | A | 의무·금지·불필요 의미 구분이 좋음 |
| A2-6 `a2-05-present-perfect-intro` | C | `gone (been)`과 시점 부사 과잉 단정(EN-I03~04) |
| A2-7 `a2-06-infinitive-gerund` | A | 보문 선택의 입문 비유가 유효함 |
| A2-8 `a2-07-adverbs-frequency` | C | `always/never` 위치를 절대화(EN-I05) |
| A2-9 `a2-08-there-is` | A | 존재문 수 일치와 have 대비가 안정적 |
| A2-10 `a2-draft-10-requests-suggestions` | B | 내용은 양호하나 draft 상태로 공개(EN-I12) |

### B1·B2

| order/slug | 등급 | 챕터별 판정 |
|---|---|---|
| B1-1 `b1-01-present-perfect-past` | B | 끝난 시점 규칙은 정확하나 A2의 넓은 문구와 연결 교정 필요 |
| B1-2 `b1-02-conditionals-1-2` | C | 조건·시간절 `will`을 철칙으로 금지(EN-I06) |
| B1-3 `b1-03-passive` | A | be/get 수동과 행위자 생략 설명이 안정적 |
| B1-4 `b1-04-relative-clauses` | A | 제한·계속 용법과 관계사 생략이 명료함 |
| B1-5 `b1-05-reported-speech` | B | 후퇴가 기본값임을 잘 밝히나 `must→had to` 표는 의미별 제한 권장 |
| B1-6 `b1-06-modals-speculation` | A | 추측의 긍정·부정 대응이 안정적 |
| B1-7 `b1-07-phrasal-verbs-intro` | A | 분리 가능성과 대명사 위치 설명이 유효 |
| B1-8 `b1-08-preposition-combos` | A | 동사·형용사·명사 결합을 덩어리로 제시 |
| B1-9 `b1-09-question-craft` | A | 간접의문 어순과 정중도 설명이 안정적 |
| B1-10 `b1-draft-10-past-perfect` | B | 내용은 양호하나 draft 상태로 공개 |
| B1-11 `b1-draft-11-deadlines-contingency` | B | 내용은 양호하나 draft 상태로 공개 |
| B2-1 `b2-01-conditionals-3-mixed` | A | 3형·혼합 가정법의 시간축이 명료함 |
| B2-2 `b2-02-perfect-continuous` | A | 완료진행의 결과·지속 구분이 안정적 |
| B2-3 `b2-03-articles-advanced` | C | 총칭 3형과 “반드시 복수”가 내부 모순(EN-I07) |
| B2-4 `b2-04-inversion-emphasis` | A | 부정어 도치와 강조 구문이 안정적 |
| B2-5 `b2-05-participle-clauses` | A | 주어 일치 함정을 명시함 |
| B2-6 `b2-06-linking-devices` | A | 논리 연결과 구두점 구분이 유용함 |
| B2-7 `b2-07-collocations` | A | 결합 강도와 사전 학습 전략이 적절 |
| B2-8 `b2-08-causative-perception` | A | 사역·지각 보문의 형태 대비가 명료함 |
| B2-9 `b2-09-determiners-agreement` | A | 한정사와 수 일치가 안정적 |
| B2-10 `b2-draft-10-degree-result` | B | 내용은 양호하나 draft 상태로 공개 |

### C1·C2

| order/slug | 등급 | 챕터별 판정 |
|---|---|---|
| C1-1 `c1-01-subjunctive-formality` | A | bare subjunctive와 영국식 should 변이를 명시 |
| C1-2 `c1-02-hedging-nuance` | C | 조동사 확신도를 고정 퍼센트로 오인하게 함(EN-I08) |
| C1-3 `c1-03-discourse-register` | A | 장르별 레지스터 대비가 실용적 |
| C1-4 `c1-04-cleft-information` | A | cleft와 정보구조 설명이 안정적 |
| C1-5 `c1-05-idioms-metaphor` | A | 은유군과 화용 설명이 유용함 |
| C1-6 `c1-06-academic-writing` | A | 행위자 비인칭화와 신중한 주장 구분이 좋음 |
| C1-7 `c1-07-verb-complementation` | A | 동사별 보문·전치사 선택이 안정적 |
| C1-8 `c1-08-time-perspective` | B | 핵심 대비는 좋으나 미래완료 신호어를 더 유연하게 설명할 필요 |
| C1-9 `c1-draft-09-focus-scope` | B | 내용은 양호하나 draft 상태로 공개 |
| C2-1 `c2-01-style-rhetoric` | A | 병렬·삼분법·수사 질문 분석이 명료함 |
| C2-2 `c2-02-varieties` | C | 영국 영어 `t` 보존을 절대화(EN-I09) |
| C2-3 `c2-03-cultural-allusion` | A | 문화 전고의 직역 위험과 풀이가 유용 |
| C2-4 `c2-04-humor-irony` | A | 억양·맥락 기반 반어 설명이 안정적 |
| C2-5 `c2-05-translation` | A | 번역 전략과 비등가성 설명이 균형적 |
| C2-6 `c2-draft-06-ellipsis-substitution` | B | 내용은 양호하나 draft 상태로 공개 |

## 8. 문형·어휘팩 판정

### 문형

| 팩 | 테마/항목 | 판정 |
|---|---:|---|
| `bunkei/a1.js` | 10/81 | B — 구조와 예문은 양호하나 상태동사 진행형 절대 규칙이 반복됨 |
| `bunkei/a2.js` | 12/95 | B+ — 필수 문형 범위와 예문 쌍이 안정적 |
| `bunkei/b1.js` | 13/126 | B — 조건절 `will`, `must→had to`를 의미별로 제한할 필요 |
| `bunkei/b2.js` | 12/111 | A- — 고급 관사·도치·연결 문형의 검색성이 좋음 |
| `bunkei/c1.js` | 11/111 | A- — 레지스터와 담화 기능 표지가 대체로 명료함 |
| `bunkei/c2.js` | 7/61 | A- — 고급 화용과 대안 표현을 간결하게 제공 |

전 585항목은 `pattern/conn/ko/ex/ex2`를 갖고 예문 쌍은 1,170개다. 문형에 IPA가
없는 것은 누락이 아니라 `SCHEMA.md:95-97`의 “예문 IPA는 쓰지 않고 TTS가 담당”
계약이다. 확정 문제는 대량 결손보다 문법 본편의 과잉 단정이 일부 note에 반복되는
점이다.

### 어휘

| 팩 | 테마/항목 | 판정 |
|---|---:|---|
| `vocab/a1.js` | 21/272 | B | IPA·품사·예문은 완전하나 한 레벨의 필수/확장 층 구분 필요 |
| `vocab/a2.js` | 18/233 | B+ | 생활·여행 결합과 예문이 안정적 |
| `vocab/b1.js` | 27/296 | A- | 구동사·전치사 결합의 의미 배정이 대체로 정확 |
| `vocab/b2.js` | 12/198 | A- | 추상·학술 어휘의 문맥 예문이 유용 |
| `vocab/c1.js` | 9/237 | A- | 관용구도 구절 전체 IPA를 제공 |
| `vocab/c2.js` | 10/146 | C | 속담·관용구 10/10의 IPA가 표제 구절 일부만 전사(EN-I10) |

1,382항목 모두 `ipa` 필드는 존재한다. 다만 “필드 존재”와 “표제어 전체 전사”는
다르므로 C2 10항목은 lint를 통과해도 완전하지 않다. 정규화 표제어 중복은 17종,
그중 한국어 뜻이 다른 것은 7종이다. 중복 자체는 레벨별 복습일 수 있어 일괄 오류로
보지 않았다. 동일 관용구 `the elephant in the room`은 C1
`vocab/c1.js:246`에서 전체 IPA, C2 `vocab/c2.js:60`에서 단어 하나 IPA로 달라
전사 정책의 불일치를 잘 보여준다.

## 9. 저장소 콘텐츠 규약 충돌

언어 사실과 별도로, 저장소의 IP·수위 계약은 상호·인물·작품·브랜드 재현과 정치
서술을 피하도록 한다. 다음은 평가 중 확인한 재검수 후보이며 언어 등급의 Critical
수에는 넣지 않았다.

- `grammar/ot.js:420-466` — McDonald's 상호·어원·예문 반복
- `grammar/b1.js:257` — Google 고유 상표 예문
- `grammar/c2.js:53,79,82-83,250` 부근 — 실존 연설·작품·인물에 기대는 예시
- 일부 어휘 예문의 플랫폼·상표 고유명

외부 저작물 인용 여부와 라이선스는 언어 정확성 검수와 별도의 법무·콘텐츠 정책
검토가 필요하다. 이 보고서는 해당 콘텐츠를 수정하거나 삭제하지 않는다.

## 10. 우선순위

### 배포 전

1. OT-02~05의 음운 설명을 IPA 조음 분류와 영·미 사전 전사 기준으로 다시 쓴다.
2. 알레르기 장면의 `shellfish` 한국어 범주를 갑각류·연체동물까지 안전하게 고친다.
3. 현재완료, 상태동사, 조건절 `will`, 총칭 관사의 “항상/절대/반드시”를
   기본 규칙과 예외로 나눈다.
4. C2 속담·관용구 10개에 전체 표제 구절 IPA를 제공하거나 필드 의미를 분리한다.
5. 여행 장면 이야기 48개 발화의 IPA 정책을 emergency 장면과 통일한다.
6. draft expansion 7챕터의 공개 여부를 명시하고 registry가 status를 보존하게 한다.

### 다음 교정

1. 설명 필드를 해요체로 통일하되 인용문과 실제 격식 예문은 보존한다.
2. 여행 대본의 placeholder 통화와 번역투를 실제 창구 표현으로 다듬는다.
3. 영·미 발음 기준을 팩 메타데이터에 명시하고 변이 표기 규칙을 문서화한다.
4. 문형 note에 반복된 과잉 단정을 본편과 함께 교정한다.
5. 어휘를 필수·확장·수용 층으로 구분해 레벨별 복습량을 설계한다.

## 11. 검증 기준 자료

- International Phonetic Association,
  [공식 IPA 차트](https://www.internationalphoneticassociation.org/IPAcharts/IPA_charts_EI/IPA_charts_EI.html)
- Cambridge Dictionary / English Grammar Today,
  [`been`](https://dictionary.cambridge.org/us/dictionary/english/been),
  [`effect`](https://dictionary.cambridge.org/pronunciation/english/effect),
  [`coffee`](https://dictionary.cambridge.org/pronunciation/english/coffee),
  [상태동사와 동작동사](https://dictionary.cambridge.org/us/grammar/british-grammar/verbs-state-action),
  [현재완료](https://dictionary.cambridge.org/us/grammar/british-grammar/present-perfect-simple),
  [불규칙 동사표](https://dictionary.cambridge.org/grammar/british-grammar/table-of-irregular-verbs),
  [`go/gone/been`](https://dictionary.cambridge.org/grammar/british-grammar/word-choice-go-gone-and-been),
  [주어 보어](https://dictionary.cambridge.org/grammar/british-grammar/subject-complements),
  [조건문](https://dictionary.cambridge.org/grammar/british-grammar/second-conditional),
  [`always`](https://dictionary.cambridge.org/us/grammar/british-grammar/always),
  [부사 위치](https://dictionary.cambridge.org/us/grammar/british-grammar/adverbs-and-adverb-phrases),
  [`may/might/could`](https://dictionary.cambridge.org/grammar/british-grammar/may-might-and-could),
  [`shellfish`](https://dictionary.cambridge.org/dictionary/english/shellfish)
- British Council,
  [현재완료](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/present-perfect),
  [가능성 조동사](https://learnenglish.britishcouncil.org/free-resources/grammar/c1/modals-probability)
- BBC Learning English,
  [Pronunciation Lounge: `/t/`의 여러 실현](https://downloads.bbc.co.uk/learningenglish/features/the_pronunciation_lounge/pron_lounge_episode_6_transcript_.pdf)
- U.S. Food and Drug Administration,
  [식품 알레르기 표시 안내](https://www.fda.gov/consumers/consumer-updates/have-food-allergies-read-label)

## 12. 재검수 합격선

다음 조건을 모두 만족할 때 D에서 재평가한다.

1. OT 발음 챕터의 확정 사실 오류 0건, 영·미 IPA 정책 문서화.
2. 건강·안전 장면의 영→한 알레르겐 범주를 이중 검수하고 의미 축소 0건.
3. 시제·상·관사·조건절의 절대 단정을 기본 규칙과 예외로 재작성.
4. C2 구절 IPA가 전 표제어를 덮고, 동일 표제어 중복 간 전사 정책이 일치.
5. 장면 이야기 IPA 계약과 expansion 공개 상태가 일관됨.
6. 설명 해요체 검사와 구절 IPA 완전성 검사를 CI에 추가.
7. 수정 후 전체 Vitest와 콘텐츠 lint가 green.

## 13. 이 보고서 변경의 검증

공식 nvm Node `v22.23.1`에서 report-only 변경을 검증했다.

| 검증 | 결과 |
|---|---|
| 변경 범위 | `docs/review-english-track.md` 신규 1파일, 콘텐츠 변경 0 |
| `git diff --check` | 통과 |
| `npm test` | exit 0, 249/249 파일, 2,459/2,459 테스트 통과 |
| 전체 Vitest 소요·최대 RSS | `getrusage(RUSAGE_CHILDREN)` 래퍼 실측 117.99초, 3,380,264,960바이트(3,223.67MiB) |
| 콘텐츠 lint | 138 active + 0 draft, 오류 0, 경고 0 |
| 보고서 결정성 | 최종 파일 SHA-256을 연속 2회 계산해 byte-identical 확인 |

첫 cold-cache 전체 실행에서는 콘텐츠와 무관한
`districtSignsAudit24.test.js`가 기본 30초 제한을 4.74초 넘겨 1건 time-out했다.
같은 테스트를 단독 재현하면 7.23초에 통과했고, 이후 표준 전체 명령은 78.76초에
exit 0, RSS 래퍼 전체 명령도 117.99초에 exit 0이었다. 따라서 논리 실패가 아니라
초기 병렬 실행의 성능 변동으로 판정하되, 장시간 전수 감사 테스트의 timeout 여유는
별도 관찰할 가치가 있다.
