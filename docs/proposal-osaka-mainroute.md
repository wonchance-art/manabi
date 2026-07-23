# 오사카 mainRoute 주동선 후보 실측

- 상태: **report-only / 조건부 NO-GO** — 도시 wrapper·geo·district rect·
  `cityMainRoute.js`·CityScene·registry·verifier·DB·카피·테스트 변경 없음
- 측정 기준: `origin/main` `009337219c940b0838950e8de409a952bbc800a1`
  (#504/T23 merge 포함)
- 선례 계약: 리옹·보르도·스트라스부르 `MAIN_ROUTE`의 `version=1`,
  `cardinal-bfs-v1`, `URDL`, `excludeExit=true`, typed `node|station` waypoint,
  little-endian uint32 path SHA-256
- 후보 ID: `osaka-classic-loop-candidate-a`(승인 전 예약 아님)
- 측정 환경: 2026-07-23, official nvm Node `v22.23.1`

## 판정

1. 후보 A는 오사카역(우메다)→공중정원→나카노시마공원→오사카성→시텐노지→
   텐노지역→쓰텐카쿠→구로몬시장→에비스바시→오사카수족관의
   **10 waypoint / 9 leg**다. waypoint 10/10은 기존 typed ref로 exact-1 해석되고,
   open 지구 안의 보행 가능·비EXIT 실측 타일이다. `north-hubs`, `castle-east`,
   `namba-tennoji`, `bay` 네 지구를 waypoint 기준으로 모두 방문한다.
2. 북부 진입점은 신오사카가 아니라 실제 도시 `ENTRANCE [414,187]`에서 5 steps인
   오사카역 `[414,182]`을 택했다. 신오사카역 `[435,8]`은 별도 open component 0
   (881타일)이고 오사카역까지 197 steps 중 116타일이 locked다. 따라서 신오사카를
   첫 waypoint로 쓰면 출발 leg부터 open-only가 깨진다.
3. 전체 도시 보행망의 URDL BFS에서는 9/9 leg가 도달한다. 경로는 **1,219 steps /
   1,220 tiles / 게임-grid 24.38km**, 전 타일 보행 가능, 차단 0, EXIT 0이다.
4. 그러나 waypoint가 속한 open 보행 성분은 북부·성곽 component 1(27,737타일),
   난바·텐노지 component 9(14,031타일), 항만 component 14(1,073타일)의 셋으로
   끊겨 있다. 따라서 네 지구를 잇는 **연속 open-only cardinal BFS는 현재 계약상
   존재하지 않는다.**
5. 후보 A의 1,220타일 중 open은 846, locked는 374다. 실패는
   오사카성→시텐노지 133타일과 에비스바시→오사카수족관 241타일의 두 연결부에
   정확히 한정된다. 나머지 7/9 leg는 open-only PASS다.
6. `resolveCityDistricts(city, grid, resolvedMainRoute)`는 main route 전 타일에
   `assertOpen`을 적용하므로, 아래 RLE를 현재 `osaka.js`에 그대로 배선하면 첫 locked
   타일 `[534,290]`에서 fail-closed 오류가 난다. Claude가 (a) 두 open 회랑을
   승인하거나 (b) 도시철도·항만 이동을 표현할 별도 route 계약으로 분할하기 전에는
   **통합 금지**다. 연결 정책이 바뀌면 RLE·SHA도 다시 산출해야 한다.

거리(m)는 도시 geo의 20m/tile 게임-grid 환산값이며 실제 관광 보행거리 측량치가 아니다.

## 후보 계약

```js
{
  id: 'osaka-classic-loop-candidate-a',
  version: 1,
  routing: {
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  },
  waypoints: [
    { kind: 'station', id: 'osaka' },
    { kind: 'node', id: 'kuchu-teien' },
    { kind: 'node', id: 'nakanoshima-park' },
    { kind: 'node', id: 'osaka-castle' },
    { kind: 'node', id: 'shitennoji' },
    { kind: 'station', id: 'tennoji' },
    { kind: 'node', id: 'tsutenkaku' },
    { kind: 'node', id: 'kuromon-market' },
    { kind: 'node', id: 'ebisubashi' },
    { kind: 'node', id: 'osaka-aquarium' },
  ],
  segmentHints: [{
    from: { kind: 'node', id: 'nakanoshima-park' },
    to: { kind: 'node', id: 'osaka-castle' },
    viaTiles: [[538, 245]],
  }],
  branches: [],
}
```

나카노시마공원→오사카성 무힌트 최단경로는 120 steps지만 두 open rect 사이에서
locked 타일 55개(`[489,246]`→`[534,255]`)로 벗어난다. open·보행 BRIDGE
`[538,245]`를 경유한 130-step 경로는 `[538,246]`의 `castle-east` 경계로 바로
건너가 open-only PASS다. 비용은 10 steps이며 다른 8개 leg에는 hint가 없다.

## waypoint 실측표

| # | typed key | 이름 | tile | open 지구 | terrain | 판정 |
|---:|---|---|---:|---|---|---|
| 1 | `station:osaka` | 大阪駅 | `[414,182]` | `north-hubs` | PLAZA(3) | open·walkable·non-EXIT |
| 2 | `node:kuchu-teien` | 空中庭園展望台 | `[387,165]` | `north-hubs` | PLAZA(3) | open·walkable·non-EXIT |
| 3 | `node:nakanoshima-park` | 中之島公園 | `[469,237]` | `north-hubs` | SIDEWALK(1) | open·walkable·non-EXIT |
| 4 | `node:osaka-castle` | 大阪城 | `[553,265]` | `castle-east` | PLAZA(3) | open·walkable·non-EXIT |
| 5 | `node:shitennoji` | 四天王寺 | `[505,448]` | `namba-tennoji` | SIDEWALK(1) | open·walkable·non-EXIT |
| 6 | `station:tennoji` | 天王寺駅 | `[504,487]` | `namba-tennoji` | SIDEWALK(1) | open·walkable·non-EXIT |
| 7 | `node:tsutenkaku` | 通天閣 | `[463,458]` | `namba-tennoji` | CROSSWALK(2) | open·walkable·non-EXIT |
| 8 | `node:kuromon-market` | 黒門市場 | `[466,387]` | `namba-tennoji` | SIDEWALK(1) | open·walkable·non-EXIT |
| 9 | `node:ebisubashi` | 戎橋 | `[440,367]` | `namba-tennoji` | CROSSWALK(2) | open·walkable·non-EXIT |
| 10 | `node:osaka-aquarium` | 海遊館 | `[111,444]` | `bay` | PLAZA(3) | open·walkable·non-EXIT |

## leg별 BFS·open 검증

`open/locked`는 각 leg 자체의 endpoint 포함 tileCount 기준이다. 합계 행은 leg 접합점의
중복 waypoint 8개를 한 번만 센 전체 path 기준이다.

| # | from → to | steps / tiles | RLE runs | open / locked | blocked / EXIT | open-only | path SHA-256 |
|---:|---|---:|---:|---:|---:|---|---|
| 1 | 오사카역 → 공중정원 | 48 / 49 | 16 | 49 / 0 | 0 / 0 | PASS | `a54413ff0119c96e045119eaf8b63beb06acdaa4dbc7ed4c7457e191b3688adf` |
| 2 | 공중정원 → 나카노시마공원 | 158 / 159 | 34 | 159 / 0 | 0 / 0 | PASS | `92bed1523e43f9fe5088c1c61880bc87a87d881c4ce7466a72139a31379f262c` |
| 3 | 나카노시마공원 → 오사카성 | 130 / 131 | 28 | 131 / 0 | 0 / 0 | PASS | `b9541de191124b440edb0c26575a45850eb3afb75da8933830cdc50771d96ecc` |
| 4 | 오사카성 → 시텐노지 | 231 / 232 | 47 | 99 / **133** | 0 / 0 | **FAIL** | `365692435280e19b8d9e343d3524466aeb598518e57fb7766ca83d5c5890dcc7` |
| 5 | 시텐노지 → 텐노지역 | 48 / 49 | 13 | 49 / 0 | 0 / 0 | PASS | `fd3b13ce4585e08481fb2329255e9a793cdcf57c6155842f36b6481a1263b516` |
| 6 | 텐노지역 → 쓰텐카쿠 | 70 / 71 | 10 | 71 / 0 | 0 / 0 | PASS | `2d5113ec82be427d27ba9ed321da429fd8612c513763524ae3da5f3ba8e3c09f` |
| 7 | 쓰텐카쿠 → 구로몬시장 | 78 / 79 | 11 | 79 / 0 | 0 / 0 | PASS | `6f736007e4763147321e126a0450e25e0b91ca0339ae11b9febcb712f4c8a454` |
| 8 | 구로몬시장 → 에비스바시 | 48 / 49 | 5 | 49 / 0 | 0 / 0 | PASS | `1da5a8df516578c447d6b4ae1b9fc7238e9e7ed4cb9da0e5d41307a2e6837b7c` |
| 9 | 에비스바시 → 오사카수족관 | 408 / 409 | 80 | 168 / **241** | 0 / 0 | **FAIL** | `849684235e84181203f2900d5f2af6dcc9deb638520f2bdb192a12d3b083d68d` |
| **합계** | 9/9 walkable reachable | **1,219 / 1,220** | **244** | **846 / 374** | **0 / 0** | **7/9 PASS** | `4bda071003d403dd11e4aea466f082453a49761b0e11cd70523302dbdfe95722` |

### open 이탈 구간

| leg | segment offset | 첫 locked tile → 마지막 locked tile | locked tiles |
|---|---:|---|---:|
| 오사카성 → 시텐노지 | 44..176 | `[534,290]` → `[521,409]` | 133 |
| 에비스바시 → 오사카수족관 | 47..111 | `[419,393]` → `[361,399]` | 65 |
| 에비스바시 → 오사카수족관 | 207..382 | `[277,411]` → `[136,443]` | 176 |

두 실패 leg의 양 endpoint는 서로 다른 open 보행 component에 있으므로 단순 tie-break 변경이나
추가 `viaTiles`만으로는 해결되지 않는다. 에비스바시→항만 leg 중간의 open 95타일은
`namba-tennoji` 서측 rect를 통과하지만, 앞뒤 locked 구간을 연결하지는 못한다.

## stepsRle 전문

아래 compact 표기는 저장 객체의 순서를 빠짐없이 적은 것이다. 예를 들어 `U5`는
`{ direction: 'U', count: 5 }`이며 생략 부호는 없다.

### 1. `station:osaka--node:kuchu-teien`

```text
U3 L1 U4 L1 U1 L2 U1 L1 U1 L22 U1 L1 U2 L1 U4 R2
```

### 2. `node:kuchu-teien--node:nakanoshima-park`

```text
L2 D4 R1 D2 R1 D1 R22 D1 R1 D1 R2 D1 R1 D4 R4 D1 R2 D2 R8 D1 R25 D4 R10 D4 R1 D12 R2 D1 R1 D14 R2 D5 R1 D14
```

### 3. `node:nakanoshima-park--node:osaka-castle`

```text
U2 R2 U1 R27 D1 R9 U1 R4 U1 R19 D4 R1 D1 R7 D10 R2 D6 R1 D1 R5 D12 R1 D2 R2 U1 R1 U3 R3
```

### 4. `node:osaka-castle--node:shitennoji`

```text
L2 D10 L11 D3 L4 D7 L1 D5 L1 D24 L2 D3 L1 D13 L1 D9 L1 D11 L1 D8 L1 D9 L1 D4 L1 D6 L1 D7 L1 D5 L1 D15 L1 D5 L1 D5 L1 D7 L1 D8 L1 D13 L2 D5 L4 D1 L6
```

### 5. `node:shitennoji--station:tennoji`

```text
R1 D3 L1 D2 L1 D2 R1 D7 L1 D15 R2 D10 L2
```

### 6. `station:tennoji--node:tsutenkaku`

```text
U3 L6 U2 L1 U19 L20 U1 L3 U4 L11
```

### 7. `node:tsutenkaku--node:kuromon-market`

```text
R1 U15 R1 U40 R1 U7 L1 U7 R2 U2 L1
```

### 8. `node:kuromon-market--node:ebisubashi`

```text
R1 U18 L3 U2 L24
```

### 9. `node:ebisubashi--node:osaka-aquarium`

```text
D1 L3 D22 L1 D1 L1 D1 L6 D1 L14 D1 L1 D1 L4 D3 L1 D1 L70 D1 L28 D1 L12 D2 L7 D3 L5 D2 L1 D1 L8 D1 L1 D2 L19 U1 L12 D1 L1 D4 L2 D2 L1 D1 L1 D4 L1 D3 L10 D1 L1 D1 L1 D1 L1 D1 L1 D1 L1 D1 L1 D2 L20 D1 L8 D1 L19 D1 L2 D1 L3 D1 L9 D2 L19 D1 L6 D1 L12 D1 L15
```

## discovery 스팟 후보 8곳

`context`는 카피가 아니라 Claude 저작용 주변 맥락 제안이다. `at`은 해당 leg의
`start + round(at * stepCount)`(양 endpoint 제외 clamp) 규칙으로 재투영했다.
8곳 모두 open·walkable·non-EXIT다.

| ID | leg | at | routeIndex | 실측 tile / 지구 | 주변 맥락 제안 |
|---|---|---:|---:|---|---|
| `osaka-d1` | 오사카역 → 공중정원 | 0.50 | 24 | `[400,172]` / `north-hubs` | 우메다 철도 관문에서 북서 업무가로로 접어드는 구간 — 고가 선로와 대형 보행축의 교차 |
| `osaka-d2` | 공중정원 → 나카노시마공원 | 0.55 | 135 | `[452,183]` / `north-hubs` | 우메다 남쪽에서 수변 도심으로 내려가는 길목 — 교통 허브와 강섬 업무지구의 전환 |
| `osaka-d3` | 나카노시마공원 → 오사카성 | 0.68 | 294 | `[538,246]` / `castle-east` | 수변 도심에서 성곽 공원권으로 건너가는 open 교량 — 두 지구가 맞닿는 전환점 |
| `osaka-d4` | 오사카성 → 시텐노지 | 0.12 | 364 | `[538,278]` / `castle-east` | 성곽 공원 남쪽 보행축 — 녹지·해자 주변에서 남부 생활권 장거리 이동을 앞둔 구간 |
| `osaka-d5` | 시텐노지 → 텐노지역 | 0.50 | 591 | `[504,467]` / `namba-tennoji` | 사찰권에서 텐노지 교통광장으로 내려가는 길 — 저층 사찰가와 역세권의 전환 |
| `osaka-d6` | 텐노지역 → 쓰텐카쿠 | 0.55 | 654 | `[489,463]` / `namba-tennoji` | 텐노지역에서 신세카이로 서진하는 보행축 — 역세권에서 전망탑 주변 상점가로 바뀌는 구간 |
| `osaka-d7` | 쓰텐카쿠 → 구로몬시장 | 0.50 | 724 | `[465,421]` / `namba-tennoji` | 신세카이에서 북쪽 시장권으로 이어지는 생활가로 — 관광축과 일상 상권이 겹치는 길목 |
| `osaka-d8` | 에비스바시 → 오사카수족관 | 0.95 | 1,199 | `[130,443]` / `bay` | 항만 open rect에 진입한 뒤 수족관에 닿기 직전 — 도심 가로에서 부두·수변 경관으로 바뀌는 구간 |

발견점이 open이라고 해서 그 discovery의 전체 leg가 open인 것은 아니다. 특히 d4·d8은
발견 tile 자체는 PASS지만 앞뒤 leg에 위 표의 locked 이탈 구간이 남는다.

## 결정성

독립 Node 프로세스 A/B의 pretty audit JSON은 각각 14,059 bytes로 byte-identical이었다.

- audit stdout SHA-256 A/B:
  `aafea23a88c6c184198ce87d6c4cfa617da90452d29fbe16768c810c6472a153`
- canonical payload SHA-256:
  `3606b8c098c495e581543454d058d5956a294c4bbebf259b1024501611671d6c`
- 전체 joined path SHA-256:
  `4bda071003d403dd11e4aea466f082453a49761b0e11cd70523302dbdfe95722`
- max RSS A/B: 120,240 / 118,400 KiB
- 측정 입력 5파일 manifest SHA-256:
  `e5729471f3f8aefff5347b5d98a47486f5805dd23ad96f2ea031147b31b28f99`

| 입력 | Git blob |
|---|---|
| `src/components/world/cityMainRoute.js` | `a4f9067c1e13cc0e22b651e886dfb044eebb7016` |
| `src/components/world/cityDistricts.js` | `2c3a8257fec829469fed70ac6ea1103bcf0d701a` |
| `src/components/world/cities/terrain.js` | `0904ae65b2126d7e8aee883f3e070e0395c20b62` |
| `src/components/world/cities/osaka.js` | `4134ee45ad642091bb1023ccc9dac27cdf308926` |
| `src/components/world/cities/osaka.geo.js` | `d939d16ab23bfb6291d792c08d95aab53aad7332` |

manifest는 위 표의 `path<TAB>blob<LF>`를 표시 순서대로 이어 SHA-256 한 값이다.

## 재현 방법

도시 파일은 수정하지 않고 `OSAKA`를 펼친 임시 객체에 위 후보 `mainRoute`만 주입했다.

```js
const city = { ...OSAKA, mainRoute: candidate };
const grid = city.buildGrid();
const districts = resolveCityDistricts(OSAKA, grid);
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
little-endian uint32 인코딩으로 SHA-256 했다. open component는 동일
open·walkable·non-EXIT 조건과 URDL 이웃으로 전수 BFS 했다.

## 회귀 검증

- targeted mainRoute·district·Osaka geo:
  **5 files / 64 tests PASS / 18.29s**
- 최종 `set -o pipefail; npx vitest run --no-file-parallelism`:
  **230 files / 2,247 tests PASS / 324.67s / exit 0**
- `npm run lint`, `git diff --check`: PASS
- 변경 파일: `docs/proposal-osaka-mainroute.md` 1개; 도시 wrapper·geo·district rect·runtime·
  registry·verifier·DB·카피·테스트 byte 불변

## 인계

- **권고 1:** 단일 보행 mainRoute를 유지하려면 `castle-east↔namba-tennoji`와
  `namba-tennoji↔bay`의 승인된 open 회랑이 먼저 필요하다. 본 문서는 rect 좌표를
  임의 제안하거나 도시 파일을 바꾸지 않는다.
- **권고 2:** 현재 open 지구를 유지하려면 기존 환경선·항만 교통을 명시하는
  multi-stage route 계약이 필요하다. 이는 현 `node|station` 연속 BFS 스키마의 범위를
  넘으므로 Claude 결정 사항이다.
- 어느 선택이든 이 문서의 waypoint 순서와 discovery 맥락은 후보 자료로 재사용할 수 있지만,
  두 실패 leg의 RLE·SHA는 최종값으로 간주하면 안 된다.
