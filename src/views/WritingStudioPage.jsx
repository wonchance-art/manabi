'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Button from '../components/Button';
import { WRITING_LEVELS, topicsFor } from '../lib/writingPrompts';
import { logReviewEvents } from '../lib/reviewEvents';

const LANGS = [
  { key: 'Japanese', label: '일본어', flag: '🇯🇵' },
  { key: 'English', label: '영어', flag: '🇬🇧' },
  { key: 'French', label: '프랑스어', flag: '🇫🇷' },
  { key: 'Chinese', label: '중국어', flag: '🇨🇳' },
];
const LANG_CODE = { Japanese: 'ja', English: 'en', French: 'fr', Chinese: 'zh-Hans' };
const FIT_LABEL = { below: '레벨보다 쉬운 문장이에요 — 한 단계 도전해 봐요', fit: '레벨에 딱 맞는 작문이에요', above: '레벨 이상으로 도전했어요 — 훌륭해요' };

const scoreColor = s => (s >= 4 ? 'var(--accent)' : s === 3 ? 'var(--warning)' : 'var(--danger)');

/**
 * 라이팅 스튜디오 — 프롬프트(챕터 연동/주제/자유)를 고르고 학습 언어로 작문하면
 * AI가 한국인 학습자 관점의 rubric으로 첨삭한다. 결과는 writing_practice에 저장되고
 * 오류는 review_events(약점 진단의 데이터)로 적재된다.
 */
export default function WritingStudioPage({ recentChapters = [], signedOut = false }) {
  const { user, profile } = useAuth();

  const [language, setLanguage] = useState('Japanese');
  const [level, setLevel] = useState('N5');
  const [tab, setTab] = useState('free');          // 'chapter' | 'topic' | 'free'
  const [chapterSlug, setChapterSlug] = useState(null);
  const [topicSeed, setTopicSeed] = useState(0);
  const [topic, setTopic] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);      // 검증된 feedback

  // 언어 기본값 — 프로필 학습 언어 → localStorage 순
  useEffect(() => {
    try {
      const saved = localStorage.getItem('writing_lang');
      const fromProfile = Array.isArray(profile?.learning_language) ? profile.learning_language[0] : profile?.learning_language;
      const init = saved || fromProfile;
      if (init && WRITING_LEVELS[init]) setLanguage(init);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // 레벨 — 언어별 저장값 복원
  useEffect(() => {
    const levels = WRITING_LEVELS[language] || [];
    let next = levels[0];
    try {
      const saved = localStorage.getItem(`writing_level_${language}`);
      if (saved && levels.includes(saved)) next = saved;
    } catch {}
    setLevel(next);
  }, [language]);

  const langChapters = useMemo(
    () => recentChapters.filter(c => c.lang === language).slice(0, 3),
    [recentChapters, language]
  );

  // 챕터 탭인데 통과 챕터가 없으면 주제 탭으로
  useEffect(() => {
    if (tab === 'chapter' && langChapters.length === 0) setTab('topic');
    if (tab === 'chapter' && langChapters.length > 0 && !langChapters.some(c => c.slug === chapterSlug)) {
      setChapterSlug(langChapters[0].slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, language, langChapters.length]);

  // 주제 3개 노출 — '다른 주제' 버튼으로 로테이션
  const topicChoices = useMemo(() => {
    const all = topicsFor(language, level);
    const start = (topicSeed * 3) % all.length;
    return [0, 1, 2].map(i => all[(start + i) % all.length]);
  }, [language, level, topicSeed]);

  useEffect(() => {
    if (topic && !topicChoices.includes(topic)) setTopic(topicChoices[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicChoices]);

  const selectedChapter = langChapters.find(c => c.slug === chapterSlug) || null;
  const promptShown =
    tab === 'chapter' ? (selectedChapter ? `#${selectedChapter.order} ${selectedChapter.title}` : '') :
    tab === 'topic' ? (topic || topicChoices[0] || '') : '';

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let authHeader = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
      } catch {}

      const res = await fetch('/api/writing-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          language,
          level,
          text: trimmed,
          promptType: tab,
          prompt: promptShown,
          chapterSlug: tab === 'chapter' ? chapterSlug : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.feedback) {
        setError(data?.error?.message || '첨삭에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      const fb = data.feedback;
      setResult(fb);
      persist(trimmed, fb);
    } catch {
      setError('네트워크 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  /** 저장 + 오류 이벤트 적재 — 실패해도 첨삭 표시는 유지 */
  function persist(original, fb) {
    if (!user?.id) return;
    const allErrors = fb.sentences.flatMap(s => s.errors.map(e => ({ ...e, sentence: s.original })));
    const row = {
      user_id: user.id,
      sentence: original,
      corrected: fb.sentences.map(s => s.corrected).join('\n'),
      feedback: fb.summary,
      score: fb.score,
      language,
      prompt_type: tab,
      prompt: promptShown || null,
      level,
      chapter_slug: tab === 'chapter' ? chapterSlug : null,
      errors: allErrors,
    };
    supabase.from('writing_practice').insert(row).then(({ error: err }) => {
      // 신규 컬럼 미적용 환경 — 기본 컬럼만으로 재시도 (etym/hanja 폴백과 같은 패턴)
      if (err && /column|schema/i.test(err.message || '')) {
        const { prompt_type, prompt, level: lv, chapter_slug, errors, ...base } = row;
        supabase.from('writing_practice').insert(base).then(() => {}, () => {});
      }
    }, () => {});

    const events = allErrors.map(e => ({
      lang: language,
      source: 'writing',
      item_key: `${language}:${e.tag}`,
      correct: false,
      detail: { part: e.part, fix: e.fix, why: e.why, sentence: e.sentence },
    }));
    if (events.length === 0) {
      events.push({ lang: language, source: 'writing', item_key: `${language}:작문`, correct: true, detail: { score: fb.score } });
    }
    logReviewEvents(user.id, events);
  }

  function reset() {
    setResult(null);
    setText('');
    setError(null);
  }

  if (signedOut) {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>라이팅 스튜디오</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          로그인하면 배운 문법으로 작문하고 AI 첨삭을 받을 수 있어요.
        </p>
        <Link href="/auth" className="btn btn--primary btn--md">로그인 →</Link>
      </div>
    );
  }

  const lc = LANG_CODE[language];

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <header style={{ margin: '14px 0 18px' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>라이팅 스튜디오</h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          배운 문법으로 직접 써 보면 진짜 실력이 돼요. 1~5문장을 쓰면 AI가 한국인 학습자 눈높이로 첨삭해 드려요.
        </p>
      </header>

      {/* 언어·레벨 */}
      <div className="chip-group" style={{ marginBottom: 10 }}>
        {LANGS.map(l => (
          <button
            key={l.key}
            className={`chip ${language === l.key ? 'chip--active' : ''}`}
            onClick={() => { setLanguage(l.key); setResult(null); try { localStorage.setItem('writing_lang', l.key); } catch {} }}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>
      <div className="chip-group" style={{ marginBottom: 18 }}>
        {(WRITING_LEVELS[language] || []).map(lv => (
          <button
            key={lv}
            className={`chip ${level === lv ? 'chip--active' : ''}`}
            onClick={() => { setLevel(lv); try { localStorage.setItem(`writing_level_${language}`, lv); } catch {} }}
          >
            {lv}
          </button>
        ))}
      </div>

      {/* 프롬프트 선택 */}
      {!result && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
          <div className="chip-group" style={{ marginBottom: 12 }}>
            {[
              langChapters.length > 0 && { key: 'chapter', label: '배운 문법으로' },
              { key: 'topic', label: '오늘의 주제' },
              { key: 'free', label: '자유 작문' },
            ].filter(Boolean).map(t => (
              <button key={t.key} className={`chip ${tab === t.key ? 'chip--active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'chapter' && langChapters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {langChapters.map(c => (
                <button
                  key={c.slug}
                  onClick={() => setChapterSlug(c.slug)}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    border: `1px solid ${chapterSlug === c.slug ? 'var(--primary)' : 'var(--border)'}`,
                    background: chapterSlug === c.slug ? 'var(--primary-glow)' : 'transparent',
                    cursor: 'pointer', color: 'inherit',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600 }}>
                    {c.level} #{c.order} {c.title}
                  </span>
                  {c.patterns.length > 0 && (
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }} lang={lc}>
                      {c.patterns.map(p => p.pattern).join(' · ')}
                    </span>
                  )}
                </button>
              ))}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                이 챕터의 패턴을 써서 1~3문장을 만들어 보세요. 패턴을 썼는지도 함께 봐 드려요.
              </p>
            </div>
          )}

          {tab === 'topic' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topicChoices.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      border: `1px solid ${(topic || topicChoices[0]) === t ? 'var(--primary)' : 'var(--border)'}`,
                      background: (topic || topicChoices[0]) === t ? 'var(--primary-glow)' : 'transparent',
                      cursor: 'pointer', color: 'inherit', fontSize: '0.88rem',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button className="chip" style={{ marginTop: 8 }} onClick={() => setTopicSeed(s => s + 1)}>
                ↻ 다른 주제
              </button>
            </div>
          )}

          {tab === 'free' && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              쓰고 싶은 것을 자유롭게 — 오늘 있었던 일, 하고 싶은 말, 무엇이든 좋아요.
            </p>
          )}
        </div>
      )}

      {/* 작성 */}
      {!result && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
          <textarea
            className="form-input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`${LANGS.find(l => l.key === language)?.label}로 1~5문장을 써 보세요…`}
            rows={5}
            lang={lc}
            style={{ resize: 'vertical', fontSize: '1rem', lineHeight: 1.7 }}
            maxLength={600}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{text.trim().length}/600</span>
            <Button onClick={submit} disabled={loading || !text.trim()}>
              {loading ? '첨삭 중…' : '첨삭 받기'}
            </Button>
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {/* 첨삭 결과 */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{
                fontSize: '1.4rem', fontWeight: 800, color: scoreColor(result.score),
                border: `2px solid ${scoreColor(result.score)}`, borderRadius: '50%',
                width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{result.score}</span>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{promptShown || '자유 작문'} · {level}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{FIT_LABEL[result.levelFit]}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.92rem', lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
          </div>

          {result.sentences.map((s, i) => (
            <div key={i} className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '0.95rem', lineHeight: 1.7 }} lang={lc}>
                <span style={{ color: s.errors.length ? 'var(--text-muted)' : 'inherit', textDecoration: s.errors.length ? 'line-through' : 'none' }}>
                  {s.original}
                </span>
              </div>
              {s.original !== s.corrected && (
                <div style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.7, marginTop: 6, color: 'var(--accent)' }} lang={lc}>
                  {s.corrected}
                </div>
              )}
              {s.errors.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: 6 }}>○ 자연스러운 문장이에요</div>
              )}
              {s.errors.map((e, j) => (
                <div key={j} style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)', fontSize: '0.85rem', lineHeight: 1.6,
                }}>
                  <div>
                    <span lang={lc} style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>{e.part}</span>
                    {' → '}
                    <strong lang={lc} style={{ color: 'var(--accent)' }}>{e.fix}</strong>
                    <span className="chip" style={{ marginLeft: 8, fontSize: '0.72rem', padding: '2px 8px' }}>{e.tag}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{e.why}</div>
                </div>
              ))}
            </div>
          ))}

          {result.naturalness.length > 0 && (
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>💡 더 자연스럽게</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.naturalness.map((n, i) => (
                  <li key={i} style={{ fontSize: '0.88rem', lineHeight: 1.65 }}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={reset} style={{ flex: 1 }}>새 작문 쓰기</Button>
            {selectedChapter && tab === 'chapter' && (
              <Link href={selectedChapter.href} className="btn btn--ghost btn--md" style={{ flex: 1, textAlign: 'center' }}>
                챕터 다시 보기 →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
