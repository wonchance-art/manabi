# 여행책 지구 후보 rect 실측 제안

- 상태: **report-only / D2 입력 데이터** — runtime·도시 데이터·registry·DB·검증기 변경 없음
- 기준: stacked base `codex2/verifier-r6-proposal`
  `e5b7c4e746a757ff0efbfd2549ed77b747a29517`
- 발주: 이슈 #150 코멘트 `5049669206` T5
- 대상: 보르도·스트라스부르·서울·부산·코트다쥐르·레만 연안, 리옹 기준선
- 측정일: 2026-07-23

## 결론

1. 각 도시를 3~4개 후보 지구로 나눈 `districts.open[].tiles.rects` 입력안을 아래와 같이 제안한다.
   rect는 **양 끝 포함** `[x0, y0, x1, y1]`이고, 한 지구는 여러 rect의 합집합일 수 있다.
2. 후보 합집합은 여섯 도시의 현재 TRANSIT 도착점 33개, 도시 스폰 6개, EXIT 12개,
   학습 문 3개를 모두 포함한다. 범위 밖 rect·해석 불가 stop·닫힌 필수 gate는 각각 0개다.
3. `returnNode`는 도시 내부 타일이 아니라 오버월드 노드 id다. 여섯 id가 모두
   `ALL_WORLD_NODES`에서 해석됨을 확인하고, 도시 측 복귀 안전성은 `entrance`와
   `geo.exitTiles`가 열린 합집합 안에 있는지로 검증했다.
4. 서울의 원거리 일반 POI 3개(`gimpo-airport`, `seoul-nat-univ`, `amsa-dong`)만 후보 밖이다.
   이들은 TRANSIT·spawn·EXIT·door가 아니므로 fail-closed 선행조건을 깨지 않는다. D2에서
   잠금 콘텐츠로 유지하거나 별도 해금 단계에 작은 rect를 추가할 수 있다. 나머지 도시는
   node·transitPoint·prop·station 앵커가 모두 후보 안이다.
5. 리옹은 기존 8개 mainRoute leg 각각의 최소 단일 bbox 합집합이 8,517타일이며 경로
   492 unique 타일을 모두 포함한다. D2 예비안은 각 bbox에 6타일 여유를 준 동일 8개 rect로,
   합집합 12,609타일이며 역시 전 경로를 포함한다.

## 집계

`N/T/P/S`는 각각 `nodes / transitPoints / props / stations`의 열린 수와 전체 수다. stations는
요청된 세 앵커와 별도로 표기했다. 현재 TRANSIT 소비처가 `stations + transitPoints`로 stop을
해석하므로 도착점 사전검증에 반드시 포함해야 하기 때문이다.

| 도시 | grid | 지구/rect | 열린 타일 | 전체 대비 | 열린 N/T/P/S | 필수 gate | 결과 |
|---|---:|---:|---:|---:|---:|---:|---|
| 보르도 | 474×501 | 3/4 | 11,813 | 4.974439% | 9/9 · 0/0 · 3/3 · 1/1 | 3 | PASS |
| 스트라스부르 | 405×446 | 3/3 | 6,781 | 3.754083% | 7/7 · 0/0 · 3/3 · 1/1 | 3 | PASS |
| 서울 | 1721×1448 | 4/5 | 147,184 | 5.906241% | 20/23 · 0/0 · 3/3 · 9/9 | 11 | PASS |
| 부산 | 1320×1114 | 4/9 | 111,329 | 7.570929% | 14/14 · 0/0 · 4/4 · 7/7 | 10 | PASS |
| 코트다쥐르 | 1571×1169 | 4/6 | 181,486 | 9.882173% | 18/18 · 0/0 · 3/3 · 6/6 | 9 | PASS |
| 레만 연안 | 1342×780 | 4/4 | 159,959 | 15.281344% | 15/15 · 5/5 · 4/4 · 7/7 | 18 | PASS |

열린 타일 수는 rect 합집합의 unique tile 수다. 후보 지구끼리 겹치지 않게 경계를 잡아 지구별
타일 수의 합과 도시 합집합 수가 일치한다.

## 후보 payload와 지구별 앵커 수

아래 모양은 RFC의 `districts.open[].tiles.rects`에 그대로 옮길 수 있는 입력 후보다. id와 해금
순서는 D2 저작 시 변경할 수 있지만, 필수 gate를 품은 rect를 줄일 때는 같은 사전검증을 다시 해야 한다.

### 보르도

```js
open: [
  { id: 'gare-saint-jean', tiles: { rects: [[305, 285, 365, 325]] } },
  { id: 'centre-historique', tiles: { rects: [[235, 188, 315, 255]] } },
  { id: 'nord-rive', tiles: { rects: [[235, 140, 290, 187], [335, 85, 370, 115]] } },
]
```

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `gare-saint-jean` | 2,501 | 0/0/0/1 | 스폰·EXIT 2·생장역 |
| `centre-historique` | 5,508 | 6/0/2/0 | 부르스·대성당·피에르 다리 등 중심부 |
| `nord-rive` | 3,804 | 3/0/1/0 | 샤르트롱·공원·시테 뒤 뱅 |

현재 도시 TRANSIT line과 학습 문은 없다. `returnNode: 'bordeaux'` 해석과
스폰 `[331,302]`, EXIT `[331,292]`, `[331,293]` 포함을 확인했다.

### 스트라스부르

```js
open: [
  { id: 'gare', tiles: { rects: [[110, 232, 131, 265]] } },
  { id: 'grande-ile', tiles: { rects: [[132, 248, 205, 292]] } },
  { id: 'quartier-europeen', tiles: { rects: [[238, 165, 290, 215]] } },
]
```

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `gare` | 748 | 0/0/0/1 | 스폰·EXIT 2·스트라스부르역 |
| `grande-ile` | 3,330 | 5/0/2/0 | 대성당·프티트프랑스·클레베르 등 |
| `quartier-europeen` | 2,703 | 2/0/1/0 | 유럽의회·오랑주리 |

현재 도시 TRANSIT line과 학습 문은 없다. `returnNode: 'strasbourg'` 해석과
스폰 `[128,250]`, EXIT `[128,240]`, `[128,241]` 포함을 확인했다.

### 서울

```js
open: [
  { id: 'historic-core', tiles: { rects: [[780, 570, 995, 790]] } },
  { id: 'west', tiles: { rects: [[550, 700, 700, 970]] } },
  { id: 'southeast', tiles: { rects: [[1020, 970, 1230, 1095], [1340, 950, 1410, 1010]] } },
  { id: 'river-north', tiles: { rects: [[870, 791, 1120, 900]] } },
]
```

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `historic-core` | 47,736 | 13/0/2/4 | 스폰·EXIT·서울/시청/종각/동대문역·도심 POI |
| `west` | 40,921 | 2/0/1/2 | 홍대·여의도와 두 역 |
| `southeast` | 30,917 | 3/0/0/3 | 강남·삼성·잠실역과 COEX·롯데·선정릉 |
| `river-north` | 27,610 | 2/0/0/0 | 서울숲·이태원 |

TRANSIT 도착 8개 `seoul`, `city-hall`, `jonggak`, `dongdaemun`,
`hongik-university`, `gangnam`, `samseong`, `jamsil`과 스폰 `[797,753]`, EXIT
`[797,743]`, `[797,744]`가 모두 열린다. `yeouido` station은 현재 line stop은 아니지만
`west`에 포함된다. 학습 문은 없고 `returnNode: 'seoul'`도 해석된다.

### 부산

```js
open: [
  { id: 'port-core', tiles: { rects: [[530, 650, 735, 830]] } },
  { id: 'central-north', tiles: { rects: [[735, 420, 810, 490], [840, 145, 930, 215], [860, 35, 930, 80]] } },
  { id: 'east-coast', tiles: { rects: [[1000, 370, 1260, 535]] } },
  { id: 'south-coast', tiles: { rects: [[220, 740, 285, 815], [315, 1040, 370, 1105], [860, 1010, 925, 1070], [680, 880, 735, 930]] } },
]
```

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `port-core` | 37,286 | 5/0/3/2 | 스폰·EXIT·부산/남포역·항구·원도심 |
| `central-north` | 15,123 | 2/0/0/3 | 서면·동래·부산대역과 북부 POI |
| `east-coast` | 43,326 | 3/0/1/2 | 센텀·해운대역과 광안리·광안대교 |
| `south-coast` | 15,594 | 4/0/0/0 | 을숙도·다대포·태종대·흰여울 |

TRANSIT 도착 7개 `nampo`, `busan`, `seomyeon`, `dongnae-station`, `pnu-station`,
`centum-city-station`, `haeundae-station`과 스폰 `[684,695]`, EXIT `[684,685]`,
`[684,686]`가 모두 열린다. 학습 문은 없고 `returnNode: 'busan'`도 해석된다.

### 코트다쥐르

```js
open: [
  { id: 'ouest', tiles: { rects: [[225, 870, 300, 970], [330, 460, 410, 530], [220, 245, 275, 320]] } },
  { id: 'nice', tiles: { rects: [[600, 150, 910, 500]] } },
  { id: 'est', tiles: { rects: [[970, 105, 1235, 280]] } },
  { id: 'monaco', tiles: { rects: [[1420, 40, 1510, 125]] } },
]
```

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `ouest` | 17,683 | 5/0/0/2 | 앙티브·카뉴역과 서부 POI 군집 |
| `nice` | 109,161 | 7/0/3/1 | 스폰·EXIT·니스역·공항·니스 중심부 |
| `est` | 46,816 | 2/0/0/2 | 빌프랑슈·에즈역과 두 마을 POI |
| `monaco` | 7,826 | 4/0/0/1 | 모나코역·궁전·항구·박물관·카지노 외관 |

TRANSIT 도착 6개 `antibes`, `cagnes-sur-mer`, `nice-ville`, `villefranche-sur-mer`,
`eze-sur-mer`, `monaco-monte-carlo`와 스폰 `[813,253]`, EXIT `[813,243]`,
`[813,244]`가 모두 열린다. `villefranche-sur-mer`는 node와 station id가 같지만 실제 TRANSIT
소비처는 `stations + transitPoints` map이므로 station `[1008,245]`를 검증했다. 학습 문은 없고
`returnNode: 'nice'`도 해석된다.

### 레만 연안

```js
open: [
  { id: 'lausanne-ouchy', tiles: { rects: [[80, 75, 155, 215]] } },
  { id: 'lavaux', tiles: { rects: [[300, 140, 790, 395]] } },
  { id: 'vevey', tiles: { rects: [[900, 410, 955, 460]] } },
  { id: 'montreux-chillon', tiles: { rects: [[1160, 550, 1280, 720]] } },
]
```

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `lausanne-ouchy` | 10,716 | 5/1/2/1 | 스폰·EXIT·로잔역·우시 선착장·`fr-18` |
| `lavaux` | 125,696 | 5/1/0/3 | 뤼트리·퀼리·리바역·퀼리 선착장·`fr-16` |
| `vevey` | 2,856 | 2/1/1/1 | 브베역·선착장·두 POI |
| `montreux-chillon` | 20,691 | 3/2/1/2 | 몽트뢰·시옹역/선착장·`fr-17` |

철도 도착 7개 `lausanne`, `lutry`, `cully`, `rivaz`, `vevey`, `montreux`,
`veytaux-chillon`과 도선 도착 5개 `ouchy-landing`, `cully-landing`, `vevey-landing`,
`montreux-landing`, `chillon-landing`가 모두 열린다. 학습 문 `fr-16` `[524,259]`,
`fr-17` `[1187,587]`, `fr-18` `[109,97]`, 스폰 `[112,130]`, EXIT `[112,120]`,
`[112,121]`도 포함되고 `returnNode: 'leman-riviera'`가 해석된다.

## 리옹 mainRoute 최소 rect 기준선

`planCityMainRoute()`가 산출한 기존 8개 leg partition을 고정하고, 각 leg 경로 타일의 x/y 최솟값과
최댓값으로 **그 leg를 담는 최소 단일 rect**를 만들었다. 경로는 연결점 중복 포함 509타일,
unique 492타일이다.

| leg | exact 최소 rect | D2 예비 margin 6 rect |
|---:|---|---|
| 1 | `[133,234,163,286]` | `[127,228,169,292]` |
| 2 | `[142,219,163,234]` | `[136,213,169,240]` |
| 3 | `[124,208,143,219]` | `[118,202,149,225]` |
| 4 | `[124,180,172,209]` | `[118,174,178,215]` |
| 5 | `[172,179,181,188]` | `[166,173,187,194]` |
| 6 | `[163,142,185,180]` | `[157,136,191,186]` |
| 7 | `[163,142,233,206]` | `[157,136,239,212]` |
| 8 | `[233,206,270,219]` | `[227,200,276,225]` |

exact 합집합은 8,517타일, margin 6 합집합은 12,609타일이다. 두 합집합 모두 492/492 unique
mainRoute 타일을 포함한다. exact는 수학적 하한 참고값이고, 실제 D2 저작에는 카메라·보행 여유를
주는 margin 6 예비안을 유지하는 편이 안전하다.

## 사전검증 계약

- rect 범위: `0 <= x0 <= x1 < cols`, `0 <= y0 <= y1 < rows` — 31/31 PASS
- TRANSIT: 각 line의 `stopIds`를 runtime과 같은 `stations + transitPoints` id map으로 해석하고
  도착 타일이 후보 합집합 안인지 확인 — 33/33 PASS, unknown 0
- spawn: `city.entrance` 포함 — 6/6 PASS
- return: `returnNode`가 `ALL_WORLD_NODES`에서 해석되고 도시 측 `exitTiles`가 포함 — 6/6,
  12/12 PASS
- door: `node.track || node.chapter`인 학습 문 포함 — 3/3 PASS
- 리옹: exact와 margin 6 합집합의 full-path 포함 — 각각 492/492 PASS

`returnNode`에 city tile을 임의로 부여하지 않은 이유는 런타임이 이 id를 `getNode()`로 해석한 뒤
`worldNodeReturnSpawn()`으로 오버월드 복귀 좌표를 정하기 때문이다. 도시 내부 fail-closed 판정은
EXIT와 entrance가 맡는다.

## 결정성·회귀 증거

입력은 기준 commit의 여섯 도시 wrapper/geo, 리옹 wrapper/geo, `cityMainRoute.js`,
`worldNodes.js`다. 이 16개 Git blob id 목록의 SHA-256은
`0a977a55012bb00e0cc3d393d264c904dad300e157ee76d1066c21a1061a7e38`이다.

동일 Node 프로세스를 독립 2회 실행해 도시별 rect 합집합, 앵커 membership, 필수 gate,
리옹 route 기준선을 canonical JSON으로 직렬화했다.

- audit canonical JSON SHA-256 run A:
  `9e78aa7509306a13a99ab22c790647cea147a8c54ede544dd6854d6dae9622cc`
- run B: byte-identical, 같은 SHA-256
- Node `v22.23.1` (`nvm` 공식 배포판)
- targeted: 14 files / 107 tests PASS; max RSS 2,690,187,264 bytes;
  peak footprint 24,906,680 bytes / swaps 0
- full: 207 files / 2,107 tests PASS; max RSS 2,898,624,512 bytes;
  peak footprint 24,447,832 bytes / swaps 0

이 보고서는 rect 후보와 측정 결과만 고정한다. 승인·D2 구현 때는 잠금 카피/해금 순서와 함께
동일 gate 검사를 테스트로 승격하고, 미정의 도시는 RFC대로 완전 개방을 유지해야 한다.
