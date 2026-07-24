# 중국어 트랙 재평가 R3 (report-only)

**재평가일**: 2026-07-25

**현행 기준 커밋**: `b76d9fb0b6fb3d0c1fd9ca6316d2b26420606462` (`origin/main`)

**R2 기준 커밋**: `5edd1c49f0c610a8eb5f1f8777d7d6bcb9d1c09f`

**R2 보고서**: `docs/review-chinese-track-r2.md`
([PR #614](https://github.com/wonchance-art/manabi/pull/614),
merge `5a2fc89`)

**범위**: `src/content/chinese/{grammar,bunkei,vocab}` 전체와 R2 이후
[#616](https://github.com/wonchance-art/manabi/pull/616)~
[#637](https://github.com/wonchance-art/manabi/pull/637)의 현행 반영 상태

**변경 원칙**: 콘텐츠 원문·공유 코드·DB 수정 없음. 이 재평가 문서만 추가함.

## 1. 결론

### 종합 등급: B (R2 C)

R2의 C 상한을 만들었던 대량 이월 항목은 대부분 해소됐다. 정치·브랜드 6건은
[#617](https://github.com/wonchance-art/manabi/pull/617), 병음 표제 연서는
[#621](https://github.com/wonchance-art/manabi/pull/621), 예문 번역 해요체
3,757건은 [#622](https://github.com/wonchance-art/manabi/pull/622)~
[#625](https://github.com/wonchance-art/manabi/pull/625), 빈 `pos` 178건은
[#626](https://github.com/wonchance-art/manabi/pull/626), 확정 C급 예문 3건은
[#636](https://github.com/wonchance-art/manabi/pull/636)에 반영됐다. R2 이후
중국어 grammar·bunkei 변경은 없으므로 `了`·`被`와 문법 단정 수리도 그대로
유지된다. 새 Critical 언어 오류는 확인하지 못했다.

다만 A는 아니다. #621이 단어 내부 공백을 제거하면서 a·o·e로 시작하는 비첫
음절 앞에 필요한 격음부호(`'`)를 보충하지 않아 표제 병음 42건이
`第二 dìèr`, `可爱 kěài`, `档案 dàngàn`처럼 남았다. `档`의 `pos: "양사"`와
grammar 산문 설명의 비해요체 2건도 R2에서부터 잔존하며, 콘텐츠 lint는
`pos`의 존재·문자열 타입만 검사해 빈 문자열 회귀를 막지 못한다.

대량 정사법·문체·정책 백로그가 종결되고 핵심 문법은 안전하므로 C에서는
벗어난다. 반면 42건의 체계적 정사법 교정과 소수의 확정 잔여가 필요하므로
“경미한 교정 후 배포 가능”인 B로 재판정한다.

| 평가축 | R2 | R3 | 재판정 |
|---|---:|---:|---|
| 언어 정확성 | C | B- | 대량 연서와 확정 독음은 수리됐으나 #621 격음부호 누락 42건이 신규 확정 |
| 커리큘럼 정합 | B | B | 핵심 문법 수리 유지. #631·#635 인프라는 중국어 데이터 변경이 없어 등급 상승 근거로 세지 않음 |
| 한국어 설명 | C | B | 예문 3,757건 전환으로 대량 위반 해소. 산문 설명 비해요체 2건 잔존 |
| 예문 자연성 | B- | B | R2 확정 C급 예문 3건 수리. 새 확정 C급 표본은 찾지 못함 |
| 범위·분량 | A | A | 78챕터·511문형·6,884어휘 유지 |
| 구조·필드 | B | B | 빈 병음·빈 `pos` 0. `档` 품사, 격음부호 42건, 빈 `pos` fail-closed lint가 잔여 |

등급 기준과 축은 R2와 동일하다. `+/-`는 같은 문자 등급 안의 보조 표기이며
종합 판정의 문자 등급을 바꾸지 않는다.

| 등급 | 기준 |
|---|---|
| A | 현행 배포 가능. 확정 오류가 없거나 사소한 표현 개선만 필요 |
| B | 경미한 교정 후 배포 가능. 핵심 학습 규칙과 데이터 계약은 안전 |
| C | 중요 교정 필요. 대량 정사법·문체·정책 또는 일부 교육 품질 문제가 잔존 |
| D | 핵심 규칙 오개념 또는 대규모 발음 데이터 재검수 전 배포 보류 |
| E | 여러 핵심 단원에서 반복 오개념이 있어 광범위 재작성 필요 |
| F | 학습 자료로 사용할 수 없으며 구조·내용의 전면 재설계 필요 |

## 2. 재평가 범위·방법

공식 nvm Node `v22.23.1`에서 53개 모듈을 직접 import해 객체 전체를 재귀
순회했다. R2 기준과 현행 `origin/main` 사이의 중국어 diff, #616~637의
merge 커밋·변경 파일, R2의 잔여·이월 위치를 각각 대조했다. 자동 검사는
후보 검출과 개수 실측에만 사용했고, 신규 문제는 규범과 현행 소스에서
확정되는 경우만 올렸다.

| 영역 | R2 | R3 현행 |
|---|---:|---:|
| 중국어 소스 | 53파일, 23,955행 | 동일 |
| 문법 | 78챕터, 232섹션 | 동일 |
| 문형 | 6팩, 511항목 | 동일 |
| 어휘 | 30팩, 원시 항목 6,884개 | 동일 |
| 병음 필드 | 16,379개, 빈 값 0 | 동일 |
| `zh+pinyin+ko` 예문 객체 | 8,984개 | 동일 |
| HSK 3.0 표제 | 3,116개 | 동일 |
| 빈 `pos` | 179 | 0 |

현행 어휘 표제 중 공백이 있는 `pinyin`은 178건이고, HSK 3.0 6팩에는
42건이다. 이 수치는 이합사·구·성어처럼 RFC상 공백이 허용되는 항목까지
포함하므로 전부를 오류로 세지 않았다. 아래 신규 42건은 이 공백 후보와
별개의 집합으로, #621에서 공백을 없앤 경계에 격음부호가 빠진 확정 사례다.

### #616~637 반영 확인

| PR | merge 커밋 | 중국어 R3 영향 |
|---|---|---|
| [#616](https://github.com/wonchance-art/manabi/pull/616) | `192d4d2` | 영어 전용. 중국어 변경 0 |
| [#617](https://github.com/wonchance-art/manabi/pull/617) | `f5525b9` | 정치·지리 3건(`两岸/内地/大陆`)과 브랜드 3건(`联想/微博/奔驰`) 직접 수리 |
| [#618](https://github.com/wonchance-art/manabi/pull/618)·[#619](https://github.com/wonchance-art/manabi/pull/619) | `6273940`·`9223517` | 일본어 R2·후속. 중국어 변경 0 |
| [#620](https://github.com/wonchance-art/manabi/pull/620) | `fe14d4b` | 한국어 문체·중국어 병음 정사법 RFC 채택 |
| [#621](https://github.com/wonchance-art/manabi/pull/621) | `1bcc02b` | 표제 병음 연서 배치. PR 제목은 4,999건, commit은 25파일 4,998행 변경 |
| [#622](https://github.com/wonchance-art/manabi/pull/622)·[#623](https://github.com/wonchance-art/manabi/pull/623)·[#624](https://github.com/wonchance-art/manabi/pull/624)·[#625](https://github.com/wonchance-art/manabi/pull/625) | `27b7d8c`·`e2bb0b4`·`3736650`·`c1b7520` | 예문 번역 431+752+697+1,877 = 3,757건 해요체 전환 |
| [#626](https://github.com/wonchance-art/manabi/pull/626) | `0bdd00a` | 빈 `pos` 178건 전수 기입. 비어 있지 않던 `档: 양사`는 범위 밖으로 잔존 |
| [#627](https://github.com/wonchance-art/manabi/pull/627) | `1469138` | 보드 문서만 변경 |
| [#628](https://github.com/wonchance-art/manabi/pull/628) | `f6d5f46` | dialogue·slug RFC. 중국어 콘텐츠 변경 0 |
| [#629](https://github.com/wonchance-art/manabi/pull/629)·[#630](https://github.com/wonchance-art/manabi/pull/630) | `782207d`·`8b362c1` | slug 인프라·타 트랙 이행. 중국어 slug 변경 0 |
| [#631](https://github.com/wonchance-art/manabi/pull/631)·[#635](https://github.com/wonchance-art/manabi/pull/635) | `387b83e`·`a572560` | curriculum RFC·선택 메타 인프라. 중국어 grammar 데이터 변경 0 |
| [#632](https://github.com/wonchance-art/manabi/pull/632)·[#633](https://github.com/wonchance-art/manabi/pull/633) | `e11466d`·`6035017` | dialogue 스키마·렌더와 프랑스어 이행. 중국어 콘텐츠 변경 0 |
| [#634](https://github.com/wonchance-art/manabi/pull/634) | `ad21a64` | IPA 범위 정책. 중국어 pinyin 데이터와 무관 |
| [#636](https://github.com/wonchance-art/manabi/pull/636) | `80a6dd7` | 중국어 확정 C급 예문 3건 직접 수리 |
| [#637](https://github.com/wonchance-art/manabi/pull/637) | `b76d9fb` | 프랑스어 curriculum 데이터. 중국어 변경 0 |

R2 이후 중국어 콘텐츠를 직접 바꾼 merge 커밋은 #617, #621~626, #636의
8개다. 25개 vocab 파일에서 5,601 additions / 5,601 deletions이며,
grammar·bunkei 변경은 0이다.

## 3. R2 Critical 수리 유지 확인

| R2 이전 Critical | R3 현행 | 상태 | 근거 |
|---|---|---|---|
| ZH-C01 완료상·문장 끝 `了`, `没...了` 절대화 | 기능 분리·중첩 가능성·`我没钱了` 반례 유지 | 수리 유지 | `f1bf5c0`, [#596](https://github.com/wonchance-art/manabi/pull/596); R2 이후 grammar·bunkei diff 0 |
| ZH-C02 `被` 기타성분 필수·긍정 피동 회피 | 무보어·긍정 피동 반례 유지 | 수리 유지 | `f1bf5c0`, #596; R2 이후 grammar·bunkei diff 0 |
| ZH-I04~I09 문법 절대 단정 | 장소 `在`, 양태, 후치 `给`, 보어, `三人`의 예외·초점 설명 유지 | 수리 유지 | `a5fb3e6`, [#604](https://github.com/wonchance-art/manabi/pull/604) |

새 Critical 언어 오류와 수리 회귀는 확인하지 못했다.

## 4. R2 잔여·이월 항목 전 건의 현재 상태

| R2 잔여·이월 | R3 현행 실측 | 상태 | 커밋·PR 근거 |
|---|---|---|---|
| ZH-I03 HSK 3.0 병음 연서 2,559건 | #621의 대량 연서 반영. 현행 HSK 3.0 공백 표제 42건은 구·이합사·성어 후보라 일괄 오류 처리하지 않음 | 대량 수리됨 | `1bcc02b`, [#621](https://github.com/wonchance-art/manabi/pull/621), RFC `fe14d4b` |
| ZH-I10 빈 `pos` 179건 | #617에서 `微博→博客`와 함께 1건 감소, #626이 나머지 178건 기입. 현행 빈 값 0 | 수리됨(데이터) | `f5525b9`, #617; `0bdd00a`, [#626](https://github.com/wonchance-art/manabi/pull/626) |
| `档 dàng`의 `pos: "양사"` | `vocab/h6_hsk30.js:190`에 그대로. 현 예문 `换到二档`의 “기어 단수”는 명사 용법 | **잔존** | #626은 빈 문자열 178건만 대상으로 해 비어 있지 않은 오분류를 변경하지 않음 |
| 빈 `pos` 회귀 lint | 현 lint의 중국어 `pos`는 “필드 존재+문자열 타입”만 요구하고 비어 있지 않음은 요구하지 않음 | **잔존** | `scripts/lint-content.mjs`의 `vocabPresentStringFields`·`requirePresentStringFields`; #626은 데이터 파일만 변경 |
| grammar 설명문 비해요체 2건 | `grammar/h4.js:55` “갈립니다.”, `grammar/ot.js:105` “다릅니다” 그대로 | **잔존** | 두 줄 blame `3f71b39`; #622~625는 vocab 예문 번역만 변경 |
| 예문 번역 `-다/합니다` 3,845건 | 3,757건 해요체 전환. R2 계수 기준 잔여 88건은 공문·인사·기원·어미 인용 등 RFC 허용 레지스터로 보존 | 수리됨(계약 적용) | `27b7d8c`·`e2bb0b4`·`3736650`·`c1b7520`, [#622](https://github.com/wonchance-art/manabi/pull/622)~[#625](https://github.com/wonchance-art/manabi/pull/625), RFC #620 |
| 브랜드 직접 재현 3건 `联想/微博/奔驰` | 일반어 연상·블로그·질주 의미로 일반화 | 수리됨 | `f5525b9`, [#617](https://github.com/wonchance-art/manabi/pull/617) |
| 정치·지리 프레이밍 2건 `两岸/内地` | 강 양쪽 기슭·내륙 일반 지리로 한정. 후속에서 함께 찾은 `大陆`도 유럽 대륙 예문으로 일반화 | 수리됨 | `f5525b9`, #617 |
| 확정 C급 예문 3건 | `超` 비교항 평행화, `出入` 결합 자연화, `却是` 대조 구문 재작성 | 수리됨 | `80a6dd7`, [#636](https://github.com/wonchance-art/manabi/pull/636) |
| B 이상 합격선의 lint·전체 테스트 | content lint 0/0, 전체 Vitest green. 단, 위 빈 `pos` fail-closed 계약은 미완료 | 부분 | 현행 검증 결과와 #626 범위 대조 |

R2에서 이미 0이었던 병음 빈 값, 독립 얼화 `r`, `u:` 표기와 #598의 확정
독음·표제 의미 수리도 현행에서 회귀하지 않았다.

## 5. 신규 발견

### ZH-R3-I01 — #621 연서 경계의 격음부호 누락 42건

[GB/T 16159-2012 《汉语拼音正词法基本规则》](https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=5645BD8DB9D8D73053AD3A2397E15E74)은
단어를 연서할 때 a·o·e로 시작하는 비첫 음절 앞에 격음부호를 둔다.
#621은 “공백 외 문자 변이 0”을 무결성 기준으로 삼아, 기존 공백을 제거한
경계에 필요한 `'`를 새로 넣지 않았다. #621 직전 `fe14d4b`와 현행 객체를
대조해 “제거된 공백의 오른쪽 음절이 a/o/e로 시작하고 현행 경계에 공백·`'`가
모두 없는 경우”만 세면 21파일 42건이다.

| 파일 | 건수 | 현행 → 규범형 (현행 줄) |
|---|---:|---|
| `h1_hsk30.js` | 1 | 第二 `dìèr→dì'èr` (L46) |
| `h2_hsk30.js` | 3 | 平安 `píngān→píng'ān` (L187)<br>晚安 `wǎnān→wǎn'ān` (L246)<br>一路平安 `yīlù píngān→yīlù píng'ān` (L284) |
| `h3_hsk.js` | 1 | 可爱 `kěài→kě'ài` (L153) |
| `h3_hsk30.js` | 1 | 保安 `bǎoān→bǎo'ān` (L16) |
| `h4_hsk30.js` | 3 | 黑暗 `hēiàn→hēi'àn` (L160)<br>图案 `túàn→tú'àn` (L343)<br>喜爱 `xǐài→xǐ'ài` (L365) |
| `h4_hsk_a.js` | 1 | 答案 `dáàn→dá'àn` (L87) |
| `h4_hsk_b.js` | 1 | 偶尔 `ǒuěr→ǒu'ěr` (L175) |
| `h5_hsk30.js` | 3 | 两岸 `liǎngàn→liǎng'àn` (L340)<br>治安 `zhìān→zhì'ān` (L729)<br>阻碍 `zǔài→zǔ'ài` (L763) |
| `h5_hsk_a.js` | 1 | 不安 `bùān→bù'ān` (L158) |
| `h5_hsk_b.js` | 2 | 妨碍 `fángài→fáng'ài` (L30)<br>反而 `fǎnér→fǎn'ér` (L198) |
| `h5_hsk_c.js` | 2 | 敬爱 `jìngài→jìng'ài` (L38)<br>恋爱 `liànài→liàn'ài` (L56) |
| `h5_hsk_d.js` | 2 | 热爱 `rèài→rè'ài` (L54)<br>亲爱 `qīnài→qīn'ài` (L195) |
| `h5_hsk_e.js` | 1 | 疼爱 `téngài→téng'ài` (L191) |
| `h5_hsk_f.js` | 2 | 幼儿园 `yòuéryuán→yòu'éryuán` (L111)<br>因而 `yīnér→yīn'ér` (L203) |
| `h6_hsk30.js` | 10 | 档案 `dàngàn→dàng'àn` (L191)<br>公安 `gōngān→gōng'ān` (L298)<br>孤儿 `gūér→gū'ér` (L307)<br>关爱 `guānài→guān'ài` (L313)<br>金额 `jīné→jīn'é` (L410)<br>名额 `míngé→míng'é` (L532)<br>少儿 `shàoér→shào'ér` (L647)<br>时而 `shíér→shí'ér` (L662)<br>障碍 `zhàngài→zhàng'ài` (L944)<br>罪恶 `zuìè→zuì'è` (L1021) |
| `h6_hsk_a.js` | 1 | 婴儿 `yīngér→yīng'ér` (L41) |
| `h6_hsk_b.js` | 1 | 悲哀 `bēiāi→bēi'āi` (L15) |
| `h6_hsk_c.js` | 1 | 饥饿 `jīè→jī'è` (L137) |
| `h6_hsk_d.js` | 1 | 数额 `shùé→shù'é` (L26) |
| `h6_hsk_e.js` | 4 | 配偶 `pèiǒu→pèi'ǒu` (L38)<br>草案 `cǎoàn→cǎo'àn` (L53)<br>进而 `jìnér→jìn'ér` (L137)<br>轻而易举 `qīngér yìjǔ→qīng'ér yìjǔ` (L176) |

`档案`은 같은 객체의 예문 병음이 이미 `dàng'àn`이어서 표제
`dàngàn`과 내부 불일치도 직접 확인된다. 이 감사 결과는 A/B 두 번 모두
42건, canonical JSON 2,932 bytes,
SHA-256 `6f34c2d181886903d2d35b21f8f55d21e0460b42040944edfa336bdee926a446`로
동일했다.

그 밖의 자동 후보는 구·이합사·고유명사·레지스터 판단이 필요한 경우가 있어
신규 확정 문제로 올리지 않았다.

## 6. 축별 상세 재판정

### 언어 정확성: C → B-

- `了`·`被`, ZH-I04~I09, 확정 독음·다음자, 얼화·`ü` 수리는 유지된다.
- #621로 공백형 표제의 대량 백로그는 해소됐고 비공백 문자는 보존됐다.
- 신규 격음부호 누락 42건은 한 규칙으로 결정적으로 고칠 수 있으나, 학습자가
  음절 경계를 잘못 읽게 하는 실제 정사법 오류다.
- `档`의 품사 오분류가 남아 있어 A/B+는 부여하지 않는다.

### 커리큘럼 정합: B 유지

R2 이후 중국어 grammar·bunkei는 바뀌지 않아 핵심 문법 수리와 챕터 판정은
유지된다. #631·#635가 `prerequisites`·`formulaic` 선택 메타와 UI를
도입했지만, 중국어 grammar에는 해당 데이터가 추가되지 않았다. 공용 인프라
도착만으로 중국어 커리큘럼 축을 올리거나 내리지 않는다.

### 한국어 설명: C → B

R2가 센 `-다/합니다` 3,845건 중 3,757건이 #622~625에서 해요체로
전환됐다. 남긴 88건은 #620 계약의 공문·인사·기원·문어·표현 자체 인용
범위다. 대량 C 상한은 해소됐다.

반면 예문 번역이 아닌 저자 산문 `grammar/h4.js:55`, `grammar/ot.js:105`는
계약상 해요체 대상인데도 그대로다. 따라서 B이며 A는 아니다.

### 예문 자연성: B- → B

| R2 위치 | R2 예문 | R3 현행 | 판정 |
|---|---|---|---|
| `vocab/h6_hsk30.js:109` | `他的成绩超过了同学。` | `他的成绩超过了班级平均分。` | 비교항 평행화, 수리됨 |
| `vocab/h6_hsk30.js:133` | `请随手关闭出入的大门。` | `请出入时随手关门。` | 부자연한 결합 제거, 수리됨 |
| `vocab/h6_hsk30.js:612` | `他看起来很累，却是精神很好。` | `大家以为他会拒绝，他却是答应了。` | `却是`의 대조 초점과 호응, 수리됨 |

확정 3건은 모두 직접 재작성됐다. 이번 변경부 표본에서 새 확정 C급 예문은
찾지 못했지만, 대량 보강 전체를 원어민 자연성 A로 재인증한 것은 아니므로
B로 올리고 A는 보류한다.

### 범위·분량: A 유지

53파일, 문법 78챕터·232섹션, 문형 511항목, 어휘 6,884항목이 유지됐다.
대량 정사법·문체 수정은 항목 삭제나 범위 축소를 만들지 않았다.

### 구조·필드: B 유지

병음 16,379개와 빈 값 0, 어휘 6,884개와 빈 `pos` 0은 개선이다. 그러나
표제 병음의 격음부호 42건, `档` 품사 1건, 빈 `pos`를 허용하는 lint 계약이
남아 있다. 구조값 자체는 소비 가능하지만 fail-closed 데이터 계약은 아직
A 수준이 아니다.

## 7. 종합 변화 근거와 다음 합격선

### C → B의 근거

1. R2 C의 대량 원인이던 표제 공백, 예문 번역 문체, 빈 `pos`가 각각
   #621, #622~625, #626에서 대규모로 해소됐다.
2. 정책 위반 5건과 추가 동류 1건은 #617, 확정 C급 예문 3건은 #636에서
   수리됐다.
3. R2의 핵심 문법 수리는 회귀하지 않았고 새 Critical은 없다.
4. 신규 격음부호 42건과 기존 소수 잔여는 중요하지만 단일 규칙·소수 위치의
   제한된 교정으로 닫을 수 있어 C의 “대량 재검수” 수준은 아니다.

### A 이상으로 올리기 위한 현행 합격선

1. #621이 연서한 42개 표제에 격음부호를 보충하고, “단어 내부 a/o/e 시작
   비첫 음절” 회귀 검사를 추가한다.
2. `档`을 현행 예문 용법에 맞는 품사로 고치고, 중국어 `pos`를
   `requireNonEmptyFields` 수준으로 fail-closed 검증한다.
3. grammar 산문 설명 비해요체 2건을 해요체로 맞춘다.
4. 현행 공백 표제 178건은 오류로 일괄 변환하지 말고 RFC의 구·이합사·성어
   기준으로 보류 목록을 닫는다.
5. 수정 후 콘텐츠 lint·check-content·전체 Vitest를 다시 통과한다.

## 8. 검증 결과

이 보고서는 현행 `origin/main` 콘텐츠를 읽기만 했고
`src/content/chinese/`를 수정하지 않았다.

| 검증 | 결과 |
|---|---|
| 변경 범위 | `docs/review-chinese-track-r3.md` 신규 1파일, 콘텐츠 변경 0 |
| R2→R3 중국어 변경 추적 | 8 merge 커밋, vocab 25파일, 5,601 additions / 5,601 deletions |
| 53개 모듈 import·재귀 순회 | 통과 |
| 병음 필드 / 빈 값 | 16,379 / 0 |
| 어휘 `pos` 빈 값 | 0 |
| 격음부호 감사 A/B | 42건·2,932 bytes·동일 SHA-256 |
| 콘텐츠 lint | 138 active + 0 draft, 오류 0, 경고 0 |
| `scripts/check-content.mjs` | 오류 0, 경고 11. 중국어는 기존 `ot-05-pronouns` 퀴즈 표현 수 경고 1건 |
| 전체 Vitest | 250/250파일, 2,483/2,483테스트 통과, exit 0 |
| 전체 Vitest 소요·최대 RSS | 245.88초, zsh `time` `%M` 4,141,680KiB |

언어 판정 기준 자료는 R2와 동일하게 GB/T 16159-2012
《汉语拼音正词法基本规则》, GF 0015-2010
《汉语国际教育用音节汉字词汇等级划分》, 《现代汉语词典》 제7판,
《现代汉语》 증정 6판, 《现代汉语八百词》 증정본 및 R2가 든 현대 중국어
문법 참고문헌을 사용했다.
