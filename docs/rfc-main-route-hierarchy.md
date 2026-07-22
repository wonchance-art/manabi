# RFC — 도시 `mainRoute` 경로 위계 계약

- 상태: **제안(승인 전 구현 금지)**
- 기준: `origin/main` `5ffd30c7f5f82e499f47a65759d2000394dadf49`
- 발주: 이슈 #150 코멘트 `5045143688`
- 파일럿: 리옹, 보르도는 라이브 비교 대조군
- 원칙: geo·terrain·충돌·기존 도시 렌더를 바꾸지 않는 배선·연출 레이어

## 1. 문제와 현재 코드 근거

현재 도시 geo는 `ROAD`와 `SIDEWALK` 같은 지형 종류만 보존하며 OSM의 도로 등급은 런타임
도시 객체에 남기지 않는다. 따라서 **geo 재생성 없이** 도로 등급을 복원할 수는 없다. 이 RFC는
콘텐츠 오너가 정한 POI·역 순서를 단일 주동선으로 만들고, 그 사이의 보행 경로를 고정 알고리즘으로
산출해 시각 위계를 얹는 최소 계약을 제안한다.

- 리옹의 POI 9개와 역 2개는 이미 안정적인 ID·tile을 가지며 모두 165,074칸 단일 4방 보행
  성분에 속한다.
- `CityScene.terrainTexKey(tx, ty)`와 청크 `bakeChunk()`는 좌표별 텍스처를 선택하므로, 원본
  지형을 바꾸지 않고 주동선 타일에만 두 번째 포장 오버레이를 찍을 수 있다.
- `city.props`는 명시 목록만 소비한다. 주동선 프롭은 원본 목록을 수정하지 않고 순수 함수가 만든
  별도 `routeProps` 목록으로 합성할 수 있다.
- 현재 어떤 도시에도 `mainRoute`가 없다. `undefined`를 빈 계약으로 처리하면 기존 25도시는
  코드 경로와 렌더 결과를 그대로 유지할 수 있다.

## 2. 목표와 비목표

### 목표

1. POI·역 ID를 섞어도 충돌하지 않는 waypoint 순서를 정의한다.
2. 같은 grid·계약에서 구간 경로와 자동 프롭이 항상 byte-identical하게 나오게 한다.
3. geo 재생성 없이 리옹 한 도시에만 포장 강조와 일반 실루엣 프롭을 적용한다.
4. 미정의 도시의 타일 선택·청크 베이크·프롭 목록을 완전히 보존한다.
5. 향후 Codex-2 검증 계약이 waypoint 순차 도달성·보행성·결정성을 검사할 수 있게 한다.

### 비목표

- OSM 도로 등급을 현재 geo에서 추정하거나 terrain 코드를 다시 생성하지 않는다.
- 충돌, 이동 속도, 강제 퀘스트, 자동 이동, TRANSIT, 저장 좌표를 바꾸지 않는다.
- 리옹 코스 카피·발견 이벤트·곁가지 분기의 연결 지점은 저작하지 않는다.
- 브랜드·문자·표지판 문구·특정 작품을 프롭에 넣지 않는다.

## 3. 저작 계약

ID 충돌을 막기 위해 waypoint는 문자열 ID만 두지 않고 `kind`를 함께 고정한다. `node`는
`city.nodes`, `station`은 `city.stations`에서 exact 1개를 찾아야 한다.

```js
mainRoute: Object.freeze({
  id: 'lyon-classic-loop',
  version: 1,
  waypoints: Object.freeze([
    Object.freeze({ kind: 'station', id: 'perrache' }),
    Object.freeze({ kind: 'node', id: 'bellecour' }),
    Object.freeze({ kind: 'node', id: 'vieux-lyon' }),
    Object.freeze({ kind: 'node', id: 'fourviere' }),
    Object.freeze({ kind: 'node', id: 'terreaux' }),
    Object.freeze({ kind: 'node', id: 'opera' }),
    Object.freeze({ kind: 'node', id: 'croix-rousse' }),
    Object.freeze({ kind: 'node', id: 'halles' }),
    Object.freeze({ kind: 'station', id: 'part-dieu' }),
  ]),
  routing: Object.freeze({
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  }),
  segmentHints: Object.freeze([]),
  branches: Object.freeze([]),
})
```

waypoint 순서는 발주의 페라슈 → 벨쿠르 → 구시가(트라불) → 푸르비에르 → 테로·오페라 →
크루아루스 → 레알 → 파르디외를 exact 반영한다. 테로와 오페라는 서로 다른 기존 ID이므로
검증·진행 표시가 모호하지 않게 waypoint 2개로 둔다.

### 선택적 구간 힌트

라이브 비교에서 최단경로가 의도한 대로를 벗어날 때만 `segmentHints`에 보행 가능한 경유 tile을
추가한다. 이는 geo를 고치는 값이 아니라 경로 선택의 저작 핀이다.

```js
Object.freeze({
  from: Object.freeze({ kind: 'node', id: 'fourviere' }),
  to: Object.freeze({ kind: 'node', id: 'terreaux' }),
  viaTiles: Object.freeze([
    // 승인된 정수 [x, y]만 허용. 초기 RFC에는 임의 tile을 넣지 않는다.
  ]),
})
```

- `(from, to)`는 인접 waypoint 한 쌍과 exact 일치해야 한다.
- `viaTiles`는 범위 안·보행 가능·`EXIT` 아님을 검증한다.
- 힌트가 없으면 두 waypoint를 바로 잇고, 있으면 `from → via... → to`의 각 leg를 같은
  알고리즘으로 이어 붙인다.
- 콘플루앙스·테트도르 곁가지의 분기 waypoint는 Claude 저작 영역이므로 이 RFC에서 임의로
  선택하지 않는다. `branches`는 승인된 `from`·`to`가 들어온 뒤 같은 segment 문법을 쓴다.

## 4. 결정적 구간 산출 계약

`cardinal-bfs-v1`은 다음을 모두 버전 계약으로 고정한다.

1. 입력 grid는 `city.buildGrid()` 1회 결과다.
2. 통행 가능 칸은 `!isCityBlocked(code)`이면서 `code !== CITY_TILE.EXIT`인 칸이다.
3. endpoint·hint는 원래 tile exact를 쓰며 자동 최근접 재배치는 하지 않는다. 실패는 fail closed다.
4. 이웃 순서는 위→오른쪽→아래→왼쪽(`URDL`)이고 FIFO BFS로 최소 step 경로를 고른다.
5. 구간은 앞 waypoint와 뒤 waypoint를 모두 포함한다. 인접 구간의 공통 endpoint는 전체
   route mask를 만들 때 한 번만 보존한다.
6. 산출 경로는 `U/R/D/L` run-length 배열로 직렬화한다. `count`는 1 이상의 정수다.
7. `stepCount`는 run count 합, `tileCount = stepCount + 1`이다.
8. `pathSha256`는 경로 tile의 row-major index를 순서대로 `uint32le`로 쓴 byte열의 SHA-256이다.

정규화된 산출물은 다음 모양이다. 수동으로 경로를 복사하지 않고 순수 planner의 출력만 저장한다.

```js
Object.freeze({
  id: 'station:perrache--node:bellecour',
  from: Object.freeze({ kind: 'station', id: 'perrache' }),
  to: Object.freeze({ kind: 'node', id: 'bellecour' }),
  stepsRle: Object.freeze([
    Object.freeze({ direction: 'U', count: 1 }),
    // planner가 산출한 나머지 run
  ]),
  stepCount: 88,
  tileCount: 89,
  pathSha256: '781ae7cb3d7fe322b8f37b450359fc182042eeb1b4ffc44b4dc131a794bf5392',
})
```

구현 시 planner는 테스트/생성 경로에서 RLE와 hash를 만들고, 런타임은 작은 RLE만 디코드한다.
도시 진입 때 214,428칸 BFS를 8회 되풀이하지 않으므로 #378에서 확인한 warm-entry 예산을
보호한다. terrain이나 waypoint가 바뀌면 재산출 테스트가 저장 RLE·hash 불일치를 내며 닫힌다.

### 리옹 무힌트 feasibility probe

RFC 검토를 위해 제품 파일을 바꾸지 않고 위 알고리즘을 2회 실행했다. 이는 승인 전 참고값이며
아직 제품 pin은 아니다.

| 구간 | steps | runs | 경로 SHA-256 |
|---|---:|---:|---|
| 페라슈 → 벨쿠르 | 88 | 36 | `781ae7cb3d7fe322b8f37b450359fc182042eeb1b4ffc44b4dc131a794bf5392` |
| 벨쿠르 → 구시가 | 37 | 18 | `0cb15b9e2b234357109e66485b9894504dc22de636edbc962142a53662a0e8b4` |
| 구시가 → 푸르비에르 | 31 | 9 | `1c72c078a5097d20ed0873df071615b97e0d683b1f61e2a1223996dde5237d67` |
| 푸르비에르 → 테로 | 77 | 20 | `e149ceb0cc0f74e2254a99a90643fc7cd2d3554833930877b60b1870e311e7da` |
| 테로 → 오페라 | 26 | 5 | `075090c44b399a578127829cc5468f5f353817eccbe77403fac55cb6a31380e4` |
| 오페라 → 크루아루스 | 65 | 14 | `7e26891c1d43fc8c9551b4436ff3968d45ab1a9c794857215808cd3b6094621e` |
| 크루아루스 → 레알 | 134 | 25 | `739014d9831e9190517f81ae1d79c157cac7bf6d5f277e9aefaac4fff47825f0` |
| 레알 → 파르디외 | 50 | 7 | `94d03b490e14a1daf94fc288072e944ae70b048a3647e3857a8f1b597d006f48` |

합계 508 steps(20m/tile 기준 약 10.16km)이며, 구간 endpoint 중복 포함 516칸은 ROAD 312,
SIDEWALK 127, CROSSWALK 67, PLAZA 7, PARK 3으로 구성된다. 차단·수면·건물·EXIT는 0칸이다.
두 독립 산출 JSON은 byte-identical이고 SHA-256은
`0460585ae4db026db3e6c239469eb557dab3d9057eb89dbf9098e5b275951f31`로 일치했다.
이 길이는 강제 이동량이 아니라 선택 가능한 안내 코스 전체 길이다. 라이브 비교에서 너무 길거나
부자연스러운 구간만 승인된 `viaTiles` 또는 코스 분절로 보정한다.

## 5. 승인 뒤 렌더 소비 경계 제안

### 포장 강조

- 무문자 단색 포장 오버레이 텍스처 `ct_main_route_paving` 1종만 굽는다.
- `bakeChunk()`가 원본 terrain을 먼저 찍고, route mask인 칸에 반투명 포장 오버레이를 한 번 더
  찍은 뒤 기존 railway overlay를 찍는다. terrain texture key·collision grid는 바꾸지 않는다.
- `city.mainRoute == null`이면 route mask와 추가 draw pass 자체를 만들지 않는다. 기존 도시의
  texture key 호출과 청크 픽셀은 byte-identical해야 한다.
- 시간대 색 변화는 기존 `toneColor`를 사용하고 runtime RNG를 쓰지 않는다.

### 이정표·가로등 자동 배치

프롭은 `ct_prop_route_signpost`, `ct_prop_route_streetlight` 두 일반 실루엣만 추가한다. 문자,
노선명, 브랜드, 문장, 특정 실물 디자인은 넣지 않는다.

1. 구간 경로를 waypoint 순서대로 합치고 공통 endpoint를 중복 제거한다.
2. 이정표 후보는 내부 waypoint에서 출발 방향으로 2 steps 지난 지점마다 1개다.
3. 가로등 후보는 전체 path index 12부터 매 12 steps마다 1개다.
4. 후보의 진행 방향 기준 왼쪽→오른쪽, 그 뒤 `URDL` 순으로 인접 칸을 찾는다.
5. 배치 칸은 범위 안·보행 가능·비route·비EXIT여야 한다.
6. 기존 node·station·명시 `city.props`·이미 선택한 route prop과 Chebyshev 2타일 이내면
   후보를 건너뛴다. 다른 위치로 임의 확장 탐색하지 않는다.
7. 후보 순서와 필터가 같으므로 프레임·카메라·청크 생성 순서와 무관하다. route prop은 기존
   `city.props`를 변경하지 않고 별도 frozen 배열로 소비한다.

위 숫자(이정표 2 steps, 가로등 12 steps, 이격 2)는 구현 전에 승인받을 파라미터다. 경로·프롭은
시각 전용이며 충돌이나 상호작용을 만들지 않는다.

## 6. 검증 계약

### 데이터·경로

- `mainRoute.id` 도시 내 유일, `version === 1`, waypoint 2개 이상
- 모든 `{kind,id}`가 exact 1개로 해석되고 endpoint가 범위 안·보행 가능·비EXIT
- 구간 수 = waypoint 수 - 1, `(from,to)`가 인접 waypoint 순서와 exact 일치
- 모든 연속 tile이 Manhattan distance 1, 차단·EXIT 0
- `stepsRle` decode 결과의 step/tile count와 SHA-256 exact
- 같은 입력 planner 2회 결과와 직렬화 JSON SHA-256 byte-identical
- waypoint가 순서대로 경로에 등장하며 각 구간 BFS 재산출과 저장 산출물이 exact 일치

### 렌더·프롭

- route mask 안 타일만 오버레이, 밖의 terrain texture key 불변
- 미정의 도시 fixture에서 route mask 0, route props 0, route texture bake 0
- 같은 경로에서 자동 프롭 배열·좌표·kind가 2회 byte-identical
- 프롭은 route 위 0, 차단/EXIT 0, 기존 marker·prop 이격 위반 0
- 리옹 청크 재베이크 2회 RGBA hash 동일

### 회귀·성능

- 리옹 targeted + `CityScene` 소비 경계 테스트 + 전체 vitest
- Node 22 nvm, `/usr/bin/time -l` max RSS·peak footprint·swap 기록
- route RLE bytes, route mask bytes, warm city-entry 증가량을 기록하고 #378 리옹 5.08ms 평균
  수준과 비교한다.
- `CITY_MAPS` 전수에서 `mainRoute` 미정의 도시의 렌더/메모리 계약 불변을 확인한다.
- 공식 verifier는 Claude 소유이므로 Codex-2 제안 승인 전 수정하지 않는다.

## 7. 승인 뒤 예상 파일 경계

- 신규 순수 helper: `src/components/world/cityMainRoute.js`
- 리옹 배선만: `src/components/world/cities/lyon.js`
- 최소 소비처: `src/components/world/CityScene.js`
- 신규/전용 테스트: `cityMainRoute.test.js`, `cityRegionMainRoute.test.js`, `lyonMainRoute.test.js`
- 보드: Codex-1 열만 별도 커밋
- 금지: `*.geo.js`, geo generator/snapshot, `cities/index.js`, 공식 verifier, DB, 콘텐츠 카피

## 8. 승인 요청

1. typed waypoint `{kind:'node'|'station', id}`와 리옹 9개 순서를 승인하는가?
2. `URDL`·비EXIT 4방 BFS + 선택적 승인 `viaTiles` 계약을 승인하는가?
3. 경로 RLE를 저장하고 테스트가 BFS로 재산출해 hash를 검증하는 방식으로 warm-entry 비용을
   피하는 결정을 승인하는가?
4. 원본 terrain 위 단일 포장 overlay와 미정의 도시 draw-pass 0 계약을 승인하는가?
5. 이정표 2 steps·가로등 12 steps·Chebyshev 이격 2의 자동 배치 파라미터를 승인하는가?
6. 콘플루앙스·테트도르 곁가지의 분기 waypoint는 Claude가 지정할 때까지 비워 두는가?

승인 전에는 위 예상 제품 파일을 수정하지 않는다.
