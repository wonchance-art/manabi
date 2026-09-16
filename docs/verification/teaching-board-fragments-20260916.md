# 설명판 부분 선택 재사용 검수

2026-09-16 KST · 실행 코드 7b5d896619dc902063909c5fa10d54b6ec43629c

## 적용

선행 #1318 exact 3a17111568a770ba3b0471078e989b711a692ee7 위의 독립 브랜치 `codex/teaching-board-fragments-20260916`.

지난 판의 페이지마다 부분 고르기를 제공한다. SVG 원본 미리보기에서 사각 영역/표현 탭과 키보드 목록으로 고르며, 글자·독음·훈음·뜻은 의미 단위로 함께 선택한다. 같은 단어의 다른 뜻을 구분하도록 목록에 뜻을 병기한다. 원본 데이터를 편집하지 않는다.

현재 판 또는 새 페이지에 상대 위치/회전/획/표시 설정을 보존한 사본을 놓는다. 기존 내용은 이동하지 않는다. 전체 묶음/표현은 보존, 부분 사용자 묶음·빠진 화살표/프레임 연결은 정리한다. 저장 출처를 유지하며 가져오기 자체로 학생 기록이나 개인 어휘/SRS를 생성하지 않는다.

복사 시 소스 접근과 해당 페이지 hash를 재확인한다. 소스 변경은 다시 불러오기/재선택, 동일 사본은 기존 내용 보기/명시적 다시 복사, 닫힌 요청은 늦은 삽입 방지. 대상 저장 충돌·6MiB/20페이지/5,000요소 제한은 삽입 전에 검증한다. 새 페이지 삽입도 빈 페이지 초기화 후 단일 undo 변경으로 처리한다.

## 검증

- 최종 전체 Vitest: 410파일 / 4,349개 PASS. `/private/tmp/manabi-fragments-alltests-final.log`.
- 신규 순수 모델: 9개 PASS. 기존 페이지 복사/계정 모델과 24개 PASS. 권한 API 테스트는 전체 실행에 포함.
- 변경 JS/JSX/E2E 명시 ESLint: 오류/경고 0. git diff --check PASS.
- 프로덕션 빌드 480페이지 PASS(로컬 검수용 공개 dummy Supabase + 기존 Google-font mock 사용). 실제 Preview에는 이 빌드나 dummy 설정을 업로드하지 않는다. 마지막 포인터 취소 보호 보완 뒤 최종 빌드도 480페이지 PASS. `/private/tmp/manabi-fragments-build-release.log`.
- Chromium/WebKit 터치 각 33흐름 PASS / 실행 오류 0. 최종 실행 코드의 Chromium 33흐름 재검수도 PASS(`/private/tmp/manabi-fragments-chromium-release/report.json`). `/private/tmp/manabi-fragments-chromium-final/report.json`, `/private/tmp/manabi-fragments-webkit/report.json`.
- 390px/1024px 선택 화면, 복사 후 판, WebKit SVG 표시를 캡처로 직접 확인. 긴 원본은 전체 보기에서 작게 표시되므로 확대/이동 또는 요소 목록으로 선택한다.

E2E는 실제 React 앱과 폐기용 PostgreSQL RPC/HTTP 합성 계정이다. 실제 교사·학생 계정 검수와 구분한다. 의도적으로 만드는 저장 실패/충돌/취소는 보고서에 별도 기록하며 실행 오류를 숨기는 규칙을 추가하지 않았다.

검수한 흐름: 영역 선택 → 두 표현+획 → 현재 판 삽입 → 기존 내용 불변 → 한 번 undo/redo → 계정 저장/새로고침 → 중복 사본 안내 → 키보드 선택 → 새 페이지 삽입/undo/redo → 취소 시 원래 초점 → 소스 변경 시 재선택 → 복사 요청 중 닫기 → 뒤늦은 응답에 삽입 없음. 기존 페이지 전체 복사 및 클라우드 저장/복구 흐름도 함께 검사했다.

## 남은 사항과 권한

- 오너가 이 범위의 공개 GitHub push·draft PR·Vercel Preview·동일 범위 마무리 push를 명시적으로 승인해 이전 자동 검토의 전송 보류를 해소했다. 공개 push 완료, draft PR #1319 생성. base는 #1318 브랜치다.
- 최초 Preview는 일반 CLI 배포에 커밋 식별값이 없어 release_commit_required로 중단됐다. 기존 scripts/deploy-web-release.mjs의 releaseDeployArgs를 사용해 공개 커밋/브랜치/시각을 해당 배포에만 전달해 재배포했다. 프로젝트 영구 환경 설정은 바꾸지 않는다.
- 최종 Preview `https://manabi-p4nl6jogi-wonchance-arts-projects.vercel.app` READY. 배포 `dpl_6pFcntEJ6zePgTjMPxPRKWsy95np`; `/api/version`의 commit7b5d896619dc902063909c5fa10d54b6ec43629c/branch/preview/교재 판본이 소스와 일치, 비로그인 설명판 API401. 원격 빌드480페이지 완료. 테스트용 env/폰트 mock/로컬 .next는 업로드하지 않았다.
- 배포본 Chromium/PGlite 합성 계정 33흐름 PASS, 실행 오류0. `/private/tmp/manabi-fragments-preview-chromium/report.json`. 실제 배포 서체를 사용한 1024px/390px 부분 선택·복사 결과 캡처 직접 확인, 가로 넘침/확정 버튼 잘림 없음.
- PR 생성 head8aef243a3685eeb5debf723139bae5bbe8da329f의 CI35089594244는 lint·콘텐츠·Vitest 및 smoke·learning-flow 두 job SUCCESS. 이후 검수 문서/자기 보드만 갱신하며 최종 head와 CI는 PR/#150 완료 신호에 기록한다.
- Codex에서 새 Preview의 실제 로그인→원래 교재/팀/날짜/설명판 복귀 URL 유지 확인. 새 origin은 미로그인 상태로, 교사 로그인 요청 후 실계정 쓰기는 대기 중이다.
- 새 Preview 실제 교사 계정 저장/재접속, 물리 iPad/Pencil·두 손가락/손바닥 접촉은 별도 확인 대상이다.
- 새 DB/schema/Storage 정책/프로젝트 영구 환경 설정/의존성/운영 merge/원본 교재 변경 없음. 기존 미병합 #1316/#1317/#1318의 운영 반영과 이번 브랜치 병합은 별도 승인 범위다.
- World 생성·PNG 결정성·미니맵 메모리 게이트는 이번 웹 작업에 해당하지 않는다.

설계와 완료 조건은 `docs/manabi-teaching-board-fragments.md`에 동봉했다.
