# 🧬 Anatomy Studio

> AI로 일본어·영어 문장을 **형태소 단위로 해부**하고, **FSRS**로 과학적으로 복습하는 언어 학습 앱.

실제 원문(뉴스·소설·PDF)을 읽으면서 모르는 단어를 탭하면, 의미·품사·후리가나가 즉시 뜨고 단어장에 저장돼요. 저장한 단어는 다음 읽기 때 노란색으로 하이라이트되어 **"읽기가 곧 복습"**이 됩니다.

## 주요 기능

- **하이브리드 분석** — kuromoji(형태소 분할) + 공유 사전 캐시 + Gemini(의미 생성)
- **FSRS v5** — [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 기반 최신 간격 반복 알고리즘
- **PDF OCR** — 이미지 기반 PDF도 Gemini Vision으로 텍스트 추출
- **다중 프로바이더 폴백** — Gemini 2.5-flash → 2.5-flash-lite → Groq(Qwen 3 32B)
- **PWA** — 오프라인 캐싱, 홈 화면 설치
- **계정 관리** — 데이터 JSON 내보내기, 계정 삭제

## 기술 스택

- **Next.js 15** (App Router) + React 19
- **Supabase** (Auth / Postgres / RLS)
- **Google Gemini 2.5-flash** (+ Groq Qwen 3 폴백)
- **kuromoji.js** (일본어 형태소 분석)
- **pdfjs-dist v4** (PDF 텍스트 추출)
- **React Query** (데이터 페칭)

## 로컬 개발

Node 24를 사용한다(`.nvmrc`). fresh clone/Codex Cloud 설치·검증은
[`CLOUD_READINESS.md`](CLOUD_READINESS.md), 제품 맥락은 [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)를 먼저 읽는다.

```bash
npm run setup:cloud
npm run verify:cloud
```

실제 개발용 서비스에 연결할 때:

```bash
npm ci --include=dev
cp .env.example .env.local   # 아래 환경 변수 채우기
npm run dev
```

### 필수 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

AI 기능은 `GEMINI_API_KEY`/선택 `GROQ_API_KEY`를 별도로 설정한다. 일반 읽기·서재 UI에는
`SUPABASE_SERVICE_ROLE_KEY`가 필요하지 않다. 선택 cron/릴레이 등 서버 작업에만 사용한다.
`.env.example`의 기본값은 fixture이므로 실제 로그인/저장을 위해서는 개발용 값으로 바꾼다.

### Supabase 설정

1. [Supabase 프로젝트 생성](https://supabase.com/dashboard)
2. `supabase db push` 또는 대시보드에서 `supabase/migrations/` 실행
3. Auth → URL Configuration에 redirect URL 등록 (자세한 건 [`docs/launch-checklist.md`](docs/launch-checklist.md))

## 스크립트

```
npm run dev        # 개발 서버 (:3000)
npm run build      # 프로덕션 빌드 (dev 서버 끈 뒤 실행)
npm run start      # 프로덕션 서버
```

## 문서

- [`docs/launch-checklist.md`](docs/launch-checklist.md) — 공개 런칭 시 Supabase/도메인 설정
- [`CLOUD_READINESS.md`](CLOUD_READINESS.md) — fresh clone 설치·검증·Cloud 설정/제한
- [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — 제품 결정·진행/보류 상태·다음 세션 인계
- [`docs/deployment-checklist.md`](docs/deployment-checklist.md) — DB 마이그레이션 배포 절차
- [`docs/accessibility-audit.md`](docs/accessibility-audit.md) — 접근성 점검
- [`docs/evaluation-and-strategy.md`](docs/evaluation-and-strategy.md) — 제품 평가·로드맵

## 라이선스

Personal / non-commercial use. 자세한 이용 조건은 앱 내 [이용약관](/terms)·[개인정보 처리방침](/privacy) 참고.
