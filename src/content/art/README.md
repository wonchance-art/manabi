# 「그림 한 장 읽기」 정본 카탈로그

설계: 2026-10-14 KST 오너 승인(「좋아 가보자」) — 미술관 해설을 읽기 자료로, 작품 정보(작가·시기·소장처·그림 속 장소)를
개체로 쌓아 시기·작가 특집으로 큐레이션한다. 첫 큐레이션은 **호쿠사이·히로시게 풍경 우키요에**.

이 폴더는 **정본**이다. 형식·규칙은 `src/lib/artCatalog.js`(`validateArtCatalog`)가 정하고 `artCatalog.test.js`가 CI에서 잡는다.
ART-P0-1은 형식과 계약, **ART-P0-2는 실물 여덟 점**(아래 「수록 작품」)을 싣는다. 화면 진입점은 아직 0 — 정보 카드·큐레이션 책 화면은 ART-P0-3.

## 파일

| 파일 | 개체 | 정규 키 |
|---|---|---|
| `periods.json` | 시대(문화권별 라벨 + 연도 범위) | 우리 id(`jp-edo`) |
| `artists.json` | 작가 — 이름(원어·한국어·읽기), 생몰년, **생애 요약(우리가 쓴 한국어, 400자 이하)** | Wikidata QID |
| `places.json` | 장소 — 소장처·그림 속 장소·제작지, 좌표, 지역학 핀(`links.studiesPin`) | Wikidata QID |
| `works.json` | 작품 — 제목, 날짜(원문 표기 + 연도 범위), 재료·기법, 장소(역할별), 해설, 핵심 용어 ≤3, 찾아볼 것 ≤3, 이미지 | Wikidata QID |
| `curations.json` | 큐레이션 — 작가·시대·주제 묶음(두 점 이상, 순서 있음) | 우리 id |

## 규칙 (계약 테스트가 강제)

- **전시 여부를 저장하지 않는다.** `onView`·`onDisplay`·`exhibited`·`gallery`·`room` 키 금지. 화면은 늘 「소장」, 전시 여부는 원문 링크로.
- **장소 역할은 셋**: `holding`(소장) · `depicted`(그림 속 장소) · `made`(제작지). 소장처 하나 이상. 같은 판화를 여러 곳이 소장하면 `holding`을 여럿.
  `holding`에는 그 기관의 소장품 기록 HTTPS `url`이 필수 — 전시 여부·자세한 정보는 이 링크에서 본다.
- **날짜는 출처 표기 그대로** `date.text`(「江戸時代・安政4年(1857)」, 「c. 1830/33」)와 그 표기를 가져온 `date.source`(colbase|aic),
  정렬·묶음은 `startYear`·`endYear`·`certainty`(exact|circa|range). 출처 표기가 「江戸時代・19世紀」처럼 넓으면 연도 범위는 연작 간행 연도로 좁힌다(호에이도판 도카이도 1833–34).
- **해설 본문**은 허용 라이선스만: `jp-gov-standard-2.0`(ColBase) · `cc-by-4.0`(시카고 미술관) · `cc-by-sa-4.0`(위키백과) · `cc0`.
  `credit`(크레딧 줄)·HTTPS `sourceUrl`·`textSha256` 필수 — 받은 원문을 고치면 해시가 어긋나 테스트가 실패한다. 1,500자 상한(목표 200–600자).
  `source`는 `colbase`(id `cobas-<번호>`) · `aic`(id 숫자)만. 박물관 내부 메모(「(20131029_h21・22)」 같은 작업 번호)가 섞인 해설은 싣지 않는다.
- **이미지**는 `public-domain`·`cc0`만, `alt`(한국어 대체 텍스트) 필수. 저작권이 남은 작품은 `image` 없이 해설만.
  지금은 **시카고 미술관의 퍼블릭 도메인 작품 이미지(CC0)** 만 쓴다(`credit` = 미술관이 요청한 캡션 「Artist. Title, Date. The Art Institute of Chicago.」).
  ColBase 이미지는 권리 구분이 CC BY(`ccby`)라 이 허용 목록 밖이다 — 쓰려면 허용 목록·출처 표기 계약부터 바꾼다(오너 결정).
- 민감 소장처(반환 논쟁·중화권)는 이름·도시 같은 **사실만** 적는다.

## 출처와 라이선스 (2026-10-14 KST 원문 대조)

| 출처 | 해설 받는 곳 | 해설 라이선스 | 이미지 | 크레딧 |
|---|---|---|---|---|
| ColBase(국립문화재기구) | 재팬서치 항목 API `https://jpsearch.go.jp/api/item/cobas-<번호>`의 `common.description`(일본어)·`descriptionEn`(영어). ColBase 자체 API는 키가 필요하다 | ColBase 이용규약 = 정부표준이용규약 2.0 준거(CC BY 4.0 호환). 재팬서치의 ColBase `metadataRights`도 같은 규약 | `ccby` — 쓰지 않음 | 「출처: ColBase(국립문화재기구) · 도쿄 국립박물관 소장 · 재팬서치 경유 · 표시 형식만 정리(HTML 태그)」 + 원문 페이지 `sourceUrl` |
| 시카고 미술관(AIC) | `https://api.artic.edu/api/v1/artworks/<id>`의 `description`(HTML) | CC BY 4.0(`description` 필드만, 나머지는 CC0) | `is_public_domain`이면 CC0, IIIF `…/full/843,/0/default.jpg` 핫링크 허용 | 「해설: Art Institute of Chicago · CC BY 4.0 · 표시 형식만 정리(HTML 태그)」 |
| Wikidata | QID·좌표·라벨 | CC0 | — | 의무 없음 |

- 「표시 형식만 정리」 — ColBase 규약은 편집·가공 시 그 사실을 따로 적으라고 한다. 우리는 HTML 태그를 벗기고 줄바꿈을 맞출 뿐 낱말은 바꾸지 않지만, 그것도 적는다.
- 발췌·번역은 하지 않는다(하면 「…를 바탕으로 발췌·번역」으로 표기를 바꿔야 한다). 1,500자를 넘는 해설은 자르지 않고 싣지 않는다.

## 작품 추가 절차

1. 작품을 고르고 Wikidata에서 작품(P170 작가 일치)·작가·소장처·그림 속 장소 QID와 좌표를 확인한다.
2. 해설 원문을 받는다 — `node scripts/fetch-art-description.mjs colbase cobas-<번호> [en]` 또는 `… aic <id>`.
   출력의 `text`·`textSha256`·`sourceUrl`을 그대로 `works.json`에 넣는다. 응답 → text 변환은 `src/lib/artSource.js`의
   `artSourceText` 하나뿐이다(태그 벗기기·엔티티 풀기·줄바꿈 맞추기 — 낱말·문장부호·문단 머리 전각 공백은 그대로).
   해설이 붙은 레코드가 연작(부모)인지 낱장(자식)인지 확인해 `sourceUrl`을 해설이 실제로 붙은 레코드로 둔다.
3. 작가 생애 요약·제목 한국어·이미지 대체 텍스트·핵심 용어(해설에 실제로 나오는 일본어)·찾아볼 것은 우리가 쓴다.
4. `npm test`로 계약 통과를 확인한다. 출처 쪽 해설이 바뀌었는지는 `node scripts/fetch-art-description.mjs --verify`(네트워크)로 대조한다.

**네트워크:** `colbase.nich.go.jp`·`jpsearch.go.jp`·`www.wikidata.org`·`query.wikidata.org`·`api.artic.edu`는 2026-10-14 클라우드 환경에서 열려 있다
(Node `fetch`는 `NODE_USE_ENV_PROXY=1`). `www.artic.edu`(IIIF 이미지 호스트)는 닫혀 있어 이미지 URL의 200 응답은 화면 단계(ART-P0-3)에서 브라우저로 확인한다.

## 수록 작품 (2026-10-14 KST, ART-P0-2)

| 작품 id | 작품 | 날짜 표기(출처) | 소장(기록) | 해설 | 이미지 |
|---|---|---|---|---|---|
| hokusai-kanagawa-oki-nami-ura | 冨嶽三十六景 神奈川沖浪裏 | 1830/33 (AIC) | 도쿄 국립박물관 · 시카고 미술관 | ja ColBase 623자 · en AIC 886자 | AIC CC0 |
| hokusai-gaifu-kaisei | 冨嶽三十六景 凱風快晴 | c. 1830/33 (AIC) | 도쿄 국립박물관 · 시카고 미술관 | ja ColBase 625자 · en ColBase 1,195자 | AIC CC0 |
| hokusai-bushu-tamagawa | 冨嶽三十六景 武州玉川 | c. 1830/33 (AIC) | 도쿄 국립박물관 · 시카고 미술관 | ja ColBase 465자 | AIC CC0 |
| hiroshige-shono-hakuu | 東海道五拾三次之内 庄野 白雨 | c. 1833/34 (AIC) | 도쿄 국립박물관 · 시카고 미술관 | ja ColBase 156자 | AIC CC0 |
| hiroshige-kuwana-shichiri-no-watashi | 東海道五拾三次之内 桑名 七里渡口 | 江戸時代・19世紀 (ColBase) | 도쿄 국립박물관 | ja ColBase 122자 | 없음 |
| hiroshige-ohashi-atake-no-yudachi | 名所江戸百景 大はしあたけの夕立 | 江戸時代・安政4年(1857) (ColBase) | 도쿄 국립박물관 · 시카고 미술관 | ja ColBase 107자 · en AIC 283자 | AIC CC0 |
| hiroshige-kameido-umeyashiki | 名所江戸百景 亀戸梅屋舗 | 江戸時代・安政4年(1857) (ColBase) | 도쿄 국립박물관 · 시카고 미술관 | ja ColBase 128자 · en AIC 380자 | AIC CC0 |
| hiroshige-fukagawa-susaki-jumantsubo | 名所江戸百景 深川洲崎十万坪 | 江戸時代・安政4年(1857) (ColBase) | 도쿄 국립박물관 · 시카고 미술관 | ja ColBase 119자 · en AIC 371자 | AIC CC0 |

큐레이션: `ukiyoe-landscape-hokusai-hiroshige`(여덟 점 연대순) · `katsushika-hokusai-fugaku`(3) · `utagawa-hiroshige-landscape`(5).

**넣지 못한 작품(기록):** 東海道 日本橋 朝之景·蒲原 夜之雪, 冨嶽三十六景 甲州石班沢·尾州不二見原 — ColBase·AIC 어디에도 해설이 없다.
冨嶽三十六景 山下白雨 — AIC 해설 1,547자로 상한(1,500자) 초과, 자르지 않으므로 제외. ColBase 영어 해설 `cobas-51489`(庄野)는
내부 메모가 섞여 있어 쓰지 않았다(일본어 해설만).
