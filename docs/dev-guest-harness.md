# 개발 게스트 하니스 정본

비로그인 상태에서 `/world`의 도시·지역·교통 전환을 라이브 검수하기 위한 개발 전용
하니스다. 제품의 인증·멀티플레이·저장 계약을 바꾸는 기능이 아니며, 프로덕션에서는
활성화되지 않는다.

이 문서의 소스 라인 근거는 W3 최종 기준 main
[`a252e27058b0a009595d58b7acd0523e9098ba87`](https://github.com/wonchance-art/manabi/commit/a252e27058b0a009595d58b7acd0523e9098ba87)다.
W3 착수 뒤 merge된 S11 스탬프 폴백까지 포함하며, 이전 배포와 비교할 수 있도록 적용
전·후 경계를 아래에 함께 적는다.

## 활성화

저장소 루트의 `.env.local`에 아래 한 줄을 둔다. `.env.local`은 커밋하지 않는다.

```dotenv
NEXT_PUBLIC_WORLD_DEV_GUEST=1
```

공식 nvm Node 22를 선택한 뒤 개발 서버를 다시 시작한다. 환경 변수는 실행 중인 Next.js
프로세스에 시작할 때 주입되므로 값을 바꿨다면 반드시 재기동한다.

```bash
nvm use 22
npm run dev -- -p 3005
```

로그아웃 상태 또는 별도 브라우저 프로필에서 `http://localhost:3005/world`를 연다. 판정식은
`NODE_ENV !== 'production' && NEXT_PUBLIC_WORLD_DEV_GUEST === '1'`이므로 프로덕션 빌드에서는
변수가 남아 있어도 게스트 우회가 꺼진다
([`WorldPage.jsx` L433-L449](../src/views/WorldPage.jsx#L433-L449)).

## `?spawn=` 정본 문법

형식은 `/world?spawn=<값>`이다. `x,y`는 픽셀이 아니라 **정수 타일 좌표**다. 현재 지역 ID는
`asia-pacific`, `emea`이고, 도시 ID는
[`CITY_MANIFEST`](../src/components/world/cities/manifest.js#L10-L38)에 등록된 값만 유효하다.

| 문법 | 예 | 동작 |
|---|---|---|
| `air:<region>` | `air:emea` | 해당 지역의 `airArrival → airGate → region gate` 우선순위로 정한 항공 앵커에 들어간다. `@x,y`를 붙여 좌표를 덮어쓰는 문법은 없다. |
| `city:<id>` | `city:lyon` | 해당 도시 payload 하나를 선로드해 도시 씬으로 들어가며, 좌표가 없으므로 도시 `entrance`를 사용한다. |
| `city:<id>@x,y` | `city:lyon@239,139` | 해당 도시를 선로드하고 좌표가 범위 안·보행 가능·입구와 같은 4방 성분이며 개방 지구이면 그 타일을 쓴다. 아니면 도시 `entrance`로 안전하게 폴백한다. |
| `overworld:<region>@x,y` | `overworld:emea@271,489` | 출시 허용된 지역 씬의 범위 안 타일로 직행한다. 좌표가 없거나 범위 밖이거나 알 수 없는 지역이면 지역 직행은 성립하지 않는다. |

파서는 `air:`를 먼저 특수 처리하고, 나머지는 `:`가 있는 씬 문자열과 유한한 `x,y`를
`initialSpawn`으로 만든다
([`WorldPage.jsx` L439-L449](../src/views/WorldPage.jsx#L439-L449)).
`air:`가 실제로 만드는 값은 공항 스토리 씬이 아니라 지역 씬의 항공 앵커다
([`overworldRegions.js` L276-L286](../src/lib/world/overworldRegions.js#L276-L286)).
도시 ID 선로드는 manifest에서 검증되고
([`manifest.js` L110-L136](../src/components/world/cities/manifest.js#L110-L136)),
도시·지역 리다이렉트와 좌표 검증은 각각
[`session.js` L66-L94](../src/lib/world/session.js#L66-L94),
[`CityScene.js` L1201-L1208](../src/components/world/CityScene.js#L1201-L1208)에서 수행된다.

파서가 `:`를 포함한 임의 문자열을 일단 객체로 만들 수 있다는 사실은 지원 문법을 뜻하지
않는다. 위 네 형식만 하니스의 정본 지원 표면이다. 잘못된 값은 오류 페이지 대신 초기 기본
진입으로 폴백할 수 있으므로 URL만 보지 말고 화면 좌상단의 실제 씬 HUD를 확인한다. 특히
`overworld:<region>`은 좌표 없는 정본 문법이 아니고, `air:<region>@x,y`의 좌표는 사용되지
않는다.

## 게스트 동작 경계

### 오프라인 입장

비로그인 dev guest는 멀티 네트워크와 저장 좌표 조회를 만들지 않고 `worldStatus`를
`connected`로 단락한 뒤 파싱한 spawn을 사용한다
([`WorldPage.jsx` L608-L613](../src/views/WorldPage.jsx#L608-L613)).
이 상태는 실제 멀티 접속 성공을 뜻하지 않는다. 로그인 게이트를 우회해 `GameCanvas`를
렌더하기 위한 개발 상태이며
([`WorldPage.jsx` L901-L920](../src/views/WorldPage.jsx#L901-L920)),
제품의 로그인 사용자와 멀티 세션 계약은 그대로다.

### 위치 저장: E2·E7 범위

- 일반 재접속 위치의 GET은 하지 않고, `userId`가 없으므로 10초 주기 POST,
  `pagehide` beacon, 언마운트 최종 POST도 설치하지 않는다
  ([`WorldPage.jsx` L790-L803](../src/views/WorldPage.jsx#L790-L803),
  [`WorldPage.jsx` L805-L862](../src/views/WorldPage.jsx#L805-L862)).
- E2 공항 스토리 출구는 다이얼로그를 먼저 닫고, dev guest일 때
  `/api/world/position` 저장을 건너뛴 뒤 광장 복귀를 계속한다
  ([`airportStoryState.js` L27-L54](../src/components/world/airportStoryState.js#L27-L54)).
- E7 공용 저장기는 dev guest에 즉시 `true`를 반환하며 제품 위치 API를 호출하지 않는다
  ([`guestPositionPersistence.js` L1-L26](../src/components/world/guestPositionPersistence.js#L1-L26)).
  같은 저장기가 에어허브, 횡단열차 회랑, 지역 페리·철도·항공 전환에 주입된다
  ([`GameCanvas.jsx` L918-L923](../src/components/world/GameCanvas.jsx#L918-L923),
  [`GameCanvas.jsx` L1988-L2008](../src/components/world/GameCanvas.jsx#L1988-L2008),
  [`GameCanvas.jsx` L2392-L2450](../src/components/world/GameCanvas.jsx#L2392-L2450)).

따라서 dev guest의 위치는 서버 재접속 상태가 아니다. 같은 URL로 새로고침하면 `?spawn=`이
다시 기준이 된다. 반대로 하니스가 모든 브라우저 로컬 상태를 초기화하지는 않는다.
발견 진행, 설정, 그리고 S11 적용 뒤 스탬프처럼 `localStorage`를 쓰는 기능은 같은 브라우저
프로필에 남을 수 있다. 완전한 첫 방문 검수에는 새 프로필을 쓰거나 해당 origin의 사이트
데이터를 먼저 비운다.

### 스탬프: S11

S11 [PR #469](https://github.com/wonchance-art/manabi/pull/469)이 포함된 현재 정본에서는
dev guest만 `guest-stamps` localStorage를 사용한다. 앨범 정본 ID와의 교집합만 복구하고,
깨진 JSON·유령 ID·중복·저장소 차단은 빈 상태 또는 `false`로 닫는다
([`stamps.js` L9-L68](../src/lib/world/stamps.js#L9-L68)).
게스트 Set은 기존 앨범·마일스톤 소비자로 들어가며 제품 로그인 사용자의 서버 GET/POST는
그대로다
([`GameCanvas.jsx` L684-L703](../src/components/world/GameCanvas.jsx#L684-L703)).

S11 이전 head
[`d192161e13255aa3e10c38bd6615e9be6ca82c34`](https://github.com/wonchance-art/manabi/commit/d192161e13255aa3e10c38bd6615e9be6ca82c34)에서는
게스트도 서버 래퍼를 호출하고 실패를 빈 목록/`false`로 닫았기 때문에 화면 안의 낙관적
스탬프가 새로고침 뒤 남지 않았다. 라이브 검수 기록에는 대상 head가 S11 포함 전인지 후인지
반드시 적는다.

## 직행 지원표

이 표의 “직행”은 비로그인 dev guest가 URL 하나만 열어 목표 씬에서 시작한다는 뜻이다.

| 목표 | 직행 URL | 지원 | 근거와 현재 경로 |
|---|---|---:|---|
| 광장 `plaza` | `?spawn=plaza@x,y` | 아니요 | 파서는 `air:` 외에는 `:` 없는 씬을 거부한다. 광장 좌표 소비 코드는 `scene === 'plaza'`를 받을 수 있지만 하니스 파서가 그 값을 만들지 않는다 ([`WorldPage.jsx` L439-L448](../src/views/WorldPage.jsx#L439-L448), [`GameCanvas.jsx` L1677-L1688](../src/components/world/GameCanvas.jsx#L1677-L1688)). `air:emea` 또는 `air:asia-pacific`에서 귀환 항공 게이트를 이용하면 인천공항 광장으로 간접 진입할 수 있다. |
| 공항 스토리 `airport` | `?spawn=airport@x,y` | 아니요 | `airport`도 `:`가 없어 거부되고, 초기 부팅 리다이렉트에는 airport 분기가 없다 ([`GameCanvas.jsx` L1507-L1557](../src/components/world/GameCanvas.jsx#L1507-L1557)). `air:<region>`은 airport가 아니라 지역 항공 앵커다. 현재 공항 스토리 진입점은 광장 인천공항 노드다 ([`worldNodes.js` L117-L121](../src/components/world/worldNodes.js#L117-L121)). |
| 횡단열차 회랑 `transsib-corridor` | `?spawn=transsib-corridor@x,y` | 아니요 | 정본 씬 키에 `:`가 없어 파서가 거부한다. 또한 회랑 초기 리다이렉트는 출시 허용 또는 관리자 preview를 요구하고, 비로그인 dev guest에는 관리자 권한이 없다 ([`session.js` L81-L85](../src/lib/world/session.js#L81-L85), [`session.js` L81-L92](../src/lib/world/session.js#L81-L92)). 지역 회랑 게이트도 같은 release gate를 통과해야 한다. |

`plaza:any`, `airport:any`, `transsib-corridor:any`처럼 파서의 콜론 조건만 피하는 가짜 씬
별칭은 지원되지 않는다. 런타임이 해당 키를 목표 씬으로 정규화하거나 리다이렉트하지 않으므로
검수 URL로 기록하지 않는다.

## 라이브 검수 절차

아래 세 예시는 dev server를 3005 포트로 띄우고 로그아웃한 상태를 전제로 한다. 각 실행에서
브라우저 Network 패널의 `/api/world/position` GET/POST가 없는지와 좌상단 씬 HUD를 함께
확인한다.

### 1. 도시 exact 좌표

1. `http://localhost:3005/world?spawn=city:lyon@239,139`를 연다.
2. HUD가 리옹 도시 씬인지 확인하고 D-pad로 한 칸 이동한다.
3. 리옹 입구에서 시작했다면 URL 파싱 실패가 아니라 요청 타일의 범위·보행 성분·지구 개방
   검증 폴백일 수 있으므로 좌표 정본을 다시 확인한다.
4. 새로고침해 같은 URL 좌표가 다시 적용되는지 확인한다. 이전에 걸어간 위치가 서버에서
   복원돼서는 안 된다.

### 2. 지역 좌표에서 도시 게이트

1. `http://localhost:3005/world?spawn=overworld:emea@271,489`를 연다. 이 좌표는 제네바
   코르나뱅역 게이트의 체크인 타일이다
   ([`worldNodes.js` L428-L439](../src/components/world/worldNodes.js#L428-L439)).
2. HUD가 `유럽·지중해·중동`인지 확인한다.
3. `Ⓐ`로 제네바 노드를 열고 `들어가기`를 선택한다.
4. 프롬프트가 닫히기만 하는 락 교착 없이 `city:geneva`로 전환되는지 확인한다.

### 3. 항공 앵커 → 광장 → 공항 스토리

1. `http://localhost:3005/world?spawn=air:emea`를 연다.
2. EMEA의 파리 항공 게이트에서 `Ⓐ`로 귀환을 확인한다. 위치 저장 오류 없이 인천공항
   광장으로 전환돼야 한다.
3. 광장 인천공항 노드에서 `Ⓐ`로 공항 스토리에 들어간다.
4. 스토리 도중 나갔다가 다시 들어가는 경로와 심사 완료 후 `출구로` 경로를 각각 확인한다.
   광장 복귀 뒤 스토리·심사 오버레이가 남지 않고, dev guest 위치 POST 실패 때문에 전환이
   막히지 않아야 한다.

검수가 끝나면 개발 서버를 내리고 `.env.local`의 플래그를 제거하거나 `0`으로 바꾼다. 다음
일반 로그인 검수 전에 서버를 재기동해 게스트 우회가 꺼졌는지 확인한다.
