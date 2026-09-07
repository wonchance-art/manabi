# 서재 단일 편집기 — 구현 및 검수

2026-09-08 KST · `codex/unified-material-editor-20260908` · base main `6e61b6e83840a4860b314570a074fb42fb1fcb09`.

## 이번 변경

`/materials/add`는 제목·본문·파일·링크·저장 한 흐름이다. 들어온 메뉴로 노트/읽기 유형을 판정하지 않는다. 언어는 선택이며 미지정 상태도 저장한다. 프랑스어/영어/일본어/중국어를 지원한다. 기존 `suggestion`, `book`, `advanced=1` 경로는 기존 교재 이어 붙이기·자막/문장 목록 도구를 유지한다.

- 글만, PDF/EPUB만, 일반 URL만, 글+원본 조합을 한 자료로 저장한다. 파일은 형식을 자동 인식하며 별도 PDF/EPUB 모드 선택이 없다. 최대 5개/각50MB, 링크10개, 본문20만자, 제목240자. 실제 파일 바이트 해시로 같은 첨부의 중복을 피한다.
- 제목을 비워 두면 본문 첫 줄→파일명→호스트 순으로 저장 제목을 제안한다. 사용자가 쓴 제목/본문을 파일 메타데이터로 덮지 않는다. 본문 줄바꿈을 그대로 보관한다.
- 기본 비공개. 파일 원본은 새 `material-originals` private bucket의 `{owner}/{attempt}/{sha256}.{format}`에 불변 파일로 저장한다. EPUB을 `uploaded_pdfs`에 넣지 않는다. 기존 `user-pdfs`와 PDF/EPUB에서 파생된 과는 그대로다.
- 원본 업로드가 모두 확인된 후 `reading_materials` 한 행을 만든다. `metadata.composer.version=1`에 원본 경로·링크·본문 유무/짧은 미리보기를 두고, 분석 상태는 `saved`다. 로딩/초안/원본 업로드/저장 실패 상태를 구분한다. 자동 분석 요청은 하지 않는다.
- `/viewer/:id`의 새 원본 읽기 화면은 글과 원본을 구분한다. 파일만 저장하면 빈 본문 없이 원본을 바로 펼친다. PDF는 기존 PdfJsViewer, EPUB은 기존 파서의 텍스트/목차를 재사용한다. EPUB의 원본 조판/이미지는 원본 파일로 열 수 있고 인앱 표시는 텍스트다. 손상/비지원 EPUB도 원본 다운로드는 유지한다. 임의 HTML·스크립트는 실행하지 않는다.
- 일반 URL은 원문을 해당 사이트에서 여는 링크로 보관한다. 모든 사이트의 본문을 자동 수집한다고 표시하지 않는다. 기존 지원 자막 수집 도구는 유지한다.
- 작성한 본문은 언어 지정 후 같은 자료 ID의 기존 학습 화면으로 간다. 표현 저장/복습/출처 귀환 정본을 재사용한다. `sourceToken`/`sourceText` 귀환은 학습 화면으로 진입한다. 기존 분석이 있으면 언어를 임의로 덮지 않는다. 새 본문 분석이 저자 줄바꿈을 자동 변환하지 않도록 했다.
- PDF 쪽/EPUB 장 위치는 계정+자료+원본 해시별 이 기기 기록이다. 이를 `reading_progress.last_token_idx`나 FSRS 일정으로 대입하지 않는다.

## 저장·복구 계약

IndexedDB 초안은 계정별로 분리한다. 첨부 Blob은 별도 저장소에 한 번만 저장하여 키 입력마다 대용량 파일을 다시 쓰지 않는다. 트랜잭션 commit 이후에만 보관 완료를 표시한다. 지원 브라우저에서는 Web Locks로 동일 계정의 두 편집기가 초안을 덮는 것을 막는다. 지원하지 않는 브라우저에서는 이 잠금 보호가 적용되지 않는다.

저장 직전에 초안/시도 ID를 고정하고 이후 재시도는 같은 내용으로 진행한다. 저장 응답이 유실되면 본인+시도 ID를 먼저 조회한다. 업로드된 원본도 불변 경로로 확인하므로 반복 업로드하지 않는다. DB 부분 unique index가 탭 간 삽입 경쟁을 막는다. 기존 저장 함수 `createImportAttempt`/`saveImportOnce`를 재사용한다. 결과가 불확실한 동안 새 내용으로 같은 요청을 바꾸지 않는다.

저장 실패 전에 올린 파일은 재시도를 위해 남겨 둔다. 업로드만 끝나고 사용자가 초안을 영구 폐기한 경우의 원격 미참조 파일 정기 정리는 후속이다. 자료 삭제는 행 삭제 후 그 자료의 검증된 원본 경로만 정리하며 정리 실패를 알린다. 기존 표현/복습의 삭제 규칙은 바꾸지 않는다.

## 저장소 변경 (2026-09-08 승인·운영 적용 완료)

`supabase/migrations/20260907162537_unified_material_composer.sql`:

1. PDF/EPUB만 받는 50MB private bucket.
2. 소유자의 경로만 허용하는 SELECT/INSERT/DELETE 정책. 원본 UPDATE 정책 없음.
3. 새 composer version=1만 대상으로 owner+importAttempt unique index.
4. 새 composer 자료의 비공개·소유자·시도 ID CHECK.

과거 자료/판본/원문/FSRS 데이터를 옮기거나 정리하는 SQL은 없다. 새 table/RPC가 없어 기존 Data API grants를 늘리지 않는다. 오너가 새 저장소 적용·실제 저장 검수를 승인한 뒤 기존 [Supabase Migrations workflow](https://github.com/wonchance-art/manabi/actions/runs/34148605087)를 해당 PR 브랜치에서 실행했다. 스킵 없이 Link & db push가 성공했고 같은 번호로 원격 이력·bucket·세 정책·unique index·CHECK를 확인했다. 운영 DB 적용 조건은 해소됐다. 사이트 main 병합·운영 도메인 전환은 수행하지 않았다.

## 선례와 도구 결정

| 참고 | 결정 | 이유 |
| --- | --- | --- |
| Notion 파일/링크 삽입 | 부분 채택 | 글 안에서 출처를 더하고 원본을 보존하는 흐름 |
| Readwise Reader 가져오기 | 부분 채택 | 저장과 읽기 중심, 분석/가공은 후속 |
| Tiptap / Lexical | 이번 단계 미도입 | 문단·첨부만 필요한 범위에 전체 편집기 프레임워크를 추가하지 않음 |
| 기존 PdfJsViewer / EPUB parser / materialImport | 재사용 | 기존 원본 표시·파서·중복 방지 계약 보존 |
| PGlite 0.5.8 / fake-indexeddb 6.2.5 | 격리 검증 도구 | 운영 DB/브라우저 개인 데이터를 건드리지 않고 SQL/RLS와 Blob 초안 검사. 앱 의존성에는 추가하지 않음 |

참고: [Notion](https://www.notion.com/help/embed-and-connect-other-apps), [Readwise](https://docs.readwise.io/reader/docs/faqs/adding-new-content), [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [PGlite](https://pglite.dev/docs/).

## 검증 명령과 진행 기록

- 관련 단위 검사: `materialComposer`, `materialImport`, `epub`, `materialsMinimal`, `uiConventions`.
- SQL/초안 격리 검사: `COMPOSER_TEST_MODULES=/tmp/manabi-composer-test-runtime/node_modules node scripts/verification/material-composer-storage.mjs` (의존성 설치 명령은 스크립트 머리말).
- 브라우저: `COMPOSER_BASE_URL=http://localhost:8870 node --test --test-concurrency=1 e2e/material-composer.e2e.mjs`. `e2e/server-fetch-mock.mjs`가 적용된 더미 Supabase 환경의 E2E build/start에서만 실행한다. 테스트는 loopback만 허용하고 임의 개인 자료를 사용하지 않는다. PDF/EPUB fixture는 직접 만든 짧은 문장이다.
- JSX 명시 lint: 신규 오류0. ViewerPage 기존 useEffect 의존성 경고1은 변경 범위 밖이다.
- 최초 전체 웹 테스트 352파일/3,838개 중 기존 문자열 계약1개가 변경된 조건식 모양을 감지했다. 이전 노트 조건을 유지하고 새 saved 조건을 따로 분리한 뒤 해당 검사를 통과했다.
- 첫 빌드 기본 V8 heap 한도로 중단. 검수 프로세스에만 `NODE_OPTIONS=--max-old-space-size=6144`를 적용한 빌드 성공. 앱 런타임·배포 설정은 바꾸지 않았다. 로컬은 더미 공개 인증 설정과 테스트 글꼴을 사용한다.
- 초기 브라우저 검사: 글 저장/서재 왕복, PDF 직접 열기/쪽 복원, EPUB 본문+링크/목차, 320px 링크 가로넘침0, 두 편집기 잠금/게스트 초안 차단 통과. 저장 응답 유실 검사는 앱의 메일 인증 안내를 오류로 잘못 잡는 테스트 조건을 정확한 composer 오류로 수정한 뒤 통과했다.
- 시각 검수에서 숨김 레이블/파일 input 유틸이 현재 공통 스타일에 없는 점과 주요 버튼 기본 스타일의 스코프 제한을 발견하여 편집기/원본 화면에 명시적으로 적용했다. 과도한 소개 영역을 ‘새 자료’ 한 줄로 줄였다.

최종 검수 결과와 배포 식별은 아래 및 PR/#150 인계에 기록한다.

## 다음 차수

우선순위는 아래와 같다. 이번 운영 저장 검수에서 새 기능까지 추가하지 않았다.

1. 저장한 자료의 제목·본문·첨부 수정. 현재 composer는 새 자료 생성과 저장 복구까지만 제공한다. 수정 시 기존 표현 출처가 가리키는 원문 버전을 보존하고, 첨부 교체도 기존 원본을 즉시 덮지 않는 방식으로 설계한다.
2. 서재 목록/컬렉션 개편. 읽던 자료·최근 저장 중심으로 정리하고 작성 진입 버튼을 하나로 통합한다. 저장 완료 후 ‘새 자료 작성’의 불필요한 중간 단계, 작은 파일 용량 표시도 함께 다듬는다.
3. 새 첨부에서 선택 구간만 학습으로 보내기. PDF/EPUB 원본 위치와 학습 자료/표현의 출처 연결을 보존한다. 기존 범위 추출·책 반입 도구는 계속 이용 가능하다.
4. 원격 미참조 업로드 정리, 일반 URL 지원 소스의 본문 가져오기, 기기 간 원본 위치 동기화. EPUB 본문에 포함된 장 제목과 화면 제목이 반복되는 표시도 읽기 화면 후속에 포함한다.

PDF 교재 조판과 음성은 이번 범위 밖이다.

## 구현 검수 결과

데스크톱1440px·모바일390px·320px에서 작성/읽기 화면을 직접 확인했다. 브라우저8개 흐름 모두 통과: 본문 초안·서재 왕복, PDF 단독 저장/쪽 복원, EPUB+글+링크/목차/스크립트 미실행, 링크 단독/가로넘침0, 응답 유실 후 새로고침 재시도, 두 편집기 잠금/게스트 차단, 업로드 실패 초안 보존, 모바일 파일 input 숨김/키보드/네 언어. 원본과 글의 한 자료 저장 및 자동 분석 호출0을 확인했다. 최종 로컬 전체 웹352파일/3,840개와 473페이지 빌드가 통과했다. 기존 가져오기·표현 저장·FSRS·출처 귀환·서재 복귀 회귀 검사20조건도 오류0으로 통과했다. 기존 수동 E2E의 가져오기 대상은 `advanced=1`로 명시했고 새 기본 경로는 전용 composer E2E가 검사한다.

첫 실행 코드 `2c7f67718d9055812876256f258bbf3a4320b29b`의 [전체 GitHub CI](https://github.com/wonchance-art/manabi/actions/runs/34146229010)가 통과했다. Vercel 배포 `dpl_8HjGpJSZVzWrdziVt6cBxMiRHJqp`도 READY이며 고정 미리보기를 연결했다. 실제 로그인 계정의 새 편집기와 링크·언어 펼침·모바일 저장 영역을 확인했다. 실배포에서 발견한 안내 문자열의 리터럴 줄바꿈 표시를 수정했다. 최종 수정 head/CI/배포 식별은 [PR #1288](https://github.com/wonchance-art/manabi/pull/1288) 및 #150 인계에 기록한다.

적용 전 운영 Storage 정책을 읽기 전용으로 확인한 결과 기존 세 정책은 모두 `user-pdfs`와 본인 경로에 한정돼 있으며 새 bucket을 우회 노출하는 전체 bucket 허용 정책은 없었다. 원격81개와 로컬82개의 이력을 대조하여 미적용이 이번 SQL 하나임을 확인했고, 기존 composer 행·충돌은0이었다.

## 실제 저장·접근 검수 (2026-09-08)

오너 승인 이후 배포 `ada67c4a568c1253e5bd5c3007125aacbedad880` / `dpl_6Zfq67BYfPtpoFgz41uafMqK2eCa`에서 로그인 계정의 비공개 검수 자료2개를 만들었다. 직접 만든 PDF/EPUB fixture만 사용했다. 예시 확인을 위해 남겨 두었으며 기존 자료의 수정·삭제나 학습 채점은 하지 않았다.

- PDF 단독: `/viewer/219`. 본문 없이 원본1개, 언어 미지정으로 저장 성공. 실제 원본 렌더·2쪽 이동·새로고침 후2쪽 복구·서재에 항목1개·재열람 확인.
- EPUB+메모+링크: `/viewer/220`. 사용자가 입력한 제목·메모·빈 줄 보존, 링크 입력 후 별도 ‘추가’ 클릭 없이 저장에 포함. 원본1개+링크1개가 같은 자료에 저장됨. 목차·장 이동·새로고침 후2장 복구·서재 항목1개 확인. 모바일 실측 CSS354px 가로 넘침0.
- DB에서 두 행 모두 private/status=saved/language=null, 원문 일치, 원본 각각1개를 확인했다. 두 자료에 서버 학습 진도 행은0이며 원본 위치 기록을 학습 진도로 섞지 않았다.
- 실제 DB의 읽기 전용 트랜잭션에서 역할/claim을 전환하여 본인 자료·원본2/2, 비소유자0/0, anon 차단을 검증하고 ROLLBACK했다. 이는 두 번째 실제 로그인 계정의 UI 검수가 아니라 DB RLS 검사다.
- 별도 비로그인 브라우저에서 `/viewer/219`, `/viewer/220` 모두 ‘자료를 찾을 수 없어요’로 차단되고 본문·파일이 표시되지 않았다. PDF 공개 경로 요청도 HTTP400/NoSuchBucket으로 차단됐다.
- 임시 viewport는 원복했다. 서명 URL·인증 값은 검수 문서나 공개 인계에 포함하지 않는다. 이 검수는 해당 저장 흐름에 대한 확인이며 전체 운영 보안 감사를 의미하지 않는다.

이후 커밋은 이 결과 문서와 자기 보드만 갱신한다. 앱 실행 코드·배포는 검수한 `ada67c4a`를 유지하며 최종 문서 head는 PR/#150에 기록한다.
