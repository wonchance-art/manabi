# 교재 기능 통합 검증 — 2026-09-05

- 기준 운영 코드: `bd76c7d8f5bddf83c619a94c538183d29786c903`
- 배포 앱 코드: `9a20596a2fb2ea874986278781a2a1a59df90832`
- 검토 PR: https://github.com/wonchance-art/manabi/pull/1277 (draft, merge하지 않음)
- 통합 브랜치: `codex/textbook-materials-release-20260905`
- 작업 경로: `/private/tmp/manabi-textbook-release`

기존 작업 폴더에는 다른 작업의 변경 사항이 섞여 있어 최신 main의 독립 체크아웃에서 교재 기능만 통합했다. 공유 작업 폴더의 미완성 코드는 배포에 포함하지 않았다.

## 검증

| 항목 | 결과 |
| --- | --- |
| 전체 Vitest | GitHub CI 기본 `npm test`: 334파일, 3,688테스트 통과 |
| 관리자 실제 컴포넌트 Chrome | 9개 흐름, 밝음·어두움 × 5가지 화면 폭 통과 |
| 문맥 연결 실제 컴포넌트 Chrome | 10개 흐름, 밝음·어두움 × 3가지 화면 폭 통과 |
| 기존 자료 뷰어 기하 E2E | 4개 통과 |
| 최종 앱 커밋 GitHub E2E | 타이포그래피 25, 뷰어 4, smoke 14, 학습 흐름 9 통과; 기존 smoke skip 6 |
| 실제 운영 Chrome | 4언어 × 밝음·어두움 × 390/1024px = 16개 화면 통과 |
| 운영 접근 검사 | 교재 4개 경로 200, 관리자·개인 API 3개 401, 비로그인 관리자 페이지는 로그인으로 이동 |
| 변경 파일 ESLint | 오류 0, 기존 hook 경고 2 |
| 운영 DB 마이그레이션 | 이전 단계에서 적용·권한·기존 데이터 보존 검증 완료 |

GitHub CI의 저장소 기본 설정으로 334파일·3,688테스트가 통과했다. 로컬에서는 저장소 설정을 상속한 임시 설정으로도 같은 전체 테스트를 실행했다. 생성된 `src/components/world/cities/*.geo.js` 약 28MB만 Vite 변환 없이 Node에서 읽었다. 테스트 파일이나 검사 항목은 제외·변경하지 않았다. 기본 실행은 333파일·3,684테스트 통과, 기존 도시 데이터 로딩 훅의 60초 시간 초과 1건이었고 위 조건에서 4개 검사까지 통과했다. 임시 설정은 `textbook-release/vitest-local.config.mjs` 증거 파일에 보관했다.

브라우저 기능 검사는 실제 React 컴포넌트를 사용했으며 인증·API 응답만 모형으로 대체했다. 운영 계정의 콘텐츠 저장이나 개인 자료 생성·수정 검증으로 간주하지 않는다. 관리자 저장 충돌·실패 시 입력 유지, 비관리자 차단, 교재와 자료 양방향 연결, 중복 문맥, 뜻 충돌 취소·확인, 원문 강조·이동 실패 안내, PDF 쪽수 주소, 문맥만 삭제, 비로그인 쓰기 차단을 확인했다.

최신 운영 기능인 뷰어 4등급 저장·취소·받아쓰기·패턴·원문 편집, PDF.js 현재 쪽수·범위 읽기, 게스트 드릴 복습을 유지했다. 뷰어의 기존 카드 저장 뒤 문맥 연결만 실패하면 별도 안내와 재시도를 제공한다. 공통 저장 RPC 자체는 단어·출처의 원자적 저장과 기존 뜻·복습 일정 보존을 보장한다.

## 배포 상태

2026-09-05 16:42 KST 운영 도메인 전환과 실제 운영 검증을 완료했다. 배포 빌드의 교재·독해·커리큘럼 사전 검사, 페이지 생성, 최종 앱 커밋의 CI가 모두 통과했다.

- 운영 주소: https://teset-gilt.vercel.app
- 관리자 편집: https://teset-gilt.vercel.app/admin/textbooks
- 배포 ID: `dpl_6PngqDwRhxPY74BbkAkV3YQtnMVG`
- 검증한 동일 빌드: https://manabi-euj3u2lla-wonchance-arts-projects.vercel.app
- 운영 `/api/version`: `sha: 9a20596`, `ref: codex/textbook-materials-release-20260905`
- CI: https://github.com/wonchance-art/manabi/actions/runs/33952880353
- 이전 운영 배포: `dpl_6ZKqAgQFjJfwPEKdRwBS9FdwYy7i` (필요 시 되돌릴 기준)

운영의 16개 실제 화면에서 가로 넘침, 페이지 실행 오류, 콘솔 오류가 없었다. 패턴 요약 제목의 글자 대비는 최소 4.86:1이었고 일본어 모바일 화면도 직접 검토했다. 이 검증은 비로그인 상태의 실제 운영 읽기 검사다. 관리자 계정으로 실제 공개 원고를 저장하거나 사용자 자료·카드를 변경하지 않았다. 인증된 저장·충돌 흐름은 위 격리 컴포넌트 검사와 API/DB 계약 검사 결과를 따른다.

Git merge 없이 검증된 배포를 운영 도메인에 직접 연결했다. PR #1277은 draft로 남아 있다. 이후 main 배포에서도 이 기능을 유지하려면 기존 단일 merge 창구에서 PR을 통합해야 한다. 배포 뒤 추가된 문서 커밋과 실제 배포 앱 커밋을 구분한다.

화면·로그·검증 보고서는 `/Users/chaeyeon/.codex/visualizations/2026/09/05/01a06f3c-6de2-73c2-b8a7-bf5095012c3d/textbook-release`에 보관했다. `production-live/report.json`이 운영 주소의 검사 결과이며 `verification.json`이 배포 요약이다.

PDF 자동 생성·불변 발행 판본·비공개 초안·전 영역 TTS는 후속 단계이며 이번 완료 범위에 포함하지 않는다.

강조색 보정 뒤 관련 테스트 33개도 통과했다. 최종 앱 커밋의 기본 전체 CI와 E2E 수치는 위 표와 같다.
