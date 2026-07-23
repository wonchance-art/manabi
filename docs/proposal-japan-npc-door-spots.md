# 일본 4도시 16지구 NPC·도어 후보 스팟 실측 — 채움 라운드 3

## 결론

`district-v1` 정본이 병합된 도쿄·오사카·후쿠오카·교토의 16개 개방 지구에 NPC 후보를
2개씩 32개, 학습 도어 후보를 2개씩 32개 제안한다. 64개 후보는 모두 해당 지구 rect 합집합
안의 보행 가능·비EXIT 타일이고, cardinal 4방 중 적어도 한 칸으로 계속 걸어 나갈 수 있다.
또한 각 도시 입구에서 출발한 4방 BFS 보행 성분에 64/64가 포함된다.

현재 runtime의 노드·역·도선·소품·입구·EXIT와의 Chebyshev 이격은 최소 3타일이고,
이번 후보끼리도 같은 도시 전체에서 최소 3타일 떨어진다. 도어 32개는 모두 한 방향 이상의
BUILDING과 cardinal로 바로 맞닿는다.

네 도시 모두 `mainRoute === undefined`라 R0 우선순위는 적용할 수 없다. 대신 역·도선·입구,
일반 노드와 PLAZA까지의 거리를 함께 비교하고, 보도·횡단보도·도로 등 이동 경로형 지형을
동률 우선해 T8·T13의 “역/광장/경로변 우선”을 재현했다. 역할·주제는 지구 성격에 맞춘
일반 업종·공공 역할만 한 줄씩 제안하며 상호·인명·대사·배선은 포함하지 않는다.

## 범위와 결정 규칙

- 측정 정본: `origin/main` exact
  `db8d09fdb2238ba1960b4eb712bda5c7e3b304a9`, Node `v22.23.1` 공식 nvm 배포판.
- 도시 순서: `tokyo`, `osaka`, `fukuoka`, `kyoto`; 지구는 각 도시
  `districts.open` source order를 유지했다. 각 도시 4개, 합계 16개를 임의 제외 없이 측정했다.
- 입력은 네 도시 wrapper·geo, 도쿄 packed geo decoder, 공용 terrain의 정렬 10파일이다.
  입력 manifest SHA-256은
  `09203aea8814357538e5c5a853620b3fd7489fc1570c8e2f902b127d764ba591`다.
- 유효 타일은 지구 rect 합집합 안이며 `WATER/RIVER/BUILDING/ISLAND/MOUNTAIN/EXIT`가
  아니고, cardinal 보행 인접이 하나 이상이며, 도시 입구의 4방 BFS 성분에 속해야 한다.
- 기존 마커 `C`는 runtime `nodes`, `stations`, `transitPoints`, `props`, `entrance`,
  모든 EXIT까지의 최소 Chebyshev 거리다. 후보 이격 `S`는 같은 도시의 NPC·도어 후보
  전체에서 자기 외 최근접 후보까지의 Chebyshev 거리다. 모두 `C3`·`S3` 이상이다.
- 우선 앵커 `M`은 역·도선·노드·입구 중 최근접 Manhattan 거리다. `T`는 역·도선·입구
  중 최근접 Manhattan 거리, `P`는 최근접 PLAZA까지의 Manhattan 거리다.
- 결정 순위는 `min(M,T,P)` → `min(T,P)` → `M` → 지형
  (`PLAZA`, `SIDEWALK`, `CROSSWALK`, `ROAD`, `DOCK`, `PARK`, `BRIDGE`, `BEACH`)
  → `y`, `x`다. 도어는 같은 순위에서 BUILDING cardinal 인접 후보만 남겼다.
- 후보는 도시별 source order로 NPC 2개, 도어 2개를 선택하되 이미 선택한 모든 후보와
  `S3`을 유지했다. 표의 1안·2안은 결정적 제안 순서이며 자동 승인 순위가 아니다.
- `건물 N/E/S/W`는 후보 기준으로 해당 방향 한 칸이 BUILDING이라는 뜻이다.
  앵커의 고유 id는 좌표 재현 입력에는 포함하되, 표에는 일반 유형과 거리만 적어 새 상호나
  인명을 만들지 않았다.

## 16지구 후보·역할·주제 전수표

| 도시 | 개방 지구 | NPC 후보 2개 | 도어 후보 1안 | 도어 후보 2안 | 지구 성격 기반 역할·주제 제안 |
|---|---|---|---|---|---|
| 도쿄 | 야마노테·서부 (`yamanote-west`) | `(239,545)` SIDEWALK · node M3 · T36 · P2 · C3 · S115<br>`(187,312)` ROAD · station M3/T3 · P2 · C3 · S233 | `(307,46)` SIDEWALK · 건물 S/W · station M3/T3 · P62 · C3 · S3 | `(310,49)` SIDEWALK · 건물 N · station M3/T3 · P62 · C3 · S3 | 역세권 카페 직원·생활 편의점 — 통근·주거 중심 서부에서 주문, 만남 장소, 간단한 구매 표현을 익히는 역할·주제. |
| 도쿄 | 중심·동부 (`central-east`) | `(497,66)` ROAD · station M3/T3 · P2 · C3 · S52<br>`(460,11)` SIDEWALK · station M3/T3 · P3 · C3 · S3 | `(457,14)` SIDEWALK · 건물 S · station M3/T3 · P3 · C3 · S3 | `(362,36)` SIDEWALK · 건물 E · station M3/T3 · P3 · C3 · S52 | 서점 직원·문구점 — 업무·문화·시장 거리가 겹치는 중심 동부에서 물건 위치, 종류, 가격을 묻는 역할·주제. |
| 도쿄 | 남부·항만 (`south-bay`) | `(354,619)` PLAZA · station M3/T3 · P0 · C3 · S3<br>`(360,619)` PLAZA · station M3/T3 · P0 · C3 · S4 | `(354,622)` PLAZA · 건물 W · station M6/T6 · P0 · C3 · S3 | `(360,615)` PLAZA · 건물 E · station M7/T7 · P0 · C3 · S4 | 수변 안내원·자전거 대여점 — 남부 항만 산책권에서 이동 방향, 대여 시간, 반납 지점을 안내하는 역할·주제. |
| 도쿄 | 하네다 (`haneda`) | `(563,1059)` PLAZA · transit M3/T3 · P0 · C3 · S3<br>`(560,1062)` PLAZA · transit M3/T3 · P0 · C3 · S3 | `(561,1065)` PLAZA · 건물 W · transit M5/T5 · P0 · C3 · S3 | `(564,1067)` PLAZA · 건물 S · transit M6/T6 · P0 · C5 · S3 | 공항 안내 직원·여행 안내소 — 공항 지구에서 탑승 수속, 수하물, 출구 위치를 안내하는 역할·주제. |
| 오사카 | 북부·허브 (`north-hubs`) | `(435,5)` PLAZA · station M3/T3 · P0 · C3 · S3<br>`(432,8)` PLAZA · station M3/T3 · P0 · C3 · S3 | `(434,11)` PLAZA · 건물 W · station M4/T4 · P0 · C3 · S3 | `(410,182)` PLAZA · 건물 W · station M4/T4 · P0 · C4 · S130 | 환승 안내원·역 구내 식당 — 북부 교통 허브에서 노선·출구를 안내하고 빠른 식사 주문을 돕는 역할·주제. |
| 오사카 | 성곽·동부 (`castle-east`) | `(553,262)` SIDEWALK · node M3 · T78 · P3 · C3 · S3<br>`(550,265)` SIDEWALK · node M3 · T78 · P3 · C3 · S3 | `(553,268)` SIDEWALK · 건물 N · node M3 · T72 · P3 · C3 · S3 | `(593,303)` SIDEWALK · 건물 E · station M3/T3 · P3 · C3 · S40 | 공원 안내원·전통 공방 — 성곽·동부 산책권에서 관람 동선과 제작 품목·체험 순서를 설명하는 역할·주제. |
| 오사카 | 난바·텐노지 (`namba-tennoji`) | `(280,296)` SIDEWALK · station M3/T3 · P84 · C3 · S64<br>`(501,487)` SIDEWALK · station M3/T3 · P172 · C3 · S3 | `(504,490)` SIDEWALK · 건물 E/S · station M3/T3 · P172 · C3 · S3 | `(263,360)` ROAD · 건물 E · station M3/T3 · P3 · C3 · S64 | 시장 음식점 직원·생활 식료품점 — 번화가와 시장 생활권에서 좌석, 주문, 수량, 결제 표현을 돕는 역할·주제. |
| 오사카 | 항만 (`bay`) | `(114,444)` PLAZA · node M3 · T230 · P0 · C3 · S3<br>`(111,447)` PLAZA · node M3 · T236 · P0 · C3 · S3 | `(111,441)` SIDEWALK · 건물 E · node M3 · T230 · P1 · C3 · S3 | `(108,444)` SIDEWALK · 건물 S · node M3 · T236 · P1 · C3 · S3 | 항만 안내원·장비 대여점 — 항만 나들이 지구에서 승선 방향, 대여 시간, 반납 규칙을 안내하는 역할·주제. |
| 후쿠오카 | 하카타항 (`hakata-port`) | `(214,69)` BRIDGE · node M3 · T26 · P2 · C3 · S21<br>`(244,43)` SIDEWALK · node M3 · T12 · P3 · C3 · S3 | `(241,46)` SIDEWALK · 건물 N/E · node M3 · T6 · P3 · C3 · S3 | `(235,62)` SIDEWALK · 건물 N/S/W · node M3 · T10 · P3 · C3 · S16 | 여객터미널 안내원·항구 식당 — 하카타항에서 승선 위치와 대기 장소를 안내하고 식사 주문을 돕는 역할·주제. |
| 후쿠오카 | 텐진·오호리 (`tenjin-ohori`) | `(142,147)` SIDEWALK · station M3/T3 · P30 · C3 · S78<br>`(238,145)` CROSSWALK · station M3/T3 · P23 · C3 · S11 | `(234,134)` ROAD · 건물 W · station M3/T3 · P20 · C3 · S11 | `(255,136)` ROAD · 건물 S/W · node M3 · T19 · P3 · C3 · S17 | 공원 산책 안내원·자전거 대여점 — 도심 상권과 큰 공원을 잇는 지구에서 방향, 시간, 반납 표현을 익히는 역할·주제. |
| 후쿠오카 | 나카스·하카타 (`nakasu-hakata`) | `(294,140)` PLAZA · station M3/T3 · P0 · C3 · S3<br>`(293,143)` PLAZA · node M3 · T7 · P0 · C3 · S3 | `(290,144)` PLAZA · 건물 W · node M5 · T11 · P0 · C3 · S3 | `(332,141)` PLAZA · 건물 E · station M6/T6 · P0 · C3 · S38 | 시장 음식점 직원·생활 잡화점 — 강변 상권과 역세권에서 메뉴 주문, 수량 선택, 물건 위치를 돕는 역할·주제. |
| 후쿠오카 | 모모치 (`momochi`) | `(62,115)` ROAD · node M3 · T69 · P2 · C3 · S39<br>`(20,146)` ROAD · node M3 · T86 · P2 · C3 · S3 | `(23,143)` SIDEWALK · 건물 E/S · node M3 · T80 · P3 · C3 · S3 | `(23,149)` SIDEWALK · 건물 N · node M3 · T86 · P3 · C3 · S3 | 해변 안내원·수변 카페 — 해안 산책권에서 전망 지점과 이동 방향을 알려 주고 음료·좌석 주문을 돕는 역할·주제. |
| 교토 | 아라시야마·산인 (`arashiyama-sanin`) | `(49,229)` PLAZA · station M3/T3 · P0 · C3 · S4<br>`(55,229)` PLAZA · station M3/T3 · P0 · C3 · S3 | `(55,232)` ROAD · 건물 N · station M6/T6 · P2 · C3 · S3 | `(50,233)` ROAD · 건물 S · station M6/T6 · P2 · C4 · S4 | 산책길 안내원·공예품점 — 서부 경관 지구에서 소요 시간과 방향을 알려 주고 제작 품목을 설명하는 역할·주제. |
| 교토 | 황궁·니조 (`imperial-nijo`) | `(324,272)` PLAZA · station M3/T3 · P0 · C3 · S3<br>`(330,272)` PLAZA · station M3/T3 · P0 · C3 · S3 | `(326,275)` PLAZA · 건물 S · station M4/T4 · P0 · C3 · S3 | `(329,275)` PLAZA · 건물 E/S · station M5/T5 · P0 · C3 · S3 | 정원 안내원·전통 공방 — 역사 건축과 공원 지구에서 관람 예절, 동선, 체험 순서를 설명하는 역할·주제. |
| 교토 | 히가시야마·중심 (`higashiyama-core`) | `(587,183)` SIDEWALK · node M3 · T349 · P3 · C3 · S72<br>`(490,314)` SIDEWALK · node M3 · T160 · P3 · C3 · S6 | `(496,314)` SIDEWALK · 건물 N · node M3 · T166 · P3 · C3 · S6 | `(515,247)` SIDEWALK · 건물 N/E/S · node M3 · T213 · P89 · C3 · S67 | 골목 안내원·찻집 — 동부 사찰·상점가의 보행 동선을 알려 주고 차 종류와 주문 예절을 돕는 역할·주제. |
| 교토 | 역·후시미 (`station-fushimi`) | `(401,415)` PLAZA · station M3/T3 · P0 · C3 · S4<br>`(407,415)` PLAZA · station M3/T3 · P0 · C3 · S4 | `(403,419)` PLAZA · 건물 S · entrance M4/T4 · P0 · C3 · S3 | `(406,419)` PLAZA · 건물 S · entrance M5/T5 · P0 · C3 · S3 | 역 안내원·짐 보관소 — 남부 역세권과 참배길에서 환승 방향, 보관 시간, 찾는 절차를 안내하는 역할·주제. |

## 결정성·검증 증거

- 동일 one-shot canonical JSON A/B는 각각 45,344 bytes로 byte-identical이며 SHA-256은
  두 번 모두 `582884817678fc2e5351d1ebe2a28af28570a6872ddf01eca20eff0640d19328`이다.
- assertion 전수 결과: 4도시·16지구·NPC 32개·도어 32개·역할/주제 16줄 exact,
  지구 내부·보행·비EXIT·cardinal 탈출·입구 BFS 성분 64/64다.
- 입구 4방 BFS 성분은 도쿄 655,992타일, 오사카 304,662타일,
  후쿠오카 59,264타일, 교토 374,942타일이며 후보는 모두 각 성분 안에 있다.
- 기존 마커 최소 이격과 같은 도시 후보 상호 최소 이격은 모두 Chebyshev 3타일이다.
  도어의 cardinal BUILDING 인접은 32/32다.
- one-shot `process.resourceUsage().maxRSS`: A 267,200 KiB(273,612,800 bytes),
  B 269,296 KiB(275,759,104 bytes). 두 실행 모두 swap 0이다.
- targeted 4도시 wrapper/geo·packed loader·district/mainRoute/registry 회귀:
  12 files / 172 tests PASS(25.05초).
- 전체 단일 worker 회귀: 222 files / 2,205 tests PASS(254.31초).
- 보고서 16행·64좌표·16역할/주제를 canonical JSON과 exact 대조했고,
  `npm run lint`, `git diff --check`를 통과했다.

## 비구현 경계

이 문서는 타일 후보와 일반 역할·주제만 제안한다. 상호·인명·대사·번역, NPC id·이름·외형·
상호작용, 도어 이름·chapter·track·카피·facade, 발견 문장, runtime 배선, 도시 data/geo·
지구 rect·registry·verifier·DB는 변경하지 않는다. 표의 좌표도 자동 승인값이 아니며,
Claude가 후속 SPEC에서 최종 선택한 뒤 같은 보행·이격·건물 인접 계약을 다시 확인해야 한다.
