# 보르도·스트라스부르 mainRoute 후보 경로 데이터

- 상태: **report-only** — 도시 wrapper·geo·`cityMainRoute.js`·CityScene·registry·verifier·DB 변경 없음
- 발주: 이슈 #150 코멘트 `5046785647` T3
- stacked 기준: T2 head `dca4e59129b3a92376ccbe9adeacd7e22cf14dad` / route source는
  `origin/main` `5016d2ae390207dda1414993d49daca89bd0cd66`과 byte 동일
- 계약: 리옹 파일럿 #383·#385의 `version=1`, `cardinal-bfs-v1`, `URDL`, `excludeExit=true`
- 측정일: 2026-07-22

## 판정

1. **보르도 본선 후보**는 생장역→그로스클로슈→생탕드레 대성당→생트카트린 거리→부르스 광장→
   캥콩스 광장→퍼블릭 정원→샤르트롱→시테뒤뱅의 9 waypoint다. 모든 8 leg가 무힌트 URDL BFS로
   도달하며, 490 steps / 491 tiles / 게임-grid 9.80km로 리옹 508 steps와 비슷하다.
2. 보르도의 `pont-de-pierre`는 모든 마커와 도달 가능하지만 가장 가까운 본선 POI인 시테뒤뱅에서도
   205 steps다. 10개 전 노드 최단 열린 코스는 이 노드를 끝에 붙여 695 steps(13.90km)가 되어
   본선보다 41.8% 길다. 따라서 **본선 제외·후속 branch/별도 코스 판단**을 권고한다.
3. **스트라스부르 본선 후보**는 역→중심 원칙을 명시적으로 지켜 스트라스부르역→클레베르 광장→
   보방댐→퐁쿠베르→프티트프랑스→대성당→오랑주리→유럽의회의 8 waypoint다. 441 steps /
   442 tiles / 게임-grid 8.82km이며 7개 POI를 모두 포함한다.
4. 스트라스부르의 순수 최단 열린 순서는 역→보방댐→퐁쿠베르→프티트프랑스→클레베르→대성당→
   오랑주리→유럽의회, 417 steps다. 중심 우선 후보는 24 steps(480m, +5.8%)만 더 길어 서사 원칙의
   비용이 작다.
5. 이 데이터는 좌표·도달성·거리 후보일 뿐 waypoint 확정이나 `stepsRle` 저작이 아니다. Claude 승인
   전에는 `mainRoute`·segment hint·branch·포장·프롭을 도시 파일에 추가하지 않는다.

거리(m)는 20m/tile인 게임 grid 환산값이며 실제 관광 보행거리 측량치가 아니다.

## 공통 측정 계약

- 각 후보는 기존 `nodes`/`stations`의 typed ref만 사용하고 key가 exact-1로 해석되는지 확인했다.
- waypoint와 경로의 모든 tile은 bounds 안, 4방 보행 가능, `EXIT` 아님을
  `planCityMainRoute()`가 fail-closed로 검증한다.
- `segmentHints=[]`, `branches=[]`로 두어 geo 보행망 자체의 최단 경로만 측정했다.
- BFS 이웃 순서는 `U,R,D,L`; `stepCount = tileCount - 1`이다.
- segment와 전체 SHA-256은 row-major tile index를 uint32 little-endian으로 직렬화한 값이다.
- `stretch = BFS steps / endpoint Manhattan distance`; 1에 가까울수록 직선에 가깝다.

## 보르도 본선 후보

route id 제안: `bordeaux-classic-walk-candidate`(승인 전 예약 아님)

| 순서 | typed key | tile | 역할 |
|---:|---|---:|---|
| 1 | `station:bordeaux-saint-jean` | `[331,302]` | 기점·entrance와 동일 |
| 2 | `node:grosse-cloche` | `[270,245]` | 역사 중심 남문 |
| 3 | `node:cathedrale-saint-andre` | `[246,234]` | 대성당 중심축 |
| 4 | `node:rue-sainte-catherine` | `[264,228]` | 보행 상업축 |
| 5 | `node:place-de-la-bourse` | `[279,214]` | 가론 강변 중심 |
| 6 | `node:place-des-quinconces` | `[260,194]` | 북부 광장축 |
| 7 | `node:jardin-public` | `[248,178]` | 녹지 전환 |
| 8 | `node:chartrons` | `[272,150]` | 강변 창고 지구 |
| 9 | `node:cite-du-vin` | `[355,100]` | 북부 종점 |

### 보르도 leg별 BFS

| # | from → to | steps / tiles | grid 거리 | Manhattan | stretch | RLE runs | path SHA-256 |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | Saint-Jean → Grosse Cloche | 122 / 123 | 2,440m | 118 | 1.034 | 32 | `289e37deac942d0b5f0beb46c3308a0d1b8ee41e5046b69b64cafe143e335ddd` |
| 2 | Grosse Cloche → Saint-André | 37 / 38 | 740m | 35 | 1.057 | 16 | `76e37fa6fc2c6987a1a79a9e68c6348d01e34c92c77666518844c3fc625bf686` |
| 3 | Saint-André → Rue Sainte-Catherine | 38 / 39 | 760m | 24 | 1.583 | 10 | `fa450fea26fa31a1f792a0c3792f0dfd1ae14a29817f1b6d41aeb9e4aa550941` |
| 4 | Rue Sainte-Catherine → Place de la Bourse | 29 / 30 | 580m | 29 | 1.000 | 9 | `943bf4151c69e99b29d67531ddb71ae7f8231921750fa2adc25c40ea371bb50e` |
| 5 | Place de la Bourse → Quinconces | 39 / 40 | 780m | 39 | 1.000 | 6 | `811fe1c60cfe5041ade548913928ea99bf20e7a753f93dc60d8da237c5f58a43` |
| 6 | Quinconces → Jardin Public | 28 / 29 | 560m | 28 | 1.000 | 4 | `88cc7de3172949894a3de2d11cae2960947b26710d290fe3ef81b9b75b5bbe25` |
| 7 | Jardin Public → Chartrons | 58 / 59 | 1,160m | 52 | 1.115 | 30 | `aceee67d962e5695c54e28982a1b41e46552c192d3e11627e8b34073b35c77ba` |
| 8 | Chartrons → Cité du Vin | 139 / 140 | 2,780m | 133 | 1.045 | 90 | `8dc19efe558d496cb6e4f5fc671c45bea8fc26692e90ba5a4cfd5a257bf5705f` |
| **합계** | 8/8 reachable | **490 / 491** | **9,800m** | — | — | **197** | `32edf608c177c21985ca5fafccc843a48893feef589b26b022c8128c44d3e575` |

### 보르도 전 마커 도달성 행렬

모든 숫자는 무힌트 URDL BFS `stepCount`이며 10×10 전 항목이 reachable이다.

- `SJ` Saint-Jean, `Bo` Bourse, `GC` Grosse Cloche, `CA` Saint-André, `Q` Quinconces
- `CV` Cité du Vin, `RS` Rue Sainte-Catherine, `PP` Pont de Pierre, `JP` Jardin Public,
  `Ch` Chartrons

| from/to | SJ | Bo | GC | CA | Q | CV | RS | PP | JP | Ch |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SJ | 0 | 140 | 122 | 155 | 179 | 258 | 141 | 143 | 207 | 223 |
| Bo | 140 | 0 | 48 | 57 | 39 | 198 | 29 | 221 | 67 | 83 |
| GC | 122 | 48 | 0 | 37 | 69 | 242 | 29 | 205 | 95 | 127 |
| CA | 155 | 57 | 37 | 0 | 56 | 247 | 38 | 238 | 72 | 120 |
| Q | 179 | 39 | 69 | 56 | 0 | 191 | 48 | 260 | 28 | 72 |
| CV | 258 | 198 | 242 | 247 | 191 | 0 | 221 | 205 | 187 | 139 |
| RS | 141 | 29 | 29 | 38 | 48 | 221 | 0 | 222 | 74 | 106 |
| PP | 143 | 221 | 205 | 238 | 260 | 205 | 222 | 0 | 288 | 292 |
| JP | 207 | 67 | 95 | 72 | 28 | 187 | 74 | 288 | 0 | 58 |
| Ch | 223 | 83 | 127 | 120 | 72 | 139 | 106 | 292 | 58 | 0 |

### Pont de Pierre 판단

- 전 마커 포함 최단 열린 순서: `SJ→GC→CA→RS→Bo→Q→JP→Ch→CV→PP`
- 전체 695 steps / 13,900m; 본선 490 steps 대비 +205 steps(+41.8%)
- `PP`의 최근접점은 `SJ=143`, 본선 POI 중에는 `CV=205`이며 나머지는 205~292 steps다.
- 현재 `branches=[]` 계약에서 왕복 spur를 임의 저작하지 말고, Claude가 본선 제외·별도 branch·
  장거리 전 노드 코스 중 하나를 승인해야 한다.

## 스트라스부르 중심 우선 후보

route id 제안: `strasbourg-center-first-candidate`(승인 전 예약 아님)

| 순서 | typed key | tile | 역할 |
|---:|---|---:|---|
| 1 | `station:gare-de-strasbourg` | `[128,250]` | 기점·entrance와 동일 |
| 2 | `node:place-kleber` | `[167,260]` | 중심 광장 우선 |
| 3 | `node:barrage-vauban` | `[142,283]` | 서남 수변축 |
| 4 | `node:ponts-couverts` | `[145,281]` | 수로 다리축 |
| 5 | `node:petite-france` | `[149,278]` | 역사 수변 지구 |
| 6 | `node:cathedrale` | `[188,268]` | 그랑딜 중심 랜드마크 |
| 7 | `node:orangerie` | `[254,206]` | 동부 공원 전환 |
| 8 | `node:parlement-europeen` | `[276,179]` | 북동 종점·외관 지리만 |

### 스트라스부르 leg별 BFS

| # | from → to | steps / tiles | grid 거리 | Manhattan | stretch | RLE runs | path SHA-256 |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | Gare → Place Kléber | 55 / 56 | 1,100m | 49 | 1.122 | 18 | `106088d15aa1677e1957525e980503e35743010bddb7942814dde52ab3142d4b` |
| 2 | Place Kléber → Barrage Vauban | 66 / 67 | 1,320m | 48 | 1.375 | 23 | `ec9bc3729a58b10c0c2e573c892b9c92f90d6de3edc4a598c6bb9601cda2bbca` |
| 3 | Barrage Vauban → Ponts Couverts | 5 / 6 | 100m | 5 | 1.000 | 2 | `0c1cee762eabf79ea8d502ab98c0e2623a3fc8f2d6c06c3fab3d5c58374cd17d` |
| 4 | Ponts Couverts → Petite France | 7 / 8 | 140m | 7 | 1.000 | 2 | `fa65ede356976b3c026cb25d7ce3987c5e18442743e4f3d6eaace83eba28540c` |
| 5 | Petite France → Cathédrale | 121 / 122 | 2,420m | 49 | 2.469 | 50 | `f4ab473f2bc831aa424fd8f1a296a1cb3d8b1fd2a277e7dc55a2d21492bb2d3d` |
| 6 | Cathédrale → Orangerie | 134 / 135 | 2,680m | 128 | 1.047 | 62 | `49e942d8d416ba127dd7dd207ebc761378ff0f7a9aa18f91d0921d529209d94d` |
| 7 | Orangerie → Parlement européen | 53 / 54 | 1,060m | 49 | 1.082 | 26 | `8cb536f8083133bc8e5a46bbe58cd61aa61a994a8780e0d7d357ef69c7d61b57` |
| **합계** | 7/7 reachable | **441 / 442** | **8,820m** | — | — | **183** | `46b109e323728925dba494ecbf96f75132127b31f988dbc4b3cb9b346188b418` |

`Petite France→Cathédrale` stretch 2.469는 일강 수로와 보행 회랑을 따르는 우회다. 무힌트 BFS가
도달하므로 실패는 아니지만, 구현 승인 시 라이브 동선 체감과 `segmentHints` 필요성을 우선 확인한다.

### 스트라스부르 전 마커 도달성 행렬

모든 숫자는 무힌트 URDL BFS `stepCount`이며 8×8 전 항목이 reachable이다.

- `G` Gare, `C` Cathédrale, `PF` Petite France, `K` Place Kléber, `BV` Barrage Vauban,
  `PC` Ponts Couverts, `PE` Parlement européen, `O` Orangerie

| from/to | G | C | PF | K | BV | PC | PE | O |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| G | 0 | 126 | 69 | 55 | 57 | 62 | 237 | 190 |
| C | 126 | 0 | 121 | 83 | 117 | 116 | 185 | 134 |
| PF | 69 | 121 | 0 | 78 | 12 | 7 | 264 | 213 |
| K | 55 | 83 | 78 | 0 | 66 | 71 | 202 | 151 |
| BV | 57 | 117 | 12 | 66 | 0 | 5 | 260 | 209 |
| PC | 62 | 116 | 7 | 71 | 5 | 0 | 259 | 208 |
| PE | 237 | 185 | 264 | 202 | 260 | 259 | 0 | 53 |
| O | 190 | 134 | 213 | 151 | 209 | 208 | 53 | 0 |

### 중심 우선 비용

| 후보 | 순서 요약 | steps | grid 거리 | 판정 |
|---|---|---:|---:|---|
| 전 노드 최단 | `G→BV→PC→PF→K→C→O→PE` | 417 | 8,340m | 거리 최저 |
| **중심 우선** | `G→K→BV→PC→PF→C→O→PE` | **441** | **8,820m** | +24 steps(+5.8%), 서사 원칙 권고 |

## 결정성

두 도시 후보를 독립 Node 프로세스로 2회 산출했고 compact audit JSON이 byte-identical이었다.

- combined audit SHA-256: `6fcb5e2279c4f9de27ba13c39142268d489f50a3917896a58fa9edd720e52c08`
- 보르도 전체 path SHA-256: `32edf608c177c21985ca5fafccc843a48893feef589b26b022c8128c44d3e575`
- 스트라스부르 전체 path SHA-256: `46b109e323728925dba494ecbf96f75132127b31f988dbc4b3cb9b346188b418`
- run A/B: 15 segments의 `stepCount`·`tileCount`·segment SHA와 두 전체 SHA 모두 exact 동일

정본 Git blob은 `cityMainRoute.js` `0a3f8f08d5ecd56083abf98e3e9ac6fdb0a8d9ea`, 보르도 wrapper
`9aee8f61ab90863b04433fb2064406bdb6d026e6`·geo `b24a5c15fabbf41090ede307d64174418aa99768`,
스트라스부르 wrapper `9bc60dd631af3deebffbb804235cce27bcfb8885`·geo
`c4043f1e9c1bf4f2100167219a2b05913a6aa734`, 리옹 비교 기준
`7771b16b442b13aa9deee106880eb472f3904abb`다.

## 재현 골격

도시 파일을 수정하지 않고 아래 모양의 임시 객체만 `planCityMainRoute()`에 넘겼다. `pairs`에는 위
waypoint 표의 `{kind,id}`를 순서대로 넣는다.

```js
import crypto from 'node:crypto';
import { encodeMainRoutePathIndices, planCityMainRoute } from './src/components/world/cityMainRoute.js';

const mainRoute = {
  id: `${city.id}-candidate`,
  version: 1,
  waypoints: pairs.map(([kind, id]) => ({ kind, id })),
  routing: { algorithm: 'cardinal-bfs-v1', neighborOrder: 'URDL', excludeExit: true },
  segmentHints: [],
  branches: [],
};
const plan = planCityMainRoute({ ...city, mainRoute });
for (const segment of plan.segments) {
  const pathSha256 = crypto.createHash('sha256')
    .update(encodeMainRoutePathIndices(segment.pathIndices)).digest('hex');
  console.log(segment.id, segment.stepCount, segment.tileCount, pathSha256);
}
```

행렬은 같은 helper에 마커 두 개씩을 넣어 모든 무방향 쌍을 계산했다. 최단 열린 순서는 역을 고정한
Held-Karp 동적 계획법으로 검산했으며, 최종 후보는 거리만이 아니라 중심 우선·리옹 508-step 규모·
IP/representation 정책을 함께 반영했다.

## 검증 근거

- Node `v22.23.1`
- 후보 audit 독립 2회: 15 segments와 combined JSON byte-identical
- typed ref exact-1·bounds·walkable·non-EXIT·URDL cardinal path: 15/15 PASS
- 전 마커 pairwise BFS: 보르도 45쌍·스트라스부르 28쌍, 73/73 reachable
- targeted: 8 files / 52 tests PASS; max RSS 2,661,187,584 bytes;
  peak footprint 49,175,512 bytes / swaps 0
- full single-worker: 199 files / 2,059 tests PASS; max RSS 2,435,006,464 bytes;
  peak footprint 48,798,584 bytes / swaps 0
- `npm run lint`·`git diff --check`: PASS
- 수정 파일은 이 제안서와 Codex-2 보드뿐이며 도시·route helper·공유 runtime은 byte 불변
