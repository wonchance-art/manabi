# Q1-v2 타일 정합 확장 스캔 E~I

`scripts/scan-tile-integrity-extra.mjs`의 결정적 출력이다. 좌표는 0-based `[x,y]`이며,
26도시는 `CITY_MANIFEST`, 타일은 row-major 순서로 순회했다. 이 감사는 report-only이고
게임 데이터·엔진을 변경하지 않는다.

## 판정 기준

- E: road-like(ROAD·CROSSWALK·BRIDGE·EXIT) 단면이 양쪽에서 각각 3칸 이상 같게 유지되면서 폭이 `1 ↔ 3+`로 바뀌는 경계.
- F: CROSSWALK 성분 밖 도로가 양방향 2칸 이상 이어지는 유일 진행축에서, 전후 1칸을 포함한 3단면 도로 폭이 안정적이지만 CROSSWALK 최장 런 길이가 폭과 다른 곳.
- G: BRIDGE 8방에 WATER·RIVER가 없거나, 일반 ROAD의 8방 대향쌍에 WATER·RIVER가 모두 있는 곳.
- H: PLAZA·PARK 합집합의 4방 연결 성분이 정확히 1타일인 건수.
- I: 학습 도어(`spot+track+chapter`)·NPC·역 하부가 정확히 ROAD·WATER·RIVER인 엔티티 건수.

3×3 덤프는 `/`로 행을 나눈다. 범례: `R` ROAD, `.` SIDEWALK, `X` CROSSWALK,
`P` PLAZA, `G` PARK, `B` BRIDGE, `D` DOCK, `E` EXIT, `W` WATER, `~` RIVER,
`#` BUILDING, `I` ISLAND, `S` BEACH, `M` MOUNTAIN, `?` 범위 밖.

## 26도시 전수 통계

| 도시 | E | F | G | H | I |
|---|---:|---:|---:|---:|---:|
| fukuoka (후쿠오카) | 2 | 3 | 174 | 4 | 12 |
| tokyo (도쿄) | 9 | 70 | 7735 | 2543 | 12 |
| osaka (오사카) | 11 | 17 | 3252 | 653 | 5 |
| kyoto (교토) | 17 | 18 | 11846 | 975 | 2 |
| busan (부산) | 16 | 30 | 604 | 654 | 6 |
| seoul (서울) | 23 | 133 | 924 | 3772 | 7 |
| grand-paris (파리) | 26 | 323 | 329 | 6491 | 8 |
| mont-saint-michel (Mont-Saint-Michel) | 2 | 1 | 7 | 43 | 2 |
| cote-dazur (코트다쥐르) | 12 | 104 | 271 | 260 | 6 |
| brussels (브뤼셀) | 2 | 80 | 60 | 1016 | 2 |
| taipei (타이베이) | 12 | 56 | 113 | 700 | 7 |
| hong-kong (홍콩) | 6 | 27 | 85 | 204 | 4 |
| london (런던) | 23 | 251 | 666 | 6542 | 10 |
| shanghai (상하이) | 0 | 4 | 69 | 374 | 4 |
| beijing (베이징) | 11 | 41 | 46 | 179 | 3 |
| brisbane (브리즈번) | 4 | 76 | 142 | 796 | 4 |
| sydney (시드니) | 8 | 87 | 166 | 1575 | 6 |
| canberra (캔버라) | 2 | 57 | 51 | 1395 | 2 |
| melbourne (멜버른) | 6 | 48 | 81 | 993 | 2 |
| marseille (마르세유) | 1 | 23 | 41 | 240 | 7 |
| kawaguchiko (가와구치코) | 2 | 2 | 206 | 21 | 5 |
| geneva (제네바) | 2 | 13 | 72 | 1050 | 3 |
| leman-riviera (레만호 연안) | 9 | 45 | 275 | 204 | 9 |
| lyon (리옹) | 5 | 71 | 92 | 979 | 7 |
| bordeaux (보르도) | 2 | 58 | 103 | 704 | 4 |
| strasbourg (스트라스부르) | 0 | 28 | 150 | 1241 | 3 |
| **합계** | **213** | **1666** | **27560** | **33608** | **142** |

I 합계의 기능별 내역(좌표 미출력):

| 기능 | 건수 |
|---|---:|
| door | 43 |
| npc | 10 |
| station | 89 |

## E·F·G 대표 좌표와 3×3 덤프

대표 표본은 manifest 도시 순서에서 도시별 n번째 건을 round-robin으로 뽑았다.

### E. 도로 폭 널뛰기 — 대표 10건

| # | 도시 | 좌표 | 판정 | 3×3 |
|---:|---|---:|---|---|
| 1 | fukuoka | [334,174] | 진행 V, 폭 3→1 | `RR./RR./#R.` |
| 2 | tokyo | [802,247] | 진행 V, 폭 1→9 | `.R./RRR/RRR` |
| 3 | osaka | [180,26] | 진행 V, 폭 1→3 | `.B~/RB~/RB~` |
| 4 | kyoto | [423,72] | 진행 H, 폭 4→1 | `.../RRR/RRG` |
| 5 | busan | [923,45] | 진행 V, 폭 8→1 | `RR./RR./.R.` |
| 6 | seoul | [576,131] | 진행 V, 폭 4→1 | `RR./RR~/.R~` |
| 7 | grand-paris | [905,39] | 진행 V, 폭 4→1 | `RR./RR./#R.` |
| 8 | mont-saint-michel | [381,377] | 진행 V, 폭 3→1 | `WBB/WBB/WBW` |
| 9 | cote-dazur | [324,41] | 진행 H, 폭 4→1 | `.../RRR/RR.` |
| 10 | brussels | [144,40] | 진행 H, 폭 1→4 | `.RR/RRR/.WW` |

### F. 횡단보도 길이 불일치 — 대표 10건

| # | 도시 | 좌표 | 판정 | 3×3 |
|---:|---|---:|---|---|
| 1 | fukuoka | [307,133] | 런 H, CROSSWALK 2 / 도로 5 | `RRR/RXX/RRR` |
| 2 | tokyo | [169,1] | 런 V, CROSSWALK 1 / 도로 2 | `###/RXR/RRR` |
| 3 | osaka | [216,162] | 런 V, CROSSWALK 1 / 도로 2 | `..#/RXR/RRR` |
| 4 | kyoto | [315,166] | 런 H, CROSSWALK 1 / 도로 5 | `.RR/#XR/.RR` |
| 5 | busan | [909,1] | 런 V, CROSSWALK 2 / 도로 5 | `RRR/RXR/RXR` |
| 6 | seoul | [343,14] | 런 V, CROSSWALK 1 / 도로 3 | `RRX/RXR/RRR` |
| 7 | grand-paris | [834,3] | 런 H, CROSSWALK 1 / 도로 2 | `#RR/#XR/.RR` |
| 8 | mont-saint-michel | [423,941] | 런 V, CROSSWALK 1 / 도로 3 | `RRR/RXR/RRR` |
| 9 | cote-dazur | [423,11] | 런 V, CROSSWALK 1 / 도로 3 | `.../RXR/RRR` |
| 10 | brussels | [31,3] | 런 V, CROSSWALK 1 / 도로 3 | `#.#/RXR/RRR` |

### G. 교량-물 어긋남 — 대표 10건

| # | 도시 | 좌표 | 판정 | 3×3 |
|---:|---|---:|---|---|
| 1 | fukuoka | [281,63] | dry-bridge | `BBB/BBB/BBB` |
| 2 | tokyo | [622,2] | dry-bridge | `BRR/BBB/BBB` |
| 3 | osaka | [43,2] | dry-bridge | `##B/#BB/.BB` |
| 4 | kyoto | [377,1] | dry-bridge | `BBB/.BB/..B` |
| 5 | busan | [1301,3] | road-over-water | `.~~/RRR/R~R` |
| 6 | seoul | [476,1] | road-over-water | `R~./RR./.~R` |
| 7 | grand-paris | [1327,8] | road-over-water | `..W/RR#/W##` |
| 8 | mont-saint-michel | [298,195] | dry-bridge | `RRR/BBB/.RB` |
| 9 | cote-dazur | [1269,5] | road-over-water | `RR~/~R~/.RR` |
| 10 | brussels | [286,23] | road-over-water | `~W#/WRR/WR~` |

## 리옹 상세 — E·F·G 전 건

### E. 도로 폭 널뛰기 (5건)

| # | 좌표 | 판정 |
|---:|---:|---|
| 1 | [407,143] | 진행 H, 폭 5→1 |
| 2 | [381,235] | 진행 V, 폭 1→3 |
| 3 | [243,449] | 진행 H, 폭 1→4 |
| 4 | [300,452] | 진행 H, 폭 1→7 |
| 5 | [384,486] | 진행 V, 폭 1→5 |

### F. 횡단보도 길이 불일치 (71건)

| # | 좌표 | 판정 |
|---:|---:|---|
| 1 | [113,9] | 런 H, CROSSWALK 1 / 도로 3 |
| 2 | [177,17] | 런 V, CROSSWALK 1 / 도로 3 |
| 3 | [227,46] | 런 H, CROSSWALK 1 / 도로 2 |
| 4 | [287,46] | 런 V, CROSSWALK 2 / 도로 3 |
| 5 | [244,66] | 런 V, CROSSWALK 1 / 도로 12 |
| 6 | [45,71] | 런 H, CROSSWALK 1 / 도로 3 |
| 7 | [68,77] | 런 H, CROSSWALK 2 / 도로 4 |
| 8 | [258,77] | 런 V, CROSSWALK 1 / 도로 5 |
| 9 | [262,77] | 런 V, CROSSWALK 2 / 도로 5 |
| 10 | [259,78] | 런 V, CROSSWALK 1 / 도로 5 |
| 11 | [258,79] | 런 V, CROSSWALK 1 / 도로 5 |
| 12 | [321,112] | 런 H, CROSSWALK 1 / 도로 3 |
| 13 | [270,123] | 런 H, CROSSWALK 1 / 도로 4 |
| 14 | [212,124] | 런 H, CROSSWALK 1 / 도로 5 |
| 15 | [345,157] | 런 V, CROSSWALK 1 / 도로 3 |
| 16 | [73,160] | 런 H, CROSSWALK 1 / 도로 6 |
| 17 | [104,163] | 런 H, CROSSWALK 1 / 도로 3 |
| 18 | [136,169] | 런 V, CROSSWALK 1 / 도로 4 |
| 19 | [415,174] | 런 H, CROSSWALK 1 / 도로 3 |
| 20 | [268,181] | 런 H, CROSSWALK 1 / 도로 3 |
| 21 | [268,183] | 런 H, CROSSWALK 1 / 도로 3 |
| 22 | [268,185] | 런 H, CROSSWALK 1 / 도로 3 |
| 23 | [339,193] | 런 V, CROSSWALK 1 / 도로 2 |
| 24 | [151,195] | 런 H, CROSSWALK 2 / 도로 3 |
| 25 | [381,196] | 런 V, CROSSWALK 1 / 도로 3 |
| 26 | [275,201] | 런 V, CROSSWALK 2 / 도로 3 |
| 27 | [27,202] | 런 V, CROSSWALK 1 / 도로 7 |
| 28 | [323,202] | 런 V, CROSSWALK 1 / 도로 3 |
| 29 | [125,204] | 런 H, CROSSWALK 1 / 도로 2 |
| 30 | [22,211] | 런 H, CROSSWALK 1 / 도로 3 |
| 31 | [249,218] | 런 V, CROSSWALK 1 / 도로 3 |
| 32 | [278,219] | 런 H, CROSSWALK 1 / 도로 3 |
| 33 | [265,220] | 런 H, CROSSWALK 1 / 도로 3 |
| 34 | [241,222] | 런 H, CROSSWALK 2 / 도로 4 |
| 35 | [264,223] | 런 H, CROSSWALK 2 / 도로 3 |
| 36 | [387,226] | 런 V, CROSSWALK 2 / 도로 6 |
| 37 | [383,227] | 런 V, CROSSWALK 1 / 도로 3 |
| 38 | [241,229] | 런 H, CROSSWALK 2 / 도로 3 |
| 39 | [48,243] | 런 V, CROSSWALK 1 / 도로 3 |
| 40 | [338,256] | 런 H, CROSSWALK 1 / 도로 3 |
| 41 | [422,258] | 런 H, CROSSWALK 1 / 도로 5 |
| 42 | [300,264] | 런 V, CROSSWALK 1 / 도로 3 |
| 43 | [247,274] | 런 H, CROSSWALK 2 / 도로 4 |
| 44 | [279,279] | 런 V, CROSSWALK 1 / 도로 3 |
| 45 | [313,307] | 런 H, CROSSWALK 2 / 도로 3 |
| 46 | [401,313] | 런 V, CROSSWALK 1 / 도로 4 |
| 47 | [368,334] | 런 H, CROSSWALK 1 / 도로 3 |
| 48 | [369,335] | 런 H, CROSSWALK 1 / 도로 3 |
| 49 | [367,342] | 런 H, CROSSWALK 2 / 도로 3 |
| 50 | [23,352] | 런 H, CROSSWALK 1 / 도로 3 |
| 51 | [202,352] | 런 V, CROSSWALK 1 / 도로 3 |
| 52 | [99,353] | 런 H, CROSSWALK 1 / 도로 2 |
| 53 | [108,365] | 런 H, CROSSWALK 2 / 도로 9 |
| 54 | [160,381] | 런 V, CROSSWALK 1 / 도로 3 |
| 55 | [100,392] | 런 H, CROSSWALK 2 / 도로 5 |
| 56 | [376,406] | 런 H, CROSSWALK 1 / 도로 4 |
| 57 | [83,433] | 런 H, CROSSWALK 1 / 도로 3 |
| 58 | [348,433] | 런 V, CROSSWALK 2 / 도로 3 |
| 59 | [4,435] | 런 V, CROSSWALK 1 / 도로 2 |
| 60 | [36,446] | 런 V, CROSSWALK 1 / 도로 3 |
| 61 | [100,446] | 런 V, CROSSWALK 1 / 도로 2 |
| 62 | [50,447] | 런 V, CROSSWALK 1 / 도로 3 |
| 63 | [298,447] | 런 V, CROSSWALK 1 / 도로 3 |
| 64 | [267,461] | 런 V, CROSSWALK 1 / 도로 6 |
| 65 | [273,461] | 런 V, CROSSWALK 1 / 도로 6 |
| 66 | [380,468] | 런 H, CROSSWALK 1 / 도로 5 |
| 67 | [98,470] | 런 H, CROSSWALK 2 / 도로 3 |
| 68 | [99,474] | 런 H, CROSSWALK 2 / 도로 3 |
| 69 | [252,479] | 런 H, CROSSWALK 1 / 도로 4 |
| 70 | [380,487] | 런 H, CROSSWALK 2 / 도로 5 |
| 71 | [379,493] | 런 H, CROSSWALK 2 / 도로 3 |

### G. 교량-물 어긋남 (92건)

| # | 좌표 | 판정 |
|---:|---:|---|
| 1 | [109,7] | road-over-water |
| 2 | [158,12] | road-over-water |
| 3 | [158,13] | road-over-water |
| 4 | [158,14] | road-over-water |
| 5 | [134,41] | road-over-water |
| 6 | [76,43] | road-over-water |
| 7 | [129,45] | road-over-water |
| 8 | [67,61] | road-over-water |
| 9 | [396,69] | road-over-water |
| 10 | [250,70] | road-over-water |
| 11 | [250,71] | road-over-water |
| 12 | [250,72] | road-over-water |
| 13 | [251,73] | road-over-water |
| 14 | [251,74] | road-over-water |
| 15 | [236,75] | road-over-water |
| 16 | [251,75] | road-over-water |
| 17 | [92,76] | road-over-water |
| 18 | [251,76] | road-over-water |
| 19 | [91,80] | road-over-water |
| 20 | [90,81] | road-over-water |
| 21 | [89,85] | road-over-water |
| 22 | [255,93] | road-over-water |
| 23 | [5,94] | road-over-water |
| 24 | [4,99] | road-over-water |
| 25 | [232,110] | road-over-water |
| 26 | [229,111] | road-over-water |
| 27 | [256,119] | road-over-water |
| 28 | [72,120] | road-over-water |
| 29 | [73,120] | road-over-water |
| 30 | [248,121] | road-over-water |
| 31 | [78,122] | road-over-water |
| 32 | [70,130] | road-over-water |
| 33 | [16,137] | road-over-water |
| 34 | [18,137] | road-over-water |
| 35 | [42,139] | road-over-water |
| 36 | [256,142] | road-over-water |
| 37 | [8,148] | road-over-water |
| 38 | [98,176] | road-over-water |
| 39 | [180,177] | road-over-water |
| 40 | [118,180] | road-over-water |
| 41 | [148,180] | road-over-water |
| 42 | [118,181] | road-over-water |
| 43 | [147,181] | road-over-water |
| 44 | [118,182] | road-over-water |
| 45 | [147,182] | road-over-water |
| 46 | [119,183] | road-over-water |
| 47 | [195,191] | road-over-water |
| 48 | [196,191] | road-over-water |
| 49 | [197,191] | road-over-water |
| 50 | [189,192] | road-over-water |
| 51 | [190,192] | road-over-water |
| 52 | [191,192] | road-over-water |
| 53 | [192,192] | road-over-water |
| 54 | [193,192] | road-over-water |
| 55 | [194,192] | road-over-water |
| 56 | [153,214] | road-over-water |
| 57 | [154,214] | road-over-water |
| 58 | [155,214] | road-over-water |
| 59 | [156,214] | road-over-water |
| 60 | [157,215] | road-over-water |
| 61 | [158,215] | road-over-water |
| 62 | [139,238] | road-over-water |
| 63 | [140,238] | road-over-water |
| 64 | [140,239] | road-over-water |
| 65 | [141,239] | road-over-water |
| 66 | [142,240] | road-over-water |
| 67 | [174,263] | road-over-water |
| 68 | [99,316] | road-over-water |
| 69 | [102,319] | road-over-water |
| 70 | [88,323] | road-over-water |
| 71 | [89,323] | road-over-water |
| 72 | [93,326] | road-over-water |
| 73 | [121,350] | road-over-water |
| 74 | [115,372] | road-over-water |
| 75 | [105,406] | road-over-water |
| 76 | [106,410] | road-over-water |
| 77 | [58,438] | road-over-water |
| 78 | [58,439] | road-over-water |
| 79 | [57,440] | road-over-water |
| 80 | [185,442] | road-over-water |
| 81 | [31,444] | road-over-water |
| 82 | [64,448] | road-over-water |
| 83 | [64,449] | road-over-water |
| 84 | [65,449] | road-over-water |
| 85 | [66,449] | road-over-water |
| 86 | [96,455] | road-over-water |
| 87 | [96,456] | road-over-water |
| 88 | [86,457] | road-over-water |
| 89 | [86,458] | road-over-water |
| 90 | [13,470] | road-over-water |
| 91 | [173,471] | road-over-water |
| 92 | [12,479] | road-over-water |

H·I는 요청 범위에 따라 건수만 위 통계표에 기록했다.

## r2 고신뢰 G′·H′ 기준

- 상태: **report-only** — 도시 geo·게임 데이터·엔진 수정 없음
- 범위: `CITY_MANIFEST` 26도시, 각 도시 `buildGrid()` 결과
- 좌표: 0-based `[x,y]`; G′ 좌표는 BRIDGE 4방 성분의 row-major 최소 anchor
- 변경 경계: G·H 판정만 강화했으며 E·F·I 판정 로직은 r1과 동일

### r2 판정 기준

| 유형 | 정량 판정 |
|---|---|
| E | r1과 동일: 안정 단면 도로 폭 `1 ↔ 3+` 경계. |
| F | r1과 동일: 안정 도로 폭과 CROSSWALK 최장 런 길이 불일치. |
| G′ | BRIDGE maximal 4방 성분 전체의 cardinal WATER·RIVER 접촉이 0이고, 8방 DOCK 인접도 0일 때만 성분당 1건. 일반 ROAD는 대상에서 제외한다. |
| H′ | PLAZA·GREEN(PARK) 합집합 4방 성분이 정확히 1타일이고 그 타일의 N·E·S·W가 전부 정확히 ROAD·CROSSWALK일 때만 1건. 경계·인도·건물·기타 지형 접촉은 제외한다. |
| I | r1과 동일: 학습 도어·NPC·역 하부가 정확히 ROAD·WATER·RIVER인 엔티티. |

3×3 덤프는 `/`로 행을 나눈다. 범례: `R` ROAD, `.` SIDEWALK, `X` CROSSWALK,
`P` PLAZA, `G` PARK, `B` BRIDGE, `D` DOCK, `E` EXIT, `W` WATER, `~` RIVER,
`#` BUILDING, `I` ISLAND, `S` BEACH, `M` MOUNTAIN, `?` 범위 밖.

### r2 26도시 전수 통계

| 도시 | E | F | G′ | H′ | I |
|---|---:|---:|---:|---:|---:|
| fukuoka (후쿠오카) | 2 | 3 | 0 | 0 | 12 |
| tokyo (도쿄) | 9 | 70 | 245 | 155 | 12 |
| osaka (오사카) | 11 | 17 | 71 | 72 | 5 |
| kyoto (교토) | 17 | 18 | 107 | 74 | 2 |
| busan (부산) | 16 | 30 | 0 | 59 | 6 |
| seoul (서울) | 23 | 133 | 0 | 316 | 7 |
| grand-paris (파리) | 26 | 323 | 0 | 306 | 8 |
| mont-saint-michel (Mont-Saint-Michel) | 2 | 1 | 0 | 0 | 2 |
| cote-dazur (코트다쥐르) | 12 | 104 | 0 | 29 | 6 |
| brussels (브뤼셀) | 2 | 80 | 0 | 43 | 2 |
| taipei (타이베이) | 12 | 56 | 0 | 51 | 7 |
| hong-kong (홍콩) | 6 | 27 | 0 | 8 | 4 |
| london (런던) | 23 | 251 | 0 | 281 | 10 |
| shanghai (상하이) | 0 | 4 | 0 | 25 | 4 |
| beijing (베이징) | 11 | 41 | 0 | 6 | 3 |
| brisbane (브리즈번) | 4 | 76 | 0 | 37 | 4 |
| sydney (시드니) | 8 | 87 | 0 | 65 | 6 |
| canberra (캔버라) | 2 | 57 | 0 | 91 | 2 |
| melbourne (멜버른) | 6 | 48 | 0 | 58 | 2 |
| marseille (마르세유) | 1 | 23 | 0 | 11 | 7 |
| kawaguchiko (가와구치코) | 2 | 2 | 0 | 0 | 5 |
| geneva (제네바) | 2 | 13 | 0 | 75 | 3 |
| leman-riviera (레만호 연안) | 9 | 45 | 0 | 8 | 9 |
| lyon (리옹) | 5 | 71 | 0 | 60 | 7 |
| bordeaux (보르도) | 2 | 58 | 0 | 54 | 4 |
| strasbourg (스트라스부르) | 0 | 28 | 0 | 78 | 3 |
| **합계** | **213** | **1666** | **423** | **1962** | **142** |

I 합계의 기능별 내역(판정 불변, 좌표 미출력):

| 기능 | 건수 |
|---|---:|
| door | 43 |
| npc | 10 |
| station | 89 |

### r2 G′·H′ 대표 좌표와 3×3 덤프

대표 표본은 manifest 도시 순서에서 도시별 n번째 건을 round-robin으로 뽑았다.

#### G′. 교량-물 어긋남 — 대표 10건

| # | 도시 | 좌표 | 판정 | 3×3 |
|---:|---|---:|---|---|
| 1 | tokyo | [30,14] | 성분 2타일, cardinal 물·8방 DOCK 접촉 0 | `G.G/GB./.B.` |
| 2 | osaka | [100,4] | 성분 1타일, cardinal 물·8방 DOCK 접촉 0 | `G.X/GBR/.RX` |
| 3 | kyoto | [316,5] | 성분 1타일, cardinal 물·8방 DOCK 접촉 0 | `.../GB./..R` |
| 4 | tokyo | [792,22] | 성분 1타일, cardinal 물·8방 DOCK 접촉 0 | `RRR/RBR/RRR` |
| 5 | osaka | [9,5] | 성분 1타일, cardinal 물·8방 DOCK 접촉 0 | `RRR/RB./RR.` |
| 6 | kyoto | [595,35] | 성분 1타일, cardinal 물·8방 DOCK 접촉 0 | `R../RB./R..` |
| 7 | tokyo | [784,29] | 성분 1타일, cardinal 물·8방 DOCK 접촉 0 | `RRR/RB./RR.` |
| 8 | osaka | [516,8] | 성분 2타일, cardinal 물·8방 DOCK 접촉 0 | `RRR/RBB/RR.` |
| 9 | kyoto | [433,51] | 성분 2타일, cardinal 물·8방 DOCK 접촉 0 | `.../.B./.B.` |
| 10 | tokyo | [517,35] | 성분 1타일, cardinal 물·8방 DOCK 접촉 0 | `RRR/RBR/RRR` |

#### H′. 광장·공원 차도 포위 파편 — 대표 10건

| # | 도시 | 좌표 | 판정 | 3×3 |
|---:|---|---:|---|---|
| 1 | tokyo | [52,3] | GREEN, 4방 ROAD·CROSSWALK | `RRR/RGR/RRR` |
| 2 | osaka | [145,13] | GREEN, 4방 ROAD·CROSSWALK | `RRR/RGR/RRR` |
| 3 | kyoto | [417,10] | GREEN, 4방 ROAD·CROSSWALK | `RRR/RGR/RRR` |
| 4 | busan | [525,34] | GREEN, 4방 ROAD·CROSSWALK | `RRR/RGR/GRR` |
| 5 | seoul | [1165,1] | GREEN, 4방 ROAD·CROSSWALK | `RR./RGR/RR.` |
| 6 | grand-paris | [586,19] | GREEN, 4방 ROAD·CROSSWALK | `RR./RGR/RRG` |
| 7 | cote-dazur | [1485,52] | GREEN, 4방 ROAD·CROSSWALK | `RRX/RGR/RRR` |
| 8 | brussels | [258,3] | GREEN, 4방 ROAD·CROSSWALK | `.R#/RGR/RRG` |
| 9 | taipei | [293,52] | GREEN, 4방 ROAD·CROSSWALK | `RR#/RGR/#RR` |
| 10 | hong-kong | [509,28] | GREEN, 4방 ROAD·CROSSWALK | `RRR/RGX/RRX` |

### 리옹 상세 — r2 G′·H′ 전 건 좌표

#### G′. 교량-물 어긋남 (0건)

없음.

#### H′. 광장·공원 차도 포위 파편 (60건)

| # | 좌표 | 판정 |
|---:|---:|---|
| 1 | [93,19] | GREEN, 4방 ROAD·CROSSWALK |
| 2 | [84,21] | GREEN, 4방 ROAD·CROSSWALK |
| 3 | [222,22] | GREEN, 4방 ROAD·CROSSWALK |
| 4 | [86,24] | GREEN, 4방 ROAD·CROSSWALK |
| 5 | [219,27] | GREEN, 4방 ROAD·CROSSWALK |
| 6 | [91,28] | GREEN, 4방 ROAD·CROSSWALK |
| 7 | [92,29] | GREEN, 4방 ROAD·CROSSWALK |
| 8 | [93,30] | GREEN, 4방 ROAD·CROSSWALK |
| 9 | [92,31] | GREEN, 4방 ROAD·CROSSWALK |
| 10 | [189,36] | GREEN, 4방 ROAD·CROSSWALK |
| 11 | [10,60] | GREEN, 4방 ROAD·CROSSWALK |
| 12 | [225,64] | GREEN, 4방 ROAD·CROSSWALK |
| 13 | [314,85] | GREEN, 4방 ROAD·CROSSWALK |
| 14 | [229,101] | GREEN, 4방 ROAD·CROSSWALK |
| 15 | [19,110] | GREEN, 4방 ROAD·CROSSWALK |
| 16 | [292,110] | GREEN, 4방 ROAD·CROSSWALK |
| 17 | [280,111] | GREEN, 4방 ROAD·CROSSWALK |
| 18 | [413,137] | GREEN, 4방 ROAD·CROSSWALK |
| 19 | [412,138] | GREEN, 4방 ROAD·CROSSWALK |
| 20 | [227,147] | GREEN, 4방 ROAD·CROSSWALK |
| 21 | [203,178] | GREEN, 4방 ROAD·CROSSWALK |
| 22 | [349,220] | GREEN, 4방 ROAD·CROSSWALK |
| 23 | [99,234] | GREEN, 4방 ROAD·CROSSWALK |
| 24 | [359,240] | GREEN, 4방 ROAD·CROSSWALK |
| 25 | [231,263] | GREEN, 4방 ROAD·CROSSWALK |
| 26 | [364,266] | GREEN, 4방 ROAD·CROSSWALK |
| 27 | [314,283] | GREEN, 4방 ROAD·CROSSWALK |
| 28 | [401,333] | GREEN, 4방 ROAD·CROSSWALK |
| 29 | [253,336] | GREEN, 4방 ROAD·CROSSWALK |
| 30 | [252,337] | GREEN, 4방 ROAD·CROSSWALK |
| 31 | [363,348] | GREEN, 4방 ROAD·CROSSWALK |
| 32 | [262,350] | GREEN, 4방 ROAD·CROSSWALK |
| 33 | [261,353] | GREEN, 4방 ROAD·CROSSWALK |
| 34 | [395,388] | GREEN, 4방 ROAD·CROSSWALK |
| 35 | [381,389] | GREEN, 4방 ROAD·CROSSWALK |
| 36 | [407,396] | GREEN, 4방 ROAD·CROSSWALK |
| 37 | [413,398] | GREEN, 4방 ROAD·CROSSWALK |
| 38 | [425,399] | GREEN, 4방 ROAD·CROSSWALK |
| 39 | [414,400] | GREEN, 4방 ROAD·CROSSWALK |
| 40 | [420,402] | GREEN, 4방 ROAD·CROSSWALK |
| 41 | [135,410] | GREEN, 4방 ROAD·CROSSWALK |
| 42 | [312,417] | GREEN, 4방 ROAD·CROSSWALK |
| 43 | [419,418] | GREEN, 4방 ROAD·CROSSWALK |
| 44 | [411,422] | GREEN, 4방 ROAD·CROSSWALK |
| 45 | [310,428] | GREEN, 4방 ROAD·CROSSWALK |
| 46 | [311,429] | GREEN, 4방 ROAD·CROSSWALK |
| 47 | [312,430] | GREEN, 4방 ROAD·CROSSWALK |
| 48 | [313,431] | GREEN, 4방 ROAD·CROSSWALK |
| 49 | [369,434] | GREEN, 4방 ROAD·CROSSWALK |
| 50 | [369,441] | GREEN, 4방 ROAD·CROSSWALK |
| 51 | [328,446] | GREEN, 4방 ROAD·CROSSWALK |
| 52 | [337,447] | GREEN, 4방 ROAD·CROSSWALK |
| 53 | [338,457] | GREEN, 4방 ROAD·CROSSWALK |
| 54 | [340,457] | GREEN, 4방 ROAD·CROSSWALK |
| 55 | [405,466] | GREEN, 4방 ROAD·CROSSWALK |
| 56 | [420,477] | GREEN, 4방 ROAD·CROSSWALK |
| 57 | [422,479] | GREEN, 4방 ROAD·CROSSWALK |
| 58 | [423,480] | GREEN, 4방 ROAD·CROSSWALK |
| 59 | [417,482] | GREEN, 4방 ROAD·CROSSWALK |
| 60 | [73,494] | GREEN, 4방 ROAD·CROSSWALK |

E·F·I는 판정 불변이므로 r1 상세를 유지하고 위 통계만 재집계했다.

### r2 결정성·재현

- manifest 도시 순서 → 각 grid row-major `(y,x)` → cardinal 이웃 고정 순회.
- 시간·로케일 정렬·파일 열거·난수·네트워크 입력 없음.
- 동일 입력 2회 stdout byte 비교와 SHA-256 결과는 PR 검증 시 기록한다.

```bash
node scripts/scan-tile-integrity-extra.mjs > /tmp/tile-integrity-extra-r2-a.md
node scripts/scan-tile-integrity-extra.mjs > /tmp/tile-integrity-extra-r2-b.md
cmp /tmp/tile-integrity-extra-r2-a.md /tmp/tile-integrity-extra-r2-b.md
shasum -a 256 /tmp/tile-integrity-extra-r2-a.md /tmp/tile-integrity-extra-r2-b.md
```
