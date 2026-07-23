# 후쿠오카 mainRoute 주동선 후보 실측

- 상태: **report-only / 조건부 NO-GO** — 도시 wrapper·geo·district rect·
  `cityMainRoute.js`·CityScene·registry·verifier·DB·카피·테스트 변경 없음
- 측정 기준: `origin/main` `8be326b3372acad84df686e77815ad7d5ec4a4fc`
  (#516/T27 merge 포함)
- 게시 기준 main: `d51440d9a8c4fc034eae3a2cbe74938715c1562a`
  (#517, `osaka.js` 1파일만 변경되어 아래 측정 입력 5파일과 비중첩)
- 선례 계약: 도쿄·서울·오사카·교토·부산 후보 실측의 `version=1`,
  `cardinal-bfs-v1`, `URDL`, `excludeExit=true`, typed `node|station` waypoint,
  little-endian uint32 path SHA-256
- 회랑 계약: T26·T27의 districts open rect 대조, 연속 locked 지대 전수, 최대 48타일
  조각·bbox ±2·한 변 64타일·면적 768타일² 상한, 인접 지구 소속 제안
- 후보 ID: `fukuoka-classic-loop-candidate-a`(승인 전 예약 아님)
- 측정 환경: 2026-07-23, official nvm Node `v22.23.1`

## 판정

1. 후보 A는 하카타 부두 광장→하카타역→구시다 신사→나카스→아크로스 후쿠오카→
   후쿠오카성터→모모치 해변→하카타항 국제여객터미널→하카타 포트타워의
   **9 waypoint / 8 leg**다. waypoint 9/9는 기존 typed ref로 exact-1 해석되고,
   open 지구 안의 보행 가능·비EXIT 실측 타일이다. `hakata-port`,
   `nakasu-hakata`, `tenjin-ohori`, `momochi` 네 open 지구를 waypoint 기준으로
   모두 방문한다.
2. 실제 도시 `ENTRANCE [239,70]`에서 첫 waypoint 하카타 부두 광장
   `[235,65]`까지는 `U5 L4`, 9 steps / 10 tiles다. 전 타일 open·보행 가능·
   비EXIT이며 실제 EXIT `[239,61]`, `[239,62]`에 닿지 않는다. 첫 본선 leg는
   하카타역 방면으로 진행한다. 종점 포트타워에서 기점 부두 광장까지의 폐합 probe는
   42 steps / 43 tiles이고 역시 전 타일 open·보행 가능·비EXIT다.
3. 전체 도시 보행망의 URDL BFS에서는 8/8 leg가 도달한다. 본선은
   **1,104 steps / 1,105 tiles / 게임-grid 22.08km**, 전 타일 보행 가능,
   차단 0, EXIT 0이다. waypoint 9개는 모두 전역 component 0
   (59,264타일)에 속한다.
4. 그러나 waypoint가 속한 open 보행 성분은 하카타항 component 1
   (1,679타일), 나카스·하카타/텐진·오호리 component 3(13,789타일),
   모모치 component 4(3,225타일)의 셋으로 끊겨 있다. 따라서 네 지구를 잇는
   **연속 open-only cardinal BFS는 현재 계약상 존재하지 않는다.**
5. 후보 A의 1,105타일 중 open은 918, locked는 187이다. open-only PASS는
   하카타역→구시다, 구시다→나카스, 나카스→아크로스, 아크로스→후쿠오카성,
   국제터미널→포트타워의 5/8 leg다. 실패한 세 leg의 위반은 아래
   **4개 연속 locked 지대**로 전수 분리된다.
6. T26·T27 표준을 처음부터 적용한 권장 회랑은 6개 rect다. 최대 한 변 42타일,
   최대 면적 754타일²이며, 합집합이 locked 경로 **187/187**을 포함한다.
   이는 승인 전 지구 rect 제안일 뿐 `fukuoka.js`를 변경하지 않는다.
7. `resolveCityDistricts(city, grid, resolvedMainRoute)`는 main route 전 타일에
   `assertOpen`을 적용하므로, 아래 RLE를 현재 `fukuoka.js`에 그대로 배선하면
   첫 locked 타일 `[256,70]`에서 fail-closed 오류가 난다. Claude가 회랑을
   승인하거나 도시철도 이동을 표현할 별도 route 계약으로 분할하기 전에는
   **통합 금지**다. 경로 정책이 바뀌면 RLE·SHA도 다시 산출해야 한다.

거리(m)는 도시 geo의 20m/tile 게임-grid 환산값이며 실제 관광 보행거리 측량치가 아니다.

## 후보 계약

```js
{
  id: 'fukuoka-classic-loop-candidate-a',
  version: 1,
  routing: {
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  },
  waypoints: [
    { kind: 'node', id: 'bayside-place' },
    { kind: 'station', id: 'hakata' },
    { kind: 'node', id: 'kushida-jinja' },
    { kind: 'node', id: 'nakasu' },
    { kind: 'node', id: 'acros-fukuoka' },
    { kind: 'node', id: 'fukuoka-castle' },
    { kind: 'node', id: 'momochi-seaside' },
    { kind: 'node', id: 'hakata-port-international-terminal' },
    { kind: 'node', id: 'hakata-port-tower' },
  ],
  segmentHints: [],
  branches: [],
}
```

실패한 세 leg는 모두 양 endpoint의 open component 자체가 다르다. 단순 tie-break
변경이나 `viaTiles` 추가로 open-only가 될 수 없으므로 후보 A에는
`segmentHints`를 두지 않았다.

## waypoint 실측표

| # | typed key | 이름 | tile | open 지구 | terrain | open component | 판정 |
|---:|---|---|---:|---|---|---:|---|
| 1 | `node:bayside-place` | 하카타 부두 광장 | `[235,65]` | `hakata-port` | PLAZA(3) | 1 / 1,679 | open·walkable·non-EXIT |
| 2 | `station:hakata` | 博多駅 | `[335,144]` | `nakasu-hakata` | PLAZA(3) | 3 / 13,789 | open·walkable·non-EXIT |
| 3 | `node:kushida-jinja` | 櫛田神社 | `[290,127]` | `nakasu-hakata` | PLAZA(3) | 3 / 13,789 | open·walkable·non-EXIT |
| 4 | `node:nakasu` | 中洲 | `[268,128]` | `nakasu-hakata` | ROAD(0) | 3 / 13,789 | open·walkable·non-EXIT |
| 5 | `node:acros-fukuoka` | アクロス福岡 | `[252,136]` | `tenjin-ohori` | PLAZA(3) | 3 / 13,789 | open·walkable·non-EXIT |
| 6 | `node:fukuoka-castle` | 福岡城跡 | `[160,175]` | `tenjin-ohori` | PARK(4) | 3 / 13,789 | open·walkable·non-EXIT |
| 7 | `node:momochi-seaside` | シーサイドももち海浜公園 | `[13,115]` | `momochi` | BEACH(12) | 4 / 3,225 | open·walkable·non-EXIT |
| 8 | `node:hakata-port-international-terminal` | 博多港国際ターミナル | `[241,43]` | `hakata-port` | PLAZA(3) | 1 / 1,679 | open·walkable·non-EXIT |
| 9 | `node:hakata-port-tower` | 博多ポートタワー | `[217,69]` | `hakata-port` | PLAZA(3) | 1 / 1,679 | open·walkable·non-EXIT |

open component 번호는 row-major 시작점과 URDL 이웃 순서로 전수 BFS한 결정적 ID다.
도시 전체 open·walkable·non-EXIT 성분은 7개다.

## 진입·폐합 probe

| probe | steps / tiles | RLE runs | open / locked | blocked / EXIT | path SHA-256 |
|---|---:|---:|---:|---:|---|
| `ENTRANCE [239,70]` → 하카타 부두 광장 | 9 / 10 | 2 | 10 / 0 | 0 / 0 | `b4045bf2982bf5c8a01e5eaaaa97eb2232fe7413b8444f2e7247ca0190e0f404` |
| 하카타 포트타워 → 하카타 부두 광장 | 42 / 43 | 19 | 43 / 0 | 0 / 0 | `5724de6780c29c39f16d853a6133aaf8fb6150921b2f04b53c00ed776ed012ae` |

- 진입 RLE 전문: `U5 L4`
- 폐합 RLE 전문:
  `L3 D3 R1 D2 R4 U1 R5 D1 R3 U1 R3 U1 R4 U1 R1 U4 R1 U2 L1`

두 probe는 후보 `mainRoute.segments`에 저장할 본선이 아니라 실제 진입점과
반복 없는 마지막 waypoint가 한 바퀴를 닫는지 확인한 보조 실측이다.

## leg별 BFS·open 검증

`open/locked`는 각 leg 자체의 endpoint 포함 tileCount 기준이다. 합계 행은 leg
접합점의 중복 waypoint 7개를 한 번만 센 전체 path 기준이다.

| # | from → to | steps / tiles | RLE runs | open / locked | blocked / EXIT | open-only | path SHA-256 |
|---:|---|---:|---:|---:|---:|---|---|
| 1 | 하카타 부두 → 하카타역 | 179 / 180 | 42 | 88 / **92** | 0 / 0 | **FAIL** | `0dfeb70446da8c423bf730c2e52d40450b794b49c9d29798a4c5d5dc6108ae28` |
| 2 | 하카타역 → 구시다 신사 | 74 / 75 | 22 | 75 / 0 | 0 / 0 | PASS | `38f90bda998cc9b6935baaf66e51a8f3335e20e1139bf78dfed51c7bfe2478ac` |
| 3 | 구시다 신사 → 나카스 | 27 / 28 | 11 | 28 / 0 | 0 / 0 | PASS | `133649c2163dd9419cd8917110f26749f07547c1a3d7c6e6f29c97880ae71796` |
| 4 | 나카스 → 아크로스 | 26 / 27 | 11 | 27 / 0 | 0 / 0 | PASS | `3b1ed939fccba030c4ded883e3e79d92d671b44a838e08bacb301f6826ac6d6b` |
| 5 | 아크로스 → 후쿠오카성 | 131 / 132 | 31 | 132 / 0 | 0 / 0 | PASS | `fb811872b2ddf1a9a2321f44a9917ce8a601e21797bdd05babae2ceb75fb188e` |
| 6 | 후쿠오카성 → 모모치 | 207 / 208 | 38 | 188 / **20** | 0 / 0 | **FAIL** | `ec0722a606238b0ebf26ee6431458a76c915ade2d7cf1e493c44129df49960e3` |
| 7 | 모모치 → 국제터미널 | 364 / 365 | 119 | 290 / **75** | 0 / 0 | **FAIL** | `55aa00f3d25be8c6f1dfd04c7cade1d26e767eefa0aba918b7bbfe2a1aa3f1b2` |
| 8 | 국제터미널 → 포트타워 | 96 / 97 | 41 | 97 / 0 | 0 / 0 | PASS | `818770713ce02a80de36a0a57f59cba11072fd7cc5fc4b4ecde3f0f304df2c65` |
| **합계** | 8/8 walkable reachable | **1,104 / 1,105** | **315** | **918 / 187** | **0 / 0** | **5/8 PASS** | `ba40c5735c2f464e4f772b8af1d758b8643db40b8e112b8a22d8fd4877f4d0e2` |

## stepsRle 전문

아래 compact 표기는 저장 객체의 순서를 빠짐없이 적은 것이다. 예를 들어 `U5`는
`{ direction: 'U', count: 5 }`이며 생략 부호는 없다.

### 1. `node:bayside-place--station:hakata`

```text
R4 D4 R10 D1 R18 D1 R1 D1 R7 D2 R2 D2 R1 D1 R1 D1 R6 D1 R1 D1 R10 D1 R19 D3 R1 D1 R2 D1 R3 D1 R4 D1 R3 D4 R4 D9 R1 D25 R1 D1 R1 D17
```

### 2. `station:hakata--node:kushida-jinja`

```text
U12 L3 U1 L4 U1 L1 U1 L5 U1 L1 U1 L12 D1 L6 U1 L3 D1 L6 U3 L6 D2 R2
```

### 3. `node:kushida-jinja--node:nakasu`

```text
L2 U1 L2 D1 L10 D1 L2 U1 L2 D1 L4
```

### 4. `node:nakasu--node:acros-fukuoka`

```text
U1 L4 D2 L2 D1 L2 D4 L7 D1 L1 D1
```

### 5. `node:acros-fukuoka--node:fukuoka-castle`

```text
L2 D5 L4 D5 L4 D2 L8 D9 L1 D1 L14 D1 L3 D1 L6 D1 L4 D1 L5 D1 L18 D1 L3 D1 L2 D2 L1 D3 L5 D5 L12
```

### 6. `node:fukuoka-castle--node:momochi-seaside`

```text
U1 L1 U18 L1 U7 L1 U1 L3 U5 L10 U2 L7 U1 L10 U1 L9 U2 L2 U2 L15 U1 L1 U1 L4 U1 L1 U5 L8 U1 L7 U1 L1 U4 L29 U5 L14 U1 L23
```

### 7. `node:momochi-seaside--node:hakata-port-international-terminal`

```text
R23 D1 R14 D5 R28 U1 R2 U1 R8 D2 R8 D1 R1 D1 R2 U1 R23 D1 R8 D1 R13 U1 R22 D1 R11 D1 R1 D1 R1 D3 R2 U1 R2 U1 R1 U1 R3 U1 R2 U1 R1 U12 R4 U1 R2 U1 R2 U1 R2 U1 R2 U1 R2 U1 R2 U1 R2 U1 R1 U4 R2 U7 R2 U13 R2 U1 R1 U1 R3 U1 R2 U1 R1 U2 R6 U1 R3 U1 R4 U1 R5 U2 R2 U1 R1 U1 R1 U1 R1 U1 R1 U1 R2 U1 R1 U1 R1 U10 L1 U1 L1 U1 L3 U1 L1 U1 L1 U1 L1 U1 L2 U1 L1 U1 L2 U2 R3 D1 R2
```

### 8. `node:hakata-port-international-terminal--node:hakata-port-tower`

```text
L2 U1 L3 D2 R2 D1 R1 D1 R2 D1 R1 D1 R1 D1 R1 D1 R3 D1 R1 D1 R1 D15 L1 D2 L2 D1 L2 D2 L2 D1 L7 D1 L11 U1 L5 D1 L4 U2 L1 U3 R3
```

## discovery 스팟 후보 8곳

`context`는 카피가 아니라 Claude 저작용 주변 맥락 제안이다. `at`은 해당 leg의
`start + round(at * stepCount)`(양 endpoint 제외 clamp) 규칙으로 재투영했다.
8곳 모두 open·walkable·non-EXIT이며 기존 node·station·prop 및 후보 상호 간
Chebyshev 이격이 3타일 이상이다.

| ID | leg | at | routeIndex | 실측 tile / 지구 | 기존 마커 / 후보 이격 | 주변 맥락 제안 |
|---|---|---:|---:|---|---:|---|
| `fukuoka-d1` | 하카타 부두 → 하카타역 | 0.75 | 134 | `[333,101]` / `nakasu-hakata` | 26 / 26 | 하카타항 진입축을 벗어나 하카타역 철도 관문에 가까워지는 동부 도심 접근로 |
| `fukuoka-d2` | 하카타역 → 구시다 신사 | 0.45 | 212 | `[319,127]` / `nakasu-hakata` | 12 / 26 | 하카타역을 벗어나 기온·구시다 신사 방면 옛 시가지로 들어가는 전환 |
| `fukuoka-d3` | 구시다 신사 → 나카스 | 0.50 | 267 | `[278,127]` / `nakasu-hakata` | 6 / 19 | 구시다 신사 앞 하카타 마치에서 두 강 사이 나카스 생활권으로 이어지는 길목 |
| `fukuoka-d4` | 나카스 → 아크로스 | 0.65 | 297 | `[259,134]` / `tenjin-ohori` | 7 / 19 | 나카스 수변을 건너 텐진의 업무·문화 중심으로 들어가는 도심 전환 |
| `fukuoka-d5` | 아크로스 → 후쿠오카성 | 0.75 | 404 | `[182,164]` / `tenjin-ohori` | 15 / 39 | 텐진에서 아카사카·마이즈루공원 쪽으로 서진하며 성터 녹지에 가까워지는 구간 |
| `fukuoka-d6` | 후쿠오카성 → 모모치 | 0.85 | 613 | `[43,116]` / `momochi` | 22 / 134 | 오호리·도진마치 생활축을 지나 모모치 해변의 바닷바람이 열리는 접근로 |
| `fukuoka-d7` | 모모치 → 국제터미널 | 0.50 | 826 | `[177,125]` / `tenjin-ohori` | 24 / 39 | 모모치에서 도심을 동서로 가로질러 하카타만 항만축으로 복귀하는 중간 생활가로 |
| `fukuoka-d8` | 국제터미널 → 포트타워 | 0.50 | 1,056 | `[247,69]` / `hakata-port` | 7 / 58 | 국제여객터미널에서 포트타워·베이사이드 진입점으로 돌아오는 항만 데크 |

발견점이 open이라고 해서 그 discovery의 전체 leg가 open인 것은 아니다. d1·d6·d7은
발견 tile 자체는 PASS지만 앞뒤 leg에 아래 locked 지대가 남는다. 8곳은 모두 제안일 뿐
카피·ID 예약·제품 배선이 아니다.

## 지구 회랑 부록 (T26·T27 표준 내장)

- 대조 기준은 이 문서와 동일한 `origin/main`
  `8be326b3372acad84df686e77815ad7d5ec4a4fc`이다.
- planner의 각 `stepsRle`을 `{ direction, count }` 배열과 compact 전문으로 함께
  보존하고, 9개 typed waypoint를 현재 `FUKUOKA.nodes|stations`에서 exact-1
  해석했다. 각 leg를 타일 단위로 전개하고, 다음 leg의 첫 타일은 접합 시 한 번
  제거했다.
- 전개한 1,105타일을 현재 `districts.open[*].tiles.rects`의 포함 경계
  (`x0 <= x <= x1`, `y0 <= y <= y1`)와 직접 대조했다. 결과는
  **open 918 / locked 187**이며 위 검증표와 exact 일치한다.

### 잠긴 지대 bbox

`joined offset`과 `leg offset`은 모두 0부터 센다. bbox는 위반 타일 자체의
`[x0,y0,x1,y1]` 포함 경계다. 아래 네 행은 187개 위반 occurrence의 전수이며,
각 타일은 해당 leg RLE와 offset 범위로 생략 없이 재현된다.

| 지대 | leg / offset | joined offset | 첫 타일 → 마지막 타일 | locked | bbox | 양쪽 인접 지구 |
|---|---|---:|---|---:|---|---|
| F1 | 1 / 26..117 | 26..117 | `[256,70]` → `[328,89]` | 92 | `[256,70,328,89]` | `hakata-port` ↔ `nakasu-hakata` |
| F2 | 6 / 119..138 | 556..575 | `[89,127]` → `[76,121]` | 20 | `[76,121,89,127]` | `tenjin-ohori` ↔ `momochi` |
| F3 | 7 / 69..86 | 713..730 | `[76,121]` → `[89,121]` | 18 | `[76,119,89,121]` | `momochi` ↔ `tenjin-ohori` |
| F4 | 7 / 208..264 | 852..908 | `[189,119]` → `[212,86]` | 57 | `[189,86,212,119]` | `tenjin-ohori` ↔ `hakata-port` |

### 권장 회랑 rect

아래 rect는 승인 전 제안이다. 각 잠긴 지대의 연속 경로를 우선 최대 48타일 조각으로
나누고 조각 bbox의 x·y 양쪽에 정확히 2타일을 더했다. 패딩 후 한 변 64타일 또는
면적 768타일² 상한을 넘으면 조각 끝을 한 타일씩 줄였다. 대형 bbox 하나로 잠금을
푸는 안은 배제했다.

소속 후보는 해당 locked 지대 바로 양쪽의 기존 인접 지구로만 제한했다. 각 조각의
경로 타일에서 각 기존 rect까지의 맨해튼 최단거리 합이 작은 쪽을 제안했고, 동률이면
경로 진입 쪽 지구를 택했다. 각 목록의 rect 순서는 경로 진행 순서다.

- F1 → `nakasu-hakata`: `[254,68,295,82]`, `[292,78,330,91]`
- F2 → `momochi`: `[74,119,91,129]`
- F3 → `momochi`: `[74,117,91,123]`
- F4 → `tenjin-ohori`: `[187,93,212,121]`
- F4 → `hakata-port`: `[208,84,214,96]`

후쿠오카 제안 6개 rect의 실측 최대치는 한 변 42타일·면적 754타일²다. 이 목록의
합집합은 잠긴 경로 타일 **187/187**을 포함한다. 실제 `fukuoka.js` 반영 시에는
rect 추가 후 `resolveCityDistricts(city, grid, resolvedMainRoute)`를 실행해
경로 전수 open을 다시 확인해야 하며, 이 부록은 지구 승인이나 runtime 변경을
대신하지 않는다.

## 결정성

독립 Node 프로세스 A/B의 pretty audit JSON은 각각 54,164 bytes로 byte-identical했다.

- audit stdout SHA-256 A/B:
  `6f8f8df059eca5a48a546100ce759adbc13ac9521851c16118be7a5dcd7db4a4`
- canonical payload: 24,657 bytes / SHA-256
  `718e090f08ded03a641e0966dc7deed37fa7a8e6203e87ddfd83db7ed6bfb8b2`
- 전체 joined path SHA-256:
  `ba40c5735c2f464e4f772b8af1d758b8643db40b8e112b8a22d8fd4877f4d0e2`
- max RSS A/B: 69,840 / 69,760 KiB
- 측정 입력 5파일 manifest: 402 bytes / SHA-256
  `19c91f42336954212725233226f239b9f2a7484e0839ca3e08805421475fde33`

| 입력 | Git blob |
|---|---|
| `src/components/world/cityMainRoute.js` | `a4f9067c1e13cc0e22b651e886dfb044eebb7016` |
| `src/components/world/cityDistricts.js` | `2c3a8257fec829469fed70ac6ea1103bcf0d701a` |
| `src/components/world/cities/terrain.js` | `0904ae65b2126d7e8aee883f3e070e0395c20b62` |
| `src/components/world/cities/fukuoka.js` | `9dc1baf52fd805a4fd447653cae9fa6b850c77d8` |
| `src/components/world/cities/fukuoka.geo.js` | `d74f62adb7bbaa28557ab3ccc872ffe02f07acc3` |

manifest는 위 표의 `path<TAB>blob<LF>`를 표시 순서대로 이어 SHA-256 한 값이다.
audit JSON에는 candidate·진입/폐합 probe·전 leg RLE·component·locked 지대·
회랑 rect·발견 후보를 모두 포함했고 wall clock·host path·locale 정렬은 넣지 않았다.

## 재현 방법

도시 파일은 수정하지 않고 `FUKUOKA`를 펼친 임시 객체에 위 후보 `mainRoute`만 주입했다.

```js
const city = { ...FUKUOKA, mainRoute: candidate };
const grid = city.buildGrid();
const districts = resolveCityDistricts(FUKUOKA, grid);
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
회랑 rect는 위 locked 타일 배열에서 직접 산출하고 187개 전부가 제안 합집합에
포함되는지 다시 전수 검사했다.

## 회귀 검증

- targeted mainRoute·district·Fukuoka geo:
  **7 files / 112 tests PASS / 15.43s**
- 측정 기준
  `set -o pipefail; npx vitest run --no-file-parallelism --testTimeout=30000 --logHeapUsage`:
  **232 files / 2,251 tests PASS / 240.69s / exit 0**
- 게시 기준 main `d51440d9…` 최종
  `set -o pipefail; npx vitest run --no-file-parallelism --testTimeout=30000`:
  **232 files / 2,251 tests PASS / 238.61s / exit 0**
- `npm run lint`, 문서-audit exact 대조, trailing whitespace 검사: PASS
- 변경 파일: `docs/proposal-fukuoka-mainroute.md` 1개; 도시 wrapper·geo·district rect·
  runtime·registry·verifier·DB·카피·테스트 byte 불변

full 실행의 유일한 stderr는 기존 `contentOverrides.test.js` 동적 import에 대한 Vite
정적 분석 warning이며 테스트 실패·timeout은 0건이다. 이 샌드박스는 `ps`와
`/usr/bin/time -l`의 프로세스 트리 RSS 조회를 막으므로 full RSS는 기록하지 않았다.
측정 one-shot 자체는 위 결정성 절의 `process.resourceUsage()` max RSS A/B
69,840 / 69,760 KiB로 실측했다.

## 인계

- **권고 1:** 단일 보행 mainRoute를 유지하려면 `hakata-port↔nakasu-hakata`,
  `tenjin-ohori↔momochi`, `tenjin-ohori↔hakata-port`에 승인된 open 회랑이
  먼저 필요하다. 위 6개 rect는 T26·T27 상한을 지키는 소형 후보이며 승인 전 데이터다.
- **권고 2:** 현재 open 지구를 유지하려면 하카타항→하카타역은 현 지하철/버스에
  해당하는 이동 단계로, 모모치→하카타항은 장거리 도시 교통 단계로 분리하는
  multi-stage route 계약이 필요하다. 이는 현 `node|station` 연속 BFS 스키마의
  범위를 넘으므로 Claude 결정 사항이다.
- 어느 선택이든 waypoint 순서와 discovery 맥락은 후보 자료로 재사용할 수 있지만,
  실패한 세 leg의 RLE·SHA는 최종값으로 간주하면 안 된다.
