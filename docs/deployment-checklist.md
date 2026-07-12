# 배포 체크리스트 (2026-04-14 최초 · 2026-07-12 갱신)

## 1. 마이그레이션 배포 — canonical 절차 (2026-07-12 확정)

> 과거 이 문서의 "마이그레이션 CI 자동 적용 없음 · SQL Editor 수동 실행" 안내는 **폐기**됐다.
> 수동 SQL Editor 실행이 히스토리 드리프트(원격 `schema_migrations` 와 로컬 파일 불일치 →
> `db push` 거부)를 만든 원인이었다. 아래 절차만 따른다.

1. **마이그레이션은 파일로만 작성한다** — `supabase/migrations/YYYYMMDDHHMMSS_name.sql`
   (14자리 **고유** 타임스탬프, 문자 접미 금지). 재적용에 안전하도록 **멱등**으로 작성:
   `CREATE TABLE/INDEX IF NOT EXISTS` · `CREATE OR REPLACE FUNCTION` ·
   `DROP POLICY IF EXISTS` 뒤 `CREATE POLICY` · `ADD COLUMN IF NOT EXISTS` · `REVOKE/GRANT`.
   (전 파일 개명 이력은 `supabase/migrations/RENAME-MAP.md` 참고.)
2. **main 병합 시 CI 가 자동 적용한다** — `.github/workflows/supabase-migrations.yml` 이
   `supabase db push` 를 실행한다(GitHub Secrets `SUPABASE_ACCESS_TOKEN` ·
   `SUPABASE_PROJECT_REF` · `SUPABASE_DB_PASSWORD` 3종 전제). 시크릿 미설정이면 skip 하되
   `::warning` + 잡 요약으로 크게 표시된다(조용한 success 없음). push 출력에
   "Skipping migration" 이 있으면 실패한다(파일명 규약 위반 재발 방지 가드).
3. **SQL Editor 직접 실행 금지** — 히스토리에 남지 않아 드리프트가 재발한다.
   로컬 검증은 `supabase db reset`, 원격 반영은 오직 main 병합(CI)으로.
4. **일회성 복구** — 히스토리가 어긋났을 때는 `.github/workflows/supabase-repair.yml` 을
   Actions 에서 수동 dispatch 한다(preflight probe → `migration repair` → `db push` →
   postcondition probe. probe SQL: `scripts/db-probes.sql` · `scripts/db-postconditions.sql`).
5. **사후 검증** — repair 워크플로의 postcondition 스텝(핵심 객체 실존 probe)과
   `supabase migration list` 출력으로 확인한다. 아래 "배포 후 검증 쿼리"는 보조 수단.

### (기록) 마이그레이션별 내용 참고표

> 아래 표들은 각 마이그레이션이 무엇을 만들었는지의 참고 기록이다(파일명은 개명 후 기준).
> **더 이상 수동 실행 지시가 아니다** — 적용은 위 canonical 절차로.

| 파일 | 추가 내용 | 의존 코드 |
|------|----------|-----------|
| `20260414000100_grammar_notes_srs.sql` | grammar_notes에 SRS 컬럼 (interval, ease_factor 등) | VocabPage 문법 복습 |
| `20260414000700_writing_practice.sql` | writing_practice 테이블 (RLS 포함) | VocabWriting 히스토리 |
| `20260414000300_token_corrections.sql` | token_corrections 테이블 (RLS 포함) | ViewerBottomSheet 교정 히스토리 |
| `20260414000600_vocab_decks_source.sql` | vocab_decks.source_material_id 컬럼 | ViewerPage 관련 덱 추천 |

### 2026-07 웨이브 마이그레이션 (기록)

> 참고: `20260703000100_streak_freeze_earn`은 `update_streak`을 `CREATE OR REPLACE`로 덮어쓰고 구 `buy_streak_freeze` RPC를 제거한다(적용 여부는 repair 워크플로 preflight probe 가 `buy_streak_freeze` 부재로 검증).

| 파일 | 추가 내용 | 의존 코드 |
|------|----------|-----------|
| `20260701000100_grammar_review.sql` | `grammar_review` 테이블(문법 SRS 큐, FSRS 컬럼) + `review_events` append-only 오답 로그 (둘 다 RLS) | LearnPage 문법 due 배지, `/review/grammar` 복습 큐, 약점 진단 |
| `20260702000100_writing_studio.sql` | `writing_practice`에 컬럼 추가(prompt_type·prompt·level·chapter_slug·errors·revision_of) | 라이팅 스튜디오 `/writing` 구조화 첨삭·재작문 |
| `20260703000200_study_paragraphs.sql` | `study_paragraphs` 테이블(오늘의 문단 저장소: prefetched/used/expired, RLS) | 공부 모드 `/study` 프리페치·연재, LearnPage 이번 주 세션·연재 화수 |
| `20260703000100_streak_freeze_earn.sql` | `update_streak` 재정의(7일 연속마다 프리즈 +1, 최대 2개) + `buy_streak_freeze` 제거 + `streak_freeze_count` 컬럼 재확인 | 스트릭 프리즈 자동 적립, LearnPage 스트릭 타일 |

### v4 '눈과 목소리' 마이그레이션 (기록)

> 참고: 순서 무관하게 독립적이지만, `push_subscriptions`가 없으면 `/api/cron/send-forecast`·`/api/push/test`는 조회 실패로 아무것도 하지 않고 빈 응답을 반환한다(무해 폴백). 적용은 canonical 절차(CI)로 — SQL Editor 수동 실행 금지.

| 파일 | 추가 내용 | 의존 코드 |
|------|----------|-----------|
| `20260708000100_admin_metrics_rpc.sql` | 집계 전용 RPC(`admin_funnel`·`admin_daily_metrics`·`admin_v3_metrics`·`admin_content_health` 등, `SECURITY DEFINER`) | `admin/metrics` 대시보드 |
| `20260708000200_push_subscriptions.sql` | `push_subscriptions` 테이블(user_id·endpoint unique·keys jsonb·lang·preferred_hour smallint UTC·RLS own-row) | 구독 배관(`sw.js` push 핸들러, 설정 토글), `/api/cron/send-forecast`·`/api/push/test` 발송 회로 |

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
- `admin_metrics_rpc` 실패 → `admin/metrics` 대시보드 RPC 호출 에러(행 단위 조회로 폴백하지 않음 — PII 보호를 위해 의도적으로 대체 경로 없음)
- `push_subscriptions` 실패 → 구독 생성/조회 실패(무해 폴백, `push.js` 주석 참고), `/api/cron/send-forecast`·`/api/push/test`는 빈 구독 목록으로 취급해 아무것도 보내지 않음(404/checked:0)

**가장 위험한 것은 `vocab_decks_source`** — 컬럼이 없으면 createDeckMutation이 INSERT 단계에서 실패.

## 2. 환경 변수 확인

```
GEMINI_API_KEY=<valid key>
NEXT_PUBLIC_SUPABASE_URL=<prod url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key>
NEXT_PUBLIC_SITE_URL=<prod domain, for robots/sitemap>
SUPADATA_API_KEY=<optional — 듣고 읽기 자막 폴백>
CRON_SECRET=<cron 인증 — /api/cron/* Bearer 토큰>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<웹 푸시 VAPID 공개키>
VAPID_PRIVATE_KEY=<웹 푸시 VAPID 비밀키>
VAPID_SUBJECT=<mailto:운영자 이메일 또는 https://사이트 도메인>
```

- `SUPADATA_API_KEY` (선택) — `/api/media/captions` step 5 Supadata 폴백. 없으면 자막 자동 폴백만 조용히 스킵(핵심 정독 흐름·`.srt/.vtt` 직접 업로드는 불변).
- `CRON_SECRET` (Vercel Cron 사용 시 필수) — `/api/cron/fetch-suggestions`·`/api/cron/backfill-ipa`·`/api/cron/send-forecast` GET/POST의 `Bearer` 인증. 미설정 시 fail-closed(cron 요청 거부: 500/401)라 자동 수집·IPA 백필·푸시 발송이 멈춘다.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` (웹 푸시 발송 — 기획 v4 §4.2) — 셋 다 있어야 발송된다. 하나라도 없으면 fail-soft: `/api/cron/send-forecast`는 `{skipped:'no-vapid'}` 200, `/api/push/test`는 `{skipped:'no-vapid'}` 503을 반환하고 아무것도 보내지 않는다(구독·설정 UI 자체는 영향 없음).
  - 키 쌍 생성: `npx web-push generate-vapid-keys` (로컬에서 1회 실행, 커밋하지 말 것).
  - 등록 절차: Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 **Preview**와 **Production** 두 환경 모두에 3키를 등록한다(Preview 프로덕션 검증에도 `/api/push/test`를 쓰므로 Preview 누락 시 그 환경만 조용히 무발송).
  - `VAPID_SUBJECT`는 `mailto:` 또는 `https://` 형식이어야 web-push 라이브러리가 허용한다.

### `/api/cron/send-forecast` — vercel.json에 아직 등록하지 않았다

**의도적으로 `vercel.json`을 수정하지 않았다.** 이유: Vercel **Hobby 플랜은 cron 2개·일 1회 스케줄 제한**이 있고, 현재 `vercel.json`에 이미 `fetch-suggestions`(1일 1회)·`backfill-ipa`(1일 1회) 2건이 등록돼 자리가 꽉 차 있다. `send-forecast`는 기획상 **매시 실행**(`preferred_hour` 매칭)이 필요해 Hobby 플랜에서는 등록 자체가 배포를 깨뜨릴 수 있다(cron 개수 초과 또는 매시 스케줄 거부).

**지시:** Vercel 플랜이 **Pro 이상**임을 확인한 뒤에만 `vercel.json`의 `crons` 배열에 아래 항목을 추가하라.

```json
{ "path": "/api/cron/send-forecast", "schedule": "0 * * * *" }
```

**그 전까지의 검증 경로:** `vercel.json`에 cron이 없어도 라우트 자체는 배포돼 있다. 로그인 후 `/api/push/test`(POST, Bearer 세션 토큰)를 호출하면 하루 1회 상한을 무시하고 즉시 발송해 발송 회로 전체(카피 엔진·VAPID·구독)를 수동으로 확인할 수 있다. cron 자동 실행(매시·시간대 매칭)만 Pro 전환 후로 미뤄진 것이다.

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
