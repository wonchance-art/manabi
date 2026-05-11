'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { useCelebration } from '../lib/CelebrationContext';
import { useTTS } from '../lib/useTTS';
import { useViewerQuiz } from '../lib/useViewerQuiz';
import { useSeriesNeighbors } from '../lib/useSeriesNeighbors';
import { useReadingCompletion } from '../lib/useReadingCompletion';
import { parseTitle } from '../lib/seriesMeta';
import { fetchOrGenerateExplanation } from '../lib/lessonExplanation';
import { callGemini } from '../lib/gemini';
import { formatDetail } from '../lib/wordDetailFormat';
import { getLessonContent } from '../content/lessons';
import LessonExplanation from '../components/LessonExplanation';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import KanaChart from '../components/KanaChart';

const STORAGE_KEY = 'lesson_progress:';

export default function LessonViewer() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const { celebrate, checkLevelUp } = useCelebration();
  const { speak, supported: ttsSupported } = useTTS();

  const { data: material, isLoading } = useQuery({
    queryKey: ['lesson-material', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reading_materials')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const meta = material ? parseTitle(material.title) : null;
  const isLesson = !!(meta?.level && meta?.num != null);
  const language = material?.processed_json?.metadata?.language || 'Japanese';
  const langCode = language === 'Japanese' ? 'ja-JP' : 'en-US';
  const targetLangKo = language === 'Japanese' ? '일본어' : '영어';

  // 코드 콘텐츠 (있으면 DB보다 우선)
  const lessonCode = material ? getLessonContent(material.id) : null;
  const conversationScript = lessonCode?.conversation || material?.conversation_script || null;

  // 시리즈 navigation
  const { prevLesson, nextLesson, seriesPosition } = useSeriesNeighbors(id, material?.title);

  // 한국어 설명: 코드 콘텐츠 → DB 캐시 → Gemini
  const [explanation, setExplanation] = useState(lessonCode?.explanation || material?.lesson_explanation_ko || null);
  const [loadingExpl, setLoadingExpl] = useState(false);

  useEffect(() => {
    if (!material) return;
    if (lessonCode?.explanation) {
      setExplanation(lessonCode.explanation);
      return;
    }
    if (material.lesson_explanation_ko) {
      setExplanation(material.lesson_explanation_ko);
      return;
    }
    setLoadingExpl(true);
    fetchOrGenerateExplanation(material).then(t => {
      setExplanation(t);
      setLoadingExpl(false);
    });
  }, [material?.id, material?.lesson_explanation_ko, lessonCode?.explanation]);

  // localStorage 영속 (사용자 입력)
  useEffect(() => {
    if (!id || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + id) || '{}');
      if (saved.userInput) setUserInput(saved.userInput);
      if (saved.feedback) setFeedback(saved.feedback);
      if (saved.aiExample) setAiExample(saved.aiExample);
    } catch {}
  }, [id]);

  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [aiExample, setAiExample] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);

  // STT (음성 입력)
  const [listening, setListening] = useState(false);
  const sttSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function startListening() {
    if (listening || !sttSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = langCode;
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(prev => (prev ? prev + ' ' : '') + transcript);
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    setListening(true);
    try { recog.start(); } catch { setListening(false); }
  }

  function persistState(updates) {
    if (!id || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + id) || '{}');
      localStorage.setItem(STORAGE_KEY + id, JSON.stringify({ ...saved, ...updates }));
    } catch {}
  }

  async function fetchAiExample() {
    if (!material) return;
    setLoadingExample(true);
    const prompt = `다음 ${targetLangKo} 학습 패턴의 새로운 예문 1개를 만들어주세요.

자료: ${material.title}
본문 일부: ${(material.raw_text || '').slice(0, 400)}

같은 패턴을 사용한 ${targetLangKo} 문장 1개와 한국어 번역을 출력하세요.

형식:
${targetLangKo}: [예문]
한국어: [번역]

도입·설명 문구 없이 바로.`;
    try {
      const raw = await callGemini(prompt);
      const text = (raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '').trim();
      setAiExample(text);
      persistState({ aiExample: text });
    } catch {
      toast?.('예시 생성 실패', 'error');
    }
    setLoadingExample(false);
  }

  async function checkUserSentence() {
    if (!userInput.trim() || !material) return;
    setLoadingFeedback(true);
    const prompt = `한국어 학습자가 다음 ${targetLangKo} 패턴으로 만든 문장을 평가해주세요.

학습 자료: ${material.title}
본문 예시:
${(material.raw_text || '').slice(0, 400)}

학습자 문장: "${userInput.trim()}"

아래 형식 정확히 따라, 200자 이내, 친화적 톤. 도입 문구 없이 바로:

**평가**
✅ / ⚠️ + 한 줄 평 (정확한지, 어색한지)

**고친 표현** (오류 있을 때만)
[자연스러운 ${targetLangKo} 문장]

**한 가지 팁**
한국어로 한 줄 (어휘·문법·어감)`;
    try {
      const raw = await callGemini(prompt);
      const text = (raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '').trim();
      setFeedback(text);
      persistState({ userInput, feedback: text });
    } catch {
      toast?.('피드백 받기 실패', 'error');
    }
    setLoadingFeedback(false);
  }

  function clearProductionState() {
    setUserInput('');
    setFeedback(null);
    setAiExample(null);
    persistState({ userInput: '', feedback: null, aiExample: null });
  }

  // 완료 처리 (기존 useReadingCompletion 재사용)
  const { generateQuiz, completionModal, setCompletionModal, quizState } = useViewerQuiz();
  const markCompleteMutation = useReadingCompletion({
    materialId: id, user, profile, fetchProfile,
    material, generateQuiz, celebrate, checkLevelUp,
    toast,
  });

  const { data: readingProgress } = useQuery({
    queryKey: ['reading-progress', user?.id, id],
    queryFn: async () => {
      const { data } = await supabase.from('reading_progress')
        .select('is_completed').eq('user_id', user.id).eq('material_id', id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  const isCompleted = readingProgress?.is_completed === true;

  if (isLoading) return <div className="page-container"><Spinner message="강의 로딩 중..." /></div>;
  if (!material) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
      <h2>강의를 찾을 수 없어요</h2>
      <Link href="/lessons" className="btn btn--primary">강의 목록으로</Link>
    </div>
  );

  // 시리즈 자료가 아니면 viewer로 redirect 안내
  if (!isLesson) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <h2>이 자료는 강의가 아닙니다</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>일반 자료는 자료실에서 보세요.</p>
        <Link href={`/viewer/${id}`} className="btn btn--primary">자료실 뷰어로</Link>
      </div>
    );
  }

  const titleDisplay = meta.display || material.title;

  return (
    <div className="page-container lesson-viewer" style={{ maxWidth: 720 }}>
      {/* 헤더 */}
      <header className="lesson-viewer__header">
        <Link href="/lessons" className="lesson-viewer__back">← 강의 목록</Link>
        <div className="lesson-viewer__nav">
          {prevLesson ? (
            <Link href={`/lessons/${prevLesson.id}`} className="viewer-series-nav__btn" title={prevLesson.title} aria-label="이전 강의">◀</Link>
          ) : <span className="viewer-series-nav__btn viewer-series-nav__btn--disabled" aria-hidden="true">◀</span>}
          {seriesPosition && (
            <span className="viewer-series-nav__position">{seriesPosition.current}/{seriesPosition.total}</span>
          )}
          {nextLesson ? (
            <Link href={`/lessons/${nextLesson.id}`} className="viewer-series-nav__btn" title={nextLesson.title} aria-label="다음 강의">▶</Link>
          ) : <span className="viewer-series-nav__btn viewer-series-nav__btn--disabled" aria-hidden="true">▶</span>}
        </div>
      </header>

      <h1 className="lesson-viewer__title">{titleDisplay}</h1>
      <div className="lesson-viewer__sub">{meta.level} {meta.series && `· ${meta.series}`}</div>

      {/* 카나 강의 — 표 먼저 */}
      {meta.series === '카나' && (
        <section className="lesson-section">
          <KanaChart variant={String(id) === '74' ? 'katakana' : 'hiragana'} />
        </section>
      )}

      {/* 정리 (예문 + 설명 통합) */}
      <section className="lesson-section">
        {loadingExpl && !explanation && !lessonCode?.sections ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            ⏳ 한국어 설명 생성 중...
          </div>
        ) : (lessonCode?.sections || explanation) ? (
          <LessonExplanation
            intro={lessonCode?.intro}
            sections={lessonCode?.sections}
            fallbackText={explanation}
            onJaClick={(ja) => ttsSupported && speak(ja, language)}
          />
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            설명을 가져올 수 없었어요. 잠시 후 다시 시도해 주세요.
          </div>
        )}
        {ttsSupported && (lessonCode?.sections || explanation) && (
          <p className="lesson-section__tip">💡 일본어 문장을 클릭하면 발음을 들을 수 있어요</p>
        )}
      </section>

      {/* 3. 실전 대화 */}
      {conversationScript && (
        <section className="lesson-section">
          <h2 className="lesson-section__title">💬 실전 대화</h2>
          <div className="lesson-conversation">
            {Array.isArray(conversationScript)
              ? conversationScript.map((turn, i) => (
                  <div
                    key={i}
                    className={`lesson-conversation__turn lesson-conversation__turn--${i % 2 === 0 ? 'a' : 'b'}`}
                    onClick={() => ttsSupported && speak(turn.ja, language)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="lesson-conversation__ja">{turn.ja}</div>
                    {turn.ko && <div className="lesson-conversation__ko">{turn.ko}</div>}
                  </div>
                ))
              : conversationScript.split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} className="lesson-body__gap" aria-hidden="true" />;
                  return (
                    <p key={i} className="lesson-body__line" onClick={() => ttsSupported && speak(line, language)}>
                      {line}
                    </p>
                  );
                })}
          </div>
        </section>
      )}

      {/* 4. 직접 만들기 */}
      <section className="lesson-section">
        <h2 className="lesson-section__title">✍️ 직접 만들기</h2>
        <div className="lesson-section__hint">
          이 패턴으로 {targetLangKo} 문장을 만들어 보세요. AI가 즉시 교정해 드려요.
        </div>

        <div className="lesson-production">
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder={`이 패턴으로 ${targetLangKo} 문장 1개`}
            className="lesson-production__input"
            rows={3}
            disabled={loadingFeedback}
          />
          <div className="lesson-production__actions">
            {sttSupported && (
              <button
                type="button"
                onClick={startListening}
                disabled={listening || loadingFeedback}
                className="btn btn--ghost btn--sm"
                title="음성 입력"
              >
                {listening ? '🔴 듣는 중' : '🎤 음성'}
              </button>
            )}
            <button
              type="button"
              onClick={fetchAiExample}
              disabled={loadingExample}
              className="btn btn--ghost btn--sm"
            >
              {loadingExample ? '⏳' : '💡 AI 예시 보기'}
            </button>
            <Button
              onClick={checkUserSentence}
              disabled={!userInput.trim() || loadingFeedback}
            >
              {loadingFeedback ? '⏳ 확인 중' : 'AI에게 확인'}
            </Button>
          </div>
        </div>

        {aiExample && (
          <div className="lesson-ai-example">
            <div className="lesson-ai-example__label">💡 AI 예시</div>
            <div className="lesson-ai-example__body">{aiExample}</div>
          </div>
        )}

        {feedback && (
          <div className="lesson-feedback">
            <div
              className="lesson-feedback__body"
              dangerouslySetInnerHTML={{ __html: formatDetail(feedback) }}
            />
            <div className="lesson-feedback__actions">
              <Button variant="ghost" size="sm" onClick={clearProductionState}>↺ 다시 만들기</Button>
            </div>
          </div>
        )}
      </section>

      {/* 완료 / 다음 액션 */}
      <div className="lesson-footer-actions">
        <Link href={`/viewer/${id}`} className="btn btn--ghost btn--sm">
          단어 분석 자세히 보기 →
        </Link>
        {!isCompleted ? (
          <Button onClick={() => markCompleteMutation.mutate()} disabled={markCompleteMutation.isPending}>
            {markCompleteMutation.isPending ? '⏳' : '✓ 강의 완료'}
          </Button>
        ) : (
          <span className="lesson-completed">✓ 완료됨</span>
        )}
      </div>

      {/* 다음 강의 카드 (완료 후) */}
      {isCompleted && nextLesson && (
        <Link href={`/lessons/${nextLesson.id}`} className="next-lesson-card" style={{ marginTop: 24 }}>
          <div className="next-lesson-card__hint">다음 강의</div>
          <div className="next-lesson-card__title">{nextLesson.title}</div>
        </Link>
      )}
    </div>
  );
}
