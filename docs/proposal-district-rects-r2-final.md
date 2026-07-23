# T15 일본 6도시 지구 정본화 직전 최종 사전검증

- 상태: **report-only / Claude 정본 저작 직전 gate**
- 측정 기준점: `origin/main` exact `407b32cda5e517c908a86c4d9ac0b88c430e7584`
- 게시 직전 main: `d192161e13255aa3e10c38bd6615e9be6ca82c34`
  (전진 4커밋·9파일 중 측정 입력 15파일과 중첩 0)
- 후보 입력: `docs/proposal-district-rects-r2.md`의 도쿄·오사카·후쿠오카·교토·
  삿포로·나고야
- 재검증 기준: P1 lazy city registry와 P3 도쿄 packed geo loader가 반영된 현 `main`
- 측정일: 2026-07-23

## 결론

1. 현 `main`에서 실제 city manifest·wrapper·geo가 있는 **도쿄·오사카·후쿠오카·교토
   4도시**는 T9의 16지구·28개 inclusive rect를 그대로 정본 저작해도 된다. rect 범위
   28/28, TRANSIT exact-1/raw/resolved 48/48, 스폰 4/4, EXIT 8/8, 도어·NPC 10/10,
   `returnNode` 해석·도시 backlink 4/4가 모두 PASS다.
2. 네 도시 모두 source의 `mainRoute` property가 없고 값은 정확히 `undefined`다.
   현 resolver로도 4/4 `null`이며, 따라서 정본 rect가 잠그는 mainRoute 타일은 없다.
3. T9 후보를 임시 `district-v1` payload로 주입하고 P1 `loadCity()`로 읽은 실제 grid에
   `resolveCityDistricts(city, grid, null)`를 실행한 결과 4/4가 throw 없이 PASS했다.
4. 개방 비율은 도쿄 28.091866%, 오사카 17.175867%, 후쿠오카 26.730051%,
   교토 17.634215%로 T9와 동일하다. P3 도쿄 loader 전환 뒤에도 grid·gate·비율 drift가 없다.
5. **삿포로·나고야는 여전히 manifest·wrapper·geo가 모두 없다.** grid·TRANSIT·스폰·
   EXIT·도어·`returnNode`가 없으므로 rect나 개방 비율을 만들 수 없다. 아래 표에서
   `NO_SOURCE`인 두 도시는 정본 저작 대상에서 제외해야 하며, 도시 source가 생기기 전
   임의 bbox나 오버월드 POI로 대체하면 안 된다. 따라서 현 `main`은 “요청 6도시 중
   4도시 저작 가능, 2도시 선행 source 대기” 상태다.

## 입력 가용성

| 요청 도시 | P1 manifest/`hasCity` | wrapper | geo | 최종 판정 |
|---|---:|---:|---:|---|
| 도쿄 (`tokyo`) | ✓/✓ | ✓ | ✓ (P3 loader) | **PASS / 저작 가능** |
| 오사카 (`osaka`) | ✓/✓ | ✓ | ✓ | **PASS / 저작 가능** |
| 후쿠오카 (`fukuoka`) | ✓/✓ | ✓ | ✓ | **PASS / 저작 가능** |
| 교토 (`kyoto`) | ✓/✓ | ✓ | ✓ | **PASS / 저작 가능** |
| 삿포로 (`sapporo`) | ✗/✗ | ✗ | ✗ | **NO_SOURCE / 저작 금지** |
| 나고야 (`nagoya`) | ✗/✗ | ✗ | ✗ | **NO_SOURCE / 저작 금지** |

나고야의 오버월드 `gourmet-nagoya`는 city grid가 없는 일반 POI라 city source로 세지
않았다. 삿포로 관련 오버월드 표지도 같은 이유로 rect 입력이 될 수 없다.

## 최종 집계

rect는 양 끝을 포함하는 `[x0, y0, x1, y1]`이다. 열린 타일은 같은 지구 안 rect가 겹쳐도
합집합에서 한 번만 센다.

| 도시 | grid | 지구/rect | 열린 타일 | 전체 대비 | `mainRoute` source/resolved | resolver |
|---|---:|---:|---:|---:|---|---|
| 도쿄 | 824×1086 | 4/8 | 251,384 | 28.091866% | `undefined` / `null` | PASS |
| 오사카 | 641×668 | 4/7 | 73,545 | 17.175867% | `undefined` / `null` | PASS |
| 후쿠오카 | 388×254 | 4/4 | 26,343 | 26.730051% | `undefined` / `null` | PASS |
| 교토 | 639×668 | 4/9 | 75,272 | 17.634215% | `undefined` / `null` | PASS |
| 삿포로 | — | — | — | — | — | NO_SOURCE |
| 나고야 | — | — | — | — | — | NO_SOURCE |

## 필수 gate 최종표

TRANSIT은 `stations + transitPoints`에서 각 `stopId`가 exact-1인지 확인하고, raw tile과
`resolveArrivalTile()`의 실제 하차 tile을 각각 rect 합집합에 대조했다. 도어·NPC는 D1의
fail-closed 조건과 동일하게 `npc || gate || chapter || reading` node를 센다.

| 도시 | TRANSIT exact-1 | raw open | resolved open | 스폰 | EXIT | 도어·NPC | `returnNode` 해석/backlink | resolver |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 도쿄 | 10/10 | 10/10 | 10/10 | 1/1 | 2/2 | 3/3 | 1/1 · 1/1 | PASS |
| 오사카 | 13/13 | 13/13 | 13/13 | 1/1 | 2/2 | 2/2 | 1/1 · 1/1 | PASS |
| 후쿠오카 | 15/15 | 15/15 | 15/15 | 1/1 | 2/2 | 4/4 | 1/1 · 1/1 | PASS |
| 교토 | 10/10 | 10/10 | 10/10 | 1/1 | 2/2 | 1/1 | 1/1 · 1/1 | PASS |
| **합계** | **48/48** | **48/48** | **48/48** | **4/4** | **8/8** | **10/10** | **4/4 · 4/4** | **4/4** |

| 도시 | 스폰 | 열린 EXIT | 열린 도어·NPC id | `returnNode` |
|---|---|---|---|---|
| 도쿄 | `[543,1040]` | `[543,1031]`, `[543,1032]` | `tokyo-ekiin`, `tokyo-menzei`, `tokyo-konbini` | `tokyo` |
| 오사카 | `[414,187]` | `[414,177]`, `[414,178]` | `osaka-izakaya`, `osaka-konbini` | `osaka` |
| 후쿠오카 | `[239,70]` | `[239,61]`, `[239,62]` | `fukuoka-konbini`, `nakasu`, `fukuoka-izakaya`, `fukuoka-ramen` | `fukuoka` |
| 교토 | `[404,422]` | `[404,412]`, `[404,413]` | `kyoto-shrine` | `kyoto` |

네 `returnNode`는 `getNode()`로 해석되며 모두 `gate.type === 'city'`와
`gate.to === city.id`를 만족한다. 즉 열린 EXIT와 오버월드 복귀 노드의 양쪽 계약이 닫힌다.

## 앵커 drift 확인

`N/T/P/S`는 `nodes / transitPoints / props / stations`의 열린 수와 전체 수다.

| 도시 | 열린 N/T/P/S | 비필수 잠금 앵커 |
|---|---:|---|
| 도쿄 | 36/38 · 1/1 · 14/14 · 30/30 | `nakano-broadway`, `shimokitazawa` 일반 POI 2개 |
| 오사카 | 10/10 · 0/0 · 7/7 · 13/13 | 없음 |
| 후쿠오카 | 18/18 · 4/4 · 17/17 · 11/11 | 없음 |
| 교토 | 11/11 · 0/0 · 9/9 · 10/10 | 없음 |

도쿄의 두 잠금 node는 TRANSIT·스폰·EXIT·도어·NPC·`returnNode`가 아니므로 필수 gate를
막지 않는다. T9 이후 앵커 수와 membership 변화는 없다.

## Claude 정본 저작용 exact rect

아래 `id`와 `rects`는 이번 최종 검증을 통과한 값이다. `label`과 `locked.line`은 Claude
소유 카피로 채우되 rect는 줄이거나 옮기지 않는다.

### 도쿄

```js
open: [
  {
    id: 'yamanote-west',
    tiles: { rects: [[195, 35, 320, 120], [140, 130, 250, 499], [170, 500, 320, 690]] },
  },
  {
    id: 'central-east',
    tiles: { rects: [[340, 0, 540, 280], [500, 90, 700, 245], [430, 281, 530, 429]] },
  },
  { id: 'south-bay', tiles: { rects: [[330, 430, 590, 700]] } },
  { id: 'haneda', tiles: { rects: [[525, 1020, 585, 1075]] } },
]
```

### 오사카

```js
open: [
  { id: 'north-hubs', tiles: { rects: [[415, 0, 455, 25], [350, 140, 610, 245]] } },
  { id: 'castle-east', tiles: { rects: [[535, 246, 615, 330]] } },
  {
    id: 'namba-tennoji',
    tiles: { rects: [[250, 280, 360, 410], [420, 331, 520, 505], [550, 350, 600, 410]] },
  },
  { id: 'bay', tiles: { rects: [[85, 420, 135, 470]] } },
]
```

### 후쿠오카

```js
open: [
  { id: 'hakata-port', tiles: { rects: [[205, 10, 255, 85]] } },
  { id: 'tenjin-ohori', tiles: { rects: [[90, 120, 259, 185]] } },
  { id: 'nakasu-hakata', tiles: { rects: [[260, 90, 350, 165]] } },
  { id: 'momochi', tiles: { rects: [[5, 100, 75, 160]] } },
]
```

### 교토

```js
open: [
  {
    id: 'arashiyama-sanin',
    tiles: { rects: [[20, 210, 160, 285], [200, 205, 285, 250]] },
  },
  {
    id: 'imperial-nijo',
    tiles: { rects: [[250, 90, 300, 135], [315, 170, 450, 285]] },
  },
  {
    id: 'higashiyama-core',
    tiles: { rects: [[500, 160, 610, 270], [410, 286, 540, 339], [480, 340, 540, 380]] },
  },
  {
    id: 'station-fushimi',
    tiles: { rects: [[315, 340, 470, 450], [440, 490, 510, 535]] },
  },
]
```

### 삿포로·나고야

정본 payload 없음. 두 도시의 `CITY_MANIFEST` entry, wrapper, geo, grid와 runtime gate가
모두 생긴 뒤 새 rect 실측과 이 문서의 전 gate를 다시 통과해야 한다.

## P1·P3 기준 resolver 예행

각 PASS 도시에 다음 순서를 one-shot으로 적용했다.

1. P1 `CITY_MANIFEST`/`hasCity()`로 source identity를 확인하고 `await loadCity(id)`로
   필요한 도시만 lazy-load.
2. `city.buildGrid()`로 EXIT가 반영된 실제 grid 생성. 도쿄는 P3
   `cityGeoLoader.js`가 packed `tokyo.geo.js`를 해석한 결과를 소비.
3. `resolveCityMainRoute(city, grid)`가 `null`이고 원본 `city.mainRoute === undefined`인지 확인.
4. 위 rect와 임시 label·`locked.style: 'guidebook'`을 `district-v1`으로 주입.
5. `resolveCityDistricts(injectedCity, grid, null)` 호출. 4도시 모두 non-null 결과,
   지구 수 4, throw 0.
6. resolver가 반환한 `cityDistrictOpenAt()`로 TRANSIT raw/resolved, 스폰, EXIT,
   도어·NPC를 다시 대조. 수기 rect membership과 runtime 판정이 전부 일치.

## 결정성·회귀 증거

후보 문서, P1 manifest, P3 loader, 네 도시 wrapper/geo, terrain, district/mainRoute resolver,
world node의 15개 입력을 파일별 SHA-256 정렬 목록으로 고정했다.

측정 뒤 `main`은 `407b32c..d192161`로 4커밋 전진했다. 변경된 9파일은 문서 3개,
테스트 4개, stamp album 제품 코드 2개이며 아래 측정 입력 15파일과 겹치지 않는다.
따라서 runtime 수치 재산출 대상은 없고, branch에는 merge·rebase 없이 exact 측정 기준을 보존했다.

- input manifest SHA-256:
  `56828d280e1cf7e4ad577fe6169ef1225ae1fb9efb42212e06c182d81330fd62`
- one-shot canonical JSON: run A/B 각 12,079 bytes, byte-identical
- one-shot SHA-256 A/B:
  `1df87fefa1e184747cb93d3355f654a271e458452f812f23f6bdb83149cc46f3`
- max RSS: run A 142,016 KiB, run B 142,080 KiB (`process.resourceUsage()`)
- Node: `v22.23.1` 공식 nvm 배포판
- targeted P1/P3·4도시·district/mainRoute/returnNode:
  12 files / 203 tests PASS / 23.03s
- full single-worker: 221 files / 2,191 tests PASS / 201.30s

이 문서가 허용하는 다음 변경은 PASS 4도시 wrapper에 위 rect를 그대로 넣고 Claude 소유
label·잠금 카피를 저작하는 것이다. 삿포로·나고야는 source 선행 없이 districts만 추가할 수 없다.
