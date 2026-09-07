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

## 승인된 Node 24 전환

Vercel 프로젝트의 24.x 설정을 package.json의 20.x가 덮어쓰고 있었다. 최초 자동 승인 검토에서 보류한 세 파일 변경은 2026-09-07 오너의 **「승인. 다음 할 일 진행」**으로 명시적으로 승인되었다. 아래 웹 런타임 설정을 적용했다. 월드 생성용 Node 22 규약은 유지한다.

승인된 변경 범위:

| 파일/범위 | 이전 | 적용값 |
|---|---|---|
| `package.json` engines.node | `20.x` | `24.x` |
| `package-lock.json` root engines.node | `20.x` | `24.x` |
| `.github/workflows/ci.yml` 두 setup-node 단계 | `22` | `24` |
| `.github/workflows/world.yml` 및 월드 자산 저작 | `22` | 그대로 `22` |

공식 Node 24.20.0 darwin-arm64 런타임으로 검증한다. 실제 Vercel Node 24 빌드·서버 동작과 Node 24 웹 CI 결과는 후속 검수 기록에 남긴다. Node 22 world 테스트의 engine 경고는 설치 차단이 아니며 자산 생성 규약을 유지하는 의도적인 역할 분리다.

첫 Node24 CI의 npm 11.19.0 설치 검사가 기존 lockfile의 선택 의존성 네 항목 누락을 발견했다. 격리 폴더에서 `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`로 보완했다. 추가 항목은 `@unrs/resolver-binding-wasm32-wasi@1.12.2`와 그 하위 `@emnapi/core@1.10.0`, `@emnapi/runtime@1.10.0`, `@emnapi/wasi-threads@1.2.1`뿐이다. 기존 package 항목의 변경·삭제는 0이며 의존성 버전을 올리지 않았다. 새 lockfile과 SW 콘텐츠 해시를 함께 보존한다.

## 병합과 운영 전환

읽기 전용 설정 확인: Vercel project `manabi`, production branch **main**, `autoAssignCustomDomains: true`, Git 배포 enabled, system env enabled. 현재 그대로 병합하면 자동으로 운영 도메인에 할당될 수 있다.

1. Claude/운영 담당자가 검수 창을 합의하고 **병합 전에** 도메인 자동 할당을 끈다. 변경한 설정과 원래 값을 기록하고, 직전 운영 배포/도메인 매핑을 다시 읽는다. Codex는 공유 프로젝트 설정을 변경하지 않았다.
2. DB 파일 번호 정합성, 승인된 Node 24 배포 검사, 실제 계정 검수, CI가 통과한 뒤 Claude가 통합 PR을 main에 병합한다. 기존 8개 PR 정리는 포함 내용 확인 뒤 진행한다. Codex merge/force-push 금지.
3. 깨끗한 main에서 `node scripts/deploy-web-release.mjs --production-staged`로 계획을 검토하고 `--deploy`를 추가한다. 도구는 원격 main HEAD 일치, `--prod --skip-domain`을 강제한다. Preview를 그대로 승격해 production 설정 검증을 생략하지 않는다.
4. 대기 배포의 버전 검사를 `production` 대상으로 실행하고 인증/읽기/저장/권한/교재를 검수한다. production 대기 빌드 완료가 곧 이용자 전환 완료는 아니다.
5. 승인된 실행 담당자가 검수한 production 배포를 promote한 뒤, 기존 주소의 버전·교재·캐시·저장을 확인한다. 자동 할당을 원래대로 되돌리는 시점도 담당자가 결정한다.

## 복귀 기준

현재 `teset-gilt.vercel.app`의 실제 운영 배포는 `dpl_78wiEE8HhRX4uQMnxEwGVyrhbUzr` / `manabi-2imnjdsdy-wonchance-arts-projects.vercel.app`이다. main의 코드와 같다고 가정하지 않는다. 전환 직전 다시 확인한다.

인증·저장·비공개 접근·교재 로딩에 중대한 실패가 생기면 운영 주소를 직전 정상 배포로 되돌린다. DB/자료/진도/발행 포인터는 되돌리거나 삭제하지 않는다. 서로 다른 preview 도메인의 localStorage 읽기 위치가 운영으로 자동 이관되지는 않는다.

## Node 24 후속 검수 (2026-09-07)

- 실행 코드 `4f3c7cd05e2b6910a8b068c96b3d3b3bfadcfcb7`. package/lock engines24, 웹 CI24 적용. 기존 dependency 항목 변경·삭제 0, 누락 optional 4항목 추가. world workflow와 자산 변경 0.
- 로컬 공식 Node24.20.0 전체 단위 **349파일 / 3,792개**, 153.35초. prebuild 오류0/기존 커리큘럼 경고11, npm11 깨끗한 설치 dry-run 통과.
- [웹 CI 34071354944](https://github.com/wonchance-art/manabi/actions/runs/34071354944) **SUCCESS**: Node24.20.0/npm11.19.0 설치·lint·콘텐츠·단위3,792·474페이지 빌드·조판25·뷰어4·smoke14(기존skip6)·학습9.
- [월드 CI 34071354965](https://github.com/wonchance-art/manabi/actions/runs/34071354965) **SUCCESS**: Node22.23.2/npm10.9.8, **130파일 / 1,102개**, 245.00초. 루트 engines24에 대한 경고는 있으나 설치와 테스트는 통과했다. 월드 생성 런타임을 바꾸지 않았다.
- 최초 웹 CI 34071209152는 기존 lockfile 누락 때문에 설치 단계에서 실패했다. 보완 후 위 CI가 통과했다. 이전 중간 미리보기 `dpl_WgLCgQmmUqDVWinXfrpDZGehUPA7`는 최종 빌드 대기열을 비우기 위해 취소했다.
- 실제 Vercel 최종 배포 **READY**, `/v13/deployments`의 `nodeVersion=24.x`, `projectSettings.nodeVersion=24.x`. 실제 글꼴 다운로드 재시도 후 474페이지·서버 함수 빌드를 완료했다(빌드 약6분). 미리보기 `manabi-i2gyqbflq-wonchance-arts-projects.vercel.app`, deployment `dpl_AhhMMcmBQ1oXqUVHaK1PCgNiKKMK`, release `web-v2-4f3c7cd05e2b`. 소스 `4f3c7cd05e2b6910a8b068c96b3d3b3bfadcfcb7`.
- 원본 URL의 실제 `/api/version`에서 exact SHA·판본·preview 대상·배포 ID·no-store 통과. Chrome에서 실제 브라우저/서버 SHA 일치·일반 게스트 내부 표시 숨김·명시적 구버전 fixture 경고의 4조건/오류0도 확인했다.
- 새 배포의 교재 **54레이아웃 / 17흐름 / 42과 API**, 홈·공통 구조 **34레이아웃 / 실제콘텐츠4흐름 / fixture6흐름** 모두 오류0. 320/390/768/1440px, 실제 홈→책→29과→홈→같은 읽기 위치, 예문 박스·키보드·관리자/API의 게스트 거부를 확인했다. 데스크톱 홈/예문과 390px 홈/30과 이미지를 직접 검수했다. 실제 서버의 공개 교재와 격리 브라우저 로컬 기록을 사용했으며 계정·장애 상태는 명시적 fixture다.
- 고정 주소 https://manabi-web-v2-preview.vercel.app/home 를 위 Node24 배포로 갱신하고 exact SHA·판본·배포 ID·preview·no-store 검사를 다시 통과했다. 기존 운영 주소는 여전히 `dpl_78wiEE8HhRX4uQMnxEwGVyrhbUzr`다.
- **Node 승인/런타임 검증 조건은 해소했다.** 실제 계정 로그인은 아직 확인되지 않았으므로 서버 쓰기/두 계정 권한 검수는 대기한다. DB 파일 번호 정합화와 병합은 Claude 담당, 자동 도메인 할당 분리와 production 대기 빌드 검수는 운영 전환 조건으로 유지한다. PDF·음성·월드 생성·운영 승격은 수행하지 않았다.

## 이전 후보 검수 기록 (Node 24 설정 적용 전)

- 공식 Node 24.20.0에서 전체 `npm test -- --maxWorkers=2`: **349파일 / 3,792개 통과**, 123.83초. 설정을 바꾸지 않고 임시 공식 런타임으로 호환성을 확인했다.
- 배포 식별/기존 배지 계약: **2파일 / 34개 통과**. 변경 파일 ESLint 오류 0, `git diff --check` 통과.
- prebuild: 콘텐츠·읽기·커리큘럼 오류 0, 기존 커리큘럼 경고 11. world 산출물은 검사만 수행했다. SW 캐시 키는 변경된 콘텐츠 해시로 갱신했다.
- 실제 브라우저의 기존 검수 화면은 비로그인 상태다. 로그인 계정의 서버 저장 왕복은 아직 완료하지 않았다. 격리 HTTP fixture 결과로 대체하지 않는다.
- Node 24 로컬 Next 빌드: 기본 2GiB V8 heap에서는 메모리 한도로 중단. 검수 프로세스에만 `NODE_OPTIONS=--max-old-space-size=4096`을 적용한 재실행은 **474페이지 생성까지 성공**했다. 프로젝트/배포 환경 설정을 수정하지 않았다. 로컬 빌드는 공개 더미 인증 설정과 테스트 글꼴을 사용했다.
- 실제 Vercel 미리보기: Node 20 현재 설정에서 실제 글꼴 포함 빌드 성공(초반 글꼴 다운로드 재시도 후 완료), **474페이지**. 커밋 `3c608476aed01844cb5dca6d883772616c2d4003`, deployment `dpl_4drbJCiSadQb1Wd47PD99KkhaFQQ`, release `web-v2-3c608476aed0`. 그 이후 커밋은 검수 스크립트·문서·보드이며 실행 코드는 동일하다.
- 고정 검수 주소: https://manabi-web-v2-preview.vercel.app/home . 원본 배포 https://manabi-l7cixb224-wonchance-arts-projects.vercel.app . 두 주소 모두 `/api/version`의 exact SHA·preview 대상·배포 ID·포장 판본·no-store 검사를 통과했다.
- PR #1287의 실행 코드 CI [34069142476](https://github.com/wonchance-art/manabi/actions/runs/34069142476): 전체 단위 349파일/3,792개, 조판 25개, 뷰어 4개, smoke 14개(기존 skip6), 학습 흐름 9개 통과. 최종 문서/검수 커밋의 CI는 PR checks와 #150 exact-head 인계에 기록한다.

| 실제 배포 브라우저 검사 | 결과 | 데이터 경계 |
|---|---|---|
| 버전 식별 | 4조건 / 오류0 | 실제 클라이언트·서버 비교 후 구버전 경고만 명시적 fixture |
| 교재 전체 | 54개 레이아웃, 17개 흐름, 42과 API / 오류0 | 실제 발행 판본, 격리 브라우저의 로컬 답안/진도 |
| 오늘·공통 구조 | 34개 레이아웃, 실제 콘텐츠4흐름·상태6흐름 / 오류0 | 실제 홈→책→29과→홈→같은 위치, 계정/장애는 fixture |
| 자료 가져오기·읽기 왕복 | 20조건 / 오류0 | 상태 있는 인증/REST/AI fixture |
| 집중 뷰어 | 14조건 / 오류0 | 상태 있는 인증/REST/AI fixture |
| 서재·발견 | 26조건 / 오류0 | 실제 지역학·교재, 개인 자료/장애는 fixture |
| 복습 | 17조건 / 오류0 | 채점·되돌리기·원문·계정/실패 fixture |

데스크톱 홈/뷰어, 390px 홈/교재/단어 시트를 렌더 이미지로 직접 검수했다. 가로 넘침, 예문 박스, 글꼴/발음, 키보드 초점, 원문 위치 유지와 계정별 빈 상태를 확인했다. 실제 계정 저장/두 계정 권한 검수와 production 설정 검증은 완료 표시하지 않는다.

고정 alias 연결 후 기존 운영 주소를 재조회했다. 여전히 `dpl_78wiEE8HhRX4uQMnxEwGVyrhbUzr`이며 운영 승격/도메인 전환/DB 쓰기는 없었다.

## 다음 범위

글 전체 북마크, 기기 간 교재 읽기 위치 동기화, PDF 조판, 음성 제작은 후속이다. 이번 출시의 실제 병합/도메인 전환은 위 게이트를 통과한 뒤 담당자가 수행한다.

근거: [Vercel staged deployment 옵션](https://vercel.com/docs/cli/deploy), [시스템 환경변수](https://vercel.com/docs/environment-variables/system-environment-variables), [Node 버전 우선순위](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Supabase migration 이력](https://supabase.com/docs/guides/deployment/database-migrations).
