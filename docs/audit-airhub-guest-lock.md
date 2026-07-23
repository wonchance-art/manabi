# 광장 에어허브 게스트 하니스·잠금 감사

## 결론

광장 인천공항 노드의 에어허브는 E4·E6에서 발견된 “프롬프트가 켠 공용 락 때문에 확인 버튼이
무반응” 또는 “선저장 중 중복 요청” 유형을 재현하지 않았다. 목적지 확인 함수는 공용
`inputLocked`를 거부 조건으로 다시 쓰지 않고, 동기적으로 세우는 전용 `airTravelPending`이
저장 완료 전 두 번째 항공편 요청을 막는다. dev guest도 공용 guest-aware 저장기를 통해 제품
API를 호출하지 않고 성공 처리되므로 항공편 전환 자체는 정상이다.

다만 검수 하니스에는 다음 공백이 있다.

- **중간 — 광장 에어허브로 직접 들어가는 문서화된 guest spawn이 없다.** 게스트 기본 진입은
  아시아·태평양 지역이고 `?spawn=plaza@57,211`은 파서가 거부한다. 현재 재현 가능한 경로는
  `?spawn=air:emea`로 파리 CDG에 들어가 귀환 항공 게이트를 한 번 더 통과하는 우회뿐이다.
- **낮음 — `air:*`의 왕복 가능성이 지역마다 비대칭이다.** EMEA의 항공 스폰은 상호작용 가능한
  `airGate`지만 APAC의 항공 스폰은 도착 전용 `airArrival`이며 귀환 게이트가 없다.
  `?spawn=air:asia-pacific`로는 광장 에어허브 검수를 이어갈 수 없다.
- **낮음 — 저장 실패 문구와 즉시 행동이 일치하지 않는다.** “다시 시도해 주세요”라고 표시하지만
  오류 토스트에는 `닫기`만 있다. 오류를 닫거나 그대로 둔 채 공항 노드에서 `A`로 프롬프트를 다시
  열면 재시도할 수 있으므로 소프트락은 아니지만, 오류 토스트와 새 프롬프트가 함께 남을 수 있다.

정상 성공·실패·취소·공항 스토리 진입·지역 전환 뒤 에어허브 프롬프트나 저장 상태가 입력을 계속
잠그는 잔존 경로는 찾지 못했다. 이 문서는 report-only 결과이며 runtime, 테스트, API, DB를
수정하지 않는다.

## 범위와 환경

- 발주: 이슈 #150 코멘트 `5053883288`의 E9 report-only SPEC.
- 정본: `origin/main` `49e6699764febdcd1132c4644389f65e91ed6705`.
- 환경: Node `v22.23.1` 공식 nvm 배포판, 기존 Vitest와 결정적 one-shot 모듈 확인.
- 전수 대상:
  - `src/views/WorldPage.jsx`
  - `src/components/world/GameCanvas.jsx`
  - `src/components/world/guestPositionPersistence.js`
  - `src/components/world/overworldRegionScene.js`
  - `src/lib/world/overworldAirHub.js`
  - `src/lib/world/overworldRegions.js`
  - `src/lib/world/session.js`
- 비범위: 결함 수정, 하니스 확장, 새 테스트 추가, 출시 플래그·지역 데이터·DB 변경.

## 게스트 하니스 진입 전수

| 진입 | 실제 시작점 | 광장 에어허브까지 | 판정 |
|---|---|---|---|
| spawn 없음 | 신규 사용자 기본 APAC 스폰 | APAC에는 광장 귀환 `airGate`가 없어 직접 불가 | 기본값만으로 E9 검수 불가 |
| `?spawn=plaza@57,211` | 파서가 `plaza`의 `:` 부재로 `null` 반환 → 기본 APAC | 불가 | 문서화 가능한 직행 형식 없음 |
| `?spawn=air:emea` | EMEA CDG `(214,420)` | `A` → 귀환 확인 → guest 저장 스킵 → 광장 인천공항 `(57,211)` → `A` | **현재 유일한 문서화된 재현 경로** |
| `?spawn=air:asia-pacific` | APAC 인천 항공 도착 `(1460,582)` | 도착점은 `airArrival`, 상호작용 가능한 `airGate` 없음 | 지역 도착 검수만 가능, 광장 왕복 불가 |
| `?worldDebug=1` | 현재 선택된 씬 | `teleport`, `enterTranssib`, `enterRegion`만 제공 | `enterPlaza`·`openAirHub`가 없어 기본 APAC에서 대체 불가 |

`parseDevGuestSpawn()`은 `air:*`만 별도 처리하고, 그 밖의 씬은 문자열에 `:`가 있어야 허용한다
(`WorldPage.jsx:437-449`). spawn이 없거나 파서 결과가 `null`이면 신규 사용자 기본 지역 진입이
작동한다 (`GameCanvas.jsx:1437-1479`, `session.js:96-103`). 따라서 광장 exact 좌표를 URL로
직접 주입할 수 없다.

반면 `air:emea`는 `overworldRegionAirSpawn()`이 EMEA의 `airGate`인 CDG를 고른다. 해당 게이트의
`leaveByAir()`는 인천공항 광장 좌표를 선저장하고 `world` 씬을 `{spawn}`으로 시작한다
(`overworldRegionScene.js:692-711`). E7에서 일반화된 guest-aware 저장기는 dev guest일 때
`fetch`를 호출하지 않고 즉시 `true`를 반환한다 (`guestPositionPersistence.js:5-24`).

one-shot 확인 결과:

```text
{"emeaAirSpawn":{"scene":"overworld:emea","x":214,"y":420},
 "emeaReturnGate":"air-gate",
 "apacAirSpawn":{"scene":"overworld:asia-pacific","x":1460,"y":582},
 "apacReturnGate":null,
 "guestSaved":true,
 "requestCalls":0}
```

## 잠금과 전용 가드 전수 표

| 동작 | 공용 `inputLocked` | 전용 가드 | 결과 |
|---|---|---|---|
| 공항 노드에서 프롬프트 열기 | 프롬프트 렌더 뒤 `true` | 없음 | 정상. 방향키·탭 이동을 비우고 배경 이동 차단 |
| 항공편 첫 선택 | 이미 `true`지만 확인 함수는 이를 거부 조건으로 쓰지 않음 | `airTravelPending=false` 필요 | 정상. E6의 확인 버튼 무반응 유형 없음 |
| 목적지 선저장 | 함수가 즉시 `true`, React도 `phase=saving`을 락 조건으로 유지 | `airTravelPending=true` | 정상. 프롬프트가 닫혀도 저장 중 이동 누출 없음 |
| 항공편 연타·다른 목적지 중복 선택 | 공용 락과 무관 | 첫 호출이 await 전에 `airTravelPending=true` | 두 번째 호출은 저장·전환 없이 `false` |
| 저장 성공 | 상태를 지우고 목적지 씬 시작 | 씬 전환 뒤 `finally` 해제 | 지역 `onEnter`가 prompt/status를 다시 초기화 |
| 저장 실패 | 오류 상태에서 공용 락 해제 | `finally`에서 pending 해제 | 이동·닫기·재시도 가능, 영구 잠금 없음 |
| 취소 / 하네다 스토리 | 프롬프트 제거로 해제 | 스토리 진입은 상태를 함께 초기화 | 정상 |

공용 오버레이 효과는 프롬프트 또는 `phase=saving`일 때 씬 입력을 잠근다
(`GameCanvas.jsx:833-846`). `flyToOverworldRegion()`은 시작 즉시 전용 가드·공용 락·입력 큐
초기화를 한 뒤 저장한다 (`GameCanvas.jsx:1913-1939`). 이 순서 때문에 프롬프트 제거에 따른 다음
React 렌더가 오더라도 `phase=saving`이 락을 계속 유지하며, 저장 함수의 await 전에 전용 가드가
이미 참이라 중복 요청도 들어오지 않는다.

## 발견 사항

### AGH-1 — 광장 exact guest spawn 부재와 지역별 왕복 비대칭 (중간)

E9의 에어허브 검수 대상은 광장 인천공항 노드지만, 하니스의 일반 형식으로는 그 좌표를 만들 수 없다.
`plaza`는 콜론이 없는 씬이므로 `?spawn=plaza@57,211`이 거부되고, spawn이 없으면 신규 사용자 기본
APAC 지역으로 간다. 로컬 디버그 브리지에도 광장 복귀 명령이 없다.

현재는 `air:emea`가 우연히 검수 사다리 역할을 한다. EMEA 항공 스폰이 귀환 가능한 `airGate`와
같기 때문에 guest-aware 저장 스킵을 거쳐 인천공항 광장으로 돌아온다. APAC은 별도의 도착 전용
`airArrival`만 있어 같은 `air:*` 형식이 왕복을 제공하지 않는다
(`overworldRegions.js:128-136,227-235,277-281`).

이는 로그인 제품 경로의 항공편 결함은 아니다. 그러나 검수자가 `air:asia-pacific` 또는 기본 guest
진입을 선택하면 에어허브에 도달하지 못하고, EMEA 왕복이라는 숨은 선행 절차를 알아야 하므로 하니스
재현성이 낮다.

수정 제안: 별도 SPEC에서 `plaza` exact spawn을 화이트리스트로 명시하거나
`?spawn=airhub:incheon`처럼 제품 씬 ID와 충돌하지 않는 검수 별칭을 추가한다. 좌표를 임의
문자열로 전부 허용하기보다 등록된 검수 앵커만 반환해야 한다. 디버그 브리지 확장으로 해결한다면
`enterPlaza()`와 airport node exact 앵커를 함께 제공하고, 이 명령이 항공편의 권한·선저장 계약을
대신하지 않는다는 기존 문서 원칙을 유지한다.

### AGH-2 — 저장 실패 토스트의 재시도 행동 불명확 (낮음)

저장 실패는 목적지와 “다시 시도해 주세요” 문구를 담은 `airHubStatus.phase=error`를 표시하지만,
버튼은 `닫기`뿐이다 (`GameCanvas.jsx:2830-2850`). 오류 상태는 입력 잠금 조건이 아니며
`interact()`도 오류를 먼저 소비하지 않으므로, 사용자는 다음 두 방식으로 복구할 수 있다.

1. `B`/닫기로 오류를 지우고 인천공항에서 `A` → 목적지 재선택.
2. 오류를 둔 채 인천공항에서 `A` → 새 프롬프트를 열고 목적지 재선택.

두 번째 방식에서는 오류 토스트와 프롬프트가 동시에 렌더될 수 있다. 목적지 재선택 순간 상태가
`saving`으로 교체되고 전용 가드가 다시 세워져 중복 저장이나 소프트락으로 이어지지는 않는다.

수정 제안: 후속 UX 라운드에서 오류 토스트에 `다시 시도` 버튼을 제공해 보관한
`destination.id`로 같은 함수를 호출하거나, 문구를 “닫고 항공편을 다시 선택해 주세요”로 바꾼다.
전자를 택하면 버튼 연타도 기존 `airTravelPending`을 반드시 공유해야 한다.

## 오버레이·상태 잔존 점검

| 종료 경로 | prompt | status | 입력 락 | 판정 |
|---|---|---|---|---|
| 취소 | 즉시 `null` | 원래 없음 | 다음 효과에서 해제 | 정상 |
| 저장 성공 → 지역 | 선택 시 `null` | 전환 전 `null`, 지역 `onEnter`에서 재초기화 | 새 씬 제어로 교체 | 정상 |
| 저장 실패 | `null` | `error` 유지 | 명시적으로 해제 | 복구 가능 |
| 오류 뒤 재시도 성공 | 새 선택 시 `null` | `saving` → `null` | 저장 중 유지, 전환 뒤 종료 | 정상 |
| 하네다 스토리 진입 | `enterAirport()`가 둘 다 `null` | `null` | 공항 씬 제어로 교체 | 정상 |
| 공항 스토리 종료 → 광장 | `resetAirportStoryState()`가 둘 다 `null` | `null` | 광장 씬에서 재계산 | 정상 |

에어허브 상태 렌더 자체도 `activeScene === 'plaza'`로 게이트되고, 지역 `onEnter`와 공항 진입은
prompt/status를 함께 지운다 (`GameCanvas.jsx:1894-1897,2344-2374`). 정상 제품 전환 뒤 숨은
토스트가 되살아나거나 이전 프롬프트가 입력을 계속 잠그는 경로는 없다.

## 검증 결과

- 관련 회귀: 4파일, 56테스트 통과, 182ms.
  - `guestPositionPersistence.test.js`
  - `overworldAirHub.test.js`
  - `overworldRegionPromptLocks.test.js`
  - `worldSession.test.js`
- 전체 회귀: 212파일, 2,142테스트 통과, 149.82초.
- `/usr/bin/time -l` 실측:
  - 관련 회귀 max RSS 149,225,472 bytes, peak footprint 109,113,968 bytes, swap 0.
  - 전체 회귀 max RSS 2,345,385,984 bytes, peak footprint 3,100,695,176 bytes, swap 0.
- one-shot 모듈 확인:
  - EMEA 항공 spawn `(214,420)` + 귀환 `air-gate`.
  - APAC 항공 spawn `(1460,582)` + 귀환 gate 없음.
  - dev guest 저장 결과 `true`, 네트워크 요청 0회.
- 보고서 외 제품·테스트·API·DB 변경 없음.

## 승인 뒤 권장 순서

1. 검수 전용 광장 airport anchor의 명칭과 URL 형식을 정한다.
2. 파서 단위 테스트에 기본 guest, `air:emea`, APAC 비대칭, 새 광장 anchor를 함께 고정한다.
3. 브라우저 회귀에서 광장 프롬프트 → 같은 버튼 연타 → 저장 1회 → 지역 전환을 검증한다.
4. 저장 실패 UX는 직접 재시도 버튼 또는 정직한 닫기 안내 중 하나로 통일한다.
5. APAC에 귀환 항공 게이트가 필요한지는 제품 교통 설계로 별도 결정하고, 하니스 편의를 이유로
   지리·교통 노드를 임의 추가하지 않는다.
