# 일본어 N5 웹 우선 발행 — 2026-09-06

사용자 승인: 웹 교재를 먼저 운영 서비스에 올리고 직접 검수한다. PDF는 다듬은 뒤 별도로 공개한다. 새로운 음성 제작은 제외한다.

## 배포 원본

- 분리 작업 브랜치: `codex/textbook-n5-complete-20260906`
- 기반: `30264965ef57353cbdd0cee67c1ba2bcd4360c04` (기존 운영 교재·자료 변경 유지)
- 앱 코드: `22e8671dfea847e4f54745dbd8556ca6792d840d`
- 검토 PR: https://github.com/wonchance-art/manabi/pull/1279 (기존 #1277 위의 draft)
- 판본: `7f572327dc67893e9453246c`
- 원고: 42과, 단어 625개, 문형 125개, 한자 103자
- 내용 SHA-256: `7f572327dc67893e9453246cbf1f50aa68c2b192ecbe4bcad99a27838c86c528`
- 출력 묶음 SHA-256: `306055eb053b8e0ef3f3f3d0834183266327c4a782abd45a6c315b323fca89af`
- 매체 상태: `web: true`, `pdf: false`, `audio: existing-only`

## 데이터 적용

검토된 `supabase/migrations/20260906000912_textbook_book_editions.sql`을 연결된 Supabase 관리 도구로 적용했다. 운영 기록의 migration version은 도구가 발급한 `20260906024758`이며 name은 `textbook_book_editions`다. 같은 SQL을 재적용하지 않는다. 저장소 파일은 이후 `supabase/migrations/20260906024758_textbook_book_editions.sql`로 정합화했다. 앞의 `20260906000912`는 최초 검토 당시의 번호를 보존한 역사적 기록이다.

`textbook_book_drafts`, `textbook_book_editions`, `textbook_book_releases`의 RLS와 정책을 확인했다. 새 테이블과 관련된 security advisor 항목은 없었다. 적용 전후 기존 데이터 건수는 동일했다: 단어 226, 문맥 1, 교재 자료 연결 0, 읽기 자료 172, 업로드 PDF 1.

첫 발행은 사용자가 승인한 운영 배포의 초기 등록으로 관리 DB 연결을 사용했다. 기존 초안이 없고 기존 판본·포인터와 충돌하지 않는지 트랜잭션 안에서 검사하고, 실제 관리자 프로필을 발행 담당자로 기록했다. 사용자 로그인 세션이나 JWT를 만들어 관리자 RPC를 흉내 내지 않았다. 발행 포인터 version은 1이며 최초 발행 시각은 `2026-09-06T02:54:10.752994Z`다.

공개된 원고·출력 묶음은 변경하지 않는다. 이후 내용 변경은 새 판본을 생성하고 기존 판본을 보존한다.

## 검수

- 첫 코드 변경 후 일반 테스트 337개 파일 / 3,711개 테스트 통과.
- 실제 배포 후보에서 URL의 fragment만 바꿀 때 본문이 이동하지 않는 문제를 발견했다. `BookReader`가 바깥 주소의 `hashchange`·`popstate`를 반영하도록 수정했다.
- 수정 파일 ESLint(`--ext .jsx`)와 `git diff --check` 통과. 교재 관련 23개 테스트 통과.
- 최종 운영 주소: https://teset-gilt.vercel.app/books/japanese-n5
- 배포 ID: `dpl_6FGmPdaiVss4oZtpuQYTKk47MES7` (READY). Vercel promote 후 기존 도메인 alias 연결을 확인했다.
- 최종 검수 시각: `2026-09-06T03:04:31.239Z`. 실제 운영 도메인에서 320·390·768·1440px × 46개 목차 항목 = 184개 조건 통과. 가로 넘침, JavaScript 오류, 교재 자산 오류 모두 0.
- 예문 박스 369개, 원고 출처 1,137개, 깨진 내부 링크 0. 새로고침 후 답안 유지, 동음이의어 검색 2개 결과, 뜻 가리기, 본문 선택 패널, 교재 목록 진입, fragment 주소 이동을 확인했다.
- 공개판 PDF 버튼과 자동 PDF 요청 없음. PDF 자산은 404, 비로그인 관리자 API와 복습 저장 API는 401 응답을 확인했다.
- 휴대폰·데스크톱의 실제 앱 화면을 과별 상단·하단으로 촬영해 검수했다. Vercel에서 해당 배포의 검수 시간대 5xx 로그는 없었다.

관리자 로그인 후 초안 저장·발행·복원 버튼을 누르는 실제 계정 검수는 아직 수행하지 않았다. 현재 열려 있던 운영 브라우저에서는 관리자 접근이 되지 않아 로그인 확인을 요청했다. 자동 테스트의 인증 모형을 실제 로그인 검수로 간주하지 않는다.

검수 자료는 전달 폴더의 `web-release/production-qa/report.json`, 화면 캡처, `verify-live.cjs`, `웹-발행-검수-보고서.md`에 보존한다. 실제 사용자 계정의 복습 카드나 자료 연결을 검수 목적으로 생성하지 않았고, 배포 후에도 기존 데이터 건수가 같음을 확인했다.

## 운영 복원

이전 운영 배포: `dpl_CNUs7Kyzksp12RVbzSwH3uehWbdy` / `manabi-bavcrosb1-wonchance-arts-projects.vercel.app`. 필요하면 해당 배포를 다시 promote하고 `teset-gilt.vercel.app` alias를 연결한다. 추가한 DB 테이블이나 기존 학습 데이터를 삭제할 필요는 없다.

PR 병합은 지정된 담당자가 처리한다. 이번 작업에서는 병합이나 강제 푸시를 하지 않았다. 향후 다른 브랜치를 운영 배포할 때 이 교재 변경을 포함해야 한다.
