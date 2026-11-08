# 공개 런칭 체크리스트

> `deployment-checklist.md`는 DB 마이그레이션 중심이다. 이 문서는 **첫 공개(public launch)** 때 한 번 하는 Supabase · Vercel · 도메인 설정이다.
> 실제와 대조해 고친 날: 2026-11-07 KST(LAUNCH-CHECKLIST-002). 환경 변수 **값**은 이 문서에 적지 않는다(이름만).

## 1. Supabase 프로젝트 설정 (Dashboard)

### Authentication → URL Configuration
- [ ] **Site URL** = 대표 도메인 `https://www.manabi.co.kr` (DOMAIN-CANONICAL-001 — 오너 결정 (가) www, 2026-11-08 KST).
- [ ] **Redirect URLs**: 로그인 복귀는 모두 `/auth/callback`으로 온다(`src/lib/authRedirect.js` `authCallbackUrl` — OAuth · 이메일 확인 · 비밀번호 재설정은 `?next=`로 갈 곳을 싣는다).
  - `https://www.manabi.co.kr/auth/callback` (와 `?next=` 붙은 꼴 — 패턴 `https://www.manabi.co.kr/auth/**`)
  - apex(`manabi.co.kr`)는 www로 308이라 복귀 주소에 없어도 되지만, 옛 메일 링크를 위해 `https://manabi.co.kr/auth/**`도 남겨 둔다
  - `http://localhost:3000/**` (로컬 개발용, 런칭 뒤 제거 권장)

### Authentication → Email Templates (AUTH-MAIL-KO-001 대조 2026-11-08 KST)
- [ ] **한국어 템플릿 5종 적용** — 원고는 `supabase/templates/*.html`(MAIL-KO-001, 오너 「A안」 2026-10-12), 제목 · 붙여넣기 절차 정본은
  [`docs/auth-email-links.md`](auth-email-links.md). Confirm signup · Reset password · Change Email Address · Invite user · Magic Link 모두 본문 전체를 바꾼다.
  - 링크는 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`(원고에 이미 들어 있음) — `{{ .ConfirmationURL }}`로 두면
    PC에서 가입하고 휴대폰 메일에서 열 때 PKCE 교환이 실패한다(`/auth/confirm`은 운영 배포됨).
- [ ] **Magic link — 끔 권장**: 앱은 보내지 않는다(코드에 `signInWithOtp` 호출 0, 로그인은 비밀번호 · Google). 대시보드에 매직 링크만 끄는
  설정이 보이면 끈다. 없으면 한국어 템플릿만 넣어 둔다(누가 API로 직접 요청해도 영어 메일이 나가지 않게).
- [ ] **SMTP 확인**: 현행 Custom SMTP = Resend(발신 도메인 Verified 2026-10-12 — [`deployment-checklist.md`](deployment-checklist.md) 도메인 · 메일 표).
  런칭 전 대시보드에서 ⑴ Authentication → Emails → SMTP Settings의 Custom SMTP가 켜져 있는지 ⑵ Auth → Rate Limits의 메일 시간당 값을 확인한다.
  끄면 내장 메일로 돌아가 **조직 팀원 주소로만** 보낸다(공식 문서 auth-smtp). 교체 · 증설 비교는 [`docs/smtp-options.md`](smtp-options.md).
- [ ] 발신자 이름 「manabi」 — 자체 SMTP 설정의 Sender name에서 정한다(메일 제목에는 `[manabi]`를 붙이지 않는다 — auth-email-links.md).

### Authentication → Providers
- [ ] **Email** 켬(기본)
- [ ] **Google OAuth** — Client ID/Secret, Google Cloud 콘솔의 승인된 리디렉션 URI에 Supabase 콜백, 승인된 JavaScript 원본에 대표 도메인

### Auth → Rate Limits
- [ ] 이메일 발송 기본 한도(시간당 30회) 확인, 필요하면 늘린다(또는 자체 SMTP)

### Storage
- [ ] 버킷 공개/비공개 정책 · 버킷별 RLS 재검토(PDF · 손글씨 · 설명판 업로드)

### RLS 감사
- [ ] 공개(`public`) 자료가 비로그인에게도 보이는지
- [ ] `profiles`는 본인만 UPDATE
- [ ] 학습 기록 테이블(`user_vocabulary` · `reading_progress` · `grammar_notes` · `writing_practice` 등)이 `user_id = auth.uid()` 정책인지 — 상세 절차는 `/rls-audit` 스킬

## 2. 환경 변수 (Vercel Production)

> 코드가 실제로 읽는 이름 기준(2026-11-07). **#1673(Supabase 새 키 이전)이 병합되면** 공개 키 · 비밀 키 이름이 바뀐다 — 그때 이 표도 고친다.

| 이름 | 필수 | 쓰는 곳 |
|------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 공개 키(#1673 뒤 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 서버 전용 — 계정 삭제 · 큐레이터 목록 등(#1673 뒤 `SUPABASE_SECRET_KEY`) |
| `NEXT_PUBLIC_SITE_URL` | ⚠️ | 정본 주소 — canonical · og:url · sitemap · robots(`src/lib/seo.js` `siteUrl()`가 기본값보다 먼저 쓴다). **비워 두면 기본값 `https://www.manabi.co.kr`**(대표 도메인). 두려면 대표 도메인과 같아야 한다 — 운영 값은 지금 apex라 지워야 한다(§3) |
| `ANTHROPIC_API_KEY` | ✅ | 텍스트 LLM — 사용자 내용 경로는 Claude만(LLM-PROVIDER-POLICY-001) |
| `GEMINI_API_KEY` | ✅ | 문장 음성(TTS) 전용 · 단어 뜻 풀이 대체 |
| `CRON_SECRET` | ✅ | 예약 작업 라우트(`/api/cron/*`) 인증 |
| `SHARE_LINK_SECRET` | ✅ (수업) | 수업 팀 암호 해제 토큰 서명(`src/lib/server/classAccess.js`, 16자 이상). **없으면 `/api/class/<팀>/unlock`이 503 `not_configured`** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` | ✅ (알림) | 복습 푸시 알림 |
| `SUPADATA_API_KEY` | ⚠️ | 링크 가져오기의 YouTube 자막(`/api/import/link`) — 없으면 그 기능만 꺼짐 |
| `YOUTUBE_DATA_API_KEY` | ⚠️ | 오늘의 소식 영상 수집(공식 YouTube Data API v3 — `src/lib/server/youtubeDataApi.js`, YT-API-001). 서버 전용 · Google Cloud에서 「YouTube Data API v3」만 허용. 없으면 영상 수집만 0건(fail-closed) |
| `GROQ_API_KEY` | ⚠️ | 단어 뜻 대체의 마지막 순서. 사용자 내용 경로에서는 쓰지 않는다 |
| `QIITA_TOKEN` | ⚠️ | Qiita 글 가져오기 호출 한도 완화 |
| `LLM_LOG` | ⚠️ | `on`일 때만 LLM 호출 로그(`src/lib/server/llm.js`) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` · `NEXT_PUBLIC_PLAUSIBLE_SRC` | ⚠️ | 설정하면 Plausible 스크립트를 넣는다(`src/app/layout.jsx`) |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | Sentry를 붙일 때(`src/lib/reportError.js`의 연동 블록 주석 해제 필요) |

- 빌드가 스스로 정하는 값(`MANABI_SC_STYLESHEET` · `MANABI_TC_STYLESHEET` · `MANABI_RELEASE_*` · `NEXT_PUBLIC_BUILD_*` · `MANABI_FONT_HINT_*`)과 Vercel 시스템 값(`VERCEL_*`)은 넣지 않는다.
- **런타임은 Node 24**(`package.json` `engines: 24.x` · CI도 24). `npm test`는 Node 24 Web Locks를 전제한 검사가 있어 22에서는 실패한다.

## 3. 도메인 / DNS
- [x] HTTPS 강제 (Vercel 기본 — http 두 호스트 모두 같은 호스트 https로 308, 2026-11-07 KST 실측)
- [x] 대표 도메인 = **www** (`https://www.manabi.co.kr`, DOMAIN-CANONICAL-001 — 오너 결정 (가) 2026-11-08 KST)
  - Vercel 프로젝트 도메인: `www.manabi.co.kr` 서빙 · `manabi.co.kr` → www 308(2026-10 연결 때부터 이 방향)
  - 코드 정본: `src/lib/seo.js` `DEFAULT_SITE_URL` = www(이 PR)
  - apex로 옮기려면 사용자 비용이 있다 — 쿠키 · 이 기기 기록(손님 문법 복습 · 오프라인 큐) · 설치 앱이 호스트 단위라 전원 재로그인 · 기기 기록 안 보임 · 앱 재설치
- [ ] **운영 반영 조건 — 오너 작업**: Vercel 환경 변수 `NEXT_PUBLIC_SITE_URL`(Production)을 **지운다**(또는 `https://www.manabi.co.kr`로 바꾼다).
  운영 값이 코드 기본값보다 먼저라, 지우기 전에는 정본이 그대로 apex다. 지운 뒤 운영 배포가 한 번 나가야 반영된다(환경 변수는 빌드 때 읽는다).
- [ ] **사후 확인 8개**(env 삭제 → 운영 배포 READY 뒤):
  1. `/home` `<link rel="canonical">` = `https://www.manabi.co.kr/home`
  2. `/home` `og:url` = www
  3. `/robots.txt`의 `Sitemap:` = `https://www.manabi.co.kr/sitemap.xml`
  4. `/sitemap.xml`의 `<loc>`가 모두 www(apex 0개)
  5. 손님 `/home` JSON-LD(WebSite)의 `url` = www
  6. 동적 화면(`/studies/japan/jp-culture` · 공개 `/viewer/<id>`) canonical = www
  7. `https://manabi.co.kr/<경로>` → `https://www.manabi.co.kr/<같은 경로>` 308 그대로
  8. 로그인 왕복(이메일 · Google)이 `https://www.manabi.co.kr/auth/callback`으로 돌아와 www에 머문다(Supabase Site URL · Redirect URLs 반영 확인)
- [ ] `robots.txt` · `sitemap.xml` · `opengraph-image` 접근 확인

## 4. 런칭 직전 점검
- [ ] `npm run build`(Node 24) · `npm test` 로컬 또는 CI 통과
- [ ] 모바일(iOS Safari · Android Chrome) 실기 확인
  - [ ] 가입 → 로그인 → 자료 올리기 → 단어 저장 → 복습 순환
  - [ ] PWA 홈 화면 추가
- [ ] 비밀번호 재설정 메일 실제 수신
- [ ] 계정 삭제 → 다시 가입 한 번
- [ ] 수업: 학생이 팀 암호로 들어가는지(`SHARE_LINK_SECRET` — §2)
- [ ] 공개 자료 시드 — 아래 중 하나
  - (A) 관리자 계정으로 스타터 자료 일괄 넣기(`/api/admin/seed-starters`, `src/lib/starter-content.js`)
  - (B) 자료실에서 공개 자료 2~3개를 올리고 그 계정 `profiles.role = 'admin'`
  - (C) Supabase Dashboard에서 `reading_materials`에 `visibility='public'` 한 건

## 5. 런칭 후 24시간
- [ ] 운영 오류 기록: `observe.error_events`(브라우저 · 서버 오류와 CSP 보고 `csp.*`, /study 문단 실패 `study.paragraph_fallback` · `study.paragraph_error`, ERROR-OBSERVE-001 · SEC-HEADERS-001 · STUDY-PARA-OBSERVE-001)
- [ ] Vercel 런타임 오류(Hobby는 런타임 로그를 1시간만 보관 — 오류 묶음은 7일) · Supabase Logs(API 4xx/5xx · Postgres)
- [ ] LLM 사용량 · 오류율(관리자 화면)
- [ ] 첫 실제 가입자 의견을 받을 창구(이메일/디스코드 등)

## 6. 신고/모더레이션 (2026-04-16 추가)

- 공용 자료 신고 테이블 `content_reports`(자료 화면의 신고 단추 — `ReportMaterialButton.jsx`). 관리자는 Supabase Dashboard SQL Editor에서 대기 중 신고를 본다:
  ```sql
  select r.*, m.title, p.display_name as reporter
  from content_reports r
  join reading_materials m on m.id = r.material_id
  join profiles p on p.id = r.reporter_id
  where r.status = 'pending'
  order by r.created_at desc;
  ```
- 조치 뒤 상태 바꾸기:
  ```sql
  update content_reports
  set status = 'actioned', reviewed_at = now(), reviewer_note = '자료 비공개 처리'
  where id = '<report_id>';

  -- 필요하면 자료 비공개 전환
  update reading_materials set visibility = 'private' where id = '<material_id>';
  ```

## 7. 관측성

- 정본은 자체 오류 기록 `observe.error_events`다(ERROR-OBSERVE-001 — 경로는 식별값을 걷은 틀, 브라우저는 계열만, 30일).
- CSP는 지금 Report-Only다. 강제 전환 초안과 조건은 `docs/security-csp.md`.
- 성능(첫 그림) 측정 규칙은 `docs/perf-measurement.md`.
- 선택:
  - Sentry: `npm i @sentry/nextjs` → `npx @sentry/wizard@latest -i nextjs` → `src/lib/reportError.js`의 연동 블록 주석 해제 → `NEXT_PUBLIC_SENTRY_DSN`
  - Plausible: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`만 넣으면 `src/app/layout.jsx`가 스크립트를 넣는다(자체 호스팅이면 `NEXT_PUBLIC_PLAUSIBLE_SRC`)

## 8. 알려진 한계
- 분당 요청 제한(`src/lib/server/rateLimit.js`)은 **인스턴스 메모리 기준**이라 서버리스 인스턴스마다 따로 센다. AI 하루 이용 한도는 DB 기준이라 인스턴스와 무관하다(`usage_private.ai_daily_usage` — 로그인 = 계정, 비로그인 = IP 해시).
- `/api/analyze`는 로그인 사용자만 부른다(401). 손님에게 보이는 분석은 미리 분석해 둔 공개 자료다.
