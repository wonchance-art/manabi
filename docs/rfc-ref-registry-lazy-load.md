# RFC — 문법 레지스트리 레벨 지연 로드

- 상태: **제안(승인·exact allowlist 전 구현 금지)**
- 발주: 이슈 #150 코멘트 `5126671583`
- 기준 `git rev-parse HEAD`: `3e5ce2909d8716da6861f67a028d3c51711191bd`
- 관련 정렬 계약: #693 `SORTED`
- 벤치: `docs/bench-learn-grammar-bundle.md`
- 금지 범위: `src/content/*/grammar/**` 전체

## 결정

`getGrammarChapters(levelKey): Chapter[]`를 **cold 첫 호출에서도 동기**로 유지하면서 해당 level의
module을 그 호출 시점에 `import()`하는 것은 불가능하다. ECMAScript dynamic import는 항상
Promise이며, 아직 평가되지 않은 chapter 배열을 동기 반환할 수 없다.

다음 우회는 계약을 지키지 못한다.

- cold 호출에서 `[]` 반환: 반환 type은 배열이어도 기존 의미와 chapter shape가 깨진다.
- lightweight chapter 반환: `sections`, `drills`, `story` 등이 없어 반환 shape가 깨진다.
- 모든 level을 미리 await한 뒤 기존 API 노출: 동기 API는 보존하지만 lazy-load 효과가 사라진다.
- thenable/Proxy로 배열 흉내: Array 계약과 직렬화·iteration·테스트를 깨뜨린다.

따라서 기존 eager registry의 public 동기 함수는 그대로 두고, 새 lazy 경로에 명시적인
`await loadGrammarLevel(levelKey)`/`await loadChapter(slug)` 경계를 추가하는 병행 이행안을
제안한다. await가 끝나 반환되는 **loaded registry view**에서는
`getGrammarChapters(levelKey)`의 이름, 동기 signature, `Chapter[]` shape를 그대로 유지할 수 있다.
하지만 “어떤 소비처에서든 preload 없이 동기 호출 가능”이라는 현재 전역 의미까지 보존할 수는 없다.

원 발주의 판정 조건에 따라 이 RFC에서 정지한다. shared source 구현은 Claude의 명시 승인과 아래
exact allowlist 회신 뒤에만 착수한다.

## 현재 결합점

`createRegistry()`는 생성 순간에 다음을 전부 만든다.

1. `grammarMap`의 모든 level을 복사·정렬한 `SORTED`
2. 모든 level을 펼친 `ALL_CHAPTERS`
3. 전체 chapter 위치를 담은 `BY_SLUG`

네 언어 `index.js`는 모든 grammar module을 정적 import한 뒤 registry를 만든다.
`refLangs.js`는 다시 네 index를 모두 정적 import한다. 문법 상세 route도 언어 index의
`ALL_CHAPTERS`와 `getChapter`를 정적 import한다.

`getGrammarChapters`만 async로 바꾸는 것으로 끝나지 않는 이유:

- `generateStaticParams()`는 전체 slug를 동기 `ALL_CHAPTERS`에서 읽는다.
- `getChapter(slug)`는 전체 언어 순서의 full `chapter/prev/next` 객체를 반환한다.
- `ReferenceChapterPage`는 `refLangs`를 정적 import하고, 같은 level 전체 chapter로 누적 복습을
  만들며, bunkei/vocab/course context도 동기 조회한다.
- `courseMapData`는 네 언어 index를 정적 import하므로 `ReferenceChapterPage`가 이를 import하는
  것만으로 grammar 전체 graph가 다시 연결된다.
- study, review, writing, API, test 소비처도 현재 eager `ALL_CHAPTERS/getChapter` 의미에 의존한다.

즉 `refRegistry.js` 한 파일과 route page만 바꾸는 구현은 실제 module graph를 분할하지 못하거나
API 의미를 깨뜨린다.

## 제안 구조

### 1. 기존 eager API 보존

현재 `createRegistry(levelMeta, grammarMap, vocabMap)`와 네 언어 index의 export는 1차 구현에서
그대로 둔다. 기존 study/review/writing/API 소비처의 동기 의미와 반환 shape를 건드리지 않는다.
이 경로는 migration 완료 전 compatibility fallback이며, 이 경로를 import한 route는 계속 eager다.

### 2. 경량 생성 manifest

새 `refGrammarManifest.js`는 grammar 본문 없이 다음만 가진다.

- 언어/level metadata와 고정 표시 순서
- chapter의 `slug`, `level`, `order`, `title`, `topic`, `summary`, `duration`
- 전체 언어 순서에서 이전/다음 slug
- level별 vocab count와 chapter별 bunkei 관련 개수
- 문법 상세 CTA에 필요한 course lesson/next lesson 식별자

manifest는 생성 스크립트로 현재 eager registry에서 만들고 checked-in한다. drift test는 같은 Node
process에서 eager registry와 manifest를 exact 비교한다. 런타임 lazy entry는 이 생성 과정이나
eager registry를 import하지 않는다.

### 3. literal level loader

언어별 `grammarLoader.js`가 level key별 literal `import()`만 가진다. 템플릿 경로
`import(\`./grammar/${level}.js\`)`는 Webpack context chunk가 불필요한 파일을 포함할 수 있으므로
금지한다.

현재 조립 의미도 loader 안에서 그대로 유지한다.

- Japanese N5: `n5` + `scene_emergency`
- French A1/A2: expansion/pronunciation/scene/filter/sandwich 조립
- English: `status` 제거 후 expansion을 chapter level로 filter
- Chinese: level별 `*_examples`를 `withExtraExamples`로 병합하고 H1 scene을 조립

grammar 파일 자체는 읽기 전용이며 한 바이트도 수정하지 않는다.

### 4. lazy registry 상태

`createLazyRegistry({ levelMeta, manifest, loaders, facade })`는 다음 async 진입점을 제공한다.

```text
loadGrammarLevel(levelKey) -> Promise<loaded registry view>
loadChapter(slug)           -> Promise<{ ref, chapter, prev, next }>
```

level별 Promise/cache 규칙:

- unknown language/level/slug는 import 전에 명시 오류
- 같은 level 동시 요청은 같은 Promise
- 성공 배열은 세션의 module cache와 registry cache에서 재사용
- 실패 Promise는 cache에서 제거해 재시도 허용
- manifest와 payload의 slug/level/order mismatch는 성공으로 cache하지 않음
- payload 배열은 로드 완료 직후 #693 comparator로 안정 정렬

`loadChapter(slug)`는 경량 manifest로 target level을 먼저 찾는다. 같은 level 안의 prev/next는
이미 로드된 배열에서 가져온다. level 경계의 첫/마지막 chapter이면 full prev/next shape를
보존하기 위해 필요한 인접 level 하나도 await한다. 따라서 일반 target은 한 level, 경계 target은
최대 두 level이다.

### 5. 문법 상세 route만 1차 전환

1차 구현은 네 `grammar/[slug]` route에만 새 lazy entry를 사용한다.

- `generateStaticParams`: 경량 manifest의 slug 목록
- `generateMetadata`: `await loadChapter(slug)`
- page: 동일 loader 결과의 loaded `ref`를 `ReferenceChapterPage`에 주입
- `ReferenceChapterPage`: `refLangs`와 eager `courseMapData` 정적 import를 제거하고, manifest
  facade가 제공한 동기 조회만 사용

다른 레슨·복습·관리자·API 경로는 기존 eager registry를 유지한다. 전면 전환은 별도 발주와
별도 allowlist가 필요하다.

## 동기 signature와 반환 shape 판정

| 계약 | cold lazy registry | `await` 후 loaded view | 기존 eager registry |
|---|---|---|---|
| `getGrammarChapters(levelKey)` 동기 함수 | **불가** | **가능** | **유지** |
| 반환 `Chapter[]` full shape | 아직 payload 없음 | **유지** | **유지** |
| `getChapter(slug)` full `chapter/prev/next` | **불가** | 인접 level 필요 시 추가 await 후 **유지** | **유지** |
| `ALL_CHAPTERS` full array | **불가** | 로드된 일부만으로는 불가 | **유지** |
| 전체 slug/metadata 열거 | 경량 manifest로 가능 | 가능 | 유지 |

결론은 “signature를 바꾸지 않고 cold 동적 import”가 아니라 “async route loader 뒤의 기존 동기
view 보존”이다. 이 두 의미를 같은 것으로 간주하면 안 된다.

## #693 `SORTED` 보존

현재 comparator는 유한한 `order`를 우선하고, order가 없으면
`Number.MAX_SAFE_INTEGER`로 보내며 stable sort로 원순서를 유지한다.

```js
const ord = chapter =>
  Number.isFinite(chapter?.order) ? chapter.order : Number.MAX_SAFE_INTEGER;
chapters.slice().sort((a, b) => ord(a) - ord(b));
```

후속 구현은 이 comparator를 공용 함수 하나로 추출해 eager/lazy 양쪽이 exact 공유해야 한다.
loader 완료 순서나 Promise resolution 순서를 목록 순서로 쓰면 안 된다. `ALL_CHAPTERS` 또는 경량
manifest의 언어 전체 순서는 `LEVEL_META` 순서 후 level 내부 `SORTED` 순서다.

필수 회귀 테스트:

1. #693 기존 fixture: order 오름차순, missing order는 뒤·원순서 유지
2. lazy level을 두 번 독립 로드해 slug 배열 SHA-256 동일
3. 두 level을 반대 완료 순서로 병렬 로드해 각 level과 manifest 전체 순서 동일
4. French A1/A2 order 연속성 유지
5. target/인접 level을 제외한 loader 호출 0
6. 동일 level 동시 요청 import 1회, 실패 후 재시도 가능
7. eager/lazy target level의 full chapter deep equality

## 성공 기준

- `/learn` root의 initial JS/HTML은 기준선 대비 증가 0.
- 일반 문법 상세 cold load는 전체 47개가 아니라 target level만 평가한다.
- level 경계 chapter는 full prev/next 보존을 위해 인접 level 최대 1개 추가만 허용한다.
- eager/lazy target level chapter 배열이 byte-identical canonical JSON SHA-256이다.
- #693 order, `getGrammarChapters` loaded-view signature, full chapter shape, 기존 route output이 동일하다.
- targeted와 full Vitest, lint, production build가 green이다.
- before/after asset/module graph, cold/warm 요청, build/request RSS와 swaps를 보고한다.
- manifest drift와 grammar source 수정이 0이다.

## exact implementation allowlist 요청

다음 **15개 path만** 1차 route-only 구현에 필요한 최소 범위로 요청한다. wildcard 확대는 없다.

1. `src/content/refRegistry.js`
2. `src/content/refGrammarManifest.js` (new, generated lightweight data)
3. `src/content/refGrammarLoaders.js` (new, language dispatch/facade)
4. `src/content/japanese/grammarLoader.js` (new)
5. `src/content/french/grammarLoader.js` (new)
6. `src/content/english/grammarLoader.js` (new)
7. `src/content/chinese/grammarLoader.js` (new)
8. `scripts/build-ref-grammar-manifest.mjs` (new)
9. `src/app/(app)/japanese/grammar/[slug]/page.jsx`
10. `src/app/(app)/french/grammar/[slug]/page.jsx`
11. `src/app/(app)/english/grammar/[slug]/page.jsx`
12. `src/app/(app)/chinese/grammar/[slug]/page.jsx`
13. `src/views/ReferenceChapterPage.jsx`
14. `src/content/__tests__/refRegistryLazy.test.js` (new)
15. `src/content/__tests__/refGrammarManifest.test.js` (new)

`src/content/*/grammar/**`, 네 언어 기존 `index.js`, `src/content/refLangs.js`,
`src/lib/learn/courseMapData.js`, 그 밖의 소비처는 이 1차 allowlist에 포함하지 않는다.
`ReferenceChapterPage`가 현재 `courseMapData`에서 받는 CTA context는 생성 manifest에 포함해
eager import를 제거한다.

이 정확한 15개 path와 “cold 호출은 async loader, loaded view의 sync API 보존”이라는 API 판정을
승인받기 전에는 구현하지 않는다. 전면 migration을 원하면 별도 RFC로 모든 sync 소비처의 exact
allowlist를 다시 산정한다.

## 롤백

1차 구현은 기존 eager registry를 제거하지 않는다. 네 route page와
`ReferenceChapterPage`의 loader 주입 변경을 revert하면 즉시 기존 eager 경로로 돌아간다.
manifest와 loader 신규 파일은 소비처가 없어 tree에서 빠지며 grammar source에는 rollback
diff가 없다.
