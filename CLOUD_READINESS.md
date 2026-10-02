# Manabi — Codex Cloud 실행 안내

기준: main `9a8d2b331ec2e5232d5bf274a5c2d9b293037dec`, 2026-10-02 KST.
제품 결정/보존 계약은 `PROJECT_CONTEXT.md`, 작업 규약은 `AGENTS.md`·`CLAUDE.md`를 따른다.
이 준비는 운영 배포·DB 적용·월드 자산 재생성을 실행하지 않는다.

## 실행 구조

단일 npm 프로젝트다. Next.js 15 App Router(`src/app`)가 React 19 화면·서버 API를 함께 실행하며,
`src/views`/`src/components`에 학습 UI와 Phaser 월드가 있다. `src/lib`의 FSRS/사전/학습 로직,
`src/content`의 교재와 불변 발행 판본, `public`의 정적 자산/PWA를 재사용한다.
저장은 Supabase Auth/Postgres/RLS/Storage/Realtime에 연결한다. 별도 Python 서버나 로컬 DB는 없다.
`package-lock.json`이 실제 의존성 버전을 고정하며 이번 준비에서 패키지/lockfile 버전을 변경하지 않았다.

## 빠른 시작: fresh checkout

Node **24**와 npm, Git이 필요하다. `.nvmrc`는 검수한 공식 Node **24.19.0**이다.
환경에 nvm이 있으면 리포 루트에서 `nvm install && nvm use`를 먼저 실행한다.
Node 22는 별도 world 저작/검증 계약이며 앱의 `engines: 24.x`를 대체하지 않는다.

```sh
npm run setup:cloud
npm run verify:cloud
```

- 설치: `npm ci --include=dev --no-audit --no-fund` → PDF worker 준비 → lockfile의 Playwright CLI로 Chromium 설치.
  Linux에서는 `install --with-deps chromium`이 OS 패키지도 설치한다. apt/sudo 권한과 다운로드 네트워크가 필요하다.
- 검증: ESLint → world 제외 Vitest → 격리 PostgreSQL(PGlite) 계약 3개 → 기존 prebuild 포함 Next build →
  typography/viewer chrome/smoke/learning-flow → CI의 서재·과 추가·읽기/단어 브라우저 스위트.
  오류가 나면 즉시 실패하며 무거운 검사와 build를 동시에 돌리지 않는다.
- 실제 API 키·계정·DB·Vercel CLI 없이 실행된다. `.env.local`도 필요 없다.
  모든 `*:cloud` **앱/검증** 명령은 공개 테스트 Supabase 값·기존 Google 폰트 fixture를 강제하고
  관련 서비스 키를 비운다. 실제 서버 저장/로그인이나 원래 폰트의 검수 결과로 계산하지 않는다.
- 브라우저 설치 권한/네트워크가 없는 환경은 명시적으로 축소한다. 브라우저 검수 생략이 결과에 표시된다.

```sh
npm run setup:cloud -- --no-browser
npm run verify:cloud -- --no-browser
```

## 실행 명령

```sh
npm run dev:cloud       # fixture 폰트·공개 테스트 값, 0.0.0.0:3100, 로그인/DB 저장 불가
# 또는 verify:cloud의 build 결과를 실행
npm run start:cloud     # build:cloud 표식이 있는 .next만 허용, 0.0.0.0:3100
```

`dev:cloud`는 오프라인 데이터 모의 서버를 제공하지 않는다. 공개 화면/컴파일 확인용이고,
인증·서재·DB API는 개발용 서비스 연결 또는 검증 스위트의 fixture가 있어야 작동한다.
`start:cloud` 전용 빌드가 없으면 `npm run build:cloud`를 실행한다.
Codex 환경의 서비스 미리보기/포트 연결 기능에서 3100을 연다.

실제 개발용 서비스와 원래 Google 폰트를 확인하려면 일반 명령을 사용한다.

```sh
cp .env.example .env.local  # 개발용 값만 직접 채운다. Cloud에서는 UI 변수로 주입해도 된다.
npm run dev -- --hostname 0.0.0.0 --port 3000
# 실제 환경으로 production 형태를 확인할 때
NODE_OPTIONS=--max-old-space-size=4096 npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

`NEXT_PUBLIC_*`는 **build 전에** 설정해야 한다. `next start`에서만 바꾸면 브라우저 번들이 바뀌지 않는다.
fixture `.next`는 배포하지 않는다. 일반 build를 다시 수행해야 실제 폰트/서비스 값이 반영된다.
build/prebuild는 `public/sw.js`의 콘텐츠 캐시 버전을 갱신하고 PDF worker를 복사한다.
이 두 추적 파일의 차이는 push 전 확인한다. 기존 published edition 파일을 제거하거나 다시 만들지 않는다.

## 개별 검사

| 명령 | 내용/추가 조건 |
| --- | --- |
| `npm run lint` | JavaScript/JSX·React/Next ESLint |
| `npm test` | 일상 Vitest, world 제외 |
| `npm run test:sql` | 과 추가·기존 제외·known-word SQL; PGlite의 격리 인메모리 DB, 운영 연결 없음 |
| `npm run build:cloud` | prebuild 콘텐츠/읽기/커리큘럼·world 자산 검사 + fixture 폰트 Next build |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | 실제 환경 Next build; Google Fonts 네트워크 필요 |
| `npm run e2e:typography`, `e2e:chrome`, `e2e`, `e2e:learning` | 설치된 Chromium; 앱 테스트는 fixture build를 먼저 수행 |
| `npm run test:world` | 별도 world-data와 Node 22 계약, 아래 제한 참고 |
| `npm run test:all` | world 포함; fresh clone 기본 게이트로 사용하지 않는다 |

별도의 `typecheck` 스크립트/TypeScript 소스/tsconfig는 현재 없다. 없는 `tsc` 검사를 통과했다고
표시하지 않는다. JS/JSX ESLint와 Next build의 기존 검사 단계가 현재 제공하는 정적 검사다.
`build:cloud`/`verify:cloud`는 기존 게이트를 생략하거나 `ignoreBuildErrors`를 추가하지 않는다.

## 환경변수와 외부 서비스

`.env.example`은 공개 fixture 값 외에 모두 빈 값이다. 실제 secret을 커밋하지 않는다.
아래 항목은 **실제 서비스 기능을 사용할 때만** 설정한다. 기본 Cloud 검증에는 전부 불필요하다.
현재 코드의 `ANON_KEY`/`SERVICE_ROLE_KEY` 변수명은 유지했다. Supabase의 새 키 체계 전환은
[공식 API 키 안내](https://supabase.com/docs/guides/getting-started/api-keys)에 따라 별도 검수한다.

| 변수 | 용도/직접 입력할 값 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **개발용** Supabase 프로젝트 HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 그 프로젝트의 클라이언트 anon 키; public 번들에 포함됨 |
| `NEXT_PUBLIC_SITE_URL` | 사용자에게 보이는 개발 앱 URL(로컬은 `http://localhost:3000`); OAuth/메일 redirect와 일치 |
| `GEMINI_API_KEY` | AI 설명·생성·TTS, 개발용 Google API 키 |
| `GROQ_API_KEY` | 선택 LLM 폴백; Gemini TTS를 대체하지 않음 |
| `SUPADATA_API_KEY` | 선택 YouTube 자막 폴백 |
| `QIITA_TOKEN` | 선택 콘텐츠 소스 인증 |
| `SUPABASE_SERVICE_ROLE_KEY` | cron/릴레이 등 제한된 서버 작업만; 일반 학습 UI/Cloud 검증에는 설정하지 않음 |
| `CRON_SECRET` | 선택 cron Bearer 토큰, 미설정 시 거부 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 선택 Web Push 키 쌍과 연락처 URI |
| `MANABI_AI_RELAY_CLAUDE_TOKEN`, `MANABI_AI_RELAY_CODEX_TOKEN` | 선택 서버 릴레이의 서로 다른 32자 이상 난수 |
| `MANABI_AI_RELAY_URL`, `MANABI_AI_RELAY_TOKEN` | 선택 CLI 릴레이 주소와 자기 에이전트 토큰; Node CLI는 .env를 자동 로드하지 않음 |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SRC` | 선택 분석 도메인/스크립트; 미설정 권장 |
| `NEXT_PUBLIC_SENTRY_DSN` | 현재 코드에서는 연결 주석만 있음; 설정해도 Sentry 기능 검수가 되지 않음 |
| `LLM_LOG` | 선택 LLM 진단(`on`); 기본 미설정 |

플랫폼이 주는 `VERCEL*`, 빌드 도구가 만드는 `NEXT_PUBLIC_BUILD_*`/`MANABI_BUILD_IDENTITY`,
릴리스 도구의 `MANABI_RELEASE_*`는 일반 Cloud 설치 설정이 아니다.
`PLAYWRIGHT_*`는 브라우저/포트 선택용이며 `PLAYWRIGHT_EXECUTABLE_PATH`나
`PLAYWRIGHT_BROWSER_CHANNEL=chrome`을 지정하면 기본 설치 Chromium보다 우선한다.
`COMPOSER_*`, `E2E_PUBLISHED_EDITION`은 verify 스크립트가 상대 위치에서 계산/주입한다.
개별 QA의 `QA_*`, corpus 진단의 `JA_*`/`ZH_*`, `UPDATE_*`는 해당 도구의 선택 입력이다.
`CLAUDE_SCRATCH`는 읽기 검사 임시 출력 위치 override이며 없으면 리포 내부 기본 경로를 사용한다.

| 외부 서비스/네트워크 | 필요한 경우 |
| --- | --- |
| `registry.npmjs.org` | lockfile 의존성 설치(Next/React/Supabase SDK/Phaser/FSRS/사전/WASM/PGlite 등) |
| `cdn.playwright.dev`, `playwright.download.prss.microsoft.com` | Chromium 다운로드와 redirect 대상; Linux OS 의존성은 배포판 apt 저장소도 필요 |
| `fonts.googleapis.com`, `fonts.gstatic.com` | 일반 build/dev의 Google Fonts. fixture build에서는 호출하지 않음 |
| 개발 Supabase 프로젝트 호스트 | 실제 Auth/PostgREST/Storage/Realtime; OAuth 공급자/redirect 설정 필요 |
| `generativelanguage.googleapis.com`, `api.groq.com`, `api.supadata.ai` | 해당 선택 AI/자막 기능 |
| YouTube·Qiita·선택 콘텐츠 소스 | 외부 자료 가져오기; 소스별 인증/할당량/접근 정책 별도 |
| GitHub `world-data` 브랜치 | optional 도시 snapshot 회귀검사. 기본 앱 build/런타임은 참조하지 않음 |

실제 학습 기능에는 개발용 Supabase의 스키마/RLS·필요한 `docs/sql` 보완·Storage bucket·Auth
설정도 맞아야 한다. `docs/deployment-checklist.md`와 기능별 검수 기록을 대조한다.
Cloud setup은 프로젝트 생성·마이그레이션 적용·운영 데이터 복사를 수행하지 않는다.

## Codex Cloud 설정 화면에 입력할 항목

현재 UI의 Install script / Start skill / Environment variables / Network secrets 명칭은
[공식 Cloud environments 안내](https://learn.chatgpt.com/docs/environments/cloud-environments)를 확인했다.
기존 Legacy 환경의 Setup script 항목을 사용하는 경우에도 설치 명령은 같다.

| 설정 | 입력 |
| --- | --- |
| Repository | `wonchance-art/manabi`; 이 준비 변경을 push한 브랜치/병합된 main 선택 |
| Runtime 설정/생성 대화 요청 | Node `24` (검수 버전 `24.19.0`), npm; Git 필요 |
| Install script (Legacy: Setup script) | `npm run setup:cloud` |
| 검증 요청/명령 | `npm run verify:cloud` |
| Start skill | “리포 루트에서 `npm run dev:cloud`를 실행하고 포트 3100의 `/manifest.webmanifest`가 HTTP 200인지 확인한다. 실제 로그인/저장은 fixture로 검증했다고 주장하지 않는다.” |
| 필수 Environment variables / Secrets | 기본 install/verify/fixture 실행은 **없음** |
| Internet / allowed domains | 설치는 package managers + 위 Chromium 다운로드 호스트/OS 패키지 저장소. 실제 폰트 검수는 Google Fonts 두 호스트 추가 |
| 실제 서비스 개발 변수 | 필요할 때 위 Supabase 공개 변수 3개와 해당 기능의 개발용 키만 입력 |

환경변수는 프로세스에 직접 전달되고 Network secret은 허용 HTTPS 목적지에서 proxy가 대체한다.
API로 전송하는 키와 로컬 암호 연산이 필요한 VAPID private key는 전달 요구가 다르므로
해당 [공식 설정 안내](https://learn.chatgpt.com/docs/environments/cloud-environments)를 따르고,
production secret을 전체 복사하지 않는다. `NEXT_PUBLIC_*`에는 서버 비밀키를 넣지 않는다.
의존성/브라우저 설치를 테스트한 뒤 환경을 Publish/Republish하고 **새 task**에서 위 두 명령을 확인한다.
네트워크 제한이 있는 agent 단계에는 필요한 파일을 설치 단계에서 준비한다.

## 로컬 의존성 점검 결과와 알려진 한계

- 앱 코드는 repo-relative import/file URL로 동작한다. iCloud, `/Users/...`, `/private/tmp/manabi-*`,
  로컬 `.codex` skill·QA closeout은 앱 런타임/기본 검증에 필요하지 않다.
- 공통 Playwright 설정의 `/opt/pw-browsers/chromium` 및 글로벌 Chrome 기본값을 제거했다.
  CI도 lockfile Chromium을 설치한다. 별도 운영/설계 QA 도구에는 아직 macOS Chrome
  `/Applications/Google Chrome.app/...`·`/private/tmp/...`가 있다. 예: `e2e/auth-*.e2e.mjs`,
  `class*.e2e.mjs`, `teaching-*.e2e.mjs`, `n5-review-return`, `viewer-context-return`, `book-reading`,
  `reading-loop`, `study-notes`, `review-room`, `web-v2`, `release-version`.
  이 도구들은 표준 verify/CI 스위트에 포함하지 않는다. Cloud에서 별도로 쓸 때 각 `QA_*` override와
  로그인/서버 준비가 필요하며, override 없는 고정 경로 도구는 별도 이식이 필요하다.
  남은 경로를 확인하려면 `rg -n '/Applications/|/private/tmp/|/Users/|/opt/' e2e scripts src --glob '!*.json'`.
- 훈음 브라우저 검사의 기존 `.reader-hun` visible 대기는 이전 단어에도 즉시 성공했다.
  320px에서 이전 `俑`을 새 `T恤`의 훈음으로 읽은 실패와 단독 실행 통과를 확인했다.
  표제어만 기다리는 첫 보완도 카드의 다음 프레임 포커스 이동과 다음 Enter가 겹쳐 실패했다.
  DOM 진단으로 이전 카드에 포커스가 남고 선택 토큰이 바뀌지 않은 상태를 확인했다.
  현재 표제어 렌더와 카드 포커스 완료를 함께 기다리며 글자/훈음/기하/4칸 검증은 유지한다.
- 로컬 DB/Redis/백그라운드 서버는 앱 필수 의존성이 아니다. Supabase는 원격 서비스이고,
  SQL 검사는 npm으로 설치한 PGlite를 사용한다. `supabase/config.toml`은 CLI 최소 구성으로,
  완전한 로컬 Supabase/Auth/실사용 데이터 seed를 제공한다고 해석하지 않는다.
- npm scripts는 로컬 bin을 사용한다. Vercel/Supabase/gh CLI·Python·ffmpeg·Docker·Homebrew는
  기본 설치/검증/앱 실행에 불필요하다. 선택 `scripts/deploy-web-release.mjs`는 별도 Vercel CLI 로그인,
  CI migration workflow는 별도 Supabase 자격증명이 필요하다. 이 setup은 두 작업을 실행하지 않는다.
- `.env*`(example 제외), `.mcp.json`, `.vercel`, `.claude`, `.codex`, QA/auth 상태·cache·build·보고서·
  credential 파일을 ignore한다. 이미 추적된 파일은 ignore만으로 제외되지 않으므로 staged diff를 점검한다.
- world 스냅샷은 기본 clone에서 제외돼 있다. 필요하면 **깨끗한 별도 작업 공간**에서
  `npm run world:fetch-data`로 복원하고 Node 22로 기존 world 검사를 한다. fetch는 Git ref/index를
  잠시 사용하므로 다른 staged 변경과 함께 실행하지 않는다. Cloud에서는 world/한자 자산을 재생성하지 않는다.
- React 19와 Excalidraw 하위 Radix의 기존 peer 경고 및 `sliced` deprecation 경고가 npm ci에 남는다.
  설치는 성공하며 이 작업에서 제품 의존성을 강제 교체하지 않았다.
- 빌드는 큰 콘텐츠/게임 묶음을 처리한다. 8 GiB 이상 메모리를 준비하고 build와 전체 검사를 순차 실행한다.
  `build:cloud`만 Node 힙 기본값을 4 GiB로 지정하며 명시된 `NODE_OPTIONS` 힙 값은 존중한다.
  Google Fonts 일반 build는 네트워크 제한/응답 실패로 중단될 수 있다. fixture 성공은 이 문제의 해결 증거가 아니다.
- fixture build의 일부 정적 페이지는 테스트 Supabase 호스트 조회 실패를 로그에 남긴 뒤 기존
  정적 콘텐츠 fallback으로 생성된다. 빌드는 통과했지만 실제 DB 자료/권한 검수는 아니다.
  폰트 fixture가 모든 외부 데이터 호출까지 모의 응답으로 바꾸는 것은 아니다.

## 변경 파일과 push 전 확인

| 파일 | 변경 이유 |
| --- | --- |
| `PROJECT_CONTEXT.md`, `CLOUD_READINESS.md` | 제품 결정/보존 계약과 설치·서비스·검증/한계를 이식 가능한 문서로 저장 |
| `.nvmrc`, `package.json`, `scripts/cloud/{runtime.mjs,runtime.test.js,setup.mjs,app.mjs,verify.mjs}` | Node 24·lockfile 설치, credential 격리, 빌드 메모리, 순차 검증/실행 |
| `.env.example`, `.gitignore` | 실제 키 없는 템플릿과 인증 상태·cache·build·로컬 파일 제외 |
| `playwright.config.mjs`, `.github/workflows/ci.yml` | 설치된 lockfile Chromium과 빌드 힙 설정으로 로컬/CI/Cloud 차이 축소 |
| `e2e/viewer-hun-layout.e2e.mjs` | 이전 카드 포커스 이동과 다음 Enter가 겹치는 검사 동기화 오류 보완 |
| `README.md`, `AGENTS.md`, `CLAUDE.md` | 실제 Node 24/Cloud 명령 안내, world Node 22·시크릿 보호 계약 유지 |

변경은 별도 `codex/cloud-readiness-20261002` 작업 공간에 있다. 기존 iCloud checkout의 다른
세션 변경을 옮기지 않았다. commit/push/PR/배포는 실행하지 않았다.
push 전 이 브랜치의 새 파일을 포함한 diff, `.env.example`의 빈 값/fixture, 생성된
`public/sw.js`·PDF worker 차이, `package-lock.json`과 공개 판본의 불변을 확인한다.
실제 Cloud Publish 후 fresh task의 Linux 설치·브라우저 OS 패키지/네트워크 확인은 별도다.

## 이번 검증 기록

최신 main 기준의 격리 macOS arm64 작업 공간, RAM 8 GiB, Node 24.19.0 / npm 10.9.3에서 확인했다.
실제 `.env.local`을 가져오지 않았으며 호스트 `NODE_ENV=production`에서도 설치/검증을 실행했다.

| 실행 | 실제 결과 |
| --- | --- |
| `npm run setup:cloud` | PASS; `npm ci` 680개 설치 및 lockfile Chromium 준비. 브라우저 바이너리는 로컬 캐시 사용 |
| `npm run verify:cloud` | **exit 0**, 전체 순차 명령 완료 |
| ESLint | 오류 0, 기존 `lessonAdapters.js`/`lessonModel.js` 경고 2 |
| Vitest | 420 파일 / 4,400 검사 PASS; world 컴포넌트 전용 스위트 제외 |
| PGlite SQL | 과 추가/충돌/권한/기록 보존 계약 PASS, 제외 13 / known controls 15 PASS; 원격 DB 연결 없음 |
| prebuild / Next build | 기존 콘텐츠·읽기·world 자산 게이트 PASS, 커리큘럼 기존 경고 11; Next 15.5.21 빌드 및 479 정적 페이지 생성 PASS |
| 브라우저 | typography 31, chrome 4, smoke 14, learning 9, 서재/뷰어 29 PASS; smoke의 기존 world 관련 6개 SKIP |
| 최종 `npm run start:cloud` | PASS; 3100에서 `/manifest.webmanifest`, `/api/version` HTTP 200. 확인 후 서버 종료 |
| Git/보존 | `git diff --check` PASS; lockfile·앱 소스·공개 판본/자산 불변. prebuild의 `public/sw.js` 캐시명 변경만 원복 |

최초 전체 실행은 Node 기본 힙(~2 GiB) 부족으로 build가 실패했다. build 전용 4 GiB 설정 뒤
빌드는 통과했다. 이어 전체 브라우저 검사에서 발견한 훈음/키보드 동기화 실패를 위와 같이
보완한 뒤 최종 **전체 명령을 처음부터 다시 실행**해 통과했다. 검사를 삭제하거나 성공으로 덮어쓰지 않았다.

로컬 ignored 로그는 `.qa/cloud/setup-final.log`, `verify-complete.log`, `start-final.log`에 있다.
실제 Codex Cloud VM/Linux apt·sudo 설치, GitHub CI 재실행, 원래 Google 폰트, 실계정·물리기기,
별도 world 스위트/재생성은 미실행이다. 운영 DB·환경변수·배포·발행도 실행하지 않았다.
다음 재개 지점은 사용자 push 후 Cloud 환경의 Publish/Republish와 fresh task의 동일 두 명령 검증이다.

### push 전 최종 점검 — 2026-10-02 KST

- Cloud 준비의 17개 파일 전체를 점검했다. 실제 credential 패턴/URL 인증값·개인 홈 경로가 없고,
  `.env.example`은 공개 fixture 3개와 빈 값만 포함한다. `PROJECT_CONTEXT.md`의 개인 절대경로는 제거했다.
- `verify:cloud`를 다시 실행해 exit 0: lint 오류 0(기존 경고 2), Vitest 420 파일/4,400 PASS,
  격리 SQL PASS, prebuild/479 정적 페이지 build PASS, 브라우저 87 PASS/기존 6 SKIP.
  독립 typecheck 명령/TypeScript 소스가 없는 상태와 실제 Cloud Linux 미검수 한계는 유지한다.
- 실행·설정 11개, 문서 5개, 훈음 E2E 1개를 한 Cloud 준비 변경으로 묶는다. staging은 이 17개만
  명시적으로 지정한다. 실제 `.env`/인증 상태, `.qa`·cache·`.next`·node_modules와 기존 다른 작업은 제외한다.
- prebuild의 캐시명만 실행 전 캡처한 파일과 비교해 일반 파일 쓰기로 복구했다. PDF worker·공개 판본·
  앱 소스·lockfile은 불변이다. reset/clean/checkout, commit/push, 히스토리 수정은 하지 않았다.
- 이번 재검수의 로컬 ignored 로그는 `.qa/cloud/prepush/verify.log`다.
