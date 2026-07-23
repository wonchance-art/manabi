# 도쿄 mainRoute 주동선 후보 실측

- 상태: **report-only / 조건부 NO-GO** — 도시 wrapper·geo·district rect·
  `cityMainRoute.js`·CityScene·registry·verifier·DB·카피·테스트 변경 없음
- 측정 기준: `origin/main` `99925fac302427d8978babfdd63dae3df7c4e8d6`
  (#495/T21 merge 포함)
- 선례 계약: 리옹·보르도·스트라스부르 `MAIN_ROUTE`의 `version=1`,
  `cardinal-bfs-v1`, `URDL`, `excludeExit=true`, typed `node|station` waypoint,
  little-endian uint32 path SHA-256
- 후보 ID: `tokyo-classic-loop-candidate-a`(승인 전 예약 아님)
- 측정 환경: 2026-07-23, official nvm Node `v22.23.1`

## 판정

1. 후보 A는 하네다 공항→시나가와역→시부야→메이지 신궁→도쿄도청→우에노→
   아사쿠사→도쿄 스카이트리→도쿄역→오다이바의 **10 waypoint / 9 leg**다.
   waypoint 10/10은 기존 typed ref로 exact-1 해석되고, open 지구 안의 보행 가능·비EXIT
   실측 타일이다. `haneda`, `south-bay`, `yamanote-west`, `central-east` 네 지구를
   waypoint 기준으로 모두 방문한다.
2. 전체 도시 보행망의 URDL BFS에서는 9/9 leg가 도달한다. 경로는 **2,723 steps /
   2,724 tiles / 게임-grid 54.46km**, 전 타일 보행 가능, 차단 0, EXIT 0이다.
3. 그러나 현 open union의 route 관련 보행 성분은 서로 끊겨 있다.
   `haneda-airport`는 component 15(3,018타일), `shibuya-scramble`은 component 5
   (58,822타일), 시나가와·중심동부·오다이바는 component 0(125,582타일)이다.
   따라서 4지구를 잇는 **연속 open-only cardinal BFS는 현재 계약상 존재하지 않는다.**
4. 후보 A의 2,724타일 중 open은 1,934, locked는 790이다. 실패는
   하네다→시나가와 529타일, 시나가와→시부야 151타일, 도청→우에노 110타일의
   세 연결부에 정확히 한정된다. 나머지 6/9 leg는 open-only PASS다.
5. `resolveCityDistricts(city, grid, resolvedMainRoute)`는 main route 전 타일에
   `assertOpen`을 적용하므로, 아래 RLE를 현재 `tokyo.js`에 그대로 배선하면 fail-closed
   오류가 난다. Claude가 (a) 세 open 회랑을 승인하거나 (b) 교통 점프를 표현할 별도
   route 계약으로 분할하기 전에는 **통합 금지**다. 연결 정책이 바뀌면 RLE·SHA도 다시
   산출해야 한다.

거리(m)는 도시 geo의 20m/tile 게임-grid 환산값이며 실제 관광 보행거리 측량치가 아니다.

## 후보 계약

```js
{
  id: 'tokyo-classic-loop-candidate-a',
  version: 1,
  routing: {
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  },
  segmentHints: [{
    from: { kind: 'node', id: 'tokyo-skytree' },
    to: { kind: 'node', id: 'tokyo-station-marunouchi' },
    viaTiles: [[520, 239], [520, 280], [500, 300]],
  }],
  branches: [],
}
```

스카이트리→도쿄역 무힌트 최단경로는 365 steps지만 central-east rect 밖 잠금 타일
200개로 벗어난다. 위 세 보행·open hint를 적용한 367-step 경로는 open-only PASS이며,
그 대가가 2 steps뿐이라 후보 A에 포함했다. 다른 8개 leg에는 hint가 없다.

## waypoint 실측표

| # | typed key | 이름 | tile | open 지구 | terrain | 판정 |
|---:|---|---|---:|---|---|---|
| 1 | `node:haneda-airport` | 羽田空港 | `[563,1062]` | `haneda` | PLAZA(3) | open·walkable·non-EXIT |
| 2 | `station:shinagawa` | 品川駅 | `[357,619]` | `south-bay` | PLAZA(3) | open·walkable·non-EXIT |
| 3 | `node:shibuya-scramble` | 渋谷スクランブル交差点 | `[183,448]` | `yamanote-west` | CROSSWALK(2) | open·walkable·non-EXIT |
| 4 | `node:meiji-jingu` | 明治神宮 | `[182,357]` | `yamanote-west` | ROAD(0) | open·walkable·non-EXIT |
| 5 | `node:tokyo-metropolitan-government` | 東京都庁 | `[144,283]` | `yamanote-west` | PLAZA(3) | open·walkable·non-EXIT |
| 6 | `node:ueno-park` | 上野恩賜公園 | `[508,144]` | `central-east` | PLAZA(3) | open·walkable·non-EXIT |
| 7 | `node:sensoji` | 浅草寺 | `[616,143]` | `central-east` | PLAZA(3) | open·walkable·non-EXIT |
| 8 | `node:tokyo-skytree` | 東京スカイツリー | `[681,166]` | `central-east` | PLAZA(3) | open·walkable·non-EXIT |
| 9 | `node:tokyo-station-marunouchi` | 東京駅丸の内駅舎 | `[479,327]` | `central-east` | PLAZA(3) | open·walkable·non-EXIT |
| 10 | `node:odaiba-seaside-park` | お台場海浜公園 | `[537,613]` | `south-bay` | ROAD(0) | open·walkable·non-EXIT |

## leg별 BFS·open 검증

`open/locked`는 각 leg 자체의 endpoint 포함 tileCount 기준이다. 합계 행은 leg 접합점의
중복 waypoint 8개를 한 번만 센 전체 path 기준이다.

| # | from → to | steps / tiles | RLE runs | open / locked | blocked / EXIT | open-only | path SHA-256 |
|---:|---|---:|---:|---:|---:|---|---|
| 1 | Haneda → Shinagawa | 665 / 666 | 166 | 137 / **529** | 0 / 0 | **FAIL** | `396a1f8a326034998053aa4cd88ab6f78bb233858defae88152a6972261f6601` |
| 2 | Shinagawa → Shibuya | 345 / 346 | 60 | 195 / **151** | 0 / 0 | **FAIL** | `951751f6fe22ad1a3264262c34b69f108d21d793fe14e2f9c5ecc66a39642bff` |
| 3 | Shibuya → Meiji Jingu | 104 / 105 | 15 | 105 / 0 | 0 / 0 | PASS | `687202ec5a5021068ce0555fd25c26177649e989c2a3029a3a3a148c3d485013` |
| 4 | Meiji Jingu → Metropolitan Government | 112 / 113 | 22 | 113 / 0 | 0 / 0 | PASS | `7c409f6ee15b2bb9523a1fa600a6bb9922f998ccbd65b45e021a21419099afb7` |
| 5 | Metropolitan Government → Ueno | 503 / 504 | 81 | 394 / **110** | 0 / 0 | **FAIL** | `2ee570210f84267c62c6e221145b2b19a94da0fc63d0f314ef8cf79bcd2fda3b` |
| 6 | Ueno → Sensoji | 119 / 120 | 15 | 120 / 0 | 0 / 0 | PASS | `6bb4db05b676b180ad81126ef1a4146c150f2fb110d50a3366239db33a2a0c71` |
| 7 | Sensoji → Skytree | 96 / 97 | 19 | 97 / 0 | 0 / 0 | PASS | `ba7b3878132f54c78ced06304daaf1c9e696a81aa1ad4ac2cf02ce8bded89ccc` |
| 8 | Skytree → Tokyo Station | 367 / 368 | 92 | 368 / 0 | 0 / 0 | PASS | `640d9007af71db7e5dbe81fac5e8f5ff7b5f080b7a6b1730fa61976766a49966` |
| 9 | Tokyo Station → Odaiba | 412 / 413 | 108 | 413 / 0 | 0 / 0 | PASS | `ef2b938c7021adfcd17f41b170928aab18c6d55a29c905c7ef39942fc9fbbdc9` |
| **합계** | 9/9 walkable reachable | **2,723 / 2,724** | **578** | **1,934 / 790** | **0 / 0** | **6/9 PASS** | `e19a2a4417e71154a74d50e57e2d592e4dfc7c2f33fcf53e0104916cea9f9a39` |

### open 이탈 구간

| leg | segment offset | 첫 locked tile → 마지막 locked tile | locked tiles |
|---|---:|---|---:|
| Haneda → Shinagawa | 47..575 | `[559,1019]` → `[363,701]` | 529 |
| Shinagawa → Shibuya | 122..272 | `[329,525]` → `[251,453]` | 151 |
| Metropolitan Government → Ueno | 183..292 | `[251,207]` → `[339,186]` | 110 |

각 실패 leg의 양 endpoint는 서로 다른 open 보행 component에 있으므로 단순 tie-break 변경이나
추가 `viaTiles`만으로는 해결되지 않는다.

## stepsRle 전문

아래 compact 표기는 저장 객체의 순서를 빠짐없이 적은 것이다. 예를 들어 `U5`는
`{ direction: 'U', count: 5 }`이며 생략 부호는 없다.

### 1. `node:haneda-airport--station:shinagawa`

```text
U5 L1 U2 L1 U1 L1 U2 L1 U34 L1 U2 L1 U2 L1 U1 L4 U1 L1 U2 L1 U2 L1 U1 L1 U2 L1 U2 L1 U1 L1 U2 L1 U2 L77 U1 L1 U1 L1 U2 L1 U1 L1 U1 L39 U3 L1 U1 L1 U1 L1 U5 L1 U1 L1 U2 L1 U1 L1 U2 L1 U1 L1 U1 L1 U1 L2 U2 L1 U1 L1 U1 L1 U1 L1 U2 L1 U1 L1 U2 L1 U1 L1 U3 L1 U40 L1 U1 L1 U2 L1 U10 L3 U3 L1 U3 L1 U2 L1 U3 L1 U3 L1 U14 L2 U1 L3 U4 L1 U3 L1 U2 L1 U7 L1 U3 L1 U2 L1 U3 L3 U3 L1 U4 L13 U1 L1 U1 L1 U1 L1 U28 L1 U21 R1 U5 L1 U8 L1 U14 L1 U5 R1 U8 R1 U5 L1 U15 R1 U3 R1 U1 R1 U3 R1 U62 L1 U5 L1 U7 L1 U9 R1 U5 L1 U20 L3
```

### 2. `station:shinagawa--node:shibuya-scramble`

```text
U5 L3 U30 L5 U4 L1 U7 L1 U3 L4 U3 L1 U3 L1 U4 L1 U1 L1 U15 L2 U11 L7 U8 L2 U4 L1 U6 L2 U8 L1 U5 L1 U1 L1 U7 L1 U2 L1 U17 L3 U1 L1 U2 L1 U2 L1 U9 L3 U2 L12 U3 L20 U1 L16 U1 L6 U1 L62 U5 L12
```

### 3. `node:shibuya-scramble--node:meiji-jingu`

```text
U1 R1 U17 R1 U3 R1 U2 R1 U13 R1 U1 R1 U53 L7 U1
```

### 4. `node:meiji-jingu--node:tokyo-metropolitan-government`

```text
U26 L2 U18 L2 U2 L1 U2 L1 U8 L1 U2 L1 U3 L1 U2 L2 U5 L5 U5 L18 U1 L4
```

### 5. `node:tokyo-metropolitan-government--node:ueno-park`

```text
R1 U20 R1 U2 R1 U2 R1 U1 R1 U28 R2 U13 R1 U2 R8 U1 R25 U2 R10 U1 R18 U1 R3 U1 R1 U2 R39 U1 R3 U1 R4 U7 R6 U4 R3 U3 R43 U2 R5 U1 R1 U1 R7 U1 R13 U1 R4 U2 R2 U2 R21 U2 R23 U1 R7 U1 R3 U3 R7 U4 R1 U2 R11 U1 R6 U1 R10 U3 R21 U1 R2 U6 R4 U2 R21 U1 R6 U8 R8 U1 R10
```

### 6. `node:ueno-park--node:sensoji`

```text
U4 R27 D1 R2 U1 R16 D1 R28 D1 R2 U1 R20 D1 R13 D1
```

### 7. `node:sensoji--node:tokyo-skytree`

```text
R1 D1 R12 U1 R20 D1 R2 D1 R11 D2 R9 D11 R1 D10 R2 D1 R5 U3 R2
```

### 8. `node:tokyo-skytree--node:tokyo-station-marunouchi`

```text
L2 D11 L2 D3 L1 D2 L1 D1 L1 D13 L1 D13 L2 D2 L4 D2 L3 D1 L8 D1 L3 D1 L43 D1 L10 D1 L1 D2 L1 D2 L1 D1 L1 D2 L1 D2 L1 D1 L1 D2 L1 D1 L1 D1 L1 D1 L1 D2 L1 D1 L1 D1 L3 D1 L60 D1 L4 R1 D41 L2 D10 L1 D1 L1 D1 L3 D1 L11 D1 L2 D6 L1 D7 L1 D3 L1 D2 L9 D5 L1 D1 L1 D1 L1 D1 L6 D1 L1 D4 L1 D2 R1
```

### 9. `node:tokyo-station-marunouchi--node:odaiba-seaside-park`

```text
L1 D2 L1 D1 L1 D2 R1 D21 L1 D2 L1 D1 L1 D1 L1 D2 R1 D12 L1 D5 L1 D1 L1 D13 L1 D1 L1 D1 L1 D3 R1 D5 L1 D28 L1 D1 L2 D18 L3 D1 L1 D2 L1 D1 L8 D50 L1 D4 L1 D4 L1 D6 R1 D10 L1 D3 R5 D1 R1 D42 R3 D1 R2 D1 R3 D1 R2 D1 R3 D1 R2 D1 R3 D1 R3 D1 R5 D1 R1 D1 R1 D1 R6 D1 R1 D1 R15 D3 R20 D1 R1 D2 R1 D1 R1 D1 R1 D1 R1 D2 R4 D1 R1 D15 R1 D1 R1 D1
```

## discovery 스팟 후보 8곳

`context`는 카피가 아니라 Claude 저작용 주변 맥락 제안이다. `at`은 해당 leg의
`start + round(at * stepCount)`(양 endpoint 제외 clamp) 규칙으로 재투영했다.
8곳 모두 open·walkable·non-EXIT다.

| ID | leg | at | routeIndex | 실측 tile / 지구 | 주변 맥락 제안 |
|---|---|---:|---:|---|---|
| `tokyo-d1` | Haneda → Shinagawa | 0.05 | 33 | `[559,1033]` / `haneda` | 하네다 공항 보행축과 에이프런 가장자리 — 시내행 진입이 시작되는 구간 |
| `tokyo-d2` | Shinagawa → Shibuya | 0.20 | 734 | `[342,565]` / `south-bay` | 시나가와·다카나와 철도 회랑 — 남부 업무지구에서 서부 도심으로 방향을 트는 구간 |
| `tokyo-d3` | Shibuya → Meiji Jingu | 0.50 | 1,062 | `[189,402]` / `yamanote-west` | 시부야에서 하라주쿠로 이어지는 보행축 — 상업 교차로와 신궁 숲의 대비 |
| `tokyo-d4` | Metropolitan Government → Ueno | 0.70 | 1,578 | `[391,178]` / `central-east` | 도심 서쪽에서 우에노 권역으로 넘어온 뒤 만나는 고가·상점가 주변 |
| `tokyo-d5` | Ueno → Sensoji | 0.50 | 1,789 | `[561,141]` / `central-east` | 우에노에서 아사쿠사로 잇는 동부 생활권 — 시장·도구상가가 이어지는 길목 |
| `tokyo-d6` | Sensoji → Skytree | 0.50 | 1,896 | `[660,145]` / `central-east` | 아사쿠사에서 스미다강을 건너는 전환점 — 낮은 시가지 너머 전파탑이 가까워지는 구간 |
| `tokyo-d7` | Skytree → Tokyo Station | 0.58 | 2,157 | `[540,238]` / `central-east` | 동부 전파탑 권역에서 간다·마루노우치로 복귀하는 도심 종축 |
| `tokyo-d8` | Tokyo Station → Odaiba | 0.55 | 2,538 | `[450,517]` / `south-bay` | 마루노우치에서 항만 수변으로 내려가는 구간 — 도심 정원·매립지·교량 경관의 전환 |

발견점이 open이라고 해서 그 discovery의 전체 leg가 open인 것은 아니다. 특히 d1·d2·d4는
발견 tile 자체는 PASS지만 앞뒤 leg에 위 표의 locked 이탈 구간이 남는다.

## 결정성

독립 Node 프로세스 A/B의 pretty audit JSON은 각각 59,350 bytes로 byte-identical이었다.

- audit stdout SHA-256 A/B:
  `2f0970f65b3866dbeb4924d2582c5e6c9dbe0c3d504c664b85dc238295d44da1`
- canonical payload SHA-256:
  `b09b32a267735598aa21a312ed8ecba6ca4bb8210241bd2d410721f280051c0f`
- 전체 joined path SHA-256:
  `e19a2a4417e71154a74d50e57e2d592e4dfc7c2f33fcf53e0104916cea9f9a39`
- max RSS A/B: 109,184 / 102,144 KiB
- 측정 입력 5파일 manifest SHA-256:
  `d0a71ff73c2e5360db96f68efe87f777de1438e7d4c092e5ab093f72df007f7a`

| 입력 | Git blob |
|---|---|
| `src/components/world/cityMainRoute.js` | `a4f9067c1e13cc0e22b651e886dfb044eebb7016` |
| `src/components/world/cityDistricts.js` | `2c3a8257fec829469fed70ac6ea1103bcf0d701a` |
| `src/components/world/cities/terrain.js` | `0904ae65b2126d7e8aee883f3e070e0395c20b62` |
| `src/components/world/cities/tokyo.js` | `14ad323a9073716c104330be0ac93f1656a8372a` |
| `src/components/world/cities/tokyo.geo.js` | `e358f90c11bc86add9559cd7c23abd31c642d446` |

manifest는 위 표의 `path<TAB>blob<LF>`를 표시 순서대로 이어 SHA-256 한 값이다.

## 재현 방법

도시 파일은 수정하지 않고 `TOKYO`를 펼친 임시 객체에 위 후보 `mainRoute`만 주입했다.

```js
const city = { ...TOKYO, mainRoute: candidate };
const grid = city.buildGrid();
const districts = resolveCityDistricts(city, grid);
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
little-endian uint32 인코딩으로 SHA-256 했다. open component는 동일 open·walkable·non-EXIT
조건과 URDL 이웃으로 전수 BFS 했다.

## 회귀 검증

- targeted mainRoute·district·Tokyo geo:
  **5 files / 66 tests PASS / 23.29s**
- `cityDistrictBoundarySigns.test.js` 단독 재현:
  **1 file / 5 tests PASS / 3.23s**(해당 전수 테스트 2.26s)
- 최종 `set -o pipefail; npx vitest run --no-file-parallelism`:
  **229 files / 2,242 tests PASS / 329.79s / exit 0**
- `npm run lint`, `git diff --check`: PASS
- 변경 파일: `docs/proposal-tokyo-mainroute.md` 1개; 도시 wrapper·geo·district rect·runtime·
  registry·verifier·DB·카피·테스트 byte 불변

첫 full run에서는 `cityDistrictBoundarySigns.test.js`의 24도시 전수 1건이 5초 timeout
(228 files / 2,241 tests PASS, 1 timeout)으로 끝났다. 같은 파일의 즉시 단독 실행은 위와 같이
2.26초에 통과했고, 제품·테스트 파일을 수정하지 않은 최종 full rerun은 2,242/2,242 green이다.

## 인계

- **권고 1:** 단일 보행 mainRoute를 유지하려면 `haneda↔south-bay`,
  `south-bay↔yamanote-west`, `yamanote-west↔central-east`의 승인된 open 회랑이
  먼저 필요하다. 본 문서는 rect 좌표를 임의 제안하거나 도시 파일을 바꾸지 않는다.
- **권고 2:** 현재 open 지구를 유지하려면 하네다 access·야마노테 교통을 명시하는
  multi-stage route 계약이 필요하다. 이는 현 `node|station` 연속 BFS 스키마의 범위를
  넘으므로 Claude 결정 사항이다.
- 어느 선택이든 이 문서의 waypoint 순서와 discovery 맥락은 후보 자료로 재사용할 수 있지만,
  세 실패 leg의 RLE·SHA는 최종값으로 간주하면 안 된다.
