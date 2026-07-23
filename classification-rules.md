# IP 후보 분류 기준

## 분류 정의

### A: 명백한 실존 고유 상호/브랜드
- 특정 기업/체인의 정식 상호명 그대로 사용
- 예: Starbucks, Ippudo, Don Quijote 등
- 지역학적 문맥이어도 고유 상호가 정확히 드러나면 A

### B: 일반명사/지리명/보통명칭
- 상품 분류(시장, 거리, 아케이드)를 의미하는 일반명사
- 지리적 고유명(산, 강, 건축물명) — 건축 외관만 언급한 경우
- 공개기관 시설명이지만 고유 브랜드 상호 아님
- 예: "시장", "거리", "역전 카페" (제네릭), "공항터미널"
- B로 분류해도 대체 표현 1개 제안

### C: 경계 (실존 명칭과 겹치지만 일반 표현으로도 읽힘)
- 실존 장소명이지만 맥락에서 건축물/장소 설명처럼 보임
- 예: "거리", "광장", "시장" (일반명사도, 고유지명도)
- 근거 메모: 왜 경계인지 1줄 설명
- 대체 표현 제안

### 공개기관 약어 (별도 열)
- 정식명(한글): 
- 실명 여부(예: DDP = Design Space):
- 일반화 대체안: 1개

## 28개 후보 초기 분류 스케치 (지식 기반)

| # | ref | 검출 표면 | 예상 분류 | 근거 스케치 |
|---|---|---|---|---|
| 1 | beijing/qianmen-street | 상호 | B | "상호"는 일반명사 / 청먼대가는 지리명 |
| 2 | brisbane/qagoma | QAGOMA, GOMA | A | QAGOMA = Queensland Art Gallery/Museum, 박물관 정식명 |
| 3 | brussels/comics-museum | BD | B | BD = "Bande Dessinée"(만화), 장르 약자 아님 — comics 맥락에서 일반 |
| 4 | brussels/eu-quarter | EU | B | EU 기구 약자, 지역명 수식 |
| 5 | fukuoka/bayside-place | 「ベイサイドプレイス博多」 | A | 정식 쇼핑센터명 |
| 6 | fukuoka/fukuoka-ippudo | 「一風堂 大名本店」 | A | Ippudo(이찌부타) 정식 라면 체인 |
| 7 | fukuoka/nakasu | 「ドン・キホーテ中洲店」 | A | Don Quijote 정식 체인점 |
| 7 | fukuoka/nakasu | 一蘭 본사 | A | 일랑(Ichiran) 정식 라면 브랜드 |
| 8 | fukuoka/ohori-park | 스타벅스 | A | Starbucks 정식 브랜드 |
| 9 | kyoto/nishiki-market | 「錦市場」 | B | 교토 명물 시장이지만 역사적 지리명(일반명사 아님) — 경계 |
| 10 | leman-riviera/vevey-marche | 「Place du Marché, Vevey」 | B | Vevey는 지명, 마르셰는 장소명(일반 광장) |
| 11 | london/borough-market | 「Borough Market」 | B | "Borough Market" 역사 시장이지만 일반명사 문맥 |
| 12 | london/en-06 | B&B | B | Bed & Breakfast = 여관 분류, 고유브랜드 아님 |
| 13 | lyon/halles | 「Halles de Lyon」 | B | Halles = 시장(일반명사), de Lyon = 지역 수식 |
| 14 | melbourne/mcg | MCG | A | Melbourne Cricket Ground 정식 스포츠 경기장 |
| 15 | melbourne/queen-victoria-market | 「Queen Victoria Market」 | B | 역사 시장명이지만 일반명사 문맥 |
| 16 | osaka/kuromon-market | 「黒門市場」 | B | 오사카 전통시장 지리명 + 시장(일반명사) |
| 17 | seoul/ddp | DDP | A | DDP = Dongdaemun Design Plaza 설계 건축물 정식명 |
| 18 | sydney/qvb | 「Queen Victoria Building」 | B | QVB = 역사 건축물, 상호 아님 |
| 19 | tokyo/ameyoko | 「アメヤ横丁」 | B | 도쿄 상업 거리(역사), 일반 시장/거리 문맥 |
| 20 | tokyo/ebisu-garden-place | 「恵比寿ガーデンプレイス」 | A | 정식 쇼핑/상업 단지명 |
| 21 | tokyo/ginza-4-chome | 「銀座四丁目」 | B | 지역명(사거리), 상호 아님 |
| 22 | tokyo/jimbocho | 「神保町古書店街」 | B | 지역명 + 거리 문맥 |
| 23 | tokyo/kappabashi | 「かっぱ橋道具街」 | B | 지역명(거리) + "도구거리"(일반명사) |
| 24 | tokyo/nakano-broadway | 「中野ブロードウェイ」 | A | 정식 상업건축물명 |
| 25 | tokyo/omoide-yokocho | 「思い出横丁」 | B | "횡초"(골목) = 일반명사, 역사 지역명 |
| 26 | tokyo/toyosu-market | 「豊洲市場」 | B | 도쿄 공식 시장(지리명), 시장(일반명사) |
| 27 | tokyo/tsukiji-outer-market | 「築地場外市場」 | B | 도쿄 시장(역사), 시장 + 외부(일반명사) |
| 28 | tokyo/yanaka-ginza | 「谷中銀座」 | B | 지역명(은좌) + 상점 거리(일반명사) |

## 예상 결과
- A (명백한 브랜드): ~8-10건
- B (일반명사/지리명): ~15-17건
- C (경계): ~3-5건
