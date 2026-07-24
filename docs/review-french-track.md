# 프랑스어 트랙 전수 평가 (report-only)

**평가일**: 2026-07-24
**기준 커밋**: `8bd0c9e23a989d9e40ee5b8b6a489c35392970c8` (`origin/main`)
**범위**: `src/content/french` 전체
**변경 원칙**: 콘텐츠 원문 수정 없음. 이 문서만 추가함.

## 1. 결론

### 종합 등급: D

콘텐츠의 양, 장면 구성, A0~C2의 외형적 범위는 좋다. 그러나 A1 필수 발음 3개
챕터가 리에종·앙셴느망·엘리종·강세·음절을 체계적으로 잘못 설명하고, 식당
알레르기 장면은 `noix`(호두)를 한국어 `견과류` 전체로 번역한다. 두 문제 모두
학습자가 그대로 외우면 실제 발음과 안전 의사소통에 직접 영향을 주므로 현재 상태를
배포 적합으로 판정할 수 없다.

| 평가축 | 등급 | 판정 |
|---|---|---|
| 언어 정확성 | D | A1 발음 규칙과 IPA에 다수의 구조적 오류, A2 일치 규칙 누락 |
| 커리큘럼 정합 | C | 실용 장면은 좋지만 A1 순서와 문법 선행 관계가 뒤집힘 |
| 한국어 설명 | C | 정확한 설명도 많으나 해요체/합니다체 혼용과 불→한 의미 오류 존재 |
| 예문 자연성 | B- | 대부분 이해 가능하나 창구·분실·환승 표현에 번역투가 반복됨 |
| 범위·분량 | A | A0~C2, 장면, 문형, 15개 어휘 팩을 폭넓게 제공 |

등급 기준은 A=배포 가능, B=경미한 교정 후 가능, C=중요 교정 필요,
D=핵심 규칙 또는 안전 의미의 재검수 전 배포 보류다.

## 2. 전수 범위와 방법

모듈을 공식 nvm Node 22에서 직접 import해 객체 전체를 재귀 순회하고, 파일·행 기반
정적 검사와 수동 언어 검수를 함께 수행했다.

| 영역 | 전수 실측 |
|---|---:|
| 프랑스어 소스 | 52,219행 |
| 문법 | 11팩, 78챕터, 314섹션, `fr` 문자열 997개 |
| 문형(`bunkei`) | 6팩, 588항목, 예문 쌍 1,176개 |
| 어휘 | 15팩, 131테마, 원시 항목 4,076개 |
| A1 본편·확장·장면·발음 | order 1~31 연속 |

검사는 다음을 포함한다.

1. 모든 챕터의 제목·요약·본문·표·팁·주의·예문·IPA·한국어를 순회했다.
2. 모든 문형과 어휘 항목의 필수 필드, 표제어, IPA, 불·한 예문을 순회했다.
3. 리에종·성수 일치·시제·법·관사·철자·불→한 의미 대응은 공식 언어 자료와
   대조했다.
4. A1 order를 실제 노출 순서로 다시 세워, 각 예문이 처음 공식 소개되는 문법보다
   먼저 등장하는지 검사했다.
5. `scripts/lint-content.mjs`를 실행했다. 활성 콘텐츠 137개에서 오류 0, 경고 2이며
   프랑스어 경고는 `grammar/a1_pronunciation.js:15`의 비해요체 요약 1건이다.

자동 검사는 의미·화용을 보증하지 않으므로 최종 판정은 수동 검수 결과를 우선했다.

## 3. 치명(Critical)

### FR-C01 — A1 발음 3챕터를 전면 재작성해야 함

`grammar/a1_pronunciation.js`는 국소 오탈자 수준이 아니라 규칙의 분류 기준 자체가
잘못됐다.

| 위치 | 현재 내용 | 판정 및 교정 방향 |
|---|---|---|
| `:15-16` | 모음 앞이면 끝 자음이 “갑자기 나타남” | 통사 환경에 따라 의무·선택·금지가 갈림. 요약부터 과잉 일반화 |
| `:25` | `parler`의 `l`이 묵음 | `l`은 발음되고 끝의 `r`이 발음되지 않음 |
| `:27` | `les étudiants`에서 “l읽음” | 실제 연결음은 `s → [z]` |
| `:28` | `pas encore [paz-ɑ̃kɔʁ]`을 일반 규칙 예로 제시 | 가능한 격식 변이일 수 있으나 A1 의무 규칙처럼 가르치면 안 됨 |
| `:51-54` | `petit_enfant`, “t는 항상” | 표제 문장에 밑줄이 노출되고, `t`의 실현은 자음 자체가 아니라 통사 환경에 좌우됨 |
| `:65-80` | 자음 글자별 “높음/중간/낮음” 정책 | 리에종은 자음 등급표가 아니라 관사+명사, 대명사+동사 등 통사 환경으로 설명해야 함 |
| `:70-78` | `pas`, `peut aller`, `grande`, `g → [ŋg]` 등 | 의무/선택을 혼동. `grande`의 [d]는 이미 발음되는 자음이라 앙셴느망이며, 희귀한 `g` 리에종은 [k] |
| `:93-107` | `peut aller`는 높음, `vous aimez`는 중간 | 전자는 의무가 아니고 후자의 대명사+동사는 의무 |
| `:112-114` | “누디 라틴어”, 리에종 때문에 비음 언어 | 근거가 없고 음운 현상 간 인과가 잘못됨 |
| `:120-143` | 앙셴느망을 “모음 끝+자음 시작”으로 정의 | 이미 발음되는 끝 자음이 다음 모음으로 재음절화되는 현상. `belle enfant` 설명과 `grand enfant` IPA도 오류 |
| `:163-183` | 모음+모음이면 앞 모음을 삭제 | 실제 엘리종 대상 어휘와 예외가 정해져 있음. 일반 음운 공식으로 제시하면 안 됨 |
| `:186-219` | `l'école = le + école`, `s'il = se + il` | `école`은 여성이라 `la + école`; `s'il`은 `si + il` |
| `:255-258` | `d'habitude [abityd]` | 탈락된 `d'`의 [d]가 빠짐. `[dabityd]` |
| `:291-320` | 모든 단어의 마지막 음절에 강세, `comprendre`의 `re` 강세 | 프랑스어 기본 강세는 리듬군 말미. `comprendre [kɔ̃.pʁɑ̃dʁ]`의 무음 `e`를 별도 강세 음절로 셀 수 없음 |
| `:314-329` | `[RAN]`, `[PRⱭ̃dr]`, `[SYON]` | IPA 칸에 임의 대문자 표기가 섞임 |
| `:337-376` | 모음 글자 수=음절 수; `table` 2, `semaine` 3, `bibliothèque` 5음절 | 표준 발음은 각각 대체로 1, 2, 4음절. 철자와 발음 음절을 혼동 |
| `:385-403` | 자의적 의미 그룹과 `[me-DE]` | `m'aider`는 `[mɛ.de]`; 전사와 리듬군을 다시 작성해야 함 |

이 파일은 부분 패치보다 음운 전공자 또는 FLE 발음 교재 기준으로 29~31장을 통째로
재설계하는 것이 안전하다. A0 `grammar/a0.js:217-250`의 기존 리에종·앙셴느망
입문과도 중복·충돌하므로 하나의 일관된 체계로 합쳐야 한다.

### FR-C02 — 알레르기 장면의 `noix` 번역은 안전 의미 오류

`noix`는 일반적인 “견과류 전체”가 아니라 기본적으로 호두다. 일반 범주를 말하려면
`fruits à coque`를 쓰거나, `noix`, `noisettes`, `amandes`처럼 해당 식품을 각각
명시해야 한다.

오류가 한 예문에 그치지 않고 다음 위치에 반복된다.

- `grammar/scene_travel.js:1288-1290`
- `grammar/scene_travel.js:1311-1313`
- `grammar/scene_travel.js:1400-1413`
- `grammar/scene_travel.js:1440-1455`
- `grammar/scene_travel.js:1481-1495`

건강·안전 장면이므로 단순 번역 다듬기가 아니라 프랑스어 범주, 한국어 번역,
연습문항, 모델 대화를 같은 의미로 일괄 재검수해야 한다.

## 4. 중요(Important)

### 언어·문법·발음

| ID | 위치 | 문제 |
|---|---|---|
| FR-I01 | `grammar/a1.js:287,289`, `grammar/a2.js:97` | `Je n'ai`를 `[ʒə ne]`로 적음. `ai`는 `[ɛ]` |
| FR-I02 | `grammar/a1.js:894` | `quatre-vingts euros`의 의무 리에종 `[z]`가 IPA에서 빠짐 |
| FR-I03 | `grammar/scene_travel.js:101-102,156-164` | 일상 창구 대화에서 `pas arrivé`를 `[paz‿a…]`로 고정. 가능한 격식 변이를 유일 발음으로 제시 |
| FR-I04 | `grammar/a2.js:22` | avoir 조동사의 과거분사는 “변하지 않는다”고 단정. 선행 직접목적어와의 일치 예외가 빠짐 |
| FR-I05 | `grammar/a2.js:121-128,156-164` | `sortir`, `monter`, `descendre`, `retourner`, `passer`가 타동사일 때 avoir를 쓰는 경우를 누락 |
| FR-I06 | `grammar/a2.js:316` | 대명동사의 과거분사가 항상 주어와 일치하는 인상. `Elles se sont parlé`, `Elle s'est lavé les mains` 같은 예외 필요 |
| FR-I07 | `grammar/b2.js:56-68` | `penser/croire`의 부정·의문=접속법으로 단정. 화자의 확신과 문체에 따라 직설법도 가능함을 밝혀야 함 |
| FR-I08 | `grammar/b2.js:793-817` | `il semble`/`il me semble`의 법 선택을 기계적 이분법으로 설명. 의미·확신·문맥의 변이를 누락 |
| FR-I09 | `grammar/a0.js:54` | 대문자 악상을 생략해도 된다는 인상. 현대 표준에서는 대문자에도 악상을 유지해야 함 |
| FR-I10 | `grammar/a0.js:173-178` | 프랑스어 /ʁ/을 한국어 [h]로 대체하는 편이 낫다고 단정. 임시 근사임을 명시하고 조음 설명을 우선해야 함 |

`bunkei`의 IPA도 격식 선택 리에종을 일상 예문에 일괄 고정한다. 대표 위치는
`bunkei/a1.js:95,174,259-260`, `bunkei/a2.js:55,253,653,880`,
`bunkei/b1.js:369-370,471,981`, `bunkei/b2.js:419,865,1054`다.
특히 `pas + 모음`의 [z]를 모든 레지스터의 정답처럼 반복하므로, 의무·선택·금지를
표시할 수 있는 IPA 정책이 필요하다.

### 커리큘럼 선행 관계

현재 A1의 order는 1~31로 연속이지만 학습 순서는 자연스럽지 않다.

| 선행 관계 | 앞에서 사용되는 위치 | 공식 도입 | 판정 |
|---|---|---|---|
| 인사·생존 표현 | A1 전체 | order 13 | 첫 문장보다 먼저 배치해야 함 |
| 명사 복수 | order 1, 7~9, 12 예문 | order 16 | 관사·형용사·소유형용사보다 늦음 |
| 리에종·엘리종·리듬 | 모든 A1 IPA | order 29~31 | 발음 규칙이 트랙 끝에 와서 오개념을 사후 교정 |
| 명령법 | 장면 21~28 (`Allez`, `Prenez`, `Suivez`, `Asseyez-vous`) | A2 order 8 | 장면용 덩어리 표현이라는 안내 없음 |
| 복합과거 | 장면 21~28 (`Vous avez dit`, `J'ai perdu`, `J'ai réservé`) | A2 order 1~2 | 시제 분석을 요구하는 문형을 선행 사용 |
| 대명동사 | 장면 21~22 (`où se trouve`, `je me sens`) | A2 order 4 | 어휘 덩어리와 문법 학습의 경계 미표시 |
| 목적대명사 | 장면 (`le voici`, `où l'avez-vous vu`) | A2 order 5 | 장면에서 형태를 설명하지 않음 |
| 조건법 | 장면 23~28 (`Je voudrais`) | B1 order 1 | A1 생존 공식으로는 적절하나 “후속 문법” 연결 필요 |
| 단순미래 | 장면 27 (`ce sera`) | A2 order 7 | 공식 표현이라는 연결 표지가 없음 |

추가 구조 문제:

- `grammar/a1.js:392,456,933`의 slug가 각각 `a0-06`, `a0-07`, `a0-08`로
  시작하지만 실제 level/order는 A1 6, 7, 13이다.
- 장면 21~28은 실제 과업 흐름과 재사용성은 좋다. 다만 `prerequisites`,
  `grammarRefs` 같은 명시적 연결 필드가 없어 선행 위반이 모두 암묵적이다.
- 권장 A1 흐름은 **생존 인사 → 소리·철자 최소 규칙 → 주어/être/avoir →
  성·관사·복수 → 규칙동사 → 부정·의문 → 형용사·소유 → 이동·부분관사 →
  수·시간 → 확장 → 장면**이다. 조건법·복합과거·명령법은 장면용 고정구로
  표시하고 A2/B1에서 분석적으로 다시 연결한다.

### 장면과 기초 문법 연결

장점은 분명하다. 길 찾기, 교통, 건강, 분실, 입국, 숙박, 식당으로 과업이 이어지고
A1의 의문문, 부정, 장소 전치사, 수·시간, pouvoir/vouloir를 실제 대화로 재사용한다.
문제는 연결이 데이터에 기록되지 않아 학습자가 “외울 표현”과 “이미 배운 문법”을
구별할 수 없다는 점이다.

또한 `fr` 필드 안에 한국어 화자명이 들어가 언어 필드를 오염시킨다.
`grammar/scene_emergency.js:139-160,414-435`,
`grammar/scene_travel.js:139-159,395-420,1400-1420` 등이 대표적이다.
화자명은 별도 구조 필드로 분리해야 TTS·검색·언어별 표시가 안전하다.

여행 장면의 이야기 블록은 총 37개 프랑스어 발화에 IPA가 없다. A1 본편 16개,
A1 확장 5개, A2 21개 누락과 함께 “어떤 필드에 IPA가 필수인가” 계약을 통일해야
한다.

## 5. 한국어 설명 품질

### 문체

정규식 기준 `습니다/합니다/됩니다/입니다`는 프랑스어 한국어 문자열에서 133회
나온다. 이 중 번역문 `ko` 42회를 제외해도 설명·팁·주의·어원 등에 91회가 남아
해요체 계약이 체계적으로 섞인다. 대표 위치:

- `grammar/a0.js:37,53-54,108,127,156,178,275`
- `grammar/a1.js:60,129,213,435,450,504,518,646,738`
- `grammar/a1_pronunciation.js:30,59,219,291`

단순히 문장 끝을 치환하면 높임 정도나 인용문의 레지스터가 망가질 수 있으므로
설명 필드만 대상으로 문맥 검수가 필요하다.

### 불→한 대응·설명 오류

| 위치 | 문제 | 권장 |
|---|---|---|
| `grammar/a1_pronunciation.js:204-207` | `s'il vous plaît`를 `se + il`, “제발요, 부탁합니다”로 설명 | `si + il`; 문맥에 따라 “부탁해요/…해 주세요” |
| `grammar/a1_pronunciation.js:216-219` | 여성명사 `école`을 `le + école`이라고 설명 | `la + école → l'école` |
| `grammar/scene_travel.js:311-313` | `Un aller-retour pour vendredi`를 “금요일에 돌아오는 왕복”으로 단정 | 출발/이용일로도 읽힘. 귀환일은 `retour vendredi`처럼 명시 |
| `grammar/scene_travel.js:1288-1495` | `noix`를 “견과류” 전체로 번역 | 호두 또는 `fruits à coque`/개별 알레르겐 |
| `grammar/c2.js:98` | `Va`, `te`를 “가세요, 당신을”로 존대 번역 | 작품 맥락을 보존해 “가, 나는 널…” 계열 |

## 6. 예문 자연성 표본

다음은 문법적으로 해석 가능하더라도 실제 장면에서 번역투·서식체로 들리는 표본이다.

| 위치 | 현재 | 더 자연스러운 방향 |
|---|---|---|
| `grammar/scene_emergency.js:387-402` | `Voici sa description : il est petit et noir.` | 말로는 `Il est petit et noir.` 또는 `Il est petit, noir, en cuir.` |
| `grammar/scene_emergency.js:433,487` | `Quelle est sa description ?` | `Pouvez-vous le décrire ?` / `À quoi ressemble-t-il ?` |
| `grammar/scene_travel.js:157` | `reçu de bagage` | `étiquette de bagage` / `talon de bagage` |
| `grammar/scene_travel.js:375-377` | `Où est la correspondance pour Bordeaux ?` | `Où dois-je aller pour ma correspondance vers Bordeaux ?` |
| `grammar/scene_travel.js:558-565` | `au nom de la personne indiquée ici` | 실제 이름을 말하거나 `au nom indiqué sur ce document` |
| `vocab/b1.js:126` | `Je postule à un emploi...` | 보수적 교육 문맥에서는 `Je postule pour un emploi...`가 안전 |

장면 레슨은 짧고 재사용 가능한 문형을 선택한 점이 강점이다. 다음 교정에서는
“문법적으로 가능”과 “창구에서 실제로 가장 먼저 나오는 말”을 별도 기준으로 검수해야
한다.

## 7. 챕터별 판정

`A`는 해당 챕터에서 확정적 중요 오류를 찾지 못했다는 뜻이지, 모든 지역·문체 변이를
보증한다는 뜻은 아니다.

### A0~A1

| order/slug | 등급 | 챕터별 판정 |
|---|---|---|
| A0-1 `a0-02-alphabet` | B | 대문자 악상 설명 `a0.js:54` 교정 |
| A0-2 `a0-03-vowels` | A | 핵심 모음 대조 양호 |
| A0-3 `a0-04-consonants` | B | /ʁ/의 [h] 대체 단정과 브랜드 예시 제거 |
| A0-4 `a0-05-liaison` | B | 입문은 대체로 유효하나 “모음 앞이면 부활” 요약을 통사 환경 중심으로 제한 |
| A0-5 `a0-06-word-order` | A | 기본 어순·형용사 위치 입문 양호 |
| A1-1 `a1-01-pronouns-etre` | A | 첫 문장 구성 양호 |
| A1-2 `a1-02-avoir` | A | avoir 관용 표현 양호 |
| A1-3 `a1-03-er-verbs` | A | 규칙동사 입문 양호 |
| A1-4 `a1-04-negation` | B | `Je n'ai` IPA `[ɛ]` 교정 |
| A1-5 `a1-05-questions` | A | 세 질문 방식의 단계화 양호 |
| A1-6 `a0-06-gender` | B | slug 수준 불일치, 상표 예시 |
| A1-7 `a0-07-articles` | B | slug 수준 불일치, 상표 예시 |
| A1-8 `a1-06-adjectives` | A | 위치·성수 일치 양호 |
| A1-9 `a1-07-possessives` | A | 소유자 성과 명사 성 구별 양호 |
| A1-10 `a1-08-aller-venir` | A | 근접미래·근접과거 입문 양호 |
| A1-11 `a1-09-partitive` | A | 부분관사와 부정의 de 연결 양호 |
| A1-12 `a1-10-numbers-time` | B | `quatre-vingts euros` 리에종 IPA 누락 |
| A1-13 `a0-08-survival` | B | 내용은 먼저 필요하나 order가 너무 늦고 slug 불일치 |
| A1-14 `a1-14-ir-re-present` | A | 고빈도 활용 확장 양호 |
| A1-15 `a1-15-modal-faire-present` | A | 장면 전 필수 양태동사 연결 양호 |
| A1-16 `a1-16-noun-gender-plural` | C | 복수 개념이 이미 다수 예문에 나온 뒤 공식 도입 |
| A1-17 `a1-17-article-contractions-countries` | A | 축약·국가 전치사 정리 양호 |
| A1-18 `a1-18-demonstrative-interrogative` | A | 지시·의문 한정사 대조 양호 |
| A1-19 `a1-19-place-prepositions` | A | 장면 선행 어휘로 적절 |
| A1-20 `a1-20-frequency-quantity-connectors` | A | 문장 확장 기능 양호 |
| A1-21 `a1-21-scene-directions-transit` | C | 실용성은 높으나 명령법·복합과거·대명동사 선행, `fr` 필드 오염 |
| A1-22 `a1-22-scene-health-lost-property` | C | 시제·대명동사 선행, 분실 창구 표현의 번역투 |
| A1-23 `a1-23-scene-airport-entry-baggage` | C | 과거시제·대명사 선행, 격식 리에종 고정, `reçu de bagage` |
| A1-24 `a1-24-scene-airport-ticket-connection` | C | 왕복 귀환일 번역 오류, `de l'aéroport` IPA `:357-358` 오류 |
| A1-25 `a1-25-scene-lodging-check-in` | B | 흐름은 좋으나 `au nom...` 예문이 서식체 |
| A1-26 `a1-26-scene-lodging-requests-problems` | B | 유용하나 선행 문법을 고정구로 표시할 필요 |
| A1-27 `a1-27-scene-restaurant-ordering` | B | 자연스러운 과업 흐름, 미래·조건법 연결 표지 필요 |
| A1-28 `a1-28-scene-restaurant-allergy-payment` | D | `noix`/견과류 안전 의미 오류 |
| A1-29 `a1-29-liaison-intro` | D | 리에종 체계·예문·IPA 전면 재작성 |
| A1-30 `a1-30-elision` | D | `s'il`, `l'école`, `d'habitude` 설명·IPA 오류 |
| A1-31 `a1-31-rhythm-stress` | D | 강세 단위와 음절 수, IPA 체계 오류 |

### A2~C2

| order/slug | 등급 | 챕터별 판정 |
|---|---|---|
| A2-1 `a2-01-passe-compose-avoir` | C | 선행 COD가 있을 때 과거분사 일치 예외 누락 |
| A2-2 `a2-02-passe-compose-etre` | C | 양방향 조동사 동사의 타동 용법 누락 |
| A2-3 `a2-03-imparfait` | A | 배경/사건 대조 양호 |
| A2-4 `a2-04-pronominal-verbs` | C | 복합과거 일치를 전원 주어 일치처럼 설명 |
| A2-5 `a2-05-object-pronouns` | B | COD를 가르치나 과거분사 일치와 연결하지 않음 |
| A2-6 `a2-06-comparative` | A | 비교급·최상급 입문 양호 |
| A2-7 `a2-07-futur-simple` | B | 근접/단순 미래를 거리·확정성으로 지나치게 도식화 |
| A2-8 `a2-08-imperatif` | A | 형태와 대명사 위치 설명 양호 |
| A2-9 `a2-09-y-en` | B | `Oui, je vais`를 무조건 비문으로 단정 `a2.js:632` |
| A2-10 `a2-10-relative-qui-que` | B | 언어 설명은 양호하나 인물·작품 연상 예시가 저장소 규약 위반 |
| A2-11 `a2-11-time-expressions` | A | depuis/pendant/il y a 대조 양호 |
| A2-12 `a2-12-quantity-tout` | A | 수량·tout 체계 양호 |
| B1-1 `b1-01-conditionnel-present` | A | 공손·가정·거리 두기 연결 양호 |
| B1-2 `b1-02-subjonctif-intro` | B | `espérer`와 동일주어 규칙 `b1.js:180`을 예외 없는 공식처럼 제시 |
| B1-3 `b1-03-plus-que-parfait` | A | 시제 관계 양호 |
| B1-4 `b1-04-relative-advanced` | A | dont/lequel 계열 연결 양호 |
| B1-5 `b1-05-gerondif` | A | 동시성·수단·조건 구별 양호 |
| B1-6 `b1-06-passive` | A | 수동과 대체 표현 양호 |
| B1-7 `b1-07-discours-indirect` | A | 시제 일치 단계화 양호 |
| B1-8 `b1-08-pronouns-advanced` | A | 소유·지시 대명사 정리 양호 |
| B1-9 `b1-09-connectors-purpose-time` | A | 목적·시간 연결사와 법 선택 양호 |
| B2-1 `b2-01-subjonctif-advanced` | B | 부정·의문 `penser/croire`의 직설법 가능성을 누락 |
| B2-2 `b2-02-hypothese-si` | A | 3형과 혼합형 설명 양호 |
| B2-3 `b2-03-participe-present` | A | 현재분사·동형용사 구별 양호 |
| B2-4 `b2-04-connecteurs` | A | 논리 기능별 연결사 양호 |
| B2-5 `b2-05-verb-prepositions` | A | 전치사 결합과 의미 차이 양호 |
| B2-6 `b2-06-mise-en-relief` | A | 강조 구문 양호 |
| B2-7 `b2-07-nominalisation` | A | 문체 변환 양호 |
| B2-8 `b2-08-cause-consequence` | A | 원인·결과와 법 선택 양호 |
| B2-9 `b2-09-negation-advanced` | A | 복합 부정과 범위 설명 양호 |
| B2-10 `b2-10-impersonal-formal` | B | `il semble`/`il me semble`을 절대 이분법으로 제시 |
| C1-1 `c1-01-passe-simple` | A | 독해 중심 위치 설정 양호 |
| C1-2 `c1-02-registres` | A | 구어·중립·격식 대조 양호 |
| C1-3 `c1-03-argumentation` | A | 논증 구조 양호 |
| C1-4 `c1-04-participiales` | A | 분사절의 격식 범위 양호 |
| C1-5 `c1-05-nuances` | A | 의미·결합 차이 양호 |
| C1-6 `c1-06-idiomatiques` | A | 관용구의 레지스터 표지가 유용 |
| C2-1 `c2-01-subjonctif-litteraire` | A | 인식 중심의 문어 접속법 설명 양호 |
| C2-2 `c2-02-style` | B | `Va/te`의 한국어 존대 불일치와 작품 직접 인용 |
| C2-3 `c2-03-francophonie` | A | 지역 변이 개요 양호 |
| C2-4 `c2-04-culture-implicite` | C | 작품·인물·정치 서술이 저장소 콘텐츠 규약과 충돌 |
| C2-5 `c2-05-traduction` | A | 번역 전략과 레지스터 전환 양호 |

## 8. 문형 6팩·어휘 15팩 판정

### 문형

| 팩 | 항목 | 판정 |
|---|---:|---|
| `bunkei/a1.js` | 94 | C — `pas + 모음` 등 선택 리에종을 일상 IPA에 반복 고정 |
| `bunkei/a2.js` | 91 | B- — 같은 IPA 정책 문제, 문형·번역은 대체로 양호 |
| `bunkei/b1.js` | 121 | B | 같은 IPA 정책과 해요체 혼용 |
| `bunkei/b2.js` | 123 | B | 같은 IPA 정책과 일부 격식/일상 레지스터 혼재 |
| `bunkei/c1.js` | 94 | A- | 문어 표지가 비교적 명확함 |
| `bunkei/c2.js` | 65 | A- | 화석·문학 표현의 구어 대안 표지가 좋음 |

전 588항목은 `ex`, `ex2`, IPA를 갖는다. 확인된 핵심 문제는 예문 문법보다 IPA
레지스터 정책이다.

### 어휘

| 팩 | 테마/원시 항목 | 판정 |
|---|---:|---|
| `vocab/a0.js` | 10/100 | B — 목표량 대비 과다, 규약상 상표 예시 |
| `vocab/a1.js` | 11/156 | B — 목표량 대비 과다, 상표 예시 |
| `vocab/a1_flelex.js` | 7/221 | B — 본편과 중복 복습의 의도 표지 없음 |
| `vocab/a2.js` | 11/181 | B — 목표량 대비 과다 |
| `vocab/a2_flelex.js` | 7/453 | C — A2 학습량 과다 |
| `vocab/b1.js` | 10/166 | B — 일부 교과서투 예문 |
| `vocab/b1_flelex.js` | 9/676 | C — 학습량 과다, `mœurs` 합자 누락 |
| `vocab/b1_flelex2.js` | 7/27 | A | 보강량은 작고 구조 양호 |
| `vocab/b2.js` | 12/217 | B — 목표량 대비 과다 |
| `vocab/b2_flelex.js` | 9/828 | C — 최대 과밀, 합자 누락 2종 |
| `vocab/b2_flelex2.js` | 9/84 | B | 본편과 합치면 여전히 과밀 |
| `vocab/c1.js` | 9/140 | B | 목표량 대비 과다 |
| `vocab/c1_flelex.js` | 7/493 | C | C1 단계의 과밀이 큼 |
| `vocab/c2.js` | 8/95 | B | 목표량 대비 과다 |
| `vocab/c2_flelex.js` | 5/239 | C | C2 핵심/수용 어휘 구분 필요 |

동일 레벨 병합 뒤 실질 단어 수는 A0 100, A1 377, A2 634, B1 868,
B2 1,129, C1 633, C2 334다. `SCHEMA.md`의 대략적 목표(A0 40, A1/A2 100,
B1/B2 80, C1 60, C2 50)를 크게 초과한다. 어휘가 많다는 사실 자체는 오류가
아니지만 필수·확장·수용 어휘를 구분하지 않으면 CEFR 진도와 복습 UX가 무너진다.

4,076개 항목은 모두 IPA·한국어·품사 필드를 갖는다. 레벨 간 정규화 표제어 중복은
58종이며, 품사 전환과 의도적 복습도 섞여 있어 일괄 삭제 대상은 아니다. 다만
`famille`, `livre`, `maison`, `acheter`, `train`, `enjeu`처럼 완전 중복인 항목은
복습 메타데이터로 연결하는 편이 낫다.

확정 철자 오류:

- `vocab/b1_flelex.js:2704,2710` — `moeurs` → `mœurs`
- `vocab/b2_flelex.js:1246,1251` — `main-d'oeuvre` → `main-d'œuvre`
- `vocab/b2_flelex.js:4377,4383` — `noeud` → `nœud`

## 9. 저장소 콘텐츠 규약 충돌

언어 평가 범위 밖이지만 같은 파일에서 확인된 배포 규약 위반이므로 별도 기록한다.
실명 상표·인물·작품 재현과 정치 서술을 피한다는 저장소 계약에 다음 예시가 충돌한다.

- `grammar/a0.js:170`
- `grammar/a1.js:450,504,661`
- `grammar/a2.js:166,605,742`
- `grammar/c2.js:95-98,260-293`
- 어휘 팩의 상표·작가·작품 예시 다수

언어 교정과 섞어 임의 수정하지 말고, 별도의 IP·콘텐츠 안전 패스로 전수 치환해야
한다.

## 10. 수정 우선순위

### 치명

1. `a1_pronunciation.js` 29~31장을 공식 FLE 음운 기준으로 전면 재작성한다.
2. `scene_travel.js`의 알레르기 단원을 알레르겐 범주부터 다시 검수한다.

### 중요

1. A1 순서를 재배치하고 장면 문형에 `prerequisites`/`grammarRefs` 또는
   “고정구로 먼저 암기, 문법은 A2/B1” 표지를 넣는다.
2. A2의 avoir·être·대명동사 과거분사 일치 체계를 하나의 연속 단원으로 보완한다.
3. 모든 IPA에 의무/선택/금지 리에종 정책을 적용하고, 일상 예문에 격식 선택형만
   고정하지 않는다.
4. 장면의 `fr` 필드에서 한국어 역할명을 분리하고 이야기 발화 IPA 계약을 통일한다.
5. `penser/croire`, `il semble`, 미래 시제처럼 변이가 있는 규칙에서 “항상”식
   단정을 제거한다.
6. 설명 필드를 해요체로 통일하고 불→한 대응 오류를 재검수한다.
7. 어휘를 핵심·확장·수용 층으로 나누고 레벨별 노출량을 줄인다.

### 사소

1. 합자 `œ` 철자 3종을 고친다.
2. A1의 `a0-*` slug 3개를 마이그레이션 계획 아래 정리한다.
3. 분실물·환승·예약 예문을 실제 창구 표현으로 다듬는다.
4. 프랑스어 물음표 앞 좁은 공백 등 타이포그래피 정책을 통일한다.

## 11. 검증 기준 자료

- Office québécois de la langue française,
  [의무 리에종](https://vitrinelinguistique.oqlf.gouv.qc.ca/23549/la-prononciation/liaisons/contextes-de-liaisons-obligatoires),
  [선택 리에종](https://vitrinelinguistique.oqlf.gouv.qc.ca/23550/la-prononciation/liaisons/contextes-de-liaisons-facultatives),
  [금지 리에종](https://vitrinelinguistique.oqlf.gouv.qc.ca/23552/la-prononciation/liaisons/contextes-de-liaisons-interdites)
- Académie française,
  [과거분사 일치](https://www.academie-francaise.fr/questions-de-langue?tag=g0a6a-21)
- Office québécois de la langue française,
  [접속법 개요](https://vitrinelinguistique.oqlf.gouv.qc.ca/24236/la-grammaire/le-verbe/modes/subjonctif/generalites-sur-le-subjonctif)
- Éduscol,
  [CECRL 개요](https://eduscol.education.gouv.fr/6762/cadre-europeen-commun-de-reference-pour-les-langues-cecrl)
- Assurance Maladie,
  [식품 알레르기 개요](https://www.ameli.fr/assure/sante/themes/allergie/comprendre-allergies)
- ANSES,
  [식품 알레르겐 보고서](https://www.anses.fr/fr/system/files/NUT2015SA0257.pdf)

## 12. 재검수 합격선

다음 조건을 모두 만족할 때 D에서 재평가한다.

1. 발음 29~31장의 확정 오류 0건, IPA 전사 정책 문서화.
2. 건강·안전 장면의 불→한 의미 대응을 이중 검수하고 알레르겐 범주 오류 0건.
3. A1 장면의 선행 문법 위반을 고정구 표지 또는 순서 조정으로 해소.
4. A2 과거분사 일치 예외와 양방향 조동사 동사 보완.
5. 설명 해요체 검사와 장면 언어 필드 순도 검사를 CI에 추가.
6. 수정 후 전체 Vitest와 콘텐츠 lint가 green.

## 13. 이 보고서 변경의 검증

공식 nvm Node `v22.23.1`에서 report-only 변경을 검증했다.

| 검증 | 결과 |
|---|---|
| 변경 범위 | `docs/review-french-track.md` 신규 1파일, 콘텐츠 변경 0 |
| `git diff --check` | 통과 |
| `set -o pipefail; npm test 2>&1 \| tee ...` | exit 0, 247/247 파일, 2,403/2,403 테스트 통과 |
| 전체 Vitest 소요 | 77.49초 |
| 전체 Vitest 최대 RSS | Darwin `wait4` 자식+하위 프로세스 누적 `ru_maxrss` 3,599,630,336바이트 (3,432.88MiB) |
| 콘텐츠 lint | exit 0, 오류 0, 경고 2(프랑스어 1, 중국어 1) |

참고로 별도 `scripts/check-content.mjs`는 기준 브랜치에 이미 있는 일본어 N5 추가
한자 `形` 때문에 exit 1이다. 이 보고서가 만든 회귀가 아니며, 본 작업의 필수
게이트인 전체 Vitest와 프랑스어 콘텐츠 lint는 green이다.
