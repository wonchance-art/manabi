# R5 도시 geo verifier 프로파일 실측 제안

- 상태: **report-only** — `scripts/verify-city-geo.mjs`·도시 geo·snapshot·runtime·registry·DB 변경 없음
- 기준: `origin/main` `5016d2ae390207dda1414993d49daca89bd0cd66`
- 발주: 이슈 #150 코멘트 `5046785647` T2
- 대상: 그랑파리(`grand-paris`)·마르세유(`marseille`)·니스/코트다쥐르(`cote-dazur`)
- 측정일: 2026-07-22

## 판정

1. **buildingPct 후보**는 그랑파리 `[13.5,16.5]`, 마르세유 `[15.5,19.5]`, 코트다쥐르
   `[6.0,9.0]`을 권고한다. 앞 두 도시는 초기 폭을 R4와 같은 관찰 중심 ±1.5~2.0pp로 좁히고,
   다핵 해안·산지 벨트인 코트다쥐르는 이미 그 폭에 있어 현행을 유지한다.
2. **riverSections 후보**는 최종 terrain의 공식 best-of-5 스캔값에서 최소 2타일(40m), 1km 이상
   외해는 약 10%의 회귀 여유를 남겼다. 그랑파리 두 단면은 교량 차도와 정확히 겹치는 열의
   false fail 때문에 공격적으로 조이지 않는다.
3. **bridgeMaxTiles 후보는 세 도시 모두 0 유지**다. 정본 terrain의 BRIDGE 잔존이 각각 0이며,
   프랑스 도시의 교량→ROAD/수면 흡수 정책과 일치한다. 그랑파리의 퐁뇌프·퐁드베르시 차도 pin도
   현재 green이다.
4. 모든 후보는 현재 정본에서 통과하지만 승인 전에는 hard gate가 아니다. Claude 승인 뒤 Claude
   소유 verifier 라운드에서만 값과 주석을 반영한다.

## buildingPct exact 실측과 후보

공식 분모와 동일하게 `land = 전체 - WATER - RIVER - ISLAND`로 잡고 BUILDING 타일만 세었다.
verifier stdout의 1자리 반올림값이 아니라 exact 비율이다.

| 도시(profile) | grid | land tiles | BUILDING tiles | exact | 현행 | R5 후보 | 후보 여유 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 그랑파리 (`grand-paris`) | 1355×891 | 1,171,337 | 176,434 | 15.062616% | `[13,17]` | **`[13.5,16.5]`** | -1.563 / +1.437pp |
| 마르세유 (`marseille`) | 406×446 | 103,983 | 18,113 | 17.419194% | `[15,20]` | **`[15.5,19.5]`** | -1.919 / +2.081pp |
| 니스/코트다쥐르 (`cote-dazur`) | 1571×1169 | 711,607 | 51,604 | 7.251756% | `[6,9]` | **`[6.0,9.0]` 유지** | -1.252 / +1.748pp |

### 밴드 선택 규칙

- R4와 같이 관찰값을 0.5pp 중심으로 놓고 도시 형태에 따라 ±1.5~2.0pp를 확보했다.
- 그랑파리는 단핵 밀집 시가지라 ±1.5pp, 마르세유는 항만·외해 제외 분모 변동을 감안해 ±2.0pp다.
- 코트다쥐르는 앙티브~모나코 다핵 벨트와 MOUNTAIN 질량이 크므로 이미 쓰는 `[6,9]`보다 좁히지
  않는다. 이는 예외 해제가 아니라 현행 hard gate 유지 제안이다.
- 후보 밴드는 현재 exact 값을 소수점 경계에 두지 않는다. 최소 하한 여유는 1.252pp다.

## riverSections 20m 단면 실측

공식 `scanSection()`과 동일하게 고정 경도/위도의 직교축을 스캔하고, 축의 `-2,-1,0,+1,+2`
타일 오프셋 중 `sumM` 최대(동률이면 `runM` 최대)를 채택했다. 각 셀은 20m이며 WATER·RIVER만
수면이다. 아래 오프셋 열은 `sumM/runM` 순서다.

| 도시·단면 | 좌표 계약 | -2 | -1 | 0 | +1 | +2 | best | 현행 `sum/run` | R5 후보 `sum/run` | best 여유 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 파리 센강(트로카데로) | `lon=2.28`, `lat 48.875→48.850` | 140/140 | 120/120 | 140/120 | 160/120 | 180/120 | 180/120 | 120/100 | **140/100** | 40/20m |
| 파리 센강(루브르) | `lon=2.33`, `lat 48.870→48.850` | 160/120 | 80/60 | 0/0 | 40/40 | 120/100 | 160/120 | 120/100 | **120/100 유지** | 40/20m |
| 마르세유 구항 | `lon=5.368`, `lat 43.300→43.288` | 320/320 | 300/300 | 320/320 | 320/320 | 320/320 | 320/320 | 250/250 | **280/280** | 40/40m |
| 마르세유 이프성 해협 | `lat=43.288`, `lon 5.325→5.355` | 2220/2220 | 2200/2200 | 2180/2180 | 2180/2180 | 2180/2180 | 2220/2220 | 1800/1800 | **2000/2000** | 220/220m |
| 니스 바르강 하구 | `lat=43.665`, `lon 7.19→7.21` | 80/80 | 80/80 | 100/80 | 100/100 | 120/120 | 120/120 | 100/60 | **100/80** | 20/40m |

### 단면 후보 선택 규칙

- 1km 미만 단면은 best 실측에서 원칙적으로 2타일(40m)을 남기되, 현행 하한보다 낮추지 않았다.
- 이프성 해협은 2,220m 실측에 약 10%인 220m를 남겨 읽기 쉬운 2,000m로 제안했다.
- `runMinM`도 같은 여유 원칙을 적용했다. 바르강은 합계가 120m뿐이므로 `sumMinM=100`을 유지하고
  연속 하한만 60→80m로 올린다.
- 루브르 단면의 중앙 열 0m는 퐁뒤카루젤 차도와 축이 겹친 결과다. 공식 ±2 best-of-5가 이를
  보정하도록 설계됐으므로, best 160m를 그대로 하한으로 고정하지 않고 현행 120m를 유지한다.
- 후보는 지형의 물리적 폭을 고정하는 회귀 하한이지 실제 강폭 측량치가 아니다.

## BRIDGE 잔존과 후보

| 도시 | BRIDGE exact | 현행 `bridgeMaxTiles` | R5 후보 | 교량 회랑 pin |
|---|---:|---:|---:|---|
| 그랑파리 | 0 | 0 | **0 유지** | 퐁뇌프·퐁드베르시 모두 ROAD/CROSSWALK 확인 |
| 마르세유 | 0 | 0 | **0 유지** | 없음(구항·외해 단면) |
| 니스/코트다쥐르 | 0 | 0 | **0 유지** | 없음(바르강 하구 단면) |

`bridgeMaxTiles`를 1 이상으로 풀 근거는 없다. 그랑파리는 별도 `bridgeCrossings`가 차도 회랑의
생존을 확인하고, 마르세유·니스는 현재 단면 목적상 신규 crossing pin을 추가하지 않아도 된다.

## 승인 시 제안 diff 모양

아래는 값 검토용이며 이 브랜치에서는 verifier를 수정하지 않는다.

```js
// grand-paris
buildingPct: [13.5, 16.5],
riverSections: [
  { name: '센강(트로카데로 단면)', lon: 2.28, latRange: [48.875, 48.850], sumMinM: 140, runMinM: 100 },
  { name: '센강(루브르 단면)', lon: 2.33, latRange: [48.870, 48.850], sumMinM: 120, runMinM: 100 },
],
bridgeMaxTiles: 0,

// marseille
buildingPct: [15.5, 19.5],
riverSections: [
  { name: '구항 단면', lon: 5.368, latRange: [43.300, 43.288], sumMinM: 280, runMinM: 280 },
  { name: '이프성 해협 단면', lat: 43.288, lonRange: [5.325, 5.355], sumMinM: 2000, runMinM: 2000 },
],
bridgeMaxTiles: 0,

// cote-dazur
buildingPct: [6, 9],
riverSections: [
  { name: '바르강 하구 단면', lat: 43.665, lonRange: [7.19, 7.21], sumMinM: 100, runMinM: 80 },
],
bridgeMaxTiles: 0,
```

## 재현 명령

공식 verifier의 best-of-5 값과 전체 기존 gate는 다음으로 재현한다.

```bash
node scripts/verify-city-geo.mjs --city grand-paris
node scripts/verify-city-geo.mjs --city marseille
node scripts/verify-city-geo.mjs --city cote-dazur
```

buildingPct exact 분모·분자는 다음 짧은 one-shot으로 확인할 수 있다.

```bash
node --input-type=module -e '
for (const [id, file] of [["grand-paris","./src/components/world/cities/grand-paris.geo.js"],["marseille","./src/components/world/cities/marseille.geo.js"],["cote-dazur","./src/components/world/cities/cote-dazur.geo.js"]]) {
  const mod = await import(file);
  const geo = mod[Object.keys(mod).find((key) => key.endsWith("_GEO"))];
  const counts = {};
  for (const value of geo.terrain) counts[value] = (counts[value] || 0) + 1;
  const land = geo.terrain.length - (counts[8] || 0) - (counts[11] || 0) - (counts[10] || 0);
  console.log(id, { land, buildingTiles: counts[9] || 0, buildingPct: 100 * (counts[9] || 0) / land, bridgeTiles: counts[5] || 0 });
}'
```

## 결정성 기준선

공식 verifier를 도시별 독립 프로세스로 두 번 실행했고 stdout이 byte-identical이었다.

| profile | stdout bytes | SHA-256 run A | run B |
|---|---:|---|---|
| `grand-paris` | 767 | `19210c1cac2d2bc85fe8161406631414373706b6002594d67c7d9c38c35b65a8` | identical |
| `marseille` | 651 | `b9c6430f1ecd91dcf4f3d7981d132396e1cab01be1bde99bec89327f61289577` | identical |
| `cote-dazur` | 563 | `6ce6521621bff1bd09e94337a3aa74fc8148a1cd0b36cad2b684766eb92e9236` | identical |

정본 Git blob은 verifier `74a3acafd92797c96d50d9b9e19e05009486120c`, 그랑파리 geo
`11ce2febdc869c00b3f02228af1cfbb6d60c7485`, 마르세유 geo
`3ce4e362da8df5e8ebd68b7ef92e450eee9177a1`, 코트다쥐르 geo
`7d170d6708e0c95477dcb669f92ee6ce2b46fef7`다.

## 검증 근거

- Node `v22.23.1`
- squash-merge 후 교체 브랜치 재검증 base: `origin/main` `c0b87b356c5c4b1d4c15cd95edbeafa288e4ab9f`
- official verifier: 3 profiles × 2 runs, 전 gate PASS·stdout byte-identical
- exact building/BRIDGE one-shot: 문서 재현 명령과 exact 일치
- targeted: 6 files / 44 tests PASS; max RSS 2,410,594,304 bytes;
  peak footprint 47,504,272 bytes / swaps 0
- full single-worker: 202 files / 2,081 tests PASS; max RSS 2,424,520,704 bytes;
  peak footprint 49,044,488 bytes / swaps 0
- `npm run lint`·`git diff --check`: PASS
- 수정 파일은 이 제안서와 Codex-2 보드뿐이며 verifier·geo·snapshot은 byte 불변
