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
- src/components/PdfJsViewer.jsx, src/views/ViewerPage.jsx, src/views/PdfViewerPage.jsx.
- src/components/books/BookReader.jsx, BookHome.jsx.
- src/app/(app)/materials/page.jsx, src/app/(app)/discover/page.jsx.
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
구현 중.
