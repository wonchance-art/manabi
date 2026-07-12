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
| `20260414000100_grammar_notes_srs.sql` | grammar_notes에 SRS 컬럼 (interval, ease_factor 등) | VocabPage 문법 복습 |
| `20260414000700_writing_practice.sql` | writing_practice 테이블 (RLS 포함) | VocabWriting 히스토리 |
| `20260414000300_token_corrections.sql` | token_corrections 테이블 (RLS 포함) | ViewerBottomSheet 교정 히스토리 |
| `20260414000600_vocab_decks_source.sql` | vocab_decks.source_material_id 컬럼 | ViewerPage 관련 덱 추천 |

### 이번 웨이브 마이그레이션 (2026-07) — 순서대로 실행

> ⚠️ **이 리포는 마이그레이션 CI 자동 적용이 없습니다.** 아래 4건은 Supabase 대시보드 → SQL Editor 에서 파일 전체를 순서대로 붙여넣어 **수동 실행**하세요. 특히 `20260703000100_streak_freeze_earn`은 `update_streak`을 `CREATE OR REPLACE`로 덮어쓰고 구 `buy_streak_freeze` RPC를 제거하므로 실행 확인이 필수입니다.

| 파일 | 추가 내용 | 의존 코드 |
|------|----------|-----------|
| `20260701000100_grammar_review.sql` | `grammar_review` 테이블(문법 SRS 큐, FSRS 컬럼) + `review_events` append-only 오답 로그 (둘 다 RLS) | LearnPage 문법 due 배지, `/review/grammar` 복습 큐, 약점 진단 |
| `20260702000100_writing_studio.sql` | `writing_practice`에 컬럼 추가(prompt_type·prompt·level·chapter_slug·errors·revision_of) | 라이팅 스튜디오 `/writing` 구조화 첨삭·재작문 |
| `20260703000200_study_paragraphs.sql` | `study_paragraphs` 테이블(오늘의 문단 저장소: prefetched/used/expired, RLS) | 공부 모드 `/study` 프리페치·연재, LearnPage 이번 주 세션·연재 화수 |
| `20260703000100_streak_freeze_earn.sql` | `update_streak` 재정의(7일 연속마다 프리즈 +1, 최대 2개) + `buy_streak_freeze` 제거 + `streak_freeze_count` 컬럼 재확인 | 스트릭 프리즈 자동 적립, LearnPage 스트릭 타일 |

### v4 '눈과 목소리' 마이그레이션 (2026-07) — 순서대로 실행

> ⚠️ 위와 동일하게 수동 실행(SQL Editor). 순서 무관하게 독립적이지만, `push_subscriptions`가 없으면 `/api/cron/send-forecast`·`/api/push/test`는 조회 실패로 아무것도 하지 않고 빈 응답을 반환한다(무해 폴백).

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
