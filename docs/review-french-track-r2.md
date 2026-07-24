# 프랑스어 트랙 재평가 R2 (report-only)

> 평가일: 2026-07-24
>
> 기준 브랜치·커밋: `origin/main`
> (`3de02f3e7cb18b82e0a7099181e40b6b0dbf5e5e`)
>
> 이전 평가: `docs/review-french-track.md`
> (`8bd0c9e23a989d9e40ee5b8b6a489c35392970c8`)
>
> 대상: `src/content/french/` 전체
>
> 변경 원칙: 콘텐츠 파일은 수정하지 않고 이 재평가 문서만 작성한다.

## 1. 결론과 재등급

### 종합 등급: D → D

이전 평가 뒤 알레르기 범주 오류 FR-C02와 문법·발음 중요 항목 FR-I01~10은
대부분 정확히 교정됐다. 한국어 설명의 합쇼체도 91회에서 9회로 줄었고, 이전에
지목한 A레벨·여행 장면 IPA 누락 79개도 모두 채워졌다. 이 변화는 실제 콘텐츠와
병합 커밋을 대조해 확인했다.

그러나 D 해제 조건은 충족되지 않았다.

1. FR-C01의 발음 3챕터 재작성본에 `adorable`과 `photographe`의 음절 수,
   `h aspiré`, 리에종 음가와 환경에 관한 확정 오류가 남아 있다.
2. 이전 평가 뒤 추가된 A1 파일럿이 용량·대상·금기 확인 없이
   `Il faut prendre de l'aspirine trois fois par jour.`를 일반 의료 지시로
   반복한다. 파일은 `PILOT_DRAFT`지만 활성 A1 레지스트리에 직접 들어간다.
3. A1 선행 관계, 선택 리에종의 레지스터 정책, 언어 필드 순도, 어휘 과밀과
   합자 철자는 아직 해소되지 않았다.

| 평가축 | 이전 | 재등급 | 변화 근거 |
|---|:---:|:---:|---|
| 언어 정확성 | D | D | FR-C02·FR-I01~10은 개선됐으나 FR-C01 잔존 오류와 신규 의료 안전 지시가 Critical |
| 커리큘럼 정합 | C | C | 파일럿 2챕터가 추가됐지만 기존 선행 관계는 그대로이고 `PILOT_DRAFT`가 활성 등록됨 |
| 한국어 설명 | C | B | 비번역 설명·팁·주의·어원 합쇼체 91회 → 9회; 완전 소탕은 아님 |
| 예문 자연성 | B- | B- | 알레르기·왕복표현 일부는 개선됐으나 분실·환승·수하물 창구 번역투가 잔존 |
| 범위·분량 | A | A | A0~C2, 문형 588항목, 어휘 4,076항목의 폭은 유지 |

등급 기준은 이전 평가의 배포 가능성 루브릭을 A~F로 명시적으로 확장한다.

| 등급 | 기준 |
|:---:|---|
| A | 확정 Critical/Important가 없고 현재 상태로 배포 가능 |
| B | 핵심 학습을 해치지 않는 경미한 교정 뒤 배포 가능 |
| C | 중요 교정이 남아 제한적 사용만 가능 |
| D | 핵심 규칙 또는 안전 의미의 재검수 전 배포 보류 |
| E | 여러 레벨의 핵심 체계가 광범위하게 잘못되어 대규모 재작성 필요 |
| F | 데이터 신뢰성이나 안전성이 무너져 학습 자료로 사용할 수 없음 |

`+/-`는 같은 기본 등급 안의 상대적 위치만 나타낸다. 종합 등급은 가장 심각한
확정 위험을 우선하므로, 수정량이 많다는 사실만으로 Critical을 상쇄하지 않는다.

## 2. 재평가 범위와 방법

기준 커밋과 이전 평가 커밋 사이의 프랑스어 변경은 16파일,
1,065행 추가·478행 삭제다. 병합 PR의 주장만 받아들이지 않고 현재 객체와 행을
다시 순회했다.

| 영역 | 현재 전수 실측 |
|---|---:|
| 프랑스어 소스 | 34파일, 52,613행 |
| 문법 | 12모듈, 80챕터, 330섹션, 직접 예문 891개 |
| 문형(`bunkei`) | 6팩, 74테마, 588항목 |
| 어휘 | 15팩, 131테마, 원시 항목 4,076개 |
| A0~A2 직접 예문 IPA | 549/555; 신규 파일럿 6개 누락 |
| 비번역 한국어 산문의 합쇼체 | 9회 |
| 한국어 역할명이 들어간 `fr` 객체 | 16개 |

검사는 다음을 포함한다.

1. 이전 Critical 2건과 Important FR-I01~10의 현재 문자열·IPA·설명을 전부
   다시 확인했다.
2. `8bd0c9e..3de02f3`의 경로별 로그와 PR #586, #587, #591, #593, #595,
   #606, #608, #610의 병합 커밋·본문을 대조했다.
3. 모든 문법 모듈, 문형팩, 어휘팩을 Node 22로 import해 챕터·섹션·항목,
   IPA 누락, 비해요체, `fr` 필드의 한국어 혼입을 재계수했다.
4. 리에종·엘리종·음절·`h aspiré`는 OQLF와 프랑스 학술 사전의 현재 설명,
   의약품 지시는 프랑스 공공 의약품 자료와 대조했다.
5. 이전 자연성 표본과 구조 문제를 현재 행에서 다시 찾고, 확인되지 않는 후보는
   신규 지적으로 올리지 않았다.
6. `scripts/lint-content.mjs`, 전체 Vitest, `git diff --check`를 실행했다.

자동 lint와 테스트는 객체 구조와 회귀를 찾을 수 있지만 언어 사실이나 의료 지시의
안전성을 보증하지 않으므로, 의미 판정은 현재 콘텐츠와 권위 자료 대조를 우선했다.

## 3. 이전 치명·중요 지적의 현재 상태

### Critical와 FR-I01~10

| ID | 이전 지적 | 현재 상태 | 현재 근거 | 수리 커밋·PR |
|---|---|:---:|---|---|
| FR-C01 | A1-29~31의 리에종·엘리종·강세·음절 체계 오류 | **부분** | 파일은 전면 교체됐으나 `a1_pronunciation.js:109-111,168,180-181,289,410-414,471-474,552-555`에 확정 오류·내부 충돌 잔존 | `8466670` [#586](https://github.com/wonchance-art/manabi/pull/586), 후속 `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-C02 | `noix`를 견과류 전체로 번역한 안전 의미 오류 | **수리됨** | `scene_travel.js:1319-1531`이 `fruits à coque`로 통일되고 `:1330`에 `noix=호두` 구분 명시 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-I01 | `Je n'ai`를 `[ʒə ne]`로 표기 | **수리됨** | 현재 `[ʒə nɛ]`; `[ʒə ne]` 잔존 0건. 문형 8개도 후속 소탕 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591), `1bf255c` [#595](https://github.com/wonchance-art/manabi/pull/595) |
| FR-I02 | `quatre-vingts euros`의 `[z]` 누락 | **수리됨** | `grammar/a1.js:894`가 `[katʁəvɛ̃z øʁo]` | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-I03 | `pas + 모음` 선택 리에종을 일상 발음으로 고정 | **수리됨** | 장면과 문형 16개가 무리에종 기본형으로 바뀌고 `bunkei/a1.js:261`만 선택 변이로 설명 | `1bf255c` [#595](https://github.com/wonchance-art/manabi/pull/595) |
| FR-I04 | avoir 과거분사는 변하지 않는다고 단정 | **수리됨** | `grammar/a2.js:20-22`에 선행 직접목적어 일치 예외와 `mangée` 예시 추가 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I05 | 양방향 조동사 동사의 타동 용법 누락 | **수리됨** | `grammar/a2.js:121-123`에 목적어가 있으면 avoir를 쓰는 다섯 동사와 예시 추가 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I06 | 대명동사 과거분사가 항상 주어 일치하는 인상 | **수리됨** | `grammar/a2.js:157-162`에 간접목적·후행 직접목적어 무일치 예시 추가 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I07 | 부정·의문 `penser/croire` 뒤 접속법을 절대화 | **수리됨** | `grammar/b2.js:56-68`이 접속법을 기본값으로 두되 확신에 따른 직설법을 명시 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I08 | `il semble`/`il me semble`을 기계적으로 양분 | **수리됨** | `grammar/b2.js:801-818`이 대표 경향 표와 확신도에 따른 변이를 함께 제시 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I09 | 대문자 악상을 생략해도 된다는 인상 | **수리됨** | `grammar/a0.js:54`가 현대 표준 `École`을 명시 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-I10 | /ʁ/ 대신 한국어 [h]를 쓰는 것을 목표처럼 단정 | **수리됨** | `grammar/a0.js:174-178`이 [h]를 임시 근사로 제한하고 [ʁ] 조음을 목표로 명시 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |

### 이전 평가의 나머지 중요 축

| 이전 지적 | 현재 상태 | 근거·변화 |
|---|:---:|---|
| 선택 리에종 전반의 IPA 정책 | **부분** | `pas` 16개는 #595로 고쳤지만 `vais acheter [vɛz‿aʃte]`, `jamais allée [ʒamɛz‿ale]`, `est à [ɛt‿a]` 등 선택형 고정이 남음 |
| A1 선행 관계와 장면 연결 | **잔존** | 기존 order 1~31과 장면의 선행 문법 표지는 그대로. #587은 order 32~33 파일럿 2개 추가일 뿐 기존 관계를 이행하지 않음 |
| 설명 산문의 해요체 | **부분** | #593으로 91회 교정. 현재 비번역 산문 9회(`grammar` 1, `vocab` 어원 8) 잔존 |
| A레벨·여행 장면 IPA 79개 | **수리됨** | #608의 이야기 37개와 #610의 A1·확장·A2 42개가 현재 모두 존재 |
| IPA 필드 계약 | **부분** | 위 79개는 해결됐지만 뒤에 추가된 `a1_sandwich_pilot.js` 직접 예문 6개에는 IPA가 없음 |
| `fr` 필드 안 한국어 역할명 | **잔존** | `scene_emergency`와 `scene_travel` 이야기의 `fr` 객체 16개에 역할명이 남음 |
| A1 `a0-*` slug 3개 | **잔존** | `a1.js:392,456,933`의 `a0-06-gender`, `a0-07-articles`, `a0-08-survival` 유지 |
| 어휘 과밀·합자 철자 | **잔존** | 프랑스어 어휘 변경 커밋 없음. `moeurs`, `main-d'oeuvre`, `noeud`가 그대로 남음 |
| 분실·환승·수하물 자연성 | **부분** | 예약명의 `au nom indiqué`는 개선됐지만 `reçu de bagage`, `Quelle est sa description ?`, `Où est la correspondance...` 잔존 |

따라서 이전 ID 기준으로는 **수리됨 11, 부분 1(FR-C01)**이다. 다만 ID 밖의
교차 축과 이후 추가 콘텐츠까지 포함하면 “중요 문제 전량 해소”로 볼 수 없다.

## 4. 신규 발견 문제

### FR-R2-C01 — 활성 A1 파일럿의 무조건적 아스피린 복용 지시

| 위치 | 현재 내용 | 판정 |
|---|---|---|
| `grammar/a1_sandwich_pilot.js:15,19-22,207-210` | 두 챕터를 `PILOT_DRAFT`로 표시 | 상태 이름은 draft지만 노출 차단 근거가 없음 |
| `french/index.js:118` | `...grammarA1SandwichPilot`을 A1 배열에 직접 spread | 실제 활성 레지스트리에 포함 |
| `grammar/a1_sandwich_pilot.js:232,246,252,289-291,322` | `Il faut prendre de l'aspirine trois fois par jour.` 반복 | 제형·용량·나이·체중·금기 확인 없이 “하루 세 번 먹어야 한다”는 의료 지시 |
| `grammar/a1_sandwich_pilot.js:37-40,225-228` | 오디오는 placeholder | 파일럿 상태와 별개로 텍스트 지시는 학습자에게 노출 가능 |

프랑스 공공 의약품 데이터는 아스피린 용량이 제형과 소아 체중에 따라 달라지고,
금기·상호작용 확인이 필요하다고 안내한다. Ameli도 임신, 연령, 궤양·출혈·신장·간
질환 등 여러 제한을 두고 자가복용 전 약사·의료진 확인을 요구한다.
([공공 의약품 DB](https://base-donnees-publique.medicaments.gouv.fr/medicament/65265765/extrait),
[Ameli AINS 안전 사용](https://www.ameli.fr/assure/sante/medicaments/utiliser-recycler-medicaments/utiliser-anti-inflammatoires))

언어 예문이라도 `Il faut`로 특정 복용 빈도를 보편 지시하면 안전 의미가 된다.
이 콘텐츠는 이전 평가 뒤 `ddb2af0` [#587](https://github.com/wonchance-art/manabi/pull/587)에서
추가됐으므로 신규 Critical이다.

### FR-R2-C02 — 발음 재작성본의 확정 오류와 내부 충돌

이 항목은 새 파일에서 생긴 문제이면서 동시에 FR-C01이 완전히 수리되지 않았다는
근거다.

| 위치 | 현재 내용 | 확정 문제 |
|---|---|---|
| `a1_pronunciation.js:41-44,104-130` | `petit ami`를 처음에는 선택, 뒤에서는 사실상 의무로 설명; `très intelligent`도 의무·선택이 충돌 | 같은 챕터 안 분류가 일관되지 않음 |
| `:165-169` | 자음으로 시작하는 `bon chat`에 `[bɔ̃‿ʃa]` 선택 리에종 허용 | 리에종은 다음 단어가 모음 또는 무음 h로 시작할 때의 현상이라 `chat` 앞에는 성립하지 않음 |
| `:174-181` | d는 현대에 [d]가 주류, `neuf ans`는 [f]가 주류라고 설명 | OQLF는 리에종의 d를 [t]로 설명하고, 공인 사전은 `neuf ans`의 f가 [v]로 실현됨을 명시 |
| `:285-292` | `h aspiré`를 “사실은 음성”이라고 설명 | 현대 프랑스어에서는 보통 소리가 없고 엘리종·리에종을 막는 기능이 핵심 |
| `:410-414,471-474` | `adorable`을 4음절로 세고 `[bl]`을 마지막 음절로 분리 | 현재 제시한 IPA `[adɔʁabl]` 자체에도 모음 핵이 3개뿐이며 `[bl]`은 독립 음절이 아님 |
| `:552-555` | `Photographe [fo-to-gra-af]`를 4음절로 제시 | 공인 전사 `[fɔtɔgʁaf]`는 3음절이고 `gra-af` 분절은 성립하지 않음 |

OQLF는 의무·선택·금지 리에종과 음가를 통사 환경별로 구분하며, 현대
`h aspiré`에는 흡기가 없다고 설명한다.
([의무 리에종](https://vitrinelinguistique.oqlf.gouv.qc.ca/23549/la-prononciation/liaisons/contextes-de-liaisons-obligatoires),
[선택 리에종](https://vitrinelinguistique.oqlf.gouv.qc.ca/23550/la-prononciation/liaisons/contextes-de-liaisons-facultatives),
[리에종 음가](https://vitrinelinguistique.oqlf.gouv.qc.ca/23545/la-prononciation/liaisons/changements-phoniques-dans-les-liaisons),
[`h aspiré`](https://vitrinelinguistique.oqlf.gouv.qc.ca/22203/la-prononciation/prononciation-de-certaines-lettres/la-prononciation-du-h-aspire)).
Académie française는
[`neuf ans`의 [v]](https://www.dictionnaire-academie.fr/article/A9N0333)를,
CNRTL은
[`adorable [adɔʁabl]`](https://www.cnrtl.fr/definition/adorable)과
[`photographe [fɔtɔgʁaf]`](https://www.cnrtl.fr/definition/photographe)를 제시한다.

### FR-R2-I01 — draft 상태·IPA 계약을 자동 검사가 잡지 못함

`a1_sandwich_pilot.js`의 직접 예문 6개(`:96-111,287-303`)는 모두 IPA가 없다.
그런데 `french/index.js:118`에서 활성 등록되고, 콘텐츠 lint 결과는
`138 active + 0 draft modules, 0 errors, 0 warnings`다. 즉 챕터의
`PILOT_DRAFT` 상태도, 활성 A1 직접 예문의 IPA 누락도 현재 lint 계약에는
반영되지 않는다. 구조상 Important이며, 의료 지시의 노출을 막지 못한 원인이기도
하다.

그 밖의 새 후보는 확정 근거가 부족해 등급 지적으로 올리지 않았다.

## 5. 평가축별 재판정

### 언어 정확성 — D 유지

FR-C02와 FR-I01~10의 교정은 실질적이다. 특히 과거분사 일치와 법 선택 설명은
이제 예외와 기본 경향을 함께 보여 준다. 하지만 발음 입문은 A1 전체의 읽기 기준이고,
그 재작성본에 음절 수와 리에종의 생산 규칙 오류가 남았다. 여기에 신규 의료 안전
문장이 더해져 D를 해제할 수 없다.

### 커리큘럼 정합 — C 유지

샌드위치 파일럿은 실전 선노출→어휘→패턴→재노출→연습 구조를 시험한다는 점은
좋다. 그러나 기존 장면의 명령법·복합과거·대명동사·조건법 선행 사용에는
`prerequisites`나 후속 문법 연결이 여전히 없다. 새 파일럿도 조건법
`voudrais`를 order 32에서 처음 분석하면서, draft 상태인 채 활성 레지스트리에
들어간다.

### 한국어 설명 — C에서 B

#593의 문맥별 수정은 효과가 컸다. 이전과 같은 정규식으로 번역 `ko`를 제외하면
합쇼체는 91회에서 9회로 감소했다. 잔존은 `grammar/c2.js`의 note 1회와
`vocab/b1.js`, `vocab/b2.js` 어원 8회다. 핵심 이해를 막지는 않지만 “완전 통일”은
아니므로 A는 아니다.

### 예문 자연성 — B- 유지

`fruits à coque`, `au nom indiqué`, 왕복표의 날짜 의미처럼 명백한 대응 오류는
개선됐다. 반면 `reçu de bagage`, `Quelle est sa description ?`,
`Où est la correspondance pour Bordeaux ?` 등 이전 창구 표본은 그대로다.
대부분 이해 가능하나 실제 우선 표현의 자연화가 끝나지 않았다.

### 범위·분량 — A 유지

80개 문법 챕터, 588개 문형, 4,076개 어휘의 폭과 필수 필드 기반은 강점이다.
다만 A0 100, A1 377, A2 634, B1 868, B2 1,129, C1 633, C2 334개의 실질 어휘를
핵심·확장·수용으로 나누지 않은 문제는 커리큘럼 축의 감점으로 유지한다.

## 6. 영향 챕터·팩 재판정

전체 80챕터 표를 반복하지 않고, 이전 등급이 바뀌었거나 현재 Critical/Important와
직접 연결된 항목만 재판정한다.

| 챕터·팩 | 이전 | 현재 | 판정 |
|---|:---:|:---:|---|
| A0-1 `a0-02-alphabet` | B | A | 대문자 악상 설명 교정 |
| A0-3 `a0-04-consonants` | B | B | [h]를 임시 근사로 제한했으나 한국어 근사 중심 설명은 보조 수준 유지 |
| A1-4 `a1-04-negation` | B | A | `Je n'ai` IPA 교정 |
| A1-12 `a1-10-numbers-time` | B | A | 80유로 의무 리에종 교정 |
| A1-28 `a1-28-scene-restaurant-allergy-payment` | D | B | 알레르겐 범주 안전 오류 해소; 선행 관계는 남음 |
| A1-29 `a1-29-liaison` | D | D | 전면 교체됐지만 리에종 분류·음가 오류와 내부 충돌 잔존 |
| A1-30 `a1-30-elision` | D | C | `l'école`, `s'il`, `d'habitude`는 개선; `h aspiré` 음성 설명 등 중요 오류 잔존 |
| A1-31 `a1-31-rhythm-stress` | D | D | `adorable`, `photographe` 음절 수와 리듬 그룹 설명 재검수 필요 |
| A1-32~33 샌드위치 파일럿 | 신규 | D | draft 활성 노출, 의료 지시 Critical, 직접 예문 IPA 0/6 |
| A2-1 `a2-01-passe-compose-avoir` | C | B | 선행 직접목적어 일치 예외 보완; 정밀 규칙은 후속 연결 필요 |
| A2-2 `a2-02-passe-compose-etre` | C | B | 양방향 조동사 용법 보완 |
| A2-4 `a2-04-pronominal-verbs` | C | B | 무일치 예외 보완 |
| B2-1 `b2-01-subjonctif-advanced` | B | A- | `penser/croire`의 확신도 변이 보완 |
| B2-10 `b2-10-impersonal-formal` | B | B | 대표 경향과 예외는 병기됐으나 표·pitfall의 이분법 표현은 다듬을 여지 |
| `bunkei/a1.js` | C | C | `pas`는 교정됐지만 선택 리에종 고정 IPA가 남음 |
| `bunkei/a2.js` | B- | B- | 같은 선택 리에종 정책 잔존 |
| `bunkei/b1.js` | B | B | `pas` 교정, 기타 구조는 대체로 유지 |
| `bunkei/b2.js` | B | B | 격식·일상 레지스터 혼재가 남음 |

`c1`, `c2` 문형과 15개 어휘팩의 이전 판정은 해당 경로에 수리 커밋이 없고 현재
표본도 같아 유지한다. 확정 합자 오류 3종과 레벨별 과밀도 역시 잔존한다.

## 7. 종합 변화와 다음 합격선

### D → D의 의미

등급이 같다고 변화가 없었던 것은 아니다.

- FR-C02와 FR-I01~10, 총 11개 ID가 현재 코드에서 수리됐다.
- 설명 산문의 합쇼체는 91→9회로 90.1% 감소했다.
- 이전 지목 IPA 누락 79개는 79/79 채워졌다.
- 반대로 FR-C01은 “파일 교체”는 됐지만 내용 합격에는 실패했다.
- 이전 평가 뒤 추가된 파일럿에서 새로운 안전 Critical이 생겼다.

따라서 이번 D는 이전 문제를 그대로 방치한 D가 아니라, **다수 수리 뒤에도
Critical 두 축이 남아 있는 D**다.

### D 해제 최소 조건

1. A1-29~31을 음운 전공자 또는 검증된 FLE 기준으로 다시 감수하고, 이 문서의
   확정 반례를 포함해 리에종·음절·`h aspiré` 오류를 0건으로 만든다.
2. 언어 예문의 의료 행위를 특정 용량·빈도로 지시하지 않도록 안전 검수하고,
   draft 챕터가 활성 레지스트리에 들어가지 않는 계약을 만든다.
3. `PILOT_DRAFT` 인식, 활성 A레벨 직접 예문 IPA, 언어 필드 순도를 lint에
   포함한다.
4. 선택 리에종은 기본 구어형과 격식 변이를 구분하고 한 IPA만 정답처럼 고정하지
   않는다.
5. A1 장면 선행 문법을 고정구 표지나 `prerequisites`/`grammarRefs`로 연결한다.
6. 잔존 합쇼체 9회, 합자 3종, `fr` 역할명 16개를 문맥 검수한다.

이 조건에서 Critical이 0건이면 C 이상, 중요 구조 문제까지 해소하면 B 이상으로
다시 평가할 수 있다.

## 8. 검증과 근거

### 병합 근거

| 범위 | 병합 커밋 | PR |
|---|---|---|
| 발음 3챕터 재작성 | `84666706fc5665af184b2f6ade9e86808c6ab805` | [#586](https://github.com/wonchance-art/manabi/pull/586) |
| A1 샌드위치 파일럿 | `ddb2af0b785148cf0292590bee03947d48fe89a2` | [#587](https://github.com/wonchance-art/manabi/pull/587) |
| FR-C02·FR-I01/02/09/10 | `d9d70110300acd157089b85d2a5678b68b70c281` | [#591](https://github.com/wonchance-art/manabi/pull/591) |
| 해요체 정리 | `48402563445d818f83d03d9501be30270388c4a7` | [#593](https://github.com/wonchance-art/manabi/pull/593) |
| `pas + 모음` 선택 리에종 | `1bf255c139645b80b0dfa59e172fd0f5ff853b5a` | [#595](https://github.com/wonchance-art/manabi/pull/595) |
| FR-I04~08 | `f48501674bc5b9108386f473772cc11cf5464dba` | [#606](https://github.com/wonchance-art/manabi/pull/606) |
| 여행 장면 IPA 37개 | `39bbb7f059fbbc5f7396d4bb0e757d4ab4ccc9df` | [#608](https://github.com/wonchance-art/manabi/pull/608) |
| A레벨 IPA 42개 | `6aa639547a37b15b62119ba2dfecadd6aa38b389` | [#610](https://github.com/wonchance-art/manabi/pull/610) |

### 로컬 검증

공식 nvm Node `v22.23.1`에서 실행했다.

| 검증 | 결과 |
|---|---|
| 변경 범위 | `docs/review-french-track-r2.md` 신규 1파일, `src/content/french/` 변경 0 |
| `node scripts/lint-content.mjs` | 통과 — 138 active, 0 errors, 0 warnings |
| `npm test` | exit 0 — 249/249 파일, 2,459/2,459 테스트 통과, 79.87초 |
| `git diff --check` | 통과 |

콘텐츠 lint의 통과는 이번 보고서가 지적한 의미 오류와 draft 노출을 부정하지 않는다.
실제로 lint가 `0 draft modules`를 보고하는 동시에
`a1_sandwich_pilot.js`의 `PILOT_DRAFT` 두 챕터가 활성 A1 배열에 포함돼 있다.
