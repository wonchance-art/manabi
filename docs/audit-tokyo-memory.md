# 도쿄 미니맵 메모리 긴급 원인 감사

- 상태: **report-only** — 제품 코드·geo·registry·verifier·DB 변경 없음
- 기준: `origin/main` `52910c19baceace809038c9372f38ddd1fb0fc02`
- 발주: 이슈 #150 코멘트 `5045143688`
- 선행 실측: PR #378 / `docs/audit-performance.md`
- 측정일: 2026-07-22

## 판정

1. 도쿄의 **40.11 MiB**는 POI 수나 RLE 소스 파일 크기보다 미니맵의 불연속 factor 정책이
   만든 베이킹 비용이다. 40.11 MiB 중 최종 표시 canvas backing만 30.72 MiB(76.6%), source
   베이킹 버퍼까지 합치면 37.55 MiB(93.6%)다. geo 핵심 배열은 2.56 MiB(6.4%)다.
2. 도쿄는 894,864 cells라 `cells > 1,000,000` 조건을 105,136 cells 차이로 통과하지 못해
   factor 1에 고정된다. 3배 표시 배율이 양 축에 적용되어 최종 backing이 원 grid의 9배 RGBA가 된다.
3. 코트다쥐르는 도쿄보다 큰 1,836,499 cells라 factor 2를 받지만, 최종 backing 15.79 MiB와
   geo 핵심 배열 5.25 MiB가 합쳐져 계약식 24.55 MiB, 런타임 하한 27.18 MiB다.
4. 최소 복귀안은 **도쿄 factor 2, 코트다쥐르 factor 3**이다. 현 산식 그대로도 런타임 하한이
   각각 13.23 MiB와 15.97 MiB로 내려가 24 MiB 안에 10.77 MiB·8.03 MiB 여유를 만든다.
5. factor는 독립 메모리 할당이 아니라 베이킹 해상도를 정하는 원인 변수다. 따라서 아래 기여율은
   geo·source 베이킹·최종 backing의 합으로 잡고, factor 효과는 반사실적 전후 차이로 별도 제시한다.

## 40.11 MiB 계약식이 뜻하는 것

PR #378이 사용한 기존 계약은 프로세스 RSS가 아니라 다음 명시적 배열·canvas의 합이다.

```text
계약 피크 = geo terrain Uint8Array
          + geo railway mask Uint8Array
          + city entry grid Uint8Array
          + source 크기 RGBA 버퍼 × 2
          + 최종 표시 canvas RGBA backing
```

`GameCanvas.jsx`의 도시 미니맵은 `buildGrid()`로 entry grid를 한 번 더 만들고, source 크기의
offscreen canvas와 `ImageData`를 만든 뒤, `CITY_MINI_SCALE = 3`인 최종 canvas로 확대한다.
factor 2 이상이면 `downsampleCityGrid()`가 source 크기의 `Uint8Array codes`와
`Int8Array priorities`도 만든다. 계약식에 후자의 런타임 임시 배열을 더한 값이 런타임 하한이다.

여기서 "베이킹"은 **도시 미니맵 raster 생성**을 뜻한다. PR #378의 warm-entry 청크 베이킹
3.8 ms와 Phaser 청크 텍스처 메모리는 40.11 MiB 산식에 포함되지 않는다.

## 현재 exact 분해

기준선은 24 MiB = 25,165,824 bytes다.

| 도시·항목 | exact bytes | MiB | 계약 내 비중 |
|---|---:|---:|---:|
| 도쿄 geo 핵심 배열: `894,864 × 3` | 2,684,592 | 2.560 | 6.4% |
| 도쿄 source 베이킹: `824 × 1086 × 4 × 2` | 7,158,912 | 6.827 | 17.0% |
| 도쿄 최종 backing: `2472 × 3258 × 4` | 32,215,104 | 30.723 | 76.6% |
| **도쿄 계약 합계** | **42,058,608** | **40.110** | **100.0%** |
| 도쿄 두 번째 `buildGrid()` | +894,864 | +0.853 | 계약 밖 runtime |
| 도쿄 factor 1 다운샘플 임시 배열 | +0 | +0.000 | 계약 밖 runtime |
| **도쿄 런타임 하한** | **42,953,472** | **40.964** | 24 MiB 대비 170.7% |
| 코트다쥐르 geo 핵심 배열: `1,836,499 × 3` | 5,509,497 | 5.254 | 21.4% |
| 코트다쥐르 source 베이킹: `786 × 585 × 4 × 2` | 3,678,480 | 3.508 | 14.3% |
| 코트다쥐르 최종 backing: `2358 × 1755 × 4` | 16,553,160 | 15.786 | 64.3% |
| **코트다쥐르 계약 합계** | **25,741,137** | **24.549** | **100.0%** |
| 코트다쥐르 두 번째 `buildGrid()` | +1,836,499 | +1.751 | 계약 밖 runtime |
| 코트다쥐르 `codes` + `priorities` | +919,620 | +0.877 | 계약 밖 runtime |
| **코트다쥐르 런타임 하한** | **28,497,256** | **27.177** | 24 MiB 대비 113.2% |

### geo "크기"의 두 의미

- **resident grid 크기**는 계약식에 직접 들어간다. terrain·railway mask·entry grid의 1 byte/cell
  3종이라 도쿄 2.56 MiB, 코트다쥐르 5.25 MiB다. 더 큰 코트다쥐르의 총계가 더 작은 사실이
  factor가 지배 원인임을 보여준다.
- **`.geo.js` 소스 크기**는 도쿄 1,924,430 bytes(1.835 MiB), 코트다쥐르
  1,514,231 bytes(1.444 MiB)다. 이는 부팅 시 JS 파싱·RLE decode 비용에는 관여하지만
  40.11/24.55 MiB 계약식에는 더하지 않는다. 이 항목은 Codex-4 lazy-load 트랙과도 분리한다.
- POI·역 객체 수 역시 이 계약식의 항이 아니다. 현재 도쿄 grid가 824×1086으로 고정된 한
  POI 확장 자체를 40.11 MiB의 직접 원인으로 돌릴 근거는 없다.

## factor의 인과 기여

현재 정책은 다음 불연속 식이다.

```text
cells <= 1,000,000  → factor 1
cells > 1,000,000   → ceil(sqrt(cells / 500,000))
```

도쿄는 factor 1이라 source 824×1086과 최종 2472×3258을 유지한다. 반면 코트다쥐르는
factor 2로 source 786×585까지 줄어든다. factor를 한 단계 올린 반사실적 결과는 다음과 같다.

| 도시 | factor | 베이킹 합계 | 계약 합계 | 런타임 하한 | 24 MiB 하한 여유 |
|---|---:|---:|---:|---:|---:|
| 도쿄 현재 | 1 | 37.550 MiB | 40.110 MiB | 40.964 MiB | -16.964 MiB |
| **도쿄 제안** | **2** | **9.387 MiB** | **11.948 MiB** | **13.228 MiB** | **+10.772 MiB** |
| 코트다쥐르 현재 | 2 | 19.294 MiB | 24.549 MiB | 27.177 MiB | -3.177 MiB |
| **코트다쥐르 제안** | **3** | **8.575 MiB** | **13.830 MiB** | **15.971 MiB** | **+8.029 MiB** |

- 도쿄 factor 1→2는 계약식 28.162 MiB, 런타임 하한 27.736 MiB를 줄인다. geo 2.560 MiB와
  두 번째 grid는 그대로이고, 새 다운샘플 임시 배열 0.427 MiB가 생겨도 충분히 여유롭다.
- 코트다쥐르 factor 2→3은 계약식 10.719 MiB, 런타임 하한 11.206 MiB를 줄인다.
- 두 제안은 20% headroom 목표(19.2 MiB)까지 만족한다. 다만 최종 목표 headroom과 실제 모바일
  기기 실측은 오너 승인 항목이며, 이 감사에서 제품 값을 바꾸지 않는다.

## 현재 게이트의 구멍

1. `cityMinimap.test.js`는 도쿄 factor 1을 명시적으로 고정하고 부산·서울 backing만 제한한다.
   도쿄에 대한 24 MiB 합계 assertion은 없다.
2. 코트다쥐르 파이프라인 테스트는 exact 25,741,137 bytes를 고정하면서 `< 25 MiB`를 허용한다.
   저장소 운영 계약 `< 24 MiB`보다 1 MiB 느슨해 24.55 MiB 위반을 green으로 만든다.
3. 도시별 테스트는 계약식만 보고, 두 번째 grid와 factor 2+의 `codes`·`priorities`를 빠뜨린다.
   코트다쥐르는 이 누락만 2.628 MiB다.
4. `drawFrame()`은 260 ms blink마다 `canvas.width`·`canvas.height`를 다시 대입한다. 브라우저가
   이전 backing을 즉시 회수하지 않으면 실제 순간 피크는 이 하한보다 클 수 있다.

## 24 MiB 복귀 제안 — 승인 전 구현 금지

### P0 — byte-budget 기반 factor

cell threshold를 버리고, 현재 exact 산식에서 **목표 예산을 만족하는 최소 factor**를 고른다.
계약식과 런타임 하한을 모두 평가해야 하며, 첫 적용값은 도쿄 2·코트다쥐르 3이다.
도로·출구 우선순위를 보존하는 기존 다운샘플 계약은 재사용하되, 지도 판독성과 구역 라벨 충돌은
Claude가 두 도시 실제 미니맵을 비교해 승인한다.

### P0 — 전 도시 단일 hard gate

`CITY_MAPS` 전 도시에서 24 MiB 계약식과 런타임 하한을 함께 검사하고, 코트다쥐르의 25 MiB 예외와
도쿄 factor 1 pin을 제거하는 후속 SPEC이 필요하다. 권장 기본 목표는 20% headroom이지만 최종값은
오너가 확정한다.

### P1 — transient·재베이킹 축소

별도 승인 라운드에서 Minimap의 두 번째 `buildGrid()` 대신 활성 scene grid를 재사용하면 도쿄
0.853 MiB, 코트다쥐르 1.751 MiB를 없앨 수 있다. 정적 미니맵 backing과 동적 플레이어/차량 overlay를
분리하면 blink마다 canvas 크기를 재설정하는 재할당 위험도 제거할 수 있다. 두 항목은 factor 수정의
필수조건이 아니며, 단일 진실원·scene 수명·cleanup 계약을 먼저 설계해야 한다.

## `mainRoute` 공식 검증 계약 제안 — 승인 전 verifier 수정 금지

mainRoute 구현 #385는 순수 helper와 전용 테스트에서 이미 typed waypoint·URDL BFS·저장 RLE를
검사한다. 공식 `scripts/verify-city-geo.mjs`에는 아직 route 프로필이 없으므로, Claude 소유
verifier에 아래 **선택적 `mainRoute` gate**를 이관하는 방안을 제안한다. geo 전용 프로필과 경로
연출 계약을 섞지 않도록 `CITY_GATES.lyon.mainRoute`가 존재할 때만 실행하고 다른 25도시는 무변경한다.

권장 프로필 pin은 다음과 같다.

```js
mainRoute: {
  id: 'lyon-classic-loop',
  algorithm: 'cardinal-bfs-v1',
  neighborOrder: 'URDL',
  excludeExit: true,
  waypointKeys: [
    'station:perrache', 'node:bellecour', 'node:vieux-lyon',
    'node:fourviere', 'node:terreaux', 'node:opera',
    'node:croix-rousse', 'node:halles', 'station:part-dieu',
  ],
  segmentPathSha256: [
    '781ae7cb3d7fe322b8f37b450359fc182042eeb1b4ffc44b4dc131a794bf5392',
    '0cb15b9e2b234357109e66485b9894504dc22de636edbc962142a53662a0e8b4',
    '1c72c078a5097d20ed0873df071615b97e0d683b1f61e2a1223996dde5237d67',
    'e149ceb0cc0f74e2254a99a90643fc7cd2d3554833930877b60b1870e311e7da',
    '075090c44b399a578127829cc5468f5f353817eccbe77403fac55cb6a31380e4',
    '7e26891c1d43fc8c9551b4436ff3968d45ab1a9c794857215808cd3b6094621e',
    '739014d9831e9190517f81ae1d79c157cac7bf6d5f277e9aefaac4fff47825f0',
    '94d03b490e14a1daf94fc288072e944ae70b048a3647e3857a8f1b597d006f48',
  ],
  routePathSha256: '782589e1aefed848f114874d22087a47ca3bbbcf0056a53064fd6d9ccd432c7c',
}
```

검증 순서는 다음처럼 fail-closed로 고정한다.

1. 도시 wrapper의 `mainRoute.id`·routing 3필드와 typed waypoint 9열을 프로필과 exact 비교한다.
2. 각 `{kind,id}`를 `nodes` 또는 `stations`에서 exact-1로 해석하고, tile이 bounds 안·보행 가능·
   `EXIT` 아님을 검사한다.
3. 인접 waypoint 8쌍마다 동일 `URDL` FIFO 4방 BFS를 **독립 재산출**한다. 모든 연속 tile의
   Manhattan distance는 1, blocked·EXIT 진입은 0이어야 한다.
4. 재산출 경로를 저장 `stepsRle`와 exact 비교하고 `stepCount`·`tileCount`·구간
   `pathSha256(uint32le row-major indices)` 8개를 프로필과 대조한다.
5. 구간을 endpoint 중복 없이 이어 waypoint가 offset 순서대로 등장하는지 확인하고 전체
   `routePathSha256`를 대조한다. 독립 재산출을 2회 직렬화해 byte-identical도 확인한다.
6. `mainRoute` 프로필이 없는 도시는 route import·BFS·출력을 모두 건너뛰어 기존 verifier stdout과
   메모리 계약을 보존한다.

helper를 그대로 호출하면 구현과 검증이 같은 오류를 공유할 수 있으므로, 공식 verifier는 작은 독립
BFS·RLE decode·SHA 계산을 소유하는 편이 낫다. 다만 wrapper import는 `.geo.js` 단독 검사보다 무거워
질 수 있어 `--city lyon --route-file src/components/world/cities/lyon.js` 같은 명시 입력을 권장한다.
프로필 값·CLI 모양·실제 저작은 Claude 승인 뒤 Claude 소유 라운드에서 확정한다.

## 재현 근거

- Node `v22.23.1`
- one-shot exact 산식 JSON 2회 byte-identical
- SHA-256: `ac7c3b66f35e2661578cf346e14fed75d1eac2147f32a0d374d76937bda4f757`
- 감사 하네스 max RSS 195,772,416 bytes / peak footprint 169,196,304 bytes / swaps 0
- targeted: 8 files / 57 tests PASS; max RSS 2,682,961,920 bytes;
  peak footprint 48,995,216 bytes / swaps 0
- full single-worker: 199 files / 2,058 tests PASS; max RSS 2,468,003,840 bytes;
  peak footprint 24,382,296 bytes / swaps 0
- `npm run lint`·`git diff --check`: PASS
- 정본 blob: `cityMinimap.js` `7ec9359abcf6055d4fd47db9ba5c9249af367457`,
  `GameCanvas.jsx` `5685b343a89427c63f5d3113ff7375223da0b9e9`,
  `tokyo.geo.js` `bfa08336bf7778e4c150ff67670dc387c8b2316b`,
  `cote-dazur.geo.js` `7d170d6708e0c95477dcb669f92ee6ce2b46fef7`,
  `cityMainRoute.js` `0a3f8f08d5ecd56083abf98e3e9ac6fdb0a8d9ea`,
  `lyon.js` `7771b16b442b13aa9deee106880eb472f3904abb`
- 제품 구현·geo 재생성·공유 runtime·registry·verifier·DB 변경 없음
