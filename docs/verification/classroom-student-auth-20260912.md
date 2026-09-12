# 학생 수업 로그인 복귀 검수 — 2026-09-12 KST

## 문제와 수정

기존 Preview10851b15의 로그아웃 상태에서 `/class/<team>` 상단 `로그인`을 누르면 `/auth`로 이동해 수업 주소를 잃었다. 이후 로그인은 `/home`으로 끝나므로 학생이 수업으로 다시 찾아와야 했다.

공통 로그인 버튼이 현재 경로·쿼리·본문 앵커를 기존 안전한 리다이렉트 검사에 통과시켜 `from`으로 전달하도록 수정했다. 로그인 화면에서 버튼을 다시 눌러도 기존 목적지를 유지하며, 인증 페이지끼리 돌아가는 중첩과 외부 주소는 `/home`으로 정리한다. 이메일 로그인 및 Google PKCE 콜백 정본은 재사용한다. 교재 내용·개인 사본·복습 일정·권한·DB·환경 설정을 변경하지 않는다.

실행 커밋: `3aad2ba2d15c339311cf1c9a3a70e42bb24e38a2`. 공개 draft PR #1302의 승인된 검수 수정 범위에 포함한다. `public/sw.js`는 표준 prebuild가 만든 캐시 지문 변경이다.

## 로컬 검증

- 전체 Vitest383파일/4,160개 PASS. 새 로그인 진입 검사는15개이며 기존 리다이렉트23개와 함께38개 PASS.
- 운영 형태 빌드, 정상 prebuild, 변경 JS/명시적 JSX lint PASS. prebuild의 기존 curriculum 경고11개는 유지된다.
- Chromium/WebKit 각각1440px·390px에서 로그인 진입 → 재클릭 → Google PKCE 목적지 확인 → 이메일 로그인 후 원래 수업 URL 복귀, 각6개/총12개 PASS. 페이지 실행 오류0, 가로 넘침0. 키보드 Enter로 공통 로그인에 진입했다.
- 재현 스크립트: `e2e/auth-entry.e2e.mjs`. 인증·프로필·API는 브라우저에서 격리하며 테스트 세션이 Preview 서버에 전송되지 않도록 요청 쿠키를 제거한다. 실제 계정 또는 실제 DB를 통과한 검사로 세지 않는다.
- 로컬 로그: `/private/tmp/manabi-auth-entry-tests.log`, `manabi-auth-entry-build.log`, `manabi-auth-entry-prebuild.log`. 브라우저 결과: `/private/tmp/manabi-auth-entry-{chromium,webkit}/report.json` 및 화면 캡처.
- 기존 `auth-return.e2e.mjs`의 Google/복구 메일/비밀번호 재설정 폼/콜백 실패7개·6레이아웃도 PASS, 실행 오류0. 최초 `127.0.0.1` 실행은 Next 로컬 서버가 콜백 origin을 `localhost`로 반환해 동일-origin 비교에서 실패했다. 서버의 로컬 호스트에 맞춰 `QA_BASE=http://localhost:3100`으로 다시 실행해 통과했고 제품 코드나 테스트 기준을 바꾸지 않았다. 결과 `/private/tmp/manabi-auth-entry-existing-localhost/report.json`; 이 로컬 재실행을 실제 배포 콜백 검증으로 대체하지 않는다.
- 기존 학생 사본/명시적 갱신/로그인 후 표현 저장 `class-copy.e2e.mjs`10개도 PASS. 사본 ID 재사용, 개인 수정과 token ID 보존, 사본 조회 실패 때 중복 생성 방지, 저장 부분 성공/재시도, FSRS 초기화 없이 정확한 단어 복귀를 PGlite/가상 계정으로 확인했다. 이 스크립트는 Chromium 전용이며 `QA_BROWSER=webkit`을 지정한 추가 실행도 Chromium으로 실행됐으므로 WebKit 결과로 세지 않는다.
- 위 캡처를 시각 검수하면서 학생 계정 fixture의 프로필이 `admin`으로 지정된 문제를 발견했다. `student`/중국어 프로필로 교정하고 프로필 로딩 완료 후 상단 관리·수업 메뉴가 없음을 추가 검증했다. 교정 후11개 전체 PASS/오류0. 이는 테스트 조건 보완이며 실제 사용자 역할이나 권한을 변경한 것이 아니다. 최종 사본 검수 결과는 `/private/tmp/manabi-auth-entry-copy-student/report.json`이다.
- 실행 커밋의 [GitHub CI34659538607](https://github.com/wonchance-art/manabi/actions/runs/34659538607) 전체 SUCCESS: lint/콘텐츠/vitest와 빌드/typography/chrome/smoke/learning-flow.

## 실제 계정 검수의 경계

이전 실제 교사 검수는 `classroom-tablet-20260911.md`에 기록돼 있다. 별도 학생 계정 확인은 아직 미완료다. Comet 로그인 완료 회신 후 자동화가 창 제목만 제공하고 본문·화면을 가져오지 못했다. 사용자 요청으로 Codex 인앱 브라우저에 학생 로그인 화면을 열었다. Codex 탭은 세션을 공유하므로 기존 교사 계정에서 로그아웃했다.

저장소의 `QA_LOGIN=1` 절차는 합성 계정/인증 응답을 사용한다. 해당 절차를 실제 학생 로그인으로 간주하지 않는다. 실제 학생 계정 자동 로그인 절차는 저장소 문서와 e2e 스크립트에서 찾지 못했다. 환경 파일·계정 비밀번호·쿠키·토큰은 열람하지 않았다.

실제 학생의 팀 암호 입장, 대표 개인 사본 생성/재사용, 단어 뜻·독음 열기, 수업으로 복귀, 기존 자료/복습 보존은 로그인 이후 확인할 항목으로 남긴다. 물리 iPad·중국어 입력기·회전·교실 네트워크 검수도 별도다. 이번 수정은 운영 병합 완료를 의미하지 않으며 merge·force-push는 하지 않는다.

## Preview 빌드 복구

첫 배포 `dpl_7HPut9cQpGGyJrwARq59LDD4MSbp`(3aad2ba2)는 컴파일 단계에서 실패했다. Vercel 메타데이터의 `errorCode=out_of_memory`, 빌드 로그의 worker `SIGKILL`을 확인했다. 이 실패를 로그인 기능 오류 또는 정상 배포로 보고하지 않는다. 기존 Preview10851b15와 운영 주소는 유지된다.

기존 `webpackMemoryOptimizations`를 유지하며 생산 빌드의 Webpack 캐시를 끄고 `webpackBuildWorker`를 명시적으로 켰다. 캐시 보관/직렬화 메모리를 줄이기 위한 조치이며 캐시 재사용에 따른 빌드 시간 이점과 교환한다. 개발 서버 캐시·서비스워커/브라우저 캐시·사용자 데이터에는 적용하지 않는다. 프로젝트 환경 변수나 요금제를 변경하지 않았다. [Next.js 공식 메모리 지침](https://nextjs.org/docs/app/guides/memory-usage)의 캐시/빌드 워커 지침을 참고했으며 정확한 절감량은 같은 환경에서 비교 실측하지 않았다.

캐시를 끈 첫 로컬 빌드는 기본2GB V8 heap 한도에서 `Reached heap limit`/SIGABRT로 종료됐다. 이는 원격의 컨테이너 OOM/SIGKILL과 구분한다. 기존 로컬 검수 선례와 같이 빌드 프로세스에만 `NODE_OPTIONS=--max-old-space-size=4096`을 지정해 다시 검사한다. 기본2GB에서 통과했다고 기록하지 않는다.

4GB 한도의 캐시 없는 로컬 빌드는 종료0, 전체 Vitest383파일/4,160개·정상 prebuild·변경 파일 lint도 다시 PASS했다. 복구 실행 커밋은 `8b6f3d7b2dc4b45cf2c45891bb3fa4a0e5daedd1`이다. Vercel 재배포에도 이번 빌드의 `--build-env NODE_OPTIONS=--max-old-space-size=4096`만 지정했다. 영속 프로젝트 환경 변수와 배포된 함수의 런타임 환경은 바꾸지 않는다. 로그 `/private/tmp/manabi-auth-entry-memory-build-4096.log`, `/private/tmp/manabi-auth-entry-final-tests.log`.

## 최종 배포 결과

- [최종 Preview](https://manabi-fz4zms59q-wonchance-arts-projects.vercel.app/class/culcom2): `dpl_E3quHTgNPQUpZTxEvJkkRBC7myYh`, READY. 빌드 약4분34초. `/api/version`의 commit8b6f3d7b·releaseId `web-v2-8b6f3d7b2dc4`·판본 `7f572327dc67893e9453246c` 일치.
- 실행 커밋의 [CI34660470245](https://github.com/wonchance-art/manabi/actions/runs/34660470245) 두 job 전체 SUCCESS. 이전 실패 배포와 구분한다.
- 최종 배포 자동 검수37개 PASS/오류0: Chromium 로그인6, WebKit 로그인6, 기존 인증/복구7, 일반 학생 사본·저장11, WebKit 터치 수업 돌아보기7. 결과 `/private/tmp/manabi-auth-entry-deployed-{chrome,webkit,recovery,student,history}/report.json`.
- 인증/DB는 격리됐으며 실제 배포의 화면·번들 및 코드 없는 실패 콜백을 확인했다. 실제 Google 인증 완료나 실제 학생 계정/운영 DB 쓰기로 세지 않는다.
- Codex 인앱 브라우저에서도 실제 `/class/culcom2`의 상단 로그인 클릭이 `/auth?from=%2Fclass%2Fculcom2`로 이동함을 직접 확인하고 화면을 열어두었다. 실제 교재/사본/단어/복습에 이번 검수 데이터를 쓰지 않았다.
- 이 결과 문서와 보드만 추가하는 후속 커밋은 배포 번들을 바꾸지 않는다. 운영/고정 alias·DB·merge·force-push 변경 없음. 실제 학생 및 물리 기기 항목은 위 미완료 상태를 유지한다.
