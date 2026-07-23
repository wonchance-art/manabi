# 여행책 지구 후보 rect 실측 제안 r4 — 마르세유·가와구치코

- 상태: **report-only / Claude 지구 정본 저작 입력** — 도시 wrapper/geo·runtime·registry·
  verifier·DB 변경 없음
- publication base: `origin/main`
  `d93981b8d32f2ccc5bb363ac22984d6635ee127e`
- measurement input snapshot:
  `fac33cd492dd3e12e2518b2ef403dad7c3c52a39` (T20 #493 merge)
  — publication base까지 2커밋·10파일은 아래 측정 입력 7파일과 비중첩
- 상위 발주: T20 완료 뒤 T21 세션 지시 — 지구 미정의 잔여 2도시 rect 실측
- 측정일: 2026-07-23

## 결론

1. 마르세유는 **4개 open 지구·5개 inclusive rect**, 가와구치코는 **3개 open
   지구·5개 inclusive rect**를 제안한다. rect는 양 끝 포함 `[x0, y0, x1, y1]`이다.
   범위 밖 rect와 지구 간 중복 타일은 각각 0개다.
2. 마르세유는 32,153타일(전체 17.756633%), 가와구치코는 43,107타일
   (8.809554%)을 연다. 두 후보 모두 현행 POI 23/23, 스폰 2/2, EXIT 4/4,
   도어 10/10, NPC 0/0, story gate 1/1과 전체 node·prop·station을 포함한다.
3. 가와구치코의 `KAWAGUCHIKO_GEO.transitPoints` 복구가 현 `main`에 반영돼
   `funatsu-pier [148,240]`와 `oishi-landing [62,164]`이 runtime에서 exact-1로
   해석된다. 두 유람선 정류장은 모두 `lakefront` rect 안이며, 전체 TRANSIT raw/resolved
   7/7과 실제 `resolveCityDistricts()`가 PASS한다.
4. 마르세유 rect는 역 4곳과 geo 선착장 4곳을 모두 포함해 source 좌표 투영 기준
   TRANSIT raw/resolved 8/8이다. 다만 현 wrapper는 존재하지 않는
   `MARSEILLE_GEO.ferryLinks`를 읽어 runtime `transitPoints`가 0개다. 따라서 현 source를
   그대로 resolver에 넣으면 역 4/8 뒤 `vieux-port-quay must resolve exact-1`에서
   FAIL한다. Claude가 wrapper source를 `MARSEILLE_GEO.transitPoints`로 복구한 뒤에만
   이 rect를 정본화할 수 있다. **rect 결함과 source blocker를 분리한 조건부 PASS**다.
5. 두 도시 모두 `districts`와 `mainRoute`가 `undefined`다. 따라서 기존 mainRoute나
   발견 타일을 잠그는 추가 gate는 없다. `returnNode`의 `marseille`·`kawaguchiko`는
   각각 해당 city gate로 exact 해석된다.

## 실측 방법

r3 계열과 같은 one-shot 순서에 타일 히스토그램·POI/도로 밀도 근거를 추가했다.

1. 실제 wrapper의 `buildGrid()`를 호출해 EXIT가 반영된 최종 grid를 측정한다.
2. 모든 rect를 inclusive union mask로 만들고 범위·순서·지구 간 중복을 검사한다.
3. 각 지구의 tile code 히스토그램과 보행 가능 비율을 집계한다. 도로 밀도는 T20
   road-like 문법과 같은 `(ROAD + CROSSWALK + BRIDGE) / 열린 지구 타일`이다.
4. geo 정본 POI의 rect membership과 20m/tile 기준 POI/km²를 계산한다.
5. runtime과 같은 `stations + transitPoints` exact-1 map에서 TRANSIT 원 좌표와
   `resolveArrivalTile()` 결과를 모두 검사한다. 스폰·EXIT·
   `npc || gate || chapter || reading` node와 `returnNode`도 같은 union에 대조한다.
6. 후보를 임시 `district-v1` payload로 주입해 실제 `resolveCityDistricts()`를 실행한다.
   마르세유는 현 source FAIL을 먼저 고정하고, geo 선착장 4개를 wrapper 모양으로 투영한
   메모리-only 재검사만 별도 PASS로 기록한다. 제품 파일은 수정하지 않았다.

히스토그램 열 약어는 `R/S/X/P/K/E/W/B/Rv/M` =
`ROAD / SIDEWALK / CROSSWALK / PLAZA / PARK / EXIT / WATER / BUILDING / RIVER /
MOUNTAIN`이다. 후보 rect에는 BRIDGE·DOCK·BEACH·ISLAND가 0개다.

## 총괄

| 도시 | grid | 지구/rect | 열린 타일 | 전체 대비 | POI | N/T/P/S | runtime resolver |
|---|---:|---:|---:|---:|---:|---:|---|
| 마르세유 | 406×446 | 4/5 | 32,153 | 17.756633% | 12/12 | 18/18 · **0/0** · 4/4 · 4/4 | **FAIL — ferry source mapping** |
| 마르세유 source 투영 | 동일 | 동일 | 동일 | 동일 | 12/12 | 18/18 · 4/4 · 4/4 · 4/4 | **PASS — 복구 후 기대** |
| 가와구치코 | 567×863 | 3/5 | 43,107 | 8.809554% | 11/11 | 15/15 · 4/4 · 3/3 · 3/3 | **PASS** |

`N/T/P/S`는 `nodes / transitPoints / props / stations`다. 마르세유 runtime의 `0/0`은
선착장이 필요 없다는 뜻이 아니라 wrapper 누락으로 배열 자체가 빈 상태라는 뜻이다.

## 마르세유 후보

```js
open: [
  {
    id: 'vieux-port-panier',
    tiles: { rects: [[140, 100, 223, 190]] },
  },
  {
    id: 'saint-charles-longchamp',
    tiles: { rects: [[224, 90, 320, 225]] },
  },
  {
    id: 'garde-corniche',
    tiles: { rects: [[95, 191, 222, 260]] },
  },
  {
    id: 'if-prado',
    tiles: { rects: [[10, 240, 35, 265], [285, 285, 325, 325]] },
  },
]
```

### 타일·POI·도로 밀도

| 지구 | 타일 | 보행 | 도로 밀도 | POI (개/km²) | R/S/X/P/K/E/W/B/Rv/M |
|---|---:|---:|---:|---:|---|
| `vieux-port-panier` | 7,644 | 51.268969% | 38.278388% | 5 (1.635269) | 2638/938/288/2/53/0/2509/1213/0/3 |
| `saint-charles-longchamp` | 13,192 | 72.741055% | 50.166768% | 2 (0.379018) | 5849/2934/769/1/41/2/13/3544/35/4 |
| `garde-corniche` | 8,960 | 66.462054% | 39.631696% | 3 (0.837054) | 3361/2383/190/1/20/0/1720/1241/2/42 |
| `if-prado` | 2,357 | 56.682223% | 29.401782% | 2 (2.121341) | 648/639/45/0/4/0/517/345/145/14 |

- `vieux-port-panier`는 구항·파니에·라 마조르·뮤셈/생장 요새의 5 POI와 졸리에트·
  구항역, 구항 선착장 3곳을 같은 고밀도 항구권으로 묶는다.
- `saint-charles-longchamp`는 스폰·EXIT·생샤를역에서 롱샹·쿠르 쥘리앵·
  카스텔란까지 이어지는 최고 도로 밀도(50.166768%)의 동부 도심축이다.
- `garde-corniche`는 노트르담 언덕·카탈랑 해변·발롱 데 조프와 `fr-11`을 포함한다.
- `if-prado`는 억지 수면 rect를 만들지 않고 이프성/선착장과 벨로드롬을 두 satellite
  rect로 연다. 이프성은 본토 85,296타일과 분리된 141타일 성분이며 도선 도착으로만
  연결하는 기존 계약을 유지한다.

### 필수 좌표 검증

| 종류 | 좌표 → 지구 | rect 포함 | runtime 판정 |
|---|---|---:|---|
| 스폰 | `[245,124]` → `saint-charles-longchamp` | 1/1 | PASS |
| EXIT | `[245,114]`, `[245,115]` → `saint-charles-longchamp` | 2/2 | PASS |
| 도어 | `fr-07 [218,167]`, `fr-08 [196,139]`, `fr-09 [221,166]`, `fr-10 [222,170]` → `vieux-port-panier`; `fr-11 [206,226]` → `garde-corniche`; `fr-12 [253,172]` → `saint-charles-longchamp` | 6/6 | PASS |
| NPC | 현 source 없음 | 0/0 | PASS |
| 지하철/철도 TRANSIT | `saint-charles [245,124]`, `castellane [256,214]` → `saint-charles-longchamp`; `vieux-port-metro [220,164]`, `joliette [187,109]` → `vieux-port-panier` | raw/resolved 4/4 | exact-1 4/4 PASS |
| 도선 TRANSIT source 좌표 | `vieux-port-quay [223,168]`, `ferry-boat-south [218,177]`, `ferry-boat-north [216,159]` → `vieux-port-panier`; `chateau-dif-landing [24,251]` → `if-prado` | raw/resolved 4/4 | **runtime exact-1 0/4 FAIL** |

마르세유 source 투영에서는 여덟 TRANSIT 모두 raw/resolved 좌표가 같고 8/8 open이다.
현 wrapper만 `(MARSEILLE_GEO.ferryLinks || [])`를 읽어 네 선착장을 잃는다. 적용 전
Claude 소유 도시 파일의 source mapping 복구와 동일 gate 재실행이 필요하다.

## 가와구치코 후보

```js
open: [
  {
    id: 'lakefront',
    tiles: { rects: [[30, 130, 160, 250]] },
  },
  {
    id: 'station-yoshida',
    tiles: { rects: [[150, 251, 230, 310], [290, 240, 400, 420]] },
  },
  {
    id: 'mountain-gates',
    tiles: { rects: [[520, 480, 566, 520], [25, 845, 45, 862]] },
  },
]
```

### 타일·POI·도로 밀도

| 지구 | 타일 | 보행 | 도로 밀도 | POI (개/km²) | R/S/X/P/K/E/W/B/Rv/M |
|---|---:|---:|---:|---:|---|
| `lakefront` | 15,851 | 40.193048% | 18.106113% | 2 (0.315438) | 2870/3443/0/1/57/0/6411/584/348/2137 |
| `station-yoshida` | 24,951 | 70.486153% | 38.162799% | 7 (0.701375) | 9480/8039/42/4/20/2/95/2674/1483/3112 |
| `mountain-gates` | 2,305 | 69.197397% | 21.518438% | 2 (2.169197) | 496/1098/0/1/0/0/8/131/167/404 |

- `lakefront`는 호수·산지 비중 때문에 도로 밀도가 낮지만, 오이시 공원과 호수 POI,
  유람선 두 선착장을 함께 여는 목적형 rect다.
- `station-yoshida`는 스폰·EXIT·도어 3개, 역 3개와 역전/온천·아라쿠라·
  후지요시다·기타구치 POI 7개가 모인 핵심 보행축이다.
- `mountain-gates`는 오시노와 5합목을 두 satellite rect로 묶는다. 5합목 33타일
  분리 성분에 `subaru-5th` story gate, `ja-03`, 버스 정류장이 모두 포함된다.

### 필수 좌표 검증

| 종류 | 좌표 → 지구 | rect 포함 | runtime 판정 |
|---|---|---:|---|
| 스폰 | `[180,288]` → `station-yoshida` | 1/1 | PASS |
| EXIT | `[180,278]`, `[180,279]` → `station-yoshida` | 2/2 | PASS |
| 도어 | `ja-01 [166,259]`, `ja-02 [168,259]`, `ja-04 [177,284]` → `station-yoshida`; `ja-03 [36,853]` → `mountain-gates` | 4/4 | PASS |
| NPC | 현 source 없음 | 0/0 | PASS |
| story gate | `subaru-5th [34,853]` → `mountain-gates` | 1/1 | PASS |
| 철도 TRANSIT | `kawaguchiko [180,288]`, `fujisan [319,370]`, `shimoyoshida [355,291]` → `station-yoshida` | raw/resolved 3/3 | exact-1 3/3 PASS |
| 도선 TRANSIT | `funatsu-pier [148,240]`, `oishi-landing [62,164]` → `lakefront` | raw/resolved 2/2 | **exact-1 2/2 PASS** |
| 등산 버스 TRANSIT | `kawaguchiko-bus-stop [178,286]` → `station-yoshida`; `subaru-5th-stop [38,853]` → `mountain-gates` | raw/resolved 2/2 | exact-1 2/2 PASS |

복구 뒤 runtime `transitPoints` 순서는
`funatsu-pier`, `oishi-landing`, `kawaguchiko-bus-stop`, `subaru-5th-stop`이며
4/4 open이다. 따라서 유람선은 단순 geo 참고가 아니라 실제 open TRANSIT에 포함된다.

## Claude 확정용 라벨 후보

라벨은 이 문서에서 확정하지 않는다. `id`와 rect는 측정 입력이고, 아래 한국어 표기는
Claude 저작 선택지다.

| 도시/id | 1안 | 대안 |
|---|---|---|
| 마르세유 `vieux-port-panier` | 구항·파니에 | 구항·항구 언덕 |
| 마르세유 `saint-charles-longchamp` | 생샤를·롱샹 | 생샤를·쿠르 쥘리앵 |
| 마르세유 `garde-corniche` | 노트르담 언덕·코르니슈 | 본 메르 언덕·해안길 |
| 마르세유 `if-prado` | 이프 방면·프라도 | 이프성·벨로드롬 외곽 |
| 가와구치코 `lakefront` | 가와구치호 북안 | 오이시·호반 |
| 가와구치코 `station-yoshida` | 역전·후지요시다 | 후나츠 온천·요시다 |
| 가와구치코 `mountain-gates` | 오시노·후지 등산 기점 | 오시노·스바루라인 5합목 |

잠금 카피·해금 순서·최종 label은 Claude 소유다. rect를 줄이거나 옮기면 이 문서의
TRANSIT·스폰·EXIT·도어/gate 검사를 다시 실행해야 한다.

## 결정성·회귀 증거

입력은 두 도시 wrapper/geo 4개와 `cityDistricts.js`, `terrain.js`, `worldNodes.js`
총 7파일이다. 파일별 bytes·SHA-256 canonical 목록의 manifest SHA-256은
`c209cb1feecb98b6f65a88e1ab56434b4f0cdbed0fc23aa046e24713f2ad9431`이다.

one-shot은 rect union·타일 히스토그램·POI/도로 밀도·모든 좌표 membership·
raw/resolved TRANSIT·실제 resolver 결과와 마르세유 current/source-projection 차이를
canonical JSON 한 줄로 직렬화했다. 측정기는 검증용 임시 파일이며 산출물에는 포함하지 않는다.

- canonical JSON: 10,189 bytes
- run A SHA-256:
  `8d5fe565898aa2b09ba191f0199feb0b6670ac3b803e80c31c08ab2360d2541a`
- run B: byte-identical, 같은 SHA-256
- one-shot max RSS: run A 97,984 KiB / run B 97,968 KiB
- Node `v22.23.1` (`nvm` 공식 배포판)
- rect 범위 10/10, 지구 간 overlap tile 0
- publication base exact archive 전체
  `set -o pipefail npx vitest run --maxWorkers=4`:
  229 files / 2,242 tests PASS / 110.83s
- measurement snapshot의 최초 기본 병렬 실행은
  `cityDistrictBoundarySigns.test.js`의 5초 제한에서 1건이
  5.70초 timeout됐고, 해당 파일 단독 재실행은 1 file / 5 tests PASS / 테스트 3.32초였다.
  작업자 4개로 CPU 경합을 제한한 같은 snapshot 전체도
  227 files / 2,238 tests PASS / 100.10s였고, publication base 전체는 위와 같이 green이다.
- `git diff --check`: PASS

이 보고서는 두 도시 rect와 현행 source 경계를 고정한다. 가와구치코는 그대로 정본 저작
가능하고, 마르세유는 선착장 wrapper 복구 후 같은 resolver gate가 PASS해야 정본 저작 가능하다.
