# 7도시 19지구 도어 후보 스팟 실측 — 채움 라운드 2

## 결론

`district-v1` 정본 7도시의 채움 라운드 2 대상 19지구에 학습 도어 후보를 2개씩,
총 38개 제안한다. 38개 모두 지구 rect 안의 보행 가능·비EXIT 타일이고 4방향으로 빠져나갈
수 있으며, 적어도 한 방향의 BUILDING과 바로 맞닿는다. 기존 노드·역·도선·소품·입구·EXIT·
주동선 발견/소품과의 Chebyshev 이격과 같은 도시 후보끼리의 이격은 모두 최소 3타일이다.

리옹·보르도·스트라스부르의 대상 5지구, 후보 10개는 전부 현재 `mainRoute` 위(R0)다.
나머지 후보도 역·POI·생활 앵커 가까이에서 T8과 같은 결정 규칙으로 재검했다. 각 지구의 주제는
상호·인명 없이 지구 성격과 학습 상황만 적은 참고 의견이며, 실제 도어 종류·chapter·카피·배선은
Claude가 확정한다.

## 범위 정합

- 입력 정본: `origin/main` `d7fa3fac698af591b95f7d564d32de5a1c5ff714`, Node
  `v22.23.1`. T8 `docs/proposal-npc-door-spots.md`의 좌표와 최신 grid·마커를 함께 소비했다.
- 검증 중 `main`이 T10 보고서 merge `fbf448c15d38247b9a7aef862a87d7ca3ce80edf`로
  전진했지만 변경은 `docs/proposal-district-rects-r3.md` 1파일뿐이며 아래 17개 측정 입력과
  비중첩이다. 측정 hash와 판정은 그대로 유효하다.
- 7도시의 `districts.open`은 28개다. 이 중 보르도·스트라스부르의 `route-corridor` 2개는
  이름 그대로 주동선 안전 마스크이며 콘텐츠 지구가 아니므로, T7/T8과 동일하게 제외하면 콘텐츠
  지구는 26개다.
- 발주에 명시된 빈 역 2곳(`bordeaux/gare-saint-jean`, `strasbourg/gare`)과 리옹 우선
  3지구(`presquile-confluence`, `vieux-lyon-fourviere`,
  `terreaux-croix-rousse`)를 빼면 정본 산술상 21개다.
- 발주의 명시 수량 19개와 “우시 호안 카페” 예시를 함께 지키기 위해, 기존 도어가 지구 성격을
  이미 직접 담당하는 레만 `lavaux`(`fr-16`, 와인 카브)와 `montreux-chillon`(`fr-17`,
  거리 음악가)을 추가로 제외했다. `lausanne-ouchy`의 기존 `fr-18`은 로잔 도심 약국이므로
  우시 호안 공백을 메우는 후보를 포함했다.
- 리옹은 이미 채움 라운드 1 NPC가 들어간 앞 3지구만 제외하고, 아직 미채움인
  `rhone-part-dieu`를 포함했다. 임의의 지구 rect·가상 도시는 만들지 않았다.

## 판정 규칙과 표기

- 유효 타일: 지구 rect 합집합 안, `WATER/RIVER/BUILDING/ISLAND/MOUNTAIN/EXIT`가 아니며
  cardinal 4방 중 최소 한 칸이 보행 가능해야 한다.
- 도어 파사드: 모든 후보가 cardinal 4방 중 하나 이상의 BUILDING과 인접해야 한다.
- 이격 기준: runtime `nodes`, `stations`, `transitPoints`, `props`, `entrance`, 모든 EXIT,
  resolved `mainRoute.discoveries`와 경로 소품을 기존 마커로 합쳐 Chebyshev 거리 3 이상을
  요구한다. 같은 도시의 이번 후보끼리도 3 이상이다.
- 우선순위: 주동선 도시에서는 R0, 그 밖에서는 역·도선·POI 등 기존 앵커 근접을 우선하고
  동률은 `y`, `x` 순으로 고정했다. 우시 후보 1안은 발주 예시와 공간 성격을 반영해 호안 앵커
  가까이에서 같은 계약을 만족하는 타일로 정밀 보정했다.
- 표의 `건물 N/E/S/W`는 후보 기준 BUILDING 방향이다. `C3`은 가장 가까운 기존 마커와의
  Chebyshev 거리 3, `R0`은 주동선 위를 뜻한다. 앵커 id는 정본 좌표 근거일 뿐 새 상호·인명이
  아니다.

## 19지구 후보 전수표

| 도시 | 콘텐츠 지구 | 도어 후보 1안 | 도어 후보 2안 | 추천 도어 주제(참고) |
|---|---|---|---|---|
| 리옹 | 론 강변·파르디외 (`rhone-part-dieu`) | `(262,217)` ROAD · 건물 S · route-prop:`route_streetlight-16` C6 · R0 | `(227,202)` ROAD · 건물 N · prop:`stall-1` C3 · R0 | 시장 식료품점 — 업무 지구와 실내 미식 시장을 함께 살린 주문·수량 학습 주제. |
| 보르도 | 역사 지구 (`centre-historique`) | `(268,226)` ROAD · 건물 E/W · route-prop:`route_signpost-02` C3 · R0 | `(263,234)` ROAD · 건물 N · discovery:`bordeaux-d2` C3 · R0 | 제과점 — 구시가 보행 상점가의 아침 주문과 수량 표현에 어울림. |
| 보르도 | 샤르트롱·북강변 (`nord-rive`) | `(269,148)` ROAD · 건물 N · node:`chartrons` C3 · R0 | `(256,178)` ROAD · 건물 N · route-prop:`route_streetlight-07` C3 · R0 | 골동품점 — 옛 창고·상인 거리의 물건 상태와 가격 묻기에 어울림. |
| 스트라스부르 | 그랑딜 (`grande-ile`) | `(165,263)` SIDEWALK · 건물 N · route-prop:`route_signpost-01` C3 · R0 | `(135,250)` ROAD · 건물 E · route-prop:`route_streetlight-01` C4 · R0 | 서점 — 보행 중심 구시가에서 책 찾기와 위치 질문에 어울림. |
| 스트라스부르 | 유럽 지구 (`quartier-europeen`) | `(275,185)` SIDEWALK · 건물 N/W · node:`parlement-europeen` C6 · R0 | `(251,212)` ROAD · 건물 W · node:`orangerie` C6 · R0 | 자전거 대여점 — 공원·수변 이동 지구의 대여 시간과 반납 표현에 어울림. |
| 서울 | 사대문 안 (`historic-core`) | `(918,668)` ROAD · 건물 E · node:`gwangjang-market` C3 | `(968,682)` SIDEWALK · 건물 E · node:`ddp` C3 | 찻집 — 궁궐·시장·골목이 모인 도심에서 주문과 예절 표현에 어울림. |
| 서울 | 서남권 (`west`) | `(596,936)` ROAD · 건물 S · station:`yeouido` C3 | `(593,933)` SIDEWALK · 건물 N/E · station:`yeouido` C3 | 강변 편의점 — 업무·주거·강변 이동권에서 간단한 구매와 결제 표현에 어울림. |
| 서울 | 강남·잠실 (`southeast`) | `(1204,1012)` ROAD · 건물 S · station:`samseong` C3 | `(1379,984)` SIDEWALK · 건물 N/W · node:`lotte-world-tower` C3 | 편의점 — 강남·잠실의 고밀도 상권에서 길 찾기와 생활 구매 표현에 어울림. |
| 서울 | 한강 북안 (`river-north`) | `(902,869)` ROAD · 건물 N · node:`itaewon` C3 | `(1094,810)` ROAD · 건물 N · node:`seoul-forest` C3 | 동네 카페 — 다국적 거리와 숲 인접 생활권에서 메뉴 주문과 만남 표현에 어울림. |
| 부산 | 원도심·항만 (`port-core`) | `(648,773)` SIDEWALK · 건물 N · node:`busan-tower` C3 | `(545,792)` SIDEWALK · 건물 N · node:`gamcheon` C3 | 시장 식당 — 항만·구도심의 빠른 식사 주문과 좌석 요청 표현에 어울림. |
| 부산 | 도심 북부 (`central-north`) | `(884,167)` ROAD · 건물 S · node:`dongnae-eupseong` C3 | `(767,456)` ROAD · 건물 W · station:`seomyeon` C3 | 목욕탕 — 도심 교통축과 온천권 성격을 잇는 이용 규칙·요금 표현에 어울림. |
| 부산 | 동부 해안 (`east-coast`) | `(1101,392)` ROAD · 건물 W · station:`centum-city-station` C3 | `(1157,422)` SIDEWALK · 건물 N/E · station:`haeundae-station` C3 | 해변 카페 — 동부 해안권의 음료 주문과 전망 좌석 요청에 어울림. |
| 부산 | 남부 해안 (`south-coast`) | `(254,780)` SIDEWALK · 건물 E · node:`eulsukdo` C4 | `(258,779)` SIDEWALK · 건물 W · node:`eulsukdo` C8 | 생태 안내소 — 하구 섬·남부 해안의 관찰 동선에서 위치와 주의사항 묻기에 어울림. |
| 코트다쥐르 | 서부 리비에라 (`ouest`) | `(277,940)` ROAD · 건물 W · node:`antibes-picasso` C3 | `(274,943)` SIDEWALK · 건물 S/W · node:`antibes-picasso` C3 | 공방 — 구시가·요새·예술 산책권에서 물건 고르기와 제작 과정 질문에 어울림. |
| 코트다쥐르 | 니스 (`nice`) | `(864,303)` SIDEWALK · 건물 W · node:`vieux-nice` C3 | `(870,303)` SIDEWALK · 건물 S · node:`vieux-nice` C3 | 제과점 — 해변 산책로와 구시가 상권에서 아침 주문·포장 표현에 어울림. |
| 코트다쥐르 | 동부 연안 (`est`) | `(991,256)` SIDEWALK · 건물 N/E · node:`villefranche-sur-mer` C3 | `(997,256)` SIDEWALK · 건물 N/E · node:`villefranche-sur-mer` C3 | 마을 식료품점 — 절벽 마을·연안 정차권에서 식재료와 수량 묻기에 어울림. |
| 코트다쥐르 | 모나코 일대 (`monaco`) | `(1482,55)` ROAD · 건물 E/S · node:`monte-carlo-casino` C3 | `(1475,107)` ROAD · 건물 E · node:`oceanographic-museum` C3 | 호텔 안내 데스크 — 항구·고밀도 관광 지구에서 체크인과 길 안내 표현에 어울림. |
| 레만호 연안 | 로잔·우시 (`lausanne-ouchy`) | `(102,183)` ROAD · 건물 N · node:`ouchy` C3 | `(112,97)` ROAD · 건물 E · node:`fr-18` C3 | 호안 카페 — 언덕 도심과 우시 호안을 잇는 산책권에서 음료 주문에 어울림. |
| 레만호 연안 | 브베 (`vevey`) | `(928,434)` ROAD · 건물 W · node:`vevey-marche` C3 | `(924,443)` ROAD · 건물 N · node:`vevey-grande-place` C3 | 시장 제과점 — 호반 장터와 역세권에서 빵 주문·수량 표현에 어울림. |

## 결정성·검증 증거

- 동일 one-shot 산출 A/B는 각각 31,973 bytes로 byte-identical이며 SHA-256은 두 번 모두
  `4ca89895647d912b3e7d2f668ea4f0006de93c08433f64124372f132af9f5efa`다.
- 입력 17파일의 정렬 manifest SHA-256은
  `fd6a927b44f3ccb6254cacbe0426b870afb96d8eab3952bbbf329305608d122c`다.
- assertion 전수 결과: 7도시·19지구·38후보·19주제 exact, 지구 내부 38/38,
  보행·비EXIT 38/38, cardinal 탈출 38/38, cardinal BUILDING 인접 38/38.
- 기존 마커 최소 이격은 Chebyshev 3타일, 같은 도시 선택 후보 상호 최소 이격도 3타일이다.
  주동선 도시 대상 후보는 10/10 R0다.
- 측정기 `process.resourceUsage().maxRSS`: A 439,568 KiB(450,117,632 bytes),
  B 435,360 KiB(445,808,640 bytes).
- targeted 지구·주동선·registry 회귀: 4 files / 55 tests PASS(14.58초).
- 전체 단일 worker 회귀: 217 files / 2,166 tests PASS(251.40초).
- 보고서 19행·38좌표·19주제를 one-shot JSON과 exact 재대조했고, `npm run lint`,
  `git diff --check`를 통과했다.

## 비구현 경계

이 문서는 타일 후보와 일반 주제만 제안한다. 상호·인명·대사, 도어 이름·chapter·track·카피,
facade·runtime 배선, NPC·발견, 도시 data/geo·지구 rect·주동선·registry·verifier·DB는
변경하지 않는다. 표의 1안/2안도 자동 승인 좌표가 아니며 Claude의 후속 SPEC에서 최종 선택한다.
