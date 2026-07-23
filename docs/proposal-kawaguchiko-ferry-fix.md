# 가와구치코 ferry wrapper 복구 명세 — T12 재실측 준비

- 상태: **report-only / Claude 도시 배선 입력** — runtime·도시 wrapper/geo·registry·verifier·DB 구현 없음
- publication/measurement base: `origin/main`
  `48772316f331114e2d32ec28899c55ecdea16317`
- 선행: T10 #450의 가와구치코 source blocker, T11 #453 완료 뒤 T12 세션 지시
- 측정일: 2026-07-23

## 결론

1. `KAWAGUCHIKO_GEO`는 선착장 객체를 top-level `transitPoints`에 정상 수출한다.
   `funatsu-pier [148,240]`, `oishi-landing [62,164]` 두 점 모두 존재하고
   T10 후보 `lake-north [30,130,160,250]` 안에 있다.
2. wrapper만 존재하지 않는 top-level `KAWAGUCHIKO_GEO.ferryLinks`를 읽는다.
   optional fallback `|| []`가 스키마 오류를 숨겨 runtime `TRANSIT_POINTS`에는 수기 버스
   정류장 2개만 남고, `kawaguchiko-cruise`의 두 `stopIds`가 exact-1 0건으로 해석된다.
3. 최소 수정은 `src/components/world/cities/kawaguchiko.js`의 map source를
   `KAWAGUCHIKO_GEO.transitPoints`로 바꾸고 바로 위 주석의 필드명도 고치는 것이다.
   geo·`TRANSIT.stopIds`·T10 rect·공유 resolver는 바꾸지 않는다.
4. 이 diff를 메모리 안에서만 투영한 재실측은 가와구치코 raw/resolved TRANSIT
   `5/7 → 7/7`, runtime transitPoints `2/2 → 4/4`, resolver `FAIL → PASS`다.
   T10 14도시 합계는 raw/resolved `75/77 → 77/77`, runtime transitPoints
   `14/14 → 16/16`, resolver `13/14 → 14/14`가 되어야 한다.
5. 레만호·제네바·시드니·브리즈번은 모두 top-level `geo.transitPoints`를 wrapper 정류장
   객체로 소비한다. `meta.connectivity.ferryLinks`는 노선 연결 메타데이터일 뿐 정류장
   배열이 아니다.

## 1. 현행 스키마와 실패 경로

### geo의 두 층

| 위치 | 실제 모양 | 역할 | wrapper 입력 여부 |
|---|---|---|---|
| `KAWAGUCHIKO_GEO.transitPoints` | 정류장 객체 2개: `id`, 현지명, 좌표, `tile`, `routeIds` | runtime stop 객체의 정본 | **예** |
| `KAWAGUCHIKO_GEO.meta.connectivity.ferryLinks` | `{ id, mode, stopIds }` 1개 | geo BFS에서 수면 너머 연결을 선언하는 메타데이터 | 아니요 |
| `KAWAGUCHIKO_GEO.ferryLinks` | `undefined` | 필드 없음 | 아니요 |

geo 정본은 다음과 같다.

| id | tile | routeIds | T10 rect 포함 |
|---|---:|---|---|
| `funatsu-pier` | `[148,240]` | `lake-kawaguchi-cruise` | `lake-north`, 예 |
| `oishi-landing` | `[62,164]` | `lake-kawaguchi-cruise` | `lake-north`, 예 |

`meta.connectivity.ferryLinks[0].stopIds`도 위 두 id를 같은 순서로 가리키지만, 이 원소에는
`tile`이나 이름 필드가 없다. 따라서 이를 `TRANSIT_POINTS`로 map하는 대안도 틀리다.

### wrapper의 현행 결과

현행 `TRANSIT_POINTS`의 첫 spread는 빈 배열이 되고 수기 버스 정류장만 남는다.

```text
geo transitPoints:
  funatsu-pier, oishi-landing

runtime transitPoints:
  kawaguchiko-bus-stop, subaru-5th-stop

TRANSIT stopIds unique 7개:
  역 3개 exact-1 + 유람선 2개 exact-0 + 버스 2개 exact-1
```

`resolveCityDistricts()`는 `stations + transitPoints`에서 각 stop id가 정확히 한 번
해석되어야 한다. 첫 누락 id에서
`districts: transit arrival funatsu-pier must resolve exact-1`로 fail-closed하는 것이
T10의 정확한 실패 경로다. rect나 보행 타일 문제는 아니다.

## 2. 다른 도시의 정합 선례

| 도시 | geo stop 수 | wrapper source | runtime stop 수 | 판정 |
|---|---:|---|---:|---|
| 레만호 연안 | 5 | `LEMAN_RIVIERA_GEO.transitPoints.map(...)` | 5 | 정합 |
| 제네바 | 2 | `GENEVA_GEO.transitPoints.map(...)` | 2 | 정합 |
| 시드니 | 4 | `(SYDNEY_GEO.transitPoints || []).map(...)` | 4 | 정합 |
| 브리즈번 | 2 | `(BRISBANE_GEO.transitPoints || []).map(...)` | 2 | 정합 |
| 가와구치코 | 2 | `(KAWAGUCHIKO_GEO.ferryLinks || []).map(...)` | 0 + 수기 버스 2 | **불일치** |

레만호·제네바는 geo 계약이 필수라는 점을 직접 `.map`으로 fail-fast한다. 시드니·브리즈번의
optional guard도 배열 이름은 동일하게 `transitPoints`다. 가와구치코 geo는 이 필드를 항상
수출하고 geo 테스트도 두 id를 고정하므로, 레만호형 직접 `.map`이 가장 작은 정합 수정이다.

참고로 마르세유 wrapper도 `(MARSEILLE_GEO.ferryLinks || [])`를 읽어 geo 선착장 4개가
runtime에서 0개가 되는 같은 잠복 결함이 있다. T10은 마르세유를 열거·측정하지 않았고 이번
지시는 가와구치코 단일 수정 명세이므로 아래 diff에 섞지 않는다. 별도 source-fix 항목으로
발주·재실측해야 한다.

## 3. Claude 구현용 exact diff

대상은 `src/components/world/cities/kawaguchiko.js` 한 파일의 두 줄이다.

```diff
-// 유람선 선착장(geo ferryLinks) + 등산 버스 정류장 2종(5합목 분리 성분 연결 — 실측 배치).
+// 유람선 선착장(geo transitPoints) + 등산 버스 정류장 2종(5합목 분리 성분 연결 — 실측 배치).
 export const TRANSIT_POINTS = [
-  ...(KAWAGUCHIKO_GEO.ferryLinks || []).map((point) => ({
+  ...KAWAGUCHIKO_GEO.transitPoints.map((point) => ({
     id: point.id,
     nameJa: point.nameJa,
     yomi: point.yomi || '',
     contentLocale: point.contentLocale,
     tile: [point.tile[0], point.tile[1]],
```

### 수정 후 불변 조건

- runtime `TRANSIT_POINTS.map(({ id }) => id)` 순서는 정확히
  `funatsu-pier`, `oishi-landing`, `kawaguchiko-bus-stop`, `subaru-5th-stop`이다.
- 네 id는 각각 exact-1이고 중복이 없다.
- geo 선착장의 `nameJa`, `yomi`, `contentLocale`, 복제한 `tile`을 현행 wrapper 모양 그대로
  보존한다.
- 수기 버스 두 객체와 `TRANSIT` 세 노선의 `stopIds`, 시간, 운행 창은 byte 불변이다.
- `kawaguchiko.geo.js`, `cityDistricts.js`, registry, verifier, T10 rect는 수정하지 않는다.
- `KAWAGUCHIKO_GEO.meta.connectivity.ferryLinks`를 runtime stop 배열로 소비하지 않는다.

## 4. 현행과 exact-diff 투영 실측

production 파일을 수정하지 않고 위 diff의 결과만 메모리 안에서 구성해 T10 가와구치코
payload와 동일한 4지구/5 rect를 통과시켰다.

| gate | 현행 | exact-diff 투영 | 수정 후 기대 |
|---|---:|---:|---|
| runtime transitPoints 열린 수 | 2/2 | 4/4 | **4/4** |
| TRANSIT raw exact-1 + open | 5/7 | 7/7 | **7/7** |
| TRANSIT resolved arrival open | 5/7 | 7/7 | **7/7** |
| unknown/non-exact stop id | 2 | 0 | **0** |
| spawn | 1/1 | 1/1 | **1/1** |
| EXIT | 2/2 | 2/2 | **2/2** |
| 문·story gate | 5/5 | 5/5 | **5/5** |
| `returnNode` | 1/1 | 1/1 | **1/1** |
| nodes / props / stations | 15/15 · 3/3 · 3/3 | 동일 | **동일** |
| 실제 `resolveCityDistricts()` | FAIL | PASS | **PASS** |

T10 전체 합계의 기대 변화는 다음뿐이다.

| T10 14도시 합계 | 수정 전 | 수정 후 기대 |
|---|---:|---:|
| TRANSIT raw | 75/77 | **77/77** |
| TRANSIT resolved | 75/77 | **77/77** |
| runtime transitPoints open | 14/14 | **16/16** |
| resolver | 13/14 | **14/14** |
| nodes / props / stations | 220/220 · 46/46 · 58/58 | **불변** |
| spawn / EXIT / 문·gate / returnNode | 14/14 · 28/28 · 45/45 · 14/14 | **불변** |

### 결정성 증거

입력은 가와구치코 wrapper/geo, `cityDistricts.js`, `terrain.js`와 비교 wrapper 5개
(브리즈번·제네바·레만호·시드니·마르세유) 총 9파일이다. 파일별 bytes·SHA-256 canonical
목록의 manifest SHA-256은
`e1ab6dceaef02dd53d2c3b53e932dbdc8698d98a389f0c5846cc24a6ada12a2e`다.

one-shot은 source shape, 현행 실패, exact diff의 메모리 투영 결과와 입력 manifest를
canonical JSON 한 줄로 직렬화했다. 임시 측정기는 산출물에 포함하지 않는다.

- canonical JSON: 2,711 bytes
- run A SHA-256:
  `c5fb684a527c1d2d29978a54f7328801079db12903febf4e7d42aa332cbed2e2`
- run B: byte-identical, 같은 SHA-256
- Node `v22.23.1` (`nvm` 공식 배포판)
- one-shot `process.resourceUsage().maxRSS`: run A 78,880 KiB, run B 77,552 KiB
- targeted: 2 files / 30 tests PASS, Vitest duration 13.99s
- full single-worker: 218 files / 2,176 tests PASS, Vitest duration 366.63s
- `npm run lint` PASS
- `git diff --check` PASS

## 5. Claude 수정 후 T10 gate 재실측

리포 루트에서 Node 22 공식 배포판으로 아래 블록을 그대로 실행한다. 첫
`resolveCityDistricts()`가 통과해야만 JSON을 출력하므로 현행 source에서는 의도대로
fail-fast하고, 위 exact diff 뒤에는 두 실행이 같은 바이트여야 한다.

```bash
source /Users/chaeyeonwon/.nvm/nvm.sh
nvm use 22 >/dev/null

run_kawaguchiko_ferry_gate() {
  node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import {
  KAWAGUCHIKO,
} from './src/components/world/cities/kawaguchiko.js';
import {
  KAWAGUCHIKO_GEO,
} from './src/components/world/cities/kawaguchiko.geo.js';
import {
  cityDistrictOpenAt,
  resolveCityDistricts,
} from './src/components/world/cityDistricts.js';
import {
  CITY_TILE,
  resolveArrivalTile,
} from './src/components/world/cities/terrain.js';

const districts = {
  version: 'district-v1',
  open: [
    { id: 'lake-north', label: 'lake-north', tiles: { rects: [[30, 130, 160, 250]] } },
    { id: 'station-onsen', label: 'station-onsen', tiles: { rects: [[150, 251, 230, 310]] } },
    { id: 'arakura-yoshida', label: 'arakura-yoshida', tiles: { rects: [[290, 240, 400, 420]] } },
    {
      id: 'oshino-fifth-station',
      label: 'oshino-fifth-station',
      tiles: { rects: [[520, 480, 566, 520], [25, 845, 45, 862]] },
    },
  ],
  locked: { style: 'guidebook', line: 'gate-only' },
};

const city = { ...KAWAGUCHIKO, districts };
const grid = city.buildGrid();
const resolved = resolveCityDistricts(city, grid);
const open = (tile) => cityDistrictOpenAt(resolved, tile[0], tile[1]);
const stopIds = [...new Set(city.transit.flatMap((line) => line.stopIds))];
const stops = [...city.stations, ...city.transitPoints];
const stopRows = stopIds.map((id) => {
  const matches = stops.filter((stop) => stop.id === id);
  const tile = matches.length === 1 ? matches[0].tile : null;
  const arrival = tile == null ? null : resolveArrivalTile(grid, city.cols, city.rows, tile);
  return {
    id,
    exact: matches.length,
    rawOpen: tile != null && open(tile),
    resolvedOpen: arrival != null && open(arrival),
  };
});
const exits = [];
for (let index = 0; index < grid.length; index += 1) {
  if (grid[index] === CITY_TILE.EXIT) {
    exits.push([index % city.cols, Math.floor(index / city.cols)]);
  }
}
const requiredNodes = city.nodes.filter((node) => (
  node?.npc || node?.gate || node?.chapter || node?.reading
));
const ratio = (items, predicate) => (
  `${items.filter(predicate).length}/${items.length}`
);

const result = {
  schema: 't10-kawaguchiko-ferry-post-fix-v1',
  geoTransitPointIds: KAWAGUCHIKO_GEO.transitPoints.map(({ id }) => id),
  runtimeTransitPointIds: city.transitPoints.map(({ id }) => id),
  unknownStopIds: stopRows.filter(({ exact }) => exact !== 1).map(({ id }) => id),
  transitRaw: ratio(stopRows, ({ exact, rawOpen }) => exact === 1 && rawOpen),
  transitResolved: ratio(
    stopRows,
    ({ exact, resolvedOpen }) => exact === 1 && resolvedOpen,
  ),
  spawn: open([city.entrance.x, city.entrance.y]) ? '1/1' : '0/1',
  exits: ratio(exits, open),
  requiredNodes: ratio(requiredNodes, (node) => open(node.tile)),
  anchors: {
    nodes: ratio(city.nodes, (node) => open(node.tile)),
    transitPoints: ratio(city.transitPoints, (point) => open(point.tile)),
    props: ratio(city.props, (prop) => open(prop.tile)),
    stations: ratio(city.stations, (station) => open(station.tile)),
  },
  resolver: 'PASS',
};

assert.deepEqual(result, {
  schema: 't10-kawaguchiko-ferry-post-fix-v1',
  geoTransitPointIds: ['funatsu-pier', 'oishi-landing'],
  runtimeTransitPointIds: [
    'funatsu-pier',
    'oishi-landing',
    'kawaguchiko-bus-stop',
    'subaru-5th-stop',
  ],
  unknownStopIds: [],
  transitRaw: '7/7',
  transitResolved: '7/7',
  spawn: '1/1',
  exits: '2/2',
  requiredNodes: '5/5',
  anchors: {
    nodes: '15/15',
    transitPoints: '4/4',
    props: '3/3',
    stations: '3/3',
  },
  resolver: 'PASS',
});

process.stdout.write(`${JSON.stringify(result)}\n`);
NODE
}

run_kawaguchiko_ferry_gate > /private/tmp/kawaguchiko-ferry-gate.A.json
run_kawaguchiko_ferry_gate > /private/tmp/kawaguchiko-ferry-gate.B.json
cmp /private/tmp/kawaguchiko-ferry-gate.A.json \
  /private/tmp/kawaguchiko-ferry-gate.B.json
wc -c /private/tmp/kawaguchiko-ferry-gate.A.json \
  /private/tmp/kawaguchiko-ferry-gate.B.json
shasum -a 256 /private/tmp/kawaguchiko-ferry-gate.A.json \
  /private/tmp/kawaguchiko-ferry-gate.B.json

npx vitest run \
  src/components/world/__tests__/kawaguchikoGeo.test.js \
  src/components/world/__tests__/cityDistricts.test.js \
  --maxWorkers=1 --no-file-parallelism
npm test -- --maxWorkers=1 --no-file-parallelism
npm run lint
git diff --check
```

수정 후 표의 기대값이나 id 순서가 하나라도 다르면 rect를 넓히거나 resolver를 완화하지 말고
wrapper source·중복 id·선착장 tile을 다시 확인한다. 이번 명세는 가와구치코 source mapping
복구까지만 승인 입력으로 고정하며, 실제 배선 수정과 회귀 테스트 승격은 Claude 소유다.
