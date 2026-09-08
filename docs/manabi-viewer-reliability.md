# 뷰어 신뢰성 1차

2026-09-09 · 오너의 뷰어 개선 설계 승인 및 “진행 가자”에 따른 구현.

부모: #1292, 7d7c6a6496243e014c17f9bd66161c34e9033212. 별도 worktree에서 기존 서재 변경과 실제 출처·복습 기록을 보존한다.

## 범위

1. 문맥 뜻을 사전 대표 뜻으로 덮는 동작 제거. 카드/저장 정보 일치 및 다른 의미의 예문 혼입 방지.
2. 단어/문장 요청의 늦은 응답, 전체 입력 캐시, 닫힌 카드 단축키, 저장 후 타이머 및 undo 수리.
3. 중국어 읽기 확인과 회화 음성 인식을 기존 언어 매핑에 연결. 실패 표시 및 입력 보존.
4. 기존 분석을 지우지 않고 새 결과를 준비한 뒤 성공 시에만 원자적 조건부 교체. 원문 수정 경로의 선저장도 함께 수리.

Aa 재배치·병음 조판·전체 활동 레이어 개편은 승인한 다음 차수다. 기존 반복 오류의 원인을 먼저 고친다. 새 음성 제작·PDF 조판·split view는 제외한다.

## 허용 파일

- `src/views/ViewerPage.jsx`, `src/views/SourceEditModal.jsx`
- `src/components/ViewerBottomSheet.jsx`, `src/components/ReadingTest.jsx`, `src/components/ConversationPanel.jsx`
- `src/lib/useReanalyze.js`, `src/lib/useReanalyzeUI.js`, `src/lib/viewerAnalysisCache.js`, `src/lib/synAnt.js`
- 이 기능에 필요한 순수 규칙/안전 저장 helper 신규 `src/lib/viewer*.js`, `src/lib/readingTest*.js`, `src/lib/reanalysis*.js`
- 해당 회귀 테스트 신규 `src/lib/__tests__/viewerReliability*.test.js`, `src/lib/__tests__/viewerSaveUndo.test.js`, `src/lib/__tests__/readingTestReliability.test.js`, `src/lib/__tests__/reanalysisPreservation.test.js` 및 `e2e/viewer-reliability.e2e.mjs`, `e2e/viewer-reliability-sql.e2e.mjs`
- 승인한 동작을 반대로 요구하던 배선 검사 10개 파일: `refVocabWiring`, `reviewReliabilityFixes`, `sourceEditWiring`, `wordCardUnify`, `gradeOutbox`, `grammarDetail`, `inlineReviewUndo`, `saveGrade`, `viewerAnalysisCache`, `tokenRangeSelect`(E2E 캐시 seed 형식만). 알고리즘·다른 화면 검사는 보존하고 변경한 동작의 계약만 교체한다.
- `e2e/learning-flow.e2e.mjs`: 기존 Gemini 0회·책 이동·단어/문장 선택 검증은 보존하며 캐시 seed만 새 키 형식으로 맞춘다.
- `public/sw.js`: prebuild가 생성한 콘텐츠 해시 갱신 1줄.
- 오너의 2026-09-09 “승인 ㄱㄱ”에 따른 DB 예외: `supabase/migrations/20260908234552_viewer_reliability_atomic_operations.sql` 신규 1개. 검토 SQL과 같은 함수 2개만 포함한다.
- 이 문서·검토용 `docs/manabi-viewer-reliability.sql`과 `docs/ai-tasks.md` 자기 항목(별도 커밋)

기존 규약은 참고하되 이번 사용자 승인에 포함된 문맥 표시·버튼 동작·읽기 확인 문구를 구현한다. 교재 corpus, 기존 FSRS 알고리즘, 월드, 환경 파일, 다른 세션의 공유 작업은 수정하지 않는다. 원자적 교체와 취소에 필요한 함수 2개는 별도 검토 SQL로 준비했다. 운영 테이블·컬럼·기존 데이터를 바꾸지 않는다. 2026-09-09 오너의 예외 승인 후 운영 DB에 두 함수를 적용했다. 임의 merge·force-push 없음.

## 검증

자료·언어·선택이 바뀐 느린 요청, 200자 이후만 다른 문장, 새 저장과 기존 복습, 닫힘/undo, 중국어 생성·음성 언어, 전체/부분 재분석 실패·취소·동시 수정·권한 없음. 자체 자료의 브라우저 검수와 전체 vitest·빌드. 실제 개인 자료의 재분석/교정/복습은 실행하지 않는다.

## 결과

- 전체 vitest: **362파일 / 3,924테스트 통과**. 기존 FSRS 계산·교재·다른 화면 회귀도 포함.
- 실제 React 페이지 + 합성 중국어 자료의 브라우저 검사: **17개 통과**, pageerror 0. Chrome 390 / 1138 / 1440px.
- 기존 학습 흐름의 viewer 검사: **통과**. 새 캐시 키로 결정적 fixture를 갱신했으며 Gemini 요청 0회와 모든 기존 화면 검증을 유지.
- 수동 교정 결과가 갱신되어도 같은 토큰의 카드를 유지하며, 자료/계정 이동 시에는 선택을 초기화한다.
- 독립 로컬 Postgres(PGlite) 검증: **13개 통과**. 원자적 교체, 동일 시도 재확인, 다른 창 수정 충돌, 익명/비소유자 거부, 새 복습·문맥 보호, RLS로 숨겨진 문맥의 연쇄 삭제 방지.
- 실제 Supabase: migration `20260908234552` 적용 성공. 함수 본문 MD5가 검토 SQL과 일치하며 익명 실행 불가·authenticated 실행 허용·PUBLIC 회수·고정 search_path 확인. NULL ID만 사용하는 실제 권한 검사 6개 통과, 개인 자료/단어 행 쓰기 없음. PostgREST 스키마도 새로고침했다.
- 수정 JSX를 포함한 ESLint: 오류 0. 기존 이합사 아치 effect 의존성 경고 1개 유지. 기본 저장소 lint가 JSX를 건너뛰므로 명시적으로 JSX를 포함한 설정으로 추가 검사.
- `npm run prebuild`: 통과. 기존 교육과정 경고 11개(변경 범위 밖).
- 로컬 프로덕션 빌드(dbfc16a9): 473페이지 생성 및 빌드 성공. 기본 2GB heap 실패 후 4GB로 실행. 재생성 가능한 Webpack 캐시 쓰기 경고 뒤 빌드는 정상 종료했고 캐시 3.8GB를 정리했다. 실행 커밋 `94cff1f1da37b29955a136d7aa43e976cc13253a`의 CI·Vercel 빌드·배포 화면 17검사도 통과했다. 이후 변경은 적용 SQL의 이력 파일·SQL 검사 경로·검수 기록뿐이며 웹 코드는 같다.

## DB 적용 순서와 한계

운영 DB에는 두 함수 적용을 완료했다. 기존 검수 미리보기에서 사용할 수 있으며, 운영 웹 병합은 Claude가 수행한다. 함수가 없으면 새 재분석/저장 취소는 실패 메시지와 함께 기존 자료를 유지한다. 무조건 UPDATE/DELETE로 되돌아가는 fallback은 없다.

`viewer_replace_analysis`는 SECURITY INVOKER + 소유자 행 잠금 + 시작 시점의 원문/JSON 전체 비교다. `viewer_undo_vocabulary_save`만 SECURITY DEFINER로 실행한다. 소유자 확인 후 다른 출처까지 모두 확인해야, SELECT RLS에서 숨겨진 출처가 CASCADE로 삭제되지 않는다. 후자는 행·출처 정보를 반환하지 않으며, 실행은 authenticated로 제한한다.

보안 advisor는 `authenticated_security_definer_function_executable` 경고 1개를 추가했다. `viewer_undo_vocabulary_save`의 의도한 로그인 사용자 호출이며, 사용자 ID/소유자 확인·행 잠금·행 전체 스냅샷·모든 문맥 비교·익명/PUBLIC 회수를 검증했다. 기존 다른 경고는 동일하다. [Supabase 검토 기준](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

온라인 인라인 복습 취소는 해당 복습 시각이 아직 최신일 때만 복원한다. 오프라인 큐는 현재 전송과 취소 사이의 잠금이 없어 이번에는 안전하게 거절하고 기록을 유지한다. 전체 outbox 재설계는 별도 후속이다.

재분석의 원문 줄·토큰 문자 커버를 검증하며, 같은 줄/위치/표기의 수동 교정은 보존한다. 줄 이동 뒤 교정 필드 표식을 이어 주며 과거 교정 로그를 수정하지 않는다. 분할이나 문장이 바뀐 곳에는 이전 교정을 임의로 옮기지 않는다.

일반 사전 상세 설명의 기존 외부 요청 범위는 유지했다. 본문 전체를 추가 전송하는 새 경로는 자동 승인 검토에서 차단되어 채택하지 않았다. 현재 상세 설명에 일반 사전임을 명시하고, 기존 ‘이 문장에서는?’ 기능과 구분한다.

## 다음 차수

Aa 구조/언어별 서체, 병음 크기와 줄간격, 실제 어두운 배경, 읽기 위치 유지, 집중·가림·페이서·받아쓰기 레이어를 수리한다. 큰 단어 카드와 하단 활동 배치는 이 단계에서 함께 정리한다. 이번 1차에 포함됐다고 보고하지 않는다.

## 재현

Node 24.20.0. 먼저 `npm run e2e:build` 후 테스트 env의 Next 서버를 실행한다. `QA_BASE=http://127.0.0.1:8897 QA_CHROME=<Chrome 실행 파일> node e2e/viewer-reliability.e2e.mjs`. 이 스크립트는 auth/DB/AI를 모두 합성 fixture로 차단하여 실제 개인 자료를 쓰지 않는다.

SQL 검증은 별도 설치한 PGlite에 대해 `QA_PGLITE_MODULE=<설치한 모듈 경로> node e2e/viewer-reliability-sql.e2e.mjs`. 운영 DB 연결 없이 임시 테이블·RLS로 검증한다.
