# 수업용 뷰어 태블릿 검수 — 2026-09-11 KST

## 변경과 상태

현재 상태: 공개 PR/DB/Preview 및 실제 교사 계정 검수 완료. 아래 로컬 완료·로그인 대기 문구는 단계별 이력이며, 최신 결과는 마지막 절을 따른다. 물리 iPad 및 별도 실제 학생 계정은 후속 검수다.

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

DB 적용의 별도 확인 근거는 저장소 `CLAUDE.md` 68행의 “운영 DB 적용·Vercel env는 오너 수동” 규칙이다. 위 내용은 로컬 완료 시점의 이력이며, 이후 승인·적용 결과는 아래에 기록한다.

## 공개 발행 및 원격 적용 — 2026-09-11 KST

오너가 공개 push·draft PR·DB 적용·미리보기·실계정 검수 진행을 승인했다. `10851b153c75513fab584ee01b277c84547b8900`을 공개 브랜치에 push하고 부모 #1301 위에 draft [#1302](https://github.com/wonchance-art/manabi/pull/1302)를 열었다. merge/force-push는 하지 않았다.

Supabase Manabi 프로젝트에 `classroom_source_anchors`를 적용했다. 저장소 파일 버전은 `20260911051522`, MCP 적용 이력 버전은 `20260911072945`다. 검토한 SQL 앞에 기존 함수 MD5 및 새 함수 부재를 확인하는 중단 조건을 붙여, 다른 작업이 원격 정의를 바꾸었을 경우 덮어쓰지 않게 했다.

- 기존 `classroom_append_study` 정의 MD5는 적용 전 `a3f6b06b957a42ffbb6f906e593149f4`, 적용 후 `b4d4c5021cb6adecdab5243a12ee0e3a`다.
- 관련 함수3개 모두 SECURITY INVOKER, 고정 search_path, anon 실행불가/authenticated 실행가능이다.
- 이모지 포함 문자열 UTF-16 길이5, 정상 출처 허용, 서로게이트 중간 위치 거부를 원격에서 확인했다.
- 실제 검수 대상 교재·팀 루트2건의 원문 및 processed_json 지문이 적용 전후 모두 같다. 데이터 변경 없이 함수 정의만 적용됐다.
- 원격 임시 교재/수업 행으로 원자적 뜻·출처 저장, 같은 요청 재전송, 실수 중복 방지, 변경된 요청 거부, 서버 전용 사본 권한, 출처 digest 기록 및 위조 위치 거부를 확인했다. 트랜잭션은 ROLLBACK했고 기존 자료는 수정하지 않았다. 이는 실제 로그인 브라우저 왕복 검수와 별개다. 실행 SQL은 로컬 `/private/tmp/manabi-tablet-remote-sql-check.sql`에 있다.
- 원격 security advisor에 이번 함수3개와 관련된 경고는 없다. 별도 기존 객체의 search_path/DEFINER 실행권한 및 Auth 경고는 변경하지 않았다. 함수 실행권한 경고는 실제 권한·함수 본문을 개별 검토해야 하므로 이번 출처 기능의 실패로 간주하지 않는다. [Supabase 함수 권한 점검 기준](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

원격 결과 원본은 로컬 `/private/tmp/manabi-tablet-db-verification.json`에 있다. 개인 교재 원문이나 인증 정보는 공개 문서에 포함하지 않는다.

## 최종 미리보기 검수

- [미리보기](https://manabi-2sfn6fnox-wonchance-arts-projects.vercel.app/class): `dpl_EHpnymEyDKhXiiT9Ujp9ZDtqMyq3`, READY. 2026-09-11 16:39 KST 준비 완료, 빌드 약7분26초. 서체 다운로드 재시도가 있었으나 추가 배포 없이 완료했다.
- `/api/version`은 `10851b153c75513fab584ee01b277c84547b8900`, Preview, 위 배포 ID와 판본 `7f572327dc67893e9453246c`가 일치한다. 테스트 번들이 아니라 이 커밋을 git archive로 추출한 소스를 원격 빌드했다. 환경 파일·개인 자료·로컬 `.next`는 전송하지 않았다.
- GitHub CI: 단위 테스트·콘텐츠·lint 및 smoke/learning-flow 모두 SUCCESS. [검증 실행](https://github.com/wonchance-art/manabi/actions/runs/34574508235).
- 최종 배포의 교사 초안/IME/키보드/오프라인 흐름 Chromium12 + WebKit12 PASS, 학생 사본·정확한 출처·기록 복귀 Chromium7 + WebKit7 PASS, 실행 오류0, 각 종료0. 인증·교재·저장 응답은 fixture/PGlite이며 실제 배포의 UI 번들에 연결했다.
- 결과 파일: `/private/tmp/manabi-tablet-preview-chromium/report.json`, `/private/tmp/manabi-tablet-preview-webkit/report.json`, `/private/tmp/manabi-source-preview-chromium/report.json`, `/private/tmp/manabi-source-preview-webkit/report.json`. 최종 배포 화면 캡처도 직접 확인했다.
- 실제 공개 HTTP: `/class` 200, 비로그인 팀 index/history/source는401, 비공개 교재 annotations는403. 비공개 API 응답은 `private, no-store`다.
- 실계정 브라우저 검수는 로그인 대기다. 최종 미리보기의 로그인 화면을 열어두고 오너에게 요청했다. 물리 iPad 검수 및 별도 실제 학생 계정 검수는 미실행이다. 이번 발행을 운영 병합이나 실제 수업 검수 완료로 표시하지 않는다.

이후 검수 문서·보드 커밋은 실행 코드와 분리하며, 실행 미리보기는 위10851b15로 유지해 로그인 원점을 반복 생성하지 않는다.

## 실제 교사 계정 검수 완료 — 2026-09-11 KST

오너 로그인 후 동일한 최종 Preview10851b15에서 UI를 직접 조작했다. 이전 검수 팀의 자료는 교재가 아닌 날짜별 수업 노트임을 확인했으므로, 실제 20과 교재가 연결된 팀의 1과로 대상을 바꿨다. 수업 홈의 일반 교재 열기와 교사용 `수업 진행 → 본문 열기` 경로를 구분했다. 로그인 계정·교재 원문·팀 주소는 공개 검수 자료에 첨부하지 않는다.

- 실제 교재의 단어를 선택하고 `수업용 뜻 확인·수정`에서 임시 표식이 있는 뜻을 입력했다. 원래 사전 뜻과 수업용 뜻이 분리되고, 기록 전에는 기기 초안만 생겼다.
- 학생용 확대에 선택한 표현·독음·수정한 뜻이 표시됨을 화면으로 확인했다. 교재로 복귀 후 명시적 추가 버튼으로 기록했고, 버튼은 `수업에 추가됨`으로 바뀌어 실수 중복을 막았다.
- 직접 입력한 별도 표현의 독음·뜻 초안을 작성한 뒤 같은 교재 단어를 재선택했다. 직접 입력 화면에서 교재 상세·주의점으로 복귀했다.
- 다음 과에서는 이전 과 초안이 섞이지 않았고, 다시 돌아와 `계속 작성`을 누르면 검색어·독음·뜻이 복원됐다. `보여주고 기록`으로 확대와 저장을 실행했고 초안은 소비됐다.
- 서버에는 임시 노트1개/표현2개만 생성됐다. 교재 표현에는 원문 자료 ID·token·UTF-16 위치·문맥·streamDigest, 직접 표현에는 manual 출처가 저장됐다. 수업용 뜻과 독음도 함께 저장됨을 SQL로 확인했다.
- `수업 돌아보기`에 두 표현이 표시되고, `교재 밖 표현만`은 직접 입력한 한 표현만 남겼다. 원문 표현을 검색해 `교재에서 보기`를 누르자 정확한 단어가 선택된 원문 뷰어가 열렸다. `수업으로` 복귀 시 검색어·history 탭·스크롤355px가 모두 복원됐다. 실제 창656×869px에서 가로 넘침0을 확인했다.

정리: 테스트 ID·소유자·팀·날짜·원문·최종 JSON 지문이 전부 일치하는 조건으로 임시 노트1개만 삭제했다. 잔존0, 보관 초안0, 해당 팀 당일 노트0을 확인했다. 검수 중 선택한 `오늘 교재`도 기존 `선택 안 함`으로 되돌렸다. 팀 루트의 정상 수정 시각/revision은 갱신됐으므로 루트 JSON 전체가 불변이라고 주장하지 않는다.

보존: 기존 교재20과와 이전 검수 루트/노트의 원문 및 processed_json 지문이 동일하다. 개인 단어338건 전체 행 지문과 review_events288건 전체 행 지문도 전후 동일하다. 기존 교재 주의점0건 유지, 원문 재분석·사전 뜻 편집·개인 단어 저장·복습 채점은 실행하지 않았다.

이번 실계정 검사에서 추가 제품 수정은 필요하지 않았다. 이 후속 커밋은 문서/자기 보드만 갱신하므로 Preview 주소와 로그인 원점을 그대로 유지한다. 물리 iPad Safari/PWA·중국어 입력기·회전·실교실 네트워크, 별도 실제 학생 계정 왕복은 아직 미실행이다. 기존 Chrome/WebKit 학생 자동 검수와 구분해 후속에 남긴다. 구현/검수 완료를 Claude에 인계하며 운영 merge·force-push는 하지 않는다.
