# 전체 코드 리뷰 R1 — scripts·설정·테스트

- 발주: issue #150 comment `5192929678`
- 고정 base: `8e7e41778f338c0ed8a5d6744dedd011fb409a74`
- 브랜치: `codex3/review-code-scripts-config-tests`
- 성격: report-only. 제품 코드·설정·테스트는 수정하지 않았다.
- 판정 요약: **치명 2 · 중대 12 · 경미 2**

## 1. 범위와 정독/스캔 구분

### 정독

다음 게이트 8파일, 합계 4,052줄을 전부 읽었다.

1. `scripts/check-content.mjs` (476줄)
2. `scripts/check-furigana.mjs` (114줄)
3. `scripts/check-reading.mjs` (1,067줄)
4. `scripts/lint-content.mjs` (723줄)
5. `scripts/lint-curriculum.mjs` (487줄, (a)~(h) 포함)
6. `scripts/lint-dialogue-ipa.mjs` (290줄)
7. `scripts/world/check-overworld-assets.mjs` (161줄)
8. `scripts/verify-city-geo.mjs` (734줄)

또한 `next.config.mjs`, `public/sw.js`, `scripts/update-sw-version.mjs`, `package.json`,
`src/app/api/admin/backfill-base-form/route.js`, `src/lib/server/tokenizeJa.js`를 정독했다.
게이트와 직접 연결되는 테스트인
`src/lib/__tests__/lintCurriculum.test.js`,
`scripts/lint-dialogue-ipa.test.js`,
`scripts/reading/__tests__/check-reading.selftest.test.js`,
`src/lib/world/__tests__/overworldAssetAudit.test.js`,
`src/lib/world/__tests__/beijingCityGate.test.js`,
`src/components/world/__tests__/beijingGeo.test.js`도 정독했다.

### 전수 스캔

`src` 아래 테스트 **258파일·43,759줄**을 파일 인벤토리, 테스트/단언, skip/todo,
소스 텍스트 직접 검사, snapshot 사용 기준으로 전수 스캔했다. 정적으로 식별한
`it/test` 선언은 2,231건, `expect` 호출은 7,419건이고 skip/todo 파일은 0개였다.
53파일은 제품/마이그레이션/자산 소스를 직접 읽어 검사하고, 5파일은 snapshot 단언을 쓴다.
258파일 전부를 의미 단위로 정독하지는 않았으며, 아래 “미커버 핵심 경로 상위 5”와
게이트 인접 테스트를 우선 정독했다.

### 설계 전제 준수

- 음성 정본은 Web Speech TTS라는 전제를 유지했다. `lint-dialogue-ipa` 실측의
  중국어·일본어 IPA 누락 176건은 결함으로 세지 않았다.
- 게스트 localStorage 정본, `drillSrs` 단일 기록 경로를 변경 대상으로 제안하지 않았다.
- world·studies 동결 영역에는 수정안을 제안하지 않았다. 검증기의 fail-open만 지적했다.

## 2. 치명

### C-01. 배포 build가 새 스키마/커리큘럼 게이트를 실행하지 않는다

- 위치: `package.json:12`
- 원문: `"prebuild": "node scripts/check-content.mjs && node scripts/check-reading.mjs && node scripts/world/build-overworld-fixture.mjs --check && node scripts/world/build-world-node-geo-manifest.mjs --check && node scripts/world/check-overworld-assets.mjs && node scripts/update-sw-version.mjs && node scripts/copy-pdf-worker.mjs"`
- 영향: `lint-content.mjs`와 `lint-curriculum.mjs`는 build 경로에 없다.
  `lint-dialogue-ipa.mjs`도 live corpus 대상으로 실행되지 않는다. 따라서 `npm run build`만
  통과해도 139개 active grammar/vocab 모듈의 새 스키마 계약과 curriculum (a)~(h)를
  통과했다는 뜻이 아니다. 특히 아래 M-04의 hard-coded module 누락과 결합하면 expansion/scene
  콘텐츠 결함이 배포 build에서 조용히 빠질 수 있다.
- 수정안: `prebuild` 앞단에 `node scripts/lint-content.mjs`와
  `node scripts/lint-curriculum.mjs`를 넣는다. IPA는 TTS 정본 정책상 report-only를 유지하되
  명령 실행 실패 자체와 baseline 증가만 별도 정책으로 고정한다. 세 명령이 실제 prebuild에
  포함됐는지 테스트하는 composition 테스트를 추가한다.

### C-02. 지정된 도시 스냅샷이 없어도 official verifier가 성공한다

- 위치: `scripts/verify-city-geo.mjs:701-709`
- 원문:

  ```js
  if (snapPath && fs.existsSync(snapPath)) {
    // ...
    gate('스냅샷 계약 v2+ (가시 도로 분류)', version >= 2, `version ${version}`);
  } else {
    report('스냅샷 계약', gates.snapshot ? `SKIP (${gates.snapshot} 없음)` : 'SKIP (경로 미확정)');
  }
  ```

- 영향: `CITY_GATES[city].snapshot`이 명시돼도 파일 부재가 hard fail이 아니라 report가 된다.
  본생성의 snapshot exact handoff를 verifier가 독립적으로 보장하지 못하며, 나머지 수치가
  맞으면 마지막 `failed === 0`으로 exit 0이 된다.
- 수정안: `gates.snapshot`이 있으면 부재·읽기 실패·version 미검출을 모두 hard fail로 바꾼다.
  스냅샷 없는 조사용 실행은 별도 `--report-only-no-snapshot` 플래그를 명시해야만 허용한다.

## 3. 중대

### M-01. POI 좌표가 전부 사라져도 “재투영 0.00타일”로 통과한다

- 위치: `scripts/verify-city-geo.mjs:641-649`
- 원문:

  ```js
  for (const poi of geo.pois || []) {
    if (poi.lon == null) continue;
    // ...
  }
  gate(`POI 재투영 ≤${gates.poiMaxDevTiles}타일`, worstDev <= gates.poiMaxDevTiles,
    `worst ${worstId} ${worstDev.toFixed(2)}타일`);
  ```

- 재현: base의 `BUSAN_GEO`에서 모든 POI의 `lon/lat`만 제거한 임시 모듈을 `--file`로
  주입했다. verifier는 `✅ POI 재투영 ≤2.5타일 — worst  0.00타일`과
  `busan: 전 게이트 통과`를 출력했다.
- 영향: 0건 검사와 0오차를 구분하지 않아 POI 정본 좌표가 통째로 유실돼도 false green이다.
- 수정안: POI마다 `id`, finite `lon/lat`, 2원소 finite `tile`을 먼저 hard gate하고,
  검사 건수가 `geo.pois.length`와 같을 때만 편차를 판정한다. empty 배열도 도시별 기대 개수 또는
  최소 1개 계약으로 거부한다.

### M-02. 비한국 도시도 한국 snapshot 분류기만 검사하고 로드 실패는 skip한다

- 위치: `scripts/verify-city-geo.mjs:710-715`
- 원문:

  ```js
  const { roadStyle } = await import(path.join(root, 'scripts/build-korean-city-osm-snapshot.mjs'));
  // ...
  } catch {
    report('roadStyle 계약', 'SKIP (스냅샷 스크립트 없음)');
  }
  ```

- 영향: 프랑스·중국·호주 도시에 대해서도 해당 도시 snapshot builder가 아니라 한국 builder의
  `roadStyle`만 green인지 본다. import/실행 결함까지 report-only로 강등돼, 표시되는
  `roadStyle 계약 ... OK`가 대상 파이프라인의 증거가 아니다.
- 수정안: `CITY_GATES`에 classifier/builder 모듈을 명시하거나 공통 `roadStyle` 정본을 한 모듈로
  추출한다. configured classifier 로드 실패는 exit 1로 처리한다.

### M-03. curriculum (a)~(h)는 유효한 JS 표기·서식 변경만으로 검사망을 우회할 수 있다

- 위치: `scripts/lint-curriculum.mjs:21-29, 174-181, 380-382`
- 원문:

  ```js
  const slugRe = /^\s+slug: "([^"]+)",\s*$/gm;
  const level = seg.match(/level: "([^"]+)"/)?.[1];
  const orderRaw = seg.match(/order: (\d+)/)?.[1];
  const dm = seg.match(/drills: \[([\s\S]*?)\n    \]/);
  const re = /zh: "((?:[^"\\]|\\.)*)",\s*pinyin: "((?:[^"\\]|\\.)*)"/g;
  ```

- 영향: single quote, quoted key, property 재배치, `order: 1_000`, 다른 closing indent,
  중첩 객체/brace, `pinyin`과 `zh` 사이의 추가 필드만으로 해당 객체가 0건으로 사라질 수 있다.
  특히 (f) drill 중복과 (h) pinyin 정합이 “검사할 대상 없음”으로 green이 되는 false negative다.
- 수정안: JS source regex를 폐기하고 모듈 import 후 런타임 객체 스키마를 순회한다.
  import가 어려운 파일은 Babel/Acorn AST를 사용한다. 최소한 각 gate에 single quote,
  property reorder, nested object, multiline/indent mutation fixture를 추가한다.

### M-04. `check-content`가 expansion·scene grammar 모듈을 열거하지 않는다

- 위치: `scripts/check-content.mjs:182-188, 352-357`
- 원문:

  ```js
  const LANGS = {
    japanese: { g: ['ot', 'n5', 'n4', 'n3', 'n2', 'n1'], ... },
    english:  { g: ['ot', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], ... },
    french:   { g: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], ... },
    chinese:  { g: ['ot', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], ... },
  };
  // ...
  const m = await import(new URL(`${lang}/grammar/${lv}.js`, root));
  ```

- 영향: 현재 트리에 있는 `french/a1_expansion.js`, `a1_pronunciation.js`,
  `a1_sandwich_pilot.js`, `a2_scenes.js`, 4트랙 `scene_*`, `english/expansion.js`,
  `chinese/h1_pronunciation.js` 등은 이 gate의 slug/patternKo/example/kanji 검사 대상이 아니다.
  C-01 때문에 전 파일 발견형 `lint-content`도 build에서 실행되지 않는다.
- 수정안: 디렉터리 전 파일을 발견하고 export shape에 따라 chapter/supplement를 분류한다.
  explicit allowlist가 필요하면 “포함 목록” 대신 비chapter 보조 모듈만 예외로 둔다.

### M-05. drill scanner 한 번의 예외가 남은 트랙 전체를 warning으로 fail-open한다

- 위치: `scripts/lint-curriculum.mjs:163-204`
- 원문:

  ```js
  try {
    for (const track of ['french', 'chinese', 'english', 'japanese']) {
      // 모든 트랙 scan
    }
  } catch (e) {
    warnings.push(`드릴 비중복 게이트 실패: ${e}`);
  }
  ```

- 영향: 한 트랙의 디렉터리/read/parse 오류가 발생하면 그 지점부터 뒤 트랙을 스캔하지 않고
  exit 0 후보가 된다. “scanner 자체가 실패”한 상태를 콘텐츠 경고와 동일하게 취급한다.
- 수정안: 트랙별 try/catch로 범위를 좁히고 scanner/internal I/O 오류는 항상 `errors`로 올린다.
  report-only 정책은 정상 scan 결과에만 적용한다.

### M-06. (f)의 “fr fail” 정책과 달리 모든 트랙 중복을 hard error로 만든다

- 위치: `scripts/lint-curriculum.mjs:160, 191-197`
- 원문:

  ```js
  // (f) 드릴 비중복 게이트 (RFC learning-path §2 — fr fail)
  if (frSet.has(sent)) errors.push(`${track} 드릴 중복...`);
  if (local.has(sent)) errors.push(`${track} 드릴 중복...`);
  if (globalSeen.has(sent)) errors.push(`${track} 드릴 중복...`);
  ```

- 영향: 주석·상단 수위 계약은 French fail을 말하지만 구현은 chinese/english/japanese도
  무조건 exit 1로 승격한다. 타 트랙에서 의도된 고정구/최소쌍 재사용이 생기면 false positive다.
- 수정안: `ENFORCED`와 같은 정책 테이블로 (f) severity를 결정하고 French 외 트랙은
  baseline/report-only로 유지한다. 정책 변경이라면 주석·RFC·테스트를 함께 갱신한다.

### M-07. yomi에 한글 한 글자만 있어도 전체 정합 검사를 면제한다

- 위치: `scripts/check-furigana.mjs:18-21, 93-97`
- 원문:

  ```js
  if (/[가-힣]/.test(yomiRaw)) return 'KO_MIXED';
  // ...
  const r = alignFurigana(ex.ja, ex.yomi);
  if (r === null) fail.push(...);
  ```

- 재현: `{ ja: '公です', yomi: '완전히 잘못된 독음' }` 한 건의 임시 vocab fixture를
  검사했으며 `검사: 1개 예문 — 정렬 실패 0건`으로 exit 0했다.
- 영향: OT 한글 병기 예외가 문자열 전체 면제로 구현돼, 실제 일본어 yomi가 틀리거나 없어도
  한글을 섞으면 false green이다.
- 수정안: KO_MIXED를 허용하는 track/level/필드와 병기 문법을 명시하고 일본어 부분을 분리해
  검사한다. 최소한 `KO_MIXED`를 별도 count로 출력하고 허용 대상 외에는 hard fail한다.

### M-08. 서비스워커 버전이 콘텐츠가 아니라 분 단위 wall clock이라 충돌·비결정성을 만든다

- 위치: `scripts/update-sw-version.mjs:10, 19, 26`
- 원문:

  ```js
  const version = `anatomy-studio-v${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
  const updated = src.replace(cacheLine, `const CACHE_NAME = '${version}';`);
  writeFileSync(swPath, updated);
  ```

- 영향: 같은 분 안의 두 배포는 서로 다른 콘텐츠여도 같은 cache name을 쓸 수 있어 구 public
  asset이 cache-first에 고착된다. 반대로 byte-identical 재빌드는 시간이 다르면 tracked `sw.js`와
  산출물이 달라져 결정성·clean build를 깨뜨린다.
- 수정안: commit SHA 또는 precache manifest content hash를 build-time define으로 주입하고
  tracked source를 직접 rewrite하지 않는다. 동일 콘텐츠 2회 동일 버전, 콘텐츠 변경 시 다른 버전을
  검증하는 테스트를 추가한다.

### M-09. navigation 404/500 응답도 offline cache에 저장한다

- 위치: `public/sw.js:62-70`
- 원문:

  ```js
  fetch(request)
    .then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline')))
  ```

- 영향: 일시적 500, 인증 redirect 결과, 404도 정상 navigation snapshot처럼 저장된다. 이후
  네트워크 장애 시 마지막 정상 화면 대신 실패 응답을 재생한다.
- 수정안: same-origin navigation이면서 `response.ok`이고 허용된 최종 URL일 때만 `cache.put`한다.
  200→500→offline 순서와 redirect/auth 응답을 service-worker harness로 회귀 고정한다.

### M-10. kuromoji dict tracing이 `/api/analyze`만 포괄하고 같은 소비자인 admin route를 빠뜨린다

- 위치: `next.config.mjs:6-9`, `src/app/api/admin/backfill-base-form/route.js:5-8`,
  `src/lib/server/tokenizeJa.js:9-13`
- 원문:

  ```js
  outputFileTracingIncludes: {
    '/api/analyze': ['./node_modules/kuromoji/dict/**/*'],
  },
  // admin route
  import { tokenizeJaLine } from '@/lib/server/tokenizeJa';
  // tokenizer
  return path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict');
  ```

- 영향: `/api/admin/backfill-base-form`도 runtime에 같은 dict 디렉터리를 읽지만 route-specific
  include 대상이 아니다. 배포 output에서 `/api/analyze`는 살고 admin backfill만 dict ENOENT로
  실패할 수 있으며, 현재 해당 route 테스트도 없다.
- 수정안: 두 route를 포괄하는 명시 key를 추가하거나 tokenizer를 쓰는 Node route 공통 glob에
  dict를 포함한다. `next build` 산출물의 두 function trace에 dict가 있는지 검사한다.

### M-11. package runtime 선언이 저장소의 Node 22 결정성 계약과 다르다

- 위치: `package.json:6-8`
- 원문:

  ```json
  "engines": {
    "node": "20.x"
  }
  ```

- 영향: 로컬/인수 게이트는 공식 Node 22를 요구하지만 package metadata는 배포·설치 환경에
  Node 20을 요청한다. PNG/hash와 build 결과를 서로 다른 런타임에서 비교하게 될 수 있다.
- 수정안: `engines.node`를 검증 정본과 같은 22.x로 올리고 `.nvmrc`/CI/Vercel runtime도 하나로
  고정한다. 전환 시 Node 22에서 전체 test/build SHA를 새 기준으로 승인한다.

### M-12. `lintCurriculum` 테스트가 live tree green만 확인해 parser mutation을 못 잡는다

- 위치: `src/lib/__tests__/lintCurriculum.test.js:4-8`
- 원문:

  ```js
  it('fr A1~A2는 ... 통과한다', async () => {
    const { errors } = await runCurriculumLint();
    expect(errors).toEqual([]);
  }, 30000);
  ```

- 영향: 현재 데이터가 green이라는 사실만 보며, M-03/M-05/M-06의 false negative·fail-open·
  과잉 승격을 결함 주입으로 검증하지 않는다. parser가 0건을 반환해도 현재 결과는 green일 수 있다.
- 수정안: `repoRoot`/source 주입이 가능한 순수 scanner API로 분리하고 (a)~(h)마다 positive와
  negative fixture를 둔다. “대상 개수”도 기대값으로 고정해 0건 scan을 실패시킨다.

## 4. 경미

### L-01. `@dnd-kit` direct dependency 두 개는 실사용 참조가 0건이다

- 위치: `package.json:29-30`
- 원문:

  ```json
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0"
  ```

- 근거: package/lock/docs/node_modules를 제외하고 import, require, package literal,
  `DndContext`, `SortableContext`, `useSortable`, `useDraggable`를 수동 추적했으며 0건이었다.
  `@types/react*`는 literal 0건이어도 editor/type provider라 제거 후보로 세지 않았고,
  `eslint-config-next`는 `next/core-web-vitals`로 간접 참조돼 유지 대상으로 판정했다.
- 수정안: 두 package를 제거하고 lockfile을 갱신한 뒤 lint/test/build를 비교한다.

### L-02. service-worker activate가 자신의 namespace 밖 cache까지 삭제한다

- 위치: `public/sw.js:26-30`
- 원문:

  ```js
  caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
  )
  ```

- 영향: 현재 저장소의 다른 Cache API 소비는 없지만, 같은 origin에 향후 별도 worker/cache가
  추가되면 manabi SW 활성화가 전부 지운다.
- 수정안: `anatomy-studio-v` prefix에 속하면서 현재 버전이 아닌 cache만 삭제한다.

## 5. 테스트가 못 잡는 핵심 경로 상위 5

|순위|경로|근거 원문|필요 테스트|
|---:|---|---|---|
|1|배포 gate composition과 expansion 발견|`package.json:12` — `prebuild`에 `lint-content`/`lint-curriculum` 없음|임시 malformed expansion을 두고 `npm run prebuild`가 실패하는 integration test|
|2|city verifier의 malformed/empty input|`verify-city-geo.mjs:643` — `if (poi.lon == null) continue;`|snapshot 부재, POI 0건/좌표 누락, 잘못된 locale classifier 결함 주입|
|3|SW install→activate→fetch lifecycle|`public/sw.js:67` — `cache.put(request, clone)` 무조건 실행|same-minute 두 release, 500 navigation, cache namespace, offline fallback harness|
|4|두 kuromoji route의 배포 trace|`next.config.mjs:8` — `'/api/analyze'` 단일 key|`next build` 후 analyze/admin function trace 모두 dict 포함 + route smoke|
|5|curriculum parser의 입력 변형|`lintCurriculum.test.js:7` — `expect(errors).toEqual([])` 단일 live assertion|(a)~(h) single quote/property reorder/indent/nested brace/I/O failure mutation matrix|

## 6. 의존성 수동 판정

|판정|패키지|근거|
|---|---|---|
|제거 후보|`@dnd-kit/core`, `@dnd-kit/sortable`|코드·설정 import/require/symbol 참조 0건|
|유지|`kuromoji`, `kuromojin`|각각 `scripts/reading/derive-yomi.cjs`, `src/lib/server/tokenizeJa.js`에서 직접 사용|
|유지|`eslint-config-next`|`eslint.config.mjs`의 `compat.extends('next/core-web-vitals')`가 소비|
|유지(암시적)|`@types/react`, `@types/react-dom`|JS 프로젝트의 editor/type provider; literal 0만으로 제거 판정하지 않음|
|중복 근거 없음|나머지 direct dependencies|각 package import/require 또는 build/runtime 소비처를 1건 이상 확인|

## 7. 실행 증거

Node는 공식 v22.23.1을 사용했다.

- `node scripts/lint-curriculum.mjs`: exit 0, 0 errors / 11 warnings
- `node scripts/check-content.mjs`: exit 0, 0 errors / 12 warnings
- `node scripts/check-reading.mjs --self-test`: exit 0, mutation 38/38 검출
- `node scripts/lint-content.mjs`: exit 0, 139 active modules / 0 errors / 0 warnings
- `node scripts/lint-dialogue-ipa.mjs`: exit 0, report-only 176 missing / 469 speaker objects
- `node scripts/world/check-overworld-assets.mjs`: exit 0, 2 regions / 11 manifests /
  561 artifacts / 35,048,838 bytes
- `node scripts/verify-city-geo.mjs --city busan`: exit 0
- POI 좌표 제거 mutation: **예상 실패와 달리 exit 0** (M-01 재현)
- KO_MIXED 오독 mutation: **예상 실패와 달리 exit 0** (M-07 재현)

- targeted: `vitest run src/lib/__tests__/lintCurriculum.test.js scripts/lint-dialogue-ipa.test.js scripts/reading/__tests__/check-reading.selftest.test.js src/lib/world/__tests__/overworldAssetAudit.test.js`
  — **4 files / 7 tests passed**
- full: `npm test` — **265 files / 2,532 tests passed**
- full-test peak RSS (`/usr/bin/time -l`): **3,001,532,416 bytes (2,862.48 MiB)**

## 8. 권장 처리 순서

1. C-02, M-01, M-02를 묶어 official city verifier를 fail-closed로 만든다.
2. C-01과 M-04로 실제 배포 build가 전 파일 gate를 소비하게 한다.
3. M-03/M-05/M-06/M-12를 AST/object scanner + mutation fixture로 교체한다.
4. M-08/M-09/L-02를 content-hash SW cache lifecycle로 재설계한다.
5. M-10/M-11을 배포 trace와 Node 22 runtime 계약으로 고정한다.
6. L-01 dependency 제거는 위 correctness 수정과 분리한다.

## 9. M-11 승인 전 런타임 실측 후속 보고

2026-08-06 후속 구현 발주(issue #150 comment `5194144381`)의 승인 게이트에 따라
`engines.node`는 바꾸지 않고 배포 런타임과 Node 22 PNG gate만 실측했다.

### 저장소 선언(변경 없음)

- 위치: `package.json:6-8`
- 원문:

  ```json
  "engines": {
    "node": "20.x"
  }
  ```

### Vercel production build 실측

- 대상: production READY deployment `dpl_BwGVGLZJ29HWx4kTNwfmbtvGXED4`
- Git main head: `2b4fa4897982a62ce77c0d2295d91cbf89f89930`
- build log 원문:

  ```text
  Warning: Due to "engines": { "node": "20.x" } in your `package.json` file,
  the Node.js Version defined in your Project Settings ("24.x") will not apply,
  Node.js Version "20.x" will be used instead.
  ```

- 판정: 현재 Vercel project setting은 24.x지만 package 선언이 우선되어 실제 production
  build는 **Node 20.x**를 사용한다. 배포 생성·설정 변경은 수행하지 않았다.

### 공식 Node 22 PNG/hash gate

- 로컬 런타임: `v22.23.1`
- gate: `vitest run src/components/world/__tests__/londonOverpassPipeline.test.js`
- 결과: 2회 모두 **1 file / 6 tests passed**
- 동일 snapshot 2회 직접 렌더:

  ```text
  run1 bytes=487858 sha256=c2c5f745d3301d1c526dae8e1697df9b8793b4f7d36a9f540452e34f017f796d
  run2 bytes=487858 sha256=c2c5f745d3301d1c526dae8e1697df9b8793b4f7d36a9f540452e34f017f796d
  ```

- 판정: Node 22에서는 world PNG가 byte-identical이고 기존 hash gate와 일치한다. 다만 현재
  Vercel이 20.x로 빌드하며 project setting은 24.x이므로, `engines` 변경은 Node 22/24 전환
  정책과 production 재기준 승인을 받은 별도 PR에서 수행해야 한다.
