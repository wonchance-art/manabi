'use client';

import { useState, useEffect } from 'react';
import { callGemini } from '../lib/gemini';
import Button from './Button';

const STORAGE_KEY = 'reading_test:';

function loadSaved(materialId) {
  if (typeof window === 'undefined' || !materialId) return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY + materialId)); } catch { return null; }
}

function saveToDisk(materialId, data) {
  if (typeof window === 'undefined' || !materialId) return;
  try { localStorage.setItem(STORAGE_KEY + materialId, JSON.stringify(data)); } catch {}
}

export default function ReadingTest({ rawText, language, materialId, onClose, inline = false }) {
  const [status, setStatus] = useState('idle'); // idle | loading | active | done
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  // 저장된 테스트 복원
  useEffect(() => {
    const saved = loadSaved(materialId);
    if (saved) {
      setQuestions(saved.questions);
      setAnswers(saved.answers || {});
      if (saved.result) {
        setResult(saved.result);
        setStatus('done');
      } else {
        setStatus('active');
      }
    } else if (inline) {
      generateTest();
    }
  }, [materialId]);

  // 답변/결과 변경 시 저장
  useEffect(() => {
    if (questions.length > 0 && materialId) {
      saveToDisk(materialId, { questions, answers, result });
    }
  }, [answers, result]);

  async function generateTest() {
    const excerpt = (rawText || '').slice(0, 2500);
    if (!excerpt.trim()) return;
    setStatus('loading');

    try {
      const raw = await callGemini(`You are an IELTS Academic Reading examiner. Generate a question set for the passage below.

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
- Questions must require reading the passage to answer`);

      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean.substring(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      setQuestions(parsed.questions);
      setAnswers({});
      setResult(null);
      setStatus('active');
      saveToDisk(materialId, { questions: parsed.questions, answers: {}, result: null });
    } catch {
      setStatus('idle');
    }
  }

  function selectAnswer(qIdx, optIdx) {
    setAnswers(prev => {
      const next = { ...prev, [qIdx]: optIdx };
      return next;
    });
  }

  function gradeTest() {
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
      };
    });
    const r = { score, total: questions.length, explanations };
    setResult(r);
    setStatus('done');
  }

  function resetTest() {
    setStatus('idle');
    setQuestions([]);
    setAnswers({});
    setResult(null);
    if (materialId) localStorage.removeItem(STORAGE_KEY + materialId);
    if (inline) generateTest();
  }

  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;
  const typeLabel = { mcq: 'Multiple Choice', yesno: 'Yes / No / Not Given', completion: 'Sentence Completion', short: 'Short Answer' };

  const Wrapper = inline ? 'div' : ({ children }) => (
    <div className="reading-test-overlay" onClick={onClose}>{children}</div>
  );

  return (
    <Wrapper>
      <div className={`reading-test ${inline ? 'reading-test--inline' : ''}`} onClick={e => e.stopPropagation()}>

        <div className="reading-test__header">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📝 IELTS Reading Test</h2>
          {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>}
        </div>

        {/* idle */}
        {status === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📝</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Test your comprehension with<br />IELTS-style reading questions.
            </p>
            <Button onClick={generateTest}>Start Test</Button>
          </div>
        )}

        {/* loading */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            ⏳ Generating questions...
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
              {allAnswered ? '✅ Submit & Grade' : `${Object.keys(answers).length}/${questions.length} answered`}
            </Button>
          </div>
        )}

        {/* done */}
        {status === 'done' && result && (
          <div className="reading-test__body">
            <div className="reading-test__score">
              <span className="reading-test__score-num">{result.score}</span>
              <span className="reading-test__score-total">/ {result.total}</span>
            </div>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem' }}>
              {result.score === result.total ? 'Excellent! Perfect score.' :
               result.score >= result.total * 0.6 ? 'Good job. Review the ones you missed.' :
               'Try reading the passage again more carefully.'}
            </p>

            {result.explanations.map((e, i) => (
              <div key={i} className={`reading-test__result-item ${e.correct ? 'reading-test__result-item--correct' : 'reading-test__result-item--wrong'}`}>
                <div className="reading-test__result-header">
                  <span>{e.correct ? '✅' : '❌'} Q{i + 1}</span>
                </div>
                <p className="reading-test__result-q">{e.question}</p>
                {!e.correct && (
                  <div className="reading-test__result-answers">
                    <span className="reading-test__your-answer">Your answer: {e.yourAnswer}</span>
                    <span className="reading-test__correct-answer">Correct: {e.correctAnswer}</span>
                  </div>
                )}
                <p className="reading-test__result-expl">{e.explanation}</p>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <Button variant="ghost" onClick={resetTest} style={{ flex: 1 }}>New Test</Button>
              {onClose && <Button onClick={onClose} style={{ flex: 1 }}>Close</Button>}
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
