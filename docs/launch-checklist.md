# 공개 런칭 체크리스트

> `deployment-checklist.md`는 DB 마이그레이션 중심. 이 문서는 **첫 공개(public launch)** 시 한 번만 해야 하는 Supabase/인프라 설정을 정리한다.

## 1. Supabase 프로젝트 설정 (Dashboard)

### Authentication → URL Configuration
- [ ] **Site URL** = 프로덕션 도메인 (예: `https://anatomy-studio.example.com`)
- [ ] **Redirect URLs** 에 다음 추가:
  - `https://<domain>/auth/callback` (OAuth/이메일 확인)
  - `https://<domain>/auth?mode=reset` (비밀번호 재설정)
  - `http://localhost:3000/**` (로컬 개발용, 런칭 후 제거 권장)

### Authentication → Email Templates
- [ ] **Confirm signup** — 한국어로 번역 (기본값은 영어)
- [ ] **Magic link** — 사용 안 하면 비활성화
- [ ] **Reset password** — 본문의 `{{ .ConfirmationURL }}` 유지, 안내 문구만 한국어화
- [ ] 발신자 이름 "Anatomy Studio" 등 브랜딩

### Authentication → Providers
- [ ] **Email** 활성화 (기본)
- [ ] **Google OAuth** — 사용 시 Client ID/Secret 설정, 승인된 리디렉션 URI에 Supabase callback 추가

### Auth → Rate Limits
- [ ] 이메일 발송 기본 한도(시간당 30회) 확인, 필요 시 증설

### Storage (PDF/이미지 업로드 사용 시)
- [ ] 버킷 공개/비공개 정책 확인
- [ ] 버킷별 RLS 정책 재검토

### RLS 감사
- [ ] `public` 자료가 비로그인 사용자에게도 보이는지 확인
- [ ] `profiles` 테이블은 본인만 UPDATE 가능해야 함
- [ ] `user_vocabulary`, `reading_progress`, `grammar_notes`, `writing_practice` 모두 `user_id = auth.uid()` 기반 정책 확인

## 2. 환경 변수 (Vercel 등 배포 플랫폼)

| 이름 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon 공개키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 계정 삭제 API 등 서버 전용 |
| `NEXT_PUBLIC_SITE_URL` | ✅ | robots/sitemap/OG에 쓰임 |
| `GEMINI_API_KEY` | ✅ | 분석용 |
| `GROQ_API_KEY` | ⚠️ | 폴백용 (없어도 동작) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | ⚠️ | 설정 시 Plausible 스크립트 자동 주입 (예: `anatomy-studio.example.com`) |
| `NEXT_PUBLIC_PLAUSIBLE_SRC` | ⚠️ | self-host 시 스크립트 URL 오버라이드 |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | Sentry 연동 시 (`src/lib/reportError.js`의 주석 해제 필요) |

## 3. 도메인 / DNS
- [ ] HTTPS 강제 (Vercel 기본)
- [ ] `www` → apex 리디렉션 선택
- [ ] `robots.txt`, `sitemap.xml`, `opengraph-image` 접근 확인

## 4. 런칭 직전 점검
- [ ] `npm run build` 로컬 또는 CI에서 통과
- [ ] 모바일(iOS Safari, Android Chrome) 실기 확인
  - [ ] 가입 → 로그인 → 자료 업로드 → 단어 저장 → 복습 루프
  - [ ] PWA 홈 화면 추가
- [ ] 비밀번호 재설정 메일 실제 수신 테스트
- [ ] 계정 삭제 → 재가입 플로우 1회 검증
- [ ] 공개 자료 시드 — 아래 중 하나
  - (A) 관리자 계정으로 로그인 → `/admin` → "스타터 콘텐츠 시드" 버튼 (`STARTER_MATERIALS` 기반 일괄 삽입)
  - (B) 직접 자료실에서 공개(public) 자료 2~3개 업로드 후 가입자 프로필의 `role = 'admin'` 지정
  - (C) Supabase Dashboard에서 `reading_materials` 에 `visibility='public'` 로 수동 1건 삽입

## 5. 런칭 후 24시간
- [ ] Supabase Logs → 5xx 에러 모니터링
- [ ] Gemini 사용량 관리자 페이지에서 에러율 확인
- [ ] 첫 실제 가입자 UX 피드백 수집 채널 정하기 (이메일/디스코드 등)

## 6. 신고/모더레이션 (2026-04-16 추가)

- 공용 자료 신고 테이블 `content_reports` 추가됨. 관리자는 Supabase Dashboard SQL Editor에서 아래 쿼리로 대기 중 신고 확인:
  ```sql
  select r.*, m.title, p.display_name as reporter
  from content_reports r
  join reading_materials m on m.id = r.material_id
  join profiles p on p.id = r.reporter_id
  where r.status = 'pending'
  order by r.created_at desc;
  ```
- 조치 후 상태 업데이트:
  ```sql
  update content_reports
  set status = 'actioned', reviewed_at = now(), reviewer_note = '자료 비공개 처리'
  where id = '<report_id>';

  -- 필요 시 자료 비공개 전환
  update reading_materials set visibility = 'private' where id = '<material_id>';
  ```

## 7. 관측성 (선택)

### Sentry 연동
1. `npm i @sentry/nextjs`
2. Sentry Wizard 실행: `npx @sentry/wizard@latest -i nextjs`
3. `src/lib/reportError.js` 상단의 Sentry 연동 블록 주석 해제
4. `NEXT_PUBLIC_SENTRY_DSN` 환경 변수 설정

### Plausible 연동
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`만 설정하면 `src/app/layout.jsx`가 자동으로 `<script>` 태그 삽입
- Self-host 시 `NEXT_PUBLIC_PLAUSIBLE_SRC` 로 경로 지정

## 8. 알려진 한계
- In-memory rate limiter(`src/lib/server/rateLimit.js`)는 **단일 인스턴스 기준**. 서버리스/멀티 인스턴스 배포 시 Upstash Ratelimit 등으로 교체 필요.
- 현재 `/api/analyze`는 로그인 사용자만 호출 가능 (401 차단) — 비로그인 랜딩 데모는 정적 샘플임.
