# 수업 원본 학습 검수 — 2026-09-17

대상: `codex/classroom-release-20260917`, draft PR #1321 후속.
사용자 승인: 개인 사본 없이 단어 저장 + 뜻 수정 전달 + 검수.
후속 사용자 승인(“ㄱㄱ 자동화”): 준비한 SQL 한 건의 운영 DB 적용 및 자동 검수. 환경/merge/alias 변경은 제외.

## 검수 방법

- Node 24, Vitest, 실제 Next production build.
- 독립 PGlite PostgreSQL에 기존 문맥 저장 migration과 신규 migration을 그대로 실행한다. authenticated/service_role을 분리하고 실제 RLS를 켠다.
- 교사 React UI가 실제 수업 SQL로 작성한 자료를 같은 DB의 별도 학생 계정으로 연다. 인증 계정과 HTTP transport만 합성 fixture이며 개인 계정·교재·외부 AI 호출은 없다.
- Chromium 데스크톱/390px, WebKit 터치. 실제 화면 캡처와 가로 넘침 검사.

## 확인 항목

- 기본 열기에서 개인 자료 행 생성 0; 원본의 뜻·발음 확인.
- 네 저장 등급의 정본 FSRS 계산 재사용; 신규 단어·문맥·초기 상태 원자적 저장.
- 재시도/중복 저장 시 기존 SRS 불변.
- 개인 단어 문맥 → 복습 카드 → 새 탭의 수업 원문 선택 복귀.
- 교사 후속 뜻 수정: 메타데이터+dictionary 일치, 학생 원본 재열람 반영.
- 다른 뜻 충돌, 낡은 자료 revision, 잘못된 팀·자료·암호 세대 차단.
- 원본/교사 설명판/Storage 비공개 유지, 학생 교사 수정 RPC 거부.
- 교사 원본 삭제 후 개인 단어·발췌 유지, 원본 재접근 차단.
- 선택적 사본 갱신: 학생 교정 유지, 예전 메타데이터 전용 수정의 반복 알림 방지.
- 기존 textbook/reading/pdf 문맥 저장 호환.

## 결과

실행 커밋 `1a21318fecd8a3362ceb153a71c3f5b77b14c633`. 구현·로컬 검수·Preview 배포·승인된 SQL 운영 적용 완료. 실제 사용자 로그인과 물리 기기 검수는 별도다.

### 자동 검사와 적용 전 DB 대조

- Vitest: 419 files, **4,510 PASS / 1 SKIP**.
- 독립 SQL/RLS 시나리오 7개 PASS (`node e2e/classroom-direct-sql.mjs`). 새 저장/재시도/뜻 충돌/교차 계정/암호 세대/원본 삭제/기존 세 종류 저장을 실제 PostgreSQL로 확인.
- 운영 스키마 **읽기 전용** 확인: vocabulary_contexts의 kind/출처 제약조건 이름·정의, user_vocabulary SRS 컬럼 타입 일치.
- 적용 전 `save_vocabulary_context` 본문 MD5 `a31150064cf6db9288565e0c65844725`가 저장소의 기존 migration과 일치. 이 사전 확인에서는 운영 적용이나 개인 행 조회를 하지 않았다.
- 적용 전 역할 권한 조회: service_role의 원본 SELECT/UPDATE 및 개인 단어 SELECT/INSERT/UPDATE, authenticated의 기존 문맥 SELECT/INSERT가 모두 존재했다. 신규 함수는 없었다.
- 화면 검사에서 Next 경로 매개변수의 `local%3A` 인코딩이 기존 개인 자료 조회로 떨어지는 문제를 발견해 canonical ID 처리와 서버 metadata 분기를 함께 수정했다.
- 기기 캐시 용량 부족은 온라인 원본 읽기의 실패 조건으로 삼지 않는다.
- 변경 소스28개 JS/JSX lint(`--ext .js,.jsx`), diff check 통과. Next production build **480 정적 페이지** 완료. 기존 lessonAdapters/lessonModel의 익명 export 경고2개 유지.

### 실제 화면·교사/학생 연결

- Chromium: **30흐름 PASS / 실행 오류0**, `/private/tmp/manabi-direct-complete-chromium/report.json`.
- WebKit 터치: **30흐름 PASS / 실행 오류0**, `/private/tmp/manabi-direct-verified-webkit/report.json`.
- 교사가 작성한 같은 독립 PostgreSQL 자료를 별도 학생 브라우저 context/계정으로 읽는다. 신규 단어의 알맞음 등급·문맥 저장을 실제 SQL로 확인하고, 같은 문맥을 재저장해도 단어 행/SRS 전체가 동일함을 비교한다. 개인 자료 행은 끝까지0.
- 실제 플래시 복습 카드에서 답 확인 → 수업 출처를 새 탭으로 열기 → 원래 표현 강조 → 뜻 창 확인. 복습 탭은 유지한다.
- 교사 뜻을 실제 CAS 저장으로 변경한 후 원문 재열람에서 새 뜻 확인. 낡은 revision과 기존 개인 뜻 불일치는409, 명시적 같은 뜻 확인 후 문맥만 추가하며 학생 단어 행은 불변.
- 개인 사본의 변경 안내/직접 수정 보존/예전 metadata-only 수정의 두 차례 갱신은 단위·SQL 검사로 확인했다. 이번 화면 검사의 기본 읽기 동선은 개인 사본을 만들지 않는다.
- 데스크톱1024px/학생 모바일390px 실제 캡처 확인, 문서 가로 넘침0. 교사 설명판은 태블릿 가로/세로·휴대전화 기존 검사도 함께 통과했다.
- 검수 중 발견한 `local%3A` 경로 문제는 앱에서 수정했다. 복습 방식은 정답 직후 진행하는 자동 퀴즈 대신 실제 플래시 옵션을 선택했다. WebKit 검사에서 출처 강조 완료 전 클릭하던 순서, 고의 오프라인 전 미완료 분석은 검수 대기를 바로잡아 재검사했다. 실패 결과를 숨기거나 일반 실행 오류를 무시하지 않았다.

### 한계·남은 단계

- 합성 인증/HTTP transport와 실제 로컬 SQL/RLS의 검사이며, 운영 로그인·원격 Auth·실제 Gemini·물리 iPad/Pencil 검수로 세지 않는다. 사용자 외출 중 로그인 요청 없음.
- SQL `20260917023410_classroom_direct_vocabulary.sql`은 후속 승인으로 운영 적용했다. 아래 실제 DB 검수와 별도로, 사용자 로그인 후 브라우저→원격 Auth→실제 저장 확인은 아직 수행하지 않았다.
- 운영 웹 병합·승격·고정 alias·영구 환경 변수는 이번 실행에서 변경하지 않았다.

### 원격 인계

- 같은 공개 draft [PR #1321](https://github.com/wonchance-art/manabi/pull/1321)에 실행 커밋 push 완료.
- [후속 Preview](https://manabi-2rgzutmdd-wonchance-arts-projects.vercel.app/class), deployment `dpl_3AAYnSwhEZ3znijcy9k98yrjVFCV`: READY, `/api/version` 실행 커밋/ref/preview 일치. DB 적용 후에도 API GET/POST 비로그인401·private no-store 유지.
- 배포 클라이언트 Chromium/WebKit 학생 흐름 각6개 PASS/실행 오류0/정상 종료. 인증/HTTP transport는 합성이며 독립 DB를 사용했다. 첫 Chromium 검사기 종료 지연은 중단 후 단독 재실행해 정상 종료를 확인했다.
- 기존 최종 head `c0c53479a57e973a6c8ad48a44e3a080625f092f`의 [CI35177593275](https://github.com/wonchance-art/manabi/actions/runs/35177593275) 두 job SUCCESS. 후속은 DB 검수 SQL·문서·자기 보드만 추가하며 앱 실행 코드와 migration 본문은 같다.
- 별도 검수 화면 모음은 로컬 `classroom-direct-study-20260917/index.html`에 두었다. 모두 합성 자료이며 개인 계정 화면은 없다.

### 승인된 운영 DB 활성화 · 2026-09-17 KST

- 적용 직전 원격/로컬 migration 이력을 전체 대조: 로컬 누락0, 미적용 **20260917023410 한 건**. SQL SHA-256 `bf38f3e414fe3f44781b727846068c1da2ff0b3cc8d75c0de2eb95f4106179e6`.
- 기존 자동 배포 workflow [35178677108](https://github.com/wonchance-art/manabi/actions/runs/35178677108)를 승인된 head c0c53479에서 실행. `Link & db push` SUCCESS, 미설정 skip 아님. 원격 schema_migrations에 같은 버전 등록 확인.
- 새 service-only 함수는 anon/authenticated EXECUTE 불가, service_role만 허용. 세 저장 함수 모두 SECURITY INVOKER·빈 search_path, 관련 세 테이블 RLS 유지, class 발췌 SELECT는 본인 단어 소유자만 가능.
- 재실행 가능한 검수: `supabase/verification/classroom_direct_vocabulary.sql`. 실제 운영 DB에 합성 사용자3명·원본/개인 자료·단어·문맥·PDF 메타데이터를 **예외 하위 트랜잭션 안에서만** 만든다. 외부 Auth 가입/메일/Storage 파일 생성은 없다. 모든 검수 후 의도적 예외로 전체 롤백하고 잔존0을 assert한다.
- 운영 DB 7시나리오 PASS: 단어/문맥/초기 등급 원자 저장, 재시도/SRS 불변, 교사 원본·교차 계정 RLS/직접 쓰기 거부, 원문 변경/뜻 충돌/명시적 확인, 암호 세대·외부 자료 거부, 기존 textbook/reading/PDF RPC 호환, 원본 삭제 후 개인 단어·발췌 보존.
- 합성 auth/profiles/materials/vocabulary/contexts/PDF 메타데이터 잔존 **0**, 기존 개인 행 수정 **0**. 첫 검수의 PL/pgSQL 변수 `kind` 모호성을 검수 스크립트에서만 고친 뒤 재실행했다. 실패한 첫 실행도 트랜잭션 전체 롤백이며 migration 수정은 없다.
- 보안 advisor에 이번 변경 함수/테이블 관련 지적0. 전체 프로젝트의 기존 권고는 별개이며 이번 범위에서 권한을 임의로 바꾸지 않았다: [RLS 정책 없는 테이블](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [기존 함수 search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anon의 기존 DEFINER 호출](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated의 기존 DEFINER 호출](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). 기존 함수의 내부 인가를 확인하지 않고 advisor 표시만으로 실제 권한 우회를 단정하지 않는다.
