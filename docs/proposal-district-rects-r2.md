# 여행책 지구 후보 rect 실측 제안 r2 — 일본 우선 도시

- 상태: **report-only / D2 후속 입력 데이터** — runtime·도시 wrapper/geo·registry·verifier·DB 변경 없음
- publication base: `origin/main` `49e6699764febdcd1132c4644389f65e91ed6705`
- 측정 입력 snapshot: `e330283ecb435b7bf5bad51aab35f57258b20a1f`
  (두 head 사이 T9 입력 12파일 byte 불변)
- 발주: 이슈 #150 코멘트 `5053883288` T9 + 세션 지시의 일본 6도시 우선순위
- 요청 대상: 도쿄·오사카·후쿠오카·교토·삿포로·나고야
- 측정일: 2026-07-23

## 결론

1. 현행 `main`에서 city wrapper·geo·registry가 모두 있는 **도쿄·오사카·후쿠오카·교토
   4도시**는 각각 4개 후보 지구, 합계 16지구·28개 inclusive rect로 실측했다.
2. 네 도시의 후보 합집합은 TRANSIT raw 도착 48/48과 walkable 재해석 도착 48/48,
   스폰 4/4, EXIT 8/8, NPC·학습 문 10/10을 모두 포함한다. `resolveCityDistricts()`를
   후보 payload에 직접 적용한 결과 4/4 PASS이며, unknown exact-1 stop·범위 밖 rect·닫힌
   필수 gate는 모두 0이다.
3. 전체 node/transitPoint/prop/station 앵커는 75/77·5/5·47/47·64/64가 열린다.
   닫힌 두 앵커는 도쿄의 원거리 일반 POI `nakano-broadway`, `shimokitazawa`뿐이며,
   TRANSIT·스폰·EXIT·NPC·학습 문이 아니다.
4. 요청된 **삿포로·나고야는 현행 26도시 registry에 도시로 존재하지 않고
   `sapporo(.geo).js`·`nagoya(.geo).js`도 없다.** 따라서 T5 계약에 필요한 grid,
   tile anchor, TRANSIT, spawn, EXIT가 없어 축정렬 tile rect와 개방 비율을 산출할 수 없다.
   나고야의 `gourmet-nagoya` 오버월드 음식 POI는 도시맵 입력이 아니므로 대용하지 않았다.
5. 두 도시를 임의 bbox·가상 grid로 채우거나 다른 도시로 대체하지 않았다. city wrapper·geo와
   registry가 `main`에 생긴 뒤 같은 one-shot 측정기를 재실행하는 것이 후속 게이트다.

## 입력 가용성

| 요청 도시 | CITY_MAPS registry | wrapper | geo | T5 방식 측정 |
|---|---:|---:|---:|---|
| 도쿄 (`tokyo`) | ✓ | ✓ | ✓ | MEASURABLE |
| 오사카 (`osaka`) | ✓ | ✓ | ✓ | MEASURABLE |
| 후쿠오카 (`fukuoka`) | ✓ | ✓ | ✓ | MEASURABLE |
| 교토 (`kyoto`) | ✓ | ✓ | ✓ | MEASURABLE |
| 삿포로 (`sapporo`) | ✗ | ✗ | ✗ | **NO_SOURCE** |
| 나고야 (`nagoya`) | ✗ | ✗ | ✗ | **NO_SOURCE** |

`CITY_MAPS`의 실제 26개 id와 도시 디렉터리의 tracked 파일을 기준으로 판정했다.
오버월드 landmark·음식 POI는 `cols × rows`와 도시 타일 계약이 없으므로 city source로 세지 않았다.

## 집계

`N/T/P/S`는 각각 `nodes / transitPoints / props / stations`의 열린 수와 전체 수다.
rect는 양 끝 포함 `[x0, y0, x1, y1]`이며 열린 타일 수는 지구 rect 합집합의 unique tile 수다.

| 도시 | grid | 지구/rect | 열린 타일 | 전체 대비 | 열린 N/T/P/S | 결과 |
|---|---:|---:|---:|---:|---:|---|
| 도쿄 | 824×1086 | 4/8 | 251,384 | 28.091866% | 36/38 · 1/1 · 14/14 · 30/30 | PASS |
| 오사카 | 641×668 | 4/7 | 73,545 | 17.175867% | 10/10 · 0/0 · 7/7 · 13/13 | PASS |
| 후쿠오카 | 388×254 | 4/4 | 26,343 | 26.730051% | 18/18 · 4/4 · 17/17 · 11/11 | PASS |
| 교토 | 639×668 | 4/9 | 75,272 | 17.634215% | 11/11 · 0/0 · 9/9 · 10/10 | PASS |
| 삿포로 | — | — | — | — | — | NO_SOURCE |
| 나고야 | — | — | — | — | — | NO_SOURCE |

후보 지구끼리는 겹치지 않게 경계를 잡아, 측정 가능한 각 도시의 지구별 타일 수 합이 도시
합집합 수와 같다. 같은 지구 안에서 서로 겹치는 rect는 union으로 한 번만 센다.

## 필수 gate 사전검증

TRANSIT은 runtime과 같이 `stations + transitPoints`에서 stop id를 exact-1로 찾고, raw tile과
`resolveArrivalTile()`의 walkable 도착 tile을 각각 후보 합집합에 대조했다. `문` 열은 D1의
실제 fail-closed 조건인 `npc || gate || chapter || reading` node를 센다.

| 도시 | TRANSIT raw | TRANSIT resolved | 스폰 | EXIT | 문/NPC | returnNode | resolver |
|---|---:|---:|---:|---:|---:|---:|---:|
| 도쿄 | 10/10 | 10/10 | 1/1 | 2/2 | 3/3 | 1/1 | PASS |
| 오사카 | 13/13 | 13/13 | 1/1 | 2/2 | 2/2 | 1/1 | PASS |
| 후쿠오카 | 15/15 | 15/15 | 1/1 | 2/2 | 4/4 | 1/1 | PASS |
| 교토 | 10/10 | 10/10 | 1/1 | 2/2 | 1/1 | 1/1 | PASS |
| **합계** | **48/48** | **48/48** | **4/4** | **8/8** | **10/10** | **4/4** | **4/4** |

| 도시 | 스폰 | EXIT | 열린 문/NPC id |
|---|---|---|---|
| 도쿄 | `[543,1040]` | `[543,1031]`, `[543,1032]` | `tokyo-ekiin`, `tokyo-konbini`, `tokyo-menzei` |
| 오사카 | `[414,187]` | `[414,177]`, `[414,178]` | `osaka-izakaya`, `osaka-konbini` |
| 후쿠오카 | `[239,70]` | `[239,61]`, `[239,62]` | `fukuoka-izakaya`, `fukuoka-konbini`, `fukuoka-ramen`, `nakasu` |
| 교토 | `[404,422]` | `[404,412]`, `[404,413]` | `kyoto-shrine` |

`returnNode` 네 id(`tokyo`, `osaka`, `fukuoka`, `kyoto`)는 모두 `ALL_WORLD_NODES`에서
해석된다. 도시 쪽 복귀 안전성은 열린 `entrance`와 실제 grid의 모든 EXIT로 따로 검증했다.

## 후보 payload와 지구별 앵커 수

아래 모양은 RFC의 `districts.open[].tiles.rects`에 옮길 수 있는 측정 후보다. id·label·해금
순서는 D2 저작 시 바꿀 수 있지만, rect를 줄이거나 경계를 옮길 때는 같은 gate 검사를 다시 해야 한다.

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

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `yamanote-west` | 80,747 | 13/0/6/13 | 이케부쿠로~시부야~오사키 서부 순환축, 학습 node 2 |
| `central-east` | 96,490 | 16/0/4/13 | 우에노·아사쿠사·도쿄역·긴자 동부 도심, 학습 node 1 |
| `south-bay` | 70,731 | 6/0/2/4 | 시바·시나가와·도쿄만 남부 철도축 |
| `haneda` | 3,416 | 1/1/2/0 | 스폰·EXIT 2·하네다 도착점·항공기 prop |

정기 교통 10개 stop과 전체 station 30개가 열린다. 원거리 일반 POI
`nakano-broadway [26,175]`, `shimokitazawa [30,438]`만 후보 밖이며 필수 gate는 아니다.

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

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `north-hubs` | 28,732 | 2/0/0/6 | 스폰·EXIT 2·신오사카·오사카/우메다·북부 순환축 |
| `castle-east` | 6,885 | 1/0/0/1 | 오사카성·모리노미야 |
| `namba-tennoji` | 35,327 | 6/0/7/6 | 난바·도톤보리·덴노지·서남/동남 순환축, 학습 node 2 |
| `bay` | 2,601 | 1/0/0/0 | 오사카만 수족관 앵커 |

13개 TRANSIT stop, station 13개, node·prop 전부가 열린다.

### 후쿠오카

```js
open: [
  { id: 'hakata-port', tiles: { rects: [[205, 10, 255, 85]] } },
  { id: 'tenjin-ohori', tiles: { rects: [[90, 120, 259, 185]] } },
  { id: 'nakasu-hakata', tiles: { rects: [[260, 90, 350, 165]] } },
  { id: 'momochi', tiles: { rects: [[5, 100, 75, 160]] } },
]
```

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `hakata-port` | 3,876 | 3/4/3/0 | 스폰·EXIT 2·국내/국제 도선 도착 4·항구 |
| `tenjin-ohori` | 11,220 | 6/0/3/6 | 오호리~아카사카~덴진 지하철축, 학습 node 2 |
| `nakasu-hakata` | 6,916 | 4/0/10/5 | 나카스·캐널시티·하카타역, 학습 node 2 |
| `momochi` | 4,331 | 5/0/1/0 | 모모치 해안·타워·박물관·돔 |

지하철/도선 15개 TRANSIT stop과 모든 node·transitPoint·prop·station이 열린다.

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

| 지구 | 타일 | N/T/P/S | 포함 요약 |
|---|---:|---:|---|
| `arashiyama-sanin` | 14,672 | 1/0/3/4 | 도게쓰교·아라시야마~엔마치 산인선 서부 |
| `imperial-nijo` | 18,122 | 3/0/0/1 | 금각·교토고쇼·니조 |
| `higashiyama-core` | 21,896 | 5/0/2/0 | 은각·헤이안·니시키·기온·기요미즈 |
| `station-fushimi` | 20,582 | 2/0/4/5 | 스폰·EXIT 2·교토역~후시미 철도축, 학습 node 1 |

JR/버스 10개 TRANSIT stop과 모든 node·prop·station이 열린다.

## 사전검증 계약

- rect 범위: `0 <= x0 <= x1 < cols`, `0 <= y0 <= y1 < rows` — 28/28 PASS
- TRANSIT exact-1: `stations + transitPoints`에서 stop id 유일 해석 — 48/48 PASS, unknown 0
- TRANSIT raw/resolved: 원 tile과 `resolveArrivalTile()` 결과가 모두 open — 48/48, 48/48 PASS
- spawn: `city.entrance` 포함 — 4/4 PASS
- return: 실제 grid의 EXIT 전부 포함, `returnNode`가 `ALL_WORLD_NODES`에서 해석 — 8/8, 4/4 PASS
- door/NPC: `npc || gate || chapter || reading` node 포함 — 10/10 PASS
- runtime 예행: 후보를 임시 `district-v1` payload로 넣은 `resolveCityDistricts()` — 4/4 PASS
- source audit: 삿포로·나고야 registry/wrapper/geo 부재 — 2/2 `NO_SOURCE`

## 결정성·회귀 증거

입력은 네 도시 wrapper/geo 8개와 `cities/index.js`, `cityDistricts.js`, `terrain.js`,
`worldNodes.js` 총 12개다. 파일별 SHA-256 canonical 목록의 manifest SHA-256은
`13757586dc82517d2b9b19e7abdf3f97d944b72d0ac0b0ba77e06a759cb8217d`다.
publication base가 측정 중 전진해 GitHub compare로
`e330283ecb435b7bf5bad51aab35f57258b20a1f..49e6699764febdcd1132c4644389f65e91ed6705`를
감사했으며, 변경 7파일 중 이 12개 입력과 겹치는 파일은 0개다.

one-shot Node 측정기는 source availability, rect 합집합, 지구별 앵커 membership,
raw/resolved TRANSIT, 스폰·EXIT·문/NPC·returnNode와 실제 resolver 결과를 canonical JSON 한 줄로
직렬화했다. 측정기는 검증용 임시 파일이며 산출물에는 포함하지 않는다.

- audit canonical JSON SHA-256 run A:
  `719fb90b0d2d445e22943d1be0f77e47aea0bce3005cc528ae8812cea8809146`
- run B: byte-identical, 같은 SHA-256
- Node `v22.23.1` (`~/.nvm/versions/node/v22.23.1/bin/node`)
- one-shot max RSS: run A 195,168 KiB, run B 193,760 KiB
- targeted(latest base): 9 files / 137 tests PASS / 11.50s
- full(latest base, single worker): 212 files / 2,142 tests PASS / 252.22s

이 보고서는 현행 source로 검증 가능한 rect 후보와 `NO_SOURCE` 경계를 고정한다. 승인·D2 구현 때는
label·잠금 카피·해금 순서와 함께 동일 gate 검사를 정식 테스트로 승격하고, 미정의 도시는 RFC대로
완전 개방을 유지해야 한다.
