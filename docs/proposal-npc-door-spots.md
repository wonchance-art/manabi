# 7도시 24지구 NPC·도어 후보 스팟 실측

## 결론

빈 역 NPC 2종이 병합된 최신 정본에서 남은 24개 콘텐츠 지구에 NPC 후보 3개씩 72개,
도어 후보 2개씩 48개를 결정적으로 골랐다. 120개 후보는 모두 보행 가능하고 EXIT가 아니며,
4방향으로 빠져나갈 수 있다.
기존 노드·역·도선·소품·입구·EXIT·주동선 발견/소품과의 Chebyshev 이격은 최소 3타일이다.
후보끼리도 같은 도시 안에서 최소 3타일 이격해, 표에서 여러 지구의 후보를 함께 채택해도 좌표가
겹치거나 바로 붙지 않는다.

도어 후보 48개는 전부 BUILDING에 4방향으로 바로 인접한다. 리옹·보르도·스트라스부르의
NPC·도어 후보는 모두 주동선 위(R0)다. 따라서 GBC 학습 도어의 건물 파사드 문법과 주동선 도시의
경로변 우선 조건을 동시에 만족한다.

## 범위와 판정 규칙

- 정본: `origin/main` `e330283ecb435b7bf5bad51aab35f57258b20a1f`, Node `v22.23.1`.
  발주: 이슈 #150 코멘트 `5053450849`, 범위 조정 `5053772988`.
- 대상 순서: `lyon`, `bordeaux`, `strasbourg`, `seoul`, `busan`, `cote-dazur`,
  `leman-riviera`; 각 도시의 `districts.open` source order를 따른다.
- 범위 조정 전에 Claude가 보르도 `gare-saint-jean`과 스트라스부르 `gare`의 NPC를 직접
  실측·저작·배선해 병합했다. 두 지구는 새 지시대로 후보 산출에서 통째로 제외해 24개만 다룬다.
- 보르도·스트라스부르의 `route-corridor` 두 항목도 콘텐츠 지구가 아니라 주동선 개방용 안전
  마스크라 T7 수량에서 제외한다. 그 안을 지나는 실제 `mainRoute` path는 거리 순위에 사용했다.
- 유효 후보는 지구 rect 합집합 안이며 `WATER/RIVER/BUILDING/ISLAND/MOUNTAIN/EXIT`가 아니고,
  4방향 중 최소 한 칸으로 계속 걸을 수 있어야 한다.
- 기존 마커 이격은 runtime `nodes`, `stations`, `transitPoints`, `props`, `entrance`, 모든 EXIT,
  주동선 `discoveries`와 `props`를 합친 더 엄격한 집합을 기준으로 한다. 모든 후보가 이 집합과
  Chebyshev 거리 3 이상이다.
- NPC 순위는 리옹·보르도·스트라스부르에서 주동선 Manhattan 거리, 그 밖의 도시에서
  역/도선/POI/입구 또는 PLAZA 거리부터 비교한다. 동률은 `y`, `x` 순이다.
- 도어 순위는 건물 4방향 인접, 건물 거리, 주동선/주변 앵커 거리, `y`, `x` 순이다.
- 발주의 “리옹 3지구 우선”은 id가 따로 지정되지 않아 source order 앞의 세 지구
  (`presquile-confluence`, `vieux-lyon-fourviere`, `terreaux-croix-rousse`)로 고정했다.
  `rhone-part-dieu` 후보도 빠짐없이 제공하지만 후순위 예비안이다.
- 표의 `R0`은 주동선 위, `R3`은 주동선에서 Manhattan 3타일을 뜻한다. `d`도 해당 주변 앵커까지
  Manhattan 거리다. `건물 N/E/S/W`는 후보에서 그 방향 한 칸이 BUILDING이라는 뜻이다.

## 최우선 리옹 3지구 채택안

| 우선 대상 | NPC 1안 | 도어 1안 | 근거 |
|---|---|---|---|
| 리옹 `presquile-confluence` | `(143,222)` | `(146,223)` | 둘 다 R0, 구시가 노드권; 도어 BUILDING 북측 인접 |
| 리옹 `vieux-lyon-fourviere` | `(172,183)` | `(172,186)` | 둘 다 R0, 테로 노드권; 도어 BUILDING 동측 인접 |
| 리옹 `terreaux-croix-rousse` | `(179,182)` | `(179,185)` | 둘 다 R0, 오페라 노드권; 도어 BUILDING 서측 인접 |

위 1안들은 서로도 Chebyshev 3타일 이상 떨어져 있다. 이는 좌표 우선안일 뿐이며 NPC 역할·대사,
도어 chapter·카피·배선은 Claude의 후속 SPEC에서 확정한다.

## 24개 지구 후보 전수표

| 도시 | 콘텐츠 지구 | NPC 후보 3개 | 도어 후보 2개 |
|---|---|---|---|
| 리옹 | 프레스킬 남부 (`presquile-confluence`) | `(143,222)` ROAD · R0 · node:`vieux-lyon` d3 · plaza d3<br>`(160,234)` SIDEWALK · R0 · node:`bellecour` d3 · plaza d32<br>`(139,283)` ROAD · R0 · station:`perrache` d3 · plaza d68 | `(146,223)` SIDEWALK · R0 · node:`vieux-lyon` d7 · plaza d7 · 건물 N<br>`(156,234)` ROAD · R0 · node:`bellecour` d7 · plaza d28 · 건물 N |
| 리옹 | 구시가·푸르비에르 (`vieux-lyon-fourviere`) | `(172,183)` ROAD · R0 · node:`terreaux` d3 · plaza d13<br>`(127,208)` ROAD · R0 · node:`fourviere` d4 · plaza d27<br>`(125,205)` ROAD · R0 · node:`fourviere` d5 · plaza d32 | `(172,186)` ROAD · R0 · node:`terreaux` d6 · plaza d16 · 건물 E<br>`(165,180)` CROSSWALK · R0 · node:`terreaux` d7 · plaza d17 · 건물 N |
| 리옹 | 테로·크루아루스 (`terreaux-croix-rousse`) | `(179,182)` SIDEWALK · R0 · node:`opera` d5 · plaza d5<br>`(185,177)` CROSSWALK · R0 · node:`opera` d6 · plaza d6<br>`(169,142)` ROAD · R0 · node:`croix-rousse` d6 · plaza d49 | `(179,185)` SIDEWALK · R0 · node:`opera` d8 · plaza d8 · 건물 W<br>`(175,142)` ROAD · R0 · node:`croix-rousse` d12 · plaza d43 · 건물 S |
| 리옹 | 론 강변·파르디외 (`rhone-part-dieu`) | `(234,209)` SIDEWALK · R0 · node:`halles` d4 · plaza d4<br>`(265,217)` ROAD · R0 · station:`part-dieu` d7 · plaza d6<br>`(185,174)` CROSSWALK · R0 · node:`opera` d9 · plaza d9 | `(262,217)` ROAD · R0 · station:`part-dieu` d10 · plaza d9 · 건물 S<br>`(227,202)` ROAD · R0 · node:`halles` d10 · plaza d10 · 건물 N |
| 보르도 | 역사 지구 (`centre-historique`) | `(270,248)` ROAD · R0 · node:`grosse-cloche` d3 · plaza d38<br>`(263,194)` SIDEWALK · R0 · node:`place-des-quinconces` d3 · plaza d57<br>`(249,233)` SIDEWALK · R0 · node:`cathedrale-saint-andre` d4 · plaza d4 | `(268,226)` ROAD · R0 · node:`rue-sainte-catherine` d6 · plaza d30 · 건물 E<br>`(263,234)` ROAD · R0 · node:`rue-sainte-catherine` d7 · plaza d17 · 건물 N |
| 보르도 | 샤르트롱·북강변 (`nord-rive`) | `(249,175)` ROAD · R0 · node:`jardin-public` d4 · plaza d62<br>`(275,151)` ROAD · R0 · node:`chartrons` d4 · plaza d112<br>`(352,99)` SIDEWALK · R0 · node:`cite-du-vin` d4 · plaza d225 | `(269,148)` ROAD · R0 · node:`chartrons` d5 · plaza d109 · 건물 N<br>`(256,178)` ROAD · R0 · node:`jardin-public` d8 · plaza d66 · 건물 N |
| 스트라스부르 | 그랑딜 (`grande-ile`) | `(149,281)` SIDEWALK · R0 · node:`petite-france` d3 · plaza d52<br>`(132,250)` SIDEWALK · R0 · station:`gare-de-strasbourg` d4 · plaza d74<br>`(191,270)` SIDEWALK · R0 · node:`cathedrale` d5 · plaza d5 | `(165,263)` SIDEWALK · R0 · node:`place-kleber` d5 · plaza d28 · 건물 N<br>`(135,250)` ROAD · R0 · station:`gare-de-strasbourg` d7 · plaza d71 · 건물 E |
| 스트라스부르 | 유럽 지구 (`quartier-europeen`) | `(277,182)` ROAD · R0 · node:`parlement-europeen` d4 · plaza d4<br>`(255,203)` ROAD · R0 · node:`orangerie` d4 · plaza d45<br>`(252,209)` SIDEWALK · R0 · node:`orangerie` d5 · plaza d54 | `(275,185)` SIDEWALK · R0 · node:`parlement-europeen` d7 · plaza d7 · 건물 N<br>`(251,212)` ROAD · R0 · node:`orangerie` d9 · plaza d58 · 건물 W |
| 서울 | 사대문 안 (`historic-core`) | `(825,612)` PARK · node:`gyeongbokgung` d3 · plaza d3<br>`(822,615)` ROAD · node:`gyeongbokgung` d3 · plaza d3<br>`(828,615)` SIDEWALK · node:`gyeongbokgung` d3 · plaza d3 | `(918,668)` ROAD · node:`gwangjang-market` d3 · plaza d3 · 건물 E<br>`(968,682)` SIDEWALK · node:`ddp` d3 · plaza d3 · 건물 E |
| 서울 | 서남권 (`west`) | `(663,944)` SIDEWALK · node:`yeouido-63` d3 · plaza d3<br>`(666,947)` ROAD · node:`yeouido-63` d3 · plaza d3<br>`(663,950)` SIDEWALK · node:`yeouido-63` d3 · plaza d3 | `(596,936)` ROAD · station:`yeouido` d3 · plaza d77 · 건물 S<br>`(593,933)` SIDEWALK · station:`yeouido` d3 · plaza d83 · 건물 N |
| 서울 | 강남·잠실 (`southeast`) | `(1182,993)` ROAD · node:`coex` d3 · plaza d2<br>`(1378,990)` ROAD · node:`lotte-world-tower` d3 · plaza d3<br>`(1370,984)` CROSSWALK · station:`jamsil` d3 · plaza d11 | `(1204,1012)` ROAD · station:`samseong` d3 · plaza d38 · 건물 S<br>`(1379,984)` SIDEWALK · node:`lotte-world-tower` d4 · plaza d4 · 건물 N |
| 서울 | 한강 북안 (`river-north`) | `(902,863)` ROAD · node:`itaewon` d3 · plaza d118<br>`(899,866)` CROSSWALK · node:`itaewon` d3 · plaza d118<br>`(905,866)` ROAD · node:`itaewon` d3 · plaza d124 | `(902,869)` ROAD · node:`itaewon` d3 · plaza d124 · 건물 N<br>`(1094,810)` ROAD · node:`seoul-forest` d4 · plaza d251 · 건물 N |
| 부산 | 원도심·항만 (`port-core`) | `(657,786)` ROAD · station:`nampo` d3 · plaza d489<br>`(654,789)` ROAD · station:`nampo` d3 · plaza d489<br>`(654,783)` PARK · station:`nampo` d3 · plaza d495 | `(648,773)` SIDEWALK · node:`busan-tower` d3 · plaza d511 · 건물 N<br>`(545,792)` SIDEWALK · node:`gamcheon` d3 · plaza d595 · 건물 N |
| 부산 | 도심 북부 (`central-north`) | `(773,457)` ROAD · station:`seomyeon` d3 · plaza d702<br>`(770,460)` ROAD · station:`seomyeon` d3 · plaza d702<br>`(770,454)` ROAD · station:`seomyeon` d3 · plaza d708 | `(884,167)` ROAD · node:`dongnae-eupseong` d3 · plaza d881 · 건물 S<br>`(767,456)` ROAD · station:`seomyeon` d4 · plaza d709 · 건물 W |
| 부산 | 동부 해안 (`east-coast`) | `(1021,517)` ROAD · node:`gwangan-bridge` d3 · plaza d649<br>`(1024,520)` SIDEWALK · node:`gwangan-bridge` d3 · plaza d649<br>`(1024,514)` SIDEWALK · node:`gwangan-bridge` d3 · plaza d655 | `(1101,392)` ROAD · station:`centum-city-station` d3 · plaza d854 · 건물 W<br>`(1157,422)` SIDEWALK · station:`haeundae-station` d3 · plaza d880 · 건물 N |
| 부산 | 남부 해안 (`south-coast`) | `(714,905)` ROAD · node:`huinnyeoul` d3 · plaza d313<br>`(711,908)` SIDEWALK · node:`huinnyeoul` d3 · plaza d313<br>`(711,902)` ROAD · node:`huinnyeoul` d3 · plaza d319 | `(254,780)` SIDEWALK · node:`eulsukdo` d5 · plaza d898 · 건물 E<br>`(258,779)` SIDEWALK · node:`eulsukdo` d8 · plaza d895 · 건물 W |
| 코트다쥐르 | 서부 리비에라 (`ouest`) | `(250,913)` ROAD · station:`antibes` d3 · plaza d2<br>`(253,893)` ROAD · node:`fort-carre` d3 · plaza d20<br>`(250,890)` SIDEWALK · node:`fort-carre` d3 · plaza d25 | `(277,940)` ROAD · node:`antibes-picasso` d3 · plaza d51 · 건물 W<br>`(274,943)` SIDEWALK · node:`antibes-picasso` d3 · plaza d51 · 건물 S |
| 코트다쥐르 | 니스 (`nice`) | `(813,303)` ROAD · node:`promenade-des-anglais` d3 · plaza d3<br>`(810,306)` ROAD · node:`promenade-des-anglais` d3 · plaza d3<br>`(845,289)` SIDEWALK · node:`place-massena` d3 · plaza d49 | `(864,303)` SIDEWALK · node:`vieux-nice` d3 · plaza d54 · 건물 W<br>`(870,303)` SIDEWALK · node:`vieux-nice` d3 · plaza d60 · 건물 S |
| 코트다쥐르 | 동부 연안 (`est`) | `(1187,178)` ROAD · station:`eze-sur-mer` d3 · plaza d2<br>`(1214,122)` SIDEWALK · node:`eze-village` d3 · plaza d3<br>`(1214,128)` SIDEWALK · node:`eze-village` d3 · plaza d3 | `(991,256)` SIDEWALK · node:`villefranche-sur-mer` d3 · plaza d228 · 건물 N<br>`(997,256)` SIDEWALK · node:`villefranche-sur-mer` d3 · plaza d234 · 건물 N |
| 코트다쥐르 | 모나코 일대 (`monaco`) | `(1463,83)` ROAD · node:`port-hercule` d3 · plaza d2<br>`(1472,105)` SIDEWALK · node:`oceanographic-museum` d3 · plaza d3<br>`(1469,108)` ROAD · node:`oceanographic-museum` d3 · plaza d3 | `(1482,55)` ROAD · node:`monte-carlo-casino` d3 · plaza d44 · 건물 E<br>`(1475,107)` ROAD · node:`oceanographic-museum` d4 · plaza d4 · 건물 E |
| 레만호 연안 | 로잔·우시 (`lausanne-ouchy`) | `(133,96)` ROAD · node:`lausanne-cathedral` d3<br>`(139,96)` ROAD · node:`lausanne-cathedral` d3<br>`(106,97)` ROAD · node:`fr-18` d3 | `(112,97)` ROAD · node:`fr-18` d3 · 건물 E<br>`(136,99)` ROAD · node:`lausanne-cathedral` d3 · 건물 S |
| 레만호 연안 | 라보 포도밭 (`lavaux`) | `(326,158)` ROAD · station:`lutry` d3<br>`(323,161)` SIDEWALK · station:`lutry` d3<br>`(329,161)` SIDEWALK · station:`lutry` d3 | `(321,207)` ROAD · node:`lutry-vieux-bourg` d3 · 건물 S<br>`(327,207)` ROAD · node:`lutry-vieux-bourg` d3 · 건물 E |
| 레만호 연안 | 브베 (`vevey`) | `(934,426)` ROAD · station:`vevey` d3<br>`(931,429)` ROAD · station:`vevey` d3<br>`(937,429)` ROAD · station:`vevey` d3 | `(928,434)` ROAD · node:`vevey-marche` d3 · 건물 W<br>`(924,443)` ROAD · transit:`vevey-landing` d3 · 건물 N |
| 레만호 연안 | 몽트뢰·시옹 (`montreux-chillon`) | `(1190,575)` ROAD · station:`montreux` d3<br>`(1193,578)` ROAD · station:`montreux` d3<br>`(1190,581)` SIDEWALK · station:`montreux` d3 | `(1193,592)` ROAD · transit:`montreux-landing` d3 · 건물 N<br>`(1190,595)` ROAD · transit:`montreux-landing` d3 · 건물 E |

## 결정성·검증 증거

- 동일 one-shot 산출 2회 JSON은 byte-identical이며 SHA-256은 두 번 모두
  `269b1653e4dea39b32e625f948cc5de006374827b9353b5a0cbacb3c5f6f213a`.
- 산출 검증은 7도시·24지구·NPC 72개·도어 48개 exact count, 유효 보행 타일, 기존 마커
  Chebyshev 이격 3 이상, 같은 도시 후보 상호 이격 3 이상을 assertion으로 전수 확인했다.
- NPC 기존 마커 이격 범위 3~5타일, 도어 3~8타일. 도어 48/48이 cardinal BUILDING 인접이다.
  주동선 3도시의 NPC는 24/24, 도어는 16/16 모두 R0다.
- 산출기 메모리 증거 실행의 `process.resourceUsage()` max RSS 635,216 KiB
  (650,461,184 bytes), user CPU 4.09초, system CPU 0.50초.
- targeted 지구·레지스트리·주동선 회귀: 4 files / 54 tests PASS(17.20초).
- 전체 회귀: 212 files / 2,141 tests PASS(146.79초).
- `npm run lint`, 표 좌표 120개 exact 재대조, `git diff --check` PASS.

## 비구현 경계

이 문서는 후보 타일과 선택 근거만 제안한다. NPC 역할·이름·대사, 도어 chapter·카피·GBC 세트,
발견 문장, runtime 배선, 도시·geo·지구 rect·주동선·registry·verifier·DB는 변경하지 않는다.
후속 구현 때도 이 표의 좌표를 자동 승인으로 보지 않고 Claude SPEC의 선택 좌표만 사용한다.
