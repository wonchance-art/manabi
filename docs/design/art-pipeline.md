# 「그림 한 장 읽기」 작품 확장 파이프라인 (ART-AUTO-001) — 설계

- 등급: **구조**(/design-bank). 2026-10-14 KST. 오너 결정: **A안**(스크립트 + 리포 스냅샷 + Claude 세션 저작) · **ColBase CC BY 이미지 허용**.
- 정본: 카탈로그 `src/content/art/`(README), 계약 `src/lib/artCatalog.js`, 책 `src/lib/artBook.js`, 원문 변환 `src/lib/artSource.js`.
- 이 문서는 설계다. 구현은 아래 「단계」 순서로 PR 하나씩.

## ① 진단 (실측, 2026-10-14)

| 주제 | ColBase 일본어 해설(깨끗) | 메트 같은 도안 PD 그림 | 세 가지(해설·그림·QID) |
|---|---|---|---|
| 호쿠사이 | 65 | 3~12 | 약 12 |
| 히로시게 | 83 | 10 | 8 |
| 미인화(우타마로·하루노부·기요나가) | 132 | 2~6 | 2~6 |
| 샤라쿠 | 14 | 9 | 7 |
| 린파·수묵·자쿠추/오쿄 | 107 | 0 | 0 → ColBase CC BY 허용으로 해소 |

- 병목은 해설이 아니라 **그림 라이선스**다. 판화는 같은 도안이 여러 미술관에 있어 메트 CC0로 풀리지만, 병풍·족자는 한 점뿐이라 소장처(ColBase) 이미지가 필요하다.
- 실패 지점(이번 세션 실측):
  - 메트 `/v1/search` 폐기(2026-10-01 → `/v1.1/search`).
  - Wikidata는 비인증 시 분당 약 1회에서 429를 낸다. 위키미디어 공용도 429.
  - 시카고 미술관 IIIF는 Cloudflare 봇 차단(ART-IMG-001 — 운영 결함으로 이어짐).
  - ColBase 키워드는 전문 검색이라 잡음이 많다(光琳 289건 중 본인 작품 13건).
  - 내부 메모가 섞인 해설이 약 35건이다(`（20171003_h102）`).
  - 읽기 표시 `+かたきうち+`가 남은 해설이 있다.
  - 메트 QID는 인쇄본 단위이고, 우리 키는 도안 단위다.
- 손이 드는 곳:
  - 기계로 정할 수 있는 필드(약 40%): 원문·해시·출처·좌표·QID·이미지·크기.
  - 사람이 써야 하는 필드(약 60%): 한국어 제목·읽기·대체 텍스트·용어·찾아볼 것·생애·그림 속 장소 선택.
  - ART-P0-2·P0-3의 8점은 수집 에이전트 3·라이선스 1·검토 4라운드가 들었다. 병합 뒤 운영 결함은 1건(그림)이었다.

## ② 선례·오픈소스 (채택 / 부분 채택 / 배제)

| 도구/선례 | 판정 | 근거 |
|---|---|---|
| 아오조라 `build-literature --check` | 채택 | 원문 스냅샷 + 해시 + 생성물 낡음 검사. 네트워크 없는 CI에서 결정적으로 돈다 |
| 재팬서치 집계(ColBase) | 채택 | 해설 정본 경로다. `f-contents=description`으로 해설 있는 기록만 받는다(広重 2,666 → 106) |
| 메트 오픈 액세스 API | 채택 | `isPublicDomain` 단건 판정, CC0. v1.1 search로 고정한다 |
| 시카고 미술관 API | 부분 채택 | 영어 해설(CC BY)만 쓴다. 이미지는 봇 차단이라 뺀다 |
| Wikidata(WikiProject Visual arts) | 부분 채택 | 정규 키로 쓴다. 인쇄본/도안 모델링 차이 때문에 매칭 규칙을 명시한다. 응답은 스냅샷으로 둔다 |
| `kuromojin`(기존 의존성) | 채택 | 용어 후보 토큰화. 「해설 속 말만」 계약을 결정적으로 충족한다 |
| `callLLM` + `generate-zh-sense-candidates` 동결 패턴 | 부분 채택 | 초안 생성 → JSON 동결 → 사람 검수 틀. 키가 필요해 이번 단계에서는 Claude 세션 저작으로 대신한다 |
| `sharp` | 부분 채택(보류) | 재인코딩은 플랫폼마다 출력이 달라 결정성을 깬다. 받은 바이트를 그대로 쓰고 해시로 묶는다 |
| Europeana OAI-PMH · OpenRefine · IIIF 파서 · `wikibase-sdk` · 미술관 API 클라이언트 · `fuse.js` · pHash · Splink 류 | 배제 | 규모(수백만 건용)·CI 불가(GUI)·소스 없음(IIIF 0건)·중복 신설(`ART_SOURCES`가 이미 어댑터)·일본어/로마자 혼합 제목에서 임계값 불안정·판본 차로 오탐 |
| Smartify · DailyArt · Google Arts & Culture | 부분 채택 | 「하루 한 점 · 짧은 해설」 큐레이션 감각만(`ART_LIMITS`에 이미 반영). 열린 소스가 아니다 |

OSS 유지 상태·라이선스는 이 환경에서 npm·GitHub 조회가 막혀 **미검증**이다(sharp만 lock 파일로 확인).

## ③ 상세 설계 — A안

### 흐름

```
[1 수집 · 네트워크]  scripts/art/harvest.mjs  --artist <QID> | --ids …
   재팬서치(f-db=cobas&f-contents=description) · 메트(v1.1 search → objects) · Wikidata(wbgetentities 50개 묶음)
   → src/content/art/sources/{colbase,met,aic,wikidata}/<id>.json   (원 응답 스냅샷, 커밋)
   → public/art/<작품 id>.jpg  (받은 바이트 그대로, 재인코딩 없음)
[2 후보표 · 오프라인] scripts/art/candidates.mjs
   스냅샷 → 정규화 키(작가 QID + 연작 키 + 도안 키)로 ColBase↔메트↔Wikidata 연결
   → src/content/art/candidates.generated.json  (근거 열 · 탈락 사유)
[3 저작 · Claude 세션] entries/<작품 id>.json  (사람이 쓰는 필드 + 고른 출처 id)
   에이전트가 초안 → 검토 에이전트(사실·화면 문구) → 사람 확정
[4 빌드 · 오프라인 · CI] scripts/build-art.mjs [--check]
   entries + sources → works.json·places.json(기계 필드 생성) — --check는 prebuild에 건다
[5 게시 · 오너]  ART_PUBLISHED_CURATIONS 추가 → 관리자 게시 → 검수 → 공개(books와 협의)
```

### 1. 수집(`harvest.mjs`, 네트워크 · 수동/세션에서만)

- **출처표는 하나다.** `src/lib/artSource.js`의 `ART_SOURCES`를 넓혀 `met`(objects·search v1.1)와 `wikidata`(wbgetentities)를 넣는다. 엔드포인트 폐기 응답(404·410)은 명시 오류로 낸다.
- **예절:** UA에 리포 주소, 직렬 요청, 1초 간격, 429면 지수 백오프(최대 3회). Wikidata는 wbgetentities 한 번에 50개를 묶어 요청 수를 줄인다(SPARQL 대신).
- **스냅샷:** 원 응답에서 쓰는 필드만 남긴 JSON을 결정적 직렬화로 저장한다(키 정렬, 2칸, 끝 개행). 받은 날짜는 파일 안 `fetchedAt`(KST 날짜)에 둔다.
- **이미지:**
  - 메트는 `primaryImageSmall`을 쓴다.
  - ColBase는 `…/image/slideshow_l/…`(686px 안팎, 약 60KB)을 쓴다. 302로 만료 서명 주소에 이어지므로 반드시 받아서 보관한다.
  - 받은 바이트를 그대로 `public/art/`에 저장하고 `sha256`·픽셀 크기를 스냅샷에 기록한다.
  - 한 장 300KB 상한이다(저장소 크기 관리 — 100점에 약 10MB).

### 2. 후보표(`candidates.mjs`, 오프라인)

- **연결 키:**
  - 작가: ColBase `cobas-8-s`(작자) → 작가 사전(이름 표기 → QID)에서 찾는다.
  - 연작: 정규화 사전(冨嶽/富嶽, 之内, 공백·구두점)을 쓴다.
  - 도안: 연작 번호·역참·제목을 Wikidata 도안 QID의 ja/en 라벨과 맞춘다.
  - 메트 인쇄본 QID에서 도안 QID로 가는 길은 스냅샷의 연결 속성으로 찾는다(**미검증** — 단계 2에서 실측).
- **판정 열:**
  - `match`: 근거(일치한 키 목록)를 함께 적는다.
  - `reject`: 사유는 `no-description`, `too-long`, `internal-memo`, `reading-marks`, `no-image`, `ambiguous`, `different-design` 중 하나다.
  - **사람이 확정하기 전에는 entries로 가지 않는다.** 같은 작가·같은 연작의 다른 도안이 「이름만 일치」로 붙는 오류(미인화 실측)를 막기 위해서다.
- 후보표는 PR에서 사람이 읽는 표이고, 커밋하며 `--check`로 낡음을 막는다.

### 3. 저작(entries, Claude 세션)

- `src/content/art/entries/<작품 id>.json`에는 사람이 쓰는 필드만 둔다.
  - 한국어 제목, 읽기, 날짜 범위, 기법 ko, 그림 속 장소 QID, 용어, 찾아볼 것, 대체 텍스트, 큐레이션.
  - 고른 출처 id: `colbase`·`met`·`aic`.
- **용어:** kuromojin 토큰 후보 중에서만 고른다. 그래서 해설 속 말이라는 계약을 자동으로 만족한다.
- **찾아볼 것·대체 텍스트:** 에이전트가 그림을 직접 보고 쓴다. 해요체이고, 없는 세부는 쓰지 않는다.
- **검토 에이전트 두 종(사실·화면 문구)을 표준 절차로 고정한다.** ART-P0-2·3에서 결함 약 25건을 잡은 경로다.

### 4. 빌드(`build-art.mjs [--check]`, 오프라인 · CI)

- entries와 sources로 `works.json`(기계 필드 생성)과 `places.json`을 만든다.
  - 기계 필드: 해설 text = `artSourceText(스냅샷 원문)`, `textSha256`, `credit`, `license`, `sourceUrl`, 이미지 `url`·`width`·`height`·`sha256`·`credit`, 소장처 `url`, 좌표.
- **`--check`를 prebuild에 건다**(아오조라 선례). 생성물과 커밋본이 다르면 실패한다.
- 기존 16점은 1단계에서 entries + sources로 옮긴다. 이행 PR에서는 works.json이 바이트 단위로 같아야 한다.

### 5. 이미지 라이선스 확장(오너 결정 — ColBase CC BY 허용)

- `ART_IMAGE_LICENSES`에 `jp-gov-standard-2.0`(ColBase 이용규약, CC BY 4.0 호환)과 `cc-by-4.0`을 더한다.
- **출처 표기가 필요한 라이선스면 `image.credit`가 필수다**(fail-closed).
  - 형식: 「<작품명>(<소장관> 소장) · 출처: ColBase(국립문화재기구) · <라이선스>」.
- 뷰어 그림 캡션은 지금처럼 `image.credit`를 그대로 보인다. CC BY는 캡션 누락이 곧 위반이므로 카드 계약에 「출처 표기 라이선스면 캡션을 반드시 그린다」를 더한다.
- 자료 출처 화면의 ColBase 줄 쓰임을 「작품 해설 · 작품 이미지」로 고친다.

### 3문

1. **어느 정거장인가:** 자료 읽기 순환(뷰어 → 단어 저장 → FSRS 복습 → 본문 귀환)에 읽기 자료를 공급한다.
2. **기존 부품을 재사용하나:** 정본 문학책 게시 경로, `ART_SOURCES`, `artSourceText`, 카탈로그 계약, kuromojin을 그대로 쓴다. 새 클라이언트 라이브러리는 0개다.
3. **새 이음새가 생기나:** 이벤트 기록·SRS 연동에 새 이음새는 없다(책 장은 일반 자료와 같은 행).

## ④ 계약(심을 것)

| 계약 | 위치 | 깨뜨려 확인 |
|---|---|---|
| `build-art --check` — 생성물 = 커밋본 | prebuild · `buildArt.test.js` | works.json 한 글자 수정 → FAIL |
| 스냅샷 원문 → `artSourceText` → `textSha256` 일치(오프라인) | `buildArt.test.js` | 스냅샷 원문 변조 → FAIL |
| 이미지 파일 sha256·픽셀·300KB 상한 | `artCatalog.test.js` | 파일 교체 → FAIL |
| 출처 표기 라이선스면 `image.credit` 필수 · 카드가 캡션을 그림 | `artCatalog.test.js` · `viewerArtCard.test.js` | credit 삭제 → FAIL |
| 읽기 표시(`+…+`)·내부 메모 섞인 해설 거부 | `artCatalog.test.js` | 픽스처 → FAIL |
| 후보표 결정성(`candidates --check`) · 확정 안 된 후보는 entries 금지 | `artCandidates.test.js` | 미확정 후보 참조 → FAIL |
| 작품 QID가 도안 단위(스냅샷 P31이 허용 집합) | `buildArt.test.js` | 인쇄본 QID → FAIL(허용 집합 값은 **미검증**, 단계 2 실측) |

## 단계(구현 PR 순서)

1. **AUTO-1 스냅샷 + `build-art --check`.** 기존 16점을 entries + sources로 이행한다(결과 바이트 동일). prebuild에 건다.
2. **AUTO-2 수집 · 후보표.** `harvest.mjs`·`candidates.mjs`를 만들고, `ART_SOURCES`에 met·wikidata를 넣는다. 메트 인쇄본 → 도안 QID 경로를 실측한다.
3. **AUTO-3 이미지 확장.** ColBase CC BY 허용 계약과 캡션 계약을 심고, 린파·수묵 첫 큐레이션을 낸다.
4. **AUTO-4 저작 보조.** kuromojin 용어 후보와 검토 에이전트 절차를 문서화한다. LLM 키 경로(`callLLM` 동결)는 오너 PC용으로 선택 사항이다.

## 위험

- **외부 API 변경**(메트 v1 폐기 선례): 엔드포인트를 `ART_SOURCES` 한 곳에 두고, 폐기 응답은 명시 오류로 낸다. `--verify`로 드리프트를 감시한다.
- **ColBase 이용규약 변경:** 출처 표기를 계약으로 강제하고, README 출처표에 규약 확인 날짜를 남긴다.
- **저장소 크기:** 한 장 300KB 상한과 장수 모니터링. 1,000점을 넘으면 Supabase Storage 이전을 검토한다.
- **매칭 오류(다른 도안):** 사람 확정 게이트와, 에이전트가 그림을 직접 대조하는 단계를 둔다.
- **요청 제한:** 스냅샷 캐시, 묶음 요청, 백오프. 막히면 새 세션(다른 출구 IP)에서 수집한다(ART-IMG-002 선례).

## 하드리밋 점검

- IP:
  - 퍼블릭 도메인 작품의 미술관 촬영본이다(CC0·CC BY). 로고·캐릭터 시각 재현이 아니다.
  - 해설은 원문 그대로 싣고 출처를 표기한다(저작물 본문 복제 금지와 충돌하지 않는다 — 이용규약이 복제·공중송신을 허용한다).
  - 중화권 정치 서술은 해당 없음.
- 시크릿·환경 변수: 새로 필요한 것 없음(A안). 운영 DB 변경 없음.
- 게시는 오너 게이트 그대로다(books와 협의).

## 자기 검토 — 미검증 항목

- 메트 인쇄본 QID → 도안 QID 연결 속성.
- 「도안 단위」 P31 허용 집합.
- ColBase `slideshow_l`이 모든 기록에 있는지(표본 1건 확인).
- 메트 API 요청 한도.
- OSS 유지 상태·라이선스.

모두 해당 단계 PR에서 실측한 뒤 확정한다.
