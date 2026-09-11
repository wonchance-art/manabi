# 수업용 뷰어 태블릿 검수 — 2026-09-11 KST

## 변경과 상태

오너의 태블릿 실사용 설계 승인 후 `codex/classroom-tablet-20260911`에서 구현했다. 부모는 출처 복귀 로컬 완료본 `04d1836b6e2282a559f344e3ea688e5607a0eb0a`이며, 그 이전 공개 부모는 draft #1301 / `cdf9b76c480b870474c2dacab16341fd6ddfff28`이다. 기존 작업 공간의 변경은 덮어쓰지 않았다.

실행 커밋은 `7fca8c9548b6109e4edd86395534fc47d0191111`이다. 검수 문서·작업 보드는 실행 변경과 별도 커밋으로 분리한다.

초안 복원, IME 확정 방어, 사전 응답과 직접 편집의 경합 방어, 패널 하단 주동작 고정, 실제 표시 영역에 맞춘 입력/선택 노출, 앱 복귀 시 저장 확인을 구현했다. 상세 계약은 `docs/manabi-classroom-tablet.md`에 있다.

이 문서 시점에는 공개 push/신규 PR, 부모 SQL의 원격 적용, 신규 Vercel 배포, 실계정 쓰기 검수를 하지 않았다. 공유 Preview나 운영 사이트에 이 변경이 반영됐다는 의미가 아니다. 이번 단계의 추가 SQL/환경 변수는 없다.

## 검증 결과

| 검사 | 결과 | 증거 |
|---|---|---|
| 전체 `npm test` | 382파일 / 4,145개 PASS, 종료0 | `/private/tmp/manabi-tablet-alltests-final2.log` |
| 초안 순수 계약 | 신규10개, 전체 결과에 포함 | `src/lib/__tests__/classReaderDraft.test.js` |
| 실제 IndexedDB Chromium / WebKit | 각각7개 PASS, 운영 쓰기0 | `/private/tmp/manabi-tablet-idb.log`, `/private/tmp/manabi-tablet-idb-webkit.log` |
| 신규 태블릿 흐름 Chromium / WebKit | 각각12개 PASS, 실행 오류0, 종료0 | `/private/tmp/manabi-tablet-complete-chromium/report.json`, `/private/tmp/manabi-tablet-complete-webkit/report.json` |
| 기존 교사 흐름 Chromium | 23개 PASS, 실행 오류0, 종료0 | `/private/tmp/manabi-tablet-regression-chromium/report.json` |
| 기존 교사 흐름 WebKit 터치 | 단독 재검수24개 PASS, 실행 오류0, 종료0 | `/private/tmp/manabi-tablet-regression-webkit-recheck/report.json` |
| Next 운영 형식 빌드 | PASS, 종료0 | `/private/tmp/manabi-tablet-build-final2.log` |
| 정상 prebuild | PASS, 종료0 | `/private/tmp/manabi-tablet-prebuild-final2.log` |
| 변경 JS 및 JSX lint | 오류0 | JSX는 `eslint --ext .jsx`로 명시 검사, `/private/tmp/manabi-tablet-jsx-lint.log` |
| E2E 구문 / diff 공백 | 오류0 | `node --check`, `git diff --check` |

Node24.20.0, Next15.5.21. 빌드는 테스트 Supabase 주소/키와 고정 Google Fonts 응답을 사용한 운영 번들 형태다. 실제 배포 환경 연결 검증을 대신하지 않는다. prebuild의 기존 콘텐츠 경고는 유지되며 새 콘텐츠나 world 자산을 생성하지 않았다. `public/sw.js`는 표준 prebuild의 캐시 버전 갱신이다.

브라우저 하니스는 격리된 인증·교재 fixture와 실제 앱 번들을 사용한다. 저장 RPC는 PGlite에서 실행한다. 실제 교재·개인 자료를 테스트용으로 바꾸거나 운영 계정에 임시 단어를 기록하지 않았다.

## 확인한 동작

1. 검색어만 적고 재열기, 뜻/독음 작성 후 과·수업일 왕복에서도 초안을 복원한다. 다른 계정·팀·날짜·자료 범위는 순수 계약과 IndexedDB 필터로 구분한다.
2. 두 탭에서 같은 초안을 편집해도 서로의 행을 덮지 않는다. 초기 읽기보다 늦게 시작한 사용자 편집이 우선한다. 기록 중 추가 편집은 revision 비교로 보존한다.
3. 조합 Enter/keyCode229 및 조합 종료 직후 form submit은 조회하지 않는다. 늦은 사전 응답은 직접 입력한 뜻을 덮지 않는다.
4. 1440·1024·768·390px에서 하단 주동작을 패널 안에 유지하고 가로 넘침0을 확인했다. 모사한 VisualViewport 높이360px에서 입력칸과 기록 버튼이 표시 영역 안에 들어온다.
5. 직접 표현의 확대/기록은 명시적으로 실행한다. 오프라인 기록은 실제 IndexedDB 대기열에 있고 서버에는 없음을 확인했다. 재연결·앱 표시 이벤트 후 한 번만 전송되고, 이후 더 쓴 뜻은 초안으로 남는다.
6. 복원한 교재 표현은 검증된 출처와 수정한 수업용 뜻으로 기록된다. 원래 교재 사전과 개인 단어는 바뀌지 않는다.
7. 교재 주의점 누적·다음 방문 재등장·보관/복원, 확대 화면의 위치/초점 복귀, 날짜·검색·교재 밖 필터, 단어/드래그/문장 출처 왕복을 회귀 검사했다.

데스크톱 단어 상세, 모바일 직접 입력, 모사한 키보드 캡처를 직접 눈으로 확인했다. 보관용 화면은 `/Users/chaeyeon/.codex/visualizations/2026/09/05/01a06f3c-6de2-73c2-b8a7-bf5095012c3d/classroom-tablet-20260911/`에 있다. 이는 구현된 앱을 fixture로 실행한 캡처이며 새 디자인 목업이 아니다.

## 검수 중 수정 및 한계

- 기존 회귀 검사에서 직접 검색 뒤 같은 교재 단어를 눌러도 검색 모드가 남는 결함을 발견했다. 선택 ID뿐 아니라 기존 viewer의 명시적 open signal을 받아 교재 상세와 주의점을 다시 보이게 수정했다. 기존 단어 뜻 비동기 갱신은 이 신호를 발생시키지 않는다.
- 확대 버튼을 하단으로 옮긴 결과 기존 테스트의 region 선택자가 다른 확대 버튼까지 포함했다. 정확한 footer 버튼으로 선택자를 좁히고 실제 키보드 초점 및 중복 기록0 검사는 유지했다.
- 새 오프라인 시나리오가 이미 열린 찾기를 다시 눌러 닫는 하니스 오류를 수정했다. 실제 오프라인 전송 검사는 그대로 수행했다.
- 최초 빌드 시 디스크가 부족해 중단했다. 이 작업 및 이전 자기 작업의 생성된 `.next/cache`만 정리한 뒤 빌드를 다시 완료했다. 소스·교재·사용자 파일은 삭제하지 않았다.
- WebKit 최초 기존 흐름 검수에서 마지막 기록 목록 스크롤 복귀가 시간 초과됐다(22개 완료). 위치 진단만 추가하고 제품/검사 조건을 바꾸지 않은 단독 전체 재검수에서는 저장·URL·실제 복귀가 모두650px로 일치했고24개가 통과했다. 최초 실행은 좌표 진단이 없어 원인을 확정하지 못했으며 간헐적 타이밍 위험으로 남긴다. 실패 실행은 PASS 수치에 포함하지 않는다.

WebKit 자동 터치, 모사 VisualViewport와 IME 이벤트는 물리 iPad 검수가 아니다. 실제 Safari/PWA, 중국어 입력기, 화면 회전·키보드 닫기·앱 전환은 배포 후보에서 별도 확인해야 한다. 학생 계정의 실제 사본 읽기/복귀와 기존 기록 보존도 실계정 단계로 남긴다.

## 인계 순서

1. 부모 출처 복귀와 이번 완료본을 함께 리뷰할 수 있는 후속 draft PR로 준비한다. 공개 push/DB 적용 대기 항목을 임의 완료로 처리하지 않는다.
2. 부모 SQL `20260911051522_classroom_source_anchors.sql`의 현재 원격 상태와 오너 적용 승인을 확인한다. 이 SQL은 기존 기록 추가 RPC의 출처 검증을 보완하며 이번 태블릿 초안용 서버 변경은 없다.
3. 최종 커밋 미리보기에서 실계정 교사→기록→교재→학생 사본 왕복을 검사한다. 임시 검수 기록만 정리하고 기존 자료·주의점·복습 기록은 보존한다.
4. 물리 iPad 검수 결과를 자동 검수와 분리해 기록하고 Claude 창구로 통합을 인계한다. merge/force-push는 하지 않는다.

DB 적용의 별도 확인 근거는 저장소 `CLAUDE.md` 68행의 “운영 DB 적용·Vercel env는 오너 수동” 규칙이다. 이번 진행 승인은 로컬 A/B 구현이며 앞서 남긴 SQL/발행 승인 질문에 답변했다고 간주하지 않았다.
