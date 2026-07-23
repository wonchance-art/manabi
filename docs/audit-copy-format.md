# T14 콘텐츠 문자열 규격 전수 QA

## 결론

- 기준점은 `origin/main` exact `a8ff50d992b399137bf978acc7545f8e5235f2eb`이다.
- 26도시의 런타임 `nodes[].desc` 415건, `NODE_FACTS` 85건, 주동선 발견 `line`
  23건, 칭호 `name` 4건·`line` 4건, 합계 531문자열을 전수 측정했다.
- 지정 길이 규격 위반은 0건이다. factLine·발견 line·칭호 line의 해요체 종결 위반도
  0건이며, 칭호 name은 종결 규격 대상이 아니다.
- 도시 desc에는 길이 상한 계약이 없다. 기존 desc 커버리지 하한 20자보다 짧은 문자열은
  0건(실측 최솟값 33자)이다. 다만 이 감사의 엄격한 표면 종결 기준
  `/요[.!?…]?$/u`에는 74건이 맞지 않는다.
- 531문자열 사이 완전 일치 중복은 0그룹이다. 85 factLine과 각 스탬프 앨범 노드 desc의
  짝 비교도 완전 일치 0건이다.
- 실존 상호·브랜드 가능성을 기계적으로 넓게 잡은 후보는 28건이다. 아래 표는
  **후보 목록일 뿐 위반 판정이 아니며, 채택·제외 판단은 Claude 몫**이다.
- report-only다. 런타임·도시 data/geo·registry·verifier·DB·카피·테스트는 수정하지 않았다.

## 범위와 판정법

| 항목 | 판정법 |
|---|---|
| 도시 desc | `CITY_MANIFEST` 26개를 `loadAllCities()`로 로드하고, kind와 무관하게 문자열인 `nodes[].desc` 전수 |
| 길이 단위 | 제품 테스트와 같은 JavaScript `String.length`(UTF-16 code unit), trim·정규화 없음 |
| factLine | 12~90자, `/요\.$/u` |
| 발견 line | 12~90자, 런타임 계약과 같은 `/요[.!?…]?$/u` |
| 칭호 name | 4~12자 |
| 칭호 line | 12~50자, `/요\.$/u` |
| 도시 desc 종결 | T14 QA 기준 `/요[.!?…]?$/u`; 현재 제품의 별도 fail-closed 계약은 아님 |
| 완전 중복 | 원문 문자열을 byte-equivalent 값으로 비교. 공백 접기·Unicode 정규화·구두점 제거 없음 |
| 금칙 후보 | 상업 조직 토큰, 따옴표 속 점포·시장·상업시설형 명칭, 대문자 라틴 약어를 보수적으로 수집 |

측정 입력은 도시 wrapper·geo 각 26개, manifest, factLine, 칭호 카피의 55파일이다.
파일별 SHA-256 정렬 manifest SHA-256은
`2be51057d2d3abb64b590168fc720682b6304b3ac92e47bd6b2276a6ae3e5520`이다.

## 규격 요약

| 범주 | 건수 | 실측 길이 | 지정 길이 | 길이 위반 | 해요체 종결 위반 |
|---|---:|---:|---:|---:|---:|
| 도시 desc | 415 | 33~151 | 별도 상한 없음 | 0 (`<20` 기준) | 74 |
| factLine | 85 | 28~58 | 12~90 | 0 | 0 |
| 발견 line | 23 | 35~54 | 12~90 | 0 | 0 |
| 칭호 name | 4 | 9~11 | 4~12 | 0 | 해당 없음 |
| 칭호 line | 4 | 26~29 | 12~50 | 0 | 0 |
| **합계** | **531** | — | — | **0** | **74** |

## 26도시 desc 전수표

`종결 불일치 id`는 문자열 전체의 마지막이 `/요[.!?…]?$/u`가 아닌 exact id다.
학습 슬롯의 괄호 속 문법 메모까지 문자열에 포함해 판정했다.

| 도시 | desc 수 | 길이 | 종결 불일치 | 종결 불일치 id |
|---|---:|---:|---:|---|
| fukuoka | 18 | 50~151 | 6 | `bayside-place`, `fukuoka-ippudo`, `fukuoka-ramen`, `hakata-port-international-terminal`, `nakasu`, `ohori-park` |
| tokyo | 38 | 33~103 | 7 | `ebisu-garden-place`, `hamarikyu-gardens`, `odaiba-seaside-park`, `rainbow-bridge`, `shibuya-scramble`, `tokyo-konbini`, `zojoji` |
| osaka | 10 | 60~107 | 1 | `osaka-konbini` |
| kyoto | 11 | 66~116 | 0 | — |
| busan | 14 | 41~95 | 0 | — |
| seoul | 23 | 40~90 | 1 | `gyeongbokgung` |
| grand-paris | 28 | 53~88 | 6 | `fr-01`~`fr-06` |
| mont-saint-michel | 10 | 35~131 | 6 | `msm-01`~`msm-06` |
| cote-dazur | 18 | 53~96 | 0 | — |
| brussels | 12 | 55~86 | 0 | — |
| taipei | 19 | 35~73 | 6 | `zh-01`~`zh-06` |
| hong-kong | 15 | 45~75 | 3 | `zh-07`~`zh-09` |
| london | 30 | 43~95 | 10 | `en-01`~`en-06`, `houses-of-parliament`, `piccadilly-circus`, `tower-of-london`, `westminster-abbey` |
| shanghai | 13 | 55~80 | 3 | `zh-10`~`zh-12` |
| beijing | 12 | 48~85 | 1 | `tiantan` |
| brisbane | 11 | 58~87 | 0 | — |
| sydney | 20 | 53~104 | 7 | `en-07`~`en-12`, `opera-house` |
| canberra | 10 | 52~105 | 0 | — |
| melbourne | 12 | 73~103 | 0 | — |
| marseille | 18 | 61~106 | 6 | `fr-07`~`fr-12` |
| kawaguchiko | 15 | 35~103 | 4 | `ja-01`~`ja-04` |
| geneva | 13 | 58~93 | 3 | `fr-13`~`fr-15` |
| leman-riviera | 15 | 51~96 | 3 | `fr-16`~`fr-18` |
| lyon | 12 | 39~95 | 0 | — |
| bordeaux | 10 | 44~90 | 0 | — |
| strasbourg | 8 | 39~97 | 1 | `strasbourg-gare-bretzel` |
| **합계** | **415** | **33~151** | **74** | — |

### desc 종결 불일치의 형태

- 52건은 다국어 학습 슬롯이다. 한국어 번역 뒤에 문법 메모가 붙어 문자열의 마지막이 `)`로
  끝난다: grand-paris 6, mont-saint-michel 6, taipei 6, hong-kong 3, london 6,
  shanghai 3, sydney 6, marseille 6, kawaguchiko 4, geneva 3, leman-riviera 3.
- 나머지 22건은 위 전수표의 일반 노드다. 대표 표면형은 `세계유산.`,
  `…할 곳.`, `…부산으로.`, 고유명사 뒤 마침표, 감탄형 `실 부 플레!`다.
- 이는 문자열의 **마지막 표면형** 감사다. 중간 문장에 해요체가 있어도 뒤에 부가 꼬리나
  메타 괄호가 있으면 통과로 세지 않았다.

## 위반·경계 사례

지정 길이 계약의 실제 위반은 없다. 다음은 각 범주의 실측 양 끝과 규격까지의 여유다.

| 범주 | 위치 | 길이 | ref | 가장 가까운 규격 경계까지 |
|---|---|---:|---|---:|
| factLine | 최소 | 28 | `NODE_FACTS/jiri` | 하한 +16 |
| factLine | 최대 | 58 | `NODE_FACTS/sydney` | 상한 -32 |
| 발견 line | 최소 | 35 | `strasbourg/strasbourg-d2`, `strasbourg/strasbourg-d3` | 하한 +23 |
| 발견 line | 최대 | 54 | `lyon/lyon-d3` | 상한 -36 |
| 칭호 name | 최소 | 9 | `stamp-10/name`, `stamp-85/name` | 하한 +5 |
| 칭호 name | 최대 | 11 | `stamp-30/name` | **상한 -1** |
| 칭호 line | 최소 | 26 | `stamp-10/line`, `stamp-60/line` | 하한 +14 |
| 칭호 line | 최대 | 29 | `stamp-30/line` | 상한 -21 |
| 도시 desc | 최소 | 33 | `tokyo/zojoji` | 지정 범위 없음 |
| 도시 desc | 최대 | 151 | `fukuoka/nakasu` | 지정 범위 없음 |

칭호 name의 `stamp-30`만 상한에서 1자 떨어진 실제 경계 사례다. 나머지 지정 규격 문자열은
가까운 경계에서도 5자 이상의 여유가 있다.

## 완전 중복

| 비교 | 결과 |
|---|---:|
| 531개 명시 범주 전체의 동일 원문 그룹 | 0 |
| 같은 범주 내부의 동일 원문 그룹 | 0 |
| factLine 85건과 짝이 되는 스탬프 앨범 desc | 0 |

## 실존 상호·브랜드 패턴 후보

아래는 기계 패턴에 걸린 전수 목록이다. 공공기관 약어·정식 시장명·지명형 상업시설도
의도적으로 포함했으며, 어느 항목도 이 문서에서 금칙 위반으로 판정하지 않는다.

| # | ref | 검출 표면 |
|---:|---|---|
| 1 | `beijing/qianmen-street` | `상호` |
| 2 | `brisbane/qagoma` | `QAGOMA`, `GOMA` |
| 3 | `brussels/comics-museum` | `BD` |
| 4 | `brussels/eu-quarter` | `EU` |
| 5 | `fukuoka/bayside-place` | `「ベイサイドプレイス博多」` |
| 6 | `fukuoka/fukuoka-ippudo` | `「一風堂 大名本店」` |
| 7 | `fukuoka/nakasu` | `「ドン・キホーテ中洲店」`, `一蘭 본사` |
| 8 | `fukuoka/ohori-park` | `스타벅스` |
| 9 | `kyoto/nishiki-market` | `「錦市場」`, 시장·상점·아케이드 문맥 |
| 10 | `leman-riviera/vevey-marche` | `「Place du Marché, Vevey」` |
| 11 | `london/borough-market` | `「Borough Market(버러마켓)」` |
| 12 | `london/en-06` | `B&B` |
| 13 | `lyon/halles` | `「Halles de Lyon」` |
| 14 | `melbourne/mcg` | `MCG` |
| 15 | `melbourne/queen-victoria-market` | `「Queen Victoria Market(퀸빅토리아마켓)」` |
| 16 | `osaka/kuromon-market` | `「黒門市場」`, 시장·상점·아케이드 문맥 |
| 17 | `seoul/ddp` | `DDP` |
| 18 | `sydney/qvb` | `「Queen Victoria Building(퀸빅토리아빌딩)」` |
| 19 | `tokyo/ameyoko` | `「アメヤ横丁」`, 시장 문맥 |
| 20 | `tokyo/ebisu-garden-place` | `「恵比寿ガーデンプレイス」` |
| 21 | `tokyo/ginza-4-chome` | `「銀座四丁目」` |
| 22 | `tokyo/jimbocho` | `「神保町古書店街」` |
| 23 | `tokyo/kappabashi` | `「かっぱ橋道具街」`, 전문점 문맥 |
| 24 | `tokyo/nakano-broadway` | `「中野ブロードウェイ」`, 상점 문맥 |
| 25 | `tokyo/omoide-yokocho` | `「思い出横丁」`, 노점 문맥 |
| 26 | `tokyo/toyosu-market` | `「豊洲市場」` |
| 27 | `tokyo/tsukiji-outer-market` | `「築地場外市場」`, 시장 문맥 |
| 28 | `tokyo/yanaka-ginza` | `「谷中銀座」`, 상점·가게 문맥 |

## 결정성·재현

- 환경: Node `v22.23.1` official nvm.
- one-shot A/B: 각 54,918 bytes, byte-identical.
- one-shot SHA-256 A/B:
  `1e5cc1ea4eee66ed958f999b0b68fda4afcb0c7b03921b9258b70995c2407c35`.
- max RSS A/B: 723,792 / 734,640 KiB.
- one-shot JSON은 base exact, 입력 manifest SHA, 26도시별 통계, 모든 위반 원문,
  완전 중복 그룹, 28개 후보와 경계 사례를 고정 순서로 담았다.
- targeted 콘텐츠 계약: 5 files / 19 tests PASS / 29.32s.
- full single-worker: 220 files / 2,184 tests PASS / 228.54s.
- `npm run lint`, 보고서 26도시·415 desc·74 종결 불일치·28 후보 자동 대조,
  `git diff --check`를 통과했다.
