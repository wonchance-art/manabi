# 전체 코드 리뷰 R1 — 성능·번들

## 0. 감사 기준과 범위

- 발주: issue #150 comment `5192929842`
- 최초 발주 기준: `8e7e41778f338c0ed8a5d6744dedd011fb409a74`
- 최신 재측정 기준: `dc6659ef5197c67d5a9308c2625afcd82efa5ae6` (`origin/main`, 계측 직전 fetch)
- 기준 갱신: issue #150 comment `5194152394`가 최초 base 수치를 무효화하고 최신 main 재측정을 지시했다.
- 작업 브랜치: `codex4/review-code-performance`
- 결과: **치명 0건, 중대 6건, 경미 2건**
- 변경 범위: 이 보고서 한 파일뿐이다. 제품 코드는 변경하지 않았다.
- 보호 계약: Web Speech TTS, guest `localStorage`, `drillSrs`, 동결된 world/studies 코드는 수정하지 않았다.

### 읽기 깊이

- **정독**: 상위 First Load JS 라우트의 page/view, root layout/font, 레퍼런스 manifest/loader, 전역 nav, 이미지 로딩 경계.
- **scan**: `src/app`, `src/views`, `src/components`의 `use client`, 정적/동적 import, `revalidate`, `next/image`, `<img>`, `next/font` 사용처와 `.next` build/app-build manifest 및 생성 chunk 전체.
- 따라서 이 문서는 모든 파일의 의미론적 전수 정독을 주장하지 않는다. 빌드 산출물 전수 scan 후 상위 원인을 소스까지 역추적한 성능 cross-audit다.

## 1. 재현 환경과 측정법

- macOS arm64, Node `v22.23.1`(nvm 공식 배포판), npm `10.9.8`, Next.js `15.5.21`.
- 생성 파일의 `gzip-9`는 macOS `gzip -9c`, HTML/RSC 내부 값과 trace 합계는 Node `zlib.gzipSync(..., { level: 9 })` 기준이다. HTTP encoded 값은 Chrome Resource Timing 또는 압축 응답 그대로의 byte 수다.
- 브라우저 cold 측정은 설치된 Chrome을 `playwright-core`로 새 context마다 실행하고 service worker를 차단했다. 응답 바이트는 Resource Timing의 `encodedBodySize` 합이다.
- 서버 모듈 메모리는 새 Node process에서 route server bundle을 `require`한 `/usr/bin/time -l`의 maximum RSS다.

```bash
cd /Users/chaeyeonwon/manabi-codex4
source /Users/chaeyeonwon/.nvm/nvm.sh
nvm use 22
git rev-parse HEAD

mkdir -p /tmp/manabi-codex4-performance
cold_next_backup=$(mktemp -d /tmp/manabi-codex4-next.XXXXXX)
if [ -d .next ]; then mv .next "$cold_next_backup/next-before-cold-build"; fi
env NEXT_TELEMETRY_DISABLED=1 /usr/bin/time -l npx next build \
  2>&1 | tee /tmp/manabi-codex4-performance/next-build.log
npx next start -p 3104

curl --compressed -sS -D /tmp/manabi-codex4-performance/_lessons.headers \
  -o /tmp/manabi-codex4-performance/_lessons.body http://127.0.0.1:3104/lessons
curl --compressed -sS -D /tmp/manabi-codex4-performance/_home.headers \
  -o /tmp/manabi-codex4-performance/_home.body http://127.0.0.1:3104/home
wc -c /tmp/manabi-codex4-performance/_lessons.body \
  /tmp/manabi-codex4-performance/_home.body

# 특정 문자열이 client chunk에 들어갔는지 확인
rg -l --fixed-strings '10년을 배웠는데 입이 안 떨어지는 건' .next/static/chunks || true
rg -l --fixed-strings '10년을 배웠는데 입이 안 떨어지는 건' .next/server

# 소스/생성 chunk raw + gzip-9 크기
for p in src/components/worldMapPaths.js src/content/refGrammarManifest.js \
  .next/static/chunks/app/'(app)'/lessons/page-*.js; do
  printf '%s\t' "$p"
  wc -c < "$p" | tr -d '\n'
  printf '\t'
  gzip -9c "$p" | wc -c
done
```

브라우저 비교는 같은 새 context에서 `/home`을 한 번은 그대로 열고, 한 번은 아래 여섯 RSC prefetch request만 abort한 뒤 Resource Timing을 합산했다.

```js
const PREFETCH = new Set(['/','/lessons','/vocab','/review/grammar','/materials','/auth']);
await context.route('**/*', route => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  return request.headers()['next-router-prefetch'] === '1' && PREFETCH.has(path)
    ? route.abort()
    : route.continue();
});
await page.goto('http://127.0.0.1:3104/home', { waitUntil: 'networkidle' });
const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({
  name: r.name,
  initiatorType: r.initiatorType,
  encodedBodySize: r.encodedBodySize,
  decodedBodySize: r.decodedBodySize,
})));
```

## 2. 빌드 및 상위 라우트

`.next`를 별도 보관해 cache를 비운 뒤 실행한 `npx next build`는 466/466 정적 페이지를 생성했고 성공했다. ESLint error는 0건이며 기존 anonymous default export warning 2건만 있었다. cold build는 77.46초, maximum RSS **7,452,917,760 B(6.94 GiB)**, swap 0이었다. 공통 First Load JS는 103 kB다. 모든 산출물은 `dc6659ef…`에서 새로 생성했으며 제거된 cohort/listen set의 이전 `.next` chunk는 합계에서 제외했다.

| 순위 | 라우트 | route JS | First Load JS | 주 원인 |
|---:|---|---:|---:|---|
| 1 | `/lessons` | 58.0 kB | 183 kB | `worldMapPaths`와 큰 client view |
| 2 | `/viewer/[id]` | 34.0 kB | 162 kB | 단일 대형 client view와 선택 기능 정적 import |
| 3 | `/japanese/grammar/[slug]` | 152 B | 156 kB | 공통 문법 client island 세트 |
| 4 | `/french/grammar/[slug]` | 152 B | 156 kB | 위와 동일 |
| 5 | `/english/grammar/[slug]` | 152 B | 156 kB | 위와 동일 |
| 6 | `/chinese/grammar/[slug]` | 152 B | 156 kB | 위와 동일 |
| 7 | `/vocab` | 18.4 kB | 149 kB | client-side 어휘 view |
| 8 | `/admin/worldmap` | 31.7 kB | 144 kB | admin map/canvas/manifest |
| 9 | `/study` | 16.1 kB | 143 kB | 학습 session/exercise client stack |
| 10 | `/home` | 12.0 kB | 137 kB | dashboard client view; RSC catalog는 표 밖 별도 비용 |

주의: build 표는 최초 HTML/RSC, CSS/font, 조건부 async chunk를 합산하지 않는다. 아래 finding은 그래서 build 표와 실제 cold network를 함께 본다.

## 3. Findings

### P1 — [중대] 네 글꼴군·14 weight를 root에 연결해 모든 라우트가 큰 CSS/font 비용을 부담한다

**소스 원문**

- `src/app/layout.jsx:1` — `import { Inter, Noto_Sans_KR, Noto_Sans_JP, Noto_Serif_KR } from 'next/font/google';`
- `src/app/layout.jsx:7` — `weight: ['300', '400', '500', '600', '700'],`
- `src/app/layout.jsx:14` — `weight: ['300', '400', '500', '700'],`
- `src/app/layout.jsx:21` — `weight: ['300', '500', '700'],`
- `src/app/layout.jsx:28` — `weight: ['600', '700'],`
- `src/app/layout.jsx:97` — `<body className={`${inter.variable} ${notoKr.variable} ${notoJp.variable} ${notoSerifKr.variable}`}>`
- `src/index.css:95` — `font-family: var(--font-inter, 'Inter'), var(--font-noto-kr, 'Noto Sans KR'), var(--font-noto-jp, 'Noto Sans JP'), sans-serif;`

**실측**

| root CSS | raw | gzip-9 |
|---|---:|---:|
| Noto Sans KR 생성 CSS | 307,758 B | 96,613 B |
| Noto Sans JP 생성 CSS | 283,040 B | 93,947 B |
| Noto Serif KR 생성 CSS | 154,801 B | 48,329 B |
| 전역 `index.css` | 179,715 B | 30,578 B |
| Inter 생성 CSS | 9,356 B | 819 B |

- cold `/lessons`: root link resource 412,282 B encoded, CSS가 시작한 font 383,044 B encoded.
- cold 일본어 문법 페이지: CSS가 시작한 unicode font shard가 36개, 합계 981,980 B encoded였다. root link resource 412,282 B와 별도다.

`display: 'swap'`은 렌더 차단 체감은 줄여도 내려받는 weight/shard 총량을 제거하지 않는다.

**수정안**: 실제 사용 weight를 2~3개로 축소하고 기본 sans 한 벌만 root에 둔다. 일본어 sans와 serif는 해당 언어/컴포넌트 경계로 내리며, 비핵심 폰트는 `preload: false`를 검토한다. 한글·일본어 혼용, 숫자 굵기, serif 제목 시각 회귀를 screenshot으로 확인한다.

### P2 — [중대] `/lessons` 최초 client entry에 전체 세계지도 path가 동기 포함된다

**소스 원문**

- `src/views/LessonsPage.jsx:1` — `'use client';`
- `src/views/LessonsPage.jsx:8` — `import LanguageWorldMap, { TRACK_COLORS } from '../components/LanguageWorldMap';`
- `src/views/LessonsPage.jsx:243` — `<LanguageWorldMap langKey={langFilter} />`
- `src/components/LanguageWorldMap.jsx:1` — `import { WORLD_PATHS } from './worldMapPaths';`
- `src/components/LanguageWorldMap.jsx:128` — `{WORLD_PATHS.map((c) => {`
- `src/components/worldMapPaths.js:6` — `export const WORLD_PATHS = [{"id":"004","name":"Afghanistan"...`

**실측**

- `worldMapPaths.js`: 123,425 B raw / **44,465 B gzip-9**.
- `/lessons` route entry: 158,828 B raw / **57,954 B gzip-9**.
- source path gzip만 route entry gzip의 약 76.7%다. 지도 고유 문자열(`W. Sahara`, `N. Cyprus`)도 이 entry에서 확인됐다.

**수정안**: 언어별 결과를 build-time 정적 SVG/AVIF로 생성해 `<img>`로 전달하는 방안이 가장 단순하다. 상호작용이 필요하면 카드가 펼쳐지거나 viewport에 들어온 뒤 실제 async boundary로 불러온다. 즉시 렌더되는 컴포넌트를 단순히 `dynamic()`으로 감싸면 build 표만 낮추고 실제 cold 전송은 그대로일 수 있으므로 network 기준으로 검증한다.

### P3 — [중대] `/lessons`의 ISR 주석과 달리 실제 응답은 no-store이며, catalog 생성이 eager 전 언어 본문 registry에 연결된다

**소스 원문**

- `src/app/(app)/lessons/page.jsx:11` — `// ISR — 목록의 챕터 제목·요약도 오버라이드를 반영. 저장 시 revalidatePath('/lessons')로 무효화.`
- `src/app/(app)/lessons/page.jsx:12` — `export const revalidate = 60;`
- `src/app/(app)/lessons/page.jsx:16` — `const refManifest = await applyManifestOverrides(buildRefManifest());`
- `src/content/refManifest.js:1` — `import { REF_LANGS } from './refLangs';`
- `src/content/refManifest.js:9` — `for (const [name, ref] of Object.entries(REF_LANGS)) {`
- `src/content/refLangs.js:5` — `import french from './french';`
- `src/content/refLangs.js:6` — `import japanese from './japanese';`
- `src/content/refLangs.js:7` — `import english from './english';`
- `src/content/refLangs.js:8` — `import chinese from './chinese';`
- `src/lib/learn/homeProgressCatalog.js:1` — `import { REF_LANGS } from '../../content/refLangs';`

**실측**

- build 분류는 `ƒ /lessons`이며 응답은 `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`였다.
- cold HTML은 310,023 B decoded / **100,911 B HTTP encoded** 전송.
- RSC flight 142,634 B raw 중 `refManifest` JSON은 122,634 B raw / 43,798 B gzip-9, `progressCatalog`는 10,478 B / 3,567 B였다.
- 새 Node process의 server route require maximum RSS: `/lessons` **137,641,984 B**, 비교 `/world` 70,090,752 B, 문법 route 69,533,696 B; 모두 swap 0.
- `/lessons` server route가 require한 47개 생성 chunk는 합계 9,558,679 B raw / 3,105,115 B gzip-9였다.

`searchParams`와 override 데이터 경로가 동적 렌더를 유발하는 상황에서 `revalidate = 60`만으로는 ISR 응답이 되지 않는다.

**수정안**: catalog builder가 eager `REF_LANGS` 대신 이미 생성된 경량 `refGrammarManifest`를 사용하도록 분리한다. query filter를 client에서 복원해 정적화할지, 동적 라우트를 유지할지는 제품 선택으로 명시한다. 정적화하면 ISR header까지 검증하고, 동적 유지면 오해를 주는 ISR 주석을 고치고 파생 catalog 자체를 cache한다.

### P4 — [중대] `/home`이 겹치는 두 전 언어 catalog를 동시에 RSC props로 직렬화한다

**소스 원문**

- `src/app/(app)/home/page.jsx:2` — `import { buildContinueManifest, buildRefManifest } from '@/content/refManifest';`
- `src/app/(app)/home/page.jsx:11` — `return <HomePage continueManifest={buildContinueManifest()} refManifest={buildRefManifest()} />;`
- `src/views/HomePage.jsx:461` — `<ProfileStats refManifest={refManifest} />`
- `src/views/ProfileStats.jsx:349` — `Object.entries(refManifest).map(([name, r]) => [name, r.readKey])`
- `src/views/ProfileStats.jsx:386` — `{ref.levels.map(lv => {`

**실측**

- `/home` HTML 186,654 B decoded / **61,311 B HTTP encoded**; flight payload 165,956 B raw.
- `continueManifest`: 34,987 B raw / 12,394 B gzip-9.
- `refManifest`: 122,634 B raw / **43,798 B gzip-9**.

`ProfileStats`가 필요로 하는 것은 language/readKey/level/chapter slug 중심인데, 큰 manifest에는 lessons 설명·pitch·chapter summary/topic/duration까지 포함된다.

**수정안**: home 전용 한 개 catalog에 이어서 학습과 통계가 필요한 최소 필드를 합치거나, 서버에서 두 view model을 하나의 공유 source에서 만든 뒤 중복 tree를 보내지 않는다. 목표는 큰 `refManifest` prop 제거이며 약 43.8 kB gzip의 HTML/RSC 감소 여지가 있다.

### P5 — [중대] 전역 nav의 기본 Link prefetch가 cold idle에서 여섯 라우트와 관련 JS를 당긴다

**소스 원문**

- `src/components/Layout.jsx:98` — `{ href: '/lessons',   label: '교재' },`
- `src/components/Layout.jsx:99` — `{ href: '/vocab',     label: '어휘' },`
- `src/components/Layout.jsx:100` — `{ href: '/review/grammar', label: '복습' },`
- `src/components/Layout.jsx:101` — `{ href: '/materials', label: '자료' },`
- `src/components/Layout.jsx:125-128` — `<Link` / `href={l.href}`; `prefetch` 지정 없음.
- `src/components/Layout.jsx:220-223` — mobile `<Link` / `href={l.href}`; `prefetch` 지정 없음.

**실측**

fresh `/home`에서 `next-router-prefetch: 1`인 `/`, `/lessons`, `/vocab`, `/review/grammar`, `/materials`, `/auth` 여섯 요청을 관측했다.

| cold `/home` | script encoded | fetch/RSC encoded |
|---|---:|---:|
| 기본 prefetch | 250,040 B (28개) | 11,732 B (6개) |
| 여섯 prefetch abort | 208,260 B (20개) | 0 B |
| 차이 | **41,780 B** | **11,732 B** |

idle cold 비용 합계는 53,512 B encoded였다.

**수정안**: 전역 nav의 무거운 목적지에는 `prefetch={false}`를 우선 적용하거나 hover/focus intent 때만 prefetch한다. 클릭 후 전환 지연과 cold 전송량을 같이 비교해 선택한다.

### P6 — [중대] `/viewer/[id]`는 완료 후/클릭 후에만 쓰는 패널도 최초 client entry에 정적 포함한다

**소스 원문**

- `src/views/ViewerPage.jsx:1` — `'use client';`
- `src/views/ViewerPage.jsx:28` — `import ReadingTest from '../components/ReadingTest';`
- `src/views/ViewerPage.jsx:29` — `import ConversationPanel from '../components/ConversationPanel';`
- `src/views/ViewerPage.jsx:40` — `import ViewerGrammarModal from './ViewerGrammarModal';`
- `src/views/ViewerPage.jsx:41` — `import ViewerQuizModal from './ViewerQuizModal';`
- `src/views/ViewerPage.jsx:1426` — `{isDone && showReadingTest && (`
- `src/views/ViewerPage.jsx:1440` — `{isDone && showConversation && (`
- `src/views/ViewerPage.jsx:1519` — `<ViewerGrammarModal`
- `src/views/ViewerPage.jsx:1583` — `<ViewerQuizModal`

**실측**

- `/viewer/[id]` route entry: 110,972 B raw / **33,856 B gzip-9**, 전체 First Load JS 162 kB.
- ReadingTest, ConversationPanel, GrammarModal, QuizModal 네 source만 단순 gzip-9 합계 약 13.3 kB다. 이 값은 bundler tree-shaking/공통 chunk 전의 상한 참고치이며 절감량으로 단정하지 않는다.

**수정안**: 완료 후 열리는 ReadingTest/ConversationPanel과 닫힌 modal body를 `dynamic import`하고 trigger 시 prefetch한다. Web Speech TTS 및 현재 modal state/guest 동작은 그대로 유지하며 실제 route chunk/interaction smoke로 검증한다.

### P7 — [경미] 모든 문법 chapter가 희소 client island까지 같은 baseline으로 받는다

**소스 원문**

- `src/views/ReferenceChapterPage.jsx:7` — `import GojuonChart from '../components/GojuonChart';`
- `src/views/ReferenceChapterPage.jsx:8` — `import KanaTest from '../components/KanaTest';`
- `src/views/ReferenceChapterPage.jsx:14` — `import StoryCheck, { StoryLines } from './StoryCheck';`
- `src/views/ReferenceChapterPage.jsx:15` — `import ChapterDrills from '../components/ChapterDrills';`
- `src/views/ReferenceChapterPage.jsx:16` — `import WritingPractice from '../components/WritingPractice';`

**실측**

- 네 언어 grammar route manifest의 client chunk 목록은 동일했고 각각 First Load JS 156 kB다.
- route entry stub은 각 173 B raw / 152 B gzip-9로 작으며, 공통 UI chunk가 baseline을 만든다.

**수정안**: Kana/Story/Drills/Writing처럼 chapter별 존재 여부가 명확한 client island를 조건부 lazy boundary로 분리한다. `chapter.drills`와 cumulative review wiring은 유지하고 해당 데이터가 있는 chapter/없는 chapter를 모두 smoke한다.

### P8 — [경미] 자료 추천 thumbnail에 native 지연 로딩 힌트가 없다

**소스 원문**

- `src/views/MaterialsPage.jsx:39` — `<img src={s.thumbnail_url} alt={s.title} className="suggestion-card__thumb" />`
- `src/index.css:5821` — `aspect-ratio: 16/9;`
- `src/index.css:5829-5831` — `width: 100%;` / `height: 100%;` / `object-fit: cover;`

wrapper가 16:9 공간을 확보해 CLS 위험은 낮지만, 아래쪽 카드도 즉시 요청될 수 있다.

**수정안**: native `<img loading="lazy" decoding="async">`를 먼저 적용한다. 원격 host 정책이 안정된 뒤에만 `next/image` 전환을 검토한다. 이미지 proxy/allowlist를 억지로 넓히지 않는다.

## 4. 정상 동작 및 비회귀 확인

### 문법 content lazy-load는 client leak 없이 작동한다

- `src/content/refGrammarManifest.js`는 398,400 B raw지만, 고유 hook 문자열은 `.next/server`에만 있고 `.next/static/chunks`에는 **0건**이었다.
- 네 언어 grammar page의 app-build-manifest client chunk 목록은 동일하다. 언어별 문법 본문 chunk가 client에 붙지 않았다.
- loader는 literal dynamic import를 유지한다. 예: `src/content/japanese/grammarLoader.js:4` — `OT: () => import('./grammar/ot.js').then(moduleDefault),`, `src/content/english/grammarLoader.js:25` — `A1: () => loadExpandedLevel(() => import('./grammar/a1.js'), 'A1'),`.
- grammar 응답은 `Cache-Control: s-maxage=60, stale-while-revalidate=31535940`이며 build도 `●` SSG + revalidate 1m으로 표시했다.

즉 “398KB manifest가 client에 포함된다”는 의심은 이 기준 커밋에서는 재현되지 않았다. 이 파일을 줄이는 일은 server build/cache 최적화 후보일 수 있지만 client bundle 회귀 fix로 분류하면 안 된다.

### world split은 동작하며 동결 범위를 건드릴 이유가 없다

- `GameCanvas`는 client에서 async 로드되고 Phaser도 내부 dynamic import다.
- 인증 후 game 경로에서 예상되는 async chunk는 GameCanvas 계열 약 209,518 B gzip-9 + Phaser 약 313,652 B gzip-9로 크지만, signed-out cold `/world`에서는 로드되지 않았다.
- 도시 데이터 target lazy-load도 유지된다. world는 동결 영역이므로 이 리뷰에서는 변경 제안/코드 수정을 하지 않는다.

## 5. 저비용·고효율 우선순위 Top 5

| 우선 | 조치 | 예상 효과 | 비용/검증 |
|---:|---|---|---|
| 1 | root font weight/언어별 preload 축소 | 라우트 공통 수백 kB, 일본어 페이지 font shard 최대 약 1 MB cold 비용 축소 여지 | typography screenshot + 언어 fallback 확인 |
| 2 | `/lessons` catalog를 generated manifest로 전환하고 cache 의도 명시 | eager server graph/RSS/build 부담 및 no-store 중복 계산 축소 | override/query 동작과 cache header 확인 |
| 3 | `worldMapPaths`를 정적 이미지 또는 진짜 지연 경계로 이동 | `/lessons` route entry에서 최대 44.5 kB gzip source 제거 여지 | 지도 표시/접근성/네트워크 smoke |
| 4 | `/home`의 겹치는 두 catalog를 home 전용 하나로 통합 | HTML/RSC에서 약 43.8 kB gzip 제거 여지 | guest `localStorage`, 로그인 progress merge 확인 |
| 5 | 전역 nav heavy route prefetch 제한 | cold idle 약 53.5 kB encoded 절감(현 측정) | 클릭 전환 latency A/B 확인 |

그 다음 순서는 viewer의 완료 후 패널 lazy-load, 문법 희소 island 분리, thumbnail native lazy loading이다.

## 6. 검증 결과

공식 Node 22에서 제품 코드 무변경 상태로 다음을 실행했다.

| 게이트 | 결과 | maximum RSS | swap |
|---|---|---:|---:|
| targeted Vitest (`refRegistryLazy`, `refGrammarManifest`) | 2 files, 8 tests 통과 | 452,116,480 B | 0 |
| full `npm test` | 267 files, 2,543 tests 통과 | 3,519,496,192 B | 0 |
| `npm run lint` | error 0, 기존 warning 2 | 649,052,160 B | 0 |
| `node scripts/check-content.mjs` | error 0, 기존 warning 12 | 91,848,704 B | 0 |
| `npm run check:reading` | error 0, 기존 warning 66 | 420,134,912 B | 0 |
| `node scripts/lint-curriculum.mjs` | error 0, 기존 warning 11 | 91,488,256 B | 0 |
| `npx next build` (cold) | 성공, 466/466 static pages | 7,452,917,760 B | 0 |

마지막으로 `git diff --check`를 통과했고 변경 경로는 `docs/review-code-performance.md` 하나뿐이다. 보고서 SHA-256은 같은 파일을 연속 두 번 읽어 byte-identical인지 확인한다.

## 7. 결론

가장 큰 실제 cold 비용은 build 표에 드러나지 않는 전역 폰트다. JS 표 안에서는 `/lessons`의 `worldMapPaths`가 가장 명확한 단일 원인이고, HTML/RSC에서는 `/lessons`와 `/home`의 전 언어 catalog 직렬화가 크다. 반면 이전 문법 lazy-load 작업은 398KB manifest를 server에만 유지하고 content dynamic import와 ISR을 보존했다. 따라서 다음 구현은 문법 content 파일이나 정렬/API를 다시 건드리기보다, 위 Top 5를 각각 좁은 allowlist·별도 성능 예산으로 승인받아 진행하는 편이 안전하다.
