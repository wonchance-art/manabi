'use client';

import { useMemo, useState } from 'react';
import RefSpeak from './RefSpeak';
import { tokenizeExampleSentence } from '../lib/studySession';

const FILL_TYPES = new Set(['fill', 'short-answer']);
const CHOICE_TYPES = new Set(['choice', 'select']);
const MATCH_TYPES = new Set(['match', 'matching']);
const ORDER_TYPES = new Set(['order', 'sentence-order']);

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

function refMain(value) {
  return nonEmptyString(value?.word_text)
    || nonEmptyString(value?.word)
    || nonEmptyString(value?.term)
    || nonEmptyString(value?.fr)
    || nonEmptyString(value?.ja)
    || nonEmptyString(value?.en)
    || nonEmptyString(value?.zh)
    || nonEmptyString(value?.left);
}

function refMeaning(value) {
  return nonEmptyString(value?.meaning)
    || nonEmptyString(value?.ko)
    || nonEmptyString(value?.definition)
    || nonEmptyString(value?.right);
}

function refExampleMain(value) {
  return nonEmptyString(value?.main)
    || nonEmptyString(value?.fr)
    || nonEmptyString(value?.ja)
    || nonEmptyString(value?.en)
    || nonEmptyString(value?.zh)
    || nonEmptyString(value?.sentence);
}

function flattenVocabSet(vocabSet) {
  if (Array.isArray(vocabSet)) return vocabSet;
  if (Array.isArray(vocabSet?.words)) return vocabSet.words;
  if (Array.isArray(vocabSet?.themes)) {
    return vocabSet.themes.flatMap(theme => Array.isArray(theme?.words) ? theme.words : []);
  }
  return [];
}

/**
 * 현행 vocab/<level>.js의 themes[].words를 그대로 4쌍 매칭 원재료로 바꾼다.
 * 콘텐츠 스키마에 exercise 필드를 추가하지 않는다.
 */
export function createMatchingExerciseFromVocabSet(vocabSet, index = 0) {
  return {
    id: `auto-match-${index + 1}`,
    type: 'match',
    prompt: '단어와 뜻을 연결하세요.',
    pairs: flattenVocabSet(vocabSet),
  };
}

/**
 * 현행 문법·어휘 예문({fr|ja|en|zh, ko})을 어순 배열 원재료로 바꾼다.
 * tokens 필드가 없어도 normalizeExerciseQuestion에서 런타임 토큰화한다.
 */
export function createOrderExerciseFromExample(example, index = 0) {
  return {
    id: `auto-order-${index + 1}`,
    type: 'order',
    prompt: nonEmptyString(example?.ko) || '예문을 올바른 순서로 배열하세요.',
    sentence: refExampleMain(example),
  };
}

/**
 * 서로 다른 현행 초안/퀴즈 필드를 프로토타입 공통 형태로 정규화한다.
 * 스키마가 불완전한 문항은 null로 fail-closed 한다.
 */
export function normalizeExerciseQuestion(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const rawType = String(raw.type || '').toLowerCase();
  const id = nonEmptyString(raw.id) || `exercise-${index + 1}`;
  const type = FILL_TYPES.has(rawType)
    ? 'fill'
    : CHOICE_TYPES.has(rawType)
      ? 'choice'
      : MATCH_TYPES.has(rawType)
        ? 'match'
        : ORDER_TYPES.has(rawType)
          ? 'order'
          : null;
  if (!type) return null;

  if (type === 'match') {
    const sourcePairs = Array.isArray(raw.pairs)
      ? raw.pairs
      : Array.isArray(raw.words)
        ? raw.words
        : [];
    const seenLeft = new Set();
    const seenRight = new Set();
    const pairs = [];
    for (const value of sourcePairs) {
      const source = value?.word && typeof value.word === 'object' ? value.word : value;
      const left = refMain(value) || refMain(source);
      const right = refMeaning(value) || refMeaning(source);
      if (!left || !right || seenLeft.has(left) || seenRight.has(right)) continue;
      seenLeft.add(left);
      seenRight.add(right);
      pairs.push({
        id: `${id}-pair-${pairs.length + 1}`,
        left,
        right,
        word: {
          ...source,
          word_text: left,
          meaning: right,
        },
      });
      if (pairs.length === 4) break;
    }
    if (pairs.length !== 4) return null;
    return {
      id,
      type,
      qtype: 'match',
      prompt: nonEmptyString(raw.prompt) || '단어와 뜻을 연결하세요.',
      pairs,
      leftOptions: seededShuffle(pairs, `${id}:left`),
      rightOptions: seededShuffle(pairs.map(pair => pair.right), `${id}:right`),
      sourceRef: nonEmptyString(raw.sourceRef) || null,
      grading: 'exact',
    };
  }

  if (type === 'order') {
    const explicitDisplayAnswer = nonEmptyString(raw.displayAnswer)
      || refExampleMain(raw.example)
      || refExampleMain(raw);
    const authoredTokens = Array.isArray(raw.tokens)
      ? raw.tokens
      : Array.isArray(raw.tiles)
        ? raw.tiles
        : [];
    const tokens = (authoredTokens.length ? authoredTokens : tokenizeExampleSentence(explicitDisplayAnswer))
      .map(nonEmptyString)
      .filter(Boolean);
    const authoredAnswer = Array.isArray(raw.answer)
      ? raw.answer.map(nonEmptyString).filter(Boolean)
      : tokens;
    const joinWith = typeof raw.joinWith === 'string'
      ? raw.joinWith
      : explicitDisplayAnswer
        ? /[\s　]/u.test(explicitDisplayAnswer) ? ' ' : ''
        : ' ';
    const displayAnswer = explicitDisplayAnswer || authoredAnswer.join(joinWith);
    const prompt = nonEmptyString(raw.prompt)
      || nonEmptyString(raw.promptKo)
      || nonEmptyString(raw.q)
      || nonEmptyString(raw.ko)
      || '예문을 올바른 순서로 배열하세요.';
    if (!displayAnswer || tokens.length < 2 || authoredAnswer.length !== tokens.length) return null;
    return {
      id,
      type,
      qtype: 'order',
      prompt,
      answer: authoredAnswer.join(joinWith),
      displayAnswer,
      tokens,
      joinWith,
      bank: seededShuffle(tokens.map((token, tokenIndex) => ({ t: token, ti: tokenIndex })), `${id}:tokens`),
      sourceRef: nonEmptyString(raw.sourceRef) || null,
      grading: 'exact',
    };
  }

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

function matchingResponseMap(response) {
  if (Array.isArray(response)) {
    return Object.fromEntries(response.map(value => [value?.pairId, value?.meaning]));
  }
  return response && typeof response === 'object' ? response : {};
}

/** 정규화된 fill/choice/match/order 문항 채점. */
export function gradeExerciseResponse(question, response) {
  if (!question || !['fill', 'choice', 'match', 'order'].includes(question.type)) return false;
  if (question.type === 'match') {
    const matches = matchingResponseMap(response);
    return question.pairs.every(pair => matches[pair.id] === pair.right);
  }
  if (question.grading === 'exact' || question.type === 'order') {
    return String(response ?? '') === String(question.answer ?? '');
  }
  const normalized = normalizeExerciseAnswer(response);
  if (!normalized) return false;
  return [question.answer, ...(question.accept || [])]
    .some((candidate) => normalizeExerciseAnswer(candidate) === normalized);
}

/**
 * StudySession의 문법 chapter question을 공통 연습형으로 변환한다.
 * 기존 채점 계약을 지키기 위해 choice/order 모두 exact 비교를 명시한다.
 */
export function normalizeStudySessionExerciseQuestion(item) {
  const id = nonEmptyString(item?.uid);
  const sourceRef = nonEmptyString(item?.effect?.srs?.slug)
    || nonEmptyString(item?.effect?.meta?.slug)
    || null;
  if (!id) return null;

  if (item.type === 'vocab-match') {
    return normalizeExerciseQuestion({
      id,
      type: 'match',
      pairs: item.words,
      prompt: '단어와 뜻을 연결하세요.',
      sourceRef,
    });
  }

  if (item.type === 'example-order') {
    const normalized = normalizeExerciseQuestion({
      id,
      type: 'order',
      prompt: item.prompt,
      sentence: item.sentence?.main,
      tokens: item.tokens,
      joinWith: item.joinWith,
      sourceRef,
    });
    return normalized
      ? {
          ...normalized,
          pron: nonEmptyString(item.sentence?.pron),
        }
      : null;
  }

  if (!item?.quiz || !['grammar-cloze', 'grammar-order'].includes(item.type)) return null;

  if (item.type === 'grammar-cloze') {
    const normalized = normalizeExerciseQuestion({
      id,
      type: 'choice',
      prompt: item.quiz.sentence,
      answer: item.quiz.correct,
      options: [item.quiz.correct, ...(item.quiz.distractors || [])],
      sourceRef,
    });
    return normalized
      ? {
          ...normalized,
          qtype: 'cloze',
          grading: 'exact',
          subtitle: nonEmptyString(item.quiz.ko),
          feedback: nonEmptyString(item.quiz.full),
          pron: nonEmptyString(item.quiz.pron),
        }
      : null;
  }

  const tokens = Array.isArray(item.quiz.tokens)
    ? item.quiz.tokens.map(nonEmptyString).filter(Boolean)
    : [];
  const displayAnswer = nonEmptyString(item.quiz.answer);
  const prompt = nonEmptyString(item.quiz.ko);
  if (!prompt || !displayAnswer || tokens.length < 2) return null;

  return {
    id,
    type: 'order',
    qtype: 'order',
    prompt,
    answer: tokens.join(' '),
    displayAnswer,
    tokens,
    pron: nonEmptyString(item.quiz.pron),
    sourceRef,
    grading: 'exact',
  };
}

export function normalizeStudySessionGrammarQuestion(item) {
  if (!['grammar-cloze', 'grammar-order'].includes(item?.type)) return null;
  return normalizeStudySessionExerciseQuestion(item);
}

export function createExerciseResult(question, response) {
  const pairResults = question.type === 'match'
    ? question.pairs.map(pair => ({
        pairId: pair.id,
        word: pair.word,
        response: matchingResponseMap(response)[pair.id] || '',
        answer: pair.right,
        correct: matchingResponseMap(response)[pair.id] === pair.right,
      }))
    : undefined;
  return {
    id: question.id,
    type: question.type,
    qtype: question.qtype,
    sourceRef: question.sourceRef,
    response,
    answer: question.type === 'order'
      ? question.displayAnswer
      : question.type === 'match'
        ? Object.fromEntries(question.pairs.map(pair => [pair.id, pair.right]))
        : question.answer,
    correct: gradeExerciseResponse(question, response),
    ...(pairResults ? { pairResults } : {}),
  };
}

function StudySessionExercise({
  studyItem,
  phase = 'answer',
  picked = null,
  prepared = {},
  orderPicks = [],
  onOrderPicksChange,
  matchState = { selectedId: null, matches: {} },
  onMatchStateChange,
  onAnswer,
  isTapLocked,
  lang,
  langCode,
  renderMain = text => text,
}) {
  const question = normalizeStudySessionExerciseQuestion(studyItem);
  if (!question) return null;

  const feedback = phase === 'feedback';
  const context = studyItem.type === 'vocab-match'
    ? '어휘 매칭 · 4쌍'
    : studyItem.type === 'example-order'
      ? '예문 · 어순 배열'
      : `${studyItem.effect?.kind === 'grammar-due' ? '복습' : '새 패턴'} · ${studyItem.chapter.title}`;

  if (question.type === 'match') {
    const selectedId = matchState?.selectedId || null;
    const matches = matchState?.matches || {};
    const usedMeanings = new Set(Object.values(matches));

    return (
      <div className="fr-quiz__q">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          {context}
        </div>
        <div className="fr-quiz__prompt">{question.prompt}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, marginTop: 12 }}>
          <div className="fr-quiz__opts fr-quiz__opts--col">
            {question.leftOptions.map(pair => {
              const assigned = matches[pair.id];
              const stateClass = feedback
                ? assigned === pair.right ? 'is-correct' : 'is-wrong'
                : selectedId === pair.id ? 'is-correct' : '';
              return (
                <button
                  key={pair.id}
                  type="button"
                  disabled={feedback}
                  className={`fr-quiz__opt ${stateClass}`}
                  onClick={() => onMatchStateChange?.({ selectedId: pair.id, matches })}
                  lang={langCode}
                >
                  {pair.left}
                </button>
              );
            })}
          </div>
          <div className="fr-quiz__opts fr-quiz__opts--col">
            {question.rightOptions.map(meaning => (
              <button
                key={meaning}
                type="button"
                disabled={feedback || !selectedId || usedMeanings.has(meaning)}
                className={`fr-quiz__opt ${feedback ? 'is-locked' : ''}`}
                onClick={() => {
                  if (!selectedId || isTapLocked?.()) return;
                  const nextMatches = { ...matches, [selectedId]: meaning };
                  const nextState = { selectedId: null, matches: nextMatches };
                  onMatchStateChange?.(nextState);
                  if (Object.keys(nextMatches).length === question.pairs.length) {
                    onAnswer?.(createExerciseResult(question, nextMatches));
                  }
                }}
              >
                {meaning}
              </button>
            ))}
          </div>
        </div>
        {feedback && (
          <div className="fr-quiz__answer">
            {question.pairs.map(pair => (
              <div key={pair.id}>
                <span lang={langCode}>{pair.left}</span> — {pair.right}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'choice') {
    const options = prepared.options || question.options;
    return (
      <div className="fr-quiz__q">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          {context}
        </div>
        <div className="fr-quiz__prompt" lang={langCode}>{question.prompt}</div>
        <div className="fr-quiz__sub">“{question.subtitle}”</div>
        <div className="fr-quiz__opts fr-quiz__opts--grid">
          {options.map(option => (
            <button
              key={option}
              type="button"
              disabled={feedback}
              className={`fr-quiz__opt ${feedback ? (option === question.answer ? 'is-correct' : option === picked ? 'is-wrong' : 'is-locked') : ''}`}
              onClick={() => onAnswer?.(createExerciseResult(question, option))}
              lang={langCode}
            >
              {option}
            </button>
          ))}
        </div>
        {feedback && (
          <div className="fr-quiz__answer">
            <span lang={langCode}>{renderMain(question.feedback, question.pron)}</span>
            <RefSpeak text={question.feedback} lang={lang} size="xs" />
          </div>
        )}
      </div>
    );
  }

  const bank = prepared.bank || question.bank || question.tokens.map((token, index) => ({ t: token, ti: index }));
  const built = orderPicks.map(bankIndex => bank[bankIndex].t).join(question.joinWith ?? ' ');
  const correct = gradeExerciseResponse(question, built);

  return (
    <div className="fr-quiz__q">
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
        {context}
      </div>
      <div className="fr-quiz__prompt">“{question.prompt}”</div>
      <div className={`fr-quiz__line ${feedback ? (correct ? 'is-correct' : 'is-wrong') : ''}`}>
        {orderPicks.map((bankIndex, position) => (
          <button
            key={position}
            type="button"
            className="fr-quiz__token is-picked"
            disabled={feedback}
            onClick={() => onOrderPicksChange?.(current => current.filter((_, index) => index !== position))}
            lang={langCode}
          >
            {bank[bankIndex].t}
          </button>
        ))}
        {orderPicks.length === 0 && <span className="fr-quiz__line-hint">단어를 순서대로 탭하세요</span>}
      </div>
      {phase === 'answer' && (
        <div className="fr-quiz__tokens">
          {bank.map((token, bankIndex) => (
            orderPicks.includes(bankIndex) ? null : (
              <button
                key={bankIndex}
                type="button"
                className="fr-quiz__token"
                lang={langCode}
                onClick={() => {
                  if (isTapLocked?.()) return;
                  const nextPicks = [...orderPicks, bankIndex];
                  onOrderPicksChange?.(nextPicks);
                  if (nextPicks.length === question.tokens.length) {
                    const response = nextPicks.map(index => bank[index].t).join(question.joinWith ?? ' ');
                    onAnswer?.(createExerciseResult(question, response));
                  }
                }}
              >
                {token.t}
              </button>
            )
          ))}
        </div>
      )}
      {feedback && (
        <div className="fr-quiz__answer">
          <span lang={langCode}>{renderMain(question.displayAnswer, question.pron)}</span>
          <RefSpeak text={question.displayAnswer} lang={lang} size="xs" />
        </div>
      )}
    </div>
  );
}

/**
 * F4-3 선행 공통 연습 프로토타입.
 *
 * - 기존 fr-* 디자인 토큰과 클래스만 재사용한다.
 * - 저장·SRS를 직접 import하지 않는다. 실제 배선 시 onAnswer에서
 *   progressStore.recordReviewCompleted를 호출하는 경계를 둔다.
 * - E3의 short-answer/promptKo/answer는 fill로 읽으며 choice/select도 지원한다.
 * - vocabSet·examples를 받으면 현행 콘텐츠에서 match/order를 자동 생성한다.
 */
function StandaloneExerciseEngine({
  questions = [],
  vocabSet = null,
  examples = [],
  title = '연습',
  langCode = 'fr',
  onAnswer,
  onComplete,
}) {
  const normalizedQuestions = useMemo(() => {
    const seen = new Set();
    const automatic = [
      ...(vocabSet ? [createMatchingExerciseFromVocabSet(vocabSet)] : []),
      ...(Array.isArray(examples) ? examples.map(createOrderExerciseFromExample) : []),
    ];
    return [...(Array.isArray(questions) ? questions : []), ...automatic]
      .map(normalizeExerciseQuestion)
      .filter((question) => {
        if (!question || seen.has(question.id)) return false;
        seen.add(question.id);
        return true;
      });
  }, [examples, questions, vocabSet]);
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState({});

  if (normalizedQuestions.length === 0) return null;

  const answeredCount = Object.keys(results).length;
  const rightCount = Object.values(results).filter((result) => result.correct).length;
  const done = answeredCount === normalizedQuestions.length;

  function commit(question, response) {
    if (results[question.id]) return;
    const result = createExerciseResult(question, response);
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
      <p className="fr-check__lead">쓰기·고르기·매칭·어순 배열을 번갈아 확인해요.</p>

      <ol className="fr-quiz">
        {normalizedQuestions.map((question, index) => {
          const result = results[question.id];
          const inputId = `exercise-${question.id}`;
          return (
            <li key={question.id} className="fr-quiz__item">
              <div className="fr-quiz__stage">
                <span className="fr-quiz__stage-num">{index + 1}</span>
                {question.type === 'fill' ? ' 빈칸 채우기'
                  : question.type === 'choice' ? ' 알맞은 답 고르기'
                  : question.type === 'match' ? ' 단어와 뜻 연결하기'
                  : ' 예문 어순 배열하기'}
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
                ) : question.type === 'choice' ? (
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
                ) : question.type === 'match' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {question.leftOptions.map(pair => (
                      <label
                        key={pair.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <span lang={langCode} style={{ fontWeight: 700 }}>{pair.left}</span>
                        <select
                          className="form-input"
                          aria-label={`${pair.left}의 뜻`}
                          value={inputs[question.id]?.[pair.id] || ''}
                          disabled={!!result}
                          onChange={event => setInputs(current => ({
                            ...current,
                            [question.id]: {
                              ...(current[question.id] || {}),
                              [pair.id]: event.target.value,
                            },
                          }))}
                        >
                          <option value="">뜻 선택</option>
                          {question.rightOptions.map(meaning => (
                            <option key={meaning} value={meaning}>{meaning}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                    {!result && (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={Object.keys(inputs[question.id] || {}).length !== question.pairs.length}
                        onClick={() => commit(question, inputs[question.id] || {})}
                      >
                        확인
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <div className="fr-quiz__line">
                      {(inputs[question.id] || []).map((bankIndex, position) => (
                        <button
                          key={position}
                          type="button"
                          className="fr-quiz__token is-picked"
                          disabled={!!result}
                          onClick={() => setInputs(current => ({
                            ...current,
                            [question.id]: (current[question.id] || []).filter((_, pickIndex) => pickIndex !== position),
                          }))}
                        >
                          {question.bank[bankIndex].t}
                        </button>
                      ))}
                      {!(inputs[question.id] || []).length && (
                        <span className="fr-quiz__line-hint">단어를 순서대로 탭하세요</span>
                      )}
                    </div>
                    {!result && (
                      <div className="fr-quiz__tokens">
                        {question.bank.map((token, bankIndex) => (
                          (inputs[question.id] || []).includes(bankIndex) ? null : (
                            <button
                              key={bankIndex}
                              type="button"
                              className="fr-quiz__token"
                              onClick={() => setInputs(current => ({
                                ...current,
                                [question.id]: [...(current[question.id] || []), bankIndex],
                              }))}
                            >
                              {token.t}
                            </button>
                          )
                        ))}
                      </div>
                    )}
                    {!result && (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={(inputs[question.id] || []).length !== question.tokens.length}
                        onClick={() => {
                          const response = (inputs[question.id] || [])
                            .map(bankIndex => question.bank[bankIndex].t)
                            .join(question.joinWith);
                          commit(question, response);
                        }}
                      >
                        확인
                      </button>
                    )}
                  </div>
                )}

                {result && (
                  <div className="fr-quiz__answer" role="status">
                    {result.correct
                      ? '○ 정확해요'
                      : question.type === 'match'
                        ? `× ${result.pairResults.filter(pair => pair.correct).length}/4쌍 정답`
                        : <>× 정답: <span lang={langCode}>{question.displayAnswer || question.answer}</span></>}
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

/**
 * 공통 연습 컴포넌트.
 *
 * studyItem이 있으면 StudySession의 한 문항짜리 제어형 흐름을 사용하고,
 * 없으면 기존 독립 프로토타입 questions 흐름을 유지한다.
 */
export default function ExerciseEnginePrototype(props) {
  if (props.studyItem) return <StudySessionExercise {...props} />;
  return <StandaloneExerciseEngine {...props} />;
}
