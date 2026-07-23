# S15 — 지구제 11도시 여행 수첩 표기 merge 후 정합 감사

- 상태: **report-only** — 제품 코드·테스트·도시 데이터 수정 없음
- 기준: `origin/main` `1aec1e200d0146c3adb8cfb2904fad032a252e43`
- 계기: S14 수첩 지구 표기 동적 판정 PR #481 merge
- 감사 범위: D3 지구 수·라벨 칩, S6 발견률, S7·S13 다음 목표 1줄,
  S8이 정리한 동일 카드 표면
- 환경: Node `v22.23.1` 공식 nvm 배포판

## 결론

**S12에서 보고한 회귀는 S14 merge 뒤 남아 있지 않다.** 현재 수첩은 보유한 도시 노드의
payload를 lazy-load하고, 정적 도시 목록 대신 실제 `districts` 정의 여부로 D3 표기를 만든다.
도쿄·오사카·후쿠오카·교토도 각각 `개방 4 동네`와 라벨 칩 4개를 노출한다. 지구 표면과
다음 목표는 모두 **11/11 PASS**다.

일본 4도시는 S6 주동선 발견 정본과 S13 만남 분모가 없으므로 고정 감사 입력에서 네 도시
모두 `다음 칭호까지 도장 9개`로 폴백한다. 리옹·보르도·스트라스부르는 S13 merge 뒤
만남 목표가 발견 목표보다 우선한다.

## 순수 로직 감사 계약

도시마다 서로 영향을 주지 않도록 아래 상태로 독립 평가했다.

- 해당 도시 스탬프만 보유: 정본 스탬프 `1/85`
- `route-discoveries:<cityId>` 저장 없음: 발견 `0/m`
- `worldTitles` 저장 없음: 첫 칭호까지 스탬프 9개
- 지구 기대값: 각 도시 `buildGrid()`와 `resolveCityDistricts()`를 거친 `resolved.open`에서
  공용 `cityDistrictOpenAt()`으로 재검증한 라벨
- 실제 표면값: `stampAlbumDistrictPresentation()`
- 다음 목표: `stampAlbumDiscoveryProgress()`, `stampAlbumNpcMeetingProgress()`,
  `stampTitlePresentation()`의 결과를 `stampAlbumNextGoal()`에 그대로 전달

이 입력은 라이브 저장 상태의 특정 스냅샷을 주장하지 않는다. 도시별 데이터 연결과 선택
우선순위를 같은 조건에서 전수 비교하기 위한 결정적 회귀 fixture다.

## 11도시 전수 검증표

| 도시 (`cityId`, 앨범 node) | 정본 기대값: 지구 수 · 라벨 칩 | 현재 수첩 D3 표면 | 다음 목표 1줄 | 판정 |
|---|---|---|---|---|
| 서울 (`seoul`, `seoul`) | `개방 4 동네` · 사대문 안 / 서남권 / 강남·잠실 / 한강 북안 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 부산 (`busan`, `busan`) | `개방 4 동네` · 원도심·항만 / 도심 북부 / 동부 해안 / 남부 해안 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 코트다쥐르 (`cote-dazur`, `nice`) | `개방 4 동네` · 서부 리비에라 / 니스 / 동부 연안 / 모나코 일대 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 레만호 연안 (`leman-riviera`, `leman-riviera`) | `개방 4 동네` · 로잔·우시 / 라보 포도밭 / 브베 / 몽트뢰·시옹 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 리옹 (`lyon`, `lyon`) | `개방 4 동네` · 프레스킬 남부 / 구시가·푸르비에르 / 테로·크루아루스 / 론 강변·파르디외 | 기대값과 일치 | `만난 사람 0/3` | PASS |
| 보르도 (`bordeaux`, `bordeaux`) | `개방 4 동네` · 생장역 일대 / 역사 지구 / 샤르트롱·북강변 / 클래식 워크 회랑 | 기대값과 일치 | `만난 사람 0/1` | PASS |
| 스트라스부르 (`strasbourg`, `strasbourg`) | `개방 4 동네` · 중앙역 일대 / 그랑딜 / 유럽 지구 / 리버사이드 워크 회랑 | 기대값과 일치 | `만난 사람 0/1` | PASS |
| 도쿄 (`tokyo`, `tokyo`) | `개방 4 동네` · 야마노테·서부 / 중심·동부 / 남부·항만 / 하네다 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 오사카 (`osaka`, `osaka`) | `개방 4 동네` · 북부·허브 / 성곽·동부 / 난바·텐노지 / 항만 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 후쿠오카 (`fukuoka`, `fukuoka`) | `개방 4 동네` · 하카타항 / 텐진·오호리 / 나카스·하카타 / 모모치 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |
| 교토 (`kyoto`, `kyoto`) | `개방 4 동네` · 아라시야마·산인 / 황궁·니조 / 히가시야마·중심 / 역·후시미 | 기대값과 일치 | `다음 칭호까지 도장 9개` | PASS |

## merge 후 경로 확인

### A1 — 일본 4도시 지구 수·칩 복구

`StampAlbum.jsx`는 현재 탭에서 보유한 모든 도시 노드의 `gate.to`를 `loadCity()`로
lazy-load한다. S12 당시의 `DETAIL_CITY_IDS` 정적 필터는 없다.

`stampAlbumDistrictPresentation()`도 정적 7도시 집합 대신 로드된 도시의 `districts`를
확인한다. 일본 4도시 payload에는 `district-v1`과 각 4개의 `open` 항목이 있으며,
`resolveCityDistricts()`와 `cityDistrictOpenAt()`을 통과한 16개 라벨이 카드 렌더에 전달된다.
수집률 분모는 이 4개 라벨의 길이이고, 별도 presentation 필터는 없다.

### A2 — 일본 4도시 칭호 폴백 유지

일본 4도시는 현재 정본 `mainRoute.discoveries`와 만남 분모가 없으므로 S6·S13 결과가
`null`이다. 상세 payload가 준비된 뒤 S7은 `district=잔여 0`, `discovery=null`,
`npcMeeting=null`, `stampTitle=잔여 9`에서 `stamp-title`을 선택한다. 네 도시 모두 문구와
`kind`가 동일하다.

## 결정성·검증

- product `loadCity()` 경로의 11도시 one-shot JSON을 독립 Node 프로세스 2회 실행:
  각 1,716 bytes, byte-identical, 11/11 PASS
- SHA-256 A/B:
  `632e3f306640197111dbd977240e48c40d84872998c6f8e0e3b1b835c47db425`
- one-shot 감사 프로세스 max RSS: 424,816 KiB
- targeted: 1 file / 4 tests PASS, 1.89초, max RSS 686,560 KiB, exit 0
- `set -o pipefail; npx vitest run --no-file-parallelism`:
  224 files / 2,215 tests PASS, 234.16초, max RSS 3,567,296 KiB, exit 0
- `git diff --check` PASS; 변경 파일은 이 감사 문서 1개뿐이며 제품 코드·테스트는 무수정

## report-only 경계

S14 제품 코드와 11도시 회귀가 이미 정합하므로 이번 PR은 이 감사 문서만 현행화한다.
제품 코드·테스트·도시 데이터·DB 스키마는 수정하지 않는다.
