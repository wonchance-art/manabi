# 서울 mainRoute 주동선 후보 실측

- 상태: **report-only / 조건부 NO-GO** — 도시 wrapper·geo·district rect·
  `cityMainRoute.js`·CityScene·registry·verifier·DB·카피·테스트 변경 없음
- 측정 기준: `origin/main` `1f9b30897c7712e836f79117ce4db5d10867bfdd`
  (#498/T22·#499 merge 포함)
- 선례 계약: 리옹·보르도·스트라스부르 `MAIN_ROUTE`의 `version=1`,
  `cardinal-bfs-v1`, `URDL`, `excludeExit=true`, typed `node|station` waypoint,
  little-endian uint32 path SHA-256
- 후보 ID: `seoul-classic-loop-candidate-a`(승인 전 예약 아님)
- 측정 환경: 2026-07-23, official nvm Node `v22.23.1`

## 판정

1. 후보 A는 서울역→홍대→여의도→강남역→코엑스→롯데월드타워→서울숲→
   동대문디자인플라자→경복궁→숭례문의 **10 waypoint / 9 leg**다.
   waypoint 10/10은 기존 typed ref로 exact-1 해석되고, open 지구 안의 보행 가능·비EXIT
   실측 타일이다. `historic-core`, `west`, `southeast`, `river-north` 네 지구를
   waypoint 기준으로 모두 방문한다. 종점 숭례문은 기점 서울역에서 51 steps 떨어져
   반복 waypoint 없이 진입점 가까이 돌아오는 한 바퀴 형태다.
2. 전체 도시 보행망의 URDL BFS에서는 9/9 leg가 도달한다. 경로는 **2,609 steps /
   2,610 tiles / 게임-grid 52.18km**, 전 타일 보행 가능, 차단 0, EXIT 0이다.
3. 그러나 현 open union의 route 관련 보행 성분은 서로 끊겨 있다.
   서울역·서울숲·동대문·경복궁·숭례문은 component 0(55,565타일),
   홍대·여의도는 component 2(28,001타일), 강남·코엑스는 component 8(21,526타일),
   롯데월드타워는 component 7(3,306타일)이다. 따라서 네 지구를 잇는
   **연속 open-only cardinal BFS는 현재 계약상 존재하지 않는다.**
4. 후보 A의 2,610타일 중 open은 1,610, locked는 1,000이다. 실패는
   서울역→홍대 85타일, 여의도→강남역 405타일, 코엑스→롯데월드타워 123타일,
   롯데월드타워→서울숲 387타일의 네 연결부에 정확히 한정된다. 나머지 5/9 leg는
   open-only PASS다.
5. `resolveCityDistricts(city, grid, resolvedMainRoute)`는 main route 전 타일에
   `assertOpen`을 적용하므로, 아래 RLE를 현재 `seoul.js`에 그대로 배선하면 fail-closed
   오류가 난다. Claude가 (a) 네 open 회랑을 승인하거나 (b) 도시철도 이동을 표현할 별도
   route 계약으로 분할하기 전에는 **통합 금지**다. 연결 정책이 바뀌면 RLE·SHA도 다시
   산출해야 한다.

거리(m)는 도시 geo의 20m/tile 게임-grid 환산값이며 실제 관광 보행거리 측량치가 아니다.

## 후보 계약

```js
{
  id: 'seoul-classic-loop-candidate-a',
  version: 1,
  routing: {
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  },
  segmentHints: [{
    from: { kind: 'node', id: 'seoul-forest' },
    to: { kind: 'node', id: 'ddp' },
    viaTiles: [[995, 791]],
  }],
  branches: [],
}
```

서울숲→동대문 무힌트 최단경로는 261 steps지만 `river-north`의 북쪽 경계를 먼저 넘어
locked 타일 123개(`[1091,790]`→`[996,763]`)로 벗어난다. 위 보행·open hint를 적용한
동일 261-step 경로는 `[995,791]`까지 한강 북안 rect 안에서 서진한 뒤
`historic-core`로 진입해 open-only PASS다. 비용 증가는 0 steps이며 다른 8개 leg에는
hint가 없다.

## waypoint 실측표

| # | typed key | 이름 | tile | open 지구 | terrain | 판정 |
|---:|---|---|---:|---|---|---|
| 1 | `station:seoul` | 서울역 | `[797,753]` | `historic-core` | ROAD(0) | open·walkable·non-EXIT |
| 2 | `node:hongdae` | 홍대거리 | `[589,739]` | `west` | ROAD(0) | open·walkable·non-EXIT |
| 3 | `node:yeouido-63` | 63스퀘어 | `[663,947]` | `west` | PLAZA(3) | open·walkable·non-EXIT |
| 4 | `station:gangnam` | 강남역 | `[1048,1069]` | `southeast` | ROAD(0) | open·walkable·non-EXIT |
| 5 | `node:coex` | 코엑스 | `[1185,993]` | `southeast` | PLAZA(3) | open·walkable·non-EXIT |
| 6 | `node:lotte-world-tower` | 롯데월드타워 | `[1378,987]` | `southeast` | PLAZA(3) | open·walkable·non-EXIT |
| 7 | `node:seoul-forest` | 서울숲 | `[1091,811]` | `river-north` | SIDEWALK(1) | open·walkable·non-EXIT |
| 8 | `node:ddp` | 동대문디자인플라자 | `[968,685]` | `historic-core` | PLAZA(3) | open·walkable·non-EXIT |
| 9 | `node:gyeongbokgung` | 경복궁 | `[825,615]` | `historic-core` | PLAZA(3) | open·walkable·non-EXIT |
| 10 | `node:sungnyemun` | 숭례문 | `[818,723]` | `historic-core` | ROAD(0) | open·walkable·non-EXIT |

## leg별 BFS·open 검증

`open/locked`는 각 leg 자체의 endpoint 포함 tileCount 기준이다. 합계 행은 leg 접합점의
중복 waypoint 8개를 한 번만 센 전체 path 기준이다.

| # | from → to | steps / tiles | RLE runs | open / locked | blocked / EXIT | open-only | path SHA-256 |
|---:|---|---:|---:|---:|---:|---|---|
| 1 | 서울역 → 홍대 | 230 / 231 | 24 | 146 / **85** | 0 / 0 | **FAIL** | `bff35912705a2b58e513807c1d47c17639a0c2b795b68f65978ca4ca11cd3aaa` |
| 2 | 홍대 → 여의도 | 328 / 329 | 159 | 329 / 0 | 0 / 0 | PASS | `7ff38237d097f2823248a834d30aef104e4e4a7f1d1dec03c9e4d6ebde54db25` |
| 3 | 여의도 → 강남역 | 527 / 528 | 184 | 123 / **405** | 0 / 0 | **FAIL** | `d6d6dc93ed2e8fd69badaa41af5cbb0ffcac9783687feca4dde70a4b2dcc9694` |
| 4 | 강남역 → 코엑스 | 213 / 214 | 48 | 214 / 0 | 0 / 0 | PASS | `0e214c6fe9bb94cc47fd2c065a29a6ce7df3efd6b658e429dc58cb61704bacc3` |
| 5 | 코엑스 → 롯데월드타워 | 245 / 246 | 60 | 123 / **123** | 0 / 0 | **FAIL** | `b0d2d8102fb7c945cdca22e391fc640a6b9601c43097a78494c6c0b93310e0af` |
| 6 | 롯데월드타워 → 서울숲 | 467 / 468 | 134 | 81 / **387** | 0 / 0 | **FAIL** | `7d412f9d3d44ff94a831c5a75f4f1d0ed99ae2f723ec2258283ec5a0a5ecae60` |
| 7 | 서울숲 → 동대문 | 261 / 262 | 30 | 262 / 0 | 0 / 0 | PASS | `bf773fc37ff4819bac7e509677227b2f4ea40ca628fab62a90e066f1b55655e3` |
| 8 | 동대문 → 경복궁 | 215 / 216 | 24 | 216 / 0 | 0 / 0 | PASS | `fd505512164b54c5425a3fced71b561755b0f43ad06538712a2f62cbbef61086` |
| 9 | 경복궁 → 숭례문 | 123 / 124 | 20 | 124 / 0 | 0 / 0 | PASS | `6d379b9d2f4e0babe47ab3f29eae9979ae0a29eb7ee85daa005b8e0047c866a2` |
| **합계** | 9/9 walkable reachable | **2,609 / 2,610** | **683** | **1,610 / 1,000** | **0 / 0** | **5/9 PASS** | `c978ab6133b039728823e4c79a60f8659c7659bd66413191a0b9ab3d05a73b00` |

### open 이탈 구간

| leg | segment offset | 첫 locked tile → 마지막 locked tile | locked tiles |
|---|---:|---|---:|
| 서울역 → 홍대 | 26..110 | `[779,745]` → `[701,741]` | 85 |
| 여의도 → 강남역 | 60..464 | `[701,963]` → `[1019,1035]` | 405 |
| 코엑스 → 롯데월드타워 | 72..194 | `[1231,999]` → `[1339,985]` | 123 |
| 롯데월드타워 → 서울숲 | 47..433 | `[1373,949]` → `[1121,815]` | 387 |

각 실패 leg의 양 endpoint는 서로 다른 open 보행 component에 있으므로 단순 tie-break 변경이나
추가 `viaTiles`만으로는 해결되지 않는다.

## stepsRle 전문

아래 compact 표기는 저장 객체의 순서를 빠짐없이 적은 것이다. 예를 들어 `U5`는
`{ direction: 'U', count: 5 }`이며 생략 부호는 없다.

### 1. `station:seoul--node:hongdae`

```text
U8 L34 U2 L9 U1 L1 U1 L3 U1 L16 D1 L52 U1 L20 D1 L4 D1 L25 D1 L36 U1 L3 U3 L5
```

### 2. `node:hongdae--node:yeouido-63`

```text
R5 D3 R3 D1 R1 D24 R1 D19 R3 D5 R4 D5 R1 D3 R1 D9 R1 D3 R2 D15 L1 D2 L1 D2 L1 D6 L2 D1 L2 D2 L1 D3 L1 D1 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D2 L1 D1 L1 D3 R3 D1 R3 D1 R2 D1 R3 D1 R2 D1 R2 D1 R2 D1 R2 D1 R2 D1 R2 D1 R2 D1 R2 D1 R1 D1 R2 D1 R2 D1 R1 D1 R5 D3 R1 D1 R1 D1 R2 D1 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R2 D1 R1 D2 R1 D1 R1 D1 R1 D2 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R2 D2 R1 D1 R1 D1 R1 D1 R1 D1 R1 D1 R3 D24 R1
```

### 3. `node:yeouido-63--station:gangnam`

```text
L1 U2 R8 D15 R27 D1 R2 D1 R1 D1 R2 D1 R2 D1 R1 D1 R2 D1 R2 D1 R2 D1 R2 D1 R3 D1 R3 D1 R4 D1 R3 D1 R2 D1 R3 D1 R2 D1 R4 D2 R3 D1 R2 D1 R2 D1 R1 D1 R2 D1 R2 D1 R2 D1 R1 D1 R2 D1 R1 D1 R1 D1 R2 D1 R2 D1 R1 D1 R2 D1 R1 D1 R1 D1 R1 D1 R2 D1 R1 D1 R2 D1 R2 D1 R1 D1 R2 D1 R2 D1 R1 D1 R2 D1 R2 D1 R2 D1 R2 D1 R2 D1 R3 D1 R2 D1 R3 D1 R1 D1 R2 D1 R2 D1 R2 D1 R1 D1 R1 D1 R1 D1 R1 D1 R3 D1 R12 D1 R2 D1 R2 D1 R1 D2 R1 D1 R63 D2 R2 D2 R7 D1 R2 D2 R3 D2 R2 U1 R14 D1 R24 D1 R4 U3 R4 U2 R8 U1 R49 D2 R7 D1 R2 D2 R12 D2 R7 D1 R2 D7 R1 D3 R1 D2 R1 D3 R1 D3 R1 D2 R1 D3 R1 D6
```

### 4. `station:gangnam--node:coex`

```text
U5 R2 U2 R1 U2 R1 U2 R2 U5 R1 U5 R1 U13 R1 U23 R24 U1 R3 U1 R2 U1 R8 U2 R5 U1 R3 U1 R5 U1 R3 U1 R1 U1 R14 U1 R34 U1 R7 U2 R5 U1 R3 U1 R3 U1 R2 U2 R6
```

### 5. `node:coex--node:lotte-world-tower`

```text
L3 D5 R2 D4 R2 U1 R4 U1 R2 U1 R2 U1 R2 U1 R10 U1 R5 D2 R16 D2 R2 U1 R3 U2 R2 U1 R2 U1 R11 U1 R1 U1 R1 U1 R19 U1 R1 U1 R19 U1 R11 U1 R3 U1 R25 U1 R10 U1 R9 U1 R16 U1 R2 U1 R16 D3 L1 D1 L1 D1
```

### 6. `node:lotte-world-tower--node:seoul-forest`

```text
U2 R1 U1 R1 U6 L2 U3 L3 U14 L2 U12 L1 U2 L1 U6 L28 U1 L1 U2 L1 U1 L1 U2 L1 U2 L1 U1 L1 U2 L1 U2 L1 U1 L1 U2 L1 U1 L1 U2 L1 U2 L1 U1 L1 U2 L1 U2 L1 U1 L1 U2 L1 U2 L1 U1 L1 U2 L1 U1 L1 U2 L1 U27 L1 U17 L1 U6 L1 U1 L26 U1 L3 U1 L2 U1 L1 U1 L1 U3 L9 U5 L3 U1 L6 U1 L19 U2 L16 U1 L3 U1 L2 U1 L2 U1 L22 U1 L6 U1 L2 U1 L1 U1 L4 U1 L1 U1 L5 U2 L3 U1 L1 U1 L34 U1 L1 U2 L4 U1 L1 U1 L3 U1 L11 U2 L5 U1 L21 U1 L2 U1 L2 U1 L4
```

### 7. `node:seoul-forest--node:ddp`

```text
U6 L23 U1 L2 U1 L2 U6 L2 U1 L5 U1 L10 U4 L52 U15 L1 U13 L21 U1 L9 U34 R1 U2 R1 U35 L1 U2 L1 U4 R4
```

### 8. `node:ddp--node:gyeongbokgung`

```text
L7 U1 L7 D1 L4 U1 L1 U2 L9 U3 L8 U1 L13 U1 L1 U9 L87 U48 L3 U3 L2 U1 L1 U1
```

### 9. `node:gyeongbokgung--node:sungnyemun`

```text
D1 R1 D1 R2 D8 R1 D20 L1 D8 L1 D46 L1 D4 L1 D11 L1 D8 L3 D1 L3
```

## discovery 스팟 후보 8곳

`context`는 카피가 아니라 Claude 저작용 주변 맥락 제안이다. `at`은 해당 leg의
`start + round(at * stepCount)`(양 endpoint 제외 clamp) 규칙으로 재투영했다.
8곳 모두 open·walkable·non-EXIT다.

| ID | leg | at | routeIndex | 실측 tile / 지구 | 주변 맥락 제안 |
|---|---|---:|---:|---|---|
| `seoul-d1` | 서울역 → 홍대 | 0.50 | 115 | `[696,741]` / `west` | 서울역 서쪽에서 마포·홍대 생활권으로 접어든 직후 — 도심 관문에서 서부 청년 문화권으로 바뀌는 구간 |
| `seoul-d2` | 홍대 → 여의도 | 0.55 | 410 | `[591,871]` / `west` | 홍대 남쪽에서 한강·여의도권으로 내려가는 생활축 — 대학가와 업무·수변 지구의 전환 |
| `seoul-d3` | 여의도 → 강남역 | 0.08 | 600 | `[686,960]` / `west` | 여의도 남동 끝자락 — 서남권 open 회랑을 벗어나 강남 방향 장거리 이동을 앞둔 구간 |
| `seoul-d4` | 강남역 → 코엑스 | 0.55 | 1,202 | `[1102,1006]` / `southeast` | 강남역에서 삼성동으로 이어지는 동서 업무축 — 대로와 지하철 환승권이 겹치는 구간 |
| `seoul-d5` | 코엑스 → 롯데월드타워 | 0.88 | 1,514 | `[1360,984]` / `southeast` | 잠실권 open rect 진입 뒤 — 동부 대로에서 석촌호수 주변 고층 경관으로 바뀌는 구간 |
| `seoul-d6` | 롯데월드타워 → 서울숲 | 0.95 | 1,987 | `[1111,814]` / `river-north` | 잠실에서 북서로 돌아 서울숲에 닿기 직전 — 강남권에서 성수·한강 북안으로 전환 |
| `seoul-d7` | 서울숲 → 동대문 | 0.55 | 2,154 | `[994,764]` / `historic-core` | 서울숲에서 사대문 안으로 복귀하는 경계 — 성수 생활권에서 동대문 도심축으로 접어드는 구간 |
| `seoul-d8` | 동대문 → 경복궁 | 0.55 | 2,389 | `[869,668]` / `historic-core` | 동대문에서 경복궁으로 잇는 종로·청계천권 — 상업 도심과 궁궐축이 만나는 구간 |

발견점이 open이라고 해서 그 discovery의 전체 leg가 open인 것은 아니다. 특히 d1·d3·d5·d6은
발견 tile 자체는 PASS지만 앞뒤 leg에 위 표의 locked 이탈 구간이 남는다.

## 결정성

독립 Node 프로세스 A/B의 pretty audit JSON은 각각 16,684 bytes로 byte-identical이었다.

- audit stdout SHA-256 A/B:
  `56c833334a3718c521e9dc6f039d386fd7e4b5e4ac0c69e8bfdb4a842ca6cfb4`
- canonical payload SHA-256:
  `332bd2fc5bf003556cdccd707c02b5dbb8044acabc900e67fb03ba64befd13bc`
- 전체 joined path SHA-256:
  `c978ab6133b039728823e4c79a60f8659c7659bd66413191a0b9ab3d05a73b00`
- max RSS A/B: 385,152 / 382,848 KiB
- 측정 입력 5파일 manifest SHA-256:
  `18cabf0cd02efc2aad51108d3bfd17f107c96dfd54ec0631708631a80eb521c5`

| 입력 | Git blob |
|---|---|
| `src/components/world/cityMainRoute.js` | `a4f9067c1e13cc0e22b651e886dfb044eebb7016` |
| `src/components/world/cityDistricts.js` | `2c3a8257fec829469fed70ac6ea1103bcf0d701a` |
| `src/components/world/cities/terrain.js` | `0904ae65b2126d7e8aee883f3e070e0395c20b62` |
| `src/components/world/cities/seoul.js` | `abedaad8910170c925bc8c944966dfe5d24c403e` |
| `src/components/world/cities/seoul.geo.js` | `c9a6dc6bbf3437f164c7126c275fd5502560fa6b` |

manifest는 위 표의 `path<TAB>blob<LF>`를 표시 순서대로 이어 SHA-256 한 값이다.

## 재현 방법

도시 파일은 수정하지 않고 `SEOUL`을 펼친 임시 객체에 위 후보 `mainRoute`만 주입했다.

```js
const city = { ...SEOUL, mainRoute: candidate };
const grid = city.buildGrid();
const districts = resolveCityDistricts(SEOUL, grid);
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

- targeted mainRoute·district·Seoul geo:
  **5 files / 62 tests PASS / 69.57s**
- 최종 `set -o pipefail; npx vitest run --no-file-parallelism`:
  **229 files / 2,243 tests PASS / 275.23s / exit 0**
- `npm run lint`, `git diff --check`: PASS
- 변경 파일: `docs/proposal-seoul-mainroute.md` 1개; 도시 wrapper·geo·district rect·runtime·
  registry·verifier·DB·카피·테스트 byte 불변

## 인계

- **권고 1:** 단일 보행 mainRoute를 유지하려면 `historic-core↔west`,
  `west↔southeast`, `southeast`의 강남·삼성 rect↔잠실 rect,
  `southeast↔river-north`의 승인된 open 회랑이 먼저 필요하다.
- **권고 2:** 현재 open 지구를 유지하려면 기존 2호선 축 등 도시철도 이동을 명시하는
  multi-stage route 계약이 필요하다. 이는 현 `node|station` 연속 BFS 스키마의 범위를
  넘으므로 Claude 결정 사항이다.
- 어느 선택이든 이 문서의 waypoint 순서와 discovery 맥락은 후보 자료로 재사용할 수 있지만,
  네 실패 leg의 RLE·SHA는 최종값으로 간주하면 안 된다.
