'use client';

// 스토리 모듈 — '이야기로 확인'(챕터 안 독해 파일럿)의 인터랙티브 렌더러.
// ReferenceChapterPage(서버 컴포넌트)는 story(순수 직렬화 데이터)만 props 로 넘기고,
// 채점 상호작용은 이 클라이언트 경계에서 처리한다 — 서버 페이지가 콘텐츠 레지스트리 전체를
// 클라이언트 번들로 끌어오지 않도록(문법 페이지 First Load JS 회귀 방지) 별도 파일로 둔다.
// 채점 규약은 독해 뷰어·월드 오버레이와 같은 단일 원천(ReadingTextView 헬퍼)을 재사용한다.

import { useMemo, useState } from 'react';
import { JaText } from './refShared';
import RefSpeak from '../components/RefSpeak';
import { normalizeQuestion, shuffleOrderTiles, gradeOrder, checkFill, splitFill } from './ReadingTextView';

/**
 * body: 내레이션(narr)은 이야기 문단, 대사(ja)는 후리가나 토글 + ko 병기(챕터 예문 톤).
 * questions: order(타일 조립)·fill(타이핑)·produce(모범답 토글).
 * 챕터 퀴즈와 달리 로컬 확인용이라 채점 이벤트·SRS·통과 게이트를 발행하지 않는다.
 */
export default function StoryCheck({ story, slug, lang, langCode, meta }) {
  const [furigana, setFurigana] = useState(true);
  const [revealed, setRevealed] = useState({}); // 대사 index → ko 펼침
  const questions = useMemo(
    () => (story.questions || []).map((q, i) => normalizeQuestion(q, `${slug}-sq${i}`)),
    [story, slug]
  );

  return (
    <div className="fr-story">
      {/* ── 이야기 본문 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, flex: '1 1 180px' }}>
          이야기를 읽고, 아래에서 직접 만들어 보며 확인해요. 채점만 로컬로 하고 기록은 남기지 않아요.
        </div>
        <button
          type="button" className="chip" aria-pressed={furigana}
          onClick={() => setFurigana(v => !v)} style={{ flex: '0 0 auto', opacity: furigana ? 1 : 0.55 }}
        >
          {furigana ? '가나 ON' : '가나 OFF'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {(story.body || []).map((b, i) => {
          if (b.ja == null) {
            return (
              <p key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: '0.98rem', lineHeight: 1.9, color: 'var(--text-secondary)', margin: '2px 0', letterSpacing: '0.01em' }}>
                {b.narr}
              </p>
            );
          }
          const open = !!revealed[i];
          return (
            <div
              key={i} role="button" tabIndex={0} aria-expanded={open}
              onClick={() => setRevealed(p => ({ ...p, [i]: !p[i] }))}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setRevealed(p => ({ ...p, [i]: !p[i] })))}
              style={{ cursor: 'pointer', background: meta?.bg || 'var(--surface-2, rgba(127,127,127,0.06))', borderLeft: `3px solid ${meta?.color || 'var(--brand, #6c7cff)'}`, borderRadius: '4px 8px 8px 4px', padding: '11px 13px' }}
            >
              <div style={{ fontSize: '1.08rem', lineHeight: furigana ? 2 : 1.7 }}>
                {furigana ? <JaText ja={b.ja} yomi={b.yomi} fallbackPron={false} /> : <span lang={langCode}>{b.ja}</span>}
                <RefSpeak text={b.ja} lang={lang} size="xs" />
              </div>
              {open
                ? <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 6 }}>{b.ko}</div>
                : <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>탭하면 한국어 뜻 ▾</div>}
            </div>
          );
        })}
      </div>

      {/* ── 확인 문항(조립·타이핑·산출) ── */}
      <ol className="fr-quiz" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {questions.map(q => <StoryQuestion key={q.key} q={q} langCode={langCode} />)}
      </ol>
    </div>
  );
}

/** 스토리 문항 1개 — 로컬 채점(order/fill)·모범답 토글(produce). 게이트·이벤트 없음. */
function StoryQuestion({ q, langCode }) {
  const [picks, setPicks] = useState([]);        // order 조립 타일 인덱스(탭 순서)
  const [input, setInput] = useState('');        // fill 입력
  const [result, setResult] = useState(null);    // { ok, tries }
  const [produceInput, setProduceInput] = useState('');
  const [shown, setShown] = useState(false);     // produce 모범답 공개
  const tiles = useMemo(
    () => (q.qtype === 'order' ? shuffleOrderTiles(q.tiles, q.answerTiles, q.id || q.key) : []),
    [q]
  );

  const label =
    q.qtype === 'order' ? '문장 만들기'
    : q.qtype === 'fill' ? '빈칸 채우기'
    : q.qtype === 'produce' ? '문장 만들기 (모범답 확인)'
    : q.qtype === 'error' ? '콘텐츠 오류' : '문항';

  function tapTile(idx, inAssembled) {
    if (result?.ok) return;
    setPicks(cur => (inAssembled ? cur.filter(x => x !== idx) : [...cur, idx]));
  }
  function confirmOrder() {
    if (result?.ok || picks.length !== tiles.length) return;
    const ok = gradeOrder(picks.map(i => tiles[i]), q.answerTiles);
    setResult({ ok, tries: (result?.tries || 0) + 1 });
  }
  function submitFill() {
    if (result?.ok) return;
    const ok = checkFill(input, q.fillAnswer, q.accept);
    setResult({ ok, tries: (result?.tries || 0) + 1 });
  }

  return (
    <li className="fr-quiz__item">
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>

      {q.qtype === 'order' ? (() => {
        const assembled = picks.map(i => tiles[i]);
        const remaining = tiles.map((t, i) => i).filter(i => !picks.includes(i));
        const full = picks.length === tiles.length;
        return (
          <>
            <div className="fr-quiz__prompt" style={{ marginBottom: 8 }}>{q.prompt}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 44, padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm, 8px)', marginBottom: 8, background: 'var(--surface-2, rgba(127,127,127,0.06))' }}>
              {assembled.length === 0
                ? <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', alignSelf: 'center' }}>아래 타일을 순서대로 탭하세요</span>
                : picks.map((idx, pos) => (
                    <button key={`${idx}-${pos}`} type="button" lang="ja" disabled={result?.ok} className="chip" onClick={() => tapTile(idx, true)} style={{ fontSize: '1rem' }}>
                      {tiles[idx]}
                    </button>
                  ))}
            </div>
            {!result?.ok && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {remaining.map(idx => (
                  <button key={idx} type="button" lang="ja" className="chip" onClick={() => tapTile(idx, false)} style={{ fontSize: '1rem' }}>
                    {tiles[idx]}
                  </button>
                ))}
              </div>
            )}
            {!result?.ok && (
              <button type="button" className="btn btn--primary btn--sm" disabled={!full} onClick={confirmOrder}>확정</button>
            )}
          </>
        );
      })() : q.qtype === 'fill' ? (() => {
        const { before, after } = splitFill(q.ja);
        return (
          <>
            <div className="fr-quiz__prompt" style={{ marginBottom: 8 }}>{q.prompt}</div>
            <div lang="ja" style={{ fontSize: '1.05rem', lineHeight: 2, marginBottom: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
              <span>{before}</span>
              {result?.ok
                ? <span style={{ fontWeight: 700, color: 'var(--accent, #6c7cff)', margin: '0 2px' }}>{q.fillAnswer}</span>
                : <input type="text" lang="ja" value={input} inputMode="text"
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitFill(); } }}
                    aria-label="빈칸에 들어갈 말"
                    style={{ width: '6em', textAlign: 'center', fontSize: '1rem', padding: '2px 6px', margin: '0 2px', border: '1px solid var(--border)', borderRadius: 6 }} />}
              <span>{after}</span>
            </div>
            {!result?.ok && <button type="button" className="btn btn--primary btn--sm" onClick={submitFill}>제출</button>}
          </>
        );
      })() : q.qtype === 'produce' ? (
        <>
          <div className="fr-quiz__prompt" style={{ marginBottom: 6 }}>{q.prompt}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            직접 써 보거나 건너뛸 수 있어요. 채점하지 않아요.
          </div>
          {!shown ? (
            <>
              <textarea lang="ja" value={produceInput} rows={2}
                onChange={e => setProduceInput(e.target.value)}
                placeholder="여기에 일본어로 써 보세요(선택)"
                style={{ width: '100%', fontSize: '1rem', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setShown(true)}>모범답 보기</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {produceInput.trim() && (
                <div style={{ fontSize: '0.9rem' }} lang="ja">
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>내가 쓴 문장</span>
                  {produceInput}
                </div>
              )}
              {(q.model || []).length > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>모범답</span>
                  {q.model.map((m, mi) => <div key={mi} lang="ja" style={{ fontSize: '1rem', marginBottom: 2 }}>· {m}</div>)}
                </div>
              )}
              {q.guide && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{q.guide}</div>}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: '0.86rem', color: 'var(--danger)', lineHeight: 1.6 }}>
          ⚠ 이 문항은 콘텐츠 형식 오류로 표시할 수 없어요.
        </div>
      )}

      {result && !result.ok && (q.qtype === 'order' || q.qtype === 'fill') && (
        <div className="fr-quiz__answer" style={{ color: 'var(--danger)' }}>
          × 다시 — {q.why || '이야기를 다시 읽고 재도전하세요.'} (시도 {result.tries}회)
        </div>
      )}
      {result?.ok && (
        <div className="fr-quiz__answer">
          ○ {q.why || '정답입니다.'}{result.tries > 1 ? ` (${result.tries}회 시도)` : ''}
          {q.qtype === 'order' && q.ko && (
            <div style={{ marginTop: 4 }}>
              <span lang="ja" style={{ fontWeight: 700 }}>{(q.answerTiles || []).join('')}</span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{q.ko}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
