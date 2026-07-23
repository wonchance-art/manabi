# S22 도시 진입 착지점 26도시 전수 감사

- 성격: report-only
- 기준: `origin/main` `009337219c940b0838950e8de409a952bbc800a1`
- 측정일: 2026-07-23 (KST)
- 범위: 26개 도시의 오버월드 도시 게이트 진입 스폰, 도시 내부 `TRANSIT`
  정차지의 저작 타일과 실제 하차 타일, 저장/개발 하니스 직행 스폰
- 비범위: 도시 data/geo, 지구 rect, 런타임, registry, verifier, DB 수정

## 결론

위반은 **0건**이다. 26개 도시 모두 `district-v1`이며, 도시 게이트 26개가 각
도시에 exact-1로 대응한다. 55개 `TRANSIT` 노선의 `stopIds` 참조 180건을
157개 고유 도착점으로 접어 검사한 결과, 저작 타일과 실제
`resolveArrivalTile()` 하차 타일이 모두 open 지구 안이었다. 실제 하차 타일은
157/157 보행 가능했다.

`resolveCityDistricts()`는 정적 도시 착지점에 대해서 이미 fail-closed 게이트다.

1. `city.entrance`를 `spawn entrance`로 검사한다
   (`src/components/world/cityDistricts.js:79-80`).
2. 모든 `transit[].stopIds`를 수집하고 `stations + transitPoints`에서 exact-1로
   해석한다 (`cityDistricts.js:62-71`).
3. 저작 stop 타일이 open인지, `resolveArrivalTile()`로 계산한 실제 보행 하차
   타일이 존재하고 open인지 모두 검사한다 (`cityDistricts.js:72-75`).
4. 이 검사는 지구 resolve 반환 전에 항상 실행된다 (`cityDistricts.js:104-136`).

기존 단위 테스트도 spawn 또는 TRANSIT 타일을 잠금 지구로 옮기면 resolve가
throw함을 고정한다 (`src/components/world/__tests__/cityDistricts.test.js:228-240`).
S22 재현 테스트는 이 계약을 26개 실제 payload 전체로 확장한다
(`src/components/world/__tests__/cityEntrypointsAudit.test.js:22-147`).

## 진입 경로가 도시 좌표로 수렴하는 방식

| 경로 | 도시 안 최종 좌표 | 근거 | 판정 |
|---|---|---|---|
| 전국 오버월드 도시 게이트 | 별도 좌표를 전달하지 않고 `city:<id>` 시작 → `city.entrance` | `GameCanvas.jsx:1791-1799`, `CityScene.js:1366-1373` | 전 6도시 PASS |
| APAC/EMEA 도시 게이트 | `worldReturn`만 전달 → `data.spawn` 없음 → `city.entrance` | `overworldRegionScene.js:447-463`, `CityScene.js:1370-1373` | 전 20도시 PASS |
| 오버월드 페리 | 지역 오버월드의 상대 항구 좌표에 하선; 도시 안으로 직접 시작하지 않음 | `overworldRegionScene.js:480-510` | 후속 도시 게이트에서 entrance 사용 |
| EMEA 철도·횡단 회랑 | 지역 오버월드 철도 허브 또는 회랑 플랫폼에 하차; 도시 안으로 직접 시작하지 않음 | `overworldRegionScene.js:610-675` | 후속 도시 게이트에서 entrance 사용 |
| 항공 | 광장/지역 오버월드 공항 좌표로 전환; 도시 안으로 직접 시작하지 않음 | `overworldRegionScene.js:688-706`, `GameCanvas.jsx:1993-2011` | 후속 도시 게이트에서 entrance 사용 |
| 도시 내부 철도·지하철·버스·도선 | 목적 stop의 `resolveArrivalTile()` 결과 | `CityScene.js:1807-1819` | 고유 157/157 PASS |

따라서 페리·철도·항공·횡단 회랑은 서로 다른 **오버월드** 착지 좌표를 갖지만,
도시 정밀맵 진입 좌표 유형을 추가하지 않는다. 도시 안에서는 모두 같은 도시
게이트 계약을 거쳐 `entrance`로 수렴한다.

## 26도시 전수표

`노선/참조/착지`는 `transit` 노선 수 / `stopIds` 총 참조 수 / 고유 stop 수다.
`재배치`는 저작 stop 타일과 실제 `resolveArrivalTile()` 결과가 다른 수다.
모든 행의 `PASS`는 지구 버전, 게이트 exact-1, entrance open·보행, 동적
entrance respawn, 저작/실제 TRANSIT open, 실제 TRANSIT 보행을 함께 뜻한다.

| 도시 | 오버월드 게이트 | entrance | mode | 노선/참조/착지 | 재배치 | 판정 |
|---|---|---:|---|---:|---:|---|
| fukuoka | fukuoka | `[239,70]` | ferry, subway | 6/18/15 | 4 | PASS |
| tokyo | tokyo | `[543,1040]` | train | 2/12/10 | 0 | PASS |
| osaka | osaka | `[414,187]` | train | 2/14/13 | 0 | PASS |
| kyoto | kyoto | `[404,422]` | bus, train | 3/13/10 | 0 | PASS |
| busan | busan | `[684,695]` | subway | 2/8/7 | 0 | PASS |
| seoul | seoul | `[797,753]` | subway | 2/9/8 | 0 | PASS |
| grand-paris | paris | `[934,329]` | subway, train | 3/7/6 | 0 | PASS |
| mont-saint-michel | mont-saint-michel | `[380,840]` | — | 0/0/0 | 0 | PASS |
| cote-dazur | nice | `[813,253]` | train | 1/6/6 | 0 | PASS |
| brussels | brussels | `[54,357]` | train | 1/3/3 | 0 | PASS |
| taipei | taipei | `[136,346]` | subway | 2/6/5 | 0 | PASS |
| hong-kong | hong-kong | `[371,180]` | ferry, subway | 2/6/6 | 0 | PASS |
| london | london | `[603,381]` | subway, train | 3/10/8 | 0 | PASS |
| shanghai | shanghai | `[111,150]` | ferry, subway | 3/7/6 | 0 | PASS |
| beijing | beijing | `[203,282]` | subway | 1/2/2 | 0 | PASS |
| brisbane | brisbane | `[227,257]` | ferry, train | 3/7/6 | 0 | PASS |
| sydney | sydney | `[169,517]` | ferry, subway | 5/12/9 | 0 | PASS |
| canberra | canberra | `[405,441]` | train | 1/2/2 | 0 | PASS |
| melbourne | melbourne | `[294,213]` | subway, train | 2/6/4 | 0 | PASS |
| marseille | marseille | `[245,124]` | ferry, subway | 4/9/8 | 0 | PASS |
| kawaguchiko | kawaguchiko | `[180,288]` | bus, ferry, train | 3/7/7 | 0 | PASS |
| geneva | geneva | `[144,164]` | ferry | 1/2/2 | 0 | PASS |
| leman-riviera | leman-riviera | `[112,130]` | ferry, train | 2/12/12 | 0 | PASS |
| lyon | lyon | `[270,219]` | train | 1/2/2 | 0 | PASS |
| bordeaux | bordeaux | `[331,302]` | — | 0/0/0 | 0 | PASS |
| strasbourg | strasbourg | `[128,250]` | — | 0/0/0 | 0 | PASS |
| **합계** | **26 exact-1** | **26 open·보행** | 4종 | **55/180/157** | **4** | **0 위반** |

## 실제 재배치 4건

후쿠오카 도선의 저작 포인트 4개는 보행 하차 조건 때문에 인접 보행칸으로
결정 재배치된다. 저작 포인트와 실제 하차점 모두 open 지구이므로 위반이 아니다.

| stop id | 저작 타일 | 실제 하차 타일 | 저작 open | 실제 open·보행 |
|---|---:|---:|---|---|
| bayside-ferry | `[240,67]` | `[240,66]` | PASS | PASS |
| bayside-channel | `[226,42]` | `[229,39]` | PASS | PASS |
| international-ferry | `[236,47]` | `[237,46]` | PASS | PASS |
| international-channel | `[247,19]` | `[245,23]` | PASS | PASS |

## `resolveCityDistricts()`가 직접 보지 않는 경로

정적 착지점 누락은 없지만, 다음 세 항목은 이 함수의 책임 범위 밖이다. S22
테스트가 교차 계약을 보강했고 현재 도시별 위반은 모두 0건이다.

| 비포섭 유형 | 별도 보호 | 26도시 결과 |
|---|---|---|
| 오버월드 `gate.type:'city'`의 존재·유일성 | S22가 `ALL_WORLD_NODES`와 `CITY_MANIFEST`를 대조해 exact-1 강제 | 26/26 PASS |
| 저장 세션 및 dev `?spawn=city:<id>@x,y`의 동적 좌표 | `resolveRespawnTile()`의 entrance 보행 성분 검사 후 `districtOpenAt`; 실패하면 entrance 폴백 (`CityScene.js:1366-1373`, `WorldPage.jsx:438-450`) | 26/26 entrance 재현 PASS, 잠금 좌표 수용 경로 없음 |
| entrance 자체의 보행 가능성 | 지구 게이트는 open만 검사하므로 S22가 실제 grid의 `isCityWalkable`을 추가 검사 | 26/26 PASS |

즉 “게이트가 안 보는 진입 좌표 유형”은 동적 세션/dev spawn 하나지만, 그 좌표는
CityScene에서 별도 fail-closed 처리된다. 정적 도시별 위반이나 수정 대상은 없다.

## 재현성과 테스트

- 테스트: `src/components/world/__tests__/cityEntrypointsAudit.test.js`
- 2회 canonical JSON byte-identical
- SHA-256:
  `dc7581fb1d4a85591864a254d8108c17b1f2483befaaadbbccbd09665b8dd64a`
- 측정 내용: 26 city payload, 26 city gates, 55 transit lines, 180 stop
  references, 157 unique arrivals, 4 deterministic relocations
- 런타임: 공식 nvm Node `v22.23.1`
  (`/Users/chaeyeonwon/.nvm/versions/node/v22.23.1/bin/node`)
- targeted: 1 file / 1 test PASS (13.81초)
- 최종 `set -o pipefail` single-worker 전체 Vitest:
  231 files / 2,248 tests PASS (338.37초), pipeline exit 0,
  max RSS 2,557,008 KiB
- `npm run lint`: PASS
- `git diff --check`: PASS
- 실행:

```bash
set -o pipefail
npx vitest run src/components/world/__tests__/cityEntrypointsAudit.test.js
```
