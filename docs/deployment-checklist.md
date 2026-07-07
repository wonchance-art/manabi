# 배포 체크리스트 (2026-04-14 최초 · 2026-07-07 갱신)

## 1. 마이그레이션 배포

### 새로 추가된 마이그레이션 (순서대로 실행)

```bash
# 개발 환경 로컬 DB (선택)
supabase db reset

# 원격 프로덕션
supabase db push
```

**실행되어야 할 파일:**

| 파일 | 추가 내용 | 의존 코드 |
|------|----------|-----------|
| `20260414_grammar_notes_srs.sql` | grammar_notes에 SRS 컬럼 (interval, ease_factor 등) | VocabPage 문법 복습 |
| `20260414_writing_practice.sql` | writing_practice 테이블 (RLS 포함) | VocabWriting 히스토리 |
| `20260414_token_corrections.sql` | token_corrections 테이블 (RLS 포함) | ViewerBottomSheet 교정 히스토리 |
| `20260414_vocab_decks_source.sql` | vocab_decks.source_material_id 컬럼 | ViewerPage 관련 덱 추천 |

### 이번 웨이브 마이그레이션 (2026-07) — 순서대로 실행

> ⚠️ **이 리포는 마이그레이션 CI 자동 적용이 없습니다.** 아래 4건은 Supabase 대시보드 → SQL Editor 에서 파일 전체를 순서대로 붙여넣어 **수동 실행**하세요. 특히 `20260703_streak_freeze_earn`은 `update_streak`을 `CREATE OR REPLACE`로 덮어쓰고 구 `buy_streak_freeze` RPC를 제거하므로 실행 확인이 필수입니다.

| 파일 | 추가 내용 | 의존 코드 |
|------|----------|-----------|
| `20260701_grammar_review.sql` | `grammar_review` 테이블(문법 SRS 큐, FSRS 컬럼) + `review_events` append-only 오답 로그 (둘 다 RLS) | LearnPage 문법 due 배지, `/review/grammar` 복습 큐, 약점 진단 |
| `20260702_writing_studio.sql` | `writing_practice`에 컬럼 추가(prompt_type·prompt·level·chapter_slug·errors·revision_of) | 라이팅 스튜디오 `/writing` 구조화 첨삭·재작문 |
| `20260703_study_paragraphs.sql` | `study_paragraphs` 테이블(오늘의 문단 저장소: prefetched/used/expired, RLS) | 공부 모드 `/study` 프리페치·연재, LearnPage 이번 주 세션·연재 화수 |
| `20260703_streak_freeze_earn.sql` | `update_streak` 재정의(7일 연속마다 프리즈 +1, 최대 2개) + `buy_streak_freeze` 제거 + `streak_freeze_count` 컬럼 재확인 | 스트릭 프리즈 자동 적립, LearnPage 스트릭 타일 |

### 배포 후 검증 쿼리

```sql
-- 1. 컬럼 존재 확인
SELECT column_name FROM information_schema.columns
WHERE table_name = 'grammar_notes' AND column_name IN ('interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'vocab_decks' AND column_name = 'source_material_id';

-- 2. 테이블 존재 확인
SELECT tablename FROM pg_tables
WHERE tablename IN ('writing_practice', 'token_corrections');

-- 3. RLS 정책 확인
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('writing_practice', 'token_corrections');
```

### 마이그레이션이 실패하면 기능 영향

- `grammar_notes_srs` 실패 → 문법 노트 복습 시 런타임 오류, 복습 리스트에서 문법 제외됨
- `writing_practice` 실패 → 쓰기 연습 히스토리 로드/저장 실패 (기능 자체는 메모리로 작동)
- `token_corrections` 실패 → AI 오류 교정 저장은 성공, 히스토리 조회만 빈 배열
- `vocab_decks_source` 실패 → 덱 생성 시 insert 에러, 관련 덱 추천 섹션 빈 상태
- `grammar_review` 실패 → 문법 복습 큐·오답 로그 런타임 오류, LearnPage 문법 due 배지 0, `/review/grammar` 빈 상태
- `writing_studio` 실패 → 라이팅 스튜디오 저장 시 컬럼 누락 오류(구조화 첨삭·재작문 링크 유실)
- `study_paragraphs` 실패 → 앱은 무해 폴백(프리페치 저장/조회 무시 → 라이브 경로로 생성)하나 연재·이번 주 세션·서재 세션 집계가 0
- `streak_freeze_earn` 실패 → 스트릭 프리즈 자동 적립 안 됨, 구 `buy_streak_freeze` 잔재 유지

**가장 위험한 것은 `vocab_decks_source`** — 컬럼이 없으면 createDeckMutation이 INSERT 단계에서 실패.

## 2. 환경 변수 확인

```
GEMINI_API_KEY=<valid key>
NEXT_PUBLIC_SUPABASE_URL=<prod url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key>
NEXT_PUBLIC_SITE_URL=<prod domain, for robots/sitemap>
SUPADATA_API_KEY=<optional — 듣고 읽기 자막 폴백>
CRON_SECRET=<cron 인증 — /api/cron/* Bearer 토큰>
```

- `SUPADATA_API_KEY` (선택) — `/api/media/captions` step 5 Supadata 폴백. 없으면 자막 자동 폴백만 조용히 스킵(핵심 정독 흐름·`.srt/.vtt` 직접 업로드는 불변).
- `CRON_SECRET` (Vercel Cron 사용 시 필수) — `/api/cron/fetch-suggestions`·`/api/cron/backfill-ipa` GET의 `Bearer` 인증. 미설정 시 fail-closed(cron 요청 거부: 500/401)라 자동 수집·IPA 백필이 멈춘다.

## 3. 배포 후 관찰 포인트

### Gemini 통계 확인
- 관리자 페이지 → `✨ Gemini 통계` 탭
- 첫 24시간:
  - 에러율 > 5%면 프롬프트 이슈 점검
  - 평균 레이턴시 > 5000ms면 프롬프트 길이 축소 고려
  - fallbackUsed 비율 높으면 기본 모델 전환 고려

### Supabase 로그
- `Database` → `Logs` → RLS 거부 패턴 확인
- 특히 `token_corrections`, `writing_practice` insert에서 403 나오면 RLS 정책 재점검

### Service Worker 캐시
- 배포 후 기존 사용자가 새 SW를 받으려면 새로고침 1회 필요
- `anatomy-studio-v<timestamp>` 형식으로 버전이 자동 갱신됐는지 확인

## 4. 롤백 절차

문제 발생 시 각 마이그레이션 역산:

```sql
-- grammar_notes SRS 컬럼 제거
ALTER TABLE grammar_notes
  DROP COLUMN IF EXISTS interval,
  DROP COLUMN IF EXISTS ease_factor,
  DROP COLUMN IF EXISTS repetitions,
  DROP COLUMN IF EXISTS next_review_at,
  DROP COLUMN IF EXISTS last_reviewed_at;

-- writing_practice 테이블 제거
DROP TABLE IF EXISTS writing_practice;

-- token_corrections 테이블 제거
DROP TABLE IF EXISTS token_corrections;

-- vocab_decks source 컬럼 제거
ALTER TABLE vocab_decks DROP COLUMN IF EXISTS source_material_id;
```

단, 롤백 전에 해당 테이블/컬럼을 참조하는 코드 변경이 먼저 배포되어야 함.
