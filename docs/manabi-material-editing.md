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
- 새 컬럼이 없는 환경은 기존 읽기/작성 그대로 유지, 수정 진입에서 연결 상태를 알린다. 아래 DDL의 저작·적용과 공개 push·draft PR·미리보기 승인 질문 후 오너가 “작업 재개.”로 진행을 지시했다. 이번 명시적 범위에 한해 migration을 저작하고 기존 직렬화 workflow로 적용한다. 일반 DB 저작 금지의 범용 예외로 확대하지 않는다.

```sql
ALTER TABLE public.reading_materials ADD COLUMN IF NOT EXISTS document_json jsonb;
ALTER TABLE public.reading_materials ADD CONSTRAINT reading_materials_document_private_v1 CHECK (
  document_json IS NULL OR (
    COALESCE(visibility = 'private', false) AND owner_id IS NOT NULL
    AND COALESCE(processed_json->'metadata'->'composer'->>'version' = '1', false)
    AND COALESCE(document_json->>'version' = '1', false)
    AND COALESCE(jsonb_typeof(document_json->'body') = 'string', false)
    AND COALESCE(document_json->>'revision' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$', false)
  )
);

-- Older open viewers also share this database. Enforce source identity there,
-- while allowing analysis dictionaries/status and the new document to change.
CREATE OR REPLACE FUNCTION public.protect_composer_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.processed_json->'metadata'->'composer'->>'version' = '1' AND (
    NEW.raw_text IS DISTINCT FROM OLD.raw_text
    OR NEW.processed_json->'metadata'->'composer' IS DISTINCT FROM OLD.processed_json->'metadata'->'composer'
    OR NEW.processed_json->'metadata'->'importAttempt' IS DISTINCT FROM OLD.processed_json->'metadata'->'importAttempt'
  ) THEN
    RAISE EXCEPTION 'composer_source_is_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_composer_source
BEFORE UPDATE OF raw_text, processed_json ON public.reading_materials
FOR EACH ROW EXECUTE FUNCTION public.protect_composer_source();
```

기존 행 backfill/테이블/외부 호출 RPC/권한 변경 없음. 기존 탭에서도 학습 원문을 덮어쓰지 못하도록 composer 원문·출처 식별자를 보호하는 UPDATE 트리거를 적용한다. 분석 dictionary/status는 계속 갱신할 수 있다. 기존 행은 null로 통과한다. 기존 소유자 RLS가 새 컬럼에도 적용된다. CLI 2.90.0의 `supabase migration new material_document_editing`로 `20260907221311_material_document_editing.sql`을 생성했다. 검토한 SQL과 동일하며 독립 Postgres 검사는 이제 이 파일을 직접 읽는다.

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
src/components/web/library-discovery.css(실계정 모바일 왕복에서 재현한 묶음 카드 넘침 수정),
e2e/material-editing.e2e.mjs 및 전용 fixture, scripts/verification/material-editing.mjs,
supabase/migrations/20260907221311_material_document_editing.sql(오너 재개 승인),
이 문서, docs/ai-tasks.md 자기 항목, prebuild가 갱신하는 public/sw.js의 캐시 식별자.

금지: 기존 개인 데이터 수정, 학습 콘텐츠/판본/PDF 조판/음성/world/복습 일정 변경, 기존 테스트 의미 변경, merge/force-push, 운영 alias 승격, 환경 파일 열람.

## 검증 계획

원문/기존 표현 불변, title-only/body/language 수정, 첨부 보존·교체, 사본 재사용, 응답 유실, 동시 수정, 계정/자료별 초안, 권한·삭제·빈 상태, 컬럼 미적용 상태. 데스크톱/모바일 실제 앱과 합성 DB로 저장→재열람→학습 사본→예전 출처 복귀를 검증한다. 전체 vitest 및 Next build, 기존 composer/reading-loop e2e 회귀를 실행한다.

## 검수 기록

- 전체 Vitest: 353파일 / 3,857개 통과. 빌드와 무제한 병렬 실행 시 기존 studiesRefs의 60초 beforeAll이 시간 초과했으며, 빌드 종료 후 `npm test -- --maxWorkers=2`로 전체를 다시 실행해 통과했다. 기존 테스트·타임아웃 수정 없음.
- 최종 데이터/목록 계약 집중 검사: 5파일 / 51개 통과. 현재 글 저장은 title/document만 쓰고 raw_text·dictionary·sequence를 바꾸지 않음을 검증했다.
- 독립 PGlite: 제안 DDL 실행, 기존 탭의 원문 덮어쓰기 차단, 분석 결과 갱신 허용, revision 충돌, 비공개/자료 형식 CHECK, 비소유자/비로그인 차단 통과. 실제 운영 DB 검사는 아래 배포 기록에 별도로 남긴다.
- 독립 IndexedDB: 계정별·자료별 초안/Blob 분리, 새 자료 초안 공존, 해당 초안만 정리 통과. 기존 원본 저장소 검증 스크립트도 통과했다.
- 실제 앱 + 합성 HTTP 경계: 수정 7개 흐름(데스크톱/모바일, 첨부 교체, 중복/응답 유실/실패, 동시 수정, 새 초안 공존, 저장 후 재수정, 필터 복귀, DB 미적용/권한 상태) 통과. 모바일 재진입 때 query 갱신으로 Web Lock을 재획득하던 오류를 발견해 편집 시작 시점을 고정하고 최신 자료 로딩 후 진입하도록 수정했다.
- 기존 새 자료 편집기 8흐름, 기존 가져오기→표현 저장→복습→원문 귀환 20조건 통과. 브라우저 pageerror 0. 실제 개인 자료·표현·채점 기록에는 쓰지 않았다.
- Next 배포 빌드 473개 정적 페이지 생성 성공. 기존 curriculum 경고 11개, lessonAdapters/lessonModel의 기존 anonymous-default-export 경고 2개는 이번 변경 범위 밖이다.
- 긴 제목은 휴대폰에서도 전체를 보며 수정할 수 있도록 줄바꿈 높이를 맞추고, 작은 첨부 파일 용량은 KB로 표시한다. 실제 캡처는 로컬 검수 아티팩트로 제공한다.

## 반영 순서와 남은 작업

1. 부모 #1288 → 이 stacked PR을 Claude가 검토. 승인된 additive migration 파일을 함께 포함한다.
2. 승인된 document_json 컬럼·CHECK·원문 보호 트리거를 기존 GitHub migration workflow로 적용한다. 실행 전 원격 이력과 로컬 파일을 비교해 이번 SQL만 미적용인지 확인한다. 기존 운영 원문에는 UPDATE가 없다.
3. 이번 미리보기에서 실제 계정의 새 검수 자료를 만들어 수정/첨부 교체/원문 복귀를 확인한 후 고정 미리보기와 운영 전환을 검토한다. 지금은 운영과 기존 고정 미리보기 alias를 변경하지 않는다.
4. 다음 차수: 읽던 자료·최근 저장 중심 서재 목록/컬렉션. 그 다음에 새 원본에서 선택한 구간 학습을 다룬다. 전면 편집 이력 UI, 미참조 업로드 정리, 기기 간 원본 위치 동기화는 별도 후속이다.

## 공개 전송 상태

구현 커밋 3fbc46b7. 새 브랜치 push는 자동 승인 검토가 이전 승인의 범위를 다른 브랜치로 한정해 거절했다. 우회 전송하지 않았으며 원격 PR/배포/DB 변경은 없다. 공개 push·draft PR·새 Vercel 미리보기와 DB 저작·적용의 구체적인 승인 질문 뒤 오너가 “작업 재개.”로 진행을 지시했다. 해당 범위의 전송과 적용을 재개하며 결과를 아래에 기록한다.

## 실계정 검수 중 보완

오너가 커밋8e240a86의 공개 push·PR·미리보기·DB 적용에 “승인.”으로 명시 승인했다. PR #1289, DB workflow34169580009 성공; 실행8e240a86 CI34169542567 전체 성공. 승인 migration20260907221311의 컬럼·validated CHECK·원문 보호 trigger·invoker/search_path·RLS 확인. 보안 advisor는 적용 전후55개 동일, 추가0.

실제 검수에서 새 비공개 글 저장→수정(본문·제목·PDF→EPUB)→새로고침→학습 사본→현재 글→모바일 재수정→학습 사본 재사용→서재 복귀가 동작했다. 원문과 processed_json 해시 불변, 현재 EPUB와 retained PDF 실제 객체 존재. 분석/표현 저장/복습 채점은 실행하지 않았다.

모바일(CSS354px) 서재 복귀 시 기존 묶음 카드의28px 가로 넘침을 재현했다. 모바일1fr의 자동 최소 너비가 내용 최소폭에 끌리는 문제여서 minmax(0,1fr)와 카드 min-width:0으로 고친다. 서재 전체 개편을 확대하지 않고 이번 왕복 흐름의 반응형 오류만 보완한다. 최종 배포에서 넘침0을 다시 측정한다.
