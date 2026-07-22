# RFC — 도시 geo 지연 로드 계약

- 상태: **제안(승인 전 구현 금지)**
- 기준: `origin/main` `ca43b24a77e51bc72f00c76ca5452849aaa83a04`
- 발주: 이슈 #150 코멘트 `5045201540`
- 근거: 성능 감사 #378 / `docs/audit-performance.md`
- 원칙: geo bytes·도시 데이터·씬 동작은 바꾸지 않고 초기 module evaluation 범위만 줄인다

## 1. 결론

현재 `cities/index.js`가 26개 도시 adapter를 정적 import하고, 각 adapter가 다시 `*.geo.js`를
정적 import한다. 이 barrel을 다음 두 계약으로 분리한다.

1. **경량 manifest**: `id`, 표시명, `cols`, `rows`, 관리자 뷰어 그룹과 명시적 loader 함수만
   가진다. manifest import만으로 도시 adapter나 `*.geo.js`를 평가하면 안 된다.
2. **도시 payload loader**: `loadCity(id)`가 정확히 한 도시의 adapter를 dynamic import한다.
   같은 ID의 동시 요청은 하나의 Promise로 합치고, 성공 payload는 세션 동안 재사용하며, 실패는
   cache에서 제거해 재시도할 수 있게 한다.

`GameCanvas`는 평상시 도시 scene을 0개로 부팅하고, 도시 진입 확인 뒤 payload를 불러와 Phaser
Scene Manager에 그 도시 scene 하나를 등록한 다음 전환한다. 저장 좌표가 `city:<id>`인 재접속은
Phaser 생성 전에 그 도시 하나만 먼저 불러와 기존 직행 복귀를 보존한다. 관리자 전체맵은 목록에는
경량 manifest만 쓰고, 사용자가 고른 도시 payload 하나만 불러와 그린다.

전수 테스트와 PNG 렌더러는 런타임과 목적이 다르므로 `loadAllCities()`를 명시적으로 호출한다.
따라서 검증 범위는 26도시 그대로 유지하면서 일반 게임 부팅에서는 26개 geo의 JS 파싱과 RLE
즉시 decode가 사라진다.

## 2. 현재 상태와 문제 경계

성능 감사 #378의 기준 head에서 다음을 확인했다.

- `*.geo.js` 26개의 소스 합계는 27,828,565 bytes(26.54 MiB)다.
- 새 realm에서 도시별 adapter+geo module을 평가한 cold 중앙값 합계는 269.5 ms다.
- 반면 이미 평가된 도시의 warm 진입 중앙값 평균은 5.08 ms이며 `buildGrid()`는 상위 도시도
  0.2 ms 이하다.
- 모든 geo module은 평가 시 RLE를 `Uint8Array`로 즉시 decode한다. 현재는 플레이하지 않은
  25개 도시도 `GameCanvas` 청크 평가만으로 source parse와 terrain allocation을 수행한다.

정적 barrel의 실제 소비처는 세 종류다.

| 소비처 | 현재 필요한 것 | 현재 부작용 | 제안 |
|---|---|---|---|
| `GameCanvas.jsx` | ID 존재 여부와 활성 도시 payload | 부팅 때 26 payload·26 scene 생성 | manifest는 즉시, 선택 payload만 지연 로드 |
| `WorldMapPage.jsx` | 도시 목록 메타와 선택 도시 grid/marker | 관리자 페이지 진입 때 26 payload 평가 | 목록은 manifest, 선택 시 payload 로드 |
| 테스트·PNG CLI | 의도적으로 26 payload 전수 | 전수 평가는 정상 | `loadAllCities()`를 명시 호출 |

이번 RFC는 도쿄·코트다쥐르의 **활성 도시 자체 미니맵 메모리 FAIL**을 해결하지 않는다. 그것은
Codex-2 트랙이다. 이 제안은 첫 화면에서 사용하지 않는 26개 payload를 제거하는 부팅 범위 최적화다.

## 3. 목표와 비목표

### 목표

1. plaza·오버월드 일반 부팅에서 city adapter/geo module 평가 수를 26에서 0으로 만든다.
2. 도시 진입과 `city:<id>` 재접속에서는 대상 도시만 1개 로드한다.
3. 도시 ID·표시 순서·격자 크기·게이트·저장 scene key·city payload 객체 모양을 보존한다.
4. 관리자 전체맵에서 목록과 그룹은 즉시 보이되 선택 도시만 로드한다.
5. 기존 전수 검증과 렌더 CLI가 manifest 순서로 26개를 계속 검사하게 한다.
6. 로드 실패·중복 클릭·컴포넌트 unmount에서 빈 화면이나 미등록 scene 전환을 만들지 않는다.
7. 한 줄 설정 또는 구현 PR revert로 eager 동작을 복구할 수 있게 한다.

### 비목표

- `*.geo.js`의 RLE, terrain, railway, POI, station, hash를 재생성하거나 수정하지 않는다.
- RLE를 binary asset으로 바꾸지 않는다. 이는 source parse까지 줄이는 별도 P1 트랙이다.
- 활성 도시의 minimap factor·두 번째 grid 복사·청크 bake 순서를 바꾸지 않는다.
- ESM module cache에서 이미 방문한 도시를 unload한다고 약속하지 않는다. 브라우저에는 표준 module
  unload가 없으므로 한 세션에서 여러 도시를 방문하면 payload는 누적될 수 있다.
- idle prefetch, service worker cache 정책, 네트워크 우선순위, 새 로딩 애니메이션 디자인을 넣지 않는다.
- 도시 순서나 관리자 국가 그룹을 재분류하지 않는다.

## 4. 경량 registry 계약

런타임 public entry인 `cities/index.js`는 도시 adapter의 정적 import를 없애고 다음 의미만 노출한다.
동적 import 경로는 번들러가 도시별 chunk 경계를 확정할 수 있도록 **26개를 문자열 literal로 명시**한다.
템플릿 경로 `import(\`./${id}.js\`)`나 filesystem 열거는 사용하지 않는다.

```js
const ENTRIES = Object.freeze([
  Object.freeze({
    id: 'fukuoka',
    name: '후쿠오카',
    cols: 388,
    rows: 254,
    viewerGroup: 'jp',
    load: () => import('./fukuoka.js').then((module) => module.default),
  }),
  // 현재 CITY_MAPS 순서로 나머지 25개를 명시
]);

export const CITY_MANIFEST = Object.freeze(
  ENTRIES.map(({ load, ...metadata }) => Object.freeze(metadata)),
);

export function hasCity(id) { /* manifest exact ID membership */ }
export function loadCity(id) { /* one loader + Promise cache */ }
export function loadAllCities() { /* manifest 순서의 Promise<city[]> */ }
```

### manifest 불변식

- ID 배열은 현재 `CITY_MAPS.map(city => city.id)` 26개와 순서까지 exact 동일하다.
- ID·표시명·`cols`·`rows`·관리자 그룹은 비어 있지 않고 ID는 중복 0이다.
- `CITY_MANIFEST`에는 `buildGrid`, `nodes`, `stations`, `railways`, `terrain`을 넣지 않는다.
- loader 함수 외에 city adapter나 geo module의 값에서 파생한 필드를 top-level에서 읽지 않는다.
- 새 도시 추가 시 manifest entry와 literal loader를 함께 추가한다.
- metadata 중복은 허용하되 `loadAllCities()` 계약 테스트가 payload의 `id/name/cols/rows`와 exact
  대조해 drift를 fail closed한다.
- 현재 관리자 그룹의 누락·fallback을 포함한 표시 결과를 그대로 보존한다. 그룹 정리는 별도 변경이다.

`CITY_MANIFEST`와 `CITY_DATA`를 같은 이름으로 재사용하지 않는다. 전자는 경량 metadata이고 후자는
현재 full payload map이라는 의미라서, 이름을 유지하면 소비처가 `buildGrid()`를 동기 호출하는
회귀를 컴파일 단계에서 잡기 어렵다.

## 5. loader 상태·오류 계약

`loadCity(id)`는 다음 상태 기계다.

```text
unknown ── loadCity(id) ──> rejected(UNKNOWN_CITY)
idle ── loadCity(id) ──> loading ── success ──> loaded
                            └─ failure ──> idle (재시도 가능)
loading ── 같은 id 요청 ──> 같은 Promise
loaded ── 같은 id 요청 ──> 같은 payload를 주는 cached Promise
```

- 알 수 없는 ID는 import를 시도하지 않고 명시 오류로 거부한다.
- 성공 payload는 `default` export여야 하며 manifest의 `id/name/cols/rows`와 exact 일치해야 한다.
- mismatch는 성공으로 cache하지 않는다.
- 같은 ID의 동시 요청은 import와 RLE decode를 한 번만 실행한다.
- 실패 Promise는 cache에서 제거한다. CDN 일시 오류 뒤 같은 진입 버튼으로 재시도할 수 있어야 한다.
- 서로 다른 도시의 완료 순서는 registry 순서나 `loadAllCities()` 반환 순서를 바꾸지 않는다.
- loader cache와 wall clock은 city bytes, grid, PNG, manifest 직렬화에 들어가지 않는다.

## 6. `GameCanvas` 진입 계약

### 일반 부팅

1. Phaser와 경량 `CITY_MANIFEST`만 준비한다.
2. `WorldScene`, 스토리 scene, 오버월드 scene으로 `Phaser.Game`을 만들며 city scene은 0개다.
3. `hasCity`가 world/region gate의 `gate.to` 유효성을 동기 판정한다.
4. 사용자가 도시 진입을 확정하면 현재 scene을 잠그고 `loadCity(id)`를 시작한다.
5. payload 검증 성공 뒤 `buildCityScene(Phaser, cityData, cityCtx)`를 만들고
   `game.scene.add('city:<id>', Scene, false)`로 한 번만 등록한다.
6. scene 등록 성공 뒤에만 fade-out하고 `scene.start('city:<id>')`한다.

네트워크 로드 전에 fade-out하면 실패 시 검은 화면이 남으므로 순서를 바꾸지 않는다. 로딩 중에는
중복 입력을 막고 도시 진입 패널에 진행 상태를 표시한다. 실패하면 현재 world/region scene과 좌표를
보존하고 패널을 오류+재시도 상태로 돌린다. scene key가 이미 등록됐으면 payload를 다시 build하지
않고 기존 scene을 시작한다.

React 쪽은 full payload를 전역 map으로 보유하지 않는다. `activeCityData` state/ref 하나를 두고
다음 현재 소비를 이 값으로 전환한다.

- 도시 미니맵의 `buildGrid`, `cols`, `rows`, `railways`, `zones`
- 역 행선지 overlay의 `transit`, `stations`
- 활성 도시 아바타 texture 재베이크 대상 탐색

도시 존재 판정과 scene key 열거는 `CITY_MANIFEST`/`hasCity`를 쓴다. `CityScene`, city payload 모양,
`city:<id>` 저장 문자열, `worldNodeReturnSpawn`은 바꾸지 않는다.

### 저장 도시 직행 재접속

저장 위치가 `city:<id>`이면 현재 `WorldScene.create()`가 동기 `scene.start()`를 수행한다. 미등록
scene으로 전환하는 race를 피하기 위해 다음 순서를 고정한다.

1. `initialSpawn.scene`에서 ID를 파싱하고 `hasCity(id)`를 확인한다.
2. `Phaser.Game` 생성 전에 Phaser import와 `loadCity(id)`를 병렬 대기한다.
3. 성공하면 그 도시 scene 하나를 초기 scene 배열에 포함하고 기존 `cityRedirectScene()`을 그대로
   호출한다.
4. 실패·payload mismatch면 city redirect를 허용하지 않고 현재 기본 오버월드 폴백으로 부팅한 뒤
   재시도 가능한 안내를 낸다.

`cityRedirectScene()`의 `{spawn}` 재귀 방지와 순수 테스트는 유지한다. 저장 좌표 정규화·보행성
검사는 기존 `CityScene` 경로를 그대로 탄다.

### lifecycle

- component unmount 뒤 import가 완료돼도 scene add, state update, fade를 실행하지 않는다.
- 같은 도시 scene add는 idempotent해야 한다.
- 현재 구현과 같이 한 번 등록한 Phaser city scene은 GameCanvas unmount까지 유지한다.
- 방문한 ESM payload는 browser module cache에 남을 수 있음을 메모리 보고에 명시한다.

## 7. 관리자 전체맵 계약

`WorldMapPage`의 `MAP_OPTIONS`는 `CITY_MANIFEST`로 즉시 만든다. 각 city option은 metadata만 들고
full `city` 객체를 넣지 않는다.

도시 탭을 고르면 별도 effect가 `loadCity(activeMap.id)`를 호출한다.

- 로딩 시작 시 이전 bitmap·marker를 비우고 spinner를 유지한다.
- 응답 ID가 현재 선택 ID와 같을 때만 grid·transit·marker를 그린다.
- 빠르게 다른 탭을 누른 stale 응답은 무시한다.
- load 실패 시 해당 도시 오류와 재시도 동작을 제공하고 다른 지도 탭은 계속 사용할 수 있다.
- world/overworld 선택은 city loader를 호출하지 않는다.
- 도시 목록 순서, 이름, 크기, zoom, palette, marker, 국가 그룹 UI는 현재와 동일하다.

관리자가 여러 도시를 차례로 열면 이미 평가된 module은 세션 cache에 남는다. 전체맵의 목적이 전수
감사인 만큼 이는 허용하며, 이 RFC의 게이트는 **페이지 첫 진입과 선택 전 0개**, **첫 선택 1개**다.

## 8. 테스트·도구 이관

### 경량 registry 테스트

- manifest ID 26개와 기존 순서 exact
- ID 중복 0, metadata schema, literal loader 26개 1:1
- manifest import 직후 loader 호출 0
- 같은 ID 동시 요청은 loader 호출 1회·동일 payload
- unknown ID는 import 0·명시 오류
- 실패 cache 제거 뒤 재시도 가능(fixture loader)
- 로드 payload의 `id/name/cols/rows`가 manifest와 exact

### 기존 전수 테스트

현재 `CITY_MAPS`/`CITY_DATA`를 쓰는 다음 테스트는 suite 준비 단계에서 `await loadAllCities()`를
명시 호출하고, 반환 배열로 기존 검증을 그대로 수행한다.

- `cityRegistry.test.js`
- `cityTileSkinAssignments.test.js`
- `cityRegionMainRoute.test.js`
- `cityDescCoverage.test.js`
- `studiesRefs.test.js`

전수 배열은 Promise 완료 순서가 아니라 manifest 순서를 보존해야 한다. 도시별 geo 테스트는 각 도시
module을 직접 import하므로 변경하지 않는다.

### PNG 렌더러

`scripts/world/render-city-map.mjs`는 registry에서 정적 full 배열을 받지 않는다.

- ID 인자가 있으면 유효성을 먼저 확인하고 해당 도시만 순서대로 `await loadCity(id)`한다.
- ID 인자가 없을 때만 `await loadAllCities()`로 26개를 렌더한다.
- `renderCityPng(city)` 순수 함수와 PNG bytes는 변경하지 않는다.
- 같은 도시 2회 PNG SHA-256은 기존과 exact 동일해야 한다.

## 9. 결정성·회귀·성능 게이트

### 결정성

- 26개 manifest metadata JSON을 독립 프로세스 2회 직렬화해 byte-identical SHA-256
- 26개 도시 각각 `buildGrid()` 2회 SHA-256 exact 일치
- 대표 대형 도시(도쿄·서울·부산·코트다쥐르) PNG 2회 SHA-256 exact 일치
- lazy 전후 city payload의 ID·격자 크기·node/station 수와 grid SHA exact 일치
- load 완료 순서를 섞은 fixture에서도 `loadAllCities()` 반환 ID 순서 exact

dynamic import 시점은 달라져도 payload module 자체와 `buildGrid()` 입력은 바뀌지 않으므로 기존 geo
결정성 계약은 유지된다. loader cache 상태나 측정 timestamp를 hash 입력에 넣지 않는다.

### 기능 회귀

- plaza/두 오버월드에서 26개 city gate 존재 판정 exact
- 일반 도시 진입, EXIT 복귀, 같은 도시 재진입
- 저장 `city:<id>` 직행, 도시 EXIT 뒤 `{spawn}` 재귀 방지
- load 실패 시 현재 scene·좌표 보존과 재시도
- 도시 minimap, 역 행선지, 아바타 재베이크
- 관리자 world/overworld 0-load, 도시 선택 1-load, 빠른 탭 전환 stale 차단
- targeted 테스트와 전체 `npm test`, `npm run lint`, `npm run build`

### 성능·메모리

Node 22 공식 배포판과 #378 방법론을 그대로 쓴다.

1. 일반 `/world` 부팅: city loader 호출 0, 등록 city scene 0.
2. 저장 도시 부팅: loader 호출 1, 등록 city scene 1.
3. 첫 도시 진입: 대상 city cold import/decode + warm entry를 분리 측정한다.
4. 26개 eager 기준의 cold 중앙값 합계 269.5 ms와 초기 JS 평가 bytes 26.54 MiB가 일반 부팅
   경로에서 제거됐는지 production build와 Chrome trace로 확인한다.
5. plaza 부팅·도쿄 직행·서울 직행을 각각 독립 프로세스에서 측정하고 max RSS, peak footprint,
   swap을 기록한다.
6. 한 세션에서 도시 5개를 순차 방문한 누적 메모리도 별도로 기록해 module cache 한계를 숨기지 않는다.

물리 모바일 절대시간 예산은 이번 RFC에서 임의로 만들지 않는다. 기능 merge 게이트는 loader 수와
scene 수의 exact 계약으로 닫고, wall-clock/RSS는 #378과 같은 환경의 전후 수치로 보고한다.

## 10. 롤아웃과 롤백

승인 뒤 구현은 다음 순서로 한 PR 안에서 진행한다.

1. 경량 manifest·loader와 fixture 테스트를 추가한다.
2. `GameCanvas`를 0/1 city scene 등록 구조로 바꾸고 직행 재접속을 먼저 고정한다.
3. `WorldMapPage`를 선택 도시 async payload 구조로 바꾼다.
4. 전수 테스트와 PNG CLI를 `loadAllCities()`로 이관한다.
5. 결정성 2회, targeted/full/lint/build, 브라우저 진입, 메모리 실측을 수행한다.

구현 PR에는 wall-clock이나 환경변수에 의존하지 않는 임시 상수 `CITY_BOOT_MODE = 'lazy' | 'eager'`를
둔다. 긴급 롤백은 이를 `eager`로 바꿔 `loadAllCities()`를 Phaser 생성 전에 기다린 뒤 기존처럼 26개
scene을 등록하는 한 줄 전환으로 가능해야 한다. eager에서도 payload·scene 계약은 같으므로 저장
데이터나 geo rollback은 없다. 안정화 뒤 이 상수 제거는 별도 정리 PR로 한다.

구조적 롤백은 구현 PR revert 하나다. DB·asset format·geo bytes를 바꾸지 않으므로 역마이그레이션,
생성물 삭제, 저장 좌표 변환이 필요 없다.

## 11. 대안 검토

### A. `GameCanvas`에서만 dynamic import

관리자 전체맵이 계속 정적 barrel을 가져가므로 그 페이지의 26개 평가가 남고, registry가 두 개로
갈라진다. 목록 정본은 하나여야 하므로 채택하지 않는다.

### B. 각 city adapter 안에서 `*.geo.js`만 지연 로드

`buildGrid()`와 현재 payload가 동기 계약이라 26개 adapter 전부를 async factory로 바꿔야 한다.
도시 파일 변경 범위가 커지고 콘텐츠·씬 계약까지 흔든다. adapter 단위 dynamic import가 더 작고
롤백이 쉬워 채택하지 않는다.

### C. 템플릿 경로 context import

ID를 경로에 보간하는 dynamic import는 번들러가 허용 파일 집합과 chunk 경계를 넓게 추론할 수 있고
오타를 build 전에 exact 검증하기 어렵다.
26개 literal loader map을 사용한다.

### D. 부팅 직후 idle prefetch

첫 화면 반응은 빨라져도 결국 26개 terrain을 평가·보유해 메모리 목적을 되돌린다. 기본 정책으로
채택하지 않는다. 향후 인접 도시 1개 prefetch는 별도 실측 뒤 논의한다.

### E. binary geo asset 전환

선택 도시의 JS parser 비용까지 줄일 수 있지만 source format·checksum·fetch 오류 계약이 새로
필요하다. 이번 registry RFC와 독립된 후속 단계다.

## 12. 승인 뒤 예상 파일 경계

RFC 승인만으로 아래 파일 수정 권한이 생기지는 않는다. 구현 발주가 `cities/index.js`,
`GameCanvas.jsx`, `WorldMapPage.jsx` 같은 공유 파일의 소유권 예외를 exact 명시해야 착수한다.

- registry/loader: `src/components/world/cities/index.js` 및 전용 순수 helper(필요 시 신규 1파일)
- 게임 소비처: `src/components/world/GameCanvas.jsx`
- 관리자 소비처: `src/views/WorldMapPage.jsx`
- 도구: `scripts/world/render-city-map.mjs`
- 테스트: 기존 전수 소비 테스트 5개 + lazy registry 전용 신규 테스트
- 보드: Codex-4 열만 별도 커밋
- 금지: 모든 `cities/*.geo.js`, 도시 generator/snapshot, `CityScene.js`, 공식 verifier, DB, 콘텐츠 카피

## 13. 승인 요청

1. 경량 `CITY_MANIFEST` + 26개 literal loader + Promise cache 계약을 승인하는가?
2. 일반 부팅 city scene 0개, 저장 도시/첫 진입 대상 1개만 등록하는 구조를 승인하는가?
3. load 성공 뒤 fade, 실패 시 현재 scene 보존+재시도 UX를 승인하는가?
4. 관리자 전체맵이 목록은 즉시 표시하고 선택 도시만 로드하는 계약을 승인하는가?
5. 테스트·PNG CLI만 `loadAllCities()`로 26개 전수를 명시 로드하는 분리를 승인하는가?
6. 이미 방문한 ESM module은 세션 중 unload하지 않고 누적 한계를 별도 실측으로 보고하는가?
7. 임시 `CITY_BOOT_MODE` eager fallback과 구현 PR 단일 revert를 롤백 계약으로 승인하는가?
8. 승인 후 공유 파일 exact allowlist를 새 구현 SPEC에 명시해 Codex-4에 이관할 것인가?

승인 전에는 제품 코드·registry·geo·테스트를 수정하지 않는다.
