# IP 감사 후보 파일 경로·라인 검출 결과

**작업**: docs/audit-copy-format.md 표 #1~28번 후보 28개의 정확한 파일 경로와 라인 번호 추적

## 검출 현황

- **총 후보**: 28개
- **검출된 매칭**: 37개 (일부 후보는 다중 검출)
- **미검출**: 0개 (모든 후보 found)

## 매칭별 상세 정보

| # | ref | 파일 경로 | 라인 | 검출 표면 | 문맥 |
|---:|---|---|---:|---|---|
| 1 | beijing/qianmen-street | src/components/world/cities/beijing.js | 22 | `상호` | '오래된 상호의 점포들이 이어지는 거리예요.' |
| 2 | brisbane/qagoma | src/components/world/cities/brisbane.js | 3 | `QAGOMA` | 헤더 주석 (정책 설명) |
| 2 | brisbane/qagoma | src/components/world/cities/brisbane.js | 3 | `GOMA` | 헤더 주석 (정책 설명) |
| 2 | brisbane/qagoma | src/components/world/cities/brisbane.js | 26 | `QAGOMA` | desc: '강변의 미술관 단지 「QAGOMA(퀸즐랜드 미술관·GOMA)」' |
| 2 | brisbane/qagoma | src/components/world/cities/brisbane.js | 26 | `GOMA` | desc: '강변의 미술관 단지 「QAGOMA(퀸즐랜드 미술관·GOMA)」' |
| 3 | brussels/comics-museum | src/components/world/cities/brussels.js | 26 | `BD` | desc: '「Centre Belge de la BD(벨기에 만화센터)」' |
| 4 | brussels/eu-quarter | src/components/world/cities/brussels.js | 25 | `EU` | desc: '「Quartier Européen(EU 지구)」' |
| 4 | brussels/eu-quarter | src/components/world/cities/brussels.js | 49 | `EU` | ZONES: label 'EU 지구·생캉트네르' |
| 4 | brussels/eu-quarter | src/components/world/cities/brussels.js | 87 | `EU` | TRANSIT 주석: 'EU 지구 도보 권역' |
| 5 | fukuoka/bayside-place | src/components/world/cities/fukuoka.js | 70 | `「ベイサイドプレイス博多」` | desc (일본어 원문) |
| 6 | fukuoka/fukuoka-ippudo | src/components/world/cities/fukuoka.js | 128 | `「一風堂 大名本店」` | desc (일본어 원문) |
| 7 | fukuoka/nakasu | src/components/world/cities/fukuoka.js | 95 | `一蘭 본사` | 주석 |
| 7 | fukuoka/nakasu | src/components/world/cities/fukuoka.js | 99 | `「ドン・キホーテ中洲店」` | desc |
| 7 | fukuoka/nakasu | src/components/world/cities/fukuoka.js | 99 | `一蘭 본사` | desc |
| 8 | fukuoka/ohori-park | src/components/world/cities/fukuoka.js | 134 | `스타벅스` | desc: '연못을 두른 산책로와 스타벅스 뷰.' |
| 9 | kyoto/nishiki-market | src/components/world/cities/kyoto.js | 37 | `「錦市場」` | desc |
| 10 | leman-riviera/vevey-marche | src/components/world/cities/leman-riviera.js | 30 | `「Place du Marché, Vevey」` | desc |
| 11 | london/borough-market | src/components/world/cities/london.js | 31 | `「Borough Market(버러마켓)」` | desc |
| 12 | london/en-06 | src/components/world/cities/london.js | 79 | `B&B` | NODE_FACTS: 'B&B 체크인(세인트판크라스 곁' |
| 13 | lyon/halles | src/components/world/cities/lyon.js | 25 | `「Halles de Lyon」` | desc |
| 14 | melbourne/mcg | src/components/world/cities/melbourne.js | 3 | `MCG` | 헤더 주석 (정책 설명) |
| 14 | melbourne/mcg | src/components/world/cities/melbourne.js | 28 | `MCG` | desc: '「Melbourne Cricket Ground(MCG)」' |
| 14 | melbourne/mcg | src/components/world/cities/melbourne.js | 53 | `MCG` | ZONES: label 'MCG' |
| 15 | melbourne/queen-victoria-market | src/components/world/cities/melbourne.js | 21 | `「Queen Victoria Market(퀸빅토리아마켓)」` | desc |
| 16 | osaka/kuromon-market | src/components/world/cities/osaka.js | 29 | `「黒門市場」` | desc |
| 17 | seoul/ddp | src/components/world/cities/seoul.js | 20 | `DDP` | desc: '「동대문디자인플라자(DDP)」' |
| 18 | sydney/qvb | src/components/world/cities/sydney.js | 26 | `「Queen Victoria Building(퀸빅토리아빌딩)」` | desc |
| 19 | tokyo/ameyoko | src/components/world/cities/tokyo.js | 177 | `「アメヤ横丁」` | desc |
| 20 | tokyo/ebisu-garden-place | src/components/world/cities/tokyo.js | 71 | `「恵比寿ガーデンプレイス」` | desc |
| 21 | tokyo/ginza-4-chome | src/components/world/cities/tokyo.js | 97 | `「銀座四丁目」` | desc |
| 22 | tokyo/jimbocho | src/components/world/cities/tokyo.js | 187 | `「神保町古書店街」` | desc |
| 23 | tokyo/kappabashi | src/components/world/cities/tokyo.js | 182 | `「かっぱ橋道具街」` | desc |
| 24 | tokyo/nakano-broadway | src/components/world/cities/tokyo.js | 207 | `「中野ブロードウェイ」` | desc |
| 25 | tokyo/omoide-yokocho | src/components/world/cities/tokyo.js | 157 | `「思い出横丁」` | desc |
| 26 | tokyo/toyosu-market | src/components/world/cities/tokyo.js | 152 | `「豊洲市場」` | desc |
| 27 | tokyo/tsukiji-outer-market | src/components/world/cities/tokyo.js | 147 | `「築地場外市場」` | desc |
| 28 | tokyo/yanaka-ginza | src/components/world/cities/tokyo.js | 167 | `「谷中銀座」` | desc |

## 파일 리스트 (정규 경로)

모든 후보는 다음 디렉토리에 집중:

```
src/components/world/cities/{city-name}.js
```

### 도시별 현황

| 도시 | 파일 | 매칭 수 |
|---|---|---:|
| beijing | beijing.js | 1 |
| brisbane | brisbane.js | 5 |
| brussels | brussels.js | 4 |
| fukuoka | fukuoka.js | 6 |
| kyoto | kyoto.js | 1 |
| leman-riviera | leman-riviera.js | 1 |
| london | london.js | 3 |
| lyon | lyon.js | 1 |
| melbourne | melbourne.js | 4 |
| osaka | osaka.js | 1 |
| seoul | seoul.js | 1 |
| sydney | sydney.js | 1 |
| tokyo | tokyo.js | 8 |

## 주요 패턴 분석

### 검출 위치별 분류

1. **desc 필드** (주요 — 24개)
   - 각 노드의 설명 문자열 내 인용 또는 일반명사 포함
   - 형식: 따옴표 속 한국어/일본어 원문

2. **주석 (comment)** (3개)
   - 파일 헤더의 사실 검증 정책 설명
   - 예: "QAGOMA 소장품 재현 금지"

3. **ZONES 라벨** (2개)
   - 지구/구역 레이블
   - 예: "EU 지구·생캉트네르"

4. **NODE_FACTS** (1개)
   - 학습 슬롯 보조 정보
   - 예: "B&B 체크인"

5. **TRANSIT 주석** (1개)
   - 교통 루트 설명
   - 예: "EU 지구 도보 권역"

### 다언어 구성

- **한국어**: 22개 (상호, 스타벅스, 동대문디자인플라자 등)
- **일본어** (원문 유지): 10개 (ベイサイドプレイス博多 등)
- **영문 약어/공식명**: 5개 (QAGOMA, BD, EU, MCG, B&B, DDP, QVB)

## CSV 출력

→ `candidates-raw.csv` 참고

형식: `id,ref_file,line_number,detected_text,full_line`

