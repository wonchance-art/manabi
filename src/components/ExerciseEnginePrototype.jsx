'use client';

import { useMemo, useState } from 'react';

const FILL_TYPES = new Set(['fill', 'short-answer']);
const CHOICE_TYPES = new Set(['choice', 'select']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * 프로토타입 정답 정규화.
 *
 * 표기 정책을 과도하게 확정하지 않도록 Unicode NFC·대소문자·연속 공백만 통일한다.
 * 악상 기호와 문장부호는 보존하며, 허용 답안은 콘텐츠의 accept[]로 명시한다.
 */
export function normalizeExerciseAnswer(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, ' ');
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const text = nonEmptyString(value);
    const key = normalizeExerciseAnswer(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function seededShuffle(values, seedText) {
  const out = values.slice();
  let seed = 2166136261 >>> 0;
  for (const char of String(seedText)) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  const random = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 서로 다른 현행 초안/퀴즈 필드를 프로토타입 공통 형태로 정규화한다.
 * 스키마가 불완전한 문항은 null로 fail-closed 한다.
 */
export function normalizeExerciseQuestion(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const rawType = String(raw.type || '').toLowerCase();
  const type = FILL_TYPES.has(rawType)
    ? 'fill'
    : CHOICE_TYPES.has(rawType)
      ? 'choice'
      : null;
  if (!type) return null;

  const id = nonEmptyString(raw.id) || `exercise-${index + 1}`;
  const prompt = nonEmptyString(raw.prompt)
    || nonEmptyString(raw.promptKo)
    || nonEmptyString(raw.q)
    || nonEmptyString(raw.sentence);
  const authoredChoices = Array.isArray(raw.options)
    ? raw.options
    : Array.isArray(raw.choices)
      ? raw.choices
      : [];
  const indexedAnswer = Number.isInteger(raw.answer) ? authoredChoices[raw.answer] : null;
  const answer = nonEmptyString(indexedAnswer)
    || nonEmptyString(raw.answer)
    || nonEmptyString(raw.correct);
  if (!prompt || !answer) return null;

  const accept = type === 'fill'
    ? uniqueStrings(Array.isArray(raw.accept) ? raw.accept : [])
    : [];
  let options = [];
  if (type === 'choice') {
    const source = authoredChoices.length
      ? authoredChoices
      : [answer, ...(Array.isArray(raw.distractors) ? raw.distractors : [])];
    options = uniqueStrings(source);
    if (!options.some((option) => normalizeExerciseAnswer(option) === normalizeExerciseAnswer(answer))) {
      options.push(answer);
    }
    if (options.length < 2) return null;
    options = seededShuffle(options, id);
  }

  return {
    id,
    type,
    qtype: type === 'fill' ? 'cloze' : 'choice',
    prompt,
    answer,
    accept,
    options,
    sourceRef: nonEmptyString(raw.sourceRef) || null,
  };
}

/** 정규화된 fill/choice 문항 채점. */
export function gradeExerciseResponse(question, response) {
  if (!question || !['fill', 'choice'].includes(question.type)) return false;
  const normalized = normalizeExerciseAnswer(response);
  if (!normalized) return false;
  return [question.answer, ...(question.accept || [])]
    .some((candidate) => normalizeExerciseAnswer(candidate) === normalized);
}

/**
 * F4-3 선행 공통 연습 프로토타입.
 *
 * - 기존 fr-* 디자인 토큰과 클래스만 재사용한다.
 * - 저장·SRS를 직접 import하지 않는다. 실제 배선 시 onAnswer에서
 *   progressStore.recordReviewCompleted를 호출하는 경계를 둔다.
 * - E3의 short-answer/promptKo/answer는 fill로 읽으며 choice/select도 지원한다.
 */
export default function ExerciseEnginePrototype({
  questions = [],
  title = '연습',
  langCode = 'fr',
  onAnswer,
  onComplete,
}) {
  const normalizedQuestions = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(questions) ? questions : [])
      .map(normalizeExerciseQuestion)
      .filter((question) => {
        if (!question || seen.has(question.id)) return false;
        seen.add(question.id);
        return true;
      });
  }, [questions]);
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState({});

  if (normalizedQuestions.length === 0) return null;

  const answeredCount = Object.keys(results).length;
  const rightCount = Object.values(results).filter((result) => result.correct).length;
  const done = answeredCount === normalizedQuestions.length;

  function commit(question, response) {
    if (results[question.id]) return;
    const result = {
      id: question.id,
      type: question.type,
      qtype: question.qtype,
      sourceRef: question.sourceRef,
      response,
      answer: question.answer,
      correct: gradeExerciseResponse(question, response),
    };
    const nextResults = { ...results, [question.id]: result };
    setResults(nextResults);
    onAnswer?.(result);

    if (Object.keys(nextResults).length === normalizedQuestions.length) {
      const ordered = normalizedQuestions.map((item) => nextResults[item.id]);
      onComplete?.({
        right: ordered.filter((item) => item.correct).length,
        total: ordered.length,
        results: ordered,
      });
    }
  }

  function retry() {
    setInputs({});
    setResults({});
  }

  return (
    <section className="card fr-section fr-check" aria-label={title}>
      <h2 className="fr-section__heading">
        {title}
        <span className="fr-check__count">{answeredCount}/{normalizedQuestions.length}</span>
      </h2>
      <p className="fr-check__lead">빈칸을 직접 쓰거나 보기에서 골라 확인해요.</p>

      <ol className="fr-quiz">
        {normalizedQuestions.map((question, index) => {
          const result = results[question.id];
          const inputId = `exercise-${question.id}`;
          return (
            <li key={question.id} className="fr-quiz__item">
              <div className="fr-quiz__stage">
                <span className="fr-quiz__stage-num">{index + 1}</span>
                {question.type === 'fill' ? ' 빈칸 채우기' : ' 알맞은 답 고르기'}
              </div>
              <div className="fr-quiz__q">
                <div className="fr-quiz__prompt">{question.prompt}</div>

                {question.type === 'fill' ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      commit(question, inputs[question.id] || '');
                    }}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}
                  >
                    <input
                      id={inputId}
                      type="text"
                      className="form-input"
                      aria-label="정답 입력"
                      lang={langCode}
                      value={inputs[question.id] || ''}
                      disabled={!!result}
                      onChange={(event) => setInputs((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))}
                      autoComplete="off"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    {!result && (
                      <button
                        type="submit"
                        className="btn btn--primary btn--sm"
                        disabled={!nonEmptyString(inputs[question.id])}
                      >
                        확인
                      </button>
                    )}
                  </form>
                ) : (
                  <div className="fr-quiz__opts fr-quiz__opts--col">
                    {question.options.map((option) => {
                      const isAnswer = gradeExerciseResponse(question, option);
                      const isPicked = result
                        && normalizeExerciseAnswer(result.response) === normalizeExerciseAnswer(option);
                      const stateClass = result
                        ? isAnswer
                          ? 'is-correct'
                          : isPicked
                            ? 'is-wrong'
                            : 'is-locked'
                        : '';
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`fr-quiz__opt ${stateClass}`}
                          disabled={!!result}
                          onClick={() => commit(question, option)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {result && (
                  <div className="fr-quiz__answer" role="status">
                    {result.correct ? '○ 정확해요' : <>× 정답: <span lang={langCode}>{question.answer}</span></>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {done && (
        <div className={`fr-check__verdict ${rightCount === normalizedQuestions.length ? 'is-pass' : 'is-fail'}`}>
          <p className="fr-check__result">
            <strong>{rightCount}/{normalizedQuestions.length}</strong> 문항을 맞혔어요.
          </p>
          <button type="button" className="chip" onClick={retry}>다시 풀기</button>
        </div>
      )}
    </section>
  );
}
