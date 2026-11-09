# CSP 강제 전환 — 허용 목록 초안 (SEC-CSP-002, 2026-11-07 KST)

지금 운영은 CSP를 **보고만** 한다(`Content-Security-Policy-Report-Only`, SEC-HEADERS-001 · `next.config.mjs`).
이 문서는 강제(`Content-Security-Policy`)로 옮길 때 쓸 허용 목록 초안과 근거다. **전환은 아직 하지 않는다**(오케스트레이터 지시).

> **진행 (2026-11-07 KST)**: 2단계 목록을 **Report-Only로 넓혔다**(오케스트레이터 승인 — 관측을 늘리는 일, 강제 · nonce 아님). 정책 정본은 `src/lib/cspPolicy.js`,
> 보고를 받는 지시어는 `src/lib/cspReport.js`(세분 이름 `-elem` · `-attr` 포함). 배포 전 확인: 넓힌 정책을 운영 응답에 얹어 17경로(손님 · 폰, 끝까지 스크롤) 위반 0.
> **7일 뒤(2026-11-14 KST)** `csp.*`를 지시어 · 출처별로 집계해 강제 여부를 오너에게 올린다.
보고 수신은 `/api/csp-report` → 운영 오류 기록 `observe.error_events`(kind `csp.<지시어>`, `src/lib/cspReport.js`)다.

## 1. 지금까지 들어온 보고 (2026-11-07 15:30 KST 집계)

- `observe.error_events` 30일: `csp.*`는 1건이다. 배포 확인용으로 일부러 보낸 탐침(`form-action report: https://deploy-check.invalid`)이고, 실제 위반은 0건이다.
- 관측 기간은 짧다. 보고는 2026-11-06 밤에 켰고, 계정은 9개(7일 로그인 2)다. 「위반 0」은 「쓰임이 적다」와 구별되지 않는다.
- 같은 때 다른 오류 출처도 조용했다:
  - Vercel 런타임 오류(7일): 0
  - Supabase API 응답 4xx · 5xx(24시간): 0
  - Postgres ERROR · WARNING(24시간): 모두 개발 세션의 직접 SQL(없는 열 · 진단용 RAISE · `SET LOCAL` 경고)이었다. 앱 요청에서 난 것은 없다.

## 2. 실제로 부르는 출처 (근거)

**화면 순회**(운영 · 손님 · iPhone 13, 2026-11-07): 17개 경로를 돌았다.
- 경로: `/home` · `/books/japanese-n5` · `/lessons` · `/viewer/50` · `/vocab` · `/review/grammar` · `/studies` · `/studies/japan/jp-culture` · `/studies/japan/map` · `/auth` · `/privacy` · `/materials` · `/study` · `/class/culcom2` 외.

| 종류 | 출처 |
|---|---|
| document · script · stylesheet · font | 같은 출처뿐 |
| fetch | 같은 출처 · `https://<프로젝트>.supabase.co` |
| iframe · 외부 이미지 · 외부 글꼴 | 없음(손님 화면) |
| 인라인 `<script>` | 경로마다 11–24개, 17경로 합 257개 — Next RSC 흐름 조각(`self.__next_f.push`) · 루트 첫 스크립트(테마 · 복습 조기 읽기) · JSON-LD |
| `style` 속성 | 429개(React 인라인 스타일) · `<style>` 요소 2개(지역학 문서 글꼴 face — STUDIES-CLS-001) |

**코드 훑기** — 로그인 · 상호작용 경로라 순회에 안 잡히는 것:

| 쓰임 | 출처 | 근거 |
|---|---|---|
| 실시간(대화 로비 · 학습 월드) | `wss://<프로젝트>.supabase.co` | `src/lib/world/net.js` · supabase-js Realtime |
| 노래 영상(교재 화면) | `https://www.youtube-nocookie.com`(iframe) | `src/views/ReferenceChapterPage.jsx` |
| PDF 글자 꺼내기 · 보기 | 같은 출처 워커(`/pdf.worker.min.mjs`) | `src/lib/pdfExtract.js` · `PdfJsViewer.jsx` |
| 소리 듣기(TTS) | `blob:` 오디오 | `src/lib/useTTS.js` |
| 손글씨 인식 미리 보기 | `data:` 이미지 | `NoteRecognition.jsx` · `BoardInkRecognition.jsx` |
| 미술 카드 이미지 | 같은 출처(자체 보관) | `ViewerArtCard.jsx` `selfHostedImage` |
| 내보내기(JSON · 텍스트) | `blob:` 내려받기 | `vocabIO.js` 등 |
| Google 로그인 | 화면 이동(폼 아님) — `form-action`과 무관 | `AuthContext.jsx` `signInWithOAuth` |
| 푸시 알림 · 오프라인 | 같은 출처 서비스 워커(`/sw.js`) | `public/sw.js` |

## 3. 강제 전환 — 단계별 초안

### 1단계 — 지금 보고 중인 네 지시어를 그대로 강제
```
object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; report-uri /api/csp-report; report-to csp
```
- 스크립트를 건드리지 않아 정적 · ISR 판이 그대로다. `X-Frame-Options: SAMEORIGIN`과 같은 뜻을 CSP로도 건다.
- **전환 조건**: Report-Only를 실제 사용자가 있는 기간에 7일 이상 두고, 탐침을 뺀 위반이 0건일 때.

### 2단계 — 출처 허용 목록 (먼저 Report-Only로 넓혀 7일 관측 뒤 강제)
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://i.ytimg.com;
font-src 'self' data:;
connect-src 'self' https://<프로젝트>.supabase.co wss://<프로젝트>.supabase.co;
media-src 'self' blob: data:;
frame-src https://www.youtube-nocookie.com;
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self';
upgrade-insecure-requests;
report-uri /api/csp-report; report-to csp
```
- `<프로젝트>.supabase.co`는 `NEXT_PUBLIC_SUPABASE_URL`에서 만든다(공개 값). 주소를 직접 적지 않는다.
- `script-src 'unsafe-inline'`이 필요한 이유: 인라인 스크립트 257개가 nonce 없이 나온다. nonce를 쓰면 문서마다 동적 렌더가 돼 정적 · ISR 판이 깨진다. 그래서 **엄격한 script-src(nonce)는 오너 결정 항목**으로 남긴다(SEC-HEADERS-001).
  - 이 단계의 script-src는 「외부 스크립트 출처 차단」만 한다. XSS 주입 방어는 하지 않는다.
- `style-src 'unsafe-inline'`: React `style` 속성(429개)과 지역학 문서의 글꼴 `<style>`이 필요하다.
- **Report-Only 확장 때 함께 바꿀 것**:
  - `src/lib/cspReport.js`의 `CSP_DIRECTIVES` — 정책 밖 지시어 보고는 버리므로, 넓힌 지시어를 함께 넣어야 기록된다.
  - 계약 `securityHeaders.test.js` — 지금은 「fetch 계열 지시어 없음」을 고정한다.

### 알려진 소음 · 위험
- **Vercel 미리 보기 도구 막대**(`vercel.live`): 미리 보기 배포에서만 뜬다. 운영 정책에는 넣지 않는다. 미리 보기 보고는 `route`로 거르거나 무시한다.
- **브라우저 확장**: `chrome-extension:` 등은 `cspReport.js`가 출처를 `other`로 줄여 기록한다. 집계 때 뺀다.
- **학습 월드(Phaser)**: 손님 순회에 없다. 2단계 Report-Only 기간에 `eval` · `wasm` 위반이 보이면 그때 판단한다.
- **유튜브 썸네일**(`i.ytimg.com`): 함께 읽는 글 · 추천 카드가 YouTube Data API의 썸네일 주소를 그대로 쓴다. LH 기준선(2026-11-09 KST)에서 보고로 잡혀 `img-src`에 더했다.
- **Supabase 저장소 이미지**: 지금 화면은 자체 보관 이미지만 쓴다. 저장소 공개 URL을 화면에 직접 쓰는 기능이 생기면 `img-src`에 더한다.

## 4. 다음 순서 제안
1. ~~2단계 목록을 Report-Only로 넓힌다~~ — 2026-11-07 적용(SEC-CSP-002). 계약은 「fetch 계열은 Report-Only에만 · 강제 헤더 없음 · nonce 없음」으로 바뀌었다.
2. 실제 사용 7일 뒤 `observe.error_events`의 `csp.*`를 지시어 · 출처별로 집계한다. 허용 목록을 고친다.
3. 1단계(네 지시어) 강제 → 2단계 강제 순서로 옮긴다. 각 단계마다 운영 사후로 화면 순회 · 오류 기록을 확인한다.
