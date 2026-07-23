# 일본 4도시 NPC·도어 후보 64건 사전검증 — S21

## 결론

`docs/proposal-japan-npc-door-spots.md`의 도쿄·오사카·후쿠오카·교토 16개 지구,
NPC 32건·도어 32건을 현재 `origin/main` exact
`1f9b30897c7712e836f79117ce4db5d10867bfdd`에서 전수 재검증했다.

- 지구: 64/64가 `cityDistrictOpenAt()` 기준 open이고, 제안서가 지정한 정확한 한 지구에만 속한다.
- 보행: 64/64가 `isCityWalkable()`인 비EXIT 타일이며 cardinal 4방 보행 이웃이 하나 이상 있다.
- 충돌: 60/64가 기존 runtime 마커와 Chebyshev 1 이내 충돌이 없다. 문제 4건은 모두
  채움 라운드 3-1에서 이미 저작된 도쿄·오사카 NPC의 **동일 타일(C0)** 이다.
- 저작 중복: 같은 4건만 기존 NPC와 지구·역할이 모두 같다. 각 지구의 NPC 2안 4건은
  기존 NPC와 지구는 같지만 역할은 달라 후속 저작 후보로 유지할 수 있다.
- 도어: 32/32가 충돌 없이 OK이며, 제안서의 cardinal BUILDING 인접 조건도 유지된다.

따라서 후속 저작 입력은 문제 4건을 이미 소비된 후보로 제외하면 **60건(NPC 28·도어 32)**
그대로 사용할 수 있다. 문제 4건을 다른 역할로 재사용해야 할 때를 위해 공간 조건만 해소한
근처 대체 타일을 각 1개 제안하지만, 동일 역할을 다시 저작해서는 안 된다.

## 판정 기준

1. 각 도시 `buildGrid()`를 만든 뒤 공용 `resolveCityDistricts()`와
   `cityDistrictOpenAt()`을 그대로 호출했다. open 여부뿐 아니라 반환된 지구 id가 제안서의
   지구 id와 exact-1인지 확인했다.
2. 공용 `isCityWalkable()`을 적용하고 EXIT가 아니며 cardinal 4방 중 최소 한 칸으로
   걸어 나갈 수 있는지 확인했다.
3. 충돌은 제안서의 기존 척도대로 Chebyshev 거리 `C≤1`을 동일/인접 1타일로 판정했다.
   요청 범위인 `city.nodes`의 일반 노드·학습 도어·NPC를 포함하고, 보수적으로 역,
   `transitPoints`, 소품, 입구, EXIT도 같은 검사에 넣었다.
4. 기존 저작 중복은 채움 라운드 3-1(#478)의 네 NPC
   `tokyo-yamanote-west-cafe`, `tokyo-central-east-bookstore`,
   `osaka-north-hubs-transfer`, `osaka-castle-east-guide`와 지구·역할을 각각 대조했다.
   “동일 지구·역할 비중복”은 2 NPC/지구라는 T16 설계 안에서 문제로 세지 않았다.
5. 대체 타일은 같은 지구·보행·비EXIT·cardinal 이웃 조건을 만족하고, 기존 runtime 마커와
   나머지 제안 후보 모두로부터 Chebyshev 3 이상인 칸을 원점 근처에서 결정적으로 골랐다.

표에서 `지구·보행`의 지형명 뒤 `OK`는 위 1·2번을 모두 통과했다는 뜻이다.
`C0`은 exact 동일 타일, `없음`은 `C≤1` 마커가 없다는 뜻이다.

## 도쿄 — 16건

| 지구 | 후보 | 종류·타일 | 역할·지형 | 지구·보행 | 기존 마커 충돌 | 기존 4 NPC 중복 | 결과 |
|---|---|---|---|---|---|---|---|
| 야마노테·서부 (`yamanote-west`) | NPC 1안 | NPC `(239,545)` | 역세권 카페 직원 · SIDEWALK | OK | `tokyo-yamanote-west-cafe` NPC C0 | 동일 지구·동일 역할 | **문제** — 이미 저작됨. 공간 대안 `(236,545)` SIDEWALK |
| 야마노테·서부 (`yamanote-west`) | NPC 2안 | NPC `(187,312)` | 생활 편의점 · ROAD | OK | 없음 | 동일 지구·역할 비중복 | **OK** |
| 야마노테·서부 (`yamanote-west`) | 도어 1안 | 도어 `(307,46)` | SIDEWALK | OK | 없음 | — | **OK** |
| 야마노테·서부 (`yamanote-west`) | 도어 2안 | 도어 `(310,49)` | SIDEWALK | OK | 없음 | — | **OK** |
| 중심·동부 (`central-east`) | NPC 1안 | NPC `(497,66)` | 서점 직원 · ROAD | OK | `tokyo-central-east-bookstore` NPC C0 | 동일 지구·동일 역할 | **문제** — 이미 저작됨. 공간 대안 `(497,63)` SIDEWALK |
| 중심·동부 (`central-east`) | NPC 2안 | NPC `(460,11)` | 문구점 · SIDEWALK | OK | 없음 | 동일 지구·역할 비중복 | **OK** |
| 중심·동부 (`central-east`) | 도어 1안 | 도어 `(457,14)` | SIDEWALK | OK | 없음 | — | **OK** |
| 중심·동부 (`central-east`) | 도어 2안 | 도어 `(362,36)` | SIDEWALK | OK | 없음 | — | **OK** |
| 남부·항만 (`south-bay`) | NPC 1안 | NPC `(354,619)` | 수변 안내원 · PLAZA | OK | 없음 | 없음 | **OK** |
| 남부·항만 (`south-bay`) | NPC 2안 | NPC `(360,619)` | 자전거 대여점 · PLAZA | OK | 없음 | 없음 | **OK** |
| 남부·항만 (`south-bay`) | 도어 1안 | 도어 `(354,622)` | PLAZA | OK | 없음 | — | **OK** |
| 남부·항만 (`south-bay`) | 도어 2안 | 도어 `(360,615)` | PLAZA | OK | 없음 | — | **OK** |
| 하네다 (`haneda`) | NPC 1안 | NPC `(563,1059)` | 공항 안내 직원 · PLAZA | OK | 없음 | 없음 | **OK** |
| 하네다 (`haneda`) | NPC 2안 | NPC `(560,1062)` | 여행 안내소 · PLAZA | OK | 없음 | 없음 | **OK** |
| 하네다 (`haneda`) | 도어 1안 | 도어 `(561,1065)` | PLAZA | OK | 없음 | — | **OK** |
| 하네다 (`haneda`) | 도어 2안 | 도어 `(564,1067)` | PLAZA | OK | 없음 | — | **OK** |

도쿄 소계는 14 OK·2 문제다. 두 문제는 open·보행 자체는 통과했으며, #478이 같은
좌표와 역할을 이미 소비한 데이터 신선도 문제다.

## 오사카 — 16건

| 지구 | 후보 | 종류·타일 | 역할·지형 | 지구·보행 | 기존 마커 충돌 | 기존 4 NPC 중복 | 결과 |
|---|---|---|---|---|---|---|---|
| 북부·허브 (`north-hubs`) | NPC 1안 | NPC `(435,5)` | 환승 안내원 · PLAZA | OK | `osaka-north-hubs-transfer` NPC C0 | 동일 지구·동일 역할 | **문제** — 이미 저작됨. 공간 대안 `(435,2)` SIDEWALK |
| 북부·허브 (`north-hubs`) | NPC 2안 | NPC `(432,8)` | 역 구내 식당 · PLAZA | OK | 없음 | 동일 지구·역할 비중복 | **OK** |
| 북부·허브 (`north-hubs`) | 도어 1안 | 도어 `(434,11)` | PLAZA | OK | 없음 | — | **OK** |
| 북부·허브 (`north-hubs`) | 도어 2안 | 도어 `(410,182)` | PLAZA | OK | 없음 | — | **OK** |
| 성곽·동부 (`castle-east`) | NPC 1안 | NPC `(553,262)` | 공원 안내원 · SIDEWALK | OK | `osaka-castle-east-guide` NPC C0 | 동일 지구·동일 역할 | **문제** — 이미 저작됨. 공간 대안 `(553,259)` SIDEWALK |
| 성곽·동부 (`castle-east`) | NPC 2안 | NPC `(550,265)` | 전통 공방 · SIDEWALK | OK | 없음 | 동일 지구·역할 비중복 | **OK** |
| 성곽·동부 (`castle-east`) | 도어 1안 | 도어 `(553,268)` | SIDEWALK | OK | 없음 | — | **OK** |
| 성곽·동부 (`castle-east`) | 도어 2안 | 도어 `(593,303)` | SIDEWALK | OK | 없음 | — | **OK** |
| 난바·텐노지 (`namba-tennoji`) | NPC 1안 | NPC `(280,296)` | 시장 음식점 직원 · SIDEWALK | OK | 없음 | 없음 | **OK** |
| 난바·텐노지 (`namba-tennoji`) | NPC 2안 | NPC `(501,487)` | 생활 식료품점 · SIDEWALK | OK | 없음 | 없음 | **OK** |
| 난바·텐노지 (`namba-tennoji`) | 도어 1안 | 도어 `(504,490)` | SIDEWALK | OK | 없음 | — | **OK** |
| 난바·텐노지 (`namba-tennoji`) | 도어 2안 | 도어 `(263,360)` | ROAD | OK | 없음 | — | **OK** |
| 항만 (`bay`) | NPC 1안 | NPC `(114,444)` | 항만 안내원 · PLAZA | OK | 없음 | 없음 | **OK** |
| 항만 (`bay`) | NPC 2안 | NPC `(111,447)` | 장비 대여점 · PLAZA | OK | 없음 | 없음 | **OK** |
| 항만 (`bay`) | 도어 1안 | 도어 `(111,441)` | SIDEWALK | OK | 없음 | — | **OK** |
| 항만 (`bay`) | 도어 2안 | 도어 `(108,444)` | SIDEWALK | OK | 없음 | — | **OK** |

오사카 소계도 14 OK·2 문제다. 도쿄와 마찬가지로 두 문제 모두 지형 회귀가 아니라
#478의 exact 좌표·역할 소비 때문이다.

## 후쿠오카 — 16건

| 지구 | 후보 | 종류·타일 | 역할·지형 | 지구·보행 | 기존 마커 충돌 | 기존 4 NPC 중복 | 결과 |
|---|---|---|---|---|---|---|---|
| 하카타항 (`hakata-port`) | NPC 1안 | NPC `(214,69)` | 여객터미널 안내원 · BRIDGE | OK | 없음 | 없음 | **OK** |
| 하카타항 (`hakata-port`) | NPC 2안 | NPC `(244,43)` | 항구 식당 · SIDEWALK | OK | 없음 | 없음 | **OK** |
| 하카타항 (`hakata-port`) | 도어 1안 | 도어 `(241,46)` | SIDEWALK | OK | 없음 | — | **OK** |
| 하카타항 (`hakata-port`) | 도어 2안 | 도어 `(235,62)` | SIDEWALK | OK | 없음 | — | **OK** |
| 텐진·오호리 (`tenjin-ohori`) | NPC 1안 | NPC `(142,147)` | 공원 산책 안내원 · SIDEWALK | OK | 없음 | 없음 | **OK** |
| 텐진·오호리 (`tenjin-ohori`) | NPC 2안 | NPC `(238,145)` | 자전거 대여점 · CROSSWALK | OK | 없음 | 없음 | **OK** |
| 텐진·오호리 (`tenjin-ohori`) | 도어 1안 | 도어 `(234,134)` | ROAD | OK | 없음 | — | **OK** |
| 텐진·오호리 (`tenjin-ohori`) | 도어 2안 | 도어 `(255,136)` | ROAD | OK | 없음 | — | **OK** |
| 나카스·하카타 (`nakasu-hakata`) | NPC 1안 | NPC `(294,140)` | 시장 음식점 직원 · PLAZA | OK | 없음 | 없음 | **OK** |
| 나카스·하카타 (`nakasu-hakata`) | NPC 2안 | NPC `(293,143)` | 생활 잡화점 · PLAZA | OK | 없음 | 없음 | **OK** |
| 나카스·하카타 (`nakasu-hakata`) | 도어 1안 | 도어 `(290,144)` | PLAZA | OK | 없음 | — | **OK** |
| 나카스·하카타 (`nakasu-hakata`) | 도어 2안 | 도어 `(332,141)` | PLAZA | OK | 없음 | — | **OK** |
| 모모치 (`momochi`) | NPC 1안 | NPC `(62,115)` | 해변 안내원 · ROAD | OK | 없음 | 없음 | **OK** |
| 모모치 (`momochi`) | NPC 2안 | NPC `(20,146)` | 수변 카페 · ROAD | OK | 없음 | 없음 | **OK** |
| 모모치 (`momochi`) | 도어 1안 | 도어 `(23,143)` | SIDEWALK | OK | 없음 | — | **OK** |
| 모모치 (`momochi`) | 도어 2안 | 도어 `(23,149)` | SIDEWALK | OK | 없음 | — | **OK** |

후쿠오카는 16/16 OK다.

## 교토 — 16건

| 지구 | 후보 | 종류·타일 | 역할·지형 | 지구·보행 | 기존 마커 충돌 | 기존 4 NPC 중복 | 결과 |
|---|---|---|---|---|---|---|---|
| 아라시야마·산인 (`arashiyama-sanin`) | NPC 1안 | NPC `(49,229)` | 산책길 안내원 · PLAZA | OK | 없음 | 없음 | **OK** |
| 아라시야마·산인 (`arashiyama-sanin`) | NPC 2안 | NPC `(55,229)` | 공예품점 · PLAZA | OK | 없음 | 없음 | **OK** |
| 아라시야마·산인 (`arashiyama-sanin`) | 도어 1안 | 도어 `(55,232)` | ROAD | OK | 없음 | — | **OK** |
| 아라시야마·산인 (`arashiyama-sanin`) | 도어 2안 | 도어 `(50,233)` | ROAD | OK | 없음 | — | **OK** |
| 황궁·니조 (`imperial-nijo`) | NPC 1안 | NPC `(324,272)` | 정원 안내원 · PLAZA | OK | 없음 | 없음 | **OK** |
| 황궁·니조 (`imperial-nijo`) | NPC 2안 | NPC `(330,272)` | 전통 공방 · PLAZA | OK | 없음 | 없음 | **OK** |
| 황궁·니조 (`imperial-nijo`) | 도어 1안 | 도어 `(326,275)` | PLAZA | OK | 없음 | — | **OK** |
| 황궁·니조 (`imperial-nijo`) | 도어 2안 | 도어 `(329,275)` | PLAZA | OK | 없음 | — | **OK** |
| 히가시야마·중심 (`higashiyama-core`) | NPC 1안 | NPC `(587,183)` | 골목 안내원 · SIDEWALK | OK | 없음 | 없음 | **OK** |
| 히가시야마·중심 (`higashiyama-core`) | NPC 2안 | NPC `(490,314)` | 찻집 · SIDEWALK | OK | 없음 | 없음 | **OK** |
| 히가시야마·중심 (`higashiyama-core`) | 도어 1안 | 도어 `(496,314)` | SIDEWALK | OK | 없음 | — | **OK** |
| 히가시야마·중심 (`higashiyama-core`) | 도어 2안 | 도어 `(515,247)` | SIDEWALK | OK | 없음 | — | **OK** |
| 역·후시미 (`station-fushimi`) | NPC 1안 | NPC `(401,415)` | 역 안내원 · PLAZA | OK | 없음 | 없음 | **OK** |
| 역·후시미 (`station-fushimi`) | NPC 2안 | NPC `(407,415)` | 짐 보관소 · PLAZA | OK | 없음 | 없음 | **OK** |
| 역·후시미 (`station-fushimi`) | 도어 1안 | 도어 `(403,419)` | PLAZA | OK | 없음 | — | **OK** |
| 역·후시미 (`station-fushimi`) | 도어 2안 | 도어 `(406,419)` | PLAZA | OK | 없음 | — | **OK** |

교토도 16/16 OK다.

## 문제 4건과 대체 타일

| 도시·지구 | 문제 후보 | 문제 사유 | 근처 공간 대안 | 대안 계약 | 후속 처리 |
|---|---|---|---|---|---|
| 도쿄·야마노테·서부 | NPC 1안 `(239,545)` 역세권 카페 직원 | `tokyo-yamanote-west-cafe`와 C0, 동일 역할 | `(236,545)` SIDEWALK | 같은 open 지구·보행·기존/후보 C≥3 | 기존 NPC를 유지하고 후보 제외. 새 역할일 때만 대안 사용 |
| 도쿄·중심·동부 | NPC 1안 `(497,66)` 서점 직원 | `tokyo-central-east-bookstore`와 C0, 동일 역할 | `(497,63)` SIDEWALK | 같은 open 지구·보행·기존/후보 C≥3 | 기존 NPC를 유지하고 후보 제외. 새 역할일 때만 대안 사용 |
| 오사카·북부·허브 | NPC 1안 `(435,5)` 환승 안내원 | `osaka-north-hubs-transfer`와 C0, 동일 역할 | `(435,2)` SIDEWALK | 같은 open 지구·보행·기존/후보 C≥3 | 기존 NPC를 유지하고 후보 제외. 새 역할일 때만 대안 사용 |
| 오사카·성곽·동부 | NPC 1안 `(553,262)` 공원 안내원 | `osaka-castle-east-guide`와 C0, 동일 역할 | `(553,259)` SIDEWALK | 같은 open 지구·보행·기존/후보 C≥3 | 기존 NPC를 유지하고 후보 제외. 새 역할일 때만 대안 사용 |

이 대체안은 공간 충돌만 푼다. 네 역할은 이미 저작됐으므로 좌표만 바꿔 같은 역할을
중복 생성하는 근거로 사용하면 안 된다.

## 재현·입력 고정

- 측정 base: `1f9b30897c7712e836f79117ce4db5d10867bfdd`
  (`origin/main`, S20 #499 merge).
- 런타임: 공식 nvm Node `v22.23.1`
  (`/Users/chaeyeonwon/.nvm/versions/node/v22.23.1/bin/node`).
- 입력 11파일: T16 제안서, 공용 district/terrain, 네 도시 wrapper·geo.
  정렬된 `shasum -a 256` manifest digest는
  `b94e15001a9e4f6a8e589f1344303aeba66a0e2e83757dd9713ed4c91cafe0b0`다.
- canonical 결과 JSON의 내장 SHA-256은 두 번 모두
  `b356e6656fc6e5c1b869fecf7b6dcaf22c7708ba13045b99d4184d16bd1a8fc2`였다.
  pretty JSON stdout SHA-256도 두 번 모두
  `749fb61f5df477ebc00ecb1df68c022fece3df9fad27e36d6a5c1b96bef2a3d0`로
  byte-identical했다.
- 집계: 4도시·16지구·64후보(NPC 32·도어 32), 지구 exact 64,
  보행 64, 충돌 없음 60, 기존 역할 비중복 60, 최종 60 OK·4 문제.
- targeted district·4도시 wrapper/geo 회귀:
  9 files / 153 tests PASS(5.10초).
- 첫 병렬 전체 실행은 `cityDistrictBoundarySigns`의 5초 제한 1건만 timeout
  (228 files·2,242 tests PASS, 1 test timeout)했고, 해당 파일 단독은
  1 file / 5 tests PASS(3.33초)였다.
- 최종 `set -o pipefail` 단일 worker 전체 회귀:
  229 files / 2,243 tests PASS(250.42초), pipeline exit 0.

## 비구현 경계

이 PR은 report-only다. 도시 wrapper·geo, 지구 rect, NPC 스크립트, 학습 도어, registry,
`CityScene`, 공용 verifier, DB를 변경하지 않는다. 대체 좌표도 자동 승인값이 아니며,
후속 저작 SPEC이 역할과 최종 타일을 선택한 뒤 같은 검사를 다시 통과해야 한다.
