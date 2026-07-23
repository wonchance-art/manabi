# 여행책 지구 후보 rect 실측 제안 r3 — 유럽·아시아·호주

- 상태: **report-only / D2 후속 입력 데이터** — runtime·도시 wrapper/geo·registry·verifier·DB 변경 없음
- publication/measurement base: `origin/main`
  `fbfd3c70284f26ec21c34b0772dfe70af0d127f5`
- 상위 발주: 이슈 #150 코멘트 `5053883288` T9의 “나머지 19도시” 확산 계약과 T10 세션 지시
- 측정일: 2026-07-23

## 결론

1. 세션 지시의 표기는 “나머지 13도시”지만 실제 열거 id는 **14개**다. 임의로 하나를
   제외하지 않고 열거된 14개를 모두 측정했다. 열거되지 않은 `marseille`는 이번 범위 밖이다.
2. 14도시에 55개 후보 지구·76개 inclusive rect를 제안한다. rect는 양 끝 포함
   `[x0, y0, x1, y1]`이고 한 지구는 여러 rect의 합집합일 수 있다. 범위 밖 rect와
   지구 간 중복 타일은 각각 0개다.
3. **13도시 PASS**: TRANSIT raw/resolved 75/75, spawn 13/13, EXIT 26/26,
   문·NPC·스토리 gate 40/40, `returnNode` 13/13, 실제 `resolveCityDistricts()` 13/13이
   모두 열린 합집합에서 통과한다.
4. **가와구치코는 rect가 아니라 기존 runtime 데이터 결함으로 FAIL**이다.
   `KAWAGUCHIKO_GEO.transitPoints`에는 `funatsu-pier [148,240]`와
   `oishi-landing [62,164]`이 있지만 wrapper가 존재하지 않는
   `KAWAGUCHIKO_GEO.ferryLinks`를 읽어 runtime `transitPoints`에서 두 점이 빠진다.
   따라서 `kawaguchiko-cruise`의 두 stop이 exact-1로 해석되지 않아 후보 payload를
   resolver에 넣으면 `transit arrival funatsu-pier must resolve exact-1`로 fail-closed한다.
   두 geo 점 자체는 후보 rect 안에 포함했으며, wrapper 매핑 수정 뒤 재실측이 적용 선행 게이트다.
5. 전체 앵커는 `nodes 220/220 · transitPoints 14/14 · props 46/46 · stations 58/58`가
   열린다. 가와구치코의 누락 유람선 두 점은 runtime `transitPoints` 총계에는 나타나지 않으므로
   별도 geo 보조 검사 2/2로 고정했다.

## 집계

`N/T/P/S`는 각각 `nodes / transitPoints / props / stations`의 열린 수와 전체 수다.
열린 타일 수는 후보 rect 합집합의 unique tile 수다.

| 도시 | grid | 지구/rect | 열린 타일 | 전체 대비 | 열린 N/T/P/S | 결과 |
|---|---:|---:|---:|---:|---:|---|
| 그랑파리 | 1355×891 | 4/7 | 175,206 | 14.512157% | 28/28 · 0/0 · 4/4 · 8/8 | PASS |
| 브뤼셀 | 352×613 | 4/5 | 15,834 | 7.338166% | 12/12 · 0/0 · 3/3 · 4/4 | PASS |
| 런던 | 1213×1002 | 4/9 | 137,787 | 11.336519% | 30/30 · 0/0 · 4/4 · 9/9 | PASS |
| 몽생미셸 | 442×1030 | 3/4 | 20,921 | 4.595396% | 10/10 · 0/0 · 0/0 · 0/0 | PASS |
| 제네바 | 309×362 | 4/4 | 19,232 | 17.193227% | 13/13 · 2/2 · 4/4 · 1/1 | PASS |
| 타이베이 | 454×501 | 4/5 | 68,657 | 30.185004% | 19/19 · 0/0 · 5/5 · 5/5 | PASS |
| 홍콩 | 618×390 | 4/5 | 24,153 | 10.021160% | 15/15 · 2/2 · 5/5 · 4/4 | PASS |
| 상하이 | 429×390 | 4/5 | 24,173 | 14.448031% | 13/13 · 2/2 · 4/4 · 4/4 | PASS |
| 베이징 | 342×390 | 4/5 | 32,422 | 24.307992% | 12/12 · 0/0 · 4/4 · 4/4 | PASS |
| 가와구치코 | 567×863 | 4/5 | 43,107 | 8.809554% | 15/15 · 2/2 · 3/3 · 3/3 | **FAIL — source mapping** |
| 브리즈번 | 544×557 | 4/4 | 20,612 | 6.802461% | 11/11 · 2/2 · 3/3 · 4/4 | PASS |
| 시드니 | 648×780 | 4/9 | 43,019 | 8.511198% | 20/20 · 4/4 · 4/4 · 5/5 | PASS |
| 캔버라 | 546×501 | 4/4 | 45,744 | 16.722599% | 10/10 · 0/0 · 1/1 · 3/3 | PASS |
| 멜버른 | 484×557 | 4/5 | 29,152 | 10.813538% | 12/12 · 0/0 · 2/2 · 4/4 | PASS |

## 필수 gate 사전검증

TRANSIT은 runtime과 같은 `stations + transitPoints` exact-1 id map으로 raw tile과
`resolveArrivalTile()` 결과를 각각 검사했다. `문/gate`는 D1 fail-closed 조건인
`npc || gate || chapter || reading` node다.

| 도시 | TRANSIT raw | TRANSIT resolved | spawn | EXIT | 문/gate | returnNode | resolver |
|---|---:|---:|---:|---:|---:|---:|---:|
| 그랑파리 | 7/7 | 7/7 | 1/1 | 2/2 | 6/6 | 1/1 | PASS |
| 브뤼셀 | 3/3 | 3/3 | 1/1 | 2/2 | 0/0 | 1/1 | PASS |
| 런던 | 10/10 | 10/10 | 1/1 | 2/2 | 6/6 | 1/1 | PASS |
| 몽생미셸 | 0/0 | 0/0 | 1/1 | 2/2 | 7/7 | 1/1 | PASS |
| 제네바 | 2/2 | 2/2 | 1/1 | 2/2 | 3/3 | 1/1 | PASS |
| 타이베이 | 6/6 | 6/6 | 1/1 | 2/2 | 6/6 | 1/1 | PASS |
| 홍콩 | 6/6 | 6/6 | 1/1 | 2/2 | 3/3 | 1/1 | PASS |
| 상하이 | 7/7 | 7/7 | 1/1 | 2/2 | 3/3 | 1/1 | PASS |
| 베이징 | 2/2 | 2/2 | 1/1 | 2/2 | 0/0 | 1/1 | PASS |
| 가와구치코 | **5/7** | **5/7** | 1/1 | 2/2 | 5/5 | 1/1 | **FAIL** |
| 브리즈번 | 7/7 | 7/7 | 1/1 | 2/2 | 0/0 | 1/1 | PASS |
| 시드니 | 12/12 | 12/12 | 1/1 | 2/2 | 6/6 | 1/1 | PASS |
| 캔버라 | 2/2 | 2/2 | 1/1 | 2/2 | 0/0 | 1/1 | PASS |
| 멜버른 | 6/6 | 6/6 | 1/1 | 2/2 | 0/0 | 1/1 | PASS |
| **합계** | **75/77** | **75/77** | **14/14** | **28/28** | **45/45** | **14/14** | **13/14** |

가와구치코의 미해석 id는 raw/resolved 모두 `funatsu-pier`, `oishi-landing` 두 개뿐이다.
그 밖의 unknown exact-1 stop, null resolved arrival, 닫힌 필수 gate는 0개다.

## 후보 payload와 지구별 측정

아래 모양은 `districts.open[].tiles.rects`에 옮길 수 있는 입력 후보다. id·label·해금 순서는
D2 저작 시 바꿀 수 있지만 rect 경계를 바꾸면 같은 gate 검사를 다시 해야 한다.

### 유럽

#### 그랑파리

```js
open: [
  { id: 'north-central', tiles: { rects: [[650, 240, 990, 400]] } },
  { id: 'seine-core', tiles: { rects: [[650, 401, 1080, 620]] } },
  { id: 'west-satellites', tiles: { rects: [[450, 235, 545, 300], [520, 410, 590, 470]] } },
  {
    id: 'outer-satellites',
    tiles: { rects: [[50, 730, 125, 810], [920, 0, 980, 60], [1190, 520, 1270, 580]] },
  },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `north-central` | 54,901 | 6/0/0/3 |
| `seine-core` | 94,820 | 17/0/4/3 |
| `west-satellites` | 10,667 | 2/0/0/1 |
| `outer-satellites` | 14,818 | 3/0/0/1 |

파리 중심부·북역과 라데팡스, 베르사유, 생드니, 뱅센까지 전체 앵커를 열되 원거리
satellite를 작은 분리 rect로 유지해 광역 grid의 불필요한 개방을 막는다.

#### 브뤼셀

```js
open: [
  { id: 'midi', tiles: { rects: [[35, 335, 75, 375]] } },
  { id: 'historic-royal', tiles: { rects: [[90, 270, 175, 350]] } },
  { id: 'north', tiles: { rects: [[125, 205, 155, 269]] } },
  { id: 'eu-laeken', tiles: { rects: [[205, 295, 270, 350], [55, 10, 95, 45]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `midi` | 1,681 | 0/0/0/1 |
| `historic-royal` | 6,966 | 9/0/3/1 |
| `north` | 2,015 | 0/0/0/1 |
| `eu-laeken` | 5,172 | 3/0/0/1 |

#### 런던

```js
open: [
  { id: 'kings-cross-camden', tiles: { rects: [[520, 300, 640, 429]] } },
  { id: 'central-west', tiles: { rects: [[300, 430, 649, 610]] } },
  { id: 'city-east', tiles: { rects: [[650, 430, 810, 580]] } },
  {
    id: 'outer-satellites',
    tiles: {
      rects: [
        [950, 620, 1050, 710], [0, 640, 60, 710], [250, 880, 330, 950],
        [430, 180, 500, 250], [40, 210, 100, 280], [940, 280, 1020, 350],
      ],
    },
  },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `kings-cross-camden` | 15,730 | 3/0/0/2 |
| `central-west` | 63,350 | 14/0/2/4 |
| `city-east` | 24,311 | 7/0/2/2 |
| `outer-satellites` | 34,396 | 6/0/0/1 |

그리니치 철도 도착과 큐·윔블던·햄스테드·웸블리·올림픽파크 원거리 앵커를 satellite
rect로 분리한다. 학습 문 `en-01`~`en-06`은 모두 세 중심 지구 안에 있다.

#### 몽생미셸

```js
open: [
  { id: 'island', tiles: { rects: [[270, 145, 325, 200]] } },
  { id: 'upper-causeway', tiles: { rects: [[280, 201, 292, 550]] } },
  {
    id: 'mainland-causeway',
    tiles: { rects: [[280, 551, 386, 650], [374, 651, 386, 845]] },
  },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `island` | 3,136 | 8/0/0/0 |
| `upper-causeway` | 4,550 | 0/0/0/0 |
| `mainland-causeway` | 13,235 | 2/0/0/0 |

4m 정밀·조수형 특수 계약은 아래 “특수형” 절에 별도로 고정한다.

#### 제네바

```js
open: [
  { id: 'nations-rive-droite', tiles: { rects: [[110, 50, 205, 180]] } },
  { id: 'old-town-lake', tiles: { rects: [[150, 181, 220, 235]] } },
  { id: 'plainpalais', tiles: { rects: [[120, 236, 170, 260]] } },
  { id: 'carouge', tiles: { rects: [[110, 310, 150, 345]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `nations-rive-droite` | 12,576 | 3/1/2/1 |
| `old-town-lake` | 3,905 | 7/1/1/0 |
| `plainpalais` | 1,275 | 1/0/1/0 |
| `carouge` | 1,476 | 2/0/0/0 |

### 아시아

#### 타이베이

```js
open: [
  { id: 'shilin-palace', tiles: { rects: [[140, 60, 210, 140], [275, 20, 315, 65]] } },
  { id: 'west-core', tiles: { rects: [[35, 280, 180, 430]] } },
  { id: 'east-core', tiles: { rects: [[181, 340, 320, 470]] } },
  { id: 'xinyi-raohe', tiles: { rects: [[340, 300, 453, 480]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `shilin-palace` | 7,637 | 3/0/1/1 |
| `west-core` | 22,046 | 10/0/1/2 |
| `east-core` | 18,340 | 2/0/0/1 |
| `xinyi-raohe` | 20,634 | 4/0/3/1 |

#### 홍콩

```js
open: [
  { id: 'kowloon-north', tiles: { rects: [[330, 40, 390, 150]] } },
  { id: 'tsim-sha-tsui', tiles: { rects: [[335, 151, 405, 220]] } },
  { id: 'central-admiralty', tiles: { rects: [[240, 230, 350, 305]] } },
  { id: 'peak-causeway', tiles: { rects: [[230, 306, 280, 350], [430, 245, 470, 285]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `kowloon-north` | 6,771 | 2/0/3/1 |
| `tsim-sha-tsui` | 4,970 | 5/1/2/1 |
| `central-admiralty` | 8,436 | 5/1/0/2 |
| `peak-causeway` | 3,976 | 3/0/0/0 |

#### 상하이

```js
open: [
  { id: 'people-nanjing-bund', tiles: { rects: [[80, 110, 210, 165], [175, 75, 205, 109]] } },
  { id: 'lujiazui', tiles: { rects: [[220, 95, 280, 165]] } },
  { id: 'yuyuan-xintiandi', tiles: { rects: [[100, 166, 220, 240]] } },
  { id: 'tianzifang', tiles: { rects: [[55, 250, 100, 300]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `people-nanjing-bund` | 8,421 | 5/1/1/2 |
| `lujiazui` | 4,331 | 3/1/2/1 |
| `yuyuan-xintiandi` | 9,075 | 3/0/1/1 |
| `tianzifang` | 2,346 | 2/0/0/0 |

#### 베이징

```js
open: [
  { id: 'north-lakes', tiles: { rects: [[145, 25, 240, 100]] } },
  { id: 'imperial-core', tiles: { rects: [[140, 101, 229, 240]] } },
  { id: 'wangfujing', tiles: { rects: [[230, 175, 285, 240]] } },
  { id: 'qianmen-tiantan', tiles: { rects: [[175, 241, 250, 340], [220, 360, 260, 389]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `north-lakes` | 7,296 | 4/0/0/1 |
| `imperial-core` | 12,600 | 4/0/2/0 |
| `wangfujing` | 3,696 | 1/0/1/2 |
| `qianmen-tiantan` | 8,830 | 3/0/1/1 |

중화권 세 도시 후보는 지리·외관·교통 타일만 측정한다. 정치 서술이나 신규 카피는 작성하지 않았다.

#### 가와구치코

```js
open: [
  { id: 'lake-north', tiles: { rects: [[30, 130, 160, 250]] } },
  { id: 'station-onsen', tiles: { rects: [[150, 251, 230, 310]] } },
  { id: 'arakura-yoshida', tiles: { rects: [[290, 240, 400, 420]] } },
  {
    id: 'oshino-fifth-station',
    tiles: { rects: [[520, 480, 566, 520], [25, 845, 45, 862]] },
  },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `lake-north` | 15,851 | 2/0/0/0 |
| `station-onsen` | 4,860 | 6/1/1/1 |
| `arakura-yoshida` | 20,091 | 4/0/1/2 |
| `oshino-fifth-station` | 2,305 | 3/1/1/0 |

표의 T는 현행 runtime에 실제 노출된 등산 버스 정류장 2개만 센다. geo 유람선 두 점은
`lake-north`에 별도로 2/2 포함되지만 wrapper 누락 때문에 적용 결과는 FAIL이다.

### 호주

#### 브리즈번

```js
open: [
  { id: 'cbd-north', tiles: { rects: [[170, 195, 285, 285]] } },
  { id: 'south-bank', tiles: { rects: [[170, 286, 229, 350]] } },
  { id: 'kangaroo-botanic', tiles: { rects: [[230, 286, 290, 355]] } },
  { id: 'new-farm', tiles: { rects: [[330, 250, 370, 295]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `cbd-north` | 10,556 | 6/1/2/3 |
| `south-bank` | 3,900 | 2/1/1/1 |
| `kangaroo-botanic` | 4,270 | 2/0/0/0 |
| `new-farm` | 1,886 | 1/0/0/0 |

#### 시드니

```js
open: [
  { id: 'cbd-harbour', tiles: { rects: [[120, 330, 225, 530]] } },
  {
    id: 'inner-south-east',
    tiles: { rects: [[40, 560, 90, 620], [240, 500, 280, 550], [330, 540, 380, 580]] },
  },
  { id: 'bondi-watsons', tiles: { rects: [[450, 270, 540, 330], [450, 540, 510, 590]] } },
  {
    id: 'harbour-north',
    tiles: { rects: [[310, 285, 350, 330], [515, 25, 565, 75], [240, 285, 280, 315]] },
  },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `cbd-harbour` | 21,306 | 11/1/3/4 |
| `inner-south-east` | 7,293 | 4/0/0/1 |
| `bondi-watsons` | 8,662 | 4/1/0/0 |
| `harbour-north` | 5,758 | 1/2/1/0 |

#### 캔버라

```js
open: [
  { id: 'civic-north', tiles: { rects: [[300, 40, 370, 240]] } },
  { id: 'memorial-ainslie', tiles: { rects: [[390, 140, 470, 250]] } },
  { id: 'lake-parliament', tiles: { rects: [[210, 260, 350, 400]] } },
  { id: 'kingston-station', tiles: { rects: [[380, 410, 430, 460]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `civic-north` | 14,271 | 1/0/0/2 |
| `memorial-ainslie` | 8,991 | 2/0/0/0 |
| `lake-parliament` | 19,881 | 7/0/1/0 |
| `kingston-station` | 2,601 | 0/0/0/1 |

#### 멜버른

```js
open: [
  { id: 'cbd', tiles: { rects: [[220, 145, 330, 230]] } },
  { id: 'inner-north', tiles: { rects: [[260, 80, 370, 144]] } },
  { id: 'southbank-east', tiles: { rects: [[300, 231, 390, 310], [331, 190, 385, 230]] } },
  { id: 'st-kilda', tiles: { rects: [[300, 460, 355, 510]] } },
]
```

| 지구 | 열린 타일 | N/T/P/S |
|---|---:|---:|
| `cbd` | 9,546 | 5/0/1/4 |
| `inner-north` | 7,215 | 3/0/1/0 |
| `southbank-east` | 9,535 | 3/0/0/0 |
| `st-kilda` | 2,856 | 1/0/0/0 |

## 특수형 계약

### 몽생미셸 — 4m 조수·제방형

- 기본 20m가 아닌 **4m/tile** `442×1030` 정밀 grid다. 섬과 본토 앵커만 작은 rect로
  여는 방식은 제방 도보 회랑을 잠가 softlock을 만들 수 있으므로 허용하지 않았다.
- entrance `[380,840]`에서 abbey `[286,164]`까지 결정적 4방 최단경로는 771타일,
  SHA-256 `7af70e18bb6cbd3ec47e427a2a3efc649a3e673d3fdc156f6b1774554851d93d`다.
  제안 합집합이 **771/771**을 모두 포함한다.
- 조수 정본 `tide.safeCorridorMask`는 `[286,231]..[286,531]`의 301타일,
  hash `e1b6a457b6b8336c698143caa5df49004eee94d815cb5c3b80922f041acc07dc`다.
  제안 합집합이 **301/301**을 포함한다. 따라서 지구 잠금이 visual-only 조수 안전 회랑을
  다시 끊지 않는다.
- island 지구는 수도원 story gate와 `msm-01`~`04`,`06`, mainland-causeway는 entrance,
  EXIT 2개와 `msm-05`를 포함한다.

### 홍콩 — 두 육지 성분·페리 연결형

- 보행 성분은 44,094타일(구룡)과 40,996타일(홍콩섬) 두 개다. 억지 rect 연결이나
  수면 보행화를 전제하지 않는다.
- `star-ferry-tst`는 성분 0, `star-ferry-central`은 성분 1이며 두 runtime 페리 도착이
  raw/resolved 모두 열린다. TST spawn/EXIT와 센트럴·애드미럴티 문을 각각 자기 육지
  지구에 둔다.

### 가와구치코 — 5합목 분리 성분·등산 버스형

- 보행 성분은 본체 98,201타일과 5합목 33타일 두 개다.
  `kawaguchiko-bus-stop`은 성분 0, `subaru-5th-stop`과 story gate·`ja-03`은 성분 1이다.
  `oshino-fifth-station`의 두 rect 중 작은 `[25,845,45,862]`가 이 분리 성분을 명시적으로 연다.
- 등산 버스 2 stop은 exact-1·raw/resolved 2/2 PASS다. 호수 유람선은 앞서 적은 wrapper
  매핑 결함으로 exact-1 0/2 FAIL이다. 지구 구현 전에 `KAWAGUCHIKO_GEO.transitPoints` 소비를
  복구하고 같은 one-shot을 재실행해야 한다.

## 결정성·회귀 증거

입력은 열거 14도시 wrapper/geo 28개와 `cities/index.js`, `cities/manifest.js`, `terrain.js`,
`cityDistricts.js`, `worldNodes.js` 총 33파일이다. 파일별 bytes·SHA-256 canonical 목록의
manifest SHA-256은
`31d0f9d780e81421cfb31d6ed25af04da28ee8bdb518b9d22b89cd6fe2d7e5b4`다.

one-shot Node 측정기는 rect 합집합, 지구별 앵커 membership, raw/resolved TRANSIT,
spawn·EXIT·문/gate·returnNode, 실제 resolver 결과, 세 특수형 성분·회랑을 canonical JSON
한 줄로 직렬화했다. 측정기는 검증용 임시 파일이며 산출물에는 포함하지 않는다.

- canonical JSON: 27,999 bytes
- run A SHA-256:
  `401c61c6612091b1095de8a242ae4e01df35a5322c2d2642786cdd7e7da03f89`
- run B: byte-identical, 같은 SHA-256
- Node `v22.23.1` (`nvm` 공식 배포판)
- one-shot max RSS: run A 865,296 KiB / 886,063,104 bytes,
  run B 865,632 KiB / 886,407,168 bytes
- targeted: 24 files / 213 tests PASS, 단일 워커 6 shards, 합산 duration 45.733s
- full: 216 files / 2,161 tests PASS, 단일 워커 72 shards,
  합산 Vitest duration 257.051s
- `npm run lint` PASS
- `git diff --check` PASS

full은 이 샌드박스의 메모리 상한을 넘기지 않도록 모든 test file을 3-file 독립 프로세스로
정확히 한 번씩 실행했다. 실패 shard는 없고 파일/테스트 합계는 latest base의 정본
216/2,161과 일치한다.

이 보고서는 rect 후보와 현행 source blocker만 고정한다. 승인·구현 때는 label·잠금 카피·해금
순서를 Claude가 저작하고, 가와구치코 source mapping을 먼저 복구한 뒤 동일 gate를 정식 테스트로
승격해야 한다.
