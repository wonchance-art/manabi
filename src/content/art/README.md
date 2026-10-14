# 「그림 한 장 읽기」 정본 카탈로그

설계: 2026-10-14 KST 오너 승인(「좋아 가보자」) — 미술관 해설을 읽기 자료로, 작품 정보(작가·시기·소장처·그림 속 장소)를
개체로 쌓아 시기·작가 특집으로 큐레이션한다. 첫 큐레이션은 **호쿠사이·히로시게 풍경 우키요에**.

이 폴더는 **정본**이다. 형식·규칙은 `src/lib/artCatalog.js`(`validateArtCatalog`)가 정하고 `artCatalog.test.js`가 CI에서 잡는다.
ART-P0-1은 형식과 계약만 싣는다(작품 0점). 화면·게시는 원문을 받은 뒤(ART-P0-2).

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
- **날짜는 출처 표기 그대로** `date.text`(「天保2～5年頃」, 「ca. 1830–32」), 정렬·묶음은 `startYear`·`endYear`·`certainty`(exact|circa|range).
- **해설 본문**은 허용 라이선스만: `jp-gov-standard-2.0`(ColBase) · `cc-by-4.0`(시카고 미술관) · `cc-by-sa-4.0`(위키백과) · `cc0`.
  `credit`(크레딧 줄)·HTTPS `sourceUrl`·`textSha256` 필수 — 받은 원문을 고치면 해시가 어긋나 테스트가 실패한다. 1,500자 상한(목표 200–600자).
- **이미지**는 `public-domain`·`cc0`만, `alt`(한국어 대체 텍스트) 필수. 저작권이 남은 작품은 `image` 없이 해설만.
- 민감 소장처(반환 논쟁·중화권)는 이름·도시 같은 **사실만** 적는다.

## 작품 추가 절차 (ART-P0-2)

1. 작품을 고르고 Wikidata에서 작품·작가·소장처 QID를 확인한다.
2. 해설 원문을 출처에서 그대로 받는다(ColBase 解説文 / 시카고 미술관 `description`). 내용을 손대지 않는다.
   `textSha256` = 받은 텍스트의 SHA-256.
3. 작가 생애 요약·이미지 대체 텍스트·핵심 용어·찾아볼 것은 우리가 쓴다.
4. `npm test`로 계약 통과를 확인한다.

**네트워크:** 원문을 받으려면 클라우드 환경에 `colbase.nich.go.jp`·`jpsearch.go.jp`·`www.wikidata.org`·`query.wikidata.org`·`api.artic.edu`
허용이 필요하다(2026-10-14 기준 기본 환경에서는 차단).
