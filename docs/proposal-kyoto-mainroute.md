# 교토 mainRoute 주동선 후보 실측

- 상태: **report-only / 조건부 NO-GO** — 도시 wrapper·geo·district rect·
  `cityMainRoute.js`·CityScene·registry·verifier·DB·카피·테스트 변경 없음
- 측정 기준: `origin/main` `9d19d75fce0d476f350bf092d8410541bc499495`
  (#507/T24·#506/S22 merge 포함)
- 선례 계약: 리옹·보르도·스트라스부르 `MAIN_ROUTE`의 `version=1`,
  `cardinal-bfs-v1`, `URDL`, `excludeExit=true`, typed `node|station` waypoint,
  little-endian uint32 path SHA-256
- 후보 ID: `kyoto-classic-loop-candidate-a`(승인 전 예약 아님)
- 측정 환경: 2026-07-23, official nvm Node `v22.23.1`

## 판정

1. 후보 A는 교토역→후시미이나리타이샤→기요미즈데라→야사카신사→헤이안신궁→
   긴카쿠지→교토고쇼→니조성→킨카쿠지→도게쓰교의 **10 waypoint / 9 leg**다.
   waypoint 10/10은 기존 typed ref로 exact-1 해석되고, open 지구 안의 보행 가능·비EXIT
   실측 타일이다. `station-fushimi`, `higashiyama-core`, `imperial-nijo`,
   `arashiyama-sanin` 네 지구를 waypoint 기준으로 모두 방문한다.
2. 실제 도시 `ENTRANCE [404,422]`에서 첫 waypoint 교토역 `[404,415]`까지는 정북
   7 steps다. 8타일 모두 보행 가능·open·비EXIT이고, 북쪽의 실제 EXIT
   `[404,412]`, `[404,413]`에는 닿지 않는다. 따라서 교토역 방면 진입이라는 출발
   의미가 기존 spawn·return 계약과 충돌하지 않는다.
3. 전체 도시 보행망의 URDL BFS에서는 9/9 leg가 도달한다. 경로는 **1,610 steps /
   1,611 tiles / 게임-grid 32.20km**, 전 타일 보행 가능, 차단 0, EXIT 0이다.
4. 그러나 waypoint가 속한 open 보행 성분은 중심·남역 component 2(34,594타일),
   후시미 component 13(3,008타일), 북동부 component 1(10,816타일),
   킨카쿠지 component 0(2,110타일), 아라시야마 component 4(9,129타일)의
   다섯으로 끊겨 있다. 따라서 네 지구를 잇는 **연속 open-only cardinal BFS는 현재
   계약상 존재하지 않는다.**
5. 후보 A의 1,611타일 중 open은 1,118, locked는 493이다. 실패는
   교토역→후시미이나리 57타일, 후시미이나리→기요미즈데라 138타일,
   야사카→헤이안 15타일, 긴카쿠지→교토고쇼 53타일, 니조성→킨카쿠지 98타일,
   킨카쿠지→도게쓰교 132타일의 여섯 연결부에 정확히 한정된다. 나머지 3/9 leg는
   open-only PASS다.
6. 같은 open 성분에 있는 기요미즈데라→야사카, 헤이안→긴카쿠지,
   교토고쇼→니조성은 무힌트 최단경로가 이미 open-only PASS다. 실패한 여섯 leg는
   양 endpoint의 open 성분 자체가 달라 `viaTiles`로 고칠 수 없으므로 후보 A에는
   `segmentHints`를 두지 않았다.
7. `resolveCityDistricts(city, grid, resolvedMainRoute)`는 main route 전 타일에
   `assertOpen`을 적용하므로, 아래 RLE를 현재 `kyoto.js`에 그대로 배선하면 첫 locked
   타일 `[471,444]`에서 fail-closed 오류가 난다. Claude가 (a) 여섯 open 회랑을
   승인하거나 (b) 철도·버스를 표현할 별도 route 계약으로 분할하기 전에는
   **통합 금지**다. 연결 정책이 바뀌면 RLE·SHA도 다시 산출해야 한다.

거리(m)는 도시 geo의 20m/tile 게임-grid 환산값이며 실제 관광 보행거리 측량치가 아니다.

## 후보 계약

```js
{
  id: 'kyoto-classic-loop-candidate-a',
  version: 1,
  routing: {
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  },
  waypoints: [
    { kind: 'station', id: 'kyoto' },
    { kind: 'node', id: 'fushimi-inari-taisha' },
    { kind: 'node', id: 'kiyomizudera' },
    { kind: 'node', id: 'yasaka-shrine' },
    { kind: 'node', id: 'heian-shrine' },
    { kind: 'node', id: 'ginkakuji' },
    { kind: 'node', id: 'kyoto-imperial-palace' },
    { kind: 'node', id: 'nijo-castle' },
    { kind: 'node', id: 'kinkakuji' },
    { kind: 'node', id: 'togetsukyo' },
  ],
  segmentHints: [],
  branches: [],
}
```

## waypoint 실측표

| # | typed key | 이름 | tile | open 지구 | terrain | 판정 |
|---:|---|---|---:|---|---|---|
| 1 | `station:kyoto` | 京都駅 | `[404,415]` | `station-fushimi` | PLAZA(3) | open·walkable·non-EXIT |
| 2 | `node:fushimi-inari-taisha` | 伏見稲荷大社 | `[487,517]` | `station-fushimi` | PARK(4) | open·walkable·non-EXIT |
| 3 | `node:kiyomizudera` | 清水寺 | `[519,362]` | `higashiyama-core` | SIDEWALK(1) | open·walkable·non-EXIT |
| 4 | `node:yasaka-shrine` | 八坂神社 | `[493,314]` | `higashiyama-core` | PLAZA(3) | open·walkable·non-EXIT |
| 5 | `node:heian-shrine` | 平安神宮 | `[515,244]` | `higashiyama-core` | SIDEWALK(1) | open·walkable·non-EXIT |
| 6 | `node:ginkakuji` | 銀閣寺 | `[584,183]` | `higashiyama-core` | PLAZA(3) | open·walkable·non-EXIT |
| 7 | `node:kyoto-imperial-palace` | 京都御所 | `[419,192]` | `imperial-nijo` | SIDEWALK(1) | open·walkable·non-EXIT |
| 8 | `node:nijo-castle` | 二条城 | `[356,261]` | `imperial-nijo` | SIDEWALK(1) | open·walkable·non-EXIT |
| 9 | `node:kinkakuji` | 金閣寺 | `[274,115]` | `imperial-nijo` | SIDEWALK(1) | open·walkable·non-EXIT |
| 10 | `node:togetsukyo` | 渡月橋 | `[35,262]` | `arashiyama-sanin` | BRIDGE(5) | open·walkable·non-EXIT |

## leg별 BFS·open 검증

`open/locked`는 각 leg 자체의 endpoint 포함 tileCount 기준이다. 합계 행은 leg 접합점의
중복 waypoint 8개를 한 번만 센 전체 path 기준이다.

| # | from → to | steps / tiles | RLE runs | open / locked | blocked / EXIT | open-only | path SHA-256 |
|---:|---|---:|---:|---:|---:|---|---|
| 1 | 교토역 → 후시미이나리 | 185 / 186 | 36 | 129 / **57** | 0 / 0 | **FAIL** | `87221ddbd22351731950ee146c9154fbaa311a44eab9bec7c46f4370e5df5646` |
| 2 | 후시미이나리 → 기요미즈데라 | 187 / 188 | 28 | 50 / **138** | 0 / 0 | **FAIL** | `113d0626445336c2bb0a6cba8a326270049eea48620c9fba1aeadb766a954fce` |
| 3 | 기요미즈데라 → 야사카 | 74 / 75 | 11 | 75 / 0 | 0 / 0 | PASS | `82411ce87491e4bc42506c52ed3eb1c8fd636bd7188f17393cf1181e55c88c76` |
| 4 | 야사카 → 헤이안 | 92 / 93 | 15 | 78 / **15** | 0 / 0 | **FAIL** | `cfd0b76bc993344a0b5c7de8276a0810e53e1c8a409542b461841ed78d9535b2` |
| 5 | 헤이안 → 긴카쿠지 | 132 / 133 | 23 | 133 / 0 | 0 / 0 | PASS | `7a50705ca9313c09eb878045a8ca50a2e524be363992b0da20d25d05f7f7c269` |
| 6 | 긴카쿠지 → 교토고쇼 | 194 / 195 | 32 | 142 / **53** | 0 / 0 | **FAIL** | `947dea934eda712b724a7b47286361d271c4099705f008cc69fe0babc73e2b01` |
| 7 | 교토고쇼 → 니조성 | 132 / 133 | 12 | 133 / 0 | 0 / 0 | PASS | `271c90147f91974605d20c1e811ed720866e4ccdb306566f044f413e986879c9` |
| 8 | 니조성 → 킨카쿠지 | 228 / 229 | 34 | 131 / **98** | 0 / 0 | **FAIL** | `9197e9cce7fd9cd8d67c865a50ece49a939a21bc34639175afb47b4f503756b1` |
| 9 | 킨카쿠지 → 도게쓰교 | 386 / 387 | 50 | 255 / **132** | 0 / 0 | **FAIL** | `2f9aae336caad11defc3ab637263fac565f8b11a943280752c9f0d4c287e7d56` |
| **합계** | 9/9 walkable reachable | **1,610 / 1,611** | **241** | **1,118 / 493** | **0 / 0** | **3/9 PASS** | `41d370dee8579e6e81f2f4876a9123dfd34630db76e9f6dc0577ece3cede0439` |

### open 이탈 구간

| leg | segment offset | 첫 locked tile → 마지막 locked tile | locked tiles |
|---|---:|---|---:|
| 교토역 → 후시미이나리 | 96..152 | `[471,444]` → `[482,489]` | 57 |
| 후시미이나리 → 기요미즈데라 | 30..167 | `[489,489]` → `[518,381]` | 138 |
| 야사카 → 헤이안 | 50..64 | `[514,285]` → `[514,271]` | 15 |
| 긴카쿠지 → 교토고쇼 | 95..147 | `[499,173]` → `[451,177]` | 53 |
| 니조성 → 킨카쿠지 | 104..201 | `[344,169]` → `[301,115]` | 98 |
| 킨카쿠지 → 도게쓰교 | 24..103 | `[271,136]` → `[260,204]` | 80 |
| 킨카쿠지 → 도게쓰교 | 196..247 | `[199,236]` → `[161,249]` | 52 |

실패한 여섯 leg의 양 endpoint는 서로 다른 open 보행 component에 있으므로 단순 tie-break
변경이나 추가 `viaTiles`만으로는 해결되지 않는다.

## stepsRle 전문

아래 compact 표기는 저장 객체의 순서를 빠짐없이 적은 것이다. 예를 들어 `U5`는
`{ direction: 'U', count: 5 }`이며 생략 부호는 없다.

### 1. `station:kyoto--node:fushimi-inari-taisha`

```text
R34 D1 R1 D6 R1 D2 R1 D4 R1 D8 R1 D7 R18 D1 R10 D1 R1 D12 R1 D4 R1 D1 R1 D2 R1 D2 R2 D1 R4 D28 R1 D9 R1 D8 R3 D5
```

### 2. `node:fushimi-inari-taisha--node:kiyomizudera`

```text
U5 R2 U24 R1 U2 R1 U3 R1 U11 R3 U23 R7 U33 R2 U6 R1 U5 R2 U9 R3 U9 R1 U1 R1 U1 R6 U23 R1
```

### 3. `node:kiyomizudera--node:yasaka-shrine`

```text
L1 U5 L1 U12 L1 U25 L1 U1 L1 U5 L21
```

### 4. `node:yasaka-shrine--node:heian-shrine`

```text
R1 U2 R9 U2 R2 U8 R1 U4 R5 U1 R2 U9 R1 U44 R1
```

### 5. `node:heian-shrine--node:ginkakuji`

```text
L1 U2 R1 U11 R1 U14 R2 U5 R2 U11 R1 U6 R3 U7 R15 U1 R4 U1 R6 U2 R16 U1 R19
```

### 6. `node:ginkakuji--node:kyoto-imperial-palace`

```text
U2 L1 U1 L18 U1 L5 U1 L3 U1 L6 U1 L2 U1 L6 U1 L39 U1 L43 D3 L10 D1 L1 D3 L6 D2 L2 D6 L20 D1 L2 D3 L1
```

### 7. `node:kyoto-imperial-palace--node:nijo-castle`

```text
D41 L1 D18 L44 D1 L6 D1 L1 D1 L6 D7 L5
```

### 8. `node:nijo-castle--node:kinkakuji`

```text
U11 L1 U35 L1 U21 L1 U2 L1 U3 L2 U9 L1 U2 L4 U1 L1 U26 L1 U3 L1 U1 L1 U27 L8 U1 L11 U1 L2 U1 L9 U1 L10 U1 L27
```

### 9. `node:kinkakuji--node:togetsukyo`

```text
D8 L3 D28 L3 D20 L4 D3 L1 D9 L1 D15 L1 D2 L1 D33 L7 D1 L13 D1 L20 D1 L40 D1 L4 D1 L6 D7 L3 D1 L4 D3 L4 D2 L17 D1 L1 D1 L7 D1 L46 D1 L21 D1 L4 D2 L26 D1 L1 D3 L1
```

## discovery 스팟 후보 8곳

`context`는 카피가 아니라 Claude 저작용 주변 맥락 제안이다. `at`은 해당 leg의
`start + round(at * stepCount)`(양 endpoint 제외 clamp) 규칙으로 재투영했다.
8곳 모두 open·walkable·non-EXIT다.

| ID | leg | at | routeIndex | 실측 tile / 지구 | 주변 맥락 제안 |
|---|---|---:|---:|---|---|
| `kyoto-d1` | 교토역 → 후시미이나리 | 0.35 | 65 | `[443,441]` / `station-fushimi` | 교토역 남동쪽 가로망에서 후시미 방향으로 접어드는 구간 — 철도 관문과 남부 생활권의 전환 |
| `kyoto-d2` | 후시미이나리 → 기요미즈데라 | 0.90 | 353 | `[518,380]` / `higashiyama-core` | 남쪽에서 히가시야마 open 경계에 다시 들어와 기요미즈데라 권역으로 오르는 길목 |
| `kyoto-d3` | 야사카 → 헤이안 | 0.25 | 469 | `[505,303]` / `higashiyama-core` | 야사카 주변의 촘촘한 가로에서 헤이안신궁 방면의 넓은 북행축으로 바뀌는 구간 |
| `kyoto-d4` | 헤이안 → 긴카쿠지 | 0.55 | 611 | `[530,188]` / `higashiyama-core` | 헤이안신궁 북쪽에서 동산 기슭을 따라 긴카쿠지 권역으로 이어지는 보행축 |
| `kyoto-d5` | 긴카쿠지 → 교토고쇼 | 0.80 | 825 | `[446,180]` / `imperial-nijo` | 북동부 사찰권을 벗어나 교토고쇼의 격자형 중심가로 진입한 뒤 만나는 동서축 |
| `kyoto-d6` | 교토고쇼 → 니조성 | 0.55 | 937 | `[405,251]` / `imperial-nijo` | 교토고쇼 남서쪽에서 니조성으로 내려가는 중심 격자 — 북부 녹지와 도심 가로의 전환 |
| `kyoto-d7` | 니조성 → 킨카쿠지 | 0.95 | 1,213 | `[285,115]` / `imperial-nijo` | 북서부 open rect에 다시 들어와 킨카쿠지 접근 가로에 닿는 구간 |
| `kyoto-d8` | 킨카쿠지 → 도게쓰교 | 0.82 | 1,541 | `[96,254]` / `arashiyama-sanin` | 아라시야마 open 권역에 진입한 뒤 저층 가로에서 도게쓰교 수변으로 가까워지는 구간 |

발견점이 open이라고 해서 그 discovery의 전체 leg가 open인 것은 아니다. d1·d2·d3·d5·d7·
d8은 발견 tile 자체는 PASS지만 앞뒤 leg에 위 표의 locked 이탈 구간이 남는다.

## 결정성

독립 Node 프로세스 A/B의 pretty audit JSON은 각각 20,309 bytes로 byte-identical이었다.

- audit stdout SHA-256 A/B:
  `93fe71d6180aeed53636843e4d69a0ed75f76f3d29f190d19fccc11cb7873a95`
- canonical payload SHA-256:
  `4de704db9767ad240f7574c1b80d2f992697008dd2fc3b7a72c3a9ddd45d54d5`
- 전체 joined path SHA-256:
  `41d370dee8579e6e81f2f4876a9123dfd34630db76e9f6dc0577ece3cede0439`
- max RSS A/B: 161,008 / 160,000 KiB
- 측정 입력 5파일 manifest SHA-256:
  `22fd7968bf5bea66f5e39cfb26fda4f2f45e83ffeffac424caff8f007ef44569`

| 입력 | Git blob |
|---|---|
| `src/components/world/cityMainRoute.js` | `a4f9067c1e13cc0e22b651e886dfb044eebb7016` |
| `src/components/world/cityDistricts.js` | `2c3a8257fec829469fed70ac6ea1103bcf0d701a` |
| `src/components/world/cities/terrain.js` | `0904ae65b2126d7e8aee883f3e070e0395c20b62` |
| `src/components/world/cities/kyoto.js` | `1cc3cbb7708c8519fefb0287dd336cb2f8354b2e` |
| `src/components/world/cities/kyoto.geo.js` | `b52d76b9d8ecde89df92c0f5e883a5593c852b80` |

manifest는 위 표의 `path<TAB>blob<LF>`를 표시 순서대로 이어 SHA-256 한 값이다.

## 재현 방법

도시 파일은 수정하지 않고 `KYOTO`를 펼친 임시 객체에 위 후보 `mainRoute`만 주입했다.

```js
const city = { ...KYOTO, mainRoute: candidate };
const grid = city.buildGrid();
const districts = resolveCityDistricts(KYOTO, grid);
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

- targeted mainRoute·district·Kyoto geo:
  **5 files / 63 tests PASS / 6.79s**
- 최종 `set -o pipefail; npx vitest run --no-file-parallelism`:
  **231 files / 2,248 tests PASS / 232.07s / exit 0**
- `npm run lint`, 9개 RLE planner exact 대조, `git diff --check`: PASS
- 변경 파일: `docs/proposal-kyoto-mainroute.md` 1개; 도시 wrapper·geo·district rect·runtime·
  registry·verifier·DB·카피·테스트 byte 불변

## 인계

- **권고 1:** 단일 보행 mainRoute를 유지하려면 `station-fushimi` 내부 중심↔후시미,
  `station-fushimi↔higashiyama-core`, 히가시야마 남·북 rect,
  `higashiyama-core↔imperial-nijo`, `imperial-nijo` 중심↔킨카쿠지,
  `imperial-nijo↔arashiyama-sanin`의 승인된 open 회랑이 먼저 필요하다. 아래 부록은
  승인 전 소형 회랑 rect를 제안할 뿐 도시 파일은 바꾸지 않는다.
- **권고 2:** 현재 open 지구를 유지하려면 기존 나라선·산인선과 시내 이동을 명시하는
  multi-stage route 계약이 필요하다. 이는 현 `node|station` 연속 BFS 스키마의 범위를
  넘으므로 Claude 결정 사항이다.
- 어느 선택이든 이 문서의 waypoint 순서와 discovery 맥락은 후보 자료로 재사용할 수 있지만,
  여섯 실패 leg의 RLE·SHA는 최종값으로 간주하면 안 된다.

## 지구 회랑 부록 (T26)

- 재검증 기준: `origin/main`
  `5440a3869386d312c82e53f2d55280d71f0ad2cb`(#509 merge)
- 입력 blob: 본 문서(부록 추가 전)
  `dd5035bbf4d3a5883dd24cda8197a6820cdbc2c1`, `kyoto.js`
  `1cc3cbb7708c8519fefb0287dd336cb2f8354b2e`,
  `cityDistricts.js` `2c3a8257fec829469fed70ac6ea1103bcf0d701a`
- 문서의 각 `stepsRle` 전문을 생략 없이 `{ direction, count }` 배열로 파싱했다.
  각 leg의 시작·끝은 현재 `KYOTO.nodes` 또는 `KYOTO.stations`에서 typed key를
  exact-1로 찾아 얻었고, 모든 count를 타일 단위로 전개했다. leg 접합점은 다음 leg의
  첫 타일을 한 번 제거했다.
- 전개한 1,611타일을 현재 `districts.open[*].tiles.rects`의 포함 경계
  (`x0 <= x <= x1`, `y0 <= y <= y1`)와 직접 대조한 결과는
  **open 1,118 / locked 493**이다. 따라서 위 기존 검증표의 위반 수는 재현되며,
  현 rect 그대로의 통합은 여전히 fail-closed 대상이다.

### 잠긴 지대 bbox

`joined offset`과 `leg offset`은 모두 0부터 센다. bbox는 위반 타일 자체의
`[x0,y0,x1,y1]` 포함 경계다.

| 지대 | leg / offset | joined offset | 첫 타일 → 마지막 타일 | locked | bbox | 양쪽 인접 지구 |
|---|---|---:|---|---:|---|---|
| K1 | 1 / 96..152 | 96..152 | `[471,444]` → `[482,489]` | 57 | `[471,444,482,489]` | `station-fushimi` 내부 |
| K2 | 2 / 30..167 | 215..352 | `[489,489]` → `[518,381]` | 138 | `[489,381,518,489]` | `station-fushimi` ↔ `higashiyama-core` |
| K3 | 4 / 50..64 | 496..510 | `[514,285]` → `[514,271]` | 15 | `[514,271,514,285]` | `higashiyama-core` 내부 |
| K4 | 6 / 95..147 | 765..817 | `[499,173]` → `[451,177]` | 53 | `[451,173,499,177]` | `higashiyama-core` ↔ `imperial-nijo` |
| K5 | 8 / 104..201 | 1100..1197 | `[344,169]` → `[301,115]` | 98 | `[301,115,344,169]` | `imperial-nijo` 내부 |
| K6 | 9 / 24..103 | 1248..1327 | `[271,136]` → `[260,204]` | 80 | `[260,136,271,204]` | `imperial-nijo` ↔ `arashiyama-sanin` |
| K7 | 9 / 196..247 | 1420..1471 | `[199,236]` → `[161,249]` | 52 | `[161,236,199,249]` | `arashiyama-sanin` 내부 |

### 권장 회랑 rect

아래 rect는 승인 전 제안이다. 각 잠긴 지대의 연속 경로를 최대 48타일 조각으로 나누고
조각 bbox의 x·y 양쪽에 정확히 2타일을 더했다. 패딩 후 한 변 64타일·면적 768타일²를
상한으로 삼아 대형 bbox 하나로 잠금을 푸는 안은 배제했다. 교토 제안 15개 rect의
실측 최대치는 한 변 49타일·면적 656타일²다. 소속은 해당 잠긴 지대 바로 양쪽의 기존
지구로만 제한하고, 조각 경로에서 각 기존 rect까지의 맨해튼 거리 합이 작은 쪽을
제안했다. 각 목록의 rect 순서는 경로 진행 순서다.

- K1 → `station-fushimi`: `[469,442,484,482]`, `[480,479,484,491]`
- K2 → `station-fushimi`: `[487,447,498,491]`, `[495,408,507,451]`
- K2 → `higashiyama-core`: `[503,379,520,411]`
- K3 → `higashiyama-core`: `[512,269,516,287]`
- K4 → `higashiyama-core`: `[453,171,501,178]`
- K4 → `imperial-nijo`: `[449,174,456,179]`
- K5 → `imperial-nijo`: `[339,123,346,171]`, `[300,114,343,126]`,
  `[299,113,303,118]`
- K6 → `imperial-nijo`: `[261,134,273,177]`
- K6 → `arashiyama-sanin`: `[258,174,265,206]`
- K7 → `arashiyama-sanin`: `[161,234,201,249]`, `[159,246,165,251]`

이 rect 목록의 합집합은 잠긴 경로 타일 **493/493**을 포함한다. 실제 `kyoto.js`
반영 시에는 rect 추가 후 `resolveCityDistricts(city, grid, resolvedMainRoute)`를
실행해 경로 전수 open을 다시 확인해야 하며, 이 부록은 지구 승인이나 runtime 변경을
대신하지 않는다.

T26 감사 JSON은 독립 Node 프로세스 A/B에서 byte-identical했고, 결합 SHA-256은
`a31a558b2438cb50f6b3293d61d44d374b03e1deecf0d58a51936584db3d6ce9`다.
