# 설명판 Safari 탐색 안정화 검수

2026-09-16 KST · PR #1319 동일 범위 후속. 실행 커밋 `70f493b8248f7964dbe5f6188a4fc3543a725931`.

## 원인과 수정

설명판 메뉴와 수업 뷰어의 복귀/오늘 학습 링크가 화면에 들어오면 Next.js가 홈·팀·학습 화면의 RSC를 미리 요청했다. 기존 원격 WebKit 진단에서 실제 페이지 교체와 겹친 요청은 `cancelled`, `next-router-prefetch=1`, `rsc=1`로 확인됐고 콘솔에 RSC 실패가 남았다.

해당 링크에 `prefetch={false}`를 적용했다. 클릭과 저장 처리, 링크 주소, 클라이언트 이동은 유지한다. 수업 상태가 준비되기 전 잠깐 표시되는 일반 뷰어 복귀 링크도 포함한다. 공유 내비게이션·DB·API·영구 환경 설정은 수정하지 않는다. Next.js 15 [Link 공식 문서](https://nextjs.org/docs/15/app/api-reference/components/link#prefetch)의 viewport/hover prefetch 제어를 사용했다.

E2E는 뷰어 안에서 발생한 홈·팀·학습 RSC prefetch를 세어 0이어야 통과한다. 기존 홈 prefetch 취소 예외는 제거했다. 오류를 무시하는 규칙은 추가하지 않았다. 의도적으로 생성하는 저장 실패·충돌은 기존 방식으로 구분한다.

## 수정 전 증거

- 기존 원격 Preview p4nl6jogi: 새 네트워크 검사를 적용해 19건의 불필요한 prefetch 관측. 26개 기능 조건 후 충돌본 메뉴 시간 초과로 중단되어 전체 통과로 집계하지 않았다. 진행률 요청 CORS 오류도 1건 기록했다. `/private/tmp/manabi-safari-prefetch-before/report.json`.
- 첫 로컬 수정: 32개 기능 조건 통과/콘솔 오류 0이지만 남은 팀 복귀 링크에서 prefetch 2건을 검출해 실패. 이 확인으로 전환 중 일반 복귀 링크까지 보완했다. `/private/tmp/manabi-safari-after-webkit/report.json`.

## 최종 검수

- 전체 Vitest 410파일/4,349개 통과. `/private/tmp/manabi-safari-final-vitest.log`.
- 변경 JS/JSX/E2E 명시 ESLint 및 diff 공백 검사 통과.
- 최종 production build 480페이지 통과. 로컬 공개 dummy 설정·기존 폰트 mock을 사용했고 해당 빌드/설정은 배포하지 않는다. 기존 lessonAdapters/lessonModel 기본 내보내기 경고 2개는 변경 범위 밖이다. `/private/tmp/manabi-safari-final-build.log`.
- 복귀 링크 최종 보완 뒤 관련 계약 5파일/70개 통과. `/private/tmp/manabi-safari-final-targeted.log`.
- 최종 로컬 Chromium/WebKit 터치 각 35조건 통과, RSC prefetch 0, 콘솔 오류 0. 링크 실제 클릭→홈/팀 홈→브라우저 뒤로가기→전체 페이지 보존까지 검증. `/private/tmp/manabi-safari-final-chromium/report.json`, `/private/tmp/manabi-safari-final-webkit/report.json`.
- 개인 노트 WebKit 11흐름/오류 0: 누적 정리·제외/복원·다시 열기·서재 이어 정리·어휘 저장을 합성 계정으로 확인했다. `/private/tmp/manabi-safari-notes-webkit/report.json`.
- 실행 head의 CI35093095730는 lint·전체 테스트 및 smoke·learning-flow 두 job SUCCESS.
- 동일 실행 커밋을 공개 브랜치에 push했다. 격리된 clean source-only worktree에서 기존 releaseDeployArgs로 Preview 배포를 완료했다. 로컬 node_modules/.next/환경 파일을 옮기지 않았고 공개 버전 메타데이터만 해당 배포에 제공한다.

## 실제 계정과 기기

합성 계정/PGlite 브라우저 검사는 실제 계정 저장 확인과 구분한다. 새 Preview의 교사 로그인 후 지난 판 전체/부분 복사→저장→재접속 및 개인 노트 누적 정리를 확인한다. 물리 iPad/Pencil의 손바닥 접촉·회전·소프트 키보드 및 별도 학생 계정 검수는 별도이며 이 변경으로 완료 선언하지 않는다.

운영 병합/승격, DB/Storage 정책, 영구 환경 변수, 기존 교재·개인 어휘·학생 수업 기록은 변경하지 않는다.

## 최종 Preview

- `https://manabi-fq12zobov-wonchance-arts-projects.vercel.app` READY. 배포 `dpl_AVnKB7ckc5E3esz3pztw5EBqCc1F`.
- `/api/version` commit `70f493b8248f7964dbe5f6188a4fc3543a725931`, preview/ref 일치. 비로그인 `/api/classroom/boards?rootId=1` 401.
- 배포본 Chromium/WebKit 터치 각각 35조건 PASS, 뷰어 내 홈·팀·학습 prefetch 0, 콘솔 오류 0. 기존 배포 WebKit의 RSC prefetch 실패는 원인 링크 수정 후 재현되지 않는다. `/private/tmp/manabi-safari-preview-chromium/report.json`, `/private/tmp/manabi-safari-preview-webkit/report.json`.
- 실제 배포 서체의 태블릿 부분 선택 화면을 직접 확인했다. 폰/태블릿 뷰포트 검사와 링크 클릭 왕복도 포함한다.
- Codex 로그인 화면을 최종 fq12zobov 주소로 열었다. 실제 교사 계정 로그인/쓰기 검수는 대기 중이며 합성 계정 통과로 대체하지 않았다. 개인 노트 실제 계정 검수도 같은 로그인 뒤 진행한다.
- 이후 검수 문서·자기 보드 커밋은 실행 코드와 구분하며 최종 exact head/CI는 PR 및 #150 완료 신호에 기록한다.
