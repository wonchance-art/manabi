# 프랑스어 트랙 순차 재평가 R3 (report-only)

> 평가일: 2026-07-25
>
> 기준 브랜치·커밋: `origin/main`
> (`b76d9fb0b6fb3d0c1fd9ca6316d2b26420606462`)
>
> 이전 평가: `docs/review-french-track-r2.md`
> (`3de02f3e7cb18b82e0a7099181e40b6b0dbf5e5e` 기준)
>
> 대상: `src/content/french/` 전체
>
> 변경 원칙: 콘텐츠 파일은 수정하지 않고 이 재평가 문서만 작성한다.

## 1. 결론과 재등급

### 종합 등급: D → C

R2의 D 유지 원인이던 두 Critical 축은 현재 해제됐다.

1. PR #617의 발음 목표 7건은 현재 객체에 모두 반영됐다. `d → [t]`,
   `neuf ans/heures`의 `[v]`, 현대 `h aspiré`의 무음성, `adorable`·
   `photographe`의 3음절, `très`·`et`의 리에종 분류, `bon chat` 반례가
   수리됐다.
2. 같은 PR의 의료 안전 프레임은 약 이름·복용량이 표현 학습용 연출이며
   실복용은 약사·의사의 개별 안내를 따라야 한다고 선노출과 패턴 본문 두 곳에
   명시한다. 선노출 프레임은 실제 `ReferenceChapterPage` 렌더 경로에도
   연결돼 R2의 “무조건적 일반 복용 지시” 판정은 더 유지하지 않는다.

또한 #630의 A1 slug 정합, #633의 `fr` 대화 필드 순도, #637의 A1
order·선행 관계·고정구 메타가 R2의 구조 잔여를 실질적으로 줄였다.

그러나 B로 올릴 수는 없다. 발음 입문 안에서 `petit ami`를 선택과 사실상
의무로 동시에 분류하는 R2 잔여가 남았고, `et enfant`의 표준 모음을 `[ɛ]`로
두 번 적은 확정 오류를 새로 확인했다. 활성 A1 파일럿의 직접 예문 IPA 6건과
`PILOT_DRAFT`를 인식하지 못하는 lint 공백, 선택 리에종 고정 IPA, 어휘 합자와
자연성 잔여도 그대로다. 따라서 “Critical은 0이지만 중요 교정이 남아 제한적
사용만 가능”한 C가 현재 상태에 맞다.

| 평가축 | R2 | R3 | 변화 근거 |
|---|:---:|:---:|---|
| 언어 정확성 | D | C | #617의 발음 7건·의료 안전 Critical 해제; `petit ami` 자기충돌·`et` 표준 IPA·선택 리에종 정책은 Important로 잔존 |
| 커리큘럼 정합 | C | B- | #637로 A1 1~33 연번, 장면 8개·파일럿 2개 선행 메타, 장면 고정구 표지 연결; 파일럿 활성 draft·IPA 계약은 잔존 |
| 한국어 설명 | B | B | 비번역 산문 합쇼체 9회로 변화 없음 |
| 예문 자연성 | B- | B- | #633은 구조 이행이며 문구 교정이 아님; 이전 창구 표본 잔존 |
| 범위·분량 | A | A | 80챕터·588문형·4,076 원시 어휘의 폭 유지 |

등급 기준은 R2와 같은 배포 가능성 루브릭을 그대로 사용한다.

| 등급 | 기준 |
|:---:|---|
| A | 확정 Critical/Important가 없고 현재 상태로 배포 가능 |
| B | 핵심 학습을 해치지 않는 경미한 교정 뒤 배포 가능 |
| C | 중요 교정이 남아 제한적 사용만 가능 |
| D | 핵심 규칙 또는 안전 의미의 재검수 전 배포 보류 |
| E | 여러 레벨의 핵심 체계가 광범위하게 잘못되어 대규모 재작성 필요 |
| F | 데이터 신뢰성이나 안전성이 무너져 학습 자료로 사용할 수 없음 |

`+/-`는 같은 기본 등급 안의 상대적 위치만 나타낸다. 종합 등급은 가장 심각한
현재 위험을 우선한다.

## 2. 재평가 범위와 방법

R2 기준과 현재 `origin/main` 사이 프랑스어 변경은 7파일,
191행 추가·318행 삭제다. PR 본문의 완료 주장만 받아들이지 않고 현재 객체,
렌더 소비처, lint 분류와 병합 ancestry를 다시 확인했다.

| 영역 | R3 전수 실측 |
|---|---:|
| 프랑스어 소스 | 34파일, 52,486행 |
| 문법 | 12모듈, 80챕터, 330섹션, 예문 컨테이너 891개 |
| 문형(`bunkei`) | 6팩, 74테마, 588항목 |
| 어휘 | 15팩, 131테마, 원시 항목 4,076개 |
| A0~A2 직접 예문 컨테이너 | 555개 |
| A0~A2 프랑스어 발화 단위 | 603개(대화 구조 64라인 포함), IPA 597/603 |
| 비번역 한국어 산문의 합쇼체 | 9회 |
| 한국어가 들어간 `fr` 객체 | 0개 |
| A1 order·메타 | 33개, order 1~33 유일·연번; prerequisites 10개, formulaic 8개 |

R2의 555개 직접 예문 수는 대화가 한 `fr` 문자열이던 모델의 컨테이너 수다.
#633 뒤에는 16개 대화 컨테이너가 64개 발화 라인으로 구조화됐으므로 IPA는
발화 단위로 재계수했다. 누락은 R2와 같은 파일럿 직접 예문 6개뿐이다.

검사는 다음을 포함한다.

1. R2의 Critical, Important, 교차 축 잔여와 이월 항목을 현재 행에서 전건
   재확인했다.
2. PR #616~637의 상태·병합 커밋·변경 파일을 조회하고, 22개 병합 커밋이
   모두 현재 `origin/main`의 ancestor인지 검증했다.
3. 프랑스어에 직접 영향을 준 #617, #630, #633, #637과 선행 RFC·인프라인
   #628, #629, #631, #632, #634, #635를 현재 소비처까지 대조했다.
4. 12개 문법 모듈, 6개 문형팩, 15개 어휘팩을 Node 22로 import해 수량,
   IPA, 대화 언어 필드, A1 order·prerequisites 참조를 재계수했다.
5. 리에종과 `et`의 표준 발음은 OQLF와 Académie française의 현재 설명을
   대조했다. 확정되지 않은 후보는 신규 지적으로 올리지 않았다.
6. 콘텐츠 lint, 전체 Vitest와 timeout 3파일의 단독 재실행,
   `git diff --check`를 실행했다.

## 3. R2 잔여·이월 항목 전건의 현재 상태

### 3.1 이전 ID와 Critical

| ID | R2 상태 | R3 상태 | 현재 근거 | 수리·확인 커밋/PR |
|---|:---:|:---:|---|---|
| FR-C01 | 부분 | **부분·Important 잔존** | #617 목표 7건은 반영. 그러나 `a1_pronunciation.js:41-44`는 `petit ami`를 선택으로, `:109,115-118`은 사실상 의무로 분류 | `f5525b9` [#617](https://github.com/wonchance-art/manabi/pull/617) |
| FR-C02 | 수리됨 | **수리 유지** | `fruits à coque`와 `noix=호두` 구분 유지; 이후 회귀 없음 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-I01 | 수리됨 | **수리 유지** | `[ʒə ne]` 잔존 0; `[ʒə nɛ]` 유지 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591), `1bf255c` [#595](https://github.com/wonchance-art/manabi/pull/595) |
| FR-I02 | 수리됨 | **수리 유지** | `quatre-vingts euros` `[z]` 유지 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-I03 | 수리됨 | **수리 유지** | `pas + 모음` 16개 무리에종 기본형 유지 | `1bf255c` [#595](https://github.com/wonchance-art/manabi/pull/595) |
| FR-I04 | 수리됨 | **수리 유지** | avoir 과거분사 선행 직접목적어 일치 예외 유지 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I05 | 수리됨 | **수리 유지** | 양방향 조동사 동사의 타동 용법 유지 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I06 | 수리됨 | **수리 유지** | 대명동사 간접목적·후행 직접목적어 무일치 예시 유지 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I07 | 수리됨 | **수리 유지** | `penser/croire`의 확신도에 따른 직설법 변이 유지 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I08 | 수리됨 | **수리 유지** | `il semble`/`il me semble`의 경향·변이 병기 유지 | `f485016` [#606](https://github.com/wonchance-art/manabi/pull/606) |
| FR-I09 | 수리됨 | **수리 유지** | 현대 표준 대문자 악상 `École` 유지 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-I10 | 수리됨 | **수리 유지** | [h]를 임시 근사로 제한하고 [ʁ] 목표 유지 | `d9d7011` [#591](https://github.com/wonchance-art/manabi/pull/591) |
| FR-R2-C01 | Critical | **수리됨** | `a1_sandwich_pilot.js:224-225,281-284`에 연출·전문가 안내 프레임, `ReferenceChapterPage.jsx:365-367`에서 선노출 렌더 확인 | `f5525b9` [#617](https://github.com/wonchance-art/manabi/pull/617) |
| FR-R2-C02 | Critical | **목표 7/7 수리, 상위 FR-C01 부분** | d·neuf·h aspiré·adorable·photographe·très/et 분류·bon chat 목표 수정 반영. 별도 `petit ami` 충돌과 신규 `et` IPA는 남음 | `f5525b9` [#617](https://github.com/wonchance-art/manabi/pull/617) |
| FR-R2-I01 | Important | **잔존** | 파일럿 직접 예문 IPA 6건 누락. `PILOT_DRAFT`는 활성 A1에 spread되고 기본 lint는 `138 active + 0 draft` | 정책 `ad21a64` [#634](https://github.com/wonchance-art/manabi/pull/634), 구현 없음 |

의료 예문의 특정 복용 빈도 문장 자체는 남아 있지만, 학습자가 먼저 보는 프레임과
패턴 본문이 이를 실제 복용 기준이 아닌 창작 연출로 한정한다. 따라서 R2의 안전
Critical은 해제한다. 임상 권고문으로 재사용할 수 없다는 한계는 남지만 현재
콘텐츠가 일반 복용을 권하는 것으로 판정하지는 않는다.

### 3.2 R2 교차 축 잔여

| R2 이월 항목 | R3 상태 | 현재 근거·변화 |
|---|:---:|---|
| 선택 리에종 전반의 IPA 정책 | **잔존** | `vais acheter [vɛz‿aʃte]`, `jamais allée [ʒamɛz‿ale]`, `est à [ɛt‿a]`가 한 변이만 정답처럼 고정됨 |
| A1 선행 관계와 장면 연결 | **수리됨** | #637로 1~33 연번, 장면 8개 `formulaic`, 장면 8개+파일럿 2개 `prerequisites`; 참조 전건 유효 |
| 설명 산문의 해요체 | **부분 유지** | 비번역 산문의 합쇼체 9회(`grammar/c2` note 1, `vocab` etym 8)로 변화 없음 |
| A레벨·여행 장면 IPA 79개 | **수리 유지** | 기존 79/79 유지; #633의 대화 64라인도 전부 IPA 존재 |
| IPA 필드 계약 | **부분 유지** | 파일럿 직접 예문 6개만 누락; #634 정책은 A0~A2 필수를 명시했으나 lint 구현은 없음 |
| `fr` 필드 안 한국어 역할명 | **수리됨** | #633이 16블록을 `dialogue`로 이행; 64라인·IPA 64라인, 한국어 포함 `fr` 객체 0 |
| A1 `a0-*` slug 3개 | **수리됨** | #630에서 `a1-11-gender`, `a1-12-articles`, `a1-13-survival`로 이행하고 alias 등록 |
| 어휘 과밀·합자 철자 | **잔존** | 프랑스어 어휘 수정 없음; `moeurs`, `main-d'oeuvre`, `noeud` 유지 |
| 분실·환승·수하물 자연성 | **잔존** | #633은 구조만 바꿈. `reçu de bagage`, `Quelle est sa description ?`, `Où est la correspondance...` 문구 유지 |
| 활성 draft 상태 | **잔존** | 두 파일럿 모두 `status: PILOT_DRAFT`지만 `french/index.js:118` 활성 A1 레지스트리에 포함; status 기반 노출 차단 없음 |

## 4. PR #616~637 반영 확인

현재 `origin/main`은 #637 병합 커밋 자체이고, 아래 22개 병합 커밋 모두에 대해
`git merge-base --is-ancestor <merge> origin/main`이 성공했다.

| PR | 병합 커밋 | 프랑스어 R3 관련성·반영 판정 |
|---|---|---|
| [#616](https://github.com/wonchance-art/manabi/pull/616) | `192d4d2` | 영어 전용, 프랑스어 영향 없음 |
| [#617](https://github.com/wonchance-art/manabi/pull/617) | `f5525b9` | 발음 목표 7건·의료 안전 프레임 반영 |
| [#618](https://github.com/wonchance-art/manabi/pull/618) | `6273940` | 일본어 R2 문서 전용 |
| [#619](https://github.com/wonchance-art/manabi/pull/619) | `9223517` | 일본어 콘텐츠 전용 |
| [#620](https://github.com/wonchance-art/manabi/pull/620) | `fe14d4b` | 한국어 문체·중국어 병음 RFC, 프랑스어 직접 영향 없음 |
| [#621](https://github.com/wonchance-art/manabi/pull/621)~[#626](https://github.com/wonchance-art/manabi/pull/626) | `1bcc02b`·`27b7d8c`·`e2bb0b4`·`3736650`·`c1b7520`·`0bdd00a` | 중국어 전용, 프랑스어 영향 없음 |
| [#627](https://github.com/wonchance-art/manabi/pull/627) | `1469138` | 보드 전용 |
| [#628](https://github.com/wonchance-art/manabi/pull/628) | `f6d5f46` | 대화 필드·slug 이행 RFC, #630·#633의 설계 근거 |
| [#629](https://github.com/wonchance-art/manabi/pull/629) | `782207d` | slug alias 진도 이행 인프라 |
| [#630](https://github.com/wonchance-art/manabi/pull/630) | `8b362c1` | 프랑스어 A1 slug 3건·참조·alias 반영 |
| [#631](https://github.com/wonchance-art/manabi/pull/631) | `387b83e` | 커리큘럼 선행 관계 RFC |
| [#632](https://github.com/wonchance-art/manabi/pull/632) | `e11466d` | 공용 dialogue 스키마·렌더 |
| [#633](https://github.com/wonchance-art/manabi/pull/633) | `6035017` | 프랑스어 대화 16블록·lint dialogue 분기 반영 |
| [#634](https://github.com/wonchance-art/manabi/pull/634) | `ad21a64` | A0~A2·장면·발음 IPA 필수 정책 확정; 파일럿 6건에는 아직 미이행 |
| [#635](https://github.com/wonchance-art/manabi/pull/635) | `a572560` | prerequisites·formulaic 스키마와 코스 지도 소비처 |
| [#636](https://github.com/wonchance-art/manabi/pull/636) | `80a6dd7` | 영어·중국어 전용 |
| [#637](https://github.com/wonchance-art/manabi/pull/637) | `b76d9fb` | 프랑스어 A1 order·선행·고정구 데이터 반영 |

관련 PR의 full merge SHA는 9절에 별도 고정한다.

## 5. 신규 발견 문제

### FR-R3-I01 — `et`의 표준 모음을 `[ɛ]`로 두 번 표기

| 위치 | 현재 내용 | 확정 근거 |
|---|---|---|
| `a1_pronunciation.js:47-50` | `et enfant [ɛ ɑ̃fɑ̃]` | 같은 파일 `:112`의 `et alors [e alɔʁ]`와 내부 충돌 |
| `a1_pronunciation.js:139-150` | 본문과 예문에서 다시 `[ɛ ɑ̃fɑ̃]` | Académie française는 접속사 `et`의 표준 발음을 원칙적으로 `é`, 즉 `[e]`로 설명 |

Académie française의
[`é`/`è` 발음 설명](https://www.dictionnaire-academie.fr/article/QDL070)은
접속사 `et`를 원칙적으로 `é`로, 단어 끝 `-et`를 `è`로 구분한다.
[`et` 사전 항목](https://www.dictionnaire-academie.fr/article/A9E2769)도
끝 `t`가 리에종에서도 발음되지 않는다고 명시한다. 지역·개인 변이는 존재할 수
있지만, 이 파일은 A1 표준 IPA를 가르치고 같은 챕터에서 `[e]`와 `[ɛ]`를
충돌시키므로 Important로 확정한다.

`petit ami` 문제는 신규 발견이 아니라 R2 FR-C01의 미해결분이다. OQLF의
[의무 리에종 설명](https://vitrinelinguistique.oqlf.gouv.qc.ca/23549/la-prononciation/liaisons/contextes-de-liaisons-obligatoires)은
명사 앞 형용사와 명사 사이 리에종을 의무로 분류한다. 그 밖의 새 후보는 확정
근거가 부족해 등급 지적으로 올리지 않았다.

## 6. 평가축별 재판정

### 언어 정확성 — D에서 C

#617의 핵심 수리는 실질적이다. R2가 확정한 음가·음절·`h aspiré` 오류 7건은
현재 목표 문자열에서 모두 사라졌고 의료 예문은 실제 복용 지시가 아니라는
가시적 프레임을 얻었다. 따라서 안전 또는 핵심 체계 전체의 재검수 전 배포 보류인
D는 해제한다.

다만 A1-29가 같은 `petit ami`를 선택과 사실상 의무로 동시에 가르치고,
`et enfant`의 표준 IPA가 두 번 틀린다. 선택 리에종을 한 IPA로 고정하는 문형
표본도 남아 있으므로 중요 교정이 필요한 C다.

### 커리큘럼 정합 — C에서 B-

#637은 생존(1)→발음(2~4)→코어 문법(5~17)→확장(18~23)→장면(24~31)→
파일럿(32~33)의 권장 흐름을 만든다. order 33개가 유일·연번이고, 장면 8개와
파일럿 2개의 선행 참조가 모두 같은 A1 정본 slug를 가리킨다. #635의 코스 지도
배지와 상세 도입도 이 메타를 소비한다. R2의 “선행 관계가 없다”는 판정은 해제한다.

감점은 두 파일럿의 상태 계약이다. `PILOT_DRAFT`가 노출을 막지 않고 직접 예문
IPA 6건이 A0~A2 필수 정책 밖에 놓여 있다. 핵심 31챕터의 흐름은 사용 가능하되
파일럿 출시 정합은 완결되지 않아 B-다.

### 한국어 설명 — B 유지

R2와 같은 비번역 산문 검사에서 합쇼체는 9회다. 해당 경로는 #616~637에서
수정되지 않았다. 핵심 이해를 막지는 않지만 전면 통일도 아니므로 B를 유지한다.

### 예문 자연성 — B- 유지

#633은 화자명·원어·IPA·번역을 구조화했지만 문장 집합을 보존한 이행이다.
`reçu de bagage`, `Quelle est sa description ?`,
`Où est la correspondance pour Bordeaux ?`가 그대로여서 R2의 자연성 판정을
올릴 새 근거가 없다.

### 범위·분량 — A 유지

A0~C2 80챕터, 문형 588항목, 원시 어휘 4,076항목의 폭은 유지된다. 어휘의
핵심·확장·수용 구분과 합자 철자 3종은 커리큘럼·정확성의 국소 감점이지
범위 자체를 낮출 근거는 아니다.

## 7. 영향 챕터·팩 재판정

| 챕터·팩 | R2 | R3 | 판정 |
|---|:---:|:---:|---|
| A1-29 `a1-29-liaison` | D | C | #617 7건 반영으로 Critical 해제; `petit ami` 분류 충돌과 `et` IPA Important 잔존 |
| A1-30 `a1-30-elision` | C | B | 현대 `h aspiré` 무음·차단 기능으로 정정 |
| A1-31 `a1-31-rhythm-stress` | D | B | `adorable`·`photographe` 3음절 수리; 별도 Critical 없음 |
| A1 장면 21~28 | 구조 C | B | order 24~31, `formulaic`, 유효 prerequisites와 코스 지도 소비 연결 |
| A1 파일럿 32~33 | D | C | 의료 Critical 해제·선행 추가; 활성 draft·IPA 0/6·placeholder 오디오 잔존 |
| `bunkei/a1.js` | C | C | slug 참조는 수리됐지만 `vais acheter` 선택 리에종 고정 IPA 잔존 |
| `bunkei/a2.js` | B- | B- | `jamais allée` 선택 리에종 고정 IPA 잔존 |
| `scene_emergency.js`·`scene_travel.js` | B- | B | `fr` 역할명 16블록 구조 이행·선행 메타 추가; 개별 자연성 표본은 남음 |
| 15개 어휘팩 | 기존 유지 | 기존 유지 | #616~637 프랑스어 어휘 변경 없음; 합자·과밀도 유지 |

나머지 챕터·팩은 R2 뒤 언어 내용 변경이 없고 현재 표본도 같아 R2 판정을 유지한다.

## 8. 종합 변화와 다음 합격선

### D → C의 의미

- #617 발음 목표 7/7이 현재 콘텐츠에 반영됐다.
- 의료 예문의 가시적 안전 프레임이 두 곳에 추가돼 안전 Critical을 해제했다.
- #630으로 A1 오레벨 slug 3건과 참조·진도 alias가 수리됐다.
- #633으로 16개 대화 블록이 64라인 구조로 이행돼 한국어 포함 `fr` 객체가
  16→0이 됐다.
- #637로 A1 33챕터의 권장 순서와 10개 선행 메타, 8개 고정구 표지가 생겼다.
- 반대로 R2의 `petit ami` 자기충돌과 파일럿 IPA/lint 공백은 남았고,
  `et` 표준 IPA 오류 1종을 신규 확정했다.

따라서 이번 C는 수리량만으로 올린 등급이 아니라, R2의 두 Critical이 현재
노출 의미에서 해제됐고 잔여 최고 심각도가 Important로 내려간 결과다.

### B 진입 최소 조건

1. A1-29의 `petit ami` 분류를 한 정책으로 통일하고 `et enfant`의 표준 IPA를
   같은 챕터 전체에서 일치시킨다.
2. `vais acheter`, `jamais allée`, `est à` 등 선택 리에종은 기본 구어형과
   격식 변이를 구분한다.
3. 파일럿 직접 예문 6개에 IPA를 채우고 A0~A2 필수 정책을 lint로 검증한다.
4. `status: PILOT_DRAFT`가 노출·lint·출시에서 의미를 갖도록 하거나 상태명을
   현재 활성 정책에 맞춘다.
5. 잔존 합쇼체 9회, 합자 3종과 자연성 표본을 문맥 검수한다.

1~4가 해소되고 새 Critical이 없으면 B 이상을 재평가할 수 있다.

## 9. 검증과 근거

### 관련 병합 근거

| 범위 | 병합 커밋 | PR |
|---|---|---|
| 발음 7건·의료 프레임 | `f5525b9ca5bc940e345197765f602ef03452c4c9` | [#617](https://github.com/wonchance-art/manabi/pull/617) |
| 대화·slug RFC | `f6d5f467a7f9315271de765f2c212b1b9be36d66` | [#628](https://github.com/wonchance-art/manabi/pull/628) |
| slug 진도 이행 인프라 | `782207d760972d4c075d0b86c096f0aefae46316` | [#629](https://github.com/wonchance-art/manabi/pull/629) |
| 프랑스어 A1 slug 이행 | `8b362c1a51d2c799ae4b140d5efd390e8a3fd212` | [#630](https://github.com/wonchance-art/manabi/pull/630) |
| 커리큘럼 선행 RFC | `387b83ea613ed970d214d5a553e0155223ce4cb4` | [#631](https://github.com/wonchance-art/manabi/pull/631) |
| dialogue 스키마·렌더 | `e11466dd17463a9c369d9f39959fcbd5db1daa6e` | [#632](https://github.com/wonchance-art/manabi/pull/632) |
| 프랑스어 대화 16블록 이행 | `603501712ba912eb93f1cbe5d8a36db1ec4293e7` | [#633](https://github.com/wonchance-art/manabi/pull/633) |
| IPA P2 정책 | `ad21a64cc84a0ee4b862fc64f043afde0cc3a99a` | [#634](https://github.com/wonchance-art/manabi/pull/634) |
| 커리큘럼 메타 소비처 | `a572560a92fd5244a0a53fec42273c7db4663c1a` | [#635](https://github.com/wonchance-art/manabi/pull/635) |
| 프랑스어 A1 순서·선행·고정구 | `b76d9fb0b6fb3d0c1fd9ca6316d2b26420606462` | [#637](https://github.com/wonchance-art/manabi/pull/637) |

### 로컬 검증

공식 nvm Node `v22.23.1`에서 실행했다.

| 검증 | 결과 |
|---|---|
| 변경 범위 | `docs/review-french-track-r3.md` 신규 1파일, `src/content/french/` 변경 0 |
| PR #616~637 ancestry | 22/22 `origin/main` ancestor |
| `node scripts/lint-content.mjs` | 통과 — 138 active, 0 draft, 0 errors, 0 warnings |
| `node scripts/lint-content.mjs --drafts` | 통과 — 138 active + 1 draft, 0 errors, 0 warnings; 프랑스어 `PILOT_DRAFT`는 draft로 분류되지 않음 |
| `npm test` | 247/250 파일, 2,480/2,483 테스트 통과; 변경 무관 전수 렌더·geo 3건 timeout |
| timeout 단독 재실행 | `cityRoadAutotile` 7/7, `districtSignsAudit24` 1/1, `seoulGeo` 9/9 모두 통과 |
| `git diff --check` | 통과 |

전체 Vitest의 세 실패는 assertion 차이가 아니라 각각 60초·30초·240초 timeout이었고,
동일 head에서 파일별 단독 재실행은 모두 green이었다. 이 보고서는 이를 전체
green으로 축약하지 않고 병렬 부하 timeout과 단독 재현 결과를 함께 기록한다.

콘텐츠 lint 통과 역시 의미 정확성을 보증하지 않는다. 현재 기본 lint가
`138 active + 0 draft`를 보고하는 동시에 두 `PILOT_DRAFT` 챕터는 활성 A1에
포함되고 직접 예문 IPA 6건이 빠져 있다는 점이 그 한계다.
