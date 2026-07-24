# 연습 엔진 현황 감사와 F4-3 선행 프로토

**작성일**: 2026-07-24

**기준 커밋**: `23511cf257032aec2d6cb9f690ca4bb097996e58` (`main`, #553 merge)

**범위**: 문법 챕터 패턴 체크·`story`, 문법 SRS, 어휘 복습, `StudySessionPage`,
E3 `src/content/french/exercises_draft.js`, F2 `progressStore`

## 결론

- 현행은 하나의 연습 엔진이 아니라 **서로 다른 5개 채점 경로**다. 패턴 체크와 문법
  복습은 비슷한 UI를 별도 구현하고, `story`는 로컬 확인, 어휘 단어장은 FSRS 자기평가,
  오늘 학습은 자체 `settle()` 상태머신을 사용한다.
- E3 초안 22팩·66문항은 모두
  `{ type: "short-answer", promptKo, answer }`다. 어떤 현행 소비자도 이 모듈을 import하지
  않으며 `short-answer`를 렌더하지도 않는다. **그대로 꽂을 수 없다.**
- 기존 페이지를 수정하거나 배선하지 않고
  `src/components/ExerciseEnginePrototype.jsx`를 추가했다. E3 단답은 `fill`로 정규화하고
  공통 `fill`·`choice/select` 채점, fail-closed 스키마 검사, 기존 `fr-*` 디자인 클래스,
  `onAnswer`·`onComplete` 연결 경계만 제공한다.
- F2 `recordReviewCompleted`의 실제 연결점은 프로토의 `onAnswer`다. 다만 어휘 FSRS에는
  실제 `user_vocabulary.id`와 계산된 `nextStats`가 필요하고, 문법 FSRS 재스케줄은 현재
  `progressStore`가 하지 않으므로 배선 단계의 어댑터가 별도로 책임져야 한다.

## 1. 현재 콘텐츠의 문항 재고

`REF_LANGS`의 정규 챕터를 전수 순회해 `buildChapterQuiz()` 결과를 합산했다. 인트로
레벨과 카나 전용 챕터는 `ReferenceChapterPage`의 실제 분기처럼 제외했다.

| 언어 | 실제 패턴 체크 대상 챕터 | `meaning` | `apply` | `produce` | 합계 | 빈 퀴즈 챕터 |
|---|---:|---:|---:|---:|---:|---:|
| 영어 | 48 | 184 | 181 | 144 | 509 | 0 |
| 프랑스어 | 55 | 188 | 203 | 165 | 556 | 0 |
| 일본어 | 90 | 290 | 44 | 270 | 604 | 0 |
| 중국어 | 64 | 219 | 251 | 192 | 662 | 0 |
| **합계** | **257** | **881** | **679** | **771** | **2,331** | **0** |

명시적 `chapter.questions` 배열은 4트랙 전체 277챕터에서 0건이다. 챕터 끝 문항은
콘텐츠의 `sections[].pattern`·`examples[]`를 `src/lib/refQuiz.js`가 자동 변환한다.

명시적 `sections[].story`는 일본어 문법에만 있다.

| story 재고 | 수량 |
|---|---:|
| story 섹션 | 18 |
| 전체 문항 | 40 |
| `order` | 11 |
| `fill` | 14 |
| `produce` | 15 |

## 2. 현행 소비·채점·SRS 경로

| 입력 형식 | 실제 소비자 | 채점 규칙 | 기록·진도 | SRS |
|---|---|---|---|---|
| 챕터 `sections[].pattern/examples[]` → `buildChapterQuiz()`의 `meaning/apply/produce` | `ReferenceChapterPage` → `RefPatternCheck` | `meaning/choose` 문자열 exact, `order` 공백 결합 exact, `produce` 자기채점. 전 문항 완료 후 80% 이상 통과 | `${readKey}_check` localStorage, 로그인 시 `syncCheckRemote`; 문항별 `logReviewEvents` | 통과 시 `enqueueGrammarReview`로 `grammar_review` 등록 |
| `sections[].story = { body, questions }`, 문항 `order/fill/produce` | `StoryCheck` | `order` 배열 exact, `fill` NFKC 후 공백 제거 + `accept[]`, `produce` 모범답 공개만 | 없음. UI도 “기록은 남기지 않아요”로 고지 | 없음 |
| due `grammar_review` 행 + `buildReviewQuiz()`의 축소 `meaning/apply/produce` | `/review/grammar` → `GrammarReviewSession` | 챕터별 정답률을 rating 1~4로 변환: `<50%`, `50~<75%`, `75~<100%`, `100%` | 문항별 `logReviewEvents`, 활동 기록 | `gradeGrammarReview`가 FSRS 계산 후 `grammar_review` 갱신 |
| `user_vocabulary` 행; `flash/context/typing/listening` | `VocabPage` → `VocabReview` | 최종 rating 1~4는 사용자 선택. context 정답은 자동 rating 3, 오답은 rating 1 선택. typing도 문자열 자동 판정 없이 답 공개 뒤 자기평가 | F2 `recordReviewCompleted`가 `review_events`와 활동 기록 | 호출부가 FSRS를 계산해 `nextStats` 전달, `progressStore`가 `user_vocabulary` 갱신 |
| `composeSession()` item: `vocab-choice/cloze/typing/listening`, `grammar-cloze/order`, `read-meaning` | `StudySessionPage` | 선택은 문자열 exact, 어순은 공백 결합 exact, 어휘 입력은 소문자·공백·일부 구두점 제거 후 표기 또는 발음 exact | 첫 시도만 `recordSettle`; 오답은 세션 끝 1회 재출제하되 재출제는 집계·SRS 제외. `review_events`는 4개 단위 마이크로배치 | 어휘는 `calculateFSRS` 후 **직접** `user_vocabulary` 갱신, due 문법은 챕터 마지막 문항에서 `gradeGrammarReview` |
| AI 문단 `questions`: `cloze/vocab/comprehension` + 문장 tokens | `mapParagraphToItems()` → `StudySessionPage` | 위 item 형식으로 변환한 뒤 동일 `settle()` 사용. 검증기는 문단 실재 여부와 오답 수를 먼저 fail-closed 검사 | 새 문법·읽기·어휘 이벤트로 분기 | due 어휘/문법일 때만 해당 SRS에 연결 |
| `produce-writing` | `StudySessionPage` | `/api/writing-feedback`의 `targetScore >= 2`를 정답으로 간주 | `writing` 이벤트와 실제 포함 어휘의 `vocab/produce` 이벤트 | FSRS·챕터 통과에는 미반영 |

### 경로별 중요한 차이

1. `RefPatternCheck`는 `buildChapterQuiz()`가 생성한 `quiz`만 받는다. 챕터나 외부 팩의
   `questions` 필드를 읽지 않는다.
2. `StoryCheck`의 `fill`은 정확히 한 개의 `［　］` 마커와 `answer` 문자열을 요구한다.
   E3의 자유로운 한국어 프롬프트는 이 계약이 아니다.
3. `VocabPage`는 콘텐츠 어휘 팩을 직접 퀴즈로 쓰지 않고 사용자의
   `user_vocabulary` 행만 복습한다.
4. `StudySessionPage`는 `uid`, 렌더용 `word` 또는 `quiz`, 부작용을 가리키는 `effect`가
   조립된 세션 item을 요구한다. 알 수 없는 `short-answer` 분기는 렌더도 이벤트 매핑도 없다.
5. F2 이후에도 문항별 경로가 완전히 단일화된 것은 아니다. `recordReviewCompleted`의 제품
   소비자는 현재 `VocabPage`뿐이며, `StudySessionPage`는 세션 완료와 신규 단어만
   `recordLessonCompleted`·`recordNewWord`로 보낸다.

## 3. E3 직접 호환 판정

E3의 고정 구조:

```js
{
  sourcePath,
  kind: "grammar" | "vocab",
  level,
  status: "DRAFT_UNWIRED",
  questions: [
    { id, type: "short-answer", sourceRef, promptKo, answer },
  ],
}
```

| 대상 소비자 | 판정 | 막히는 필드·계약 |
|---|---|---|
| `RefPatternCheck` | 불가 | 최상위 `meaning/apply/produce` 배열 필요. `short-answer` 분기 없음 |
| `StoryCheck` | 불가 | `story.body`와 `order/fill/produce`별 필드 필요. fill은 `ja` 안의 `［　］` exact 마커 필요 |
| `GrammarReviewSession` | 불가 | `srs`, 언어 메타, 축소 `quiz` 필요 |
| `VocabReview` | 불가 | DB 단어 행 `id/word_text/meaning/FSRS 상태`와 복습 큐 필요 |
| `StudySessionPage` | 불가 | `uid/type/word|quiz/effect` item 필요. `qtypeForItem("short-answer")`는 `null` |
| `ExerciseEnginePrototype` | 가능(미배선) | `short-answer`를 `fill`, `promptKo`를 `prompt`로 명시 정규화 |

따라서 E3 파일 자체를 바꾸거나 기존 페이지에 import하는 대신, 프로토타입에서 변환 경계를
검증했다. 이 프로토는 제품 소비자가 아니며 현재 런타임·DB·진도에 영향이 없다.

## 4. 공통 프로토 계약

프로토가 받는 최소 공통형은 다음 두 종류다.

```js
// 직접 입력
{ id, type: "fill", prompt, answer, accept?, sourceRef? }

// 선택
{ id, type: "choice", prompt, answer|correct, options|choices|distractors, sourceRef? }
```

호환 별칭은 E3 `short-answer` → `fill`, `select` → `choice`다. 선택 문항은 `id` 시드로
결정적으로 섞는다. 스키마가 불완전하거나 지원하지 않는 유형은 렌더하지 않는
fail-closed 방식이다.

채점 정규화는 Unicode NFC, 대소문자, 연속 공백만 통일한다. 프랑스어 악상 기호와
문장부호는 보존한다. `école`과 `ecole`을 같은 답으로 볼지 같은 콘텐츠 정책은
`accept[]`로 명시해야 하며 E3 검수 전에 엔진이 임의 결정하지 않는다.

## 5. `progressStore.recordReviewCompleted` 연결 지점

제품 배선 시 프로토의 `onAnswer(result)`에서 문항당 한 번 호출한다.

```jsx
<ExerciseEnginePrototype
  questions={pack.questions}
  onAnswer={(result) => {
    recordReviewCompleted(user.id, {
      type: pack.kind,
      itemKey: resolvedItemKey,
      lang: "French",
      correct: result.correct,
      detail: {
        qid: result.id,
        sourceRef: result.sourceRef,
        qtype: result.qtype,
        answer: result.answer,
        picked: result.response,
      },
    }, nextStats);
  }}
/>
```

배선 전 해결해야 할 값:

- 문법: 현행 분석 축과 맞추려면 `resolvedItemKey`는 `sourceRef`의 챕터 slug다.
  `detail.qid`에 E3 문항 ID를 둔다. `recordReviewCompleted(type="grammar")` 자체는
  `grammar_review`를 재스케줄하지 않으므로 챕터 단위 집계와 `gradeGrammarReview` 연결이
  여전히 필요하다.
- 어휘: rung 유도는 `review_events.source === "vocab"`이면서
  `item_key === word_text`인 이벤트만 본다. `sourceRef` 문자열을 추측 파싱하지 말고
  원본 어휘에서 실제 `word_text`와 로그인 사용자의 `user_vocabulary.id`를 resolve해야 한다.
- 어휘 FSRS: `detail.word_id`와 `nextStats.next_review_at`가 함께 있어야
  `progressStore`가 `user_vocabulary`를 갱신한다. FSRS 계산은 현재 호출부 책임이다.
- 게스트: 현행 `recordReviewCompleted(undefined, ...)`의 로컬 경로는 실질적으로 no-op이다.
  게스트 결과를 보존하려면 별도 승인된 저장 계약이 필요하다.

이 연결은 이번 선행 프로토에서 의도적으로 실행하지 않았다. E3는 여전히
`DRAFT_UNWIRED`이고 기존 페이지·레지스트리·DB는 수정하지 않았다.

## 6. #555 후속 — `StudySessionPage` 연결

`StudySessionPage`의 문법 챕터 문항(`grammar-cloze`·`grammar-order`)은
`ExerciseEnginePrototype`의 제어형 `studyItem` 경로로 연결했다. 기존 페이지가 유지하던
문항별 진행·즉시 피드백·오답 1회 재출제·첫 시도 집계 계약은 바꾸지 않고, 공통 컴포넌트가
문항 정규화와 exact 채점을 담당한다.

첫 시도 완료 시 `src/lib/studyExerciseBridge.js`가 문항 효과를 F2
`progressStore.recordReviewCompleted` 계약으로 바꾼다. 문법 due의 챕터 단위
`gradeGrammarReview`, 신규 챕터의 세션 종료 통과 판정, 어휘 FSRS rating
(정답 3·오답 1)은 기존대로 유지한다. 로그인하지 않은 호출도 같은 경계를 거쳐
`progressStore`의 게스트 폴백으로 종료하며 원격 저장을 시도하지 않는다.
