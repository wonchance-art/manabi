# `src/views` 전체 코드 리뷰 R1

## 리뷰 계약과 결론

| 항목 | 결과 |
| --- | --- |
| 배정 | issue #150 comment `5192929510` (`CODEX-2`, views 영역) |
| exact base | `8e7e41778f338c0ed8a5d6744dedd011fb409a74` |
| 브랜치 | `codex2/review-code-views` |
| 실제 범위 | `src/views` 46파일, 18,951줄 |
| 읽기 방식 | **정독 46파일 / 스캔 0파일** |
| 제품 코드 변경 | 없음 |
| 발견 요약 | 치명 3건 · 중대 10건 · 경미 3건 |

발주 당시의 “40파일 ≈18k줄”은 근사치였다. 기준 커밋의 실제 파일을 `rg --files src/views`로 고정한 뒤 JSX, CSS, helper, 테스트까지 전부 처음부터 끝까지 읽었다. 아래 지적은 재현 가능한 동작만 적었고, 각 항목에 원문과 수정안을 붙였다.

## 치명

### V-01. `AdminPage`는 인증 로딩이 끝나는 순간 Hooks 순서가 바뀌어 런타임 오류가 난다

- 위치: `src/views/AdminPage.jsx:99-117`
- 원문:

```jsx
export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState('users');
  // ...
  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!isAdmin) return (
    // ...
  );

  const { data: users = [], isLoading: usersLoading } = useQuery({
```

첫 렌더에서 `loading === true`면 `useQuery` 이하 Hooks를 호출하지 않고 반환한다. 인증 상태가 확정되어 다음 렌더가 진행되면 더 많은 Hooks를 호출하므로 React가 `Rendered more hooks than during the previous render`로 중단한다. 관리자 화면 전체가 정상 인증 흐름에서 열리지 않을 수 있다.

**수정안:** 인증 게이트만 담당하는 바깥 컴포넌트와 모든 query/mutation Hooks를 무조건 호출하는 `AdminContent`를 분리한다. 또는 모든 Hooks를 조건 없이 호출하고 `enabled: !loading && isAdmin && ...`로 네트워크 실행만 막는다.

### V-02. 모델·자료 텍스트를 HTML로 이스케이프하지 않고 주입해 XSS가 가능하다

- 위치: `src/views/ViewerGrammarModal.jsx:4-8`, `src/views/ViewerGrammarModal.jsx:78-97`
- 원문:

```jsx
function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="md-strong">$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em class="md-em">$1</em>')
    .replace(/`(.+?)`/g,       '<code class="md-code">$1</code>');
}
// ...
const html = inlineFormat(content);
return <span dangerouslySetInnerHTML={{ __html: html }} />;
// ...
return <p key={i} className="md-p" dangerouslySetInnerHTML={{ __html: html }} />;
```

- 위치: `src/views/ViewerPage.jsx:459-475`, `src/views/ViewerPage.jsx:843-848`
- 원문:

```jsx
cached ? Promise.resolve() : callGemini(`다음 ${langName} 텍스트를 한국어로 처리해주세요.

"${sel}"
// ...
`).then(raw => {
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '';
  setLeftPanelResult(text);
  // ...
})
// ...
<div className="pdf-context__text" dangerouslySetInnerHTML={{ __html: formatDetail(leftPanelResult) }} />
```

사용자가 고른 자료 문장이 모델 프롬프트에 들어가고 모델 응답이 그대로 HTML 경로에 도달한다. `<img onerror=...>` 같은 태그가 응답에 포함되면 브라우저가 실행할 수 있으며, 응답은 `localStorage`에도 캐시되어 반복 실행될 수 있다. `PdfViewerPage.jsx:231`과 `ViewerPage.jsx:800-801,1553-1555`도 같은 `formatDetail(...)` 주입 경로를 쓴다.

**수정안:** 원문을 먼저 HTML escape한 뒤 허용한 마크다운 토큰만 React 노드로 렌더링한다. HTML이 꼭 필요하면 신뢰 가능한 allowlist sanitizer를 마지막 경계에 두고 이벤트 속성, URL scheme, SVG/MathML 등을 차단한다. 모델 응답과 사용자 자료는 항상 비신뢰 입력으로 취급한다.

### V-03. 로그인 `from` 파라미터를 검증 없이 `router.push`에 넘긴다

- 위치: `src/views/AuthPage.jsx:23-26`, `src/views/AuthPage.jsx:56-58`
- 원문:

```jsx
const router = useRouter();
const searchParams = useSearchParams();
const from = searchParams.get('from') || '/materials';
// ...
await signIn(email, password);
router.push(from);
```

`from`은 URL에서 온 비신뢰 문자열이다. `javascript:` URL은 client router 경계에서 실행될 수 있고, `//host/path`나 외부 scheme은 오픈 리다이렉트로 악용될 수 있다.

**수정안:** 단일 `/`로 시작하는 내부 경로만 허용하고 `//`, scheme, 제어 문자, 역슬래시를 거부한다. 가능하면 허용 route 목록 또는 `URL` 파서 + same-origin 검사를 쓰고 실패하면 `/materials`로 고정한다.

## 중대

### V-04. `LessonsPage`는 `initialLevel`을 검증하지 않아 정상 트랙도 빈 목록으로 만든다

- 위치: `src/views/LessonsPage.jsx:33-40`, `src/views/LessonsPage.jsx:144-149`
- 원문:

```jsx
const urlLang = initialLang && VALID_LANGS.has(initialLang) ? initialLang : null;
const [langFilter, setLangFilter] = useState(urlLang ?? 'English');
// ...
const [levelFilter, setLevelFilter] = useState(initialLevel || 'all');
// ...
return refLang.levels
  .filter(l => levelFilter === 'all' || l.label === levelFilter)
```

언어는 allowlist로 검증하지만 레벨은 임의 문자열을 그대로 받는다. `/lessons?lang=English&level=N1` 또는 오타가 들어오면 존재하는 챕터가 모두 사라지고, 사용자는 잘못된 파라미터라는 설명도 받지 못한다. 언어 변경 뒤 이전 언어의 레벨이 남는 경우도 동일하다.

**수정안:** 선택 언어의 `refLang.levels[].label`에 포함된 값만 허용하고 나머지는 `all`로 정규화한다. 언어가 바뀌면 호환되지 않는 레벨을 즉시 리셋하고 canonical URL도 함께 갱신한다.

### V-05. `HomePage`는 DB 오류를 0건으로 해석해 기존 사용자를 신규 사용자로 표시한다

- 위치: `src/views/HomePage.jsx:38-78`, `src/views/HomePage.jsx:280-291`, `src/views/HomePage.jsx:342-344`
- 원문:

```jsx
const [
  { count: dueCount },
  { data: vocabRows },
  { data: recentProgress },
  // ...
] = await Promise.all([
  supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }),
  // ...
]);
// ...
const { data, isLoading } = useQuery({
  queryKey: ['home', user?.id, lang],
  queryFn:  () => fetchHomeData(user.id, lang),
  // ...
});
const todayVocab = data?.todayVocabCount ?? 0;
// ...
const isNewUser = dueCount === 0 && todayVocab === 0 && !data?.recentProgress?.length;
```

Supabase query는 일반적으로 reject하지 않고 `{ data, error }`를 반환한다. 현재 코드는 각 `error`를 확인하지 않아 RLS, 네트워크, 스키마 오류를 `undefined → 0/[]`로 바꾼다. React Query의 `isError`도 렌더하지 않아 장애가 “활동 없음/신규 사용자”로 위장된다.

**수정안:** 모든 응답의 `error`를 확인해 명시적으로 throw하거나 부분 실패 상태를 구조화한다. query의 `isError/error/refetch`를 표시하고, 데이터가 확인되지 않은 상태에서 `isNewUser`를 추론하지 않는다.

### V-06. 홈의 “오늘”은 KST 자정이 아니라 UTC 날짜와 로컬 파싱을 섞는다

- 위치: `src/views/HomePage.jsx:20-29`
- 원문:

```jsx
const todayStr   = new Date().toISOString().split('T')[0];
const todayStart = `${todayStr}T00:00:00`;
const now        = new Date().toISOString();

const weekStartDate = new Date();
weekStartDate.setHours(0, 0, 0, 0);
```

한국 시간 00:00~08:59에는 `toISOString()`의 날짜가 전날이다. 이어서 timezone 없는 `T00:00:00`을 로컬 시간으로 해석하므로 “오늘” 집계가 전날 자정부터 시작한다. 일간 미션과 신규 사용자 판단이 최대 24시간 가까이 어긋날 수 있다.

**수정안:** 하나의 KST/local day helper로 자정의 실제 UTC instant를 계산해 ISO로 전달한다. 주간 시작도 같은 timezone 정책을 재사용하고 경계 시각 테스트를 추가한다.

### V-07. `LearnPage`는 모든 조회 실패를 정상적인 빈 상태로 삼고 준비되지 않은 이야기가 준비됐다고 말한다

- 위치: `src/views/LearnPage.jsx:22-23`, `src/views/LearnPage.jsx:56-67`, `src/views/LearnPage.jsx:94-100`, `src/views/LearnPage.jsx:168-176`
- 원문:

```jsx
const countOf = (q) => q.then(({ count }) => count ?? null, () => null);
// ...
.then(({ data }) => (data && data[0]) || null, () => null),
// ...
.then(({ data }) => data || [], () => []),
// ...
const { data, isLoading } = useQuery({
// ...
});
// ...
{episode == null
  ? '이야기 한 편이 준비됐어요'
  : episode >= 10
```

네트워크 reject뿐 아니라 `{ error }` 응답도 성공처럼 소비한다. 결과적으로 오류와 “데이터 없음”을 구분할 수 없고 `episode === null`이면 실제 생성 가능 여부와 무관하게 준비 완료 문구를 노출한다. embedded 모드에서도 같은 오정보가 나타난다.

**수정안:** count/row query의 `{ error }`를 검사하고 React Query의 오류 UI와 재시도를 제공한다. `episode`를 `loading/error/absent/ready` 상태로 분리하고 서버가 준비를 확인한 경우에만 “준비됐어요”를 표시한다.

### V-08. PDF signed URL 조회가 실패하면 영구 로딩 화면만 남는다

- 위치: `src/views/PdfViewerPage.jsx:128-134`, `src/views/PdfViewerPage.jsx:295-297`
- 원문:

```jsx
const { data: pdfInfo, isLoading, error } = useQuery({
  queryKey: ['pdf-info', id], queryFn: () => fetchPdfInfo(id), enabled: !!id,
});
const { data: pdfUrl } = useQuery({
  queryKey: ['pdf-url', pdfInfo?.storage_path], queryFn: () => getPdfUrl(pdfInfo.storage_path),
  enabled: !!pdfInfo?.storage_path, staleTime: 1000 * 60 * 30,
});
// ...
{pdfUrl ? <PdfDocument pdfUrl={pdfUrl} /> : <Spinner message="로딩 중..." />}
```

정보 query의 오류만 받으며 signed URL query의 `isLoading/isError/error`는 버린다. URL 발급이 실패하면 `pdfUrl`은 계속 falsy이고 사용자는 실패 이유나 재시도 없이 spinner만 본다.

**수정안:** URL query의 상태를 별도로 렌더하고 오류 메시지와 `refetch` 버튼을 제공한다. storage path 부재도 로딩이 아닌 명시적인 invalid-data 상태로 구분한다.

### V-09. PDF 분석 Promise가 reject되면 loading 플래그가 영원히 해제되지 않는다

- 위치: `src/views/PdfViewerPage.jsx:156-170`
- 원문:

```jsx
if (ct) { setTokens(markKnown(ct)); } else { setTokens([]); setAnalyzing(true); }
if (cc) { setContextExpl(cc); } else { setContextExpl(''); setContextLoading(true); }

const promises = [];
if (!ct) promises.push(quickAnalyze(t, language).then(r => { /* ... */ setAnalyzing(false); }));
if (!cc) promises.push(getTranslationAndContext(t, language).then(r => { /* ... */ setContextLoading(false); }));
await Promise.allSettled(promises);
```

플래그 해제는 성공 `.then` 안에만 있다. `Promise.allSettled`는 reject를 흡수하지만 개별 `setAnalyzing(false)`/`setContextLoading(false)`를 실행하지 않으므로 버튼과 패널이 영구 로딩 상태가 된다.

**수정안:** 각 요청을 `try/catch/finally`로 감싸 플래그를 반드시 해제하고 오류·재시도 상태를 둔다. 연속 분석의 늦은 응답이 최신 결과를 덮지 않도록 request id 또는 abort도 추가한다.

### V-10. 두 뷰가 `localStorage`를 lazy initializer에서 읽어 SSR 첫 렌더와 hydration 첫 렌더가 달라진다

- 위치: `src/views/PdfViewerPage.jsx:84-87`, `src/views/PdfViewerPage.jsx:107-110`
- 원문:

```jsx
const [language, setLanguage] = useState(() => {
  if (typeof window === 'undefined') return 'Japanese';
  return localStorage.getItem('pdf_language') || 'Japanese';
});
// ...
const [hideKnown, setHideKnown] = useState(() => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('pdf_hideKnown') !== 'false';
});
```

- 위치: `src/views/VocabPage.jsx:46-62`, `src/views/VocabPage.jsx:73-77`
- 원문:

```jsx
const [langFilter, setLangFilter] = useState(() => {
  if (typeof window === 'undefined') return 'all';
  return localStorage.getItem('vocab_langFilter') || 'all';
});
// ...
const [reviewMode, setReviewMode] = useState(() => {
  if (typeof window === 'undefined') return 'auto';
  return localStorage.getItem('as_review_mode') || 'auto';
});
```

Client Component도 서버에서 HTML을 만든다. 서버 initializer는 기본값, 브라우저 첫 initializer는 저장값을 반환하므로 선택 UI와 하위 내용이 첫 hydration부터 다를 수 있다. 이는 이번 LessonsPage 전환에서 피한 바로 그 mismatch 패턴이다.

**수정안:** 서버와 클라이언트 첫 상태를 동일한 상수로 두고 마운트 후 `useEffect`에서 저장값을 복원한다. 복원 전 레이아웃 변동이 문제면 hydrated 플래그 또는 서버 쿠키 값을 사용한다.

### V-11. 자료 목록 query 오류가 “자료 없음” 빈 상태로 표시된다

- 위치: `src/views/MaterialsPage.jsx:94-96`, `src/views/MaterialsPage.jsx:280-289`, `src/views/MaterialsPage.jsx:624-632`
- 원문:

```jsx
const { data, error } = await query;
if (error) throw error;
return data || [];
// ...
const { data: materials = [], isLoading } = useQuery({
  queryKey: ['materials', tab, user?.id, langFilter, levelFilter, searchQuery],
  queryFn: () => fetchMaterials({ tab, userId: user?.id, langFilter, levelFilter, searchQuery }),
  // ...
});
// ...
) : (
  <div className="empty-state">
    // ...
    {tab === 'public'
      ? '아직 공유된 공용 자료가 없습니다...'
```

fetcher는 올바르게 throw하지만 컴포넌트가 `isError/error`를 받지 않는다. 오류 시 기본 `materials = []`가 적용되어 실제 장애가 “첫 번째 자료를 공유하세요” CTA로 바뀐다.

**수정안:** loading 다음에 독립적인 error branch를 두고 오류 요약과 `refetch`를 제공한다. 빈 상태는 성공 응답의 빈 배열에만 사용한다.

### V-12. 문법 복습 완료를 저장 성공 전에 확정해 실패한 SRS 갱신도 성공으로 알린다

- 위치: `src/views/GrammarReviewSession.jsx:119-149`, `src/views/GrammarReviewSession.jsx:214-223`
- 원문:

```jsx
gradeGrammarReview({ ...item.srs, user_id: user.id }, rating).then(updated => {
  if (updated) {
    const d = Math.max(1, Math.round(updated.interval));
    setResults(prev => prev.map((r, i) => (i === idx ? { ...r, nextDays: d } : r)));
  }
});
// ...
setResults(prev => [...prev, { item, right: rightCount, total, rating, nextDays }]);
// ...
챕터 {results.length}개 · 정답 {totalRight}/{totalQ}. 결과에 따라 다음 복습일이 조정됐어요.
```

저장은 await되지 않고 실패 처리도 없다. 사용자는 바로 다음 챕터나 완료 화면으로 이동할 수 있고, 저장이 null/reject여도 “복습일이 조정”됐다는 확정 문구를 본다. 실제 카드는 계속 due 상태일 수 있다.

**수정안:** 현재 챕터에 `saving/error/saved` 상태를 두고 저장 성공 뒤에만 결과를 확정하거나, 오프라인 큐에 기록한 뒤 “동기화 대기”로 표시한다. 실패 시 재시도 경로를 제공하고 완료 문구는 저장 상태에 맞춘다.

### V-13. `ViewerPage` 단어 저장은 Supabase의 `{ error }`를 무시해 실패해도 성공 toast를 띄운다

- 위치: `src/views/ViewerPage.jsx:737-747`, `src/views/ViewerPage.jsx:1562-1573`
- 원문:

```jsx
try {
  await supabase.from('user_vocabulary').upsert({
    user_id: user.id,
    // ...
  }, { onConflict: 'user_id,word_text' });
  toast(`"${t.text}" 저장!`, 'success');
  queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
} catch { toast('저장 실패', 'error'); }
```

Supabase client는 DB/RLS 오류를 대개 reject하지 않고 `{ error }`로 resolve한다. 따라서 `catch`는 실행되지 않고 실패한 저장도 성공 toast와 invalidate를 수행한다. 같은 코드가 드래그 목록과 상세 팝업 두 곳에 중복되어 있다.

**수정안:** `const { error } = await ...; if (error) throw error;`를 적용하고 공통 저장 함수로 합친다. 요청 중 중복 클릭을 막고 확인된 성공 뒤에만 toast와 invalidate를 실행한다.

## 경미

### V-14. 랜딩 트랙은 4개인데 하단 통계는 여전히 2개 언어라고 표시한다

- 위치: `src/views/LandingPage.jsx:8-13`, `src/views/LandingPage.jsx:253-262`
- 원문:

```jsx
const TRACKS = [
  { lang: 'French', /* ... */ },
  { lang: 'Japanese', /* ... */ },
  { lang: 'English', /* ... */ },
  { lang: 'Chinese', /* ... */ },
];
// ...
<span className="stat-pill__num">2개 언어</span>
<span className="stat-pill__label">일본어 · 영어</span>
```

신설 트랙 카드와 같은 페이지의 통계가 모순되어 프랑스어·중국어 제공 사실을 숨긴다.

**수정안:** 숫자와 이름을 4개 트랙에 맞추고 `TRACKS.length` 및 `TRACKS.map(t => t.name)`에서 파생해 재발을 막는다.

### V-15. 자료 카드는 마우스로만 열 수 있는 `div`라 키보드 사용자가 접근할 수 없다

- 위치: `src/views/MaterialsPage.jsx:493-499`
- 원문:

```jsx
<div
  key={m.id}
  className="card card--clickable"
  onClick={() => router.push(`/viewer/${m.id}`)}
  title={previewText || undefined}
>
```

포커스를 받을 수 없고 Enter/Space 동작과 링크 의미도 없다.

**수정안:** 카드 전체를 `Link`로 만들거나 최소한 `role="link"`, `tabIndex={0}`, Enter/Space handler와 명확한 accessible name을 제공한다. 중첩 interactive control이 있으면 이벤트/마크업 충돌을 분리한다.

### V-16. 듣기 복습의 첫 카드와 모드 전환 직후 카드는 자동 재생되지 않는다

- 위치: `src/views/VocabReview.jsx:46-53`
- 원문:

```jsx
const prevIdxRef = useRef(reviewIdx);
useEffect(() => {
  if (mode === 'listening' && ttsSupported && currentWord && prevIdxRef.current !== reviewIdx) {
    speak(currentWord.word_text, currentWord.language || detectLang(currentWord.word_text));
  }
  prevIdxRef.current = reviewIdx;
}, [reviewIdx, mode, ttsSupported, currentWord, speak]);
```

ref가 현재 index로 초기화되므로 첫 카드에서는 조건이 거짓이다. 같은 카드에서 listening 모드로 바꿔도 index가 같아 자동 재생되지 않는다.

**수정안:** `reviewIdx` 변화가 아니라 “현재 listening 카드의 고유 id를 아직 재생하지 않았는가”를 기준으로 1회 재생한다. 모드 진입과 카드 교체 모두를 테스트한다.

## 중점 영역 확인 결과

- **LessonsPage:** `initialLang`의 allowlist와 마운트 후 localStorage 복원 방식은 SSR 계약에 맞았다. `initialLevel`만 같은 수준의 검증이 없어 V-04로 기록했다. embedded `LearnPage` 연결 자체의 prop/data 경계에는 별도 결함이 없었고, 공통 query 실패 은폐는 V-07에 포함했다.
- **LandingPage:** 네 트랙 카드의 링크·내용은 일관됐고, 구 통계 문구 잔존만 V-14로 기록했다.
- **HomePage / StudySessionPage / GrammarReviewSession:** 홈 집계는 V-05·V-06, 문법 복습 저장 확정은 V-12다. `StudySessionPage`의 첫 시도/재출제 분리, 배치 flush, 생성 fallback, cleanup을 끝까지 추적했으며 이번 기준에서 추가 actionable finding은 없었다. world·studies 동결 설계는 변경 대상으로 취급하지 않았다.
- **쿼리 오류·로딩:** V-05, V-07, V-08, V-09, V-11, V-13에 묶었다.
- **라우팅 파라미터:** V-03, V-04를 기록했다.
- **Admin listen 카드 제거 잔재:** `listen|듣기|리스닝`을 확인한 결과 구 listen tab/card/action은 없었다. `AdminPage.jsx:316`의 “어휘·문법·독해·듣기”는 현재 `daily_story` 설명 문구이므로 잔재로 보지 않았다.

## 정독 인벤토리

정독(46):

```text
AdminPage.jsx                         AuthPage.jsx
CourseMapPage.jsx                     CourseMapPage.module.css
GrammarReviewSession.jsx              GuidePage.jsx
HomePage.jsx                          LandingPage.jsx
LearnPage.jsx                         LessonsPage.jsx
MaterialAddPage.jsx                   MaterialAddPdfSection.jsx
MaterialsPage.jsx                     MyPage.jsx
PdfViewerPage.jsx                     ProfileStats.jsx
ReadingTextView.jsx                   ReadingTrackPage.jsx
ReferenceChapterPage.jsx              ReferencePatternIndexPage.jsx
ReferenceVocabPage.jsx                StoryCheck.jsx
StudiesDocPage.jsx                    StudyLibraryPage.jsx
StudyOnboarding.jsx                   StudyPlanPanel.jsx
StudySessionPage.jsx                  ViewerComments.jsx
ViewerGrammarModal.jsx                ViewerPage.jsx
ViewerQuizModal.jsx                   VocabDetailCard.jsx
VocabList.jsx                         VocabPage.jsx
VocabReview.jsx                       VocabStats.jsx
WorldMapPage.jsx                      WorldPage.jsx
WritingStudioPage.jsx                 __tests__/CourseMapPage.test.jsx
__tests__/ReferenceChapterPage.test.jsx
__tests__/VocabPage.test.js
__tests__/referenceChapterPage.smoke.test.js
galmuri9.css                          refShared.jsx
worldChapterRouting.js
```

스캔(0): 없음.

## 검증 증거

- official nvm Node: `v22.23.1`
- targeted views tests: `vitest run src/views/__tests__ --exclude '.claude/worktrees/**'` — **4 files / 21 tests PASS**
- full Vitest: `vitest run --exclude '.claude/worktrees/**'` — **265 files / 2,532 tests PASS** (77.75s)
- `git diff --check`: PASS
- 보고서 SHA-256 A/B: PASS — 최종 digest는 PR 본문과 `CODEX_DONE`에 기록
- 메모리(`/usr/bin/time -l`): targeted max RSS **445,431,808 B**, full max RSS **2,992,832,512 B**, 양쪽 모두 swaps **0**
