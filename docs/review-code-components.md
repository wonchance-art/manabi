# `src/components` 전체 코드 리뷰 R1

- 세션: Codex-1
- assignment: `5192929323`
- 고정 기준 트리: `8e7e41778f338c0ed8a5d6744dedd011fb409a74`
- 리뷰 범위: `src/components` production JS/JSX **158파일 / 39,818줄**
- 테스트 문맥 스캔: `src/components` 테스트·snapshot **128파일 / 24,384줄**
- 산출물 성격: **report-only**. 제품·콘텐츠·world 코드는 수정하지 않았다.

## 방법과 판정 기준

production 158파일을 정독한 뒤 다음 경계 검색을 다시 겹쳐 확인했다.

1. 렌더 중 `window`/`localStorage`/Web Speech 접근과 lazy initializer
2. `useEffect`의 listener, timer, observer, async continuation 정리
3. prop/key 전환 중 이전 state·Promise 결과가 다음 문맥으로 흘러가는지
4. Supabase mutation의 `{ error }` 확인 및 사용자 성공/실패 표시
5. dialog/listbox/button의 HTML 유효성, 키보드·포커스·ARIA
6. 렌더마다 새 component type 또는 불필요한 remount를 만드는지

심각도는 다음처럼 사용했다.

- `critical`: 보안 경계 우회 또는 광범위하고 즉각적인 비가역 손실
- `major`: 핵심 학습·저장 흐름의 오기록/손실, hydration 실패, 문맥 간 데이터 오염
- `minor`: 한정된 수명주기 누수, 접근성·성능 저하, 복구 가능한 UX 결함

이번 고정 트리에서는 `critical`은 확인되지 않았다. 아래는 **major 10건, minor 3건**이다.

## 핵심 4파일 결론

| 파일 | 판정 | 요약 |
|---|---|---|
| `ChapterDrills.jsx` | major 2건 | 서버 정본과 기기 통계가 섞이고, 비동기 기록 실패를 복구할 수 없음 |
| `WritingPractice.jsx` | major 1건 | SSR/client 초기값 불일치와 챕터 전환 state 오염 |
| `RefSpeak.jsx` | major 1건 | `supported`가 Web Speech 가용성이 아니라 단순 client 여부 |
| `LearnProgressWidget.jsx` | 이상 없음 | SSR-stable `ready:false`, mount 후 읽기, 세 listener 모두 cleanup 확인 |

`LearnProgressWidget.jsx:108-133`의 초기 snapshot은 브라우저 저장소와 무관하며, effect가 등록한 `focus`/`storage`/학습 이벤트 세 개를 정확히 해제한다. 이 중점 파일에는 별도 수정 제안이 없다.

## Findings

### C-01 · major · WritingPractice가 저장값으로 첫 client render를 바꿔 hydration과 챕터 전환을 깨뜨린다

위치: `src/components/WritingPractice.jsx:17-31`

원문:

```jsx
const [draft, setDraft] = useState(() => {
  try {
    return globalThis.localStorage?.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
});
// ...
const [checks, setChecks] = useState(() => {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(checksKey) ?? 'null');
    if (Array.isArray(saved) && saved.length === writing.checklist.length) return saved;
  } catch {}
  return writing.checklist.map(() => false);
});
```

서버는 `localStorage`가 없어 빈 글/미체크 HTML을 만들지만 hydration 시 client lazy initializer는 저장 글과 체크값을 즉시 사용한다. textarea 값, 단어 수, checkbox 상태가 서버 HTML과 달라진다. 또한 `lang`/`slug`가 바뀌어도 `useState` initializer는 다시 실행되지 않아 동일 component instance에서 이전 챕터 글과 체크가 남는다.

수정안:

- SSR-stable 빈/default state로 시작하고 mount effect에서 현재 `storageKey`를 복원한다.
- `restoredKey` 또는 `ready` gate를 두어 복원 전에 빈 state가 저장값을 덮지 않게 한다.
- `lang`/`slug`/checklist 변경 시 draft, checks, `showSamples`를 현재 key 기준으로 함께 재설정한다.
- 회귀: 저장값이 있는 SSR hydrate, `slug A → B`, checklist 길이 변경을 각각 검증한다.

### C-02 · major · ChapterDrills의 서버 정본과 기기 통계가 첫 렌더와 실패 경로에서 섞인다

위치: `src/components/ChapterDrills.jsx:164-185`

원문:

```jsx
const [pastStat, setPastStat] = useState(() => readChapterStat(lang, drills));
// ...
useEffect(() => {
  if (!user?.id || !Array.isArray(drills) || drills.length === 0) return undefined;
  let alive = true;
  supabase
    .from('review_events')
    // ...
    .then(({ data }) => {
      if (!alive || !Array.isArray(data) || data.length === 0) return;
      setPastStat({ tries: data.length, right: data.filter((r) => r.correct).length });
    }, () => {});
  return () => { alive = false; };
}, [user?.id, drills]);
```

`readChapterStat`는 `localStorage`를 읽으므로 C-01과 같은 hydration 불일치가 생긴다. 더 중요한 정합성 문제는 로그인 사용자도 먼저 기기 통계를 보며, 서버 조회가 실패하거나 서버 결과가 0건이면 기기 값이 그대로 서버 정본처럼 남는다는 점이다.

수정안:

- `pastStat`을 `null`/loading의 SSR-stable 상태로 시작한다.
- 게스트만 mount 후 기기 통계를 복원한다.
- 로그인 사용자는 서버 결과 0건도 명시적으로 `null`로 확정하고, 오류는 별도 retry/error 상태로 둔다.
- `lang`/drill id 집합 변경 때 이전 통계를 즉시 비운다.

### C-03 · major · ChapterDrills가 로그인 사용자에게도 로컬 통계를 쓰고, 기록 실패 후 재시도를 영구 차단한다

위치: `src/components/ChapterDrills.jsx:187-194`

원문:

```jsx
// 기록 정본은 drillSrs 단일 경로(review_events + FSRS 행) — 게스트 통계 카운터만 별도 유지.
const record = (drill) => (ok) => {
  if (settled.current.has(drill.id)) return;
  settled.current.add(drill.id);
  bumpDrillStat(lang, drill.id, ok);
  setResults((r) => ({ ...r, [drill.id]: ok }));
  void recordChapterDrillResult(user?.id, { lang, drill, correct: ok });
};
```

주석의 계약과 달리 `bumpDrillStat`은 로그인 사용자에게도 실행된다. 이어서 `settled`를 비동기 저장 전에 확정하고 Promise를 버리므로 review_events/FSRS 저장이 실패해도 UI는 정답 처리되고 같은 드릴은 다시 기록할 수 없다. prop으로 다른 챕터가 들어와도 `settled`와 `results`가 초기화되지 않는다.

수정안:

- `bumpDrillStat`은 `!user?.id`일 때만 호출한다.
- 드릴별 `saving/saved/error` 상태를 두고 canonical `recordChapterDrillResult`를 await한다.
- 실패하면 `settled`를 rollback하고 retry UI를 제공한다. 중복 방지는 서버 idempotency key와 요청 중 잠금으로 맡긴다.
- drill id 집합이 바뀌면 `settled`/`results`를 reset한다.

### C-04 · major · RefSpeak의 가용성 분기가 Web Speech 정본 계약을 검사하지 않는다

위치: `src/components/RefSpeak.jsx:11-20`, supporting dependency `src/lib/useTTS.js:107-121`

원문:

```jsx
const { speak, supported } = useTTS();
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted || !supported || !text) return null;
```

```js
const speak = useCallback((text, language = 'Japanese', opts = {}) => {
  if (typeof window === 'undefined' || !text) return;
  playServerTTS(text, language).catch(() => speakFallback(text, language, opts));
}, [speakFallback]);
// ...
const supported = typeof window !== 'undefined';
```

RefSpeak 자체는 mount gate로 hydration을 피하지만, `supported`는 Web Speech 지원 여부가 아니라 client 여부다. Web Speech가 없는 브라우저에서도 버튼이 노출되고, 서버 TTS 실패 뒤 fallback은 소리 없이 끝난다. 이는 #150에 고정된 “Web Speech TTS 정본”과도 반대 방향이다.

수정안:

- canonical capability를 `window.speechSynthesis`와 `SpeechSynthesisUtterance` 존재로 계산한다.
- Web Speech를 기본 경로로 하고 서버 음성을 유지해야 한다면 별도 capability/정책 이름으로 분리한다.
- 재생 실패를 button의 disabled/error/`aria-live` 상태로 알리고, 지원하지 않으면 버튼을 숨긴다.

### C-05 · major · ConversationPanel이 material 전환 시 이전 대화를 새 key에 덮어쓰고 늦은 응답도 새 대화에 섞는다

위치: `src/components/ConversationPanel.jsx:49-62`, `82-90`, `122-136`

원문:

```jsx
useEffect(() => {
  if (!materialId) return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY + materialId);
    if (saved) setMessages(JSON.parse(saved));
  } catch {}
}, [materialId]);

useEffect(() => {
  if (!materialId) return;
  try {
    if (messages.length > 0) localStorage.setItem(STORAGE_KEY + materialId, JSON.stringify(messages));
  } catch {}
}, [messages, materialId]);
```

material A의 messages를 가진 채 B로 전환하면, 같은 commit의 복원 effect가 B 저장값을 state에 예약한 뒤 저장 effect는 아직 A messages를 B key에 기록한다. B에 저장값이 없으면 A 대화가 화면에도 그대로 남는다. `callGemini` 요청도 AbortController/request id가 없어 A에서 시작한 응답이 B 전환 뒤 현재 messages에 append될 수 있다.

같은 파일의 `src/components/ConversationPanel.jsx:22-41`도 첫 렌더에서 `window`로 STT 버튼 유무를 결정하고, 생성한 recognition을 unmount/material change에서 abort하거나 handler 해제하지 않는다.

수정안:

- materialId별 restore gate를 두고 전환 즉시 messages/input/loading을 비운다.
- `restoredKey === materialId`일 때만 저장한다.
- Gemini 요청에 AbortController 또는 monotonically increasing request id를 붙여 stale 결과를 버린다.
- STT 지원 상태는 mount 후 설정하고 cleanup에서 `abort()`/handler null/reset을 수행한다.

### C-06 · major · ReadingTest가 자료 전환 중 이전 문제·답·비동기 생성 결과를 다른 material에 저장한다

위치: `src/components/ReadingTest.jsx:44-65`, `122-130`

원문:

```jsx
useEffect(() => {
  const saved = loadSaved(materialId);
  if (saved) {
    setQuestions(saved.questions);
    setAnswers(saved.answers || {});
    // ...
  } else if (inline) {
    generateTest();
  }
}, [materialId]);

useEffect(() => {
  if (questions.length > 0 && materialId) {
    saveToDisk(materialId, { questions, answers, result });
  }
}, [answers, result]);
```

새 material에 저장값이 없을 때 이전 questions/answers/result가 reset되지 않는다. 저장 effect는 `questions`와 `materialId`가 dependency에서 빠져 자료 전환과 문제 생성 시점을 정확히 추적하지 못한다. 더 늦게 끝난 A의 `generateTest`는 현재 B state와 B key에 결과를 쓸 수 있다.

추가로 `src/components/ReadingTest.jsx:172-174`는 overlay 모드에서 렌더마다 새 component type을 만든다.

```jsx
const Wrapper = inline ? 'div' : ({ children }) => (
  <div className="reading-test-overlay" onClick={onClose}>{children}</div>
);
```

state update마다 subtree가 remount되어 focus/입력 문맥을 잃고 불필요한 렌더 비용을 만든다.

수정안:

- C-05와 같은 key-scoped restore/persist gate와 request-id/abort를 적용한다.
- 저장 effect dependency를 `questions, answers, result, materialId, restoredKey`로 완결한다.
- wrapper는 JSX 분기 또는 파일 밖의 안정된 component로 렌더한다.

### C-07 · major · TtsVoicePicker가 `<button>` 안에 `<button>`을 렌더한다

위치: `src/components/TtsVoicePicker.jsx:88-107`

원문:

```jsx
<li key={v.voiceURI}>
  <button
    type="button"
    onClick={() => pick(v.voiceURI)}
    className={`tts-voice__option ${isSel ? 'is-selected' : ''}`}
    role="option"
    aria-selected={isSel}
  >
    <span className="tts-voice__option-name">{/* ... */}</span>
    <button
      type="button"
      className="tts-voice__play"
      onClick={(e) => preview(v.voiceURI, e)}
      aria-label={`${v.name} 미리듣기`}
    >▷</button>
  </button>
</li>
```

interactive content 중첩은 유효하지 않은 HTML이다. 브라우저가 DOM을 재구성해 React가 기대한 tree와 달라질 수 있고, 키보드 focus/Enter/Space 동작과 option 선택·미리듣기 event 경계도 불명확하다.

수정안:

- row container 아래 “선택” button과 “미리듣기” button을 형제로 둔다.
- 또는 listbox active-descendant 패턴을 완결하고 preview는 listbox 밖의 별도 control로 둔다.
- trigger에 `aria-haspopup="listbox"`, `aria-controls`, Escape/화살표 이동과 focus return을 추가한다.

### C-08 · major · QuestReview가 Supabase update 실패를 성공 채점으로 확정한다

위치: `src/components/world/QuestReview.jsx:130-160`

원문:

```jsx
supabase
  .from('user_vocabulary')
  .update({ ...nextStats, last_reviewed_at: new Date().toISOString() })
  .eq('id', current.id)
  .then(() => {}, () => {});
// ...
bus.emit('quest:scored', { correct });
// ...
setPhase('done');
bus.emit('quest:done', { right: nextRight, total: items.length });
```

supabase-js의 RLS/constraint 오류는 일반적으로 Promise rejection이 아니라 `{ error }`로 반환된다. 현재 코드는 결과 객체를 확인하지 않고 다음 카드/완료로 진행하므로 사용자는 성공 연출을 보지만 FSRS 값은 저장되지 않는다. #845에서 views에 적용한 false-success 수리와 같은 종류지만, 이 component는 남아 있다.

수정안:

- `{ error }`를 await하고 오류면 throw/명시 실패 처리한다.
- 저장 성공 전에는 idx/점수/quest 완료를 확정하지 않는다.
- 오류 시 `gradingRef`를 풀고 같은 카드 retry UI를 제공한다.
- review event도 같은 idempotency 경계 안에서 성공/실패를 추적한다.

### C-09 · major · AccountSettings 데이터 내보내기가 부분 실패를 완전한 성공으로 알린다

위치: `src/components/AccountSettings.jsx:56-88`

원문:

```jsx
const [
  { data: profile },
  { data: vocab },
  { data: materials },
  { data: progress },
  { data: notes },
  { data: writings },
  { data: pdfs },
] = await Promise.all([
  // seven Supabase queries
]);
// ...
toast('내 데이터를 JSON으로 내보냈어요', 'success');
```

일곱 응답의 `{ error }`를 모두 버린다. RLS/네트워크/테이블 오류 하나가 생겨도 null/빈 section을 담은 파일을 내려받고 “내 데이터” 전체 성공 toast를 표시한다. 개인정보 이동/백업 기능에서 조용한 누락은 데이터 손실로 이어진다.

수정안:

- 각 결과의 error를 검사하고 하나라도 실패하면 다운로드하지 않는다.
- 부분 내보내기를 허용하려면 누락 section과 오류를 manifest에 명시하고 사용자 확인 후 진행한다.
- 성공 toast는 요청한 section이 모두 완전한 경우에만 표시한다.

### C-10 · major · LessonCompletionCta의 읽기·쓰기 실패가 영구 loading 또는 처리되지 않은 rejection이 된다

위치: `src/components/LessonCompletionCta.jsx:73-103`

원문:

```jsx
getLessonProgress(user?.id, {
  lang: lessonRef.lang,
  slugs: [lessonRef.slug],
}).then((result) => {
  if (!active) return;
  setCompleted(result.completedSlugs.includes(lessonRef.slug));
  setLoading(false);
});
// ...
try {
  await recordLessonCompleted(user?.id, lessonRef);
  setCompleted(true);
} finally {
  pendingRef.current = false;
  setSaving(false);
}
```

읽기 Promise가 reject하면 `setLoading(false)`가 실행되지 않아 CTA가 영구 disabled다. 완료 저장은 `finally`만 있어 rejection을 사용자에게 설명하거나 retry 상태로 보존하지 않고 click handler의 처리되지 않은 rejection이 된다.

수정안:

- 읽기는 active guard가 있는 `try/catch/finally`와 error/retry 상태를 사용한다.
- 쓰기는 catch에서 실패 메시지를 표시하고 `completed`를 바꾸지 않는다.
- 실패 후 pending lock이 풀리고 동일 CTA로 재시도 가능한지 테스트한다.

### C-11 · minor · ListenControls는 첫 렌더 feature detection과 재생 callback에 stale 상태를 남긴다

위치: `src/components/ListenControls.jsx:13-24`, `30-47`

원문:

```jsx
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
// ...
if (!supported || !text) return null;
```

```jsx
utter.lang = language === 'Japanese' ? 'ja-JP' : 'en-US';
utter.rate = rate;
utter.onend = () => {
  indexRef.current += 1;
  if (indexRef.current < sentences.length) speakNext();
  else stop();
};
```

서버는 null, hydration의 client 첫 render는 button을 만들 수 있다. 재생 중 `text`가 바뀌어도 기존 utterance를 취소하지 않고, `onend`는 생성 당시의 `language`/`rate`/함수를 이어 사용한다.

수정안:

- support를 mount 후 state 또는 SSR-safe external-store로 계산한다.
- `text`/`language` 변경 시 cancel/reset하고, 재생 session id로 옛 callback을 무시한다.
- rate 변경을 다음 문장부터 적용하려면 ref로 최신 값을 읽거나 재생을 명시적으로 재시작한다.

### C-12 · minor · NpcDialog 오미쿠지 interval이 dialog 종료 뒤에도 state와 quest bus를 갱신한다

위치: `src/components/world/NpcDialog.jsx:88-104`

원문:

```jsx
const spin = setInterval(() => {
  n += 1;
  setRollFace(faces[Math.floor(Math.random() * faces.length)]);
  if (n >= 12) {
    clearInterval(spin);
    const result = drawOmikuji();
    setOmikuji(result);
    setOmikujiRolling(false);
    bus.emit('quest:scored', { correct: true });
  }
}, 75);
```

handle이 지역 변수라 unmount, NPC/step 전환, 종료에서 취소할 수 없다. 0.9초 안에 dialog를 닫으면 닫힌 대화의 state update와 점수 event가 나중에 발생한다.

수정안:

- interval handle을 ref에 보관하고 unmount/step/npc/exit에서 clear한다.
- 완료 callback은 현재 dialog session id가 일치할 때만 state와 bus를 갱신한다.

### C-13 · minor · 일부 custom modal은 dialog semantics와 focus lifecycle이 없다

위치: `src/components/ReportMaterialButton.jsx:65-67`, `src/components/AccountSettings.jsx:190-208`

원문:

```jsx
{open && (
  <div className="modal-overlay" onClick={() => !submitting && setOpen(false)}>
    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
```

```jsx
{deleteConfirm && (
  <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirm(false)}>
    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
      <h3>계정 삭제</h3>
      {/* ... */}
      <input autoFocus />
```

`ConfirmModal`에는 dialog/aria-modal/Escape/focus trap이 있지만 이 두 구현은 같은 동작을 자체 재구현하면서 semantics, Escape, focus trap, 닫힌 뒤 trigger focus 복원을 빠뜨렸다. 계정 삭제처럼 위험한 동작에서 screen reader와 키보드 사용자가 배경 control로 빠질 수 있다.

수정안:

- 공용 accessible dialog primitive로 통합한다.
- `role="dialog"`, `aria-modal`, labelledby/describedby, initial focus, Tab trap, Escape, trigger focus return을 계약 테스트로 고정한다.
- overlay click은 pointer에만 맡기고 keyboard close path를 명시한다.

## 중복 억제 및 비지적 항목

다음은 발주에서 이미 수리됐다고 명시되어 이번 findings에서 제외했다.

- `formatDetail` / `inlineFormat` XSS: #835, #838
- `AdminPage` hook order: #838
- `LessonsPage` level fallback: #838

또한 `LearnProgressWidget`, `InstallPrompt`, `RefReadMark`, `KanaStroke`, `Layout`의 등록 listener/observer/timer는 해당 effect cleanup을 확인했다. `GameCanvas`의 장수명 canvas loop는 session ref와 cleanup 묶음을 별도로 갖고 있어 이번 보고서에서 추측성 지적을 만들지 않았다.

## 권장 수리 순서

1. **정본·손실:** C-03, C-08, C-09, C-10
2. **문맥 간 오염:** C-05, C-06
3. **SSR/TTS:** C-01, C-02, C-04, C-11
4. **HTML/a11y/lifecycle:** C-07, C-12, C-13

제품 수정은 한 PR에 몰지 말고 다음 세 묶음으로 분리하는 편이 안전하다.

- 학습 핵심: C-01~C-04, C-10
- 자료 학습 도구: C-05~C-07, C-11
- 계정/world/a11y: C-08, C-09, C-12, C-13

각 묶음은 fixed failing regression을 먼저 만들고, targeted test 후 전체 test를 실행한다. 특히 storage key 전환 테스트는 Promise를 수동 지연시켜 A 응답이 B 전환 뒤 도착하는 순서를 반드시 포함해야 한다.

## 기준 트리 검증

Node `v22.23.1` 공식 nvm 환경에서 실행했다. 이 PR은 report-only라 제품 동작을 바꾸지 않지만, findings가 추측성 parse 오류나 이미 깨진 기준 트리에 기대지 않도록 기존 회귀를 확인했다.

| 검증 | 결과 | 메모리 |
|---|---|---|
| targeted `LearnProgressWidget` + `LessonCompletionCta` | 2파일 / 6테스트 PASS | max RSS 120,930,304 B, swap 0 |
| 전체 `npm test` | 265파일 / 2,532테스트 PASS, 83.85s | max RSS 3,159,572,480 B, swap 0 |
| `npm run lint` | error 0, 기존 warning 2 | max RSS 690,782,208 B, swap 0 |
| `git diff --check` | PASS | - |

격리 worktree의 최초 targeted preflight는 의존성이 설치되지 않아 `react` package resolution 단계에서 수집 0건으로 종료됐다. lockfile 기준 `npm ci --ignore-scripts`로 환경을 준비한 뒤 위 targeted와 전체 명령을 새로 실행했으며 둘 다 green이다. 최초 환경 실패를 제품 테스트 실패로 세지 않았다.
