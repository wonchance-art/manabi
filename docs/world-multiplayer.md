# 학습 월드 멀티플레이 — 계약과 후속(Codex 전환 대기)

`/world` 의 멀티플레이 강화(오너 요구 3종)에 대한 계약 문서.
관련 파일 소유: net.js·worldNet.test.js 는 Codex(ChatGPT) 소유(무변경), 그 외는 Claude 소유.

## 개방 범위 (2026-07-12, 오너 확정 — `20260712d_world_open_all_users.sql`)

`/world` 는 관리자 전용 실험실 → **전체 로그인 유저 개방 정식 기능**으로 전환됐다.
- **페이지 게이트**: `WorldPage.jsx` 는 `!isAdmin` 이 아니라 `!user` 만 차단한다(비로그인 → 로그인 안내).
- **네비 진입점**: `Layout.jsx` 가 로그인 유저 데스크톱·모바일 네비에 「월드」(`/world`) 링크를 노출한다
  (`SHOW_UNFINISHED_NAV` 플래그와 무관 — 정식 기능). AdminPage 의 기존 `/world` 카드 링크도 유지.
- **API 라우트**: 3개 라우트가 `requireAdmin()` → `requireUser()`(로그인만 확인, 같은 반환 계약).
- **Realtime RLS**: 'world-plaza' 수신/송신 정책이 `role='admin'` 조건을 벗고 전체 authenticated 로그인 유저를 허용.
- **IP 동시접속 차단 해제**: 같은 IP 다중 접속 허용(오너 확정). `claim_world_session_v2` 는 ip 를 계속
  기록하되 duplicate-ip 거부를 제거했다. **계정 단위 단일 접속(한 계정 = 한 세션)은 그대로 유지.**
  `duplicate-ip` 는 더 이상 발생하지 않지만 반환 계약·WorldGate 문구는 미래 재활성 여지로 남겨 둔다.

## 오너 요구 → 구현 매핑

1. **멀티로만 작동** — 임대 실패/미연결 시 솔로 폴백 금지, 입장 자체 차단.
   → `WorldPage.jsx` 가 `net.onStatus` 상태값만으로 판정. `worldStatus === 'connected'` 이고
     스폰 좌표 조회가 끝났을 때만 `GameCanvas` 를 렌더하고, 그 외(연결 중·중복·임대오류·연결실패)엔
     `WorldGate` 차단 화면을 보인다. net.js 는 건드리지 않는다.
2. **한 계정 동시 접속 금지(계정 단위 단일 접속)** — 기존 `world_sessions` 임대.
   → ~~IP 단위 차단~~은 오너 확정으로 **해제**됐다(같은 IP 다중 접속 허용, `20260712d`).
     `world_sessions.ip` 컬럼(`20260712c`)은 기록용으로 남고, `claim_world_session_v2` 는 ip 를 계속
     기록하되 duplicate-ip 거부를 하지 않는다. IP 는 `POST /api/world/session` 라우트가 헤더에서 추출해
     RPC 에 기록용으로 전달. **net.js 는 아직 계정 단위 `claim_world_session()` 사용(아래 "후속" 참조).**
3. **좌표 실시간 기록 → 나간 자리 저장 → 재접속 시 그 자리 스폰.**
   → `world_positions` 테이블(본인 own-only RLS) + `/api/world/position`(GET 조회·POST 저장).
     `WorldPage` 가 bus `local:state` 를 받아 10초 스로틀 POST + pagehide `sendBeacon` + 언마운트 저장.
     입장 시 GET 으로 마지막 좌표를 받아 `GameCanvas initialSpawn` 으로 넘겨 그 타일에서 스폰.

## 스키마 (마이그레이션 `20260712c_world_multiplayer.sql`)

- `world_sessions.ip text` — IP 단위 검사 재료(계정 단위 임대 로직은 기존 그대로).
- `claim_world_session_v2(p_ip text DEFAULT NULL) RETURNS jsonb` (SECURITY DEFINER, `search_path=''`):
  - 반환 `{ token: uuid|null, reason: 'duplicate-account'|'duplicate-ip'|null }`(계약 불변).
  - **`20260712d` 이후: IP 차단 제거** — ip 는 계속 기록하되 duplicate-ip 는 발생하지 않는다.
    (미래 재활성 여지로 `duplicate-ip` 값은 계약에만 남김.)
  - 계정 단위 upsert…WHERE(만료 행만 인수)의 0행 → `duplicate-account`. 성공 → `token`.
  - **기존 `claim_world_session()` 은 무변경 유지** — 오버로드 모호성을 피하려 별도 이름(`_v2`)으로 신설.
    net.js 는 계속 인자 없는 `claim_world_session()` 을 호출하므로 기존 계약이 깨지지 않는다.
- `world_positions(user_id PK, scene text, x int, y int, updated_at)` — 본인만 select/insert/update(RLS
  own-only). x·y 는 **타일 인덱스**(월드 px 아님). GRANT 는 authenticated 만.

## API 라우트 (전부 Claude 소유)

| 라우트 | 메서드 | 용도 | 이번 웨이브 |
| --- | --- | --- | --- |
| `/api/world/position` | GET | 본인 마지막 좌표 `{ position }` | **사용** (스폰 조회) |
| `/api/world/position` | POST | 좌표 upsert(주기 저장·beacon 겸용) → 204 | **사용** (기록) |
| `/api/world/session` | POST | 임대 획득(IP 포함) `{ token, expiresAt, spawn }` / 409 `{ reason }` / 503 | 미사용(후속) |
| `/api/world/session` | PATCH | 하트비트 + 좌표 `{ token, scene, x, y }` → 204 / 410 | 미사용(후속) |
| `/api/world/session/leave` | POST | 임대 반납 + 최종 좌표(sendBeacon) → 204 | 미사용(후속) |

- 인증: 모든 라우트 `requireUser()`(쿠키 세션 — 전체 로그인 유저 개방. `20260712d` 이전엔 `requireAdmin()`).
- IP 추출: `x-forwarded-for` 첫 항목 → `x-real-ip` 폴백(`src/lib/world/session.js` `extractClientIp`).
- 좌표 upsert 는 **사용자 세션 클라이언트**로(world_positions own-only RLS 방어). `service_role` 금지.

## 차단 사유 값 (WorldGate)

- `duplicate` — 다른 기기/탭 접속 중(net.onStatus). 재시도 노출.
- `lease-error` — 임대 판정 불가(fail-closed). 재시도 노출.
- `failed` — 멀티 서버 연결 실패(RLS 미적용 등). 재시도 노출.
- `connecting` / `reconnecting` — 준비 중. 스피너만(자동 진행).
- RPC 사유값 `duplicate-account` 는 `/api/world/session` 409 로만 노출(후속 배선 시 사용).
  `duplicate-ip` 는 IP 차단 해제(`20260712d`)로 더는 발생하지 않으나 계약·WorldGate 문구는 재활성 여지로 유지.

## 좌표 흐름

- 저장 단위 = **타일 인덱스**. bus `local:state`(월드 px)를 WorldPage 가 `Math.floor(px / 32)` 로 변환.
- `GameCanvas` WorldScene 의 `local:state` payload 에 `scene:'plaza'` 를 실어 저장 씬을 구분한다
  (공항 씬은 `local:state` 를 emit 하지 않으므로 저장 씬은 사실상 항상 `plaza`).
- 스폰 적용: `GameCanvas` create() 가 `initialSpawn.scene==='plaza'` 이고 타일이 맵 안·보행 가능
  (`isSpawnTileValid`)일 때만 그 타일에서 스폰, 아니면 기본 서울(POI.SEOUL). `airport` 저장은
  광장 씬에 직접 배치할 수 없어 서울 허브로 폴백(방어적 — 실제 저장은 plaza 뿐).

## Codex 후속 라운드 (net.js 전환)

이번 웨이브는 위치 API만 배선하고 임대는 기존 net.js 흐름을 유지했다(이중 임대 방지). 다음 라운드에서:

1. net.js 의 `createSessionLease.claim()` 을 `client.rpc('claim_world_session')` 직접 호출 대신
   **`POST /api/world/session`** 경유로 바꾼다(서버가 IP 추출·전달 → IP 단위 차단 활성화).
2. 반환 사유(`duplicate-account`/`duplicate-ip`)를 net 상태(`onStatus`)로 세분화해 WorldGate 가
   IP 충돌과 계정 충돌을 구분 안내하게 한다(현재는 `duplicate` 단일).
3. heartbeat 에 좌표를 동봉(`PATCH /api/world/session { token, scene, x, y }`)해 하트비트 왕복 1회로
   임대 갱신 + 좌표 저장을 합칠 수 있다(현재는 `/api/world/position` POST 로 분리).
4. leave 를 `POST /api/world/session/leave`(sendBeacon)로 배선해 퇴장 즉시 임대 반납 + 최종 좌표 저장.

net.js 전환 시 이 라우트들의 요청/응답 형태(위 표)는 계약으로 고정한다.
