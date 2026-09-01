'use client';

/**
 * 빠른 분석 (#1077-12 파생, 목업 ④) — 붙여넣은 텍스트를 저장 없이 즉석 해부한다.
 * 서버는 /api/analyze 무저장 재사용(서버 변경 0) — 인증 필수·분당 20회·100줄×200자 캡을
 * 클라이언트가 같은 숫자로 미러링한다(quickPage.test.js가 route.js와 대조).
 * 토큰 렌더는 뷰어 정본 부품(splitRuby·pinyinToneClass·word-token CSS), 탭 사전은
 * PDF 뷰어 팝업 계약(fetchWordDetailText·formatDetail·TokenPosLabel)을 재사용한다.
 * 저장 경로는 하나 — [자료로 저장]이 초안을 sessionStorage로 추가 화면에 넘긴다.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { VOCAB_UPSERT, buildVocabRow } from '../lib/vocabIO';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { splitRuby } from '../lib/splitRuby';
import { pinyinToneClass } from '../lib/pinyinTone';
import { fetchWordDetailText } from '../lib/wordDetail';
import { formatDetail } from '../lib/wordDetailFormat';
import Button from '../components/Button';
import TokenPosLabel from './TokenPosLabel';

// 서버 캡 미러 — route.js의 MAX_LINES·MAX_LINE_LEN과 같은 값(계약 테스트로 핀).
const QUICK_MAX_LINES = 100;
const QUICK_MAX_LINE_LEN = 200;
// 서버 화이트리스트와 같은 언어 집합 — French는 /api/analyze가 받지 않는다.
const QUICK_LANGS = [
  ['Japanese', '일본어'],
  ['English', '영어'],
  ['Chinese', '중국어'],
];

const htmlLang = (language) =>
  language === 'Japanese' ? 'ja' : language === 'Chinese' ? 'zh' : 'en';

export default function QuickPage() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [language, setLanguage] = useState('Japanese');
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [resultLines, setResultLines] = useState(null); // [{ text, tokens: [token]|null }]
  const [wordDetail, setWordDetail] = useState(null); // { token, line, detail, loading }
  const [saving, setSaving] = useState({});

  async function handleAnalyze() {
    const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return;
    const truncated = rawLines.length > QUICK_MAX_LINES
      || rawLines.some((l) => l.length > QUICK_MAX_LINE_LEN);
    const lines = rawLines.slice(0, QUICK_MAX_LINES).map((l) => l.slice(0, QUICK_MAX_LINE_LEN));
    if (truncated) toast(`길어서 ${QUICK_MAX_LINES}줄·줄당 ${QUICK_MAX_LINE_LEN}자까지만 분석해요.`, 'info');

    setAnalyzing(true);
    setError('');
    setResultLines(null);
    setWordDetail(null);
    try {
      let authHeader = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
      } catch {}
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ lines, language }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `분석 서버 오류 (HTTP ${res.status})`);
      setResultLines(lines.map((lineText, i) => {
        const r = data?.results?.[i];
        if (!r?.sequence?.length) return { text: lineText, tokens: null }; // 미분석 줄 — 원문 그대로
        return {
          text: lineText,
          tokens: r.sequence.map((id) => r.dictionary[id]).filter((t) => t?.text?.trim()),
        };
      }));
    } catch (e) {
      setError(e?.message || '분석에 실패했어요.');
    } finally {
      setAnalyzing(false);
    }
  }

  // [자료로 저장] — 초안을 추가 화면으로 넘긴다. 저장 자체는 추가 화면의 기존 흐름 하나뿐.
  function handleSaveAsMaterial() {
    try {
      sessionStorage.setItem('manabi_quick_draft', JSON.stringify({ text, language }));
    } catch {}
    router.push('/materials/add?from=quick');
  }

  async function openWordDetail(token, line) {
    setWordDetail({ token, line, detail: null, loading: true });
    try {
      const detail = await fetchWordDetailText(token, language);
      setWordDetail((prev) => (prev?.token === token ? { ...prev, detail, loading: false } : prev));
    } catch {
      setWordDetail((prev) => (prev?.token === token
        ? { ...prev, detail: '설명을 가져올 수 없었어요.', loading: false } : prev));
    }
  }

  async function handleSaveWord(token, line) {
    if (!user) return;
    const key = token.base_form || token.text;
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      // PdfViewerPage와 같은 자리 — surface를 넣어 행이 갈리던 것을 정본으로 수렴.
      const { error: err } = await supabase.from('user_vocabulary').upsert(buildVocabRow({
        userId: user.id,
        surface: token.text,
        base: token.base_form,
        meaning: token.meaning,
        pos: token.pos,
        reading: token.furigana || token.reading,
        language,
        sourceSentence: line,
      }), VOCAB_UPSERT);
      if (err) throw err;
      setSaving((prev) => ({ ...prev, [key]: 'done' }));
      toast(`"${token.text}" 저장!`, 'success');
    } catch {
      toast('저장 실패', 'error');
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  const renderToken = (token, i, line) => {
    const rubySegments = token.furigana ? splitRuby(token.text, token.furigana) : null;
    return (
      <div key={i} className="word-token" role="button" tabIndex={0}
        onClick={() => openWordDetail(token, line)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openWordDetail(token, line))}>
        {rubySegments ? (
          <span className="surface">
            {rubySegments.map((seg, si) =>
              seg.kanji
                ? <ruby key={si} data-pinyin={seg.pinyin ? '1' : undefined}
                    data-yomi={seg.pinyin ? undefined : '1'}>
                    {seg.kanji}<span className={['rt-an', seg.pinyin ? pinyinToneClass(seg.reading) : ''].filter(Boolean).join(' ')}>{seg.reading}</span>
                  </ruby>
                : <span key={si}>{seg.plain}</span>
            )}
          </span>
        ) : (
          <span className="surface">{token.text}</span>
        )}
      </div>
    );
  };

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <div className="page-header">
        <h1 className="page-header__title">⚡ 빠른 분석</h1>
        <p className="page-header__subtitle">붙여넣으면 바로 해부해요 — 저장하지 않아요</p>
      </div>

      {!user ? (
        <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>빠른 분석은 로그인 후 쓸 수 있어요</p>
          <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            분석 서버가 로그인 사용자만 받아요 (남용 방지 정책).
          </p>
          <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기 →</Link>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
            <textarea
              className="form-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="분석할 텍스트를 붙여넣으세요"
              rows={5}
              lang={htmlLang(language)}
              style={{ width: '100%', resize: 'vertical', fontSize: '0.95rem', lineHeight: 1.7 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                {QUICK_LANGS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <span style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                한 번에 {QUICK_MAX_LINES}줄 · 줄당 {QUICK_MAX_LINE_LEN}자까지
              </span>
              <Button size="sm" onClick={handleAnalyze} disabled={!text.trim() || analyzing}>
                {analyzing ? '분석 중...' : '분석'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ padding: '14px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
              {error}{' '}
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleAnalyze}>다시 시도</button>
            </div>
          )}

          {resultLines && (
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                paddingBottom: 10, borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>저장 안 됨</span>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleSaveAsMaterial}>
                  자료로 저장
                </button>
              </div>
              <div lang={htmlLang(language)} style={{ fontSize: '1.05rem', lineHeight: 2.1 }}>
                {resultLines.map((lineRes, li) => (
                  <div key={li} style={{ marginBottom: 10 }}>
                    {lineRes.tokens
                      ? lineRes.tokens.map((t, ti) => renderToken(t, ti, lineRes.text))
                      : <span className="word-token--raw" title="이 줄은 분석하지 못했어요">{lineRes.text}</span>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                단어를 탭하면 뜻과 설명이 열려요
              </div>
            </div>
          )}
        </>
      )}

      {/* 탭 사전 — PDF 뷰어 팝업과 같은 부품·클래스 재사용 */}
      {wordDetail && (
        <>
          <div className="pdf-detail-overlay" onClick={() => setWordDetail(null)} />
          <div className="pdf-detail-popup">
            <div className="pdf-detail-popup__header">
              <div className="pdf-detail-popup__word">
                {wordDetail.token.furigana
                  ? <ruby>{wordDetail.token.text}<rt>{wordDetail.token.furigana}</rt></ruby>
                  : wordDetail.token.text}
              </div>
              <button className="pdf-detail-popup__close" onClick={() => setWordDetail(null)}>✕</button>
            </div>
            <div className="pdf-detail-popup__meta">
              <span className="pdf-detail-popup__pos"><TokenPosLabel token={wordDetail.token} /></span>
              {wordDetail.token.base_form && wordDetail.token.base_form !== wordDetail.token.text && (
                <span className="pdf-detail-popup__base">{wordDetail.token.base_form}</span>
              )}
              <span className="pdf-detail-popup__short">{wordDetail.token.meaning}</span>
            </div>
            <div className="pdf-detail-popup__body">
              {wordDetail.loading
                ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>상세 설명 생성 중...</div>
                : <div className="pdf-detail-popup__text" dangerouslySetInnerHTML={{ __html: formatDetail(wordDetail.detail) }} />}
            </div>
            {user && (() => {
              const key = wordDetail.token.base_form || wordDetail.token.text;
              const saved = saving[key] === 'done';
              return (
                <button className={`pdf-detail-popup__save ${saved ? 'pdf-detail-popup__save--done' : ''}`}
                  disabled={saved || !!saving[key]}
                  onClick={() => handleSaveWord(wordDetail.token, wordDetail.line)}>
                  {saved ? '✓ 저장됨' : saving[key] ? '저장 중...' : '단어장에 저장'}
                </button>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
