# 「그림 한 장 읽기」 정본 카탈로그

설계: 2026-10-14 KST 오너 승인(「좋아 가보자」) — 미술관 해설을 읽기 자료로, 작품 정보(작가·시기·소장처·그림 속 장소)를
개체로 쌓아 시기·작가 특집으로 큐레이션한다. 첫 큐레이션은 **호쿠사이·히로시게 풍경 우키요에**.

이 폴더는 **정본**이다. 형식·규칙은 `src/lib/artCatalog.js`(`validateArtCatalog`)가 정하고 `artCatalog.test.js`가 CI에서 잡는다.
ART-P0-1은 형식과 계약, **ART-P0-2는 실물 여덟 점**(아래 「수록 작품」), **ART-P0-3은 큐레이션 책 게시와 뷰어 정보 카드**(아래 「큐레이션 책」).

## 파일

| 파일 | 개체 | 정규 키 |
|---|---|---|
| `periods.json` | 시대(문화권별 라벨 + 연도 범위) | 우리 id(`jp-edo`) |
| `artists.json` | 작가 — 이름(원어·한국어·읽기), 생몰년, **생애 요약(우리가 쓴 한국어, 400자 이하)** | Wikidata QID |
| `places.json` | 장소 — 소장처·그림 속 장소·제작지, 좌표, 지역학 핀(`links.studiesPin`) | Wikidata QID |
| `works.json` | **생성물**(`node scripts/build-art.mjs`, 손으로 고치지 않는다) — 작품: 제목, 날짜(원문 표기 + 연도 범위), 재료·기법, 장소(역할별), 해설, 핵심 용어 ≤3, 찾아볼 것 ≤3, 이미지 | Wikidata QID |
| `entries/<작품 id>.json` | 작품의 사람이 쓰는 필드 + 고른 출처 id(해설 `{language, source, sourceId}`, 그림 `{source, sourceId, alt}`). 순서는 `entries/order.json` | 작품 id |
| `sources/<출처>/<id>.json` | 출처 원 응답 스냅샷 — `colbase/cobas-<번호>`·`aic/<id>`(해설 원문 HTML은 받은 그대로) · `images/<작품 id>`(그림 출처 기록 + `public/art` 파일 sha256·바이트·픽셀) | 출처 id |
| `curations.json` | 큐레이션 — 작가·시대·주제 묶음(두 점 이상, 순서 있음). `language`(없으면 `ja`)가 책 언어 | 우리 id |
| `shelf-order.json` | 산책 「고전 명작」 그림 구간의 앞줄 차례(한국에서 익숙한 그림 먼저, DISCOVER-ART-001) — 나머지는 게시 책 차례 | 작품 id |

## 규칙 (계약 테스트가 강제)

- **전시 여부를 저장하지 않는다.** `onView`·`onDisplay`·`exhibited`·`gallery`·`room` 키 금지. 화면은 늘 「소장」, 전시 여부는 원문 링크로.
- **장르(`genre`)는 넷**(ART-GENRE-001, 2026-10-18 KST 오너 「권장대로 ㄱㄱ」): `print`(판화) · `painting`(회화) · `photograph`(사진) · `architecture`(건축).
  장르가 정보 카드 작가 칸 이름을 정한다 — 그림(판화·회화) · 촬영(사진) · 설계(건축)(`ART_GENRE_ARTIST_ROLE`).
- **장소 역할은 넷**: `holding`(소장) · `depicted`(그림 속 장소) · `made`(제작지) · `located`(소재지 — 건축만). 같은 판화를 여러 곳이 소장하면 `holding`을 여럿.
  `holding`에는 그 기관의 소장품 기록 HTTPS `url`이 필수 — 전시 여부·자세한 정보는 이 링크에서 본다.
  건축이 아닌 작품은 소장처 하나 이상, **건축은 소장처 대신 소재지 하나 이상** — `located`에는 그 건물의 문화재 기록(문화유산 온라인) HTTPS `url`이 필수.
- **Wikidata QID**는 작가·장소에 필수, 작품에는 있으면 싣는다(메이지 사진 낱장·건물 동처럼 항목이 없는 작품이 있다 — 없으면 키를 두지 않는다).
- **날짜는 출처 표기 그대로** `date.text`(「江戸時代・安政4年(1857)」, 「c. 1830/33」)와 그 표기를 가져온 `date.source`(colbase|aic),
  정렬·묶음은 `startYear`·`endYear`·`certainty`(exact|circa|range). 출처 표기가 「江戸時代・19世紀」처럼 넓으면 연도 범위는 연작 간행 연도로 좁히고 `certainty: range`로 둔다(호에이도판 도카이도 1833–34).
- **해설 본문**은 허용 라이선스만: `jp-gov-standard-2.0`(ColBase) · `cc-by-4.0`(시카고 미술관·문화유산 온라인) · `cc-by-sa-4.0`(위키백과) · `cc0`.
  `credit`(크레딧 줄)·HTTPS `sourceUrl`·`textSha256` 필수 — 받은 원문을 고치면 해시가 어긋나 테스트가 실패한다. 1,500자 상한(목표 200–600자).
  `source`는 `colbase`(id `cobas-<번호>`) · `aic`(id 숫자) · `bunka`(id `bunka-<번호>`)만 — 받는 곳이 정해진 출처만 싣는다(`cc-by-sa-4.0` 위키백과는 라이선스 목록에만 있고, 받기 경로를 만들기 전에는 실을 수 없다). 박물관 내부 메모(「(20131029_h21・22)」 같은 작업 번호)가 섞인 해설은 싣지 않는다.
  읽기 표시(ColBase 「＠よみ＠」「+よみ+」, 문화유산 온라인 「【よみ】」)가 섞인 해설, **일본어 해설 칸에 영어 문장이 이어 붙은 해설**(湖畔 `cobas-159785` 실측)도 싣지 않는다.
- **이미지**는 `public-domain`·`cc0`, 그리고 **ColBase 사진의 `cc-by-4.0`**(오너 결정 2026-10-18 KST — 캡션 `credit` 필수, 저작자 표시가 이용 조건)만, `alt`(한국어 대체 텍스트) 필수.
  **그림을 싣는 작품은 작가가 `ART_PD_DIED_BY`(1955)년까지 세상을 떠났어야 한다** — 작품 자체의 저작권(사후 70년)이 어디서나 끝난 것만 싣는다. 저작권이 남은 작품은 `image` 없이 해설만.
  **그림 파일은 manabi가 직접 들고 있는 것만** — `public/art/<작품 id>.jpg`, `image.url`은 `/art/<작품 id>.jpg`(계약이 강제).
  미술관 서버에 바로 연결하지 않는다: 시카고 미술관 IIIF는 다른 사이트에 끼운 그림 요청을 봇 차단(Cloudflare)해 운영 화면에서 그림이 뜨지 않았다(ART-IMG-001, 2026-10-14 KST).
  지금 파일은 **메트로폴리탄 미술관 오픈 액세스(CC0)** 에서 받은 것이다(`sourceUrl` = 메트 작품 페이지, `credit` = 「Artist. Title, Date. The Metropolitan Museum of Art, <기증 기록>. CC0」,
  `width`·`height` = 파일 실제 픽셀 — 테스트가 JPEG 머리에서 대조한다). 메트에 없는 작품은 **다른 미술관의 공식 디지털화본 중 PD/CC0**을 위키미디어 공용에서 받는다
  (`sourceUrl` = 공용 파일 페이지, `credit` = 「Artist. Title, Date. <소장처>, <소장 번호>. <라이선스> (via Wikimedia Commons)」, 소장처는 `places`에 `holding`으로).
  작자 불명 사진·현대 복제·워터마크 파일은 쓰지 않는다. 亀戸梅屋舗는 브루클린 미술관 전질 사본이 공용에 없어(「100 views edo 0NN.jpg」 계열에서 030만 빠짐)
  레이크스 미술관 RP-P-1956-743(CC0)을 썼다(ART-IMG-002). 공용 API는 출구 IP 요청 제한(429)이 잦다 — `Retry-After`를 지켜 다시 묻고,
  썸네일 호스트 `thumb.wikimedia.org`는 환경에서 닫혀 있어 `upload.wikimedia.org/…/thumb/…/960px-…`(표준 크기만 준다)를 받아 로컬에서 줄였다.
  **ColBase 사진**(ART-GENRE-001)은 재팬서치 항목의 `contentsRightsType`이 `ccby`이고 소장관이 출처표(`ART_COLBASE_HOLDERS`)에 있을 때만 CC BY 4.0으로 싣는다.
  파일은 항목 `contentsUrl`(`…/image/slideshow_s/…`, 긴 변 330px)과 같은 경로의 `slideshow_l`(긴 변 686px)을 **받은 바이트 그대로** 둔다(원본 `original`은 3000px·1MB라 쓰지 않는다).
  캡션은 「<제목> · <작가 표기> · <소장관> 소장 · ColBase(국립문화재기구) · CC BY 4.0」. 근대 건축 옛 사진은 국립국회도서관 디지털화본(퍼블릭 도메인)을 위키미디어 공용에서 받는다 —
  캡션 라이선스 이름은 「Public domain」.
- **핵심 용어(`terms`)는 읽기 해설(첫 해설 — 책 장이 되는 해설)에 실제로 나오는 말**만 — 본문에서 만나야 단어 저장으로 이어진다.
  우키요에 · 근대 일본 작품은 일본어 해설, 「시카고 미술관의 명화」는 영어 해설이 첫 해설이다.
- **원어 제목의 언어(`title.lang`)** — 없으면 `ja`. 미술관 영어 제목(「The Bedroom」)은 `en`(뷰어 정보 카드의 `lang`).
- **한 줄 이야기(`hook`, DISCOVER-ART-001)** — 그림 구간 카드에 그림과 함께 보이는 **우리가 쓴 한국어 화면 문구**(1–40자). 작가 생애 요약과 같은 지위로,
  학습 원문이 아니다(해설은 여전히 받은 그대로). 사실은 그 작품의 해설 원문에서만 가져온다(「고흐가 세 번이나 그린」 = AIC 해설 「three versions」).
  게시 책의 작품은 모두 둔다(`artShelf.test.jsx`).
- **찾아볼 것(`lookFor`)은 그림이 있을 때만** — 그림을 보며 하는 질문이다. 화면 문구라 해요체(「…일까요?」·「…찾아봐요.」).
- 민감 소장처(반환 논쟁·중화권)는 이름·도시 같은 **사실만** 적는다.

## 큐레이션 책 (ART-P0-3)

`src/lib/artBook.js`가 큐레이션을 **정본 문학책과 같은 모양의 책**으로 만든다 — 작품 한 점 = 책 언어(큐레이션 `language`, 없으면 일본어) 해설 한 장.
작품에 그 언어 해설이 없으면 책을 만들지 않는다(fail-closed). 자료 언어는 해설 언어에서(`ja` Japanese · `en` English · `fr` French · `zh` Chinese).

- 장 원문(`raw_text`)은 카탈로그 해설 `text` 그대로, 해시는 `textSha256` 그대로다. 따로 대조표를 만들지 않는다 — **카탈로그가 곧 정본 대조표**다.
- 자료 metadata: `book {key: 'art-<큐레이션 id>', title, author, order, total}` + `literature {provider: 'art', curation, work, source, sourceId, sourceUrl, license, credit, textSha256}`.
  루비·검수 힌트 키는 두지 않는다(현대 해설문).
- 장 제목은 「<책 제목> — <작품 제목>」 — 서재 책 카드가 「 — 」 뒤를 장 이름으로 쓰므로 책 제목(`title.native`)에는 「 — 」를 쓰지 않는다(빌드가 막는다).
- 큐레이션의 `level`은 편집 라벨이다(산책 레벨 필터). 게시하는 책은 `ART_PUBLISHED_CURATIONS`뿐 — 작가별 큐레이션은 같은 해설의 부분집합이라 따로 게시하지 않는다.

**게시(관리자)** — 관리자 → 🖼️ 미술 책. 정본 문학책과 같은 순서다: 「게시」(장마다 **비공개** 자료 + 바로 분석) → 장마다 뷰어에서 확인하고 「검수 완료」
→ 「공개」(모든 장이 분석·검수 완료일 때만). 게시 직전에 `artBookPublishable`이 카탈로그 계약·원문·라이선스를 한 번 더 본다(fail-closed).

**뷰어** — 자료 `raw_text`의 SHA-256이 카탈로그 해시와 같고 책 순서·작품이 맞을 때만 정보 카드(그림·작가·날짜·소장·그림 속 장소·찾아볼 것)와 출처 줄을 그린다
(`verifiedArtChapter`). 남이 자기 자료에 `provider: 'art'`를 꾸며 넣어도 원문이 다르면 아무것도 보이지 않는다. 큐레이션 책 장은 원문 수정이 막힌다(분석·단어 교정은 그대로).

## 출처와 라이선스 (2026-10-14 KST 원문 대조)

| 출처 | 해설 받는 곳 | 해설 라이선스 | 이미지 | 크레딧 |
|---|---|---|---|---|
| ColBase(국립문화재기구) | 재팬서치 항목 API `https://jpsearch.go.jp/api/item/cobas-<번호>`의 `common.description`(일본어)·`descriptionEn`(영어). ColBase 자체 API는 키가 필요하다 | ColBase 이용규약 = 정부표준이용규약 2.0 준거(CC BY 4.0 호환). 재팬서치의 ColBase `metadataRights`도 같은 규약 | 항목 `contentsRightsType: ccby` → CC BY 4.0(ART-GENRE-001부터 사용, 캡션 필수) | 「ColBase(국립문화재기구) · 도쿄 국립박물관 소장 · 재팬서치 경유 · 편집: 서식 기호만 지우고 글자는 그대로」(화면이 「출처:」를 앞에 붙인다) + 원문 페이지 `sourceUrl` |
| 시카고 미술관(AIC) | `https://api.artic.edu/api/v1/artworks/<id>`의 `description`(HTML) | CC BY 4.0(`description` 필드만, 나머지는 CC0) | `is_public_domain`이면 CC0, IIIF `…/full/843,/0/default.jpg` 핫링크 허용 | 「Art Institute of Chicago(시카고 미술관) · 편집: 서식 기호만 지우고 글자는 그대로」(「출처:」·라이선스 이름은 화면이 붙인다) |
| 메트로폴리탄 미술관 | — | — | 오픈 액세스 CC0(작품 이미지, `public/art`에 저장) | 그림 캡션 `image.credit` |
| 문화유산 온라인(문화청) | 재팬서치 항목 API `https://jpsearch.go.jp/api/item/bunka-<번호>`의 `common.description`(일본어, 평문) | 재팬서치 데이터베이스 정보(`api/database/bunka`)의 `metadataRights` 「解説文：CC BY」(4.0). 문화청 자료(`provider: bunkazai`)만 — 미술관이 올린 해설은 크레딧을 만들지 않는다 | 「コンテンツによって異なります」 — 쓰지 않음 | 「문화유산 온라인(문화청) · 재팬서치 경유 · 편집: 서식 기호만 지우고 글자는 그대로」 + 원문 페이지 `sourceUrl` |
| 위키미디어 공용 | — | — | 미술관·도서관 디지털화본(PD/CC0, `public/art`에 저장) — 레이크스 미술관 CC0 1점, 국립국회도서관 퍼블릭 도메인 3점 | 그림 캡션 `image.credit` |
| Wikidata | QID·좌표·라벨 | CC0 | — | 의무 없음 |

- 「편집: 서식 기호만 지우고 글자는 그대로」 — ColBase 규약은 편집·가공 시 그 사실을 따로 적으라고 한다. 우리는 HTML 태그를 벗기고 줄바꿈을 맞출 뿐 낱말은 바꾸지 않지만, 그것도 적는다(화면에 「HTML」 같은 코드 말은 쓰지 않는다).
- 발췌·번역은 하지 않는다(하면 「…를 바탕으로 발췌·번역」으로 표기를 바꿔야 한다). 1,500자를 넘는 해설은 자르지 않고 싣지 않는다.

## 작품 추가 절차 (ART-AUTO-1 — 스냅샷 → entries → 빌드 → --check)

`works.json`은 **생성물**이다. 해설 text·`textSha256`·`sourceUrl`·`credit`·`license`, 그림 `url`·`sourceUrl`·`license`·`credit`·`width`·`height`는
`scripts/build-art.mjs`가 `sources/` 스냅샷에서 만든다. 크레딧·라이선스 문구는 `src/lib/artSource.js` 출처표(`ART_SOURCES`·`ART_IMAGE_SOURCES`) 한 곳뿐이다.
`periods`·`artists`·`places`·`curations.json`은 아직 손으로 쓴다.

1. 작품을 고르고 Wikidata에서 작품(P170 작가 일치)·작가·소장처·그림 속 장소 QID와 좌표를 확인한다(장소·작가가 새로우면 `places.json`·`artists.json`에 더한다).
   해설이 붙은 레코드가 연작(부모)인지 낱장(자식)인지 확인해, 해설이 실제로 붙은 레코드 id를 고른다.
2. `entries/<작품 id>.json`을 쓰고 `entries/order.json`에 작품 id를 더한다 — 사람이 쓰는 필드(id·wikidata·artist·title·series·date·periods·medium·
   places·terms·lookFor)와 고른 출처 id만 둔다. 해설은 `{"language": "ja", "source": "colbase", "sourceId": "cobas-<번호>"}`, 그림은
   `{"source": "met", "sourceId": "<objectID>", "alt": "…"}`. 기계 필드를 entries에 쓰면 빌드가 실패한다(손으로 쓴 값이 소리 없이 무시되지 않게).
3. 그림 파일을 `public/art/<작품 id>.jpg`에 둔다(받은 바이트 그대로 — 아래 「이미지」 규칙). 위키미디어 공용 그림은 공용 API가 요청 제한(429)이 잦아
   `sources/images/<작품 id>.json`에 `record`(artist·title·date·holder·accession·license)·`sourceUrl`을 손으로 먼저 쓴다.
4. 스냅샷을 받는다 — `NODE_USE_ENV_PROXY=1 node scripts/art/snapshot-sources.mjs --work <작품 id>`(네트워크, CI에는 걸지 않는다).
   재팬서치·시카고 미술관 해설 응답과 메트 objects 기록을 결정적 직렬화(키 정렬·2칸·끝 개행)로 `sources/`에 쓰고, 그림 파일의 sha256·바이트·픽셀을 기록한다.
   받은 날짜는 `fetchedAt`(KST). 받은 내용이 같으면 파일을 바꾸지 않는다. 응답 → text 변환은 `artSourceText` 하나뿐이다(태그 벗기기·엔티티 풀기·
   줄바꿈 맞추기 — 낱말·문장부호·문단 머리 전각 공백은 그대로).
5. `node scripts/build-art.mjs`로 `works.json`을 만들고 diff를 읽는다. 계약(길이·내부 메모·읽기 표시·용어가 해설에 있는지 등)을 어기면 빌드가 실패하고 아무것도 쓰지 않는다.
6. `npm run check:art`(= prebuild의 `node scripts/build-art.mjs --check`)와 `npm test`. `--check`는 쓰지 않고, `works.json`이 entries·sources와 다르거나
   그림 파일 sha256이 스냅샷과 다르거나 스냅샷이 없으면 실패한다. 출처 쪽 해설이 바뀌었는지는 스냅샷을 다시 받아(4) `works.json` diff로 본다
   (`node scripts/fetch-art-description.mjs --verify`도 그대로 쓸 수 있다).

**시카고 미술관 API**는 `AIC-User-Agent` 머리(이용자 연락처)를 요청한다 — 없으면 봇 차단(Cloudflare 403)에 걸린다. 받기 스크립트가 붙인다(2026-10-23 KST 실측).

**네트워크:** `colbase.nich.go.jp`·`jpsearch.go.jp`·`www.wikidata.org`·`query.wikidata.org`·`api.artic.edu`·`collectionapi.metmuseum.org`는 2026-10-14 클라우드 환경에서 열려 있다
(Node `fetch`는 `NODE_USE_ENV_PROXY=1`). `www.artic.edu`(IIIF 이미지 호스트)는 닫혀 있어 이미지 URL의 200 응답은 Preview 브라우저 검수에서 확인한다.
그림은 `public/art`의 자체 보관 파일만 쓴다(위 「이미지」 규칙). 파일을 못 불러오면 뷰어는 그림 칸과 찾아볼 것만 숨긴다.

## 수록 작품 (2026-10-14 KST, ART-P0-2)

| 작품 id | 작품 | 날짜 표기(출처) | 소장(기록) | 해설 | 이미지 |
|---|---|---|---|---|---|
| hokusai-kanagawa-oki-nami-ura | 冨嶽三十六景 神奈川沖浪裏 | 1830/33 (AIC) | 도쿄 국립박물관 · 시카고 미술관 · 메트로폴리탄 미술관 | ja ColBase 623자 · en AIC 886자 | 메트 CC0 |
| hokusai-gaifu-kaisei | 冨嶽三十六景 凱風快晴 | c. 1830/33 (AIC) | 도쿄 국립박물관 · 시카고 미술관 · 메트로폴리탄 미술관 | ja ColBase 625자 · en ColBase 1,195자 | 메트 CC0 |
| hokusai-bushu-tamagawa | 冨嶽三十六景 武州玉川 | c. 1830/33 (AIC) | 도쿄 국립박물관 · 시카고 미술관 · 메트로폴리탄 미술관 | ja ColBase 465자 | 메트 CC0 |
| hiroshige-shono-hakuu | 東海道五拾三次之内 庄野 白雨 | c. 1833/34 (AIC) | 도쿄 국립박물관 · 시카고 미술관 · 메트로폴리탄 미술관 | ja ColBase 156자 | 메트 CC0 |
| hiroshige-kuwana-shichiri-no-watashi | 東海道五拾三次之内 桑名 七里渡口 | 江戸時代・19世紀 (ColBase) | 도쿄 국립박물관 · 메트로폴리탄 미술관 | ja ColBase 122자 | 메트 CC0 |
| hiroshige-ohashi-atake-no-yudachi | 名所江戸百景 大はしあたけの夕立 | 江戸時代・安政4年(1857) (ColBase) | 도쿄 국립박물관 · 시카고 미술관 · 메트로폴리탄 미술관 | ja ColBase 107자 · en AIC 283자 | 메트 CC0 |
| hiroshige-kameido-umeyashiki | 名所江戸百景 亀戸梅屋舗 | 江戸時代・安政4年(1857) (ColBase) | 도쿄 국립박물관 · 시카고 미술관 · 레이크스 미술관 | ja ColBase 128자 · en AIC 380자 | 레이크스 CC0(위키미디어 공용 경유) |
| hiroshige-fukagawa-susaki-jumantsubo | 名所江戸百景 深川洲崎十万坪 | 江戸時代・安政4年(1857) (ColBase) | 도쿄 국립박물관 · 시카고 미술관 · 메트로폴리탄 미술관 | ja ColBase 119자 · en AIC 371자 | 메트 CC0 |

**둘째 묶음 (2026-10-14 KST)** — 전부 세 곳 소장 기록(도쿄 국립박물관 · 시카고 미술관 · 메트로폴리탄 미술관), 해설은 ColBase 일본어만, 그림은 메트 CC0.

| 작품 id | 작품 | 날짜 표기(출처) | 해설 |
|---|---|---|---|
| hokusai-gohyaku-rakanji-sazaido | 冨嶽三十六景 五百らかん寺さゞゐどう | c. 1830/33 (AIC) | ja ColBase 122자 |
| hokusai-onmayagashi-ryogokubashi-yuhimi | 冨嶽三十六景 御厩川岸より両国橋夕陽見 | c. 1830/33 (AIC) | ja ColBase 590자 |
| hiroshige-asakusa-kinryuzan | 名所江戸百景 浅草金龍山 | 江戸時代・安政3年(1856) (ColBase) | ja ColBase 127자 |
| hiroshige-komagatado-azumabashi | 名所江戸百景 駒形堂吾嬬橋 | 江戸時代・安政4年(1857) (ColBase) | ja ColBase 607자 |
| hiroshige-tsuki-no-misaki | 名所江戸百景 月の岬 | 江戸時代・安政4年(1857) (ColBase) | ja ColBase 118자 |
| hiroshige-asakusa-tanbo-torinomachi-mode | 名所江戸百景 浅草田甫 酉の町詣 | 江戸時代・安政4年(1857) (ColBase) | ja ColBase 659자 |
| hiroshige-ryogoku-hanabi | 名所江戸百景 両国花火 | 江戸時代・安政5年(1858) (ColBase) | ja ColBase 120자 |

**셋째 묶음 — 장르 확장 (ART-GENRE-001, 2026-10-18 KST)** — 근대 회화·옛 사진은 도쿄 국립박물관 소장(ColBase 해설 + ColBase CC BY 사진),
근대 건축은 국가 지정 문화재(문화유산 온라인 해설 CC BY 4.0 + 국립국회도서관 디지털화본 퍼블릭 도메인). 해설은 일본어만.

| 작품 id | 장르 | 작품 | 날짜 표기(출처) | 소장·소재지 | 해설 | 그림 |
|---|---|---|---|---|---|---|
| kuroda-seiki-dokusho | 회화 | 読書(구로다 세이키) | 明治24年(1891) (ColBase) | 도쿄 국립박물관 | ja ColBase 125자 | ColBase CC BY |
| asai-chu-gure-no-aki | 회화 | グレーの秋(아사이 주) | 明治34年(1901) (ColBase) | 도쿄 국립박물관 | ja ColBase 122자 | ColBase CC BY |
| kishida-ryusei-reiko-bisho | 회화 | 麗子微笑(기시다 류세이) | 大正10年(1921) (ColBase) | 도쿄 국립박물관 | ja ColBase 842자 | ColBase CC BY |
| yokoyama-matsusaburo-nikko-meisho-shashin | 사진 | 日光名勝写真(요코야마 마쓰사부로) | 明治2～3年(1869～70) (ColBase) | 도쿄 국립박물관 | ja ColBase 96자 | ColBase CC BY |
| yokoyama-matsusaburo-kyu-edojo-shashincho | 사진 | 旧江戸城写真帖(요코야마 마쓰사부로) | 明治4年(1871) (ColBase) | 도쿄 국립박물관 | ja ColBase 130자 | ColBase CC BY |
| uchida-kuichi-koraibashi | 사진 | 高麗橋(우치다 구이치) | 明治5年(1872) (ColBase) | 도쿄 국립박물관 | ja ColBase 129자 | ColBase CC BY |
| bastien-tomioka-silk-mill | 건축 | 旧富岡製糸場 繰糸所(바스티앙 도면) | 1872 (문화유산 온라인) | 도미오카 제사장(소재지) | ja 문화유산 온라인 494자 | 2대 우타가와 구니테루 니시키에 1872, 국립국회도서관 PD |
| katayama-tokuma-akasaka-palace | 건축 | 旧東宮御所（迎賓館赤坂離宮）(가타야마 도쿠마) | 1909 (문화유산 온라인) | 영빈관 아카사카 이궁(소재지) | ja 문화유산 온라인 278자 | 1909년 사진첩, 국립국회도서관 PD |
| tatsuno-kingo-tokyo-station | 건축 | 東京駅丸ノ内本屋(다쓰노 긴고) | 1914 (문화유산 온라인) | 도쿄역(소재지) | ja 문화유산 온라인 323자 | 1914년 철도원 간행물 사진, 국립국회도서관 PD(WebP → JPEG, 크기 그대로) |

셋째 묶음 큐레이션 `modern-western-painting-japan`(「近代洋画のはじまり」 N2 상급) · `meiji-early-photographs`(「明治初期の古写真」 N2 상급) ·
`meiji-taisho-architecture`(「明治・大正の近代建築」 N1)은 **아직 게시 책(`ART_PUBLISHED_CURATIONS`)이 아니다** — 뷰어 카드가 장르별 작가 칸(촬영·설계)과
「소재지」를 그리게 되는 후속(ART-READ-001 #1483 병합 뒤 장르 탭과 함께)에서 게시 책에 더한다.

**넣지 못한 작품(셋째 묶음 기록):** 湖畔(`cobas-159785`) — 일본어 해설 칸에 영어 해설이 이어 붙어 있어 제외(계약이 거부한다).
磯紡績所(`cobas-165850`) — 읽기 표시 「五代友厚＠ごだいともあつ＠」가 섞여 제외. 海の幸·生々流転(`bunka-199370`·`bunka-179952`) — 두 작품 해설이 같은 근대 미술 총론(1,048자)이라
작품 해설이 아니어서 제외(총론에 읽기 표시 【】도 섞여 있다). 旧富岡製糸場 전체(`bunka-212090`) — 1,533자로 상한 초과라 繰糸所 기록을 썼다.
국립서양미술관 등 국립미술관 소장품(재팬서치 `syozo`) — 작품 기록은 CC0이지만 해설 글이 없어 보류(오너 결정 2026-10-18 KST).
문화유산 온라인 해설 가운데 미술관이 올린 것(`provider`가 `bunkazai`가 아닌 것)은 쓰지 않는다.

큐레이션: `ukiyoe-landscape-hokusai-hiroshige`(여덟 점 연대순 · 게시 책 「北斎と広重の風景版画」 N2 상급) ·
`ukiyoe-landscape-hokusai-hiroshige-2`(둘째 묶음 일곱 점 연대순 · 게시 책 「続・北斎と広重の風景版画」 N2 상급 — 첫 책과 작품이 겹치지 않는다) ·
`katsushika-hokusai-fugaku`(5) · `utagawa-hiroshige-landscape`(10).

**넣지 못한 작품(기록):** 東海道 日本橋 朝之景·蒲原 夜之雪, 冨嶽三十六景 甲州石班沢·尾州不二見原 — ColBase·AIC 어디에도 해설이 없다.
冨嶽三十六景 山下白雨 — AIC 해설 1,547자로 상한(1,500자) 초과, 자르지 않으므로 제외. ColBase 영어 해설 `cobas-51489`(庄野)는
내부 메모가 섞여 있어 쓰지 않았다(일본어 해설만).
東海道五拾三次之内 宮 熱田神事(`cobas-55584`) — 해설 머리에 ColBase 읽기 표시 「宮＠みや＠は」가 섞여 있어 제외(원문을 고치지 않는다 — 계약이 읽기 표시를 거부한다).

## 넷째 묶음 — 시카고 미술관의 명화 (DISCOVER-ART-001, 2026-10-23 KST)

오너 「그림도 대중적으로 사람들에게 인기가 많을 법한 것들 위주로 먼저 — 한국인에게 박물관 작품은 어렵거나 관심 밖일 수 있다」 → 「권장대로 ㄱㄱ」.
고르는 기준은 한국에서의 익숙함(국내 대형 전시 · 교과서 · 굿즈)이고, 그림은 작가 1955년까지 사망 규칙 그대로다(호퍼 1967 · 피카소 1973 · 마그리트 1967 제외).
해설은 시카고 미술관 영어 해설(CC BY 4.0) — 기존 받기 경로 그대로, 1,500자 상한 안의 것만(고흐 「자화상」 1,692자는 제외).
그림은 시카고 미술관 디지털화본(퍼블릭 도메인)을 위키미디어 공용에서 받았다 — Wikidata 작품 항목의 P18이 가리키는 파일, 6점은 미술관이 직접 올린
「… - <소장 번호> - Art Institute of Chicago.jpg」, 2점(침실 · 그랑드자트)은 미술관이 제공한 Google Art Project 파일. 960px 썸네일을 긴 변 800px로 줄였다.

| 작품 id | 작품 | 날짜 표기(AIC) | 해설 | 한 줄 이야기 |
|---|---|---|---|---|
| van-gogh-bedroom | The Bedroom(고흐) | 1889 | en AIC 1,041자 | 고흐가 세 번이나 그린 「노란 집」의 자기 방 |
| monet-water-lilies | Water Lilies(모네) | 1906 | en AIC 1,261자 | 모네 스스로 「집착」이라 부른 연못 수면 |
| seurat-grande-jatte | A Sunday on La Grande Jatte — 1884(쇠라) | 1884–86, border added 1888–89 | en AIC 1,210자 | 가까이 가면 사람들이 색 점으로 흩어지는 그림 |
| monet-water-lily-pond | Water Lily Pond(모네) | 1900 | en AIC 578자 | 모네가 늪을 파서 만든 연못과 일본식 나무다리 |
| monet-stacks-of-wheat | Stacks of Wheat (End of Summer)(모네) | 1890–91 | en AIC 1,177자 | 한 방에 열다섯 점을 걸어 모네를 일으킨 연작 |
| renoir-two-sisters | Two Sisters (On the Terrace)(르누아르) | 1881 | en AIC 1,254자 | 제목은 「두 자매」, 사실은 남남인 두 모델 |
| caillebotte-paris-street-rainy-day | Paris Street; Rainy Day(카유보트) | 1877 | en AIC 1,326자 | 빗방울 없이 우산과 젖은 돌길로만 그린 비 |
| toulouse-lautrec-at-the-moulin-rouge | At the Moulin Rouge(툴루즈로트레크) | 1892–95 | en AIC 1,295자 | 물랭루주의 밤 — 화가 자신도 뒤편에 서 있다 |

큐레이션 `aic-famous-paintings`(「Famous Paintings at the Art Institute of Chicago」 · 시카고 미술관의 명화 · 영어 B2 상급) — 게시 책 맨 앞.
다음 묶음(3단계)은 프랑스어 쉬운 백과 비키디아(Vikidia, CC BY-SA 4.0) 받기 경로를 만든 뒤 「별이 빛나는 밤」 · 「키스」 · 「절규」 등.
