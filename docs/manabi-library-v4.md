# 통합 서재 v4 — 구현 SPEC

2026-09-08 KST. 오너의 통합 목록·검색·이어 읽기·개인 모음집 설계 승인 및 “좋아 진행”에 따른 구현.
기준 f931588c813272bbf52a64288cd64c1ae700b697, 부모 PR #1289. 독립 작업 공간 /private/tmp/manabi-library-v4-20260908, 브랜치 codex/library-v4-20260908.

## 완료 범위
- /materials 기본 화면: 내 서재, 검색, 새 자료, 최대3 최근 열람, 서버에서 원본 단위로 페이지를 나누는 통합 목록.
- 작은 표지와 동일한 자료 행. 검색은 제목·현재 파일명·구형 PDF·책/챕터. 검색/모음집/필터 중에는 최근 영역 접기.
- 이름만 필요한 개인 모음집, 복수 소속, 생성/담기/해제/이름 변경/모음집 삭제. 삭제는 원본에 영향 없음.
- 공개 글 개인 보관은 신규 독립 관계. 기기별 오프라인 pin 및 표현 저장과 혼동하지 않음.
- 정상 표시 후 최근 열람 기록. 기존 문장 진도·PDF/EPUB 기기 위치·판본별 교재 진도는 기존 정본 유지.
- 동일 composer, 저장 성공 후 소속만 실패한 경우 그 단계만 재시도. 원본/학습 사본 ID·내용·파일·복습 일정 불변.
- 기존 URL/검색·복귀·학습 기능 유효. 공개 탐색은 발견. 기존 고급 보관 기능은 보조 입구 제공.

## 데이터 계약
신규 migration: 20260908025511_personal_library_catalog.sql (Supabase CLI 생성).
개인 library_collections, library_collection_items, library_bookmarks, library_reading_activity. 관계는 owner_id와 검증 가능한 원본 참조(material / pdf / book / edition). RLS와 현재 원본 권한 확인, 모음집 소속에서 원본으로 삭제 cascade 없음. 최초 글·분석 JSON·기존 진도 수정 없음.
가벼운 SQL RPC가 원본 그룹·검색·필터·정렬·총수·20개 페이지를 계산한다. 본문/토큰 JSON/비공개 storage_path는 목록 응답에 포함하지 않는다. security invoker, 제한된 EXECUTE, 고정 search_path. 상세 목차도 페이지 조회.
최근 열람은 서버 시각과 읽은 문맥만 기록한다. 실제 쪽/토큰/완료율은 기존 정본. 열람으로 완료/FSRS/업로드 시각을 바꾸지 않는다. 공개/개인/관리자 권한을 혼합하지 않는다.

## 파일 허용 범위
- docs/manabi-library-v4.md, docs/ai-tasks.md의 Codex-1 항목(별도 보드 커밋).
- supabase/migrations/20260908025511_personal_library_catalog.sql.
- src/lib/personalLibrary.js, src/lib/libraryActivity.js, src/lib/libraryReturn.js.
- src/lib/__tests__/personalLibrary.test.js, src/lib/__tests__/libraryActivity.test.js, src/lib/__tests__/libraryV4Contract.test.js.
- src/components/web/LibraryPage.jsx, src/components/web/LibraryReaderLink.jsx, src/components/web/DiscoveryExplorer.jsx.
- src/components/library/LibraryShelf.jsx, LibraryCollections.jsx, LibraryRow.jsx, LibrarySaveButton.jsx, useLibraryActivity.js, library.css.
- src/components/materials/MaterialComposer.jsx, OriginalMaterialReader.jsx.
- src/views/MaterialsPage.jsx (발견 안의 공개 탐색 URL·고급 보관 도구 호환), src/components/PdfJsViewer.jsx, src/components/PdfDocument.jsx (기존 embed의 정상 load 신호만 연결), src/views/ViewerPage.jsx, src/views/PdfViewerPage.jsx.
- src/components/books/BookReader.jsx, BookHome.jsx.
- public/sw.js (기존 prebuild가 생성하는 코드 해시만), src/app/(app)/materials/page.jsx, src/app/(app)/discover/page.jsx.
- scripts/verification/personal-library.mjs, e2e/library-v4.e2e.mjs, e2e/fixtures/library-v4-backend.mjs.
범위가 실제 파일 구조와 다르면 변경 전 이 SPEC의 이유와 정확한 경로를 갱신한다. 기존 테스트·월드·교재 corpus·원문·판본·FSRS·환경 파일 변경 금지. 시안은 승인 완료, UI 카피와 개인 관계 구현은 이번 오너 명시 요청을 따른다. 도시 생성 전용 exact snapshot/PNG 게이트는 해당하지 않는다.

## 선례와 재사용
| 대상 | 판단 | 이유 |
|---|---|---|
| 기존 composer·documentOf·study 사본·LibraryReaderLink·PDF/EPUB·교재 reader | 채택 | 원문과 학습 출처 정본을 유지하며 탐색 계층만 연결 |
| Linkwarden collections | 상호작용만 부분 참고 | 이름으로 묶고 자료를 탐색하는 선례. 현행 저장소 AGPL-3.0, 유지 중. 코드 이식·중첩·팀 공유·웹 아카이브는 도입하지 않음. https://docs.linkwarden.app/usage/collections / https://github.com/linkwarden/linkwarden |
| Supabase RLS / SQL 함수 | 채택 | 별도 검색 서버 없이 기존 Postgres가 권한과 그룹 페이지를 계산. invoker 및 owner 인덱스. https://supabase.com/docs/guides/database/postgres/row-level-security |
신규 npm 의존성 없음. Supabase 2026-09-08 changelog 확인: 이번 조회/RLS 기능에 관련 breaking change 없음.

## 검증
0/1/30/300/3000 최상위 항목, 책·PDF0장·첨부 이름 검색, root/사본 중복, 최근 시각 의미, 실제 위치 복원, 모음집 전체 수명과 저장 부분 실패. 소유자/비소유자/anon, 권한 바뀐 공개 글, 원문·표현·파일 불변. 격리 Postgres 실제 SQL, 순수 로직/배선 계약과 변이, 브라우저 흐름. 320/354/390/768/1280·200%·키보드·긴 제목·가로 넘침. 전체 vitest 및 빌드, 실제 계정 검수.
공개 push·draft PR·DB 적용·Vercel 미리보기는 검토 가능한 정확한 변경/검증 결과를 준비한 뒤 진행. merge·force-push·운영 승격 없음. 기존 미리보기는 새 후보 READY까지 유지.

## 검수 결과
- 전체 Vitest 356파일/3878개 통과. 기존 테스트 파일·timeout 변경 없음.
- 신규 브라우저 9흐름과 기존 편집기 회귀 7흐름 통과. Chromium이 실제 앱을 실행하고, 합성 계정의 REST 경계 아래에서 실제 PGlite SQL/RLS를 실행했다. 운영 계정 검수와 구분한다.
- 신규 흐름: 20개 원본 페이지/추가 조회/검색과 묶음 챕터, 모음집 수명과 원본 보존, 자료 저장 뒤 소속만 재시도, 다섯 화면 폭/긴 제목/키보드/200% 확대, 독립 조회 실패, EPUB 첨부·장 복귀, 발견의 공개 글 보관, 판본별 교재 복귀, 편집 후 같은 필터 복귀와 사본 중복 방지.
- 기존 편집 회귀: PDF 원본 쪽 이동/재열람, 모바일 EPUB→PDF 교체와 보존 첨부, 응답 유실, 동시 수정 충돌, 자료별 초안 잠금, 스키마/소유권/조회 실패, 저장 재시도. 기존 카드 선택자를 쓰는 두 탐색 시나리오는 새 통합 목록 흐름에서 대체 검증했으며 기존 테스트 자체를 수정하지 않았다.
- 독립 SQL 검증: 0/1/30/300/3000개 원본 총수·페이지, 파일명/0장 PDF/자식 검색, 원문/진도 불변, 비공개 파일 경로 비노출, 모음집 원본 비삭제, 비소유자/anon 차단, 공개 범위 변경, 서버 열람 시각·문맥 검증. 3000개 합성 원본 중 첫 20개 응답 약 7KB; 로컬 측정 약 0.22초로 운영 성능 보장은 아니다.
- 직접 확인한 데스크톱/모바일 화면: manabi-library-v4-desktop.png, manabi-library-v4-mobile.png (승인 설계와 같은 로컬 시각화 디렉터리). 가로 넘침/브라우저 pageerror 0. 실제 계정의 사적 자료는 캡처하지 않았다.
- 최종 Next.js 빌드 473페이지 성공, 집중 검사 4파일/31개 통과. 기존 curriculum 경고 11개와 익명 default export 경고 2개만 존재한다. DB 변경·새 Vercel 배포·실제 계정 검수는 아직 수행하지 않았다. 원격 마이그레이션 83개와 관련 실제 컬럼 구조를 재확인했고 이번 20260908025511만 추가 대상이다. 기존 preview/production은 유지한다.

마지막 편집 복귀 검사에서 이전 React Query 자료가 먼저 표시되면 학습 언어 선택이 이전 상태로 남는 경우를 발견했다. 현재 document revision을 reader key에 포함해 수정한 언어·첨부 상태로 갱신하고 재검증했다. 공개 PDF 발췌 글은 다른 소유자의 PDF 대신 접근 가능한 글 주소로 기록한다. 느린 열람 기록 응답 뒤에는 서재 조회를 갱신하며, 구형 PDF 위치도 실제 쪽 렌더가 끝난 뒤에만 저장한다.

코드 재검토로 구형 uploaded_pdfs.last_page_read가 usePdfRangeMutation에서 추출 구간 끝쪽으로도 갱신됨을 확인했다. 이를 실제 열람 쪽으로 간주하던 설계 가정을 바로잡는다. 기존 값은 변경하지 않으며, PDF 정상 렌더 후 현재 쪽을 계정/PDF별 이 기기 위치 키에 저장한다. 서버 열람 색인에는 여전히 위치·완료율을 넣지 않는다.

기존 목록의 시리즈 교재 숨김 규칙도 유지한다. 실제 DB에는 해당 제목 규칙의 공개 123개/비공개 10개가 있어 단순 owner 통합은 은퇴한 교재를 서재에 다시 노출할 수 있었다. 기존 시리즈 자료는 기본 개인 책장에 자동 편입하지 않고, 명시적 보관/모음집/실제 열람 참조만 연결한다. 새 composer로 작성한 개인 자료와 책 그룹은 제목만으로 제외하지 않는다.
