# P7 초기 번들 Supabase·FSRS 분리

- 측정일: 2026-07-23 KST
- before 기준: `origin/main` `85fca6b24b3c5ff4624eda6ccc9fadcf0eff48f2`
- 환경: macOS arm64, 공식 nvm Node `v22.23.1`, Next.js `15.5.21`
- 범위: P6에서 최대 잔여로 식별한 Supabase SDK와 FSRS를 초기 app route에서
  기능 사용 시점으로 지연
- 비범위: DB 스키마·마이그레이션·시크릿·서버 Supabase client·인증/학습 데이터 시맨틱

P6 병합 보고서의 실제 파일명은 발주에 적힌
`docs/audit-bundle-production.md`가 아니라 `docs/audit-bundle-r2.md`다. 이 문서의
65,039 B gzip 공용 청크 분석과 측정법을 재확인해 before 기준으로 사용했다.

## 판정

**구현 유지.** 대표 초기 route의 JS 합계가 **65,111~65,485 B gzip** 감소해
5 kB 중단 기준을 크게 통과했다.

- before의 `2059-55d1f40bdeb7c835.js`는
  `245,023 B raw / 65,039 B gzip`이며 Supabase와 FSRS를 함께 포함했다.
- 이 파일은 before의 91개 app manifest entry 중 35개 초기 목록에 들어갔다.
- after에는 Supabase가 `202,197 B raw / 52,396 B gzip`, FSRS가
  `20,326 B raw / 6,372 B gzip`, adapter가 `1,110 B raw / 631 B gzip`인
  비동기 청크로 분리됐다.
- 세 비동기 파일과 after의 91개 app manifest entry 교집합은 각각 **0개**다.
- Next 출력도 `/world` `198→133 kB`, `/vocab` `210→145 kB`,
  `/study` `199→134 kB`, `/home` `202→137 kB`, `/learn` `189→123 kB`로
  같은 방향을 확인했다.

## 구현 경계

### Supabase

`src/lib/supabase.js`는 SDK를 직접 import하지 않는 경량 lazy facade가 됐다.
기존 호출부의 `await supabase.from(...).select(...)`와 fire-and-forget `.then()` 모양을
보존하고, 처음 관찰된 쿼리에서만 `src/lib/supabaseClient.js`를 import한다. import 실패는
promise cache를 비워 다음 동작에서 재시도한다.

동기 반환이 필요한 두 경계는 facade로 흉내 내지 않는다.

- AuthContext는 실제 client를 받은 뒤 기존 순서대로 `getSession()`을 시작하고
  `onAuthStateChange()`를 등록한다. cleanup 전 늦은 import/session 결과는 무시한다.
- 월드 Realtime은 net `join()`과 chat 채널 개설 시 실제 client를 받은 뒤 기존
  lease→channel·broadcast/presence 흐름을 시작한다. 테스트의 주입 client 계약은 유지한다.

DB table, query, payload, auth redirect, Realtime channel 설정은 바꾸지 않았다.

### FSRS

FSRS 계산식과 `src/lib/fsrs.js`는 수정하지 않았다. 정적 import만 다음 기능 경계로 옮겼다.

- 어휘 복습 평가, 통합 학습 어휘 채점, 인게임 QuestReview 채점
- 문법 복습 재스케줄
- 홈·학습 허브의 forecast 데이터 fetch

어휘 평가에는 첫 dynamic import 동안 중복 탭 가드를 두고, QuestReview는 import 실패 시
현재 카드를 유지해 재시도할 수 있게 했다. 기존 rating, FSRS 입력, DB update payload,
review event와 다음 문항 전이는 그대로다.

## production 전후 측정

P6와 동일하게 성공한 production build의 `.next/app-build-manifest.json`에서 route별
초기 JS 파일 목록을 얻고, 각 emitted 파일을 Node zlib gzip level 9로 독립 압축해 더했다.
before와 after 모두 `.env.local`이 없는 새 임시 트리에서 실행했고, 공개 dummy 값은
build 프로세스에만 주입했다.

| 초기 경로 | before gzip | after gzip | 절감 |
|---|---:|---:|---:|
| `/` | 180,334 B | 115,117 B | **65,217 B (36.2%)** |
| `(app)` layout | 180,656 B | 115,440 B | **65,216 B (36.1%)** |
| `/home` | 202,291 B | 136,834 B | **65,457 B (32.4%)** |
| `/learn` | 188,548 B | 123,063 B | **65,485 B (34.7%)** |
| `/lessons` | 185,802 B | 120,587 B | **65,215 B (35.1%)** |
| `/vocab` | 210,103 B | 144,992 B | **65,111 B (31.0%)** |
| `/study` | 198,774 B | 133,582 B | **65,192 B (32.8%)** |
| `/world` | 198,418 B | 133,268 B | **65,150 B (32.8%)** |

production build는 전후 모두 compile, lint/type check, page data와 static page
**406/406**을 완료했다. canonical 측정 JSON은 before 5,318 B
(`3cea80dd0a44fec6aa006d900e34d794ca69f1f80c487efb61f9d4a67d4216ca`),
after 4,843 B
(`939edb6e2aae3bfa589b969c0dd1ae122c3e299c007bb69906c89ebe9cb707f4`)다.

## 회귀 검증

| 검증 | 결과 |
|---|---|
| lazy/auth/FSRS/world targeted | 7 files / 168 tests PASS |
| 학습 데이터·세션 targeted | 7 files / 198 tests PASS |
| targeted V8 heap 실측 | 최대 18 MB |
| pipefail 전체 single-worker vitest | **225 files / 2,217 tests PASS / 254.30s** |
| production `next build` | before/after PASS, static pages 406/406 |
| `npm run lint` | PASS |
| `git diff --check` | PASS |

전체 vitest에는 기존 `contentOverrides.test.js`의 확장자 없는 dynamic-import 경고 1건이
있었지만 실패는 없었고 P7 변경 경로와 무관하다. `.env.local`, DB 스키마, migration,
시크릿, build 설정과 package 의존성은 수정하지 않았다.
