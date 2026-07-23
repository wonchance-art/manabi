# V3 오토타일 26도시 렌더 회귀 벤치

- P8 상태: **report-only** — 제품 코드·테스트·자산·DB 무수정
- P9 상태: **mask 단일 계산 구현** — `CityScene` 제품 코드+회귀 테스트, 렌더 불변
- 측정 입력: `origin/main` `d93981b8d32f2ccc5bb363ac22984d6635ee127e`
- 최종 검증 기준: `origin/main` `f014ffc2eb680507b1b46995080f21226067cd8f`
- P9 구현 기준: `origin/main` `cd92eb40407971f46349b3d84d73c82dad55799d`
- 선행: #493 merge(`fac33cd492dd3e12e2518b2ef403dad7c3c52a39`), 26/26
  `roadStyle: 'autotile-v1'`
- 환경: macOS arm64, 공식 nvm Node `v22.23.1`, Vitest `v4.1.4`
- 측정일: 2026-07-23 KST

## 결론

1. production `CityScene.bakeChunk()` JS 경로의 결정적 128청크 표본에서 그랑파리
   `+3.24%`, 런던 `+1.43%`는 5% 게이트 안이다. 도쿄는 `+5.62%`로 게이트를
   0.62%p 넘었다.
2. 완전 잠금 128청크에서는 그랑파리 `+1.61%`, 런던 `+1.37%`지만 도쿄가
   `+10.37%`로 회귀했다. 잠금 guidebook 도로도 같은 오토타일 이웃 탐색을 쓰기 때문이다.
3. 미니맵 bake는 `-0.81~+1.72%`이고, 지형 RGBA+잠금 오버레이 SHA-256이 도시별로
   on/off·3회 모두 일치한다. 미니맵 경로는 `roadStyle`을 읽지 않으므로 회귀 없음으로 판정한다.
4. retained scene의 GC 후 JS heap은 `-0.59~-0.02%`로 증가하지 않았다. active가 추가로
   보유하는 external backing은 세 도시 모두 정확히 `69,632B`(68 × 16 × 16 × RGBA)다.
   max RSS는 `-38.50~+2.39%`로 방향이 뒤집혀 allocator/JIT 잡음보다 작은 신호이며,
   절감 근거로도 회귀 근거로도 쓰지 않는다.
5. 첫 texture preload는 68개 오토타일 텍스처 때문에 `+15.74~+21.35%`지만 절대 증가는
   도시당 `0.034~0.038ms`다. 비율 게이트는 넘으므로 원인과 후보를 아래에 남기되,
   이번 report-only 라운드에서는 구현하지 않는다.

## A/B 계약

### 조건

| 조건 | 도시 payload | 런타임 경로 |
|---|---|---|
| 활성 | 현 main 그대로, `roadStyle: 'autotile-v1'` | 4방 mask 16종+inner |
| 비활성 | 같은 payload 복제본에서 `roadStyle`만 메모리상 삭제 | 기존 v/h/x 방향 |

geo·grid·district·mainRoute·rail·청크 좌표·draw 수는 동일하다. 비활성 조건은 소스 파일을
편집하지 않았고, 임시 하니스 외 작업 트리 변경도 만들지 않았다.

### 시간

- `CityScene.preload()`와 `CityScene.bakeChunk()`를 그대로 호출했다.
- RenderTexture의 GPU `batchDraw`만 no-op으로 두었다. 따라서 아래 값은 P4
  `docs/bench-districts-savings.md`와 같은 **production JS 상대 wall-clock**이며,
  브라우저 Canvas/GPU 절대시간이 아니다.
- 도시의 전체 청크를 좌표 순으로 만들고 처음·끝을 포함해 128개를 균등 표본화했다.
  잠금 경로는 완전 잠금 청크만 같은 방식으로 128개를 골랐다.
- 한 독립 프로세스에서 3회 warm-up 뒤 on/off 순서를 교대하며 31 paired pass를 실행하고
  각 조건 p50을 얻었다. 이 프로세스를 도시별 3회 실행한 뒤 조건별 중앙값을 비교했다.
- 표본당 draw 수는 도쿄 일반/잠금 `33,264/32,048`, 그랑파리 `32,771/32,313`,
  런던 `32,645/32,258`로 on/off exact다.

### heap·RSS

도시·조건별 독립 프로세스를 3회 띄웠다. GC 뒤 빈 측정점에서 scene을 준비하고, 실제 입구의
320×288 viewport+pad 1에 해당하는 초기 청크를 retained 상태로 둔 뒤 다시 GC했다.
초기 청크는 도쿄·런던 16개, 그랑파리 9개다. 16×16 타일 texture와 512×512 RenderTexture에는
RGBA backing 하한을 할당했다.

`heap`은 이 retained 지점의 전체 `heapUsed`, `max RSS`는 프로세스 전체 최고치다. 둘 다
Vitest·city adapter/geo module을 포함하고 GPU texture는 포함하지 않으므로 절대 제품 예산이 아니라
동일 프로세스 계약의 보조 A/B다.

## 도시 scene bake

각 셀은 3개 독립 프로세스에서 얻은 p50들의 중앙값이다.

| 도시 | 비활성 | 활성 | 변화 | 5% |
|---|---:|---:|---:|---|
| 도쿄 | 69.222ms | 73.111ms | **+5.62%** | FAIL |
| 그랑파리 | 38.938ms | 40.201ms | +3.24% | PASS |
| 런던 | 48.177ms | 48.865ms | +1.43% | PASS |

3회 raw p50(ms):

| 도시 | 비활성 1/2/3 | 활성 1/2/3 |
|---|---|---|
| 도쿄 | 69.222 / 63.339 / 144.678 | 73.111 / 65.727 / 148.113 |
| 그랑파리 | 42.649 / 38.889 / 38.938 | 40.474 / 40.201 / 39.724 |
| 런던 | 48.118 / 48.412 / 48.177 | 48.611 / 49.531 / 48.865 |

도쿄 3회차처럼 시스템 부하가 절대값을 약 2배 움직여도 같은 pass 안에서 조건을 교대했다.
따라서 절대 ms는 기기 성능치로 일반화하지 않고 조건별 3회 중앙값과 아래 호출 프로파일로 판정한다.

## 잠금 guidebook bake

| 도시 | 비활성 | 활성 | 변화 | 5% |
|---|---:|---:|---:|---|
| 도쿄 | 70.012ms | 77.272ms | **+10.37%** | FAIL |
| 그랑파리 | 43.020ms | 43.714ms | +1.61% | PASS |
| 런던 | 49.155ms | 49.826ms | +1.37% | PASS |

3회 raw p50(ms):

| 도시 | 비활성 1/2/3 | 활성 1/2/3 |
|---|---|---|
| 도쿄 | 70.012 / 69.310 / 176.962 | 74.856 / 77.272 / 186.261 |
| 그랑파리 | 43.020 / 43.711 / 42.580 | 43.714 / 44.518 / 42.927 |
| 런던 | 49.155 / 49.626 / 49.136 | 49.741 / 50.408 / 49.826 |

guidebook은 이름·상세 프롭을 줄이는 정책이지만 도로 topology는 유지한다. 따라서 잠금 도로도
`ct_guidebook_road_autotile_*`을 선택하며 도쿄의 높은 도로 비중에서는 이웃 탐색 비용이 남는다.

## 미니맵 회귀

실제 `buildGrid()` → 승인 factor → `downsampleCityGrid()` → RGBA 채움 → 잠금 1px 빗금
오프스크린 bake 루프를 재현했다.

| 도시 | factor | 비활성 | 활성 | 변화 | 지형+잠금 SHA-256 |
|---|---:|---:|---:|---:|---|
| 도쿄 | 2 | 174.727ms | 177.733ms | +1.72% | `857d8f628fd1c55a4261a68be728fc0b21ebfc591be1d08d8f5e069082ab94d0` |
| 그랑파리 | 2 | 133.002ms | 132.550ms | -0.34% | `7067bb068ccb8b70463d23052d8cb9a013f8b1a370731ecfb893a6f9d1bb32e9` |
| 런던 | 2 | 156.110ms | 154.838ms | -0.81% | `7573237cb9d6d87c960658d5ab520401d41ed0f3654d2fa5314fb00f66297886` |

세 SHA는 각 도시의 on/off 6개 산출에서 모두 하나로 수렴했다. `Minimap`은 지형 코드와 district
open mask만 소비하고 `roadStyle`·texture key를 소비하지 않는다.

## heap·RSS

| 도시 | heap 비활성→활성 | 변화 | max RSS 비활성→활성 | 변화 |
|---|---:|---:|---:|---:|
| 도쿄 | 356.53→356.45MiB | -0.02% | 712.70→707.34MiB | -0.75% |
| 그랑파리 | 521.31→520.41MiB | -0.17% | 1,134.27→1,161.42MiB | +2.39% |
| 런던 | 516.60→513.54MiB | -0.59% | 1,101.97→677.75MiB | -38.50% |

런던처럼 RSS 방향과 폭이 JS heap·deterministic backing과 정합하지 않는 것은 독립 프로세스의
module parse/JIT·allocator 회수 시점 차이다. 반복 가능한 메모리 신호는 세 도시 모두 같은
`+69,632B` external backing뿐이며 5% heap 회귀는 없다.

## 5% 초과 원인 프로파일

도쿄의 같은 128청크를 한 번 더 bake하면서 실제 메서드 호출을 셌다.

| 경로 | 타일 | roadLike | `tileCode` 비활성→활성 | 변화 | 활성 `roadMask` |
|---|---:|---:|---:|---:|---:|
| 일반 | 32,336 | 16,201 (50.10%) | 101,060→173,805 | +71.98% | 28,776 |
| 완전 잠금 | 32,048 | 15,329 (47.83%) | 93,364→161,101 | +72.55% | 27,517 |

비활성 `roadDirection()`은 roadLike 타일마다 cardinal 4칸을 한 번 본다. 활성
`roadAutotileTexKey()`는 먼저 `roadInteriorAt()` 안에서 `roadMask()`를 계산하고,
inner가 아니면 key를 만들기 위해 `roadMask()`를 다시 계산한다. 그 결과 일반/잠금 표본의
`roadAutotileTexKey` 16,361/15,329회에 비해 `roadMask`가 28,776/27,517회 호출되고,
전체 `tileCode` probe가 약 72% 증가했다. 도쿄 표본은 절반가량이 roadLike라 이 중복이
5% wall-clock 게이트 밖으로 드러난다.

texture preload의 비율 회귀는 별개다. 비활성은 기존 276개, 활성은 344개를 만들며 차이 68개는
ROAD·CROSSWALK·BRIDGE·guidebook road의 각 `16+inner`다. 대형 3도시에는 mainRoute가 없어
mainRoute autotile 17개는 이 수에 들어가지 않는다.

## 개선 후보 — 구현하지 않음

1. **mask 단일 계산**: `roadAutotileTexKey()`가 `const mask = roadMask(...)`를 한 번 만들고,
   그 mask를 inner 대각 검사와 key 선택에 함께 넘긴다. 전역 cache 없이 중복 cardinal probe만
   제거하므로 첫 후보가 가장 작다.
2. **필요 시 청크-local cache**: 1번 뒤에도 도쿄가 실제 브라우저 5%를 넘으면 bake 중인
   16×16 청크에만 mask+inner scratch를 둔다. 도시 전체 1 byte/cell cache는 도쿄 약 0.85MiB를
   상주시켜 P8의 heap 무회귀를 훼손하므로 우선하지 않는다.
3. **legacy texture 지연**: 26/26 opt-in과 rollback 기간이 끝난 뒤에만 기존 v/h/x texture를
   비오토타일 도시가 있을 때 생성하도록 검토한다. 현재 rollback·불변 테스트 계약을 바꾸는
   결정이므로 P8에서 제거하지 않는다.
4. 위 후보를 구현하는 별도 라운드는 실제 Phaser Canvas/GPU에서 초기 입구 9~16청크,
   도쿄 도로 고밀도 팬, 잠금 경계 팬을 다시 통과해야 한다.

## 결정성

wall-clock·heap·RSS를 제외한 grid SHA, 표본 청크 좌표, draw 수, texture 수, 초기 청크,
미니맵 해시를 canonical JSON으로 분리했다. 도시×조건 6조합은 각각 3/3 같은 SHA로 수렴했고,
6개 조합을 고정 순서로 합친 15,150B manifest는 다음과 같다.

```text
aggregate  6a3ec4d2fb1d69dada395e8d4a360eabccdcd803fd497db9522e840e6fb677d3

tokyo active          d9d55b08fd5b4432d483749aa78d3e0bb3e92d53a2d2224be7440b8d28df568f
tokyo inactive        46efe2cd242d2d45b7b9d7264de31d30c6c35202f96beb6e2c60c881b580c5e3
grand-paris active    dd61faacc824e05ffc625e6f50d174940c2e62d673f36182b0e677b8b8368da5
grand-paris inactive  782a8327933867668c373cf0d01591c94591addcb3dec02e6454d236eac537ce
london active         6cbb44d81462cd5eb2c95e8d45259b2a7e3092ab382d86cf1052d085935fe6a7
london inactive       3fd6636e97e587197c21a50a9addbab4e76054877632c1c5f888d7621fa0def4
```

임시 하니스와 raw JSONL은 보고서 작성 뒤 제거하며 체크인하지 않는다.

## P10 — 결정적 성능 상한 가드

wall-clock·heap·RSS 대신 같은 입력에서 항상 같은 **호출·probe·할당 수**를 세는
`cityRenderPerfGuard.test.js`를 신설했다. 측정 기준은 P9 미병합 `origin/main`
`9d19d75fce0d476f350bf092d8410541bc499495`이며, 도쿄의 P8 동일 표본(전체 청크 또는 완전
잠금 청크를 행 우선으로 열거한 뒤 처음·끝 포함 128개 floor 균등 표본)을 실제
`CityScene.bakeChunk()`에 넣는다. RenderTexture의 GPU draw만 no-op이고 지형 key 선택,
district, railway, mainRoute 분기는 제품 메서드 그대로다.

상한은 main 실측의 약 1.5배를 올림했다. 이 기준은 P9 merge 전에도 green이고, P9의 mask 단일
계산이 들어오면 `tileCode` probe가 일반 `124,145`, 완전 잠금 `112,349`로 감소하므로 상한을
각각 2.10배·2.15배 남긴다. 따라서 P10이 P9 merge를 막지 않고, 이후 큰 중복 탐색만 회귀로 잡는다.

| 경로·지표 | main 실측 | 상한 |
|---|---:|---:|
| 일반 scene `bakeChunk` 호출 | 128 | 192 |
| 일반 scene `tileCode` probe | 173,805 | 260,708 |
| 일반 scene `batchDraw` 호출 | 33,264 | 49,896 |
| 완전 잠금 `bakeChunk` 호출 | 128 | 192 |
| 완전 잠금 `tileCode` probe | 161,101 | 241,652 |
| 완전 잠금 `batchDraw` 호출 | 32,048 | 48,072 |

미니맵은 별도 복제 구현을 만들지 않는다. 테스트가 `GameCanvas.jsx`의 비공개 도시 미니맵 분기
본문을 읽어 VM에서 그대로 실행하고, 실제 `downsampleCityGrid()`·`resolveCityDistricts()`·
`cityDistrictOpenAt()`을 계측한다. 도쿄 승인 factor 2에서 main 실측과 상한은 다음과 같다.

| 미니맵·잠금 지표 | main 실측 | 상한 |
|---|---:|---:|
| `buildGrid` / layout / downsample / lock resolve | 각 1 | 각 2 |
| downsample 원본 grid read | 894,864 | 1,342,296 |
| terrain+lock offscreen canvas 할당 | 2 | 3 |
| ImageData 할당 / `putImageData` | 각 1 | 각 2 |
| 잠금 open probe | 223,716 | 335,574 |
| 잠금 1px `fillRect` | 160,440 | 240,660 |
| 첫 frame `drawImage` | 2 | 3 |
| blink interval 할당 | 1 | 2 |

26도시 렌더 결정성 스모크는 새로 중복하지 않았다. 기존 `cityRoadAutotile.test.js`가 전 도시의
모든 지형·mainRoute render key를 순회해 도시별 SHA를 committed snapshot에 고정하므로, 두 번
같다는 A/B 검사보다 강하게 이전 실행과의 동일 SHA까지 검사한다. 같은 파일의 5계열
`16종+inner` texture command도 독립 2회 SHA 동일을 검사한다. P9의 26도시 PNG before/after는
제품 변경 검증 근거로 유지하되 매 전체 Vitest에서 PNG 52장을 다시 만들지는 않는다.

## 검증

| 검증 | 결과 |
|---|---|
| autotile·chunk·minimap·district targeted | 8 files / 75 tests PASS / 30.72s |
| 경계 팻말 timeout 단독 재현 | 1 file / 5 tests PASS / 3.52s |
| `set -o pipefail` 전체 single-worker Vitest | **229 files / 2,242 tests PASS / 288.35s / exit 0** |
| `npm run lint` | PASS |
| `git diff --check` | PASS |

전체 첫 재실행에서는 `cityDistrictBoundarySigns.test.js`의 24도시 전수 테스트가 기본 5초를
5.88초에 넘어 timeout 1건이 났다. 직전 동일 전체 실행은 229/2,242 PASS였고, 현재 트리 단독
재실행은 2.37초에 통과했다. 최종 전체는 E11 대형 geo 부하 선례와 같은
`--testTimeout=30000`을 CLI로 명시해 assertion 변경 없이 green을 확인했다.

기존 `contentOverrides.test.js`의 확장자 없는 dynamic-import Vite 경고 1건 외 실패는 없다.
기존 untracked `.codex4-p4-local/`은 별도 clone이라 Vitest가 중복 수집하지 않도록
`--exclude='.codex4-p4-local/**'`만 적용했으며 디렉터리 내용은 수정하지 않았다.

P8에서는 오토타일·미니맵·잠금 렌더 구현, 도시 wrapper/geo, registry, shared verifier,
자산과 DB를 수정하지 않았다.

## P9 — mask 단일 계산 구현

P8 개선 후보 1순위를 그대로 적용했다. `roadAutotileTexKey()`가 cardinal mask를 먼저 한 번
계산하고, `roadInteriorAt()`에 그 값을 넘겨 inner 대각 검사와 일반 key 선택이 같은 mask를
소비한다. 직접 호출되는 `roadInteriorAt(tx, ty)`의 기존 계약은 기본 인자로 유지했다. 도시 전체
mask map이나 상주 cache는 추가하지 않아 payload·scene 수명·메모리 계약은 바꾸지 않는다.

회귀 테스트는 mask 3과 mask 15+대각4에서 texture key 하나당 `roadMask()`가 정확히 한 번만
호출되는 것을 고정한다. 기존 16종+inner texture command·26도시 render-key snapshot은
업데이트하지 않았다.

### P8 동일 paired A/B 재측정

P8과 같은 production `CityScene.bakeChunk()` JS 경로, 도시별 독립 프로세스 3회, 프로세스마다
3 warm-up 뒤 31 paired pass, 전체/완전 잠금 128청크 floor 균등 표본을 사용했다. 조건도
동일하다. 활성은 현 `autotile-v1`, 비활성은 같은 payload에서 `roadStyle`만 메모리상 제거한
legacy 방향 경로다. 따라서 서로 다른 실행 시점의 절대 ms가 아니라 각 라운드 안의 paired
활성/비활성 차이와 P8 대비 그 차이의 축소를 판정한다.

| 경로 | 도시 | P8 비활성 | P8 활성 | P8 변화 | P9 비활성 | P9 활성 | P9 변화 | P8 대비 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 일반 | 도쿄 | 69.222ms | 73.111ms | +5.62% | 40.086ms | 40.311ms | **+0.56%** | -5.06%p |
| 일반 | 그랑파리 | 38.938ms | 40.201ms | +3.24% | 38.341ms | 38.270ms | **-0.19%** | -3.43%p |
| 일반 | 런던 | 48.177ms | 48.865ms | +1.43% | 48.857ms | 48.670ms | **-0.38%** | -1.81%p |
| 완전 잠금 | 도쿄 | 70.012ms | 77.272ms | +10.37% | 45.620ms | 47.175ms | **+3.41%** | -6.96%p |
| 완전 잠금 | 그랑파리 | 43.020ms | 43.714ms | +1.61% | 41.892ms | 41.975ms | **+0.20%** | -1.41%p |
| 완전 잠금 | 런던 | 49.155ms | 49.826ms | +1.37% | 49.928ms | 49.878ms | **-0.10%** | -1.47%p |

P9 3회 raw p50(ms):

| 경로 | 도시 | 비활성 1/2/3 | 활성 1/2/3 |
|---|---|---|---|
| 일반 | 도쿄 | 40.159 / 40.086 / 40.072 | 40.295 / 40.383 / 40.311 |
| 일반 | 그랑파리 | 38.154 / 38.341 / 38.404 | 38.181 / 38.270 / 38.443 |
| 일반 | 런던 | 47.592 / 49.189 / 48.857 | 47.742 / 48.670 / 48.986 |
| 완전 잠금 | 도쿄 | 46.420 / 45.323 / 45.620 | 46.622 / 48.329 / 47.175 |
| 완전 잠금 | 그랑파리 | 41.892 / 41.798 / 42.412 | 41.896 / 41.975 / 42.407 |
| 완전 잠금 | 런던 | 50.175 / 49.928 / 49.592 | 50.003 / 49.878 / 49.621 |

일반·완전 잠금 모두 세 도시 5% 게이트 안이다. 특히 P8에서 실패했던 도쿄는 일반
`+5.62→+0.56%`, 완전 잠금 `+10.37→+3.41%`로 돌아왔다.

### 도쿄 probe 감소

같은 P8 도쿄 표본과 instrumentation을 사용했다. 비활성 수는 구현과 무관하게 고정됐고,
활성 `roadMask`는 `roadAutotileTexKey` 호출 수와 같아져 중복 cardinal 계산이 0이 됐다.

| 경로 | 비활성 `tileCode` | 활성 `tileCode` P8→P9 | 증가 P8→P9 | 증가폭 축소 | 초과 probe 제거 |
|---|---:|---:|---:|---:|---:|
| 일반 | 101,060 | 173,805→124,145 | +71.98%→**+22.84%** | -49.14%p | 68.27% |
| 완전 잠금 | 93,364 | 161,101→112,349 | +72.55%→**+20.33%** | -52.22%p | 71.97% |

| 경로 | `roadAutotileTexKey` | `roadMask` P8→P9 | 중복 `roadMask` P8→P9 |
|---|---:|---:|---:|
| 일반 | 16,361 | 28,776→16,361 | 12,415→0 |
| 완전 잠금 | 15,329 | 27,517→15,329 | 12,188→0 |

남은 `+20~23%` probe는 mask 15에서 inner 판정을 위해 보는 대각 4칸이며, 이번 중복 cardinal
계산 제거 범위와 다르다. 이 신호만으로 도시 전체 cache를 추가하지 않는다.

### 26도시 PNG 렌더 불변

공식 nvm Node `v22.23.1`로 `scripts/world/render-city-map.mjs`를 구현 전/후 각각 전 도시
독립 출력했다. 다음 SHA-256은 모든 행에서 **before = after**다.

| 도시 | PNG SHA-256 (before = after) |
|---|---|
| beijing | `91d5e6263cde8cb4ec86abfaadc3fbfcd79b59d0c569aa35f3359ec46814a112` |
| bordeaux | `a3bc02d0618a2acedb487a28f0ae7c703b2aac39e5c4b9d96c159deac8a6f29c` |
| brisbane | `8d1683afa4ca51f496d8c47eab19cd09d65f332de83d0592a5f204884a5f9780` |
| brussels | `d54944cdd06755cd425213bde530be78ebb01e7d6dc5d7eafb0cbfd440e8f1c6` |
| busan | `ad48e9f4368f7b65369b01c565d8f5d5acdb74e7d29fd6d08ab0d66700c6fe9d` |
| canberra | `a62ad6766759b5746af1b88549e92393dbb84a8d3a3584e37ec0f1c13dc15f67` |
| cote-dazur | `c56d714de623f69ac7ac7bcffe7470ee26022bcfd4c7ad4a9888e8513b057b85` |
| fukuoka | `80062add7fb81ef98cdb8a358d98fee13a2de9039d83308ccd90e18af7a346fb` |
| geneva | `771a7fdf65540ca76d13c71677345b48cd6d7876c3b55c57b5316e5652c4e6c2` |
| grand-paris | `d98147b000ba5d4199918c6830cb896b6640f3b2fc47f91571d8faaf70bd38b9` |
| hong-kong | `1040b67629029ffc9979293e406715fb104d89660b5f04c19023de1c2dec895c` |
| kawaguchiko | `17c6f8a68e2cc0f9d2d6e8070cc58d37a9e51eaef604c81a9c02665b5d22b464` |
| kyoto | `75f4604b71f097e3322bbc79f6969d9dfca298303ebdb359f522e99e594bb227` |
| leman-riviera | `7c0bc1a4e9eeafcf9b8023c2b392dc19164719f2930e698be2fde680a9b5ffaa` |
| london | `5e9ec03bf2378acd949b43253845592c23f938dd092eee105d60a1487431ef59` |
| lyon | `c9bd9c2a6fdca82825da65a8cd6de95e5df040171b9a2b914a090b92fec530ff` |
| marseille | `2a9ae2ea3a848c94f380ad29b72b0d15f942d5111c8857e306a70b72821b7bf7` |
| melbourne | `fdaaf77bd194fc5e8b3a3afef41270a062b784e330bcf529c82c2d403ce0fa49` |
| mont-saint-michel | `15ede312d99aef09131c4d3ed3987a9f86bafd6d91bf22dfe2d525041636747e` |
| osaka | `298f5b2f9678317906ec35c373ad4cb49c470a86ec5e36767e1c323394caf4bf` |
| seoul | `b674be7921c2f0aebda8cd230e1bda7b8147881a91b6cee7dfbdcf0cc8156a02` |
| shanghai | `1be783500a9caeeac9bab69a0447bd39ed9d15cd5d7c4c047f941a2e3ecafe23` |
| strasbourg | `7b6f1cf241f999bc5cc77b74e7ef8c58d2ade8515d4e854d10a190502a8f0709` |
| sydney | `95c2cf729c65ebcfc1d5e4773a745670f19a36dbf004273e6ef112b06ad3a6ca` |
| taipei | `3a84eb73a6166f3dee5b5d6bb7ab6383ae336c7478b44234007f5ecda2880563` |
| tokyo | `4860469d5aa05ccec1181f53cb9f41e9e297b57875579d58d9dd864ce9a20337` |

정렬된 26행 SHA manifest도 before/after byte-identical이며 SHA-256은
`17bb931bde2b22e5d895a11d103141f789bf4ab4e3cf4ef4e4297cc6fe3c4739`다.

### P9 검증

| 검증 | 결과 |
|---|---|
| autotile·chunk·district·mainRoute·tile-skin·lazy-smoke targeted | 8 files / 92 tests PASS / 49.92s |
| 26도시 PNG before/after | 26/26 byte-identical |
| `cityRoadAutotile` snapshot SHA-256 | `ecbed3b4351c0033b304fb0b8cb864e68bea080d3882d16745038d9c6787a493` (무변경) |
| 전체 single-worker Vitest (`--testTimeout=30000`) | **230 files / 2,248 tests PASS / 317.01s / exit 0** |
| 전체 테스트 최대 RSS | 2,578,960KiB (`zsh time %M`) |
| `npm run lint -- --ignore-pattern '.codex4-p4-local/**'` | PASS |
| `git diff --check` | PASS |

임시 벤치 하니스·raw JSON·PNG는 체크인하지 않는다. P9 변경 범위는 `CityScene`의 mask 단일
계산, 해당 호출 횟수 회귀 테스트, 이 보고서와 Codex-4 보드뿐이다. 도시 wrapper/geo, registry,
shared verifier, snapshot, 자산과 DB는 수정하지 않는다.
