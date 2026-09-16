# 개인 노트 누적 정리 검수

2026-09-16. 기준 main efa44c508e862bc118518e9235008201f291341d. 독립 worktree `codex/note-collection-flow-20260916`에서 구현했으며 원래 공유 작업 폴더를 변경하지 않았다.

## 범위

인식 후 필기 화면 유지, 대기 개수 표시, 미완료/담음/제외/전체 필터, 간결한 저장 항목, 필기 계속하기, 서재의 미완료 이어 정리. 기존 API/DB/권한/AI 동의/원문/SRS를 사용한다. 상세 설계 `docs/manabi-note-collection-flow.md`.

## 단위·통합

- 첫 구현 전체 Vitest 406파일/4,314개 PASS. 새 책장 보완 후 최종 전체 검사를 다시 실행한다.
- 변경 핵심 모델·개인 노트·API·선택 인식·UI 규약 51개 PASS.
- 변경 JSX/JS 별도 lint 오류 0. 기존 LibraryShelf effect 의존성 경고 1개는 변경 전부터 존재한다. `git diff --check` PASS.
- 기존 계정 한정 노트 조회와 revision 조건 갱신은 수정하지 않았다. Supabase 변경 이력 및 maybeSingle 문서 확인. 새 SDK/schema/env 없음.

## 브라우저·배포

프로덕션 빌드와 Chromium/WebKit에서 기존 개인 노트 검수에 누적 정리·제외/복원·재접속·서재 복귀를 추가해 검증한다. 결과는 완료 시 기록한다. 합성 계정과 폐기용 PostgreSQL이며 실제 개인 필기·외부 AI를 전송하지 않는다. 실제 iPad/Pencil 검수로 표시하지 않는다.

초기 브라우저 검수에서 서재 단계의 RPC 응답 fixture가 없고 새 책장 경로에 연결이 빠진 것을 발견했다. 새 책장·기존 도구 양쪽 연결, 원문을 가져오지 않는 계정 한정 요약 조회, 해당 RPC fixture를 보완해 재검수한다. 저장용 요약은 클라이언트가 전달한 수치 대신 서버에서 검증한 후보로 계산한다.
