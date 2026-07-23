# Q6 리옹 전 유형 정정 manifest 사전공사

## 범위

- 상태: **draft / 임시 적용 검증만 완료**
- 기준: Q4 pre-B terrain의 Q1-r2·Q1-v2r2 판정
- 제품 불변: `src/components/world/cities/lyon.geo.js`와 리옹 생성기의 정본 manifest
  연결은 수정하지 않았다. 아래 after 값은 격리 worktree에서
  `lyon-all-draft.json`을 임시 적용해 재생성한 결과다.
- 통합 유형: A′·B′·C′·D′·F·H′
- source r2 canonical data SHA-256:
  `8532b1584f99928e6e2e43ecc21300ff3a723dc76e03c31b1f00b082c2bffd4a`

## 규칙과 결정 순서

| 순서 | ruleId | 정정 |
|---:|---|---|
| 1 | `b-prime-majority-noncrosswalk-walkable-v1` | B′ CROSSWALK 성분을 타일별 8방 최빈 비CROSSWALK 보행류로 복원하고 최빈 동률은 SIDEWALK로 고정 |
| 2 | `h-prime-road-absorb-v1` | H′ 단일 PLAZA·PARK 파편을 ROAD로 흡수 |
| 3 | `a-prime-majority-carriageway-v1` | A′ 1–2타일 BUILDING 성분을 바깥 ring 최빈 차도류로 흡수 |
| 4 | `c-prime-perpendicular-full-road-width-v1` | C′ 성분의 실제 중심 타일을 유지하고 원성분은 ROAD로 복원한 뒤 도로축 수직 전폭 CROSSWALK로 재배열 |
| 5 | `f-full-road-width-crosswalk-v1` | F의 안정 도로 전폭 중 ROAD만 CROSSWALK로 연장; 기존 CROSSWALK 문맥은 유지 |
| 6 | `d-prime-majority-nonroad-v1` | 남은 D′ 1타일 roadLike를 주변 8방 최빈 비도로 타일로 흡수 |

H′가 새 A′를 만들거나 A′가 F의 도로 폭을 바꾸는 교차 유형을 수렴시키기 위해
`B→H→A→C→F→D` 순서를 고정했다. 동일 좌표가 여러 규칙을 거치면 원본 before와
최종 after만 manifest에 한 번 기록한다.

## 공통 안전 가드

각 finding의 원성분·새 목표를 합친 touched 좌표 중 하나라도 아래에 해당하면 finding
전체를 원자적으로 skip한다.

- spawn
- 학습 door(`kind=spot` + 유효 `track`·`chapter`)
- NPC
- station
- resolved mainRoute path

추가로 D′ 최빈값이 blocked 지형일 때 해당 타일 제거가 현재 단일 4방 보행 성분의
articulation을 끊으면 `walkability-articulation`으로 fail-closed skip한다. 최빈값을
임의의 차선 후보로 바꾸지 않는다.

| skip 이유 | 건수 | 유형 |
|---|---:|---|
| protected tile | 4 | C′ 1, D′ 1, F 2 |
| walkability articulation | 17 | D′ 17 |
| 합계 | 21 | C′ 1, D′ 18, F 2 |

protected-tile 좌표는 C′ `[158,180]`, D′ `[177,145]`, F `[125,204]·[126,204]`,
F `[249,217]`이며 모두 mainRoute다. 최종 fixes와 전체 보호 좌표의 교집합은 0이다.

## 통합 draft manifest

- 경로: `data/fix-manifests/lyon-all-draft.json`
- fixes: 1,001
- 최종 fix 소유 findingId: 707
- skipped findings: 21
- byte SHA-256:
  `8f1273da5530c742e40f62b3a62f6201f6707474309cb24c3d4e79cbab699d5d`
- 독립 생성 A/B: byte-identical
- 생성 max RSS: 130,105,344 bytes

| 규칙 | fixes | 최종 fix 소유 finding |
|---|---:|---:|
| A′ | 176 | 135 |
| B′ | 24 | 22 |
| C′ | 217 | 67 |
| D′ | 354 | 354 |
| F | 170 | 69 |
| H′ | 60 | 60 |

B′는 28 finding을 모두 적용했지만 이후 D′와 같은 좌표의 최종 after가 통합되므로
최종 fix 소유 findingId는 22개다. manifest `summary`에는 원 판정 28건 적용을 별도로
보존한다.

## 임시 적용 재생성·재스캔

| 유형 | pre-B 기준 | after 총건수 | skip 건수 | skip 제외 잔여 |
|---|---:|---:|---:|---:|
| A′ | 134 | 0 | 0 | **0** |
| B′ | 28 | 0 | 0 | **0** |
| C′ | 68 | 0 | 1 | **0** |
| D′ | 388 | 18 | 18 | **0** |
| F | 71 | 2 | 2 | **0** |
| H′ | 60 | 0 | 0 | **0** |

C′ protected finding 1건은 C′ 자체로는 skip했으나 보호 좌표를 건드리지 않는 F 규칙이
형상을 해소해 after 스캔에는 남지 않았다. 순차 상호작용으로 A′ 후보는 134→135,
F 후보는 71→72였고, D′ 16건은 선행 규칙으로 이미 해소됐다.

결정성 산출물:

| 산출물 | A/B SHA-256 |
|---|---|
| 임시 generated `lyon.geo.js` | `eeac277838460be2af740b69e85cb345ac42d58bd608a25f38c803f8f957b007` |
| r2 after JSON | `61b24e8fc9cffd24c46fc7b056c4fa187f3e321cb5c3cdf8d6ebe06402e26d88` |
| v2r2 after Markdown | `a9c2fc042f50837f374cdc620667ed94d596d0c008deb322188e8ed04e5576a3` |
| 임시 terrain bytes | `7113be36aa816b246f353db21584d7fe5dc1b38a025d041e9a2326ec26d5a959` |
| 임시 full PNG | `a229c200baa5d9c881fdc83220bcddea5d88b08ea21123bdbeb3c6e7a95d11e2` |

임시 terrain의 보행 타일은 165,119 / 도달 165,119로 단일 4방 성분을 유지한다.
공식 `verify-city-geo --city lyon`도 BRIDGE 0, POI 재투영 worst 1.28타일,
론·손강 단면을 포함한 전 게이트를 통과했다.

## 기대값 자동 갱신

`scripts/update-tile-fix-expectations.mjs`는 현재 committed geo를 실측해 다음 위치만
fail-closed로 갱신한다.

- 리옹 terrain 계수·건물비·수계 계수·단일 4방 보행 수·terrain/PNG SHA·RLE 길이
- district boundary-sign 도시별 수와 manifest SHA
- S18 district-sign audit 도시별 수와 audit SHA
- Vitest의 road-autotile snapshot

현재 Q5 제품 상태의 `--check`는 `updatedFiles=[]`인 no-op이다. 격리 통합 geo에서는
리옹 팻말 62→61, boundary manifest
`ea969b…33b4`→`28d03f…30cb`, audit
`3f63d4…a77`→`e2a090…11e2`, autotile SHA
`0f6769…78c`→`17cf9410…a2777`로 자동 갱신됐다. update 직후 재실행은
`updatedFiles=[]`였고, 임시 적용 targeted 5 files / 26 tests가 green이었다.
targeted max RSS는 3,791,929,344 bytes였다.

최종 committed 제품 상태 검증:

- Node v22.23.1 official nvm
- `npm run lint`: PASS
- generator/apply targeted: 2 files / 16 tests PASS
- `update-tile-fix-expectations.mjs --check`: `updatedFiles=[]`
- `set -o pipefail` 전체 직렬 Vitest: 235 files / 2,286 tests PASS /
  243.33s / max RSS 3,951,198,208 bytes / exit 0
- `git diff --check`: PASS

정본 geo 승격·생성기 manifest 연결은 이 PR의 범위가 아니며 Claude merge 게이트에서
별도 적용해야 한다.
