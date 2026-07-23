# Q4 리옹 B′ 정정 manifest 파일럿

상태: **draft / report-only**. 이 변경은 정정 생성기·manifest 초안·비교 crop만
커밋한다. 리옹 generator의 Q3 no-op hook이나 `lyon.geo.js`에는 manifest를 배선하지
않으며, 아래 after 결과는 별도 임시 worktree에서만 생성·검증했다.

## 규칙과 생성 계약

입력은 [`scan-tile-integrity.mjs`](../scripts/scan-tile-integrity.mjs)의 city-scoped r2
JSON이다. [`gen-tile-fix-manifest.mjs`](../scripts/gen-tile-fix-manifest.mjs)는
`schemaVersion=2`, canonical `dataSha256`, 도시·격자·B′ 성분·현재 CROSSWALK 값을
fail-closed로 확인한 뒤
[`applyTileFixes.mjs`](../scripts/lib/applyTileFixes.mjs)의 manifest v1을 출력한다.

첫 규칙 `b-prime-majority-noncrosswalk-walkable-v1`은 B′ 완전 고립 CROSSWALK
4방 성분의 각 타일을 독립적으로 처리한다.

1. 원본 grid에서 해당 타일의 8방 이웃을 읽는다.
2. CROSSWALK·EXIT·차단 타일·알 수 없는 코드를 제외한다.
3. 남은 보행 타일 code의 최빈값으로 치환한다.
4. 최빈값이 둘 이상이면 주변에 존재했는지와 무관하게 SIDEWALK로 고정한다.

finding ID는 `tile-integrity-r2:<city>:B:<anchor-y>:<anchor-x>`이며, 2타일 성분은
한 finding ID 아래 2개 fix가 생긴다. 모든 집계는 적용 전 원본 grid를 읽으므로 fix
순서가 결과에 영향을 주지 않는다.

```bash
node scripts/scan-tile-integrity.mjs \
  --city lyon --format json --output /tmp/q4-lyon-r2.json
node scripts/gen-tile-fix-manifest.mjs \
  --input /tmp/q4-lyon-r2.json \
  --city lyon \
  --type B \
  --rule b-prime-majority-noncrosswalk-walkable-v1 \
  --output data/fix-manifests/lyon-b1-draft.json
```

## 리옹 manifest 초안

- manifest: [`data/fix-manifests/lyon-b1-draft.json`](../data/fix-manifests/lyon-b1-draft.json)
- 격자: 428×501
- B′ finding: 28성분
- fix: 30타일 — SIDEWALK 24, ROAD 6
- 동률→SIDEWALK: 4타일
- scanner JSON canonical data SHA-256:
  `8532b1584f99928e6e2e43ecc21300ff3a723dc76e03c31b1f00b082c2bffd4a`
- scanner JSON file SHA-256:
  `dfeaa6600a3ea68d6497e74c21b1c06102f2643eb8c66911068c11b8f140f356`
- manifest A/B SHA-256:
  `3fded57a60c9e73d9205e1c91b2227c463ed1c8fd5b1d3c39a9ac96c27380a2f`

## 임시 적용과 Q1-r2 재스캔

`buildLyonCityGeo()`를 offline snapshot에서 다시 실행한 terrain이 committed geo와
같은지 먼저 비교하고, 그 in-memory terrain에 draft manifest를 `applyTileFixes()`로
적용했다. fixed RLE는 detached 임시 worktree의 `lyon.geo.js`에만 기록해 기존
Q1-r2 스캐너를 수정 없이 재실행한 뒤 worktree를 제거했다.

| 산출/유형 | before | after |
|---|---:|---:|
| terrain SHA-256 | `1d3036f8c0d8347946e62f2e08d22152ff07ce6f33b05909d6db3d71335835c9` | `635a7b9e59b13ccf1470dc91f19e843c64df4716fe400b0ba435288eb617ad85` |
| A′ 차도 ring 고립 건물 | 134 | 134 |
| B′ 완전 고립 횡단보도 | **28** | **0** |
| C′ 명백 평행 횡단보도 | 68 | 68 |
| D′ 1타일 고아 도로 | 388 | 377 |
| scan canonical data SHA-256 | `8532b1584f99928e6e2e43ecc21300ff3a723dc76e03c31b1f00b082c2bffd4a` | `932c03aabfb255c0458c67de6ab626b5c9a67a3feec3838ba49c302566141a21` |
| scan JSON file SHA-256 | `dfeaa6600a3ea68d6497e74c21b1c06102f2643eb8c66911068c11b8f140f356` | `bcfe0161381ed846bd04f9d4ed93a7a00b01306277916e5bf081c2ef85ed05f2` |

독립 임시 재생성 A/B의 fixed geo SHA-256은 모두
`78ec61084947099890325454aef3a7ee8b48b4e748510d22b432963c52931e25`,
after scan JSON SHA-256은 모두
`bcfe0161381ed846bd04f9d4ed93a7a00b01306277916e5bf081c2ef85ed05f2`였다.
after geo는 공식 리옹 verifier의 20m·fr·건물 비율·POI 재투영·론/손 단면·BRIDGE 0·
roadStyle 전 게이트를 통과했다.

D′ 감소 11은 고립 CROSSWALK를 ROAD/SIDEWALK로 바꾸면서 일부 1타일 roadLike
성분이 제거되거나 기존 성분에 연결된 파생 효과다. Q4 규칙은 D′를 직접 선택하거나
수정하지 않는다.

## 대표 5좌표 crop

각 crop은 17×17타일을 기존 2px/tile 팔레트로 렌더한 뒤 nearest-neighbor로
272×272px 확대했다. 전체 before/after PNG SHA-256은 각각
`2d1aac685c8a0bd82e98f210dd2239aeaee4e9acde1b6b71b103d03ab620759e`,
`828cc7a65c67d56592a746f525b99dd798eeea76eb53b8da72a4113870097e81`이다.
독립 crop 재렌더 A/B 10파일은 byte-identical이며, 파일명+파일 SHA의 canonical
묶음 SHA-256은 `35596eff48caadde3a00e9eb4dfc26fa63484c9e674f9aecb7693f6c88cb8995`다.

| 좌표·선정 이유 | before | after |
|---|---|---|
| `[13,37]` — SIDEWALK 최빈 | [before](img/q4-lyon-b-pilot/01-x013-y037-before.png) | [after](img/q4-lyon-b-pilot/01-x013-y037-after.png) |
| `[71,66]` — ROAD 최빈 | [before](img/q4-lyon-b-pilot/02-x071-y066-before.png) | [after](img/q4-lyon-b-pilot/02-x071-y066-after.png) |
| `[205,269]` — 2타일 성분 | [before](img/q4-lyon-b-pilot/03-x205-y269-before.png) | [after](img/q4-lyon-b-pilot/03-x205-y269-after.png) |
| `[135,313]` — ROAD/SIDEWALK 3:3 동률 | [before](img/q4-lyon-b-pilot/04-x135-y313-before.png) | [after](img/q4-lyon-b-pilot/04-x135-y313-after.png) |
| `[410,376]` — 동부 가장자리 SIDEWALK 최빈 | [before](img/q4-lyon-b-pilot/05-x410-y376-before.png) | [after](img/q4-lyon-b-pilot/05-x410-y376-after.png) |

## 검증

- 공식 nvm Node v22.23.1
- generator/apply/Lyon targeted: 4 files / 28 tests PASS
- final `set -o pipefail` full single-worker: 234 files / 2,263 tests PASS /
  237.16s / exit 0
- Lyon r2 scan→manifest→apply one-shot max RSS: 118,336 KiB
- `npm run lint`, `node --check scripts/gen-tile-fix-manifest.mjs`,
  `git diff --check`: PASS
- 제품 geo·runtime·registry·공용 verifier·DB: 변경 없음
