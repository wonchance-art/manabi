import { useRef, useState } from 'react';
import { callGemini, GEMINI_TIER } from './gemini';
import { langNameKo } from './constants';

export function useViewerQuiz() {
  const [quizState, setQuizState] = useState(null);
  const [completionModal, setCompletionModal] = useState(null);
  // 퀴즈 회차 — 생성 중에 닫으면 늦게 도착한 응답이 닫은 퀴즈를 다시 띄우지 않게 한다.
  const runRef = useRef(0);

  async function generateQuiz(rawText, lang, pendingCompletion) {
    const excerpt = (rawText || '').slice(0, 1200);
    if (!excerpt.trim()) {
      setCompletionModal(pendingCompletion);
      return;
    }
    const run = ++runRef.current;
    setQuizState({ status: 'loading', pendingCompletion });
    try {
      const prompt = `다음 ${langNameKo(lang)} 텍스트를 읽고 내용 이해를 확인하는 객관식 문제 3개를 만들어주세요.

텍스트:
"""
${excerpt}
"""

규칙:
- 각 문제는 4개 선택지 (0~3번 인덱스)
- 정답은 텍스트에서 명확히 확인 가능해야 함
- 질문과 선택지는 한국어로 작성
- answer는 정답 인덱스 (0~3)

반드시 아래 JSON만 출력:
{"questions":[{"question":"...","options":["...","...","...","..."],"answer":0},{"question":"...","options":["...","...","...","..."],"answer":1},{"question":"...","options":["...","...","...","..."],"answer":2}]}`;

      const raw = await callGemini(prompt, null, { tier: GEMINI_TIER });
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean.substring(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      if (run !== runRef.current) return;
      setQuizState({
        status: 'active',
        questions: parsed.questions,
        currentQ: 0,
        score: 0,
        selected: null,
        pendingCompletion,
      });
    } catch {
      if (run !== runRef.current) return;
      setQuizState(null);
      setCompletionModal(pendingCompletion);
    }
  }

  function handleQuizAnswer(optIdx) {
    setQuizState(prev => {
      if (prev.status !== 'active' || prev.selected !== null) return prev;
      const correct = prev.questions[prev.currentQ].answer === optIdx;
      const newScore = prev.score + (correct ? 1 : 0);
      const isLast = prev.currentQ === prev.questions.length - 1;
      if (isLast) {
        return { status: 'done', score: newScore, total: prev.questions.length, pendingCompletion: prev.pendingCompletion };
      }
      return { ...prev, selected: optIdx, score: newScore };
    });
  }

  function advanceQuiz() {
    setQuizState(prev => {
      if (prev.status !== 'active') return prev;
      return { ...prev, currentQ: prev.currentQ + 1, selected: null };
    });
  }

  // 닫기·Esc(WALL-STATES-001 ③) — 퀴즈를 건너뛰고 읽기 완료 요약으로 간다(생성 실패와 같은 길).
  // 완료 요약은 읽기 기록이라 퀴즈를 닫아도 잃지 않는다.
  function closeQuiz() {
    if (quizState?.status === 'done') { finishQuiz(); return; } // 다 푼 퀴즈는 점수를 지킨다
    runRef.current++;
    const pendingCompletion = quizState?.pendingCompletion;
    setQuizState(null);
    if (pendingCompletion) setCompletionModal(pendingCompletion);
  }

  function finishQuiz() {
    const { score, total, pendingCompletion } = quizState;
    setQuizState(null);
    setCompletionModal({ ...pendingCompletion, quizScore: score, quizTotal: total });
  }

  return {
    quizState, setQuizState,
    completionModal, setCompletionModal,
    generateQuiz,
    handleQuizAnswer,
    advanceQuiz,
    finishQuiz,
    closeQuiz,
  };
}
