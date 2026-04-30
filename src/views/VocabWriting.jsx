import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Button from '../components/Button';
import { callGemini, parseGeminiJSON } from '../lib/gemini';
import { detectLang } from '../lib/constants';
import { supabase } from '../lib/supabase';

const MAX_SENTENCE_LENGTH = 500;

export default function VocabWriting({ vocab, toast, awardXPOnSuccess, user }) {
  const [langFilter, setLangFilter] = useState('all');
  const [selectedWords, setSelectedWords] = useState([]);
  const [sentence, setSentence] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // 히스토리 로드
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('writing_practice')
      .select('id, sentence, score, corrected, translation, feedback, used_words, missed_words, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setHistory(data.map(d => ({
            id: d.id,
            sentence: d.sentence,
            result: {
              score: d.score,
              corrected: d.corrected,
              translation: d.translation,
              feedback: d.feedback,
              usedWordsCorrectly: d.used_words || [],
              missedWords: d.missed_words || [],
            },
            at: new Date(d.created_at),
          })));
        }
      });
  }, [user?.id]);

  const availableWords = useMemo(() => {
    const filtered = langFilter === 'all' ? vocab : vocab.filter(v => v.language === langFilter);
    // 복습 경험이 있는 단어 우선
    return [...filtered].sort((a, b) => (b.repetitions || 0) - (a.repetitions || 0)).slice(0, 30);
  }, [vocab, langFilter]);

  const toggleWord = (word) => {
    setSelectedWords(prev => {
      const exists = prev.find(w => w.id === word.id);
      if (exists) return prev.filter(w => w.id !== word.id);
      if (prev.length >= 5) {
        toast('최대 5개까지 선택할 수 있어요.', 'warning');
        return prev;
      }
      return [...prev, word];
    });
  };

  const suggestRandom = () => {
    const n = Math.min(3, availableWords.length);
    const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
    setSelectedWords(shuffled.slice(0, n));
    setSentence('');
    setFeedback(null);
  };

  const submitForFeedback = async () => {
    if (!sentence.trim()) { toast('문장을 작성해주세요.', 'warning'); return; }
    if (sentence.length > MAX_SENTENCE_LENGTH) {
      toast(`${MAX_SENTENCE_LENGTH}자 이내로 작성해주세요.`, 'warning');
      return;
    }
    if (selectedWords.length === 0) { toast('사용할 단어를 1개 이상 선택해주세요.', 'warning'); return; }

    setLoading(true);
    setFeedback(null);
    try {
      const lang = selectedWords[0].language || detectLang(selectedWords[0].word_text);
      const wordList = selectedWords.map(w => `${w.word_text}(${w.meaning})`).join(', ');
      const prompt = `학습자가 작성한 ${lang} 문장을 교정해주세요.

사용한 단어: ${wordList}
학습자의 문장: "${sentence.trim()}"

다음 JSON 형식으로 응답하세요 (다른 설명 없이 JSON만):
{
  "score": 0~100 사이 점수,
  "corrected": "자연스럽게 교정된 문장",
  "translation": "교정된 문장의 한국어 번역",
  "feedback": "구체적인 피드백 2-3문장 (잘한 점 + 개선점)",
  "usedWordsCorrectly": ["올바르게 쓴 단어 배열"],
  "missedWords": ["사용 안 했거나 잘못 쓴 단어 배열"]
}`;

      const raw = await callGemini(prompt);
      const rawParsed = parseGeminiJSON(raw);

      // 응답 필드 정규화 (Gemini가 스키마를 완벽히 지키지 않을 수 있음)
      const parsed = {
        score: (() => {
          const s = rawParsed.score;
          if (typeof s === 'number') return Math.max(0, Math.min(100, Math.round(s)));
          if (typeof s === 'string') {
            const n = parseInt(s, 10);
            return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
          }
          return null;
        })(),
        corrected: typeof rawParsed.corrected === 'string' ? rawParsed.corrected : '',
        translation: typeof rawParsed.translation === 'string' ? rawParsed.translation : '',
        feedback: typeof rawParsed.feedback === 'string' ? rawParsed.feedback : '',
        usedWordsCorrectly: Array.isArray(rawParsed.usedWordsCorrectly)
          ? rawParsed.usedWordsCorrectly.filter(w => typeof w === 'string')
          : [],
        missedWords: Array.isArray(rawParsed.missedWords)
          ? rawParsed.missedWords.filter(w => typeof w === 'string')
          : [],
      };

      // 최소 검증: score 또는 corrected가 있어야 의미 있음
      if (parsed.score === null && !parsed.corrected && !parsed.feedback) {
        throw new Error('AI 응답이 비어있어요. 다시 시도해 주세요.');
      }
      // score 추측이 안 되면 피드백 유무로 대략 판단
      if (parsed.score === null) {
        parsed.score = parsed.corrected && parsed.corrected !== sentence.trim() ? 60 : 75;
      }

      setFeedback(parsed);

      // DB 영속화
      if (user?.id) {
        const { data: saved } = await supabase.from('writing_practice').insert({
          user_id: user.id,
          sentence: sentence.trim(),
          score: parsed.score,
          corrected: parsed.corrected || null,
          translation: parsed.translation || null,
          feedback: parsed.feedback || null,
          used_words: parsed.usedWordsCorrectly,
          missed_words: parsed.missedWords,
          language: lang,
        }).select('id, created_at').single();
        setHistory(prev => [{
          id: saved?.id,
          sentence: sentence.trim(),
          result: parsed,
          at: saved?.created_at ? new Date(saved.created_at) : new Date(),
        }, ...prev.slice(0, 9)]);
      } else {
        setHistory(prev => [{ sentence: sentence.trim(), result: parsed, at: new Date() }, ...prev.slice(0, 9)]);
      }

      if (parsed.score >= 70 && awardXPOnSuccess) awardXPOnSuccess();
    } catch (err) {
      toast('AI 교정 실패: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSentence('');
    setFeedback(null);
  };

  const deleteHistoryItem = async (itemId) => {
    if (!itemId || !user?.id) return;
    const { error } = await supabase.from('writing_practice').delete().eq('id', itemId);
    if (error) { toast('삭제 실패: ' + error.message, 'error'); return; }
    setHistory(prev => prev.filter(h => h.id !== itemId));
  };

  if (vocab.length === 0) {
    return (
      <div className="card review-card review-card--center">
        <div className="review-card__emoji">✍️</div>
        <h2 style={{ marginBottom: 10 }}>아직 단어가 없어요</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
          자료를 읽으며 단어를 모은 뒤 쓰기 연습을 할 수 있어요.
        </p>
        <Link href="/materials" className="btn btn--primary btn--md">
          📰 자료 보러가기
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            사용할 단어 선택 <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({selectedWords.length}/5)</span>
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={langFilter} onChange={e => setLangFilter(e.target.value)} className="settings-select" style={{ fontSize: '0.8rem' }}>
              <option value="all">전체</option>
              <option value="Japanese">일본어</option>
              <option value="English">영어</option>
            </select>
            <Button variant="ghost" size="sm" onClick={suggestRandom}>🎲 랜덤 추천</Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
          {availableWords.map(w => {
            const selected = selectedWords.find(sw => sw.id === w.id);
            return (
              <button
                key={w.id}
                onClick={() => toggleWord(w)}
                style={{
                  padding: '6px 12px',
                  background: selected ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                  color: selected ? 'var(--primary)' : 'var(--text-primary)',
                  border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {w.word_text}
                <span style={{ fontSize: '0.72rem', marginLeft: 6, opacity: 0.7 }}>{w.meaning}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedWords.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            선택한 단어를 활용해 문장을 만들어 보세요:
          </div>
          <textarea
            value={sentence}
            onChange={e => setSentence(e.target.value)}
            placeholder="여기에 문장을 작성하세요..."
            maxLength={MAX_SENTENCE_LENGTH}
            aria-label="쓰기 연습 문장 입력"
            className="forum-textarea"
            style={{ minHeight: 100 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.75rem', color: sentence.length > MAX_SENTENCE_LENGTH ? 'var(--danger)' : 'var(--text-muted)' }}>
              {sentence.length}/{MAX_SENTENCE_LENGTH}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={reset}>초기화</Button>
              <Button onClick={submitForFeedback} disabled={loading || !sentence.trim()}>
                {loading ? '🤖 AI 교정 중...' : '✨ AI 교정 받기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="card" style={{ marginBottom: 16, border: `2px solid ${feedback.score >= 70 ? 'var(--accent)' : 'var(--warning)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>AI 피드백</h3>
            <span style={{
              padding: '4px 12px', borderRadius: 'var(--radius-full)',
              background: feedback.score >= 70 ? 'var(--primary-glow)' : 'rgba(255,180,0,0.15)',
              color: feedback.score >= 70 ? 'var(--accent)' : 'var(--warning)',
              fontSize: '0.85rem', fontWeight: 700,
            }}>
              {feedback.score}/100
            </span>
          </div>

          {feedback.corrected && (
            <div style={{ marginBottom: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>교정된 문장</div>
              <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>{feedback.corrected}</p>
              {feedback.translation && (
                <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  → {feedback.translation}
                </p>
              )}
            </div>
          )}

          {feedback.feedback && (
            <p style={{ margin: '0 0 12px', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
              💬 {feedback.feedback}
            </p>
          )}

          {(feedback.usedWordsCorrectly?.length > 0 || feedback.missedWords?.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.78rem' }}>
              {feedback.usedWordsCorrectly?.map(w => (
                <span key={`ok-${w}`} style={{
                  padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(74,138,92,0.15)', color: 'var(--accent)',
                }}>✓ {w}</span>
              ))}
              {feedback.missedWords?.map(w => (
                <span key={`x-${w}`} style={{
                  padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(255,107,107,0.12)', color: 'var(--danger)',
                }}>✗ {w}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>최근 기록</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map((h, i) => (
              <div key={h.id || i} style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {h.at.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} {h.at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontWeight: 700,
                      color: h.result.score >= 70 ? 'var(--accent)' : 'var(--warning)',
                    }}>{h.result.score}점</span>
                    {h.id && (
                      <button
                        onClick={() => deleteHistoryItem(h.id)}
                        title="삭제"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', fontSize: '0.9rem', padding: 2,
                        }}
                      >✕</button>
                    )}
                  </div>
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{h.sentence}</p>
                {h.result.corrected && h.result.corrected !== h.sentence && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--accent)' }}>
                    → {h.result.corrected}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
