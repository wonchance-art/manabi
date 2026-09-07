# 서재 저장 후 편집 — 구현 SPEC (2026-09-08 KST)

오너의 “좋아 더 할 거 있나. 승인함”, “좋아 계속 진행”에 따라 저장 후 편집을 먼저 구현한다. 부모 PR #1288은 그대로 두고 `codex/material-editing-20260908`에서 작업한다. 기존 웹 단일 편집기 방향을 재사용하며 운영 merge는 Claude 창구다.

## 사용자 흐름

읽는 글 → 수정 → 같은 제목/본문/파일/링크 편집기 → 변경 저장 → 같은 자료 주소.
자료별 초안과 새 글 초안은 분리한다. 충돌 시 다른 기기의 변경을 덮어쓰지 않고 내 초안을 내려받거나 최신 글을 다시 연다. 학습에 쓰인 원문은 편집 대상이 아니다. 고친 글의 본문 학습은 별도 비공개 학습 사본으로 연결되며 예전 표현은 예전 사본으로 돌아간다.

## 데이터 계약

- `raw_text`와 `processed_json`은 기존 학습 출처다. 현재 글은 nullable `document_json`에 독립 저장한다. 분석 요청이 진행 중이어도 서로 덮어쓰지 않는다.
- 수정은 소유자 + 이전 document revision 비교 후 제목/document만 갱신한다. 재시도 revision 확인으로 응답 유실을 복구한다. v1 자료는 document null을 최초 비교값으로 쓴다.
- 파일은 기존 owner/importAttempt/hash 경로에 불변 업로드한다. 첨부 취소는 현재 글에서만 제거하고 이전 파일은 retainedAssets에 둔다. 자료를 명시적으로 삭제할 때만 원본 정리 대상이다.
- 학습 사본은 owner/root/body/language SHA로 중복 방지한다. 기존 importAttempt unique index, 분석기, 표현 저장, FSRS, 출처 링크를 재사용한다. 사본은 서재의 저장 자료 목록에서 숨기고 읽던 학습 목록/표현 출처에서는 접근 가능하다.
- 새 컬럼이 없는 환경은 기존 읽기/작성 그대로 유지, 수정 진입에서 연결 상태를 알린다. 운영 DB 적용은 이번 변경 완성 후 검토한다. AGENTS.md의 migration 저작 금지에 따라 아래 DDL은 **Claude/오너에게 넘기는 제안**이며 supabase/migrations를 만들거나 운영 적용하지 않는다.

```sql
ALTER TABLE public.reading_materials ADD COLUMN IF NOT EXISTS document_json jsonb;
ALTER TABLE public.reading_materials ADD CONSTRAINT reading_materials_document_private_v1 CHECK (
  document_json IS NULL OR (
    visibility = 'private' AND owner_id IS NOT NULL
    AND COALESCE(processed_json->'metadata'->'composer'->>'version' = '1', false)
    AND COALESCE(document_json->>'version' = '1', false)
    AND COALESCE(jsonb_typeof(document_json->'body') = 'string', false)
    AND COALESCE(document_json->>'revision' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$', false)
  )
);
```

기존 행 backfill/테이블/RPC/권한 변경 없음. 기존 행은 null로 통과한다. 기존 소유자 RLS가 새 컬럼에도 적용된다. 검토 후 Claude가 CLI `supabase migration new`로 저작한다.

## 선례·재사용 판단

| 후보 | 판단 | 이유 |
|---|---|---|
| 기존 ComposerForm, IndexedDB, materialImport, PDF/EPUB 뷰어 | 채택 | 파일/본문 혼합 편집과 기존 학습 출처 정본 재사용 |
| [Notion 버전 보존](https://www.notion.com/help/duplicate-delete-and-restore-content) | 부분 채택 | 학습 당시 원문 보존 원칙만 적용, 전체 편집 이력 UI는 후속 |
| [Supabase 조건부 update](https://supabase.com/docs/reference/javascript/update) | 채택 | 서버에서 이전 revision 비교, 동시 수정 방지 |
| Tiptap/Lexical 신규 에디터 | 보류 | 승인한 본문 입력·첨부 UI에 필요 없는 문서 포맷/의존성 전환을 피함 |

## 허용 범위

src/lib/materialDocument.js, src/lib/materialComposer.js, src/lib/composerDraft.js, 새 문서/초안 테스트,
src/components/materials/MaterialComposer.jsx, MaterialEntry.jsx, MaterialEditor.jsx, OriginalMaterialReader.jsx, material-composer.css,
src/app/(app)/materials/[id]/edit/page.jsx,
src/views/MaterialsPage.jsx, ViewerPage.jsx,
e2e/material-editing.e2e.mjs 및 전용 fixture, scripts/verification/material-editing.mjs,
이 문서, docs/ai-tasks.md 자기 항목.

금지: 기존 개인 데이터 수정, 학습 콘텐츠/판본/PDF 조판/음성/world/복습 일정 변경, 기존 테스트 의미 변경, merge/force-push, 운영 alias 승격, 환경 파일 열람.

## 검증 계획

원문/기존 표현 불변, title-only/body/language 수정, 첨부 보존·교체, 사본 재사용, 응답 유실, 동시 수정, 계정/자료별 초안, 권한·삭제·빈 상태, 컬럼 미적용 상태. 데스크톱/모바일 실제 앱과 합성 DB로 저장→재열람→학습 사본→예전 출처 복귀를 검증한다. 전체 vitest 및 Next build, 기존 composer/reading-loop e2e 회귀를 실행한다.
