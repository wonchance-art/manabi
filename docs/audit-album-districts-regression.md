# S12 — 지구제 11도시 여행 수첩 표기 회귀 감사

- 상태: **report-only** — 제품 코드·테스트·도시 데이터 수정 없음
- 기준: `origin/main` `db8d09fdb2238ba1960b4eb712bda5c7e3b304a9`
- 계기: 일본 4도시 지구 정본 PR #470 merge commit
  `4e443cf7c6e794ef68061331d7dde7bb01f2cd58`
- 감사 범위: D3 지구 수·라벨 칩, S6 발견률, S7 다음 목표 1줄, S8이 정리한 동일 카드 표면
- 환경: Node `v22.23.1` 공식 nvm 배포판

## 결론

**회귀가 있다.** 기존 7도시는 지구 수·라벨 칩·다음 목표가 모두 정합하지만, #470에서
`district-v1`이 추가된 도쿄·오사카·후쿠오카·교토는 여행 수첩의 D3 정적 허용 목록에 들어오지
않아 `개방 4 동네`와 라벨 칩 4개가 전부 표시되지 않는다. 따라서 지구 표면은 **7/11 PASS,
4/11 FAIL**이다.

반면 일본 4도시는 S6 주동선 발견 정본이 없고, S7은 이 경우 유효한 지구 목표를 만들지 않은 채
칭호 목표를 선택한다. 고정 감사 입력에서 네 도시 모두 `다음 칭호까지 도장 9개`로 폴백해
**다음 목표는 11/11 PASS**다. S8의 모바일 스타일은 이미 만들어진 표기를 배치할 뿐이므로,
이번 누락의 원인은 레이아웃이 아니라 D3 상세 도시 집합이다.

## 순수 로직 감사 계약

도시마다 서로 영향을 주지 않도록 아래 상태로 독립 평가했다.

- 해당 도시 스탬프만 보유: 정본 스탬프 `1/85`
- `route-discoveries:<cityId>` 저장 없음: 발견 `0/m`
- `worldTitles` 저장 없음: 첫 칭호까지 스탬프 9개
- 지구 기대값: 각 도시 `buildGrid()`와 `resolveCityDistricts()`를 거친 `resolved.open`에서
  공용 `cityDistrictOpenAt()`으로 재검증한 라벨
- 실제 표면값: `stampAlbumDistrictPresentation()`
- 다음 목표: `stampAlbumDiscoveryProgress()`와 `stampTitlePresentation()`의 결과를
  `stampAlbumNextGoal()`에 그대로 전달

이 입력은 라이브 저장 상태의 특정 스냅샷을 주장하지 않는다. 도시별 데이터 연결과 선택
우선순위를 같은 조건에서 전수 비교하기 위한 결정적 회귀 fixture다.

## 11도시 전수 검증표

| 도시 (`cityId`, 앨범 node) | 정본 기대값: 지구 수 · 라벨 칩 | 현재 수첩 D3 표면 | 다음 목표 1줄 | 판정 |
|---|---|---|---|---|
| 서울 (`seoul`, `seoul`) | `개방 4 동네` · 사대문 안 / 서남권 / 강남·잠실 / 한강 북안 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 부산 (`busan`, `busan`) | `개방 4 동네` · 원도심·항만 / 도심 북부 / 동부 해안 / 남부 해안 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 코트다쥐르 (`cote-dazur`, `nice`) | `개방 4 동네` · 서부 리비에라 / 니스 / 동부 연안 / 모나코 일대 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 레만호 연안 (`leman-riviera`, `leman-riviera`) | `개방 4 동네` · 로잔·우시 / 라보 포도밭 / 브베 / 몽트뢰·시옹 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 리옹 (`lyon`, `lyon`) | `개방 4 동네` · 프레스킬 남부 / 구시가·푸르비에르 / 테로·크루아루스 / 론 강변·파르디외 | 기대값과 일치 | `발견 0/8` | PASS |
| 보르도 (`bordeaux`, `bordeaux`) | `개방 4 동네` · 생장역 일대 / 역사 지구 / 샤르트롱·북강변 / 클래식 워크 회랑 | 기대값과 일치 | `발견 0/8` | PASS |
| 스트라스부르 (`strasbourg`, `strasbourg`) | `개방 4 동네` · 중앙역 일대 / 그랑딜 / 유럽 지구 / 리버사이드 워크 회랑 | 기대값과 일치 | `발견 0/7` | PASS |
| 도쿄 (`tokyo`, `tokyo`) | `개방 4 동네` · 야마노테·서부 / 중심·동부 / 남부·항만 / 하네다 | **미표시 (`null`)** | `다음 칭호까지 도장 9개` | **지구 FAIL / 목표 PASS** |
| 오사카 (`osaka`, `osaka`) | `개방 4 동네` · 북부·허브 / 성곽·동부 / 난바·텐노지 / 항만 | **미표시 (`null`)** | `다음 칭호까지 도장 9개` | **지구 FAIL / 목표 PASS** |
| 후쿠오카 (`fukuoka`, `fukuoka`) | `개방 4 동네` · 하카타항 / 텐진·오호리 / 나카스·하카타 / 모모치 | **미표시 (`null`)** | `다음 칭호까지 도장 9개` | **지구 FAIL / 목표 PASS** |
| 교토 (`kyoto`, `kyoto`) | `개방 4 동네` · 아라시야마·산인 / 황궁·니조 / 히가시야마·중심 / 역·후시미 | **미표시 (`null`)** | `다음 칭호까지 도장 9개` | **지구 FAIL / 목표 PASS** |

## 발견 사항과 원인

### A1 — 일본 4도시 지구 수·칩 누락

`stampAlbumDistrictPresentation.js`의 `STAMP_ALBUM_DISTRICT_CITY_IDS`는 기존 7도시만
열거한다. `stampAlbumDistrictPresentation()`은 이 집합 밖 도시를 데이터 확인 전에
`null`로 반환한다. #470은 도시별 `districts` 블록과 엔진 테스트를 추가했지만 이 소비 집합은
갱신하지 않았다.

`StampAlbum.jsx`의 `DETAIL_CITY_IDS`도 위 지구 집합과 S6 발견 집합의 합집합이다. 따라서 일본
4도시는 상세 lazy-load 대상에서도 빠지고, 카드의 `district`가 계속 `null`이므로 S8 레이아웃에
전달할 `개방 4 동네`와 칩 자체가 만들어지지 않는다.

### A2 — 일본 4도시 칭호 폴백 정상

일본 4도시는 `STAMP_ALBUM_DISCOVERY_CITY_IDS`에 없고 현재 정본 `mainRoute.discoveries`도
없으므로 S6 결과가 `null`이다. 동시에 `DETAIL_CITY_IDS` 밖이라 `detailReady`는 즉시 참이 되고,
S7은 `district=null`, `discovery=null`, `stampTitle=잔여 9`에서 유일한 유효 후보인
`stamp-title`을 선택한다. 네 도시 모두 문구와 `kind`가 동일해 폴백 계약은 정상이다.

## 결정성·검증

- one-shot JSON을 독립 Node 프로세스 2회 실행: byte-identical
- SHA-256 A/B:
  `08c526ba2aa4405a25d73900caa4ab438d845cad48b696a8a61feddf2e68ef0c`
- one-shot 감사 프로세스 max RSS: 477,986,816 bytes
- targeted: 5 files / 19 tests PASS, 2.71초, exit 0
- `set -o pipefail; npx vitest run --no-file-parallelism`:
  222 files / 2,205 tests PASS, 224.72초, exit 0
- `git diff --check` PASS; 변경 파일은 이 감사 문서 1개뿐이며 제품 코드·테스트는 무수정

## report-only 경계와 승인 후 후보

이번 PR은 이상을 기록할 뿐 수정하지 않는다. 승인 후 최소 수정 후보는 D3 지구 도시 집합에
일본 4도시를 편입해 상세 lazy-load와 presentation이 함께 열리게 하고, 기존 7도시 고정
회귀를 11도시 기대표로 확장하는 것이다. S6 발견 집합과 S7 칭호 폴백은 현재 계약을 유지해야
한다. 정확한 허용 파일과 테스트 범위는 별도 승인 뒤 확정한다.
