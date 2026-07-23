# 부산 mainRoute 주동선 후보 실측

- 상태: **report-only / 조건부 NO-GO** — 도시 wrapper·geo·district rect·
  `cityMainRoute.js`·CityScene·registry·verifier·DB·카피·테스트 변경 없음
- 측정 기준: `origin/main` `1eabd17c723a32917f23e80f084dd13f6f585030`
  (#514/T26 merge 포함)
- 게시 직전 main: `4b7b8297d7a89d6d361f5dedccf159be93a16f13`
  (#508·#512, 아래 측정 입력 5파일과 비중첩)
- 선례 계약: 도쿄·서울·오사카·교토 후보 실측의 `version=1`,
  `cardinal-bfs-v1`, `URDL`, `excludeExit=true`, typed `node|station` waypoint,
  little-endian uint32 path SHA-256
- 회랑 계약: T26의 districts open rect 대조, 연속 locked 지대 전수, 최대 48타일
  조각·bbox ±2·한 변 64타일·면적 768타일² 상한, 인접 지구 소속 제안
- 후보 ID: `busan-classic-loop-candidate-a`(승인 전 예약 아님)
- 측정 환경: 2026-07-23, official nvm Node `v22.23.1`

## 판정

1. 후보 A는 부산역→감천문화마을→자갈치시장→흰여울문화마을→해운대해수욕장→
   광안리해수욕장→동래읍성→부산대앞 젊음의 거리→서면역→
   부산항국제여객터미널의 **10 waypoint / 9 leg**다. waypoint 10/10은 기존 typed
   ref로 exact-1 해석되고, open 지구 안의 보행 가능·비EXIT 실측 타일이다.
   `port-core`, `south-coast`, `east-coast`, `central-north` 네 open 지구를
   waypoint 기준으로 모두 방문한다.
2. 실제 도시 `ENTRANCE [684,695]`는 첫 waypoint 부산역 `[684,695]`과 exact다.
   종점 부산항 `[684,671]`에서 기점으로 돌아오는 비EXIT URDL 최단경로는
   `R1 D24 L1`, 26 steps / 27 tiles이며 전 타일 open이다. 같은 x열의 실제 EXIT
   `[684,685]`, `[684,686]`을 한 칸 우회하므로 반복 waypoint 없이 부산역 방면
   진입점 가까이 돌아오는 한 바퀴 형태다.
3. 전체 도시 보행망의 URDL BFS에서는 9/9 leg가 도달한다. 경로는
   **3,200 steps / 3,201 tiles / 게임-grid 64.00km**, 전 타일 보행 가능,
   차단 0, EXIT 0이다. 관련 waypoint는 모두 전역 component 0
   (685,507타일)에 속한다.
4. 그러나 현 open union의 waypoint 보행 성분은 원도심 component 13,
   흰여울 component 18, 동부 해안 component 7, 동래 component 4,
   부산대 component 0, 서면 component 10의 여섯으로 끊겨 있다. 따라서 네 지구를
   잇는 **연속 open-only cardinal BFS는 현재 계약상 존재하지 않는다.**
5. 후보 A의 3,201타일 중 open은 1,573, locked는 1,628이다. open-only PASS는
   부산역→감천, 감천→자갈치, 해운대→광안리의 3/9 leg다. 나머지 6개 leg의
   위반은 아래 **8개 연속 locked 지대**로 전수 분리된다.
6. T26 표준을 처음부터 적용한 권장 회랑은 39개 rect다. 최대 한 변 52타일,
   최대 면적 768타일²이며, 합집합이 locked 경로 **1,628/1,628**을 포함한다.
   이는 승인 전 지구 rect 제안일 뿐 `busan.js`를 변경하지 않는다.
7. `resolveCityDistricts(city, grid, resolvedMainRoute)`는 main route 전 타일에
   `assertOpen`을 적용하므로, 아래 RLE를 현재 `busan.js`에 그대로 배선하면 첫
   locked 타일 `[706,831]`에서 fail-closed 오류가 난다. Claude가 회랑을 승인하거나
   도시철도·장거리 이동을 표현할 별도 route 계약으로 분할하기 전에는
   **통합 금지**다. 경로 정책이 바뀌면 RLE·SHA도 다시 산출해야 한다.

거리(m)는 도시 geo의 20m/tile 게임-grid 환산값이며 실제 관광 보행거리 측량치가 아니다.

## 후보 계약

```js
{
  id: 'busan-classic-loop-candidate-a',
  version: 1,
  routing: {
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  },
  waypoints: [
    { kind: 'station', id: 'busan' },
    { kind: 'node', id: 'gamcheon' },
    { kind: 'node', id: 'jagalchi' },
    { kind: 'node', id: 'huinnyeoul' },
    { kind: 'node', id: 'haeundae' },
    { kind: 'node', id: 'gwangalli' },
    { kind: 'node', id: 'dongnae-eupseong' },
    { kind: 'node', id: 'pnu-street' },
    { kind: 'station', id: 'seomyeon' },
    { kind: 'node', id: 'busan-port-intl' },
  ],
  segmentHints: [],
  branches: [],
}
```

실패한 여섯 leg는 모두 양 endpoint의 open component 자체가 다르다. 단순 tie-break
변경이나 `viaTiles` 추가로 open-only가 될 수 없으므로 후보 A에는 `segmentHints`를
두지 않았다.

## waypoint 실측표

| # | typed key | 이름 | tile | open 지구 | terrain | open component | 판정 |
|---:|---|---|---:|---|---|---:|---|
| 1 | `station:busan` | 부산역 | `[684,695]` | `port-core` | ROAD(0) | 13 / 27,242 | open·walkable·non-EXIT |
| 2 | `node:gamcheon` | 감천문화마을 | `[548,792]` | `port-core` | ROAD(0) | 13 / 27,242 | open·walkable·non-EXIT |
| 3 | `node:jagalchi` | 자갈치시장 | `[640,798]` | `port-core` | ROAD(0) | 13 / 27,242 | open·walkable·non-EXIT |
| 4 | `node:huinnyeoul` | 흰여울문화마을 | `[711,905]` | `south-coast` | ROAD(0) | 18 / 906 | open·walkable·non-EXIT |
| 5 | `node:haeundae` | 해운대해수욕장 | `[1230,452]` | `east-coast` | SIDEWALK(1) | 7 / 22,628 | open·walkable·non-EXIT |
| 6 | `node:gwangalli` | 광안리해수욕장 | `[1040,483]` | `east-coast` | ROAD(0) | 7 / 22,628 | open·walkable·non-EXIT |
| 7 | `node:dongnae-eupseong` | 동래읍성 | `[887,167]` | `central-north` | ROAD(0) | 4 / 4,765 | open·walkable·non-EXIT |
| 8 | `node:pnu-street` | 부산대앞 젊음의 거리 | `[883,55]` | `central-north` | ROAD(0) | 0 / 2,697 | open·walkable·non-EXIT |
| 9 | `station:seomyeon` | 서면역 | `[770,457]` | `central-north` | ROAD(0) | 10 / 4,845 | open·walkable·non-EXIT |
| 10 | `node:busan-port-intl` | 부산항국제여객터미널 | `[684,671]` | `port-core` | ROAD(0) | 13 / 27,242 | open·walkable·non-EXIT |

open component 번호는 row-major 시작점과 URDL 이웃 순서로 전수 BFS한 결정적 ID다.
도시 전체 open·walkable·non-EXIT 성분은 23개다.

## leg별 BFS·open 검증

`open/locked`는 각 leg 자체의 endpoint 포함 tileCount 기준이다. 합계 행은 leg
접합점의 중복 waypoint 8개를 한 번만 센 전체 path 기준이다.

| # | from → to | steps / tiles | RLE runs | open / locked | blocked / EXIT | open-only | path SHA-256 |
|---:|---|---:|---:|---:|---:|---|---|
| 1 | 부산역 → 감천 | 233 / 234 | 23 | 234 / 0 | 0 / 0 | PASS | `ef14779ba419884175dd1cd3249cb14cc554a1717c8389516f581a450dcb6b04` |
| 2 | 감천 → 자갈치 | 106 / 107 | 13 | 107 / 0 | 0 / 0 | PASS | `254b757d3fd2dbd673766d439441c9ab0202b5379d3619565db4e9c285fc145d` |
| 3 | 자갈치 → 흰여울 | 178 / 179 | 18 | 125 / **54** | 0 / 0 | **FAIL** | `7fd3c068cecea62e413075b5281b586bc913b98e31e4f8bd49e85b2b5790fa1b` |
| 4 | 흰여울 → 해운대 | 1,004 / 1,005 | 323 | 354 / **651** | 0 / 0 | **FAIL** | `0b709130cc934aa9d4d94148897fa89bdf0f50af34204aec5a9af6c4ec345607` |
| 5 | 해운대 → 광안리 | 253 / 254 | 58 | 254 / 0 | 0 / 0 | PASS | `ee72f09144a265ca8cad160417ea5e961dc275b0ed60855ef45698f8c119fba2` |
| 6 | 광안리 → 동래 | 479 / 480 | 90 | 196 / **284** | 0 / 0 | **FAIL** | `9e653dc73e03d3d30cc2947d5777ce241299d9e1e7d80c5470cd0881a1ead00a` |
| 7 | 동래 → 부산대 | 132 / 133 | 28 | 60 / **73** | 0 / 0 | **FAIL** | `fe5766d22287a3f36937de7b254a7a34a1165e26320a4723442888adf58c6b76` |
| 8 | 부산대 → 서면 | 515 / 516 | 90 | 150 / **366** | 0 / 0 | **FAIL** | `aab7540fe6adad8e5ac780d7b86646319018ca1fe0e8b45dc4d2c736ea98d3e6` |
| 9 | 서면 → 부산항 | 300 / 301 | 50 | 101 / **200** | 0 / 0 | **FAIL** | `9a40ce65a37f92f7e5f9a4ef1faee5d2b138ff0db3f8790042ca9aedcdce5da7` |
| **합계** | 9/9 walkable reachable | **3,200 / 3,201** | **693** | **1,573 / 1,628** | **0 / 0** | **3/9 PASS** | `c0084b545b50e65a887966eaaa0aea58780847706187737929e9066be019cd08` |

## stepsRle 전문

아래 compact 표기는 저장 객체의 순서를 빠짐없이 적은 것이다. 예를 들어 `U5`는
`{ direction: 'U', count: 5 }`이며 생략 부호는 없다.

### 1. `station:busan--node:gamcheon`

```text
D4 L3 D23 L1 D29 L4 D1 L3 D32 L71 D1 L24 D1 L1 D1 L8 D1 L8 D1 L6 D2 L7 D1
```

### 2. `node:gamcheon--node:jagalchi`

```text
U2 R1 U2 R20 D2 R1 D1 R11 D1 R32 D1 R27 D5
```

### 3. `node:jagalchi--node:huinnyeoul`

```text
R27 D6 R1 D4 R4 D1 R1 D4 R23 D1 R1 D1 R9 D27 R1 D1 R4 D62
```

### 4. `node:huinnyeoul--node:haeundae`

```text
U62 R1 U1 R1 U3 R2 U20 R1 U22 R5 U2 R1 U2 R11 U1 R2 U8 R1 U4 R1 U1 R5 U1 R1
U1 R3 U1 R6 U1 R9 U1 R1 U1 R1 U1 R1 U2 R1 U1 R1 U1 R1 U1 R10 U1 R1 U2 R1
U1 R1 U1 R1 U1 R1 U1 R1 U1 R1 U2 R1 U1 R1 U1 R1 U1 R1 U1 R1 U1 R1 U1 R1
U1 R1 U1 R1 U1 R1 U1 R1 U1 R1 U2 R1 U1 R1 U1 R2 U1 R1 U1 R1 U3 R1 U1 R1
U4 R4 U2 R1 U1 R1 U1 R1 U2 R1 U2 R1 U2 R1 U1 R1 U1 R1 U1 R1 U18 R3 U2 R1
U1 R1 U1 R1 U2 R1 U2 R1 U1 R1 U2 R5 U1 R2 U1 R1 U1 R1 U3 R6 U1 R1 U1 R2
U1 R3 U1 R2 U1 R3 U1 R1 U6 R1 U18 R1 U4 R1 U1 R2 U1 R1 U6 R1 U3 R1 U3 R1
U10 R10 U1 R2 U1 R3 U1 R2 U1 R3 U1 R3 U5 R5 U37 R1 U1 R1 U4 R1 U10 R5 U10 R1
U1 R2 U17 R4 U1 R1 U1 R1 U1 R2 U1 R2 U1 R1 U1 R2 U1 R1 U1 R1 U1 R1 U1 R1
U1 R2 U1 R1 U1 R2 U1 R1 U1 R1 U1 R1 U5 R2 U6 R5 U1 R1 U6 R3 U5 R5 U1 R1
U3 R1 U2 R1 U1 R2 U1 R1 U2 R1 U1 R1 U2 R1 U2 R1 U4 R3 U3 R1 U5 R3 U1 R1
U1 R1 U1 R1 U1 R1 U2 R1 U1 R1 U2 R1 U5 R3 U1 R1 U2 R1 U3 R44 U1 R38 U1 R10
U1 R6 U1 R11 U2 R6 U1 R2 U1 R1 U1 R4 U3 R6 U1 R1 U1 R43 D1 R35 D1 R1 D1 R2
D1 R3 D1 R40 D2 R2 D2 R3 D6 R1 D1
```

### 5. `node:haeundae--node:gwangalli`

```text
U1 L1 U6 L3 U2 L2 U2 L40 U1 L3 U1 L2 U1 L1 U1 L35 U1 L40 D1 L2 D1 L1 D1 L1 D5 L1 D5 L8 D4 L1 D3 L2 D1 L1 D7 L2 D3 L2 D7 L2 D1 L8 D1 L4 D1 L15 D1 L2 D1 L2 D1 L2 D1 L1 D1 L1 D1 L5
```

### 6. `node:gwangalli--node:dongnae-eupseong`

```text
U4 L1 U1 L1 U62 L1 U17 L1 U36 L1 U26 L1 U3 L1 U19 L1 U2 L1 U4 L1 U2 L1 U3 L1 U3 L1 U3 L1 U5 L1 U9 L1 U3 L1 U2 L1 U4 L1 U4 L1 U12 L1 U44 L5 U1 L1 U1 L1 U1 L2 U1 L1 U1 L1 U1 L1 U4 L1 U1 L2 U1 L2 U3 L12 U1 L35 U3 L7 U2 L7 U2 L10 U1 L1 U1 L34 U6 L5 U2 L4 U2 L5 U4 R1 U1 R1 U6 R1 U2 R2
```

### 7. `node:dongnae-eupseong--node:pnu-street`

```text
U13 L3 U1 L2 U3 R3 U8 R1 U15 R1 U1 R1 U4 L1 U7 R1 U7 L1 U12 L1 U1 L1 U2 L1 U22 L2 U16 R1
```

### 8. `node:pnu-street--station:seomyeon`

```text
D14 L1 D29 L1 D6 L2 D27 L1 D1 L1 D1 L1 D1 L1 D1 L1 D1 L2 D1 L1 D1 L1 D2 L1 D1 L1 D1 L1 D3 L1 D1 L1 D1 L1 D4 L1 D2 L1 D1 L1 D2 L1 D3 L2 D2 L1 D4 L1 D86 L3 D1 L2 D1 L2 D1 L1 D57 L2 D16 L1 D2 L2 D3 L1 D1 L1 D59 L1 D4 L1 D11 L1 D1 L1 D4 L3 D4 L13 D2 L1 D3 L1 D1 L1 D2 L1 D8 L1 D25 L46
```

### 9. `station:seomyeon--node:busan-port-intl`

```text
D134 L2 D10 L1 D5 L2 D1 L1 D15 L1 D1 L1 D1 L1 D13 L20 D1 L1 D4 L2 D1 L1 D1 L1 D1 L2 D1 L2 D1 L1 D1 L2 D2 L1 D2 L1 D3 L1 D2 L1 D3 L1 D3 L19 D3 L1 D2 L1 D3 L19
```

## discovery 스팟 후보 8곳

`context`는 카피가 아니라 Claude 저작용 주변 맥락 제안이다. `at`은 해당 leg의
`start + round(at * stepCount)`(양 endpoint 제외 clamp) 규칙으로 재투영했다.
8곳 모두 open·walkable·non-EXIT이며 기존 node·station·prop 및 후보 상호 간
Chebyshev 이격이 3타일 이상이다.

| ID | leg | at | routeIndex | 실측 tile / 지구 | 기존 마커 이격 | 주변 맥락 제안 |
|---|---|---:|---:|---|---:|---|
| `busan-d1` | 부산역 → 감천 | 0.45 | 105 | `[668,784]` / `port-core` | 14 | 부산역에서 남포·원도심으로 내려온 뒤 감천 방향으로 꺾이는 구간 — 철도 관문과 시장 골목의 전환 |
| `busan-d2` | 자갈치 → 흰여울 | 0.90 | 499 | `[711,887]` / `south-coast` | 18 | 남포 항만축을 건너 영도 서안의 절벽 마을 접근로에 들어온 구간 |
| `busan-d3` | 흰여울 → 해운대 | 0.90 | 1,421 | `[1145,437]` / `east-coast` | 12 | 장거리 동부 이동 뒤 해운대 역세권·해변 접근 가로로 들어온 구간 |
| `busan-d4` | 해운대 → 광안리 | 0.50 | 1,648 | `[1119,436]` / `east-coast` | 38 | 해운대와 광안리 사이 동부 해안 생활축 — 해변권과 센텀 도심 경관의 전환 |
| `busan-d5` | 광안리 → 동래 | 0.90 | 2,205 | `[902,190]` / `central-north` | 23 | 수영권에서 북상해 동래 성곽·온천 생활권에 다시 들어온 구간 |
| `busan-d6` | 동래 → 부산대 | 0.90 | 2,372 | `[882,67]` / `central-north` | 12 | 동래 북쪽에서 부산대 대학가 open rect로 진입한 뒤 만나는 접근 가로 |
| `busan-d7` | 부산대 → 서면 | 0.95 | 2,874 | `[796,457]` / `central-north` | 26 | 북부 장거리 축을 내려와 서면 환승·상업권에 닿기 직전의 교차로 |
| `busan-d8` | 서면 → 부산항 | 0.90 | 3,170 | `[706,663]` / `port-core` | 22 | 서면에서 원도심으로 복귀해 부산항·초량 관문에 가까워지는 마지막 구간 |

발견점이 open이라고 해서 그 discovery의 전체 leg가 open인 것은 아니다. d2·d3·d5·
d6·d7·d8은 발견 tile 자체는 PASS지만 앞뒤 leg에 아래 locked 지대가 남는다.

## 지구 회랑 부록 (T26 표준 내장)

- 대조 기준은 이 문서와 동일한 `origin/main`
  `1eabd17c723a32917f23e80f084dd13f6f585030`이다.
- planner의 각 `stepsRle`을 `{ direction, count }` 배열과 compact 전문으로 함께
  보존하고, 10개 typed waypoint를 현재 `BUSAN.nodes|stations`에서 exact-1 해석했다.
  각 leg를 타일 단위로 전개하고, 다음 leg의 첫 타일은 접합 시 한 번 제거했다.
- 전개한 3,201타일을 현재 `districts.open[*].tiles.rects`의 포함 경계
  (`x0 <= x <= x1`, `y0 <= y <= y1`)와 직접 대조했다. 결과는
  **open 1,573 / locked 1,628**이며 위 검증표와 exact 일치한다.

### 잠긴 지대 bbox

`joined offset`과 `leg offset`은 모두 0부터 센다. bbox는 위반 타일 자체의
`[x0,y0,x1,y1]` 포함 경계다.

| 지대 | leg / offset | joined offset | 첫 타일 → 마지막 타일 | locked | bbox | 양쪽 인접 지구 |
|---|---|---:|---|---:|---|---|
| B1 | 3 / 99..152 | 438..491 | `[706,831]` → `[711,879]` | 54 | `[706,831,711,879]` | `port-core` ↔ `south-coast` |
| B2 | 4 / 26..78 | 543..595 | `[711,879]` → `[715,831]` | 53 | `[711,831,715,879]` | `south-coast` ↔ `port-core` |
| B3 | 4 / 146..743 | 663..1260 | `[736,784]` → `[999,450]` | 598 | `[736,450,999,784]` | `port-core` ↔ `east-coast` |
| B4 | 6 / 118..401 | 1892..2175 | `[1036,369]` → `[931,191]` | 284 | `[931,191,1036,369]` | `east-coast` ↔ `central-north` |
| B5 | 7 / 31..103 | 2284..2356 | `[885,144]` → `[884,81]` | 73 | `[884,81,888,144]` | `central-north` 내부 |
| B6 | 8 / 27..105 | 2412..2490 | `[882,81]` → `[867,144]` | 79 | `[867,81,882,144]` | `central-north` 내부 |
| B7 | 8 / 188..474 | 2573..2859 | `[856,216]` → `[811,457]` | 287 | `[811,216,856,457]` | `central-north` 내부 |
| B8 | 9 / 34..233 | 2934..3133 | `[770,491]` → `[729,649]` | 200 | `[729,491,770,649]` | `central-north` ↔ `port-core` |

### 권장 회랑 rect

아래 rect는 승인 전 제안이다. 각 잠긴 지대의 연속 경로를 우선 최대 48타일 조각으로
나누고 조각 bbox의 x·y 양쪽에 정확히 2타일을 더했다. 패딩 후 한 변 64타일 또는
면적 768타일² 상한을 넘으면 조각 끝을 한 타일씩 줄였다. 대형 bbox 하나로 잠금을
푸는 안은 배제했다.

소속 후보는 해당 locked 지대 바로 양쪽의 기존 인접 지구로만 제한했다. 각 조각의
경로 타일에서 각 기존 rect까지의 맨해튼 최단거리 합이 작은 쪽을 제안했고, 동률이면
경로 진입 쪽 지구를 택했다. 각 목록의 rect 순서는 경로 진행 순서다.

- B1 → `port-core`: `[704,829,713,875]`
- B1 → `south-coast`: `[709,872,713,881]`
- B2 → `south-coast`: `[709,834,717,881]`
- B2 → `port-core`: `[713,829,717,837]`
- B3 → `port-core`: `[734,766,769,786]`, `[765,746,796,769]`,
  `[792,720,816,749]`, `[812,688,832,723]`, `[829,666,856,692]`,
  `[852,626,864,669]`, `[860,607,892,629]`
- B3 → `east-coast`: `[888,562,895,610]`, `[892,530,911,566]`,
  `[908,507,934,534]`, `[931,480,954,511]`, `[950,451,972,483]`,
  `[969,448,1001,455]`
- B4 → `east-coast`: `[1031,323,1038,371]`, `[1023,283,1035,326]`,
  `[1017,241,1027,286]`
- B4 → `central-north`: `[1005,205,1021,244]`, `[965,197,1009,208]`,
  `[929,189,968,201]`
- B5 → `central-north`: `[883,101,890,146]`, `[882,79,889,104]`
- B6 → `central-north`: `[877,79,884,127]`, `[865,124,881,146]`
- B7 → `central-north`: `[846,214,858,257]`, `[846,254,850,305]`,
  `[839,302,850,346]`, `[839,343,843,394]`, `[819,390,842,420]`,
  `[810,416,822,459]`, `[809,455,813,459]`
- B8 → `central-north`: `[768,489,772,540]`, `[768,537,772,588]`
- B8 → `port-core`: `[759,585,772,627]`, `[732,624,763,647]`,
  `[727,644,736,651]`

부산 제안 39개 rect의 실측 최대치는 한 변 52타일·면적 768타일²다. 이 목록의
합집합은 잠긴 경로 타일 **1,628/1,628**을 포함한다. 실제 `busan.js` 반영 시에는
rect 추가 후 `resolveCityDistricts(city, grid, resolvedMainRoute)`를 실행해
경로 전수 open을 다시 확인해야 하며, 이 부록은 지구 승인이나 runtime 변경을
대신하지 않는다.

## 결정성

독립 Node 프로세스 A/B의 pretty audit JSON은 각각 93,010 bytes로 byte-identical했다.

- audit stdout SHA-256 A/B:
  `2c51ff9b2c5539c425484b893f31a0ea1a6a0a5e9f5a9190f4564f7f39b4fee1`
- canonical payload: 44,412 bytes / SHA-256
  `d9c8825895e8df8ed5ca67de0c15d0d3373c9e673ad8298dc20c9d2065e371c2`
- 전체 joined path SHA-256:
  `c0084b545b50e65a887966eaaa0aea58780847706187737929e9066be019cd08`
- max RSS A/B: 216,176 / 216,816 KiB, swaps 0
- 측정 입력 5파일 manifest: 398 bytes / SHA-256
  `307949749096e2ec418c510ee41df52517b6a62def01a4dd1bb2dd2f7593998a`

| 입력 | Git blob |
|---|---|
| `src/components/world/cityMainRoute.js` | `a4f9067c1e13cc0e22b651e886dfb044eebb7016` |
| `src/components/world/cityDistricts.js` | `2c3a8257fec829469fed70ac6ea1103bcf0d701a` |
| `src/components/world/cities/terrain.js` | `0904ae65b2126d7e8aee883f3e070e0395c20b62` |
| `src/components/world/cities/busan.js` | `17e6d81c70a60e49b44325cb5fed567a47d05763` |
| `src/components/world/cities/busan.geo.js` | `7c2de8d06b9c2ce7c9d9fee3eec78bacdf31f663` |

manifest는 위 표의 `path<TAB>blob<LF>`를 표시 순서대로 이어 SHA-256 한 값이다.
audit JSON에는 candidate·전 leg RLE·component·locked 지대·회랑 rect·발견 후보를
모두 포함했고 wall clock·host path·locale 정렬은 넣지 않았다.

## 재현 방법

도시 파일은 수정하지 않고 `BUSAN`을 펼친 임시 객체에 위 후보 `mainRoute`만 주입했다.

```js
const city = { ...BUSAN, mainRoute: candidate };
const grid = city.buildGrid();
const districts = resolveCityDistricts(BUSAN, grid);
const plan = planCityMainRoute(city, grid);

for (const segment of plan.segments) {
  const pathSha256 = createHash('sha256')
    .update(encodeMainRoutePathIndices(segment.pathIndices))
    .digest('hex');
  const allOpen = segment.pathIndices.every((index) => (
    cityDistrictOpenAt(
      districts,
      index % city.cols,
      Math.floor(index / city.cols),
    )
  ));
  console.log(segment.id, segment.stepsRle, segment.stepCount, pathSha256, allOpen);
}
```

전체 path는 각 segment의 첫 타일을 다음 segment부터 한 번씩 제거해 접합한 뒤 같은
little-endian uint32 인코딩으로 SHA-256 했다. 전역 및 open component는 각각
walkable·non-EXIT, open·walkable·non-EXIT 조건과 URDL 이웃으로 전수 BFS 했다.
회랑 rect는 위 locked 타일 배열에서 직접 산출하고 1,628개 전부가 제안 합집합에
포함되는지 다시 전수 검사했다.

## 회귀 검증

- targeted mainRoute·district·Busan geo:
  **5 files / 65 tests PASS / 47.17s**, max RSS 1,931,840 KiB
- `cityDistrictBoundarySigns.test.js` 단독 재현:
  **1 file / 5 tests PASS / 3.19s**(해당 전수 테스트 2.29s),
  max RSS 664,096 KiB
- 최종
  `set -o pipefail; npx vitest run --no-file-parallelism --testTimeout=30000`:
  **232 files / 2,251 tests PASS / 267.07s / exit 0**,
  max RSS 3,713,696 KiB(게시 직전 main `4b7b8297…` 재실행)
- `npm run lint`, 문서-audit exact 대조, `git diff --check`: PASS
- 변경 파일: `docs/proposal-busan-mainroute.md` 1개; 도시 wrapper·geo·district rect·
  runtime·registry·verifier·DB·카피·테스트 byte 불변

첫 기본-timeout full은 230 files / 2,247 tests PASS 뒤
`cityDistrictBoundarySigns.test.js`의 24도시 전수 1건만 5.42s에 기본 5초 timeout
(1 failed / 242.22s)이었다. 같은 파일의 즉시 단독 실행은 위와 같이 2.29s에
통과했다. 제품·테스트 파일은 수정하지 않고 CLI timeout만 30초로 둔 최종 full에서
2,248/2,248 green을 확인했다.

## 인계

- **권고 1:** 단일 보행 mainRoute를 유지하려면 `port-core↔south-coast`,
  `port-core↔east-coast`, `east-coast↔central-north`, `central-north`의
  동래↔부산대·부산대↔서면 내부, `central-north↔port-core`에 승인된 open 회랑이
  먼저 필요하다. 위 39개 rect는 그 최소 소형 후보이며 승인 전 데이터다.
- **권고 2:** 현재 open 지구를 유지하려면 기존 1·2호선과 장거리 해안 이동을
  명시하는 multi-stage route 계약이 필요하다. 이는 현 `node|station` 연속 BFS
  스키마의 범위를 넘으므로 Claude 결정 사항이다.
- 어느 선택이든 waypoint 순서와 discovery 맥락은 후보 자료로 재사용할 수 있지만,
  여섯 실패 leg의 RLE·SHA는 최종값으로 간주하면 안 된다.
