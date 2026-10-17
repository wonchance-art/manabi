'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { viewerCacheKey } from '../lib/viewerReliability';
import { buildReadingCheckPrompt, validateReadingQuestions } from '../lib/readingTestReliability';
import { callGemini } from '../lib/gemini';
import { useAuth } from '../lib/AuthContext';
import { authEntryHref } from '../lib/authRedirect';
import { logReviewEvents } from '../lib/reviewEvents';
import Button from './Button';

const STORAGE_KEY = 'reading_test:';
const HISTORY_KEY = 'reading_test_history:';

export function isReadingTestRequestCurrent(requestRef, requestId, materialRef, materialId) {
  return requestRef.current === requestId && materialRef.current === materialId;
}

function loadSaved(materialId) {
  if (typeof window === 'undefined' || !materialId) return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY + materialId)); } catch { return null; }
}

function saveToDisk(materialId, data) {
  if (typeof window === 'undefined' || !materialId) return;
  try { localStorage.setItem(STORAGE_KEY + materialId, JSON.stringify(data)); } catch {}
}

function pushHistory(materialId, score, total) {
  if (typeof window === 'undefined' || !materialId) return;
  try {
    const key = HISTORY_KEY + materialId;
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push({ score, total, ts: Date.now() });
    if (arr.length > 20) arr.shift();
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

function getHistory(materialId) {
  if (typeof window === 'undefined' || !materialId) return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY + materialId) || '[]'); } catch { return []; }
}

function ReadingTestOverlay({ children, onClose }) {
  return <div className="reading-test-overlay" onClick={onClose}>{children}</div>;
}

// 손님 안내 기본값 — 뷰어는 자기 화면 문구(vt)와 제자리 복귀 주소(signInHref)를 넘긴다(목업 viewer-audit §1).
export const READING_TEST_GUEST_LABEL = '로그인하면 문제를 만들어 드려요 →';

export default function ReadingTest({ rawText, language, materialId, onClose, onGraded, inline = false, nextLesson = null, signInHref = null, signInLabel = READING_TEST_GUEST_LABEL }) {
  const { user, loading: authLoading } = useAuth();
  // 손님은 문제를 만들지 않는다 — /api/gemini가 401로 막으니 요청 대신 로그인 안내(번역 칸 SENTENCE_TX_LOGIN_REQUIRED와 같은 규칙).
  // 이미 만들어 둔 문제(캐시)는 지금처럼 복원해 보인다. 로그인 확인 중에도 요청하지 않는다.
  const signedIn = !!user?.id;
  const english = language === 'English';
  const [errorMessage, setErrorMessage] = useState('');
  const diskKeyRef = useRef(null);
  const generationRef = useRef(null);
  const generationStartRef = useRef(null);
  generationStartRef.current = generateTest;
  const gradedRef = useRef(false);
  const [status, setStatus] = useState('idle'); // idle | loading | active | done
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const requestRef = useRef(0);
  const materialRef = useRef(materialId);
  const skipPersistRef = useRef(false);

  materialRef.current = materialId;

  function isCurrentRequest(requestId, requestMaterialId) {
    return isReadingTestRequestCurrent(requestRef, requestId, materialRef, requestMaterialId);
  }

  useEffect(() => () => { requestRef.current += 1; generationRef.current?.abort(); }, []);

  // 계정·자료 원문·언어가 같은 문제만 복원한다. 예전 자료 ID 전용 캐시는 재사용하지 않는다.
  useEffect(() => {
    const requestId = ++requestRef.current;
    generationRef.current?.abort();
    diskKeyRef.current = null;
    skipPersistRef.current = true;
    setQuestions([]); setAnswers({}); setResult(null); setErrorMessage(''); setStatus('loading');
    gradedRef.current = false;
    viewerCacheKey('reading_test', [user?.id || 'guest', materialId, language], rawText || '').then(key => {
      if (requestRef.current !== requestId) return;
      diskKeyRef.current = key;
      const saved = loadSaved(key);
      if (saved && validateReadingQuestions(saved.questions, (rawText || '').slice(0, 2500), language)) {
        setQuestions(saved.questions);
        setAnswers(saved.answers || {});
        setResult(saved.result || null);
        gradedRef.current = !!saved.result;
        setStatus(saved.result ? 'done' : 'active');
      } else {
        setStatus('idle');
        if (inline && signedIn) generationStartRef.current();
      }
    }).catch(() => { if (requestRef.current === requestId) { setStatus('idle'); setErrorMessage('읽기 확인을 준비하지 못했어요. 다시 열어 주세요.'); } });
    return () => { requestRef.current += 1; generationRef.current?.abort(); };
  }, [materialId, language, rawText, user?.id, signedIn, inline]);

  // 답변/결과 변경 시 저장
  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (questions.length > 0 && materialId) {
      saveToDisk(diskKeyRef.current, { questions, answers, result });
    }
  }, [questions, answers, result, materialId]);

  async function generateTest() {
    if (!signedIn) return;
    const excerpt = (rawText || '').slice(0, 2500);
    if (!excerpt.trim() || !diskKeyRef.current) return;
    const requestMaterialId = materialId;
    const requestId = ++requestRef.current;
    setStatus('loading');
    setErrorMessage('');
    generationRef.current?.abort();
    const controller = new AbortController();
    generationRef.current = controller;
    const deadline = setTimeout(() => { controller.abort(); if (isCurrentRequest(requestId, requestMaterialId)) { setStatus('idle'); setErrorMessage('문제 생성 시간이 길어지고 있어요. 다시 시도해 주세요.'); } }, 45000);

    try {
      const englishPrompt = `You are an IELTS Academic Reading examiner. Generate a question set for the passage below.

Passage:
"""
${excerpt}
"""

Output exactly 5 questions in this fixed structure. Follow the format precisely.

SECTION 1 — Questions 1-2: Multiple Choice
Choose the correct letter, A, B, C or D.
- 2 questions testing main idea and specific detail
- type: "mcq"
- options: exactly 4, prefixed "A. ", "B. ", "C. ", "D. "

SECTION 2 — Question 3: Yes / No / Not Given
Do the following statements agree with the claims of the writer?
- 1 question
- type: "yesno"
- options: exactly ["Yes", "No", "Not Given"]

SECTION 3 — Question 4: Sentence Completion
Complete the sentence below. Choose the correct letter, A, B, C or D.
- 1 question where the question IS the incomplete sentence ending with "___"
- type: "completion"
- options: exactly 4, prefixed "A. ", "B. ", "C. ", "D. "

SECTION 4 — Question 5: Short Answer
Answer the question below using NO MORE THAN THREE WORDS from the passage.
- 1 question
- type: "short"
- options: exactly 4 candidate answers (one correct, three distractors)

JSON format (output ONLY this, no other text):
{"questions":[
  {"type":"mcq","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":0,"explanation":"..."},
  {"type":"mcq","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":2,"explanation":"..."},
  {"type":"yesno","question":"...","options":["Yes","No","Not Given"],"answer":0,"explanation":"..."},
  {"type":"completion","question":"According to the author, the main reason was ___","options":["A. ...","B. ...","C. ...","D. ..."],"answer":1,"explanation":"..."},
  {"type":"short","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":0,"explanation":"..."}
]}

Rules:
- ALL text in English
- answer: 0-indexed integer matching correct option
- explanation: one sentence citing the passage
- Band 6-7 difficulty
- Questions must require reading the passage to answer`;
      const raw = await callGemini(english ? englishPrompt : buildReadingCheckPrompt(excerpt, language), controller.signal);

      if (!isCurrentRequest(requestId, requestMaterialId) || controller.signal.aborted) return;

      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean.substring(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      if (!validateReadingQuestions(parsed.questions, excerpt, language)) throw new Error('INVALID_QUESTIONS');
      gradedRef.current = false;
      setQuestions(parsed.questions);
      setAnswers({});
      setResult(null);
      setStatus('active');
      saveToDisk(diskKeyRef.current, { questions: parsed.questions, answers: {}, result: null });
    } catch {
      if (isCurrentRequest(requestId, requestMaterialId) && !controller.signal.aborted) { setStatus('idle'); setErrorMessage('문제를 만들지 못했어요. 다시 시도해 주세요.'); }
    } finally { clearTimeout(deadline); }
  }

  function selectAnswer(qIdx, optIdx) {
    setAnswers(prev => {
      const next = { ...prev, [qIdx]: optIdx };
      return next;
    });
  }

  function gradeTest() {
    if (gradedRef.current || status !== 'active' || !questions.every((q, i) => Number.isInteger(answers[i]) && answers[i] >= 0 && answers[i] < q.options.length)) return;
    gradedRef.current = true;
    let score = 0;
    const explanations = questions.map((q, i) => {
      const correct = answers[i] === q.answer;
      if (correct) score++;
      return {
        question: q.question,
        yourAnswer: q.options[answers[i]] || 'No answer',
        correctAnswer: q.options[q.answer],
        correct,
        explanation: q.explanation,
        evidence: q.evidence,
      };
    });
    const r = { score, total: questions.length, explanations };
    setResult(r);
    setStatus('done');
    pushHistory(diskKeyRef.current, score, questions.length);
    // 읽기 루트 신호 편입 — 문항별 정오를 review_events로(다이얼·주간 회고에 합류).
    // source='reading'은 어휘 rung(vocab 전용)·FSRS에는 영향 없다. 게스트는 로컬 히스토리만.
    if (user?.id) {
      logReviewEvents(user.id, explanations.map(ex => ({
        lang: language,
        source: 'reading',
        item_key: `rt:${materialId || '-'}`,
        correct: ex.correct,
        detail: { qtype: 'reading-test' },
      })));
    }
    // 이해도 결과를 부모에게 넘긴다(v2-I R1b R3) — 페이서 사다리가 이 신호로만 움직인다.
    // 여기는 그 쓰임을 모른다: 채점 결과를 알릴 뿐이고 판정은 호출자 몫이다.
    onGraded?.({ score, total: questions.length });
  }

  function resetTest() {
    setStatus('idle');
    setQuestions([]);
    setAnswers({});
    setResult(null);
    gradedRef.current = false;
    try { if (diskKeyRef.current) localStorage.removeItem(STORAGE_KEY + diskKeyRef.current); } catch {}
    if (inline) generateTest();
  }

  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;
  const typeLabel = english ? { mcq: 'Multiple Choice', yesno: 'Yes / No / Not Given', completion: 'Sentence Completion', short: 'Short Answer' } : { mcq: '내용 이해', yesno: '일치 여부', completion: '문장 완성', short: '답 고르기' };

  const Wrapper = inline ? 'div' : ReadingTestOverlay;

  return (
    <Wrapper {...(inline ? {} : { onClose })}>
      <div className={`reading-test ${inline ? 'reading-test--inline' : ''}`} onClick={e => e.stopPropagation()}>

        {/* 창(ViewerModal) 안에서는 머리를 그리지 않는다 — 창 머리가 이미 제목 · 닫기를 가진다(닫기 두 개 · 제목 두 번이던 것,
            오너 「권장대로」 2026-10-17 KST). 뷰어의 다른 창 6곳과 같은 관례. */}
        {!inline && <div className="reading-test__header">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{english ? 'IELTS Reading Test' : '읽기 확인'}</h2>
          {onClose && <button type="button" aria-label="닫기" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}><span aria-hidden="true">✕</span></button>}
        </div>}

        {/* idle */}
        {status === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              {english ? 'IELTS 형식으로 이 글의 이해도를 확인해요.' : '방금 읽은 글의 내용을 다섯 문제로 확인해요.'}
            </p>
            {signedIn ? <>
              {errorMessage && <p role="alert">{errorMessage}</p>}
              <Button onClick={generateTest} disabled={!diskKeyRef.current}>{errorMessage ? '다시 시도' : '시작하기'}</Button>
            </> : !authLoading && <Link href={signInHref || authEntryHref(typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search)} className="reading-test__login">{signInLabel}</Link>}
          </div>
        )}

        {/* loading */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            문제를 만들고 있어요…
          </div>
        )}

        {/* active */}
        {status === 'active' && (
          <div className="reading-test__body">
            {questions.map((q, i) => (
              <div key={i} className="reading-test__question">
                <div className="reading-test__q-header">
                  <span className="reading-test__q-num">{i + 1}</span>
                  <span className="reading-test__q-type">{typeLabel[q.type] || q.type}</span>
                </div>
                <p className="reading-test__q-text">{q.question}</p>
                <div className="reading-test__options">
                  {q.options.map((opt, j) => (
                    <label key={j} className={`reading-test__option ${answers[i] === j ? 'reading-test__option--selected' : ''}`}>
                      <input
                        type="radio"
                        name={`q-${i}`}
                        checked={answers[i] === j}
                        onChange={() => selectAnswer(i, j)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <Button onClick={gradeTest} disabled={!allAnswered} style={{ width: '100%', marginTop: 16 }}>
              {allAnswered ? '채점' : `${Object.keys(answers).length}/${questions.length}`}
            </Button>
          </div>
        )}

        {/* done */}
        {status === 'done' && result && (() => {
          const history = getHistory(diskKeyRef.current);
          const best = history.length > 0 ? history.reduce((b, h) => h.score > b.score ? h : b) : null;
          return (
          <div className="reading-test__body">
            <div className="reading-test__score">
              <span className="reading-test__score-num">{result.score}</span>
              <span className="reading-test__score-total">/ {result.total}</span>
            </div>
            {history.length > 1 && best && (
              <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                최고 {best.score}/{best.total} · 시도 {history.length}회
              </div>
            )}
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem' }}>
              {/* 뷰어 퀴즈 결과(ViewerQuizModal)와 같은 세 문장 — 같은 상황은 같은 문구(copy-standard §3). 나누는 기준(60%)은 그대로. */}
              {result.score === result.total ? '완벽해요! 내용을 완전히 이해했네요.' :
               result.score >= result.total * 0.6 ? '잘 읽었어요. 틀린 부분을 다시 확인해보세요.' :
               '단어를 복습하고 다시 읽어보세요.'}
            </p>

            {result.explanations.map((e, i) => (
              <div key={i} className={`reading-test__result-item ${e.correct ? 'reading-test__result-item--correct' : 'reading-test__result-item--wrong'}`}>
                <div className="reading-test__result-header">
                  <span>{e.correct ? '✓' : '×'} Q{i + 1}</span>
                </div>
                <p className="reading-test__result-q">{e.question}</p>
                {!e.correct && (
                  <div className="reading-test__result-answers">
                    <span className="reading-test__your-answer">내 답: {e.yourAnswer}</span>
                    <span className="reading-test__correct-answer">정답: {e.correctAnswer}</span>
                  </div>
                )}
                <p className="reading-test__result-expl">{e.explanation}</p>
                {e.evidence && <blockquote>{e.evidence}</blockquote>}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={resetTest} style={{ flex: '1 1 120px' }}>다시 풀기</Button>
              {onClose && <Button variant="ghost" onClick={onClose} style={{ flex: '1 1 120px' }}>닫기</Button>}
              {nextLesson && (
                <Link href={`/viewer/${nextLesson.id}`} className="btn btn--primary btn--md" style={{ flex: '1 1 160px', justifyContent: 'center' }}>
                  다음 편 →
                </Link>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    </Wrapper>
  );
}
