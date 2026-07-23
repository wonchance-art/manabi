# 프로덕션 JS 번들 감사 r2

- 측정일: 2026-07-23 KST
- 기준: `origin/main` `db8d09fdb2238ba1960b4eb712bda5c7e3b304a9`
- 환경: macOS arm64, 공식 nvm Node `v22.23.1`, Next.js `15.5.21`
- 범위: P1 도시 geo lazy-load merge 후 production `next build`의 초기 JS와 비동기
  청크 실측
- 변경 범위: 이 보고서뿐이며 제품 코드, 빌드 설정, 테스트, 자산, DB는 수정하지 않았다.

## 판정

P1 lazy-load는 production 번들에서도 유지된다.

- `/world`의 Next `First Load JS`는 **198 kB**, `/admin/worldmap`은 **208 kB**다.
- 두 초기 route manifest와 26개 도시 청크의 교집합은 각각 **0개**다.
- P1 이전 벤치의 `/world` GameCanvas loadable entry
  `28,523,978 B raw / 3,868,783 B gzip`은 현재
  `608,008 B raw / 192,026 B gzip`으로 각각 **97.87% / 95.04% 감소**했다.
- P1 이전 `/admin/worldmap` 초기 자산
  `28,645,600 B raw / 3,892,459 B gzip`은 현재
  `704,486 B raw / 207,979 B gzip`으로 각각 **97.54% / 94.66% 감소**했다.
- 도시 bytes가 삭제된 것은 아니다. 26개 도시 비동기 청크는 합계
  **27,758,413 B raw / 3,764,533 B gzip**으로 남아 있고, 선택한 도시 진입 때만
  요청된다.

단, Next의 `First Load JS`와 게임이 실제로 조작 가능해질 때까지의 cold waterfall은
구분해야 한다. `/world`의 198 kB 뒤에 GameCanvas
`608,008 B raw / 192,026 B gzip`, Phaser
`1,191,915 B raw / 314,947 B gzip`가 순차 비동기 로드된다. 따라서 Phaser 평가까지의
고유 JS 합계는 **2,483,183 B raw / 705,397 B gzip**이다. 여기에 도시 geo는 아직
포함되지 않는다.

## 라우트별 First Load JS

아래 값은 성공한 production build의 Next 출력 그대로다. `Size`는 route 자체,
`First Load JS`는 공용 청크를 포함한 값이다. `○`는 static, `●`는 SSG, `ƒ`는
on-demand server render다.

| 라우트 | 유형 | Size | First Load JS |
|---|:---:|---:|---:|
| `/` | ○ | 3.75 kB | 180 kB |
| `/_not-found` | ○ | 225 B | 103 kB |
| `/admin` | ○ | 13.6 kB | 198 kB |
| `/admin/metrics` | ƒ | 198 B | 107 kB |
| `/admin/worldmap` | ○ | 31.4 kB | 208 kB |
| `/api/account/delete` | ƒ | 225 B | 103 kB |
| `/api/admin/backfill-base-form` | ƒ | 225 B | 103 kB |
| `/api/admin/chapter` | ƒ | 225 B | 103 kB |
| `/api/admin/dictionary` | ƒ | 225 B | 103 kB |
| `/api/admin/import-jmdict` | ƒ | 225 B | 103 kB |
| `/api/admin/seed-dictionary` | ƒ | 225 B | 103 kB |
| `/api/admin/seed-starters` | ƒ | 225 B | 103 kB |
| `/api/ai-relay` | ƒ | 225 B | 103 kB |
| `/api/analyze` | ƒ | 225 B | 103 kB |
| `/api/cron/backfill-ipa` | ƒ | 225 B | 103 kB |
| `/api/cron/fetch-suggestions` | ƒ | 225 B | 103 kB |
| `/api/cron/send-forecast` | ƒ | 225 B | 103 kB |
| `/api/explain` | ƒ | 225 B | 103 kB |
| `/api/gemini` | ƒ | 225 B | 103 kB |
| `/api/media/captions` | ƒ | 225 B | 103 kB |
| `/api/media/search` | ƒ | 225 B | 103 kB |
| `/api/media/translate` | ƒ | 225 B | 103 kB |
| `/api/media/word-context` | ƒ | 225 B | 103 kB |
| `/api/push/test` | ƒ | 225 B | 103 kB |
| `/api/study-paragraph` | ƒ | 225 B | 103 kB |
| `/api/suggestions/today` | ƒ | 225 B | 103 kB |
| `/api/tts` | ƒ | 225 B | 103 kB |
| `/api/word-detail` | ƒ | 225 B | 103 kB |
| `/api/world/position` | ƒ | 225 B | 103 kB |
| `/api/world/session` | ƒ | 225 B | 103 kB |
| `/api/world/session/leave` | ƒ | 225 B | 103 kB |
| `/api/world/stamps` | ƒ | 225 B | 103 kB |
| `/api/world/time` | ƒ | 225 B | 103 kB |
| `/api/writing-feedback` | ƒ | 225 B | 103 kB |
| `/auth` | ○ | 3.37 kB | 177 kB |
| `/auth/callback` | ƒ | 225 B | 103 kB |
| `/chinese` | ○ | 225 B | 103 kB |
| `/chinese/bunkei/[level]` | ● | 136 B | 183 kB |
| `/chinese/grammar/[slug]` | ● | 142 B | 198 kB |
| `/chinese/vocab/[level]` | ● | 138 B | 184 kB |
| `/cohorts` | ○ | 5.91 kB | 197 kB |
| `/embed/review` | ○ | 5.25 kB | 178 kB |
| `/english/bunkei/[level]` | ● | 137 B | 183 kB |
| `/english/grammar/[slug]` | ● | 143 B | 198 kB |
| `/english/vocab/[level]` | ● | 137 B | 184 kB |
| `/french` | ○ | 225 B | 103 kB |
| `/french/bunkei/[level]` | ● | 137 B | 183 kB |
| `/french/grammar/[slug]` | ● | 143 B | 198 kB |
| `/french/vocab/[level]` | ● | 138 B | 184 kB |
| `/guide` | ○ | 198 B | 107 kB |
| `/help` | ○ | 198 B | 107 kB |
| `/home` | ○ | 11.4 kB | 202 kB |
| `/japanese/bunkei/[level]` | ● | 136 B | 183 kB |
| `/japanese/grammar/[slug]` | ● | 142 B | 198 kB |
| `/japanese/reading` | ƒ | 3.49 kB | 188 kB |
| `/japanese/vocab/[level]` | ● | 137 B | 184 kB |
| `/learn` | ○ | 3.67 kB | 189 kB |
| `/lessons` | ○ | 3.19 kB | 186 kB |
| `/listen` | ○ | 18.3 kB | 195 kB |
| `/materials` | ○ | 6.21 kB | 195 kB |
| `/materials/add` | ○ | 10.3 kB | 199 kB |
| `/nihongo` | ○ | 198 B | 107 kB |
| `/nihongo/[day]` | ● | 198 B | 107 kB |
| `/offline` | ○ | 547 B | 104 kB |
| `/opengraph-image` | ƒ | 225 B | 103 kB |
| `/pdf/[id]` | ƒ | 8.67 kB | 194 kB |
| `/privacy` | ○ | 198 B | 107 kB |
| `/profile` | ○ | 10.4 kB | 190 kB |
| `/review/grammar` | ƒ | 5.23 kB | 183 kB |
| `/robots.txt` | ○ | 225 B | 103 kB |
| `/sitemap.xml` | ○ | 225 B | 103 kB |
| `/studies` | ○ | 198 B | 107 kB |
| `/studies/[country]` | ● | 198 B | 107 kB |
| `/studies/[country]/[slug]` | ● | 198 B | 107 kB |
| `/study` | ƒ | 16 kB | 199 kB |
| `/study/library` | ƒ | 2.72 kB | 115 kB |
| `/terms` | ○ | 198 B | 107 kB |
| `/viewer/[id]` | ƒ | 34 kB | 227 kB |
| `/vocab` | ○ | 18.6 kB | 210 kB |
| `/world` | ○ | 21.8 kB | 198 kB |
| `/writing` | ƒ | 6.47 kB | 183 kB |

상위 page route는 `/viewer/[id]` 227 kB, `/vocab` 210 kB,
`/admin/worldmap` 208 kB, `/home` 202 kB 순이다. 모든 route가 공유하는 기본값은
103 kB다.

## 무거운 청크와 모듈

gzip은 각 production 파일을 level 9로 독립 압축한 값이다. 모듈 수치는 webpack
client stats의 minify 전 `javascript` input size이며, emitted/gzip bytes와 직접 더하면
안 된다.

### 초기 청크

| 청크 | 사용 범위 | raw | gzip | 주요 input 모듈 |
|---|---|---:|---:|---|
| `2059-55d1f40bdeb7c835.js` | 대부분의 app route | 245,023 B | 65,039 B | Supabase 계열 692,470 B, `ts-fsrs` 59,941 B, Buffer 27,656 B, `tslib` 17,648 B, `iceberg-js` 17,187 B, `cookie` 12,004 B |
| `1a90e023-7f787db157515707.js` | 전 route | 173,019 B | 54,239 B | React DOM client 530,233 B |
| `755-333734acdb96af18.js` | 전 route | 173,522 B | 46,161 B | Next App Router/RSC client, React, scheduler 합계 596,159 B |
| `app/(app)/viewer/[id]/page-*.js` | `/viewer/[id]` | 110,650 B | 34,028 B | Viewer UI, TTS/listen, vocab/word-detail |
| `6979-f4d34c994241f7fd.js` | `/admin/worldmap`, GameCanvas 후속 | 62,063 B | 22,085 B | `worldNodes` 47,511 B, `mapData` 27,590 B, `emeaRail` 11,505 B, world/map geo helper |
| `app/(app)/world/page-*.js` | `/world` | 65,062 B | 21,835 B | `overworldRegions` 13,322 B, `transsibCorridor` 10,999 B, session 8,258 B, avatar 6,062 B |

가장 큰 범용 앱 청크는 `2059`다. 그 input 826,906 B 중 Supabase SDK 계열이
692,470 B(83.7%)다. 구체적으로 auth 271,577 B, postgrest 121,511 B,
storage 91,103 B, realtime+phoenix 138,655 B, SSR 36,071 B,
supabase-js 23,080 B, functions 10,473 B다. 즉 P1 뒤 초기 번들의 주된
앱 종속성은 도시 데이터가 아니라 **Supabase 전체 client surface와 FSRS**다.

React DOM과 Next App Router/RSC 두 청크는 합계 `346,541 B raw / 100,400 B gzip`으로
공용 103 kB의 거의 전부다. 이 부분은 앱 코드 분할만으로 제거하기 어려운 framework
floor다.

### `/world` 후속 비동기 청크

| 단계/청크 | raw | gzip | 주요 input 모듈 |
|---|---:|---:|---|
| GameCanvas loadable 전체 | 608,008 B | 192,026 B | 아래 monolith + world manifest/map + reading/review UI |
| `1322.*.js` GameCanvas monolith | 516,922 B | 159,335 B | `GameCanvas` 334,260 B, `CityScene` 144,407 B, `npcScripts` 49,508 B, overworld scene 47,880 B, sprites 44,639 B, story/dialog/menu |
| Phaser | 1,191,915 B | 314,947 B | full `phaser/dist/phaser.js` 8,914,527 B input |

Phaser와 GameCanvas는 Next `First Load JS`에는 없지만 `/world`가 mount되면 즉시 필요하다.
따라서 landing route 지표는 좋아졌어도 게임 cold-start의 가장 큰 네트워크 비용은
여전히 이 두 청크다.

### 도시 비동기 데이터

| 도시 청크 | raw | gzip |
|---|---:|---:|
| 서울 | 4,898,130 B | 642,956 B |
| 그랑파리 | 3,500,360 B | 429,068 B |
| 런던 | 3,395,718 B | 417,094 B |
| 도쿄 | 1,695,412 B | 296,772 B |
| 부산 | 1,812,851 B | 243,426 B |
| 코트다쥐르 | 1,518,417 B | 205,364 B |
| 나머지 20도시 | 10,937,525 B | 1,529,853 B |
| **26도시 합계** | **27,758,413 B** | **3,764,533 B** |

도쿄 packed loader는 raw를 줄였지만 base64 packed data의 압축 특성 때문에 gzip
순위는 여전히 4위다. 중요한 P1 계약은 이 청크들이 `/world`와
`/admin/worldmap`의 초기 파일 목록에 들어가지 않는다는 점이며, 이번 build에서
두 route 모두 교집합 0개를 확인했다.

## 차기 절감 후보

구현은 하지 않았다. 효과는 현재 영향 가능 bytes와 모듈 구성으로부터 잡은 보수적
범위이며, 실제 수치는 별도 전후 build로 확정해야 한다.

| 우선 | 후보 | 예상 효과 | 난이도/위험 |
|---:|---|---|---|
| 1 | app shell에서 Supabase 전체 SDK와 FSRS를 기능별 경계로 분리 | 일반 app route에서 **20~45 kB gzip** 초기 절감 가능. 현재 공용 앱 청크 상한은 65.0 kB gzip | 중~상. Auth/session 유지, offline, realtime, 학습 스케줄 회귀 필요 |
| 2 | GameCanvas monolith를 scene/overlay 진입 시점으로 추가 분리 | `/world` mount 후 **40~80 kB gzip** 지연 가능. 현재 monolith는 159.3 kB gzip | 상. scene 등록 race, 전환 lock, 재시도, 저장 복귀 전수 스모크 필요 |
| 3 | full Phaser 대신 필요한 subsystem만 포함하는 custom build 타당성 벤치 | 게임 cold-start에서 **80~150 kB gzip** 잠재 절감. 현재 Phaser는 314.9 kB gzip | 상. 렌더·입력·오디오·physics 회귀 범위가 커 먼저 report-only spike 권장 |
| 4 | 관리자 전체맵의 worldNodes/mapData/rail layer를 목록 shell과 분리 | `/admin/worldmap`에서 **8~15 kB gzip** 초기 절감, GameCanvas 후속에도 일부 이득 | 중. 목록·검색용 경량 manifest와 실제 map layer 데이터 경계 필요 |
| 5 | 도쿄 P3 packed loader를 서울·그랑파리·런던 등 상위 geo에 확산 벤치 | 초기 JS 변화는 0. 도시 첫 진입에서 상위 3개 합계 **1.49 MB gzip**이 영향 대상이며, 도시별 30~60% 절감 여부를 먼저 측정 | 중~상. 결정성, CRC/길이 fail-closed, 브라우저 decode peak 검증 필요 |

초기 page route만 우선하면 1→4 순서다. 게임 조작 가능 시점까지 포함하면 2→3의
절대 효과가 더 크다. 5는 P1의 route 초기값을 더 낮추지는 않지만 실제 도시 진입
waterfall을 줄이는 후속이다.

## 재현과 검증

`.env.local`은 읽거나 만들지 않았다. 첫 build는 page-data 단계에서
`NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 부재로 중단됐고,
아래처럼 프로세스 한정 dummy 공개값으로 재실행했다.

```bash
export PATH=/opt/homebrew/bin:$PATH && \
NEXT_PUBLIC_SUPABASE_URL='https://bundle-audit.invalid' \
NEXT_PUBLIC_SUPABASE_ANON_KEY='bundle-audit-public-anon-key' \
NODE_OPTIONS=--max-old-space-size=8192 \
npx next build
```

같은 exact base에서 build 산출물의 route 표, app manifest 파일명, raw/gzip,
loadable manifest를 정규화한 JSON을 2회 만들었다.

| 검증 | 결과 |
|---|---|
| production `next build` | 2회 PASS, static pages 406/406 |
| timed build peak RSS | `wait4(2)` max RSS 3,230,154,752 B (3,080.52 MiB), PASS |
| canonical metrics run A | 64,207 B, SHA-256 `905c610b23b2463ee3c378c9401d63e6b1c10cb5eab9f4439c36f453a86626a8` |
| canonical metrics run B | 64,207 B, 같은 SHA-256, byte-identical |
| P1 초기 city chunk 교집합 | `/world` 0/26, `/admin/worldmap` 0/26 |
| lazy targeted | 2 files / 9 tests PASS |
| full single-worker | 222 files / 2,205 tests PASS, 203.81s |
| lint / diff check | PASS / PASS |

모듈 분해에는 production client compilation에 읽기 전용 webpack
`stats.toJson()` 계측을 붙인 별도 임시 clone을 사용했다. 계측 plugin과 stats JSON은
커밋에 포함하지 않았고, 원본 exact build의 chunk raw/gzip 값과 교차 확인했다.
