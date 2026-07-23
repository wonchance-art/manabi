# 광장 에어허브 상태머신 정적 감사

## 결론

광장 인천공항 노드의 에어허브 목적지 선택 메서드 자체에는 E4·E6형 공용 락 교착이 없다.
`airHubPrompt`가 `scene.inputLocked`를 켠 상태에서도 `flyToOverworldRegion()`은 공용 락을
거부 조건으로 재사용하지 않고 `airTravelPending` 전용 가드로 재진입만 막는다.

E7의 `devGuest` 저장 스킵도 이 내부 목적지 핸들러에는 적용되어 있다. 게스트는
`/api/world/position`을 호출하지 않고 성공으로 진행한다. 다만 E7 테스트는 소스 문자열 배선만
검사해 실제 게스트 하니스의 공개 UI 경로를 놓쳤다.

- **높음 — 화면의 인천공항 `들어가기` 버튼은 에어허브를 열지 않고 공항 스토리로 직행한다.**
  같은 노드에서 셸 `Ⓐ`는 에어허브를 열기 때문에 포인터와 GBC 입력의 기능이 갈린다.
- **높음 — 로그인 사용자의 저장 대기 중 인천공항 게이트 버튼이 다시 노출되어 두 씬 전환이
  경쟁할 수 있다.** 공용 락은 Phaser·GBC 입력만 막고 React 버튼은 막지 않는다.
- **중간 — 저장 Promise가 끝나지 않으면 GBC 조작에는 timeout·취소·재시도가 없어
  `saving`에 무기한 머무는 소프트락 후보가 된다.**
- **낮음 — 실패 문구는 “다시 시도”를 요구하지만 오류 UI에는 `닫기`만 있다.** 실패가
  resolve/reject로 끝난 경우 이동 락은 풀리므로 절대 소프트락은 아니며, 프롬프트를 다시 여는
  간접 재시도는 가능하다.

이 문서는 report-only 결과다. runtime, 테스트, API, DB는 수정하지 않는다.

## 범위와 정본

- 발주: 이슈 #150 코멘트 `5053883288`의 E9 선적재 SPEC과 Codex-1 사용자 지시.
- 정본: `origin/main` `49e6699764febdcd1132c4644389f65e91ed6705`.
- 환경: 공식 nvm Node `v22.23.1`.
- 전수 대상:
  - `src/components/world/GameCanvas.jsx`
  - `src/components/world/guestPositionPersistence.js`
  - `src/components/world/__tests__/guestPositionPersistence.test.js`
  - `src/views/WorldPage.jsx`
  - `src/lib/world/overworldAirHub.js`
  - `src/lib/world/overworldRegions.js`
- 비범위: 결함 수정, 새 테스트 추가, 게스트 하니스 확장, API·DB 변경, 라이브 브라우저 실측.

## 상태 경로 전수 표

| 경로 | 공용 락 | 전용 가드·저장 게이트 | 판정 |
|---|---|---|---|
| 셸 `Ⓐ`로 인천공항 상호작용 | 목적지 목록이 있으면 `airHubPrompt`를 열고, React 효과가 `scene.inputLocked=true`로 만든다 (`GameCanvas.jsx:734-742, 839-845`). | 없음 — 선택 전 상태다. | 정상. |
| 에어허브 목적지 선택 | 프롬프트가 켠 공용 락이 아직 `true`인 같은 클릭에서 호출된다 (`GameCanvas.jsx:2795-2800`). | `flyToOverworldRegion()`은 `inputLocked`를 검사하지 않고 `airTravelPending`만 검사한 뒤 즉시 세운다 (`GameCanvas.jsx:1913-1918`). | **E4·E6형 교착 없음.** 중복 선택도 동기 가드로 차단된다. |
| 목적지 저장·전환 | `saving`도 공용 락 조건이며 셸 `Ⓐ`는 즉시 소비된다 (`GameCanvas.jsx:700, 840-845`). | 목적지 유효성·사용자/게스트 자격을 확인하고 저장 성공 뒤에만 씬을 시작한다 (`GameCanvas.jsx:1915-1928`). | 내부 핸들러는 정상. |
| 에어허브 안의 하네다 스토리 선택 | 프롬프트 공용 락 상태에서 호출된다 (`GameCanvas.jsx:2806-2811`). | `enterAirport()`은 공용 락을 거부하지 않고 prompt/status를 초기화한 뒤 전환한다 (`GameCanvas.jsx:1894-1897`). | 정상. |
| 인천공항 근접 카드의 포인터 `들어가기` | `airHubPrompt`를 만들지 않으므로 에어허브 락·목적지 선택 상태를 전혀 타지 않는다. | 조건 없이 `enterAirport()`를 직접 호출한다 (`GameCanvas.jsx:2647-2655`). | **AH-1 결함.** 셸 `Ⓐ`와 비대칭이다. |
| 저장 대기 중 포인터 UI | `airHubStatus.phase==='saving'`은 Phaser 입력만 잠근다. 근접 카드·미니맵·수첩의 렌더 조건에는 `airHubStatus`가 없다 (`GameCanvas.jsx:2563-2586, 2605-2663`). | `airTravelPending`은 `flyToOverworldRegion()`에만 있고 `enterAirport()`에는 없다. | **AH-2 결함.** 포인터로 경쟁 전환을 시작할 수 있다. |

## `devGuest` 저장 스킵 판정

| 확인점 | 파일:라인 증거 | 판정 |
|---|---|---|
| 하니스 판정·prop 전달 | 비프로덕션 + `NEXT_PUBLIC_WORLD_DEV_GUEST=1`을 `devGuest`로 만들고 `GameCanvas`에 전달한다 (`WorldPage.jsx:432-448, 1011-1019`). | 적용 |
| 공통 persister | `devGuest`면 request·좌표·사용자 검사 전에 `true`를 반환한다 (`guestPositionPersistence.js:5-15`). | API 무호출 성공 |
| 에어허브 자격 | 목적지가 있고 `devGuest || userId`이면 통과한다 (`GameCanvas.jsx:1913-1917`). | 게스트 허용 |
| 에어허브 저장 | 목적지 spawn을 `persistSessionPosition()`에 넘기고 참일 때 전환한다 (`GameCanvas.jsx:1922-1928`). | 스킵 적용 |
| E7 회귀 테스트 | helper의 무호출 성공은 행동으로 검사하지만, GameCanvas 쪽은 메서드 소스에 문자열 두 개가 있는지만 검사한다 (`guestPositionPersistence.test.js:7-18, 57-68`). | 공개 UI·상태 전이 미검사 |
| `?spawn=air:*` 하니스 | `air:*`는 곧바로 지역 도착 spawn으로 변환된다 (`WorldPage.jsx:437-448`). | 목적지 지역 검수에는 유효하지만 **광장→에어허브 경로는 우회** |

따라서 “E7 스킵이 에어허브 내부 핸들러에 적용됐는가”의 답은 **예**다. “게스트 하니스에서
보이는 공항 버튼으로 그 핸들러를 검증할 수 있는가”의 답은 **아니오**다. 포인터 경로는 AH-1로
스토리에 직행하고, `?spawn=air:*`도 목적지 지역으로 직행한다.

## 발견 결함과 재현

### AH-1 — 인천공항 포인터 진입이 에어허브를 우회함 (높음)

근거:

- 셸 `Ⓐ` 경로는 현재 공개 목적지가 하나 이상이면 `setAirHubPrompt({ node, destinations })`를
  실행한다 (`GameCanvas.jsx:734-742`).
- 현재 APAC·EMEA는 모두 `releaseEligible:true`라 일반 게스트 목록에도 들어간다
  (`overworldRegions.js:63-66, 139-143`,
  `overworldAirHub.js:17-44`).
- 같은 근접 카드의 `들어가기` 클릭은 목적지 목록을 보지 않고 `enterAirport()`를 호출한다
  (`GameCanvas.jsx:2647-2655`).

정적 근거를 확인하는 게스트 하니스 재현:

1. 공식 Node 22에서 `NEXT_PUBLIC_WORLD_DEV_GUEST=1 npm run dev`로
   `/world?spawn=air:emea`를 연다. 기본 게스트는 APAC에서 시작하고 `plaza` URL spawn은 파서가
   거부하므로 EMEA 귀환 경로를 사용한다 (`WorldPage.jsx:437-448`).
2. EMEA CDG 항공 게이트에서 `Ⓐ`와 이동 확인을 눌러 광장 인천공항으로 귀환한다. dev guest
   persister는 API를 호출하지 않고 이 전환을 허용한다.
3. 광장 인천공항 정본 타일 `[57,211]`에 도착한 뒤 화면 근접 카드의 `들어가기`를 클릭한다
   (`mapData.js:45-48`).
4. 기대: `아시아·태평양`·`유럽·지중해·중동` 항공편을 포함한 여행 터미널이 열린다.
5. 실제 코드 경로: `enterAirport()`가 호출되어 하네다 입국심사 스토리로 즉시 전환한다.
6. 같은 위치로 돌아와 GBC 셸 `Ⓐ`를 누르면 여행 터미널이 열린다. 이 차이가 입력 경로 비대칭이다.

`?spawn=air:emea`는 그 자체로 에어허브를 검증하지 않고 EMEA 도착점으로 직행하지만, EMEA의
귀환 `air-gate`가 현재 게스트 하니스에서 광장 인천공항에 도달하는 문서화된 사다리 역할을 한다.

수정 제안: 공항 근접 카드의 포인터 콜백도 셸 `Ⓐ`와 같은 단일 함수로 합치고, 공개 목적지가 있으면
항상 `airHubPrompt`를 열어야 한다. 스토리 진입은 에어허브 안의 명시적 선택으로만 남긴다.

### AH-2 — 저장 대기 중 공항 스토리와 항공편 전환이 경쟁함 (높음)

근거:

- 항공편 선택은 prompt를 닫고 `airHubStatus=saving`으로 바꾼다
  (`GameCanvas.jsx:1917-1924`).
- 근접 카드 렌더 조건에는 `airHubPrompt`와 `airHubStatus`가 없어서, prompt가 닫힌 다음 렌더에
  카드와 `들어가기`가 다시 나타난다 (`GameCanvas.jsx:2604-2663`).
- 공용 락은 `scene.inputLocked`와 held 입력만 갱신하며 React 버튼에 `disabled`를 주지 않는다
  (`GameCanvas.jsx:833-846`).
- `enterAirport()`에는 `airTravelPending` 가드가 없고 현재 air 상태를 지운 뒤 스토리 씬을
  시작한다 (`GameCanvas.jsx:1894-1897`). 원래 저장 Promise는 취소되지 않는다.
- 저장이 나중에 성공하면 기존 `flyToOverworldRegion()` continuation이 목적지 지역 씬을 다시
  시작한다 (`GameCanvas.jsx:1924-1928`). 실패하면 airport 진입 때 지운 상태를 `error`로 다시
  세울 수 있다 (`GameCanvas.jsx:1929-1938`).

재현:

1. 로그인 사용자를 인천공항에 놓고 셸 `Ⓐ`로 여행 터미널을 연다.
2. DevTools request blocking 또는 제어 가능한 Promise로 `/api/world/position` 응답을 보류한다.
3. APAC 또는 EMEA 항공편을 선택한다. 상단에는 “도착 위치 저장 중…”이 뜬다.
4. 하단에 다시 나타난 인천공항 카드의 `들어가기`를 클릭한다.
5. 공항 스토리가 시작된 뒤, 보류한 저장을 성공시킨다.
6. 기존 항공편 continuation이 목적지 지역 씬 시작을 다시 요청한다. 실패시킨 경우에는 숨은
   `airHubStatus=error`가 뒤늦게 만들어진다.

dev guest는 persister가 즉시 성공하므로 보통 이 대기창을 만들지 않는다. 결함은 게스트 UI 감사에서
발견되지만 실제 경쟁 조건은 지연된 로그인 저장 경로에서 가장 쉽게 재현된다.

수정 제안: `airHubStatus` 또는 하나의 `airTransitionPending`을 모든 React 진입점의 렌더·disabled
조건과 씬 전환 가드에 함께 적용한다. 전환 시작 뒤 이전 씬의 비동기 continuation이 살아 있지 않도록
scene/shutdown 또는 요청 세대도 확인해야 한다.

### AH-3 — 끝나지 않는 저장의 GBC 소프트락 후보 (중간)

근거:

- persister의 fetch에는 timeout·`AbortSignal`이 없고 resolve/reject만 기다린다
  (`guestPositionPersistence.js:10-24`).
- `flyToOverworldRegion()`은 그 Promise를 제한 없이 await한다 (`GameCanvas.jsx:1922-1925`).
- 그동안 `airHubStatus=saving`이 공용 입력 락을 유지하고 셸 `Ⓐ`는 소비된다
  (`GameCanvas.jsx:700, 839-846`). 셸 `Ⓑ`에는 saving 취소 경로가 없고 error만 닫는다
  (`GameCanvas.jsx:759-780`).
- saving UI에는 취소·재시도 버튼이 없다 (`GameCanvas.jsx:2830-2854`).

재현:

1. 로그인 경로에서 `/api/world/position`이 resolve도 reject도 하지 않게 보류한다.
2. 에어허브에서 목적지를 선택한다.
3. GBC D-pad·`Ⓐ`·`Ⓑ`를 사용한다.
4. D-pad와 `Ⓐ`는 잠겨 있고 `Ⓑ`는 saving 상태를 해제하지 못한다. 요청이 끝날 때까지
   “저장 중…”에 머문다.

AH-2의 포인터 탈출 버튼이 우연히 남아 있지만 이는 두 전환을 경쟁시키는 별도 결함이며, 키보드·GBC
조작 기준 복구 수단으로 볼 수 없다.

수정 제안: 위치 저장에 명시적 timeout/abort 정책을 두고, timeout은 일반 실패와 같은 retryable
error 상태로 전이한다. saving 중 안전한 취소 정책을 둘 경우 늦은 응답 continuation도 무효화해야 한다.

### AH-4 — 실패 문구와 재시도 조작의 불일치 (낮음)

근거:

- false/reject는 “다시 시도해 주세요” 오류를 만들고 공용 락을 푼다
  (`GameCanvas.jsx:1929-1938`).
- 오류 UI의 유일한 버튼은 상태를 지우는 `닫기 Ⓑ`다
  (`GameCanvas.jsx:2839-2849`).
- error는 공용 락 조건이 아니고, 셸 `Ⓐ`도 error를 소비하지 않는다. 인천공항 근접 상태가
  남아 있으면 `Ⓐ`로 새 prompt를 열어 간접 재시도할 수 있다
  (`GameCanvas.jsx:695-708, 839-846`).

재현:

1. 로그인 위치 저장을 HTTP non-ok 또는 네트워크 reject로 실패시킨다.
2. “도착 위치를 저장하지 못했어요. 다시 시도해 주세요.”를 확인한다.
3. 오류 UI에는 `다시 시도`가 없고 `닫기`만 있는 것을 확인한다.
4. `Ⓑ`로 닫거나, 오류를 남긴 채 `Ⓐ`로 목적지 prompt를 다시 연 뒤 목적지를 다시 골라야 한다.

resolve/reject가 끝난 실패에서는 `inputLocked`가 풀리므로 절대 소프트락은 아니다. 다만 메시지가
요구하는 행동과 제공하는 버튼이 다르고, 오류 상태와 새 prompt가 동시에 존재할 수 있다.

수정 제안: error가 보존한 `destination`으로 명시적 `다시 시도` 버튼을 제공하고, retry 시작 시
error→saving을 원자적으로 전이한다. `닫기`는 별도 보조 동작으로 둔다.

## 정상·잔존 상태 점검

| 상태 | 성공 | 실패 | 판정 |
|---|---|---|---|
| `airHubPrompt` | 선택 직후 `null`, 지역 `onEnter`에서도 초기화 (`GameCanvas.jsx:1921, 2344-2351`) | 선택 직후 `null`; error와 함께 자동 복원되지는 않음 | 잔존 없음. 실패 재시도 UX는 AH-4. |
| `airHubStatus` | 저장 성공 직후 `null`, 지역 `onEnter`에서도 초기화 (`GameCanvas.jsx:1926, 2350`) | `error`로 전이하고 사용자가 닫을 수 있음 | resolve/reject 실패는 복구 가능. |
| `airTravelPending` | `finally`에서 해제 (`GameCanvas.jsx:1937-1939`) | `finally`에서 해제 | 중복 항공편 가드 대칭. Promise 무기한 pending은 AH-3. |
| `scene.inputLocked` | 새 지역 씬이 자체 create 상태를 설정 | catch에서 `false`, React 효과도 error를 락으로 보지 않음 (`GameCanvas.jsx:1935, 839-846`) | 일반 실패 락 잔존 없음. |
| dev guest API | helper가 즉시 `true` | 네트워크 실패 경로 자체를 타지 않음 | E7 적용 확인. |

## 테스트 공백과 승인 뒤 권장 순서

현재 air hub 순수 테스트는 목적지 필터·spawn 정합을 검사하고, E7 테스트는 helper 동작과
GameCanvas 소스 문자열 배선을 검사한다. 다음 상태 계약은 없다.

1. `airHubPrompt`가 공용 락을 켠 상태에서도 첫 항공편 요청은 시작되고 이중 요청은 한 번만 저장한다.
2. 셸 `Ⓐ`와 근접 카드 클릭이 같은 여행 터미널 상태를 만든다.
3. saving 중 공항·미니맵·수첩 등 다른 React 진입점이 비활성화되고 늦은 응답이 다른 씬을 덮지 않는다.
4. false/reject/timeout이 동일한 retryable error로 가며 명시적 retry는 저장 1회 뒤 전환한다.
5. `devGuest=true`의 공개 UI 전체 경로가 API 0회로 목적지 지역에 도착한다.

승인 뒤에는 AH-1 입력 경로 단일화 → AH-2 전환 가드·late continuation 무효화 → AH-3 timeout 정책
→ AH-4 명시적 retry 순으로 한 상태머신 계약에서 수정하는 것이 안전하다. `inputLocked`를
`flyToOverworldRegion()` 거부 조건으로 추가하면 정상 prompt 확인 호출까지 막혀 E4·E6 결함을
재도입하므로 사용하면 안 된다.

## 검증 결과

- 관련 회귀: 3파일, 40테스트 통과.
  - `guestPositionPersistence.test.js`
  - `overworldAirHub.test.js`
  - `overworldRegions.test.js`
- 관련 회귀 `--logHeapUsage --reporter=verbose`: peak heap 19 MB.
- 최초 병렬 전체 실행: 212파일 중 210파일 통과, 2파일의 대형 geo 연산 3건만 timeout
  (`mapData.test.js` 1건, `tokyoGeo.test.js` 2건). 실패 파일을 single-worker로 단독 재실행해
  2파일·78테스트 전부 통과했다.
- 최종 `set -o pipefail` single-worker 전체 회귀:
  **212파일·2,142테스트 전부 통과, 251.92초**.
- `git diff --check` 통과. 변경 파일은 이 보고서 1개뿐이다.

macOS `/usr/bin/time -l`은 테스트 성공 뒤에도 샌드박스의 `sysctl kern.clockrate` 거부로 exit 1을
반환하고 `ps`도 허용되지 않았다. 따라서 OS RSS 대신 Vitest가 직접 보고한 관련 회귀 heap을
메모리 실측값으로 기록했다.
