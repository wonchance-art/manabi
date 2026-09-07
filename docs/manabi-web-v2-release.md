# manabi 웹 v2 출시 후보

2026-09-07 KST. 오너가 승인한 운영 반영 설계와 후속 ‘진행해’에 따른 출시 준비다.
상태: **검토용 후보. 운영 전환 전 게이트는 아래에 별도로 기록한다.**

## 통합 범위

main `bd76c7d8f5bddf83c619a94c538183d29786c903`에 대해 #1277 → #1279 → #1280 → #1281 → #1282 → #1283 → #1285 → #1286의 누적 내용을 하나의 PR로 검토한다. AI 프로바이더 #1278, 월드 #1284는 포함하지 않는다.

책장·42과 N5·오늘·발견·복습·내 서재·자료 가져오기·집중 뷰어의 기존 변경을 보존한다. 이번 후보의 추가 구현은 배포 식별과 출시 검증이다. 원본 iCloud 작업 공간, 운영 자료, FSRS 일정, 교재 판본은 변경하지 않는다.

## 배포 식별

- `scripts/deploy-web-release.mjs`는 기본적으로 실행 계획만 출력한다. `--deploy`일 때만 기존 Vercel 로그인으로 배포한다. 깨끗한 Git 작업 공간의 exact HEAD/브랜치를 공개 빌드 정보로 전달하며 환경 파일은 읽지 않는다.
- Git 자동 배포와 CLI 배포 모두 같은 식별 함수를 사용한다. 운영/미리보기 빌드에 커밋이 없거나, Git과 CLI 커밋이 다르면 실패한다. 로컬 개발의 `dev/local` 폴백은 유지한다.
- `/api/version`은 동적/no-store다. 런타임 Git 정보가 없으면 **해당 서버 산출물**의 식별자를 사용한다. 브라우저 번들의 식별자를 서버 버전으로 오인하지 않는다. 서로 다른 커밋을 감지하면 503을 반환한다.
- 응답: 기존 `sha/ref/at` + 전체 `commit`, `releaseId`, `deploymentId`, `environment`, `bundledEditionId`. 임의 환경 값·사용자 정보는 내보내지 않는다. 일반 사용자 화면은 변경하지 않는다.
- `bundledEditionId`는 앱에 포장된 교재다. DB 발행 포인터와 다른 개념이므로 ‘현재 발행 판본’으로 표시하지 않는다. 발행 포인터는 출시 감사에서 별도 조회한다.
- `scripts/check-web-release.mjs URL EXPECTED_SHA preview`는 no-store·전체 SHA·대상 환경·배포 ID·포장 판본을 검사한다. 예상 SHA는 검토한 Git에서 가져오며 응답 값으로 자체 인증하지 않는다.
- 기존 `versionBadge.test.js` 한 계약은 Git 환경변수 문자열을 직접 비교하던 부분을 검증된 식별자 전달로 갱신했다. CLI/Git 동등성, 잘못된 커밋, 서버 불일치, 구번들 감지 등 실제 판정은 신규 계약으로 보완한다.

## DB 읽기 전용 감사

운영 migration 80개와 로컬 80개를 비교했다. 공통 버전 79개는 이름이 같으며, 차이는 아래 파일 번호 하나다. SQL 재실행·이력 수정·스키마 변경은 하지 않았다.

| 파일 | 운영 version | SHA-256 |
|---|---|---|
| `20260905065205_textbook_material_contexts.sql` | `20260905065205` | `63b5a8f0f230f0ecc7606b149e53f6ea113a28a8c12f519b08c8d5b4b7407015` |
| `20260906000912_textbook_book_editions.sql` | `20260906024758` | `118d904b04844fdada2bafae2b9921a6088ce2e45f64adbe1baed0c362beb76e` |

두 SHA 모두 운영 `supabase_migrations.schema_migrations.statements`를 개행으로 결합한 UTF-8 SHA-256과 파일 바이트 SHA-256이 정확히 일치한다. 전체 79개 과거 SQL의 바이트 동일성을 보증하는 결과는 아니다.

발행 포인터: `japanese-n5`, edition `7f572327dc67893e9453246c`, version **1**, **42과**. content hash `7f572327dc67893e9453246cbf1f50aa68c2b192ecbe4bcad99a27838c86c528`. 새로 발행하지 않았다.

**Claude 검토 항목:** AGENTS.md의 SQL 파일 소유 규약과 승인 설계의 담당 분리에 따라 Codex가 migration 파일을 변경하지 않았다. 검토 후 SQL 본문을 그대로 두고 `20260906000912_textbook_book_editions.sql`을 `20260906024758_textbook_book_editions.sql`로 이름 변경하고, `docs/textbook-n5-book-editions.md`의 파일 참조를 맞춘다. 과거 적용을 설명하는 `docs/textbook-n5-web-release.md`의 두 번호는 역사적 기록이므로 설명을 보완한다. 이후 최신 remote 이력과 `supabase db push --dry-run`을 재확인한다. 재적용/repair/초기화는 하지 않는다.

## Node 승인 항목

Vercel 프로젝트는 24.x, package.json과 lockfile은 20.x, 일반 CI는 22다. Node 20 신규 배포 종료 안내에 따라 아래 변경을 제안했으나 자동 승인 검토가 저장소 런타임 제한을 근거로 거부했다. **현재 설정은 변경하지 않았다.**

검토 가능한 변경 범위:

| 파일/범위 | 현재 | 승인 후 |
|---|---|---|
| `package.json` engines.node | `20.x` | `24.x` |
| `package-lock.json` root engines.node | `20.x` | `24.x` |
| `.github/workflows/ci.yml` 두 setup-node 단계 | `22` | `24` |
| `.github/workflows/world.yml` 및 월드 자산 저작 | `22` | 그대로 `22` |

공식 Node 24.20.0 darwin-arm64 런타임을 임시 위치에서 검증한다. 배포 설정 변경 승인 후에는 Vercel Node 24 빌드와 서버 동작을 다시 검사해야 한다. Node 22 world 테스트의 engine 경고는 설치 차단이 아니며 자산 생성 규약을 유지하는 의도적인 역할 분리다.

## 병합과 운영 전환

읽기 전용 설정 확인: Vercel project `manabi`, production branch **main**, `autoAssignCustomDomains: true`, Git 배포 enabled, system env enabled. 현재 그대로 병합하면 자동으로 운영 도메인에 할당될 수 있다.

1. Claude/운영 담당자가 검수 창을 합의하고 **병합 전에** 도메인 자동 할당을 끈다. 변경한 설정과 원래 값을 기록하고, 직전 운영 배포/도메인 매핑을 다시 읽는다. Codex는 공유 프로젝트 설정을 변경하지 않았다.
2. DB 파일 번호 정합성, Node 승인/배포 검사, 실제 계정 검수, CI가 통과한 뒤 Claude가 통합 PR을 main에 병합한다. 기존 8개 PR 정리는 포함 내용 확인 뒤 진행한다. Codex merge/force-push 금지.
3. 깨끗한 main에서 `node scripts/deploy-web-release.mjs --production-staged`로 계획을 검토하고 `--deploy`를 추가한다. 도구는 원격 main HEAD 일치, `--prod --skip-domain`을 강제한다. Preview를 그대로 승격해 production 설정 검증을 생략하지 않는다.
4. 대기 배포의 버전 검사를 `production` 대상으로 실행하고 인증/읽기/저장/권한/교재를 검수한다. production 대기 빌드 완료가 곧 이용자 전환 완료는 아니다.
5. 승인된 실행 담당자가 검수한 production 배포를 promote한 뒤, 기존 주소의 버전·교재·캐시·저장을 확인한다. 자동 할당을 원래대로 되돌리는 시점도 담당자가 결정한다.

## 복귀 기준

현재 `teset-gilt.vercel.app`의 실제 운영 배포는 `dpl_78wiEE8HhRX4uQMnxEwGVyrhbUzr` / `manabi-2imnjdsdy-wonchance-arts-projects.vercel.app`이다. main의 코드와 같다고 가정하지 않는다. 전환 직전 다시 확인한다.

인증·저장·비공개 접근·교재 로딩에 중대한 실패가 생기면 운영 주소를 직전 정상 배포로 되돌린다. DB/자료/진도/발행 포인터는 되돌리거나 삭제하지 않는다. 서로 다른 preview 도메인의 localStorage 읽기 위치가 운영으로 자동 이관되지는 않는다.

## 검수 기록

- 공식 Node 24.20.0에서 전체 `npm test -- --maxWorkers=2`: **349파일 / 3,792개 통과**, 123.83초. 설정을 바꾸지 않고 임시 공식 런타임으로 호환성을 확인했다.
- 배포 식별/기존 배지 계약: **2파일 / 34개 통과**. 변경 파일 ESLint 오류 0, `git diff --check` 통과.
- prebuild: 콘텐츠·읽기·커리큘럼 오류 0, 기존 커리큘럼 경고 11. world 산출물은 검사만 수행했다. SW 캐시 키는 변경된 콘텐츠 해시로 갱신했다.
- 실제 브라우저의 기존 검수 화면은 비로그인 상태다. 로그인 계정의 서버 저장 왕복은 아직 완료하지 않았다. 격리 HTTP fixture 결과로 대체하지 않는다.
- 실제 배포 주소, 브라우저 검사 및 CI는 검수 후 이 절에 추가한다.

## 다음 범위

글 전체 북마크, 기기 간 교재 읽기 위치 동기화, PDF 조판, 음성 제작은 후속이다. 이번 출시의 실제 병합/도메인 전환은 위 게이트를 통과한 뒤 담당자가 수행한다.

근거: [Vercel staged deployment 옵션](https://vercel.com/docs/cli/deploy), [시스템 환경변수](https://vercel.com/docs/environment-variables/system-environment-variables), [Node 버전 우선순위](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Supabase migration 이력](https://supabase.com/docs/guides/deployment/database-migrations).
