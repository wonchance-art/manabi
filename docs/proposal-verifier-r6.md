# R6 도시 geo verifier 프로파일 실측 제안

- 상태: **report-only** — `scripts/verify-city-geo.mjs`·도시 geo·snapshot·runtime·registry·DB 변경 없음
- 기준: `origin/main` `bcc0796bd4de957cc5f98f9e1458a557edd463d9`
- 발주: 이슈 #150 코멘트 `5049590586` T4
- 대상: 제네바(`geneva`)·레만 연안(`leman-riviera`)·브뤼셀(`brussels`)·런던(`london`)
- 측정일: 2026-07-23

## 판정

1. **buildingPct 후보는 네 도시 모두 현행 유지**를 권고한다. 제네바 `[9.5,12.5]`, 브뤼셀
   `[18,22]`, 런던 `[9.5,12.5]`는 exact 관찰값을 0.5pp 중심에 둔 R4·R5의 ±1.5~2.0pp
   규칙과 이미 일치한다. 레만 연안 `[2.0,3.5]`는 산지·호수 분모의 특수형으로 R3에서 승인된
   더 좁은 hard gate이므로 회귀 증거 없이 일반 초기 밴드 `[1,4]`로 완화하지 않는다.
2. **수면 단면 후보**는 제네바 론강 출수부 `160/160m`를 신규 제안하고, 제네바 레만호
   `2200/2200m`, 레만 우시 `6200/6200m`, 시옹성 연안 `2400/2400m`, 런던 웨스트민스터
   `1100/580m`, 타워브리지 하류 `220/220m`로 상향한다. 브뤼셀 운하는 best가 `120/80m`라
   현행 `100/60m`를 유지한다.
3. **bridgeMaxTiles는 네 도시 모두 0 유지**다. 정본 terrain의 BRIDGE 잔존이 모두 0이고,
   제네바 몽블랑교와 런던 타워브리지·웨스트민스터교의 차도 회랑도 공식 verifier에서 통과한다.
   런던 타워 단면은 #192에서 교량과 평행한 오탐 열을 `lon=-0.0810` 개수면으로 옮긴 선례를
   그대로 재현해 `260/260m`가 나왔다.
4. 후보는 현재 정본에서 통과하지만 승인 전에는 hard gate가 아니다. Claude 승인 뒤 Claude 소유
   verifier 라운드에서만 값과 주석을 반영한다.

## buildingPct exact 실측과 후보

공식 분모와 동일하게 `land = 전체 - WATER - RIVER - ISLAND`로 잡고 BUILDING 타일만 세었다.

| 도시(profile) | grid | land tiles | BUILDING tiles | exact | 현행 | R6 후보 | 후보 여유 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 제네바 (`geneva`) | 309×362 | 88,829 | 9,683 | 10.900719% | `[9.5,12.5]` | **유지** | -1.401 / +1.599pp |
| 레만 연안 (`leman-riviera`) | 1342×780 | 509,064 | 13,096 | 2.572565% | `[2.0,3.5]` | **유지** | -0.573 / +0.927pp |
| 브뤼셀 (`brussels`) | 352×613 | 211,948 | 42,543 | 20.072376% | `[18,22]` | **유지** | -2.072 / +1.928pp |
| 런던 (`london`) | 1213×1002 | 1,161,655 | 128,249 | 11.040197% | `[9.5,12.5]` | **유지** | -1.540 / +1.460pp |

### 밴드 선택 규칙

- 제네바·런던은 단핵 중심부와 외곽 녹지를 함께 가진 기존 ±1.5pp 밴드가 exact를 안정적으로
  감싼다. 브뤼셀은 복개 센느·운하·고밀 시가지 분모를 감안한 ±2.0pp 현행이 맞다.
- 레만 연안 exact를 0.5pp 중심으로 초기화하면 `[1,4]`가 되지만, 이는 이미 승인된 R3
  `[2,3.5]`를 넓혀 회귀 감도를 떨어뜨린다. deterministic geo가 byte 고정된 동안은 더 좁은
  현행 gate를 보존하는 편이 안전하다.
- 모든 exact 값은 경계와 최소 0.573pp 떨어져 있다. generator·분류 계약 변경 시에만 재실측한다.

## 수면 단면 20m best-of-5 실측

공식 `scanSection()`과 같은 고정 경도/위도 직교축을 사용하고, 축의 `-2,-1,0,+1,+2` 타일
오프셋 중 `sumM` 최대(동률이면 `runM` 최대)를 채택했다. 각 셀은 20m이며 WATER·RIVER만 수면이다.
아래 오프셋은 `sumM/runM` 순서다.

| 도시·단면 | 좌표 계약 | -2 | -1 | 0 | +1 | +2 | best | 현행 | R6 후보 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 제네바 론강 출수부(신규) | `lon=6.1460`, `lat 46.211→46.202` | 100/80 | 180/180 | 180/180 | 180/180 | 200/200 | 200/200 | 없음 | **160/160** |
| 제네바 레만호 | `lat=46.225`, `lon 6.145→6.185` | 2520/2520 | 2500/2500 | 2460/2460 | 2480/2460 | 2480/2400 | 2520/2520 | 2000/2000 | **2200/2200** |
| 레만 우시 앞바다 | `lat=46.47`, `lon 6.63→6.72` | 6920/6920 | 6920/6920 | 6920/6920 | 6920/6920 | 6920/6920 | 6920/6920 | 6000/6000 | **6200/6200** |
| 레만 시옹성 연안 | `lon=6.915`, `lat 46.430→46.405` | 2680/2680 | 2700/2700 | 2720/2720 | 2740/2740 | 2760/2760 | 2760/2760 | 2200/2200 | **2400/2400** |
| 브뤼셀 운하 | `lat=50.825`, `lon 4.32→4.35` | 120/60 | 120/80 | 60/60 | 60/60 | 60/60 | 120/80 | 100/60 | **100/60 유지** |
| 런던 템스(웨스트민스터) | `lon=-0.1220`, `lat 51.515→51.495` | 1040/620 | 1120/620 | 1200/620 | 1200/620 | 1240/620 | 1240/620 | 200/160 | **1100/580** |
| 런던 템스(타워 하류) | `lon=-0.0810`, `lat 51.515→51.498` | 240/240 | 260/260 | 240/240 | 260/240 | 240/220 | 260/260 | 200/160 | **220/220** |

### 단면 후보 선택 규칙

- best가 1km 이상인 호수·장축 단면은 약 10% 이상 또는 읽기 쉬운 수백 m의 여유를 남겼다.
  제네바 레만호 320m, 우시 720m, 시옹성 360m, 웨스트민스터 합계 140m가 남는다.
- 1km 미만 단면은 원칙적으로 2타일(40m)을 남겼다. 론강과 타워 하류는 합계·연속 모두
  정확히 40m 여유다. 웨스트민스터 연속도 620→580m로 40m를 남긴다.
- 브뤼셀 운하는 best가 120/80m뿐이라 40m를 남기면 현행 하한보다 낮아진다. R5 바르강과 같은
  소수 타일 단면 예외로 현행 100/60m(각 20m 여유)를 유지한다.
- 웨스트민스터의 `sumM`는 장축 스캔이 굽은 템스 수면을 여러 번 통과한 합계이고 `runM`가 실제
  최대 연속 회랑을 나타낸다. 둘을 함께 고정해 지형 질량과 단일 회랑 회귀를 동시에 잡는다.
- 타워브리지 landmark 경도 `-0.0754`는 교량 차도와 평행해 ±2열 모두 false fail하므로 #192의
  개수면 `-0.0810`을 유지한다. 이 후보는 실제 강폭 측량치가 아니라 정본 terrain 회귀 하한이다.

## BRIDGE 잔존과 후보

| 도시 | BRIDGE exact | 현행 `bridgeMaxTiles` | R6 후보 | 교량 회랑 pin |
|---|---:|---:|---:|---|
| 제네바 | 0 | 0 | **0 유지** | 몽블랑교 차도 확인 |
| 레만 연안 | 0 | 0 | **0 유지** | 없음(호안·도선 분리 계약) |
| 브뤼셀 | 0 | 0 | **0 유지** | 없음(운하 단면) |
| 런던 | 0 | 0 | **0 유지** | 타워브리지·웨스트민스터교 차도 확인 |

네 도시 모두 BRIDGE를 허용할 근거가 없다. 다리는 ROAD/CROSSWALK 회랑으로, 고립된 강심 타일은
수면으로 흡수하는 기존 3분류 정책을 유지한다.

## 승인 시 제안 diff 모양

값 검토용이며 이 브랜치에서는 verifier를 수정하지 않는다.

```js
// geneva
buildingPct: [9.5, 12.5],
riverSections: [
  { name: '론강 출수부 단면', lon: 6.1460, latRange: [46.211, 46.202], sumMinM: 160, runMinM: 160 },
  { name: '레만호 단면', lat: 46.225, lonRange: [6.145, 6.185], sumMinM: 2200, runMinM: 2200 },
],
bridgeMaxTiles: 0,

// leman-riviera
buildingPct: [2.0, 3.5],
riverSections: [
  { name: '레만호 우시 단면', lat: 46.47, lonRange: [6.63, 6.72], sumMinM: 6200, runMinM: 6200 },
  { name: '시옹성 연안 단면', lon: 6.915, latRange: [46.430, 46.405], sumMinM: 2400, runMinM: 2400 },
],
bridgeMaxTiles: 0,

// brussels
buildingPct: [18, 22],
riverSections: [
  { name: '운하 단면', lat: 50.825, lonRange: [4.32, 4.35], sumMinM: 100, runMinM: 60 },
],
bridgeMaxTiles: 0,

// london
buildingPct: [9.5, 12.5],
riverSections: [
  { name: '템스(웨스트민스터 단면)', lon: -0.1220, latRange: [51.515, 51.495], sumMinM: 1100, runMinM: 580 },
  { name: '템스(타워브리지 하류 단면)', lon: -0.0810, latRange: [51.515, 51.498], sumMinM: 220, runMinM: 220 },
],
bridgeMaxTiles: 0,
```

## 재현 명령

공식 verifier의 best-of-5 값과 전체 기존 gate는 다음으로 재현한다.

```bash
node scripts/verify-city-geo.mjs --city geneva
node scripts/verify-city-geo.mjs --city leman-riviera
node scripts/verify-city-geo.mjs --city brussels
node scripts/verify-city-geo.mjs --city london
```

각 명령을 독립 프로세스로 두 번 실행해 stdout SHA-256과 byte 동일성을 비교한다. exact building과
오프셋 표는 공식 `terrainShares()`·`makeProjector()`·`scanSection()` 계약을 그대로 사용했다.

## 결정성 기준선

| profile | stdout bytes | SHA-256 run A | run B |
|---|---:|---|---|
| `geneva` | 615 | `b29a531b060d797db0b1b8588d9d5fbebd6b4a161dee41127ec8066bc47a9213` | identical |
| `leman-riviera` | 648 | `4425d3645bb0b9b06a2c38f4642737854e7c009f382ff54e7250f1cf803e9a85` | identical |
| `brussels` | 680 | `5e6c80f3a6df6e2bfc0967c2f71ee9b2eebc2d6257d9267838f8516f79be68d0` | identical |
| `london` | 797 | `5782e4d9acb42b28938d823c1130417bebdff841079e84e1a2a8aebfdb646d4c` | identical |

4도시 exact·7단면·공식 verifier 메타를 합친 compact audit도 독립 2회 byte-identical이었다.

- compact audit JSON SHA-256: `7cfffe15e5b0153d610a9df240be6448b652e8722da06c760669614e65bd33a5`
- canonical payload SHA-256: `492ce38f6007c7da9d74583e63b1b75ad11f443428df5325ece88d5c891bdbb9`

정본 Git blob은 verifier `32d8887734541c594a937e6dee508a542481fdae`, 제네바 geo
`32bcb25ff1663815522fc11b9a4baddce9f45399`, 레만 geo
`b8d01e5cbf879fa6ae3b72576b4a5443b5ba52f9`, 브뤼셀 geo
`19fe6fceeae46c53a05a472d271d995dc973006b`, 런던 geo
`2d4a0dde47de64c9f9c03f8c5192148e641c6fa5`다.

## 검증 근거

- Node `v22.23.1` (`nvm` 공식 배포판)
- official verifier: 4 profiles × 2 runs, 전 gate PASS·stdout byte-identical
- exact building/BRIDGE·7단면 best-of-5 audit: 독립 2회 byte-identical
- targeted: 8 files / 59 tests PASS; max RSS 2,825,551,872 bytes;
  peak footprint 25,103,240 bytes / swaps 0
- full single-worker: 207 files / 2,107 tests PASS; max RSS 2,876,997,632 bytes;
  peak footprint 25,316,328 bytes / swaps 0
- `npm run lint`·`git diff --check`: PASS
- 수정 파일은 이 제안서와 Codex-2 보드뿐이며 verifier·geo·snapshot은 byte 불변
