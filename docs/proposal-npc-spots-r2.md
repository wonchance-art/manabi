# 정본 7도시 21지구 NPC 후보 스팟 실측 — 채움 라운드 2

## 결론

`district-v1` 정본 7도시에서 채움 라운드 1이 이미 담당한 리옹 3지구와 보르도·스트라스부르의
빈 역 2지구를 제외한 나머지 21개 콘텐츠 지구에 NPC 후보를 2개씩, 총 42개 제안한다.
42개 모두 지구 rect 안의 보행 가능·비EXIT 타일이며 cardinal 4방 중 적어도 한 칸으로
계속 걸어 나갈 수 있다.

현재 runtime의 노드·역·도선·소품·입구·EXIT·주동선 발견/소품과의 Chebyshev 이격은
최소 3타일이고, 이번 후보끼리도 같은 도시 안에서 최소 3타일 떨어진다. 리옹·보르도·
스트라스부르의 대상 5지구 10후보는 전부 현재 `mainRoute` 위(R0)다. 나머지 16지구는
역·POI·광장 가까운 T8 우선 후보를 최신 정본에서 다시 검증했다.

각 지구의 역할 1줄은 공간 성격에 맞춘 일반 업종·공공 역할만 적었다. 상호·인명·대사·
콘텐츠 배선은 포함하지 않으며 최종 역할과 좌표는 Claude가 확정한다.

## 범위 정합

- 측정 정본: `origin/main` `9831ef91d1c43e1251f9725b9ec7df45b4e7b281`, Node
  `v22.23.1`.
- 게시 직전 `main`은 T12·S8 후속 merge로
  `a8ff50d992b399137bf978acc7545f8e5235f2eb`까지 전진했지만, 변경 6경로는 아래 17개
  측정 입력 및 이 보고서와 비중첩이다.
- 도시 순서: `lyon`, `bordeaux`, `strasbourg`, `seoul`, `busan`, `cote-dazur`,
  `leman-riviera`; 지구는 각 `districts.open` source order를 유지했다.
- 7도시의 open 항목은 28개다. 보르도·스트라스부르의 `route-corridor` 2개는
  콘텐츠 지구가 아니라 주동선 안전 마스크이므로 T7/T8과 같이 제외했다. 콘텐츠 지구 26개에서
  아래 채움 완료 5개를 빼면 이번 대상은 정확히 21개다.
  - 리옹 `presquile-confluence`, `vieux-lyon-fourviere`, `terreaux-croix-rousse`
  - 보르도 `gare-saint-jean`, 스트라스부르 `gare`
- T8 `docs/proposal-npc-door-spots.md`의 전수 후보군에서 각 대상 지구 우선 2안을 입력으로
  삼되, 당시 결과를 그대로 승인하지 않고 최신 grid·지구 rect·현재 마커·주동선으로 모든
  판정을 다시 계산했다. 채움 완료 5개 NPC도 현재 `nodes`를 통해 이격 마커에 포함된다.
- 입력은 7개 wrapper·7개 geo와 `terrain.js`, `cityDistricts.js`, `cityMainRoute.js`의
  정렬 17파일이다. 입력 manifest SHA-256은
  `4626367f02dfcc14b32772ec8e93ef479d24d1b5d3a397f45fd3dd6cd102f83f`다.

## 판정 규칙과 표기

- 유효 타일: 대상 지구 rect 합집합 안이며 `WATER/RIVER/BUILDING/ISLAND/MOUNTAIN/EXIT`가
  아니고, cardinal 4방 중 적어도 한 칸이 보행 가능·비EXIT여야 한다.
- 기존 마커 `C`: runtime `nodes`, `stations`, `transitPoints`, `props`, `entrance`, 모든
  EXIT, resolved `mainRoute.discoveries`와 경로 소품을 합친 집합까지의 최소 Chebyshev 거리다.
  모든 후보가 `C3` 이상이다.
- 후보 이격 `S`: 이번 표에서 같은 도시의 다른 후보까지 최소 Chebyshev 거리다.
  모든 후보가 `S3` 이상이므로 여러 지구의 후보를 함께 골라도 겹치거나 바로 붙지 않는다.
- `R0`은 주동선 위, `M<n>`은 역·POI·도선 등 가장 가까운 우선 앵커까지 Manhattan 거리,
  `P<n>`은 가장 가까운 PLAZA 지형까지 Manhattan 거리다. PLAZA가 없는 레만호 연안은 `P—`다.
- 한 후보 설명에 `C`와 우선 앵커가 다르면 둘을 모두 썼다. 지구별 1안·2안 순서는 T8의
  결정 순위이며 자동 승인 순위가 아니다.

## 21지구 후보·역할 전수표

| 도시 | 콘텐츠 지구 | NPC 후보 1안 | NPC 후보 2안 | 지구 성격 기반 NPC 역할 제안 |
|---|---|---|---|---|
| 리옹 | 론 강변·파르디외 (`rhone-part-dieu`) | `(234,209)` SIDEWALK · R0 · `node:halles` C3 · P4 · S31 | `(265,217)` ROAD · R0 · `station:part-dieu` M7 · `route-prop:route_streetlight-17` C3 · P6 · S31 | 실내 시장 식료품 상인 — 업무 지구와 시장을 오가는 손님에게 품목·수량·길을 안내하는 역할. |
| 보르도 | 역사 지구 (`centre-historique`) | `(270,248)` ROAD · R0 · `node:grosse-cloche` C3/M3 · P38 · S54 | `(263,194)` SIDEWALK · R0 · `node:place-des-quinconces` C3/M3 · P57 · S19 | 구시가 제과점 직원 — 보행 상점가에서 빵의 종류·수량·포장 여부를 안내하는 역할. |
| 보르도 | 샤르트롱·북강변 (`nord-rive`) | `(249,175)` ROAD · R0 · `node:jardin-public` C3/M4 · P62 · S19 | `(275,151)` ROAD · R0 · `node:chartrons` C3/M4 · P112 · S26 | 골동품점 직원 — 옛 상업 거리에서 물건의 상태·용도·가격을 설명하는 역할. |
| 스트라스부르 | 그랑딜 (`grande-ile`) | `(149,281)` SIDEWALK · R0 · `node:petite-france` C3/M3 · P52 · S31 | `(132,250)` SIDEWALK · R0 · `station:gare-de-strasbourg` M4 · `entrance` C4 · P74 · S31 | 구시가 서점 직원 — 광장과 골목을 찾는 방문객에게 책 분야와 위치를 안내하는 역할. |
| 스트라스부르 | 유럽 지구 (`quartier-europeen`) | `(277,182)` ROAD · R0 · `node:parlement-europeen` C3/M4 · P4 · S22 | `(255,203)` ROAD · R0 · `node:orangerie` C3/M4 · P45 · S22 | 자전거 대여 직원 — 공원·수변 이동객에게 대여 시간과 반납 지점을 안내하는 역할. |
| 서울 | 사대문 안 (`historic-core`) | `(825,612)` PARK · `node:gyeongbokgung` C3/M3 · P3 · S3 | `(822,615)` ROAD · `node:gyeongbokgung` C3/M3 · P3 · S3 | 전통 찻집 직원 — 궁궐·시장 방문객에게 차 종류와 주문 예절을 안내하는 역할. |
| 서울 | 서남권 (`west`) | `(663,944)` SIDEWALK · `node:yeouido-63` C3/M3 · P3 · S3 | `(666,947)` ROAD · `node:yeouido-63` C3/M3 · P3 · S3 | 강변 편의점 직원 — 업무·주거·산책 이용객의 간단한 구매와 결제를 돕는 역할. |
| 서울 | 강남·잠실 (`southeast`) | `(1182,993)` ROAD · `node:coex` C3/M3 · P2 · S196 | `(1378,990)` ROAD · `node:lotte-world-tower` C3/M3 · P3 · S196 | 복합상업시설 안내원 — 업무·쇼핑 지구에서 층별 시설과 이동 방향을 알려 주는 역할. |
| 서울 | 한강 북안 (`river-north`) | `(902,863)` ROAD · `node:itaewon` C3/M3 · P118 · S3 | `(899,866)` CROSSWALK · `node:itaewon` C3/M3 · P118 · S3 | 자전거 수리점 직원 — 강변과 주거지를 오가는 이용객에게 수리 항목과 소요 시간을 안내하는 역할. |
| 부산 | 원도심·항만 (`port-core`) | `(657,786)` ROAD · `station:nampo` C3/M3 · P489 · S3 | `(654,789)` ROAD · `station:nampo` C3/M3 · P489 · S3 | 항구 시장 상인 — 원도심 방문객에게 해산물 품목·수량·포장 방법을 설명하는 역할. |
| 부산 | 도심 북부 (`central-north`) | `(773,457)` ROAD · `station:seomyeon` C3/M3 · P702 · S3 | `(770,460)` ROAD · `station:seomyeon` C3/M3 · P702 · S3 | 환승 안내원 — 도심 북부의 역과 생활권을 잇는 노선·출구·환승 방향을 알려 주는 역할. |
| 부산 | 동부 해안 (`east-coast`) | `(1021,517)` ROAD · `node:gwangan-bridge` C3/M3 · P649 · S3 | `(1024,520)` SIDEWALK · `node:gwangan-bridge` C3/M3 · P649 · S3 | 해변 카페 직원 — 해안 방문객에게 음료 주문과 좌석 위치를 안내하는 역할. |
| 부산 | 남부 해안 (`south-coast`) | `(714,905)` ROAD · `node:huinnyeoul` C3/M3 · P313 · S3 | `(711,908)` SIDEWALK · `node:huinnyeoul` C3/M3 · P313 · S3 | 생태 안내원 — 하구·섬·남부 해안 방문객에게 관찰 동선과 주의사항을 설명하는 역할. |
| 코트다쥐르 | 서부 리비에라 (`ouest`) | `(250,913)` ROAD · `station:antibes` C3/M3 · P2 · S20 | `(253,893)` ROAD · `node:fort-carre` C3/M3 · P20 · S20 | 공방 직원 — 구시가 산책객에게 제작 품목과 체험 순서를 안내하는 역할. |
| 코트다쥐르 | 니스 (`nice`) | `(813,303)` ROAD · `node:promenade-des-anglais` C3/M3 · P3 · S3 | `(810,306)` ROAD · `node:promenade-des-anglais` C3/M3 · P3 · S3 | 제과점 직원 — 해변 산책로와 구시가 방문객의 아침 주문과 포장을 돕는 역할. |
| 코트다쥐르 | 동부 연안 (`est`) | `(1187,178)` ROAD · `station:eze-sur-mer` C3/M3 · P2 · S56 | `(1214,122)` SIDEWALK · `node:eze-village` C3/M3 · P3 · S56 | 마을 식료품점 상인 — 연안 정차객에게 식재료 종류·수량·길을 안내하는 역할. |
| 코트다쥐르 | 모나코 일대 (`monaco`) | `(1463,83)` ROAD · `node:port-hercule` C3/M3 · P2 · S22 | `(1472,105)` SIDEWALK · `node:oceanographic-museum` C3/M3 · P3 · S22 | 호텔 안내 직원 — 항구·관광 지구 방문객에게 체크인 절차와 이동 방향을 설명하는 역할. |
| 레만호 연안 | 로잔·우시 (`lausanne-ouchy`) | `(133,96)` ROAD · `node:lausanne-cathedral` C3/M3 · P— · S6 | `(139,96)` ROAD · `node:lausanne-cathedral` C3/M3 · P— · S6 | 호안 카페 직원 — 언덕 도심과 선착장을 오가는 산책객의 음료 주문을 돕는 역할. |
| 레만호 연안 | 라보 포도밭 (`lavaux`) | `(326,158)` ROAD · `station:lutry` C3/M3 · P— · S3 | `(323,161)` SIDEWALK · `station:lutry` C3/M3 · P— · S3 | 포도밭 산책 안내원 — 장거리 경관 길에서 방향·소요 시간·휴식 지점을 알려 주는 역할. |
| 레만호 연안 | 브베 (`vevey`) | `(934,426)` ROAD · `station:vevey` C3/M3 · P— · S3 | `(931,429)` ROAD · `station:vevey` C3/M3 · P— · S3 | 시장 제과점 직원 — 호반 장터와 역세권 방문객의 빵 주문과 수량 선택을 돕는 역할. |
| 레만호 연안 | 몽트뢰·시옹 (`montreux-chillon`) | `(1190,575)` ROAD · `station:montreux` C3/M3 · P— · S3 | `(1193,578)` ROAD · `station:montreux` C3/M3 · P— · S3 | 선착장 안내원 — 호반 이동객에게 승선 위치·출발 방향·대기 장소를 알려 주는 역할. |

## 결정성·검증 증거

- 동일 one-shot canonical JSON A/B는 각각 40,830 bytes로 byte-identical이며 SHA-256은
  두 번 모두 `1faa97742ccc8d2729294285e30d6541b62270168dc802484f669de707af1cbf`다.
- assertion 전수 결과: 7도시·21지구·42후보·21역할 exact, 지구 내부 42/42,
  보행·비EXIT 42/42, cardinal 탈출 42/42.
- 기존 마커 최소 이격은 Chebyshev 3타일, 같은 도시 후보 최소 이격도 3타일이다.
  주동선 도시 대상 후보는 10/10 R0다.
- 측정기 `process.resourceUsage().maxRSS`: A 422,784 KiB(432,930,816 bytes),
  B 422,720 KiB(432,865,280 bytes).
- targeted 지구·주동선·lazy registry 회귀: 4 files / 55 tests PASS(14.84초).
- 전체 단일 worker 회귀: 219 files / 2,182 tests PASS(197.41초).
- `npm run lint`, 표 21행·42좌표·21역할 exact 대조, `git diff --check`: PASS.

## 비구현 경계

이 문서는 후보 타일과 일반 역할만 제안한다. 상호·인명·대사·번역, NPC id·이름·외형·
상호작용, 발견 문장, runtime 배선, 도시 data/geo·지구 rect·주동선·registry·verifier·DB는
변경하지 않는다. 표의 1안·2안도 자동 승인 좌표가 아니며 Claude의 후속 SPEC에서 최종
선택한 뒤 같은 이격·접근성 계약을 다시 확인해야 한다.
