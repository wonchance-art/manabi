# 횡단열차 회랑 상태머신 감사

## 결론

`transsib-corridor`의 종착역 선저장과 정차 중 하차 원칙은 순수 상태머신에서 지켜지지만, React
오버레이의 `inputLocked`와 씬 전용 전환 상태가 분리되지 않은 경로가 남아 있다.

- **높음 — 지역 이탈 버튼이 정상 프롬프트 경로에서 항상 무반응이다.** 프롬프트가 켠
  `inputLocked`를 `leaveToRegion()`이 다시 거부 조건으로 사용한다.
- **높음 — 탑승 선저장 중 두 번째 탑승 요청이 겹칠 수 있다.** `boardTo()`에는 탑승 전용 가드가
  없고, 프롬프트가 닫힌 뒤 React 효과가 저장 중 `inputLocked`를 다시 `false`로 덮는다. 중간역에서는
  서로 반대 종착역 저장이 동시에 시작될 수 있어, 지연된 응답 순서에 따라 화면 속 운행 종착역과
  서버의 로그아웃 폴백 종착역이 달라질 수 있다.
- **중간 — 중간역 하차 저장 실패의 즉시 재시도 창이 짧다.** 정차 2게임분은 현재 약 11.7초이며,
  저장 응답을 기다리는 동안 운행 시계가 계속 간다. 열차가 출발한 뒤 실패하면 안내는 “열차 안에서
  다시 시도”라고 하지만 다음 정차 전에는 `A` 재시도가 불가능하다.

정상 씬 전환을 따라 회랑을 이탈한 뒤 `corridorPrompt`, `corridorStatus`, 공항 스토리 오버레이가
남는 경로는 찾지 못했다. 이 문서는 재현과 수정 제안만 담는 report-only 결과이며 runtime, 테스트,
API, DB를 수정하지 않는다.

## 범위와 환경

- 발주: 이슈 #150 코멘트 `5049590405`의 E6 report-only SPEC.
- 정본: `origin/main` `8cce1bd1387e0b05ab29215a547d7730e2b9327c`.
- 환경: Node `v22.23.1` 공식 nvm 배포판, Next.js dev guest 하니스, 기존 Vitest.
- 전수 대상:
  - `src/components/world/transsibCorridorScene.js`
  - `src/lib/world/transsibCorridor.js`
  - `src/components/world/GameCanvas.jsx`
  - `src/views/WorldPage.jsx`
  - `src/lib/world/session.js`
  - `src/app/api/world/position/route.js`
  - 진입 측 `src/components/world/overworldRegionScene.js`
- 비범위: 결함 수정, 새 테스트 추가, 출시 플래그 변경, 시간표 조정, DB 변경.

## 게스트 하니스 지원 확인

요청된 `?spawn=transsib-corridor@x,y`는 **#391 게스트 하니스에서 지원되지 않는다.** 두 개의 독립
게이트가 있다.

1. `parseDevGuestSpawn()`은 `air:*`를 제외하면 씬 문자열에 `:`가 있어야 한다
   (`WorldPage.jsx:438-447`). `transsib-corridor`에는 `:`가 없으므로 파서가 `null`을 반환한다.
2. 설령 파서가 값을 만들더라도 게스트의 `canAccessPreviewRegions`는 `false`이고, 미출시
   `transsib-corridor`의 초기 리다이렉트는 관리자 프리뷰만 허용한다
   (`session.js:81-85`).

실측으로 `NEXT_PUBLIC_WORLD_DEV_GUEST=1`에서
`/world?spawn=transsib-corridor@8,8&worldDebug=1`을 열었을 때 URL은 유지됐지만 HUD는
`🌍 아시아·태평양`으로 시작했고 회랑 라벨은 나타나지 않았다. 따라서 아래 상태 전이는 기존 순수
테스트와 Vite SSR-load one-shot 씬 하니스로 재현했다. 회랑 자체의 로컬 디버그 진입은 문서에 적힌
`__MANABI_WORLD_DEBUG__.enterTranssib(stopId)`를 쓰지만, 이는 게스트 spawn URL 지원과 별개다.

## 잠금과 전용 가드 전수 표

| 동작 | 공용 `inputLocked` | 전용 가드 | 결과 |
|---|---|---|---|
| 플랫폼 방향 입력·이동 | 입력과 `update()`가 모두 검사 | `trip`, `moving` | 평시 정상. 단 탑승 선저장 중 React가 공용 락을 풀면 다시 움직일 수 있다. |
| 탑승 프롬프트 열기 | `corridorInteract()`는 직접 검사하지 않음 | `trip`, `nearStopId` | 셸이 열린 프롬프트를 먼저 소비하므로 평시 중복은 막지만, 저장 상태는 소비하지 않는다. |
| 종착역 탑승 | 의도적으로 검사하지 않음 | `trip`뿐, `boarding` 없음 | 프롬프트의 공용 락 중에도 첫 호출은 시작되지만 선저장 중 재진입 가능. **결함 CSM-2**. |
| 지역으로 나가기 | 진입 시 검사 | 전용 가드 없음 | 프롬프트가 이미 공용 락을 켜므로 정상 버튼 호출이 즉시 반환. **결함 CSM-1**. |
| 중간역·종착역 하차 | 검사하지 않음 | `disembarking`, `trip`, `canDisembark` | 중복 하차는 차단. 탑승 후 남아 있는 공용 락과 독립이라 시작 자체는 정상. |
| 운행 중 이동 | 방향 입력이 `trip`을 검사 | `trip` | React가 공용 락을 덮어도 플랫폼 보행은 열리지 않음. |

진입 측 지역 씬은 이미 `inputLocked`와 `transitionLocked()`를 분리하고
`enteringCorridor`, `railBoarding`, `leavingByAir` 같은 전용 가드를 사용한다
(`overworldRegionScene.js:554-580`). 회랑 씬만 같은 패턴을 아직 적용하지 않았다.

## 발견 결함과 재현

### CSM-1 — 지역 이탈 확인 버튼의 확정적 무반응 (높음)

근거:

- 회랑 프롬프트가 열리면 공통 React 효과가 `scene.inputLocked=true`로 만든다
  (`GameCanvas.jsx:765-775`).
- “지역으로 나가기” 버튼은 프롬프트를 닫고 같은 이벤트에서 곧바로 `leaveToRegion()`을 호출한다
  (`GameCanvas.jsx:2846-2853`). React 효과가 다시 돌기 전이므로 씬의 락은 아직 `true`다.
- `leaveToRegion()` 첫 줄은 `inputLocked`가 참이면 반환한다
  (`transsibCorridorScene.js:200-201`). 저장 상태도 오류 상태도 만들지 않아 사용자는 이유를 받지 못한다.

재현:

1. 관리자 프리뷰로 블라디보스토크 또는 모스크바 플랫폼에 진입한다.
2. `A`로 출발 프롬프트를 연다.
3. “아시아·태평양으로 나가기” 또는 “유럽·지중해·중동으로 나가기”를 누른다.
4. 프롬프트만 닫히고 씬·좌표·상태 메시지는 바뀌지 않는다. 다시 `A`를 누르면 같은 프롬프트가 열린다.

one-shot 씬 하니스도 프롬프트 락 상태를 직접 넣었을 때 저장 호출 0회를 재현했다.

```text
{"persistCalls":0,"inputLocked":true,"nearStopId":"vladivostok"}
```

수정 제안: `leaveToRegion()`은 공용 오버레이 락을 거부 조건으로 쓰지 말고 `leavingRegion` 전용
가드로 재진입만 막아야 한다. 시작 직후 전용 가드와 공용 락을 함께 세우고 성공·실패·shutdown에서
대칭 해제하는 방식이 진입 측 지역 씬과 일치한다.

### CSM-2 — 탑승 선저장 중 중복 요청과 폴백 불일치 가능성 (높음)

근거:

- `boardTo()`는 `trip`이 아직 `null`인 선저장 구간에서 별도 `boarding` 가드가 없다
  (`transsibCorridorScene.js:220-232`).
- 목적지 버튼은 먼저 프롬프트를 닫는다. 다음 React 효과는 `corridorStatus.phase=saving`을 잠금 조건에
  포함하지 않아 `scene.inputLocked=false`로 덮는다 (`GameCanvas.jsx:768-775`).
- `corridorInteract()`도 저장 상태를 보지 않으므로 `nearStopId`가 남은 동안 프롬프트를 다시 연다
  (`transsibCorridorScene.js:185-197`).
- 중간역에는 동·서 양 종착역이 모두 선택지다. 두 POST가 겹치면 마지막 DB commit과 마지막으로
  도착한 브라우저 응답의 순서가 같다는 보장이 없어, 서버 폴백 좌표와 `this.trip`이 갈릴 수 있다.

재현 하니스는 첫 종착 저장을 시작한 뒤 React의 프롬프트 닫힘 효과를 모사해 락을 풀고, 프롬프트를
다시 열어 반대 종착 저장을 시작했다.

```text
{"persistCalls":[
  {"scene":"transsib-corridor","x":200,"y":8},
  {"scene":"transsib-corridor","x":8,"y":8}
],"promptReopened":1,"inputLocked":false,"trip":null}
```

수정 제안: `boarding` 또는 단일 `transitionPending` 전용 가드를 `boardTo()`, `corridorInteract()`,
플랫폼 이동에 공통 적용한다. React 잠금 계산에도 씬 전용 전환 상태를 읽거나, 더 단순하게 회랑 씬의
`controlsLocked()`가 공용 락과 전용 가드를 합성하게 한다. `inputLocked` 검사만 `boardTo()`에 추가하면
정상 프롬프트 확인 호출까지 막으므로 올바른 수정이 아니다.

### CSM-3 — 중간역 하차 저장 실패 후 안내와 재시도 가능 상태 불일치 (중간)

근거:

- 하차는 정차 상태를 캡처한 뒤 저장을 기다리지만 운행 시계와 `syncTrip()`은 멈추지 않는다
  (`transsibCorridorScene.js:248-299, 313-317`).
- 정차 시간은 2게임분이고 `WORLD_TIME_SCALE=10.25`이므로 현실 약 11.7초다.
- 저장이 실패하면 “열차 안에서 다시 시도”를 표시하지만, 그 사이 `currentTripState`가 `riding`으로
  넘어가면 `corridorInteract()`의 하차 조건이 거짓이어서 다음 역까지 재시도할 수 없다.
- 종착 플랫폼은 탑승 전에 저장돼 있으므로 로그아웃 폴백과 최종 복구는 남는다. 영구 데이터 손실이나
  절대 소프트락은 아니지만, 느린 네트워크에서 안내와 실제 조작 가능 상태가 어긋난다.

결정적 시간축 재현:

```text
18.5분: {"phase":"stopped","stopId":"khabarovsk","canDisembark":true}
20.0분: {"phase":"riding","fromId":"khabarovsk","toId":"chita","canDisembark":false}
현실 정차 시간: 11.707317073170731초
```

수정 제안: 하차 요청 시 운행 전이를 보류하거나, 저장 실패 상태에 캡처한 정차역으로 다시 저장하는
명시적 재시도 버튼을 두고 성공 시 그 역에 배치한다. 어느 쪽이든 `saving-stop`이 운행 상태 갱신으로
덮이지 않게 UI 상태 우선순위를 정해야 한다.

## 좌표 저장 게이트와 실패 UX

| 지점 | 저장 좌표 | 성공 게이트 | 실패 UX / 위험 |
|---|---|---|---|
| 지역 → 회랑 | 해당 회랑 정차역의 exact 플랫폼 | 관리자 프리뷰 + `enteringCorridor` + POST 성공 | 오류 상태와 재시도 가능. 정상. |
| 탑승 전 | 선택 종착역 exact 플랫폼 | POST가 정확히 `true`여야 `trip` 생성 | 오류 문구와 재시도는 있으나 전용 가드 부재로 CSM-2 발생. |
| 중간역 하차 | 현재 정차역 exact 플랫폼 | POST 성공 뒤 플랫폼 배치 | 실패 시 열차는 계속 진행. CSM-3. |
| 종착역 하차 | 탑승 전에 저장한 종착 플랫폼 | 추가 POST 없이 `alreadyPersisted` 사용 | 저장 실패 경로 없음. 선저장 계약 유지. |
| 회랑 → 지역 | 대응 지역 게이트 exact 좌표 | POST 성공 뒤 씬 전환 | 정상 UI에서는 POST까지 도달하지 못함. CSM-1. |
| 주기·pagehide 저장 | off-trip exact 플랫폼만 씬에서 `persistable=true` | 현재 미출시 플래그에서는 `WorldPage`가 주기 저장을 거부 | 명시적 진입·탑승·하차 저장이 실제 안전망. 출시 플래그 전환 뒤 주기 저장이 자동 활성화됨. |

서버는 일반 사용자에게 미출시 좌표를 거부하고, 관리자만 `allowPreview:true`로 exact 9개 플랫폼을
허용한다 (`route.js:18-27`, `session.js:50-63`). 회랑 운행 상태 자체는 DB에 쓰지 않고 탑승 전
종착 플랫폼만 폴백으로 남기는 기존 계약은 유지된다.

## 이탈 후 스토리·오버레이 잔존 점검

| 상태 | 회랑 진입 시 | 정상 회랑 이탈 시 | 판정 |
|---|---|---|---|
| `corridorPrompt` | `onEnter`에서 `null` | 이탈 버튼이 호출 전에 닫고, 지역 `onEnter`도 다시 `null` | 잔존 경로 없음. 단 CSM-1 때문에 현재 이탈 자체가 시작되지 않음. |
| `corridorStatus` | `onEnter`에서 `null` | 회랑 shutdown의 `setStatus(null)` + 지역 `onEnter` 초기화; 렌더도 active scene으로 게이트 | 잔존 경로 없음. |
| `corridorNear` | `refreshNearStop()`이 재계산 | shutdown과 지역 `onEnter`에서 `null` | 잔존 경로 없음. |
| 공항 `storyActive`·대사·퀴즈 | 공항 shutdown에서 reset | 렌더가 `activeScene=airport`로 추가 게이트 | 회랑 이탈 뒤 노출 경로 없음. |
| `trip`·`currentTripState` | 새 씬 인스턴스에서 `null` | Phaser 씬 shutdown으로 인스턴스 운행을 끝냄 | UI 잔존 없음. 재접속은 서버의 선저장 종착 플랫폼 사용. |

비정상 강제 씬 전환을 제외한 제품 경로에서는 새 지역 씬 `onEnter`가 회랑 prompt/status/near를 함께
초기화한다 (`GameCanvas.jsx:2286-2294`). 따라서 이 라운드에서는 오버레이 잔존 수정안을 발주하지
않는다.

## 검증 결과

- 관련 회귀: 4파일, 58테스트 통과, 209ms.
  - `transsibCorridor.test.js`
  - `worldSession.test.js`
  - `overworldRegionPromptLocks.test.js`
  - `position/route.test.js`
- 전체 회귀: 207파일, 2,107테스트 통과, 88.18초.
- `/usr/bin/time -l` 실측:
  - 관련 회귀 max RSS 146,882,560 bytes, peak footprint 24,349,552 bytes, swap 0.
  - 전체 회귀 max RSS 3,576,774,656 bytes, peak footprint 25,152,440 bytes, swap 0.
- 게스트 브라우저: Node 22 dev 서버에서 요청 URL 유지와 APAC HUD 폴백을 확인했다.
- 보고서 외 제품·테스트·API·DB 변경 없음.

## 승인 뒤 권장 수정 순서

1. CSM-1과 CSM-2를 한 상태 전환 계약으로 묶어 `boarding`·`leavingRegion` 전용 가드를 도입한다.
2. 프롬프트가 공용 락을 켠 상태에서도 확인 콜백은 전용 가드로 시작된다는 회귀 테스트를 추가한다.
3. 지연된 두 탑승 저장을 제어 가능한 Promise로 겹쳐 POST 1회와 trip/폴백 일치를 검증한다.
4. CSM-3의 정책(운행 보류 또는 명시적 재시도)을 확정한 뒤 11.7초 경계 양쪽을 가짜 시계로 검증한다.
5. #391 하니스에 회랑을 추가하려면 파서 허용과 관리자 프리뷰 권한을 별도 SPEC으로 함께 설계한다.
