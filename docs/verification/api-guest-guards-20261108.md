# 손님 API 남용 방어 점검 (API-ABUSE-001 · 2026-11-08 KST)

오케스트레이터 14:30 KST 「출시 전 손님이 부를 수 있는 API 남용 방어 점검」. `/api/**` 80개 경로 전수 — 인증 · 분당 상한 · 하루 상한(`consume_ai_daily_quota`) · 본문/입력 상한 · 비용.
표는 소스 표식으로 뽑았고(`O` = 그 경로 소스에 해당 방어가 있다), 손님 경로 22개는 계약 `src/lib/__tests__/apiGuestGuards.test.js`가 방어를 고정한다(새 손님 경로는 표에 올리지 않으면 CI가 깨진다).

## 결론
- **비용(LLM · TTS · 외부 유료 API)이 드는 경로는 손님에게 TTS 하나뿐**이고, IP 분당 상한 + IP 해시 하루 5,000 + 1년 immutable 캐시가 있다. 나머지 LLM 경로 11개는 전부 로그인 + 분당 + 하루 상한(대화는 DB 하루 150턴) + 입력 길이 상한이다.
- 손님 쓰기 경로 6개(비밀번호 유출 확인 · 오류 · CSP · 화면 밀림 · 문법 복습 조립 · 팀 해제)는 모두 분당 + 본문 상한이 있다(이번에 둘 보강).
- 손님 읽기 경로는 정적(빌드 때 굽기 6) · 공개 CDN 캐시(추천 2 · 교재 5) · 예외 2(버전 확인 — 관리자 · 디버그 배지만 · 서버 시각 — DB 없음).
- **Vercel Hobby 한도**(공식 문서 확인 2026-11-08): 함수 최대 300초(우리 최대 `maxDuration` 300 — 분석 작업 크론 · 관리자 가져오기, 범위 안) · 요청 본문 4.5MB ·
  월 함수 호출 100만 · Active CPU 4시간 · 메모리 360GB-시간 — **넘으면 30일 정지**. 손님 트래픽이 요청마다 함수를 부르던 곳은 `/api/suggestions/today` 하나(이번에 CDN 캐시).
  LLM 대기 시간은 Active CPU에 들지 않는다(I/O 대기 제외 — 문서). 실측 사용량은 이 세션에서 볼 수 있는 도구가 없어 확인 못 함(대시보드 Usage).

## 이번에 막은 것
| 경로 | 문제 | 고침 |
|---|---|---|
| `/api/suggestions/today` | 손님 홈 · 서가가 부를 때마다 함수 + DB 조회(`no-store`) | 찾은 날만 `public, s-maxage=60, stale-while-revalidate=300`, 빈 날(자정 수집 전 · 조회 실패)은 `no-store` |
| `/api/review/drills` | 손님 POST에 분당 상한 · 본문 상한 없음(`request.json()`) | IP 분당 30(정본 `rateLimit`) · 본문 256KB(`readLimited` — 선언 길이를 속여도 실제 바이트로 자름). 게스트 화면은 서버가 쓰는 60행만 보낸다 |
| `/api/class/[team]/unlock` | 암호 길이 상한 없이 해시(`verifyPassword`)에 들어감 — CPU | 본문 8KB · 암호 1,024자 넘으면 틀린 암호와 같은 404. (운영은 `SHARE_LINK_SECRET`이 Preview에만 있어 지금 503) |

## 남겨 둔 것(기록)
- 분당 상한은 인스턴스 메모리(`rateLimit.js` 주석의 한계 그대로) — Fluid compute에서 인스턴스를 나눠 쓰므로 대체로 맞지만 정확하지 않다. 하루 상한(DB)이 지출의 실제 상한이다.
- 하루 상한은 DB 장애 때 막지 않는다(fail-open, `dailyQuota.js` — 학습을 멈추지 않게). 분당 상한은 남는다.
- TTS 하루 상한의 주체는 IP 해시라 IP를 바꾸면 늘어난다 — 상류 차단기(429 · 403 → 10분 건너뛰기)와 캐시가 뒤를 받친다.
- `/api/ai-relay`는 손님 표에 없다 — 에이전트 토큰을 본문보다 먼저 확인하고, 운영에는 토큰이 없어 503.

## 전체 표
| 경로 | 메서드 | 인증 | 분당 | 하루 | 본문·입력 상한 | 비용 |
|---|---|---|---|---|---|---|
| `/account/delete` | POST | 로그인 | - | - | - | - |
| `/admin/analysis-jobs` | GET·POST | 관리자 | - | - | O | - |
| `/admin/art-books` | GET·POST | 관리자 | - | - | - | - |
| `/admin/backfill-base-form` | POST | 관리자 | - | - | O | - |
| `/admin/books/japanese-n3` | GET·POST | 관리자 | - | - | - | - |
| `/admin/books/japanese-n4` | GET·POST | 관리자 | - | - | - | - |
| `/admin/books/japanese-n5` | GET·POST | 관리자 | - | - | - | - |
| `/admin/chapter` | GET·POST·DELETE | 관리자 | - | - | O | - |
| `/admin/dictionary` | GET·PATCH·DELETE | 관리자 | - | - | O | - |
| `/admin/import-jmdict` | POST | 관리자 | - | - | O | - |
| `/admin/literature` | GET·POST | 관리자 | - | - | - | - |
| `/admin/llm-bench` | GET·POST | 관리자 | - | - | - | - |
| `/admin/llm-stats` | GET | 관리자 | - | - | - | - |
| `/admin/seed-dictionary` | POST | 관리자 | - | - | O | LLM |
| `/admin/seed-starters` | POST | 관리자 | - | - | - | - |
| `/ai-relay` | HEAD·GET·POST·PATCH | 중계 토큰 | - | - | O | - |
| `/analyze/korean` | POST | 로그인 | O | O | - | - |
| `/analyze` | POST | 로그인 | O | O | O | LLM |
| `/auth/password-check` | POST | **손님** | O | - | O | 외부 |
| `/books/japanese-n3/[edition]/asset` | GET | **손님** | - | - | - | - |
| `/books/japanese-n3/[edition]/reading` | GET | **손님** | - | - | - | - |
| `/books/japanese-n4/[edition]/asset` | GET | **손님** | - | - | - | - |
| `/books/japanese-n4/[edition]/reading` | GET | **손님** | - | - | - | - |
| `/books/japanese-n5/[edition]/asset` | GET | 손님(발행본) · 미리보기 관리자 | - | - | - | - |
| `/books/japanese-n5/[edition]/reading` | GET | **손님** | - | - | - | - |
| `/class/[team]/copy` | POST | 팀 토큰 | - | - | O | - |
| `/class/[team]/course` | GET | 팀 토큰 | O | - | - | - |
| `/class/[team]/history` | GET | 팀 토큰 | - | - | - | - |
| `/class/[team]/material/[id]` | GET | 팀 토큰 | - | - | - | - |
| `/class/[team]` | GET | 팀 토큰 | O | - | - | - |
| `/class/[team]/source` | GET | 팀 토큰 | - | - | - | - |
| `/class/[team]/unlock` | POST | **손님** | O | - | O | - |
| `/classroom/kana` | GET | 로그인 | - | - | - | - |
| `/classroom/lookup` | POST | 로그인 | O | O | - | LLM |
| `/classroom/recognize` | POST | 로그인 | O | O | - | LLM |
| `/client-error` | POST | **손님** | O | - | O | - |
| `/conversation/turn` | POST | 로그인 | O | - | - | LLM |
| `/cron/analysis-jobs` | GET·POST | 크론 비밀 | - | - | - | - |
| `/cron/backfill-ipa` | GET | 크론 비밀 | - | - | O | - |
| `/cron/fetch-suggestions` | GET | 크론 비밀 | - | - | O | - |
| `/cron/send-forecast` | POST·GET | 크론 비밀 | - | - | O | - |
| `/csp-report` | POST | **손님** | O | - | O | - |
| `/dict-correct` | POST | 로그인 | O | O | - | - |
| `/explain` | POST | 로그인 | O | O | O | LLM |
| `/gemini` | POST·GET | 로그인 | O | O | O | LLM |
| `/goal-catalog` | GET | **손님** | - | - | - | 정적 |
| `/import/link` | POST | 로그인 | O | O | O | 외부 |
| `/learning/admission` | GET·POST | 로그인 | - | - | - | - |
| `/learning/book-review` | GET | 로그인 | - | - | O | - |
| `/learning/capabilities` | GET | 로그인 | - | - | - | - |
| `/learning/exclusions` | GET·POST | 로그인 | - | - | O | - |
| `/learning/fsrs` | GET·POST | 로그인 | - | - | O | - |
| `/learning/material-links` | GET·POST·DELETE | 로그인 | - | - | - | - |
| `/learning/material-review` | GET | 로그인 | - | - | O | - |
| `/learning/vocabulary` | POST·GET·DELETE | 로그인 | - | - | O | - |
| `/level-index/chinese` | GET | **손님** | - | - | - | 정적 |
| `/level-index/japanese` | GET | **손님** | - | - | - | 정적 |
| `/level-tiles/[lang]/[level]` | GET | **손님** | - | - | - | 정적 |
| `/level-words/[lang]/[level]` | GET | **손님** | - | - | - | 정적 |
| `/materials/[id]/annotations` | GET·POST | 팀 토큰 | - | - | - | - |
| `/notes/[id]/recognize` | POST | 로그인(노트) | O | O | - | LLM |
| `/notes/[id]` | GET·PUT | 로그인(노트) | - | - | - | - |
| `/notes/dictionary` | GET | 로그인(노트) | - | - | O | - |
| `/notes` | POST | 로그인(노트) | - | - | - | - |
| `/push/test` | POST | 로그인 | - | - | - | - |
| `/review/drills` | POST | **손님** | O | - | O | - |
| `/study-paragraph` | POST | 로그인 | O | O | O | LLM |
| `/suggestions/[id]` | GET | **손님** | - | - | - | - |
| `/suggestions/today` | GET | **손님** | - | - | - | - |
| `/tts` | GET | **손님** | O | O | O | LLM·TTS |
| `/version` | GET | **손님** | - | - | - | - |
| `/vitals` | POST | **손님** | O | - | O | - |
| `/word-detail` | GET·POST | 로그인 | - | - | O | - |
| `/world/position` | GET·POST | 로그인 | - | - | - | - |
| `/world/session/leave` | POST | 로그인 | - | - | - | - |
| `/world/session` | POST·PATCH | 로그인 | - | - | - | - |
| `/world/stamps` | GET·POST | 로그인 | - | - | - | - |
| `/world/time` | GET | **손님** | - | - | - | - |
| `/writing-feedback` | POST | 로그인 | O | O | O | LLM |
| `/zh-ref/[shard]` | GET | **손님** | - | - | - | 정적 |
