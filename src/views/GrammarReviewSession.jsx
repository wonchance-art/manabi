'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RefSpeak from '../components/RefSpeak';
import { JaText } from './refShared';
import { useAuth } from '../lib/AuthContext';
import { gradeGrammarReview, ratingFromScore } from '../lib/grammarSrs';
import { logReviewEvents } from '../lib/reviewEvents';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleDistinct(arr) {
  if (arr.length < 2) return [...arr];
  for (let tries = 0; tries < 5; tries++) {
    const s = shuffle(arr);
    if (s.some((v, i) => v !== arr[i])) return s;
  }
  return [...arr].reverse();
}

const RATING_LABEL = { 1: '다시', 2: '어려움', 3: '좋음', 4: '완벽' };

/** 예정일 라벨 — 오늘/내일/N일 후 */
function dueLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that - today) / (24 * 3600 * 1000));
  if (diff <= 0) return '오늘';
  if (diff === 1) return '내일';
  return `${diff}일 후`;
}

/** 예정 복습 목록 — 빈 상태·세션 종료 화면 공용 */
function UpcomingList({ upcoming }) {
  if (!upcoming?.length) return null;
  return (
    <div style={{ marginTop: 24, textAlign: 'left' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>
        다가오는 복습 {upcoming.length}개
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {upcoming.slice(0, 8).map((u, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
            borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', fontSize: '0.84rem',
          }}>
            <span aria-hidden="true">{u.flag}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.level} #{u.order} {u.title}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', flexShrink: 0 }}>{dueLabel(u.dueAt)}</span>
          </div>
        ))}
        {upcoming.length > 8 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '2px 12px' }}>
            외 {upcoming.length - 8}개…
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 문법 SRS 복습 세션 — due 챕터를 한 챕터씩 미니 퀴즈로 재확인하고
 * 정답률을 FSRS rating으로 바꿔 다음 복습일을 스케줄한다.
 * items: [{ srs, lang, langCode, langName, flag, title, order, level, href, quiz }]
 * upcoming: [{ flag, level, order, title, href, dueAt }] — 예정 복습(가시성)
 */
export default function GrammarReviewSession({ items, upcoming = [], signedOut = false }) {
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [orderPicks, setOrderPicks] = useState({});
  const [revealedP, setRevealedP] = useState({});
  const [results, setResults] = useState([]);      // [{ item, right, total, rating, nextDays }]

  useEffect(() => setMounted(true), []);

  const item = items[idx] || null;

  // 문항 구성 — 챕터 전환·마운트 시 셔플 (RefPatternCheck과 동일 패턴)
  const questions = useMemo(() => {
    if (!mounted || !item) return null;
    const qs = [];
    (item.quiz.meaning || []).forEach((m, i) =>
      qs.push({ id: `m${i}`, type: 'meaning', ...m, options: shuffle([m.correct, ...m.distractors.slice(0, 3)]) })
    );
    (item.quiz.apply || []).forEach((a, i) =>
      qs.push({ id: `a${i}`, type: 'order', ...a, bank: shuffleDistinct(a.tokens.map((t, ti) => ({ t, ti }))) })
    );
    (item.quiz.produce || []).forEach((p, i) =>
      qs.push({ id: `p${i}`, type: 'produce', ...p })
    );
    return qs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, idx]);

  const total = questions?.length ?? 0;
  const answeredCount = Object.keys(answers).length;
  const done = total > 0 && answeredCount === total;
  const rightCount = Object.values(answers).filter(a => a.ok).length;
  const graded = results.length > idx;             // 현재 챕터 채점 완료 여부

  // 챕터 완료 → FSRS 채점 + 이벤트 로그 (1회)
  useEffect(() => {
    if (!done || graded || !item) return;
    const rating = ratingFromScore(rightCount, total);
    let nextDays = null;
    if (user?.id) {
      gradeGrammarReview({ ...item.srs, user_id: user.id }, rating).then(updated => {
        if (updated) {
          const d = Math.max(1, Math.round(updated.interval));
          setResults(prev => prev.map((r, i) => (i === idx ? { ...r, nextDays: d } : r)));
        }
      });
      logReviewEvents(user.id, (questions || []).map(q => {
        const a = answers[q.id];
        if (!a) return null;
        return {
          lang: item.lang,
          source: 'grammar',
          item_key: `${item.srs.slug}#${q.id}`,
          correct: !!a.ok,
          detail: { stage: q.type, ko: q.ko, answer: q.correct ?? q.answer ?? q.main, picked: a.picked },
        };
      }).filter(Boolean));
    }
    setResults(prev => [...prev, { item, right: rightCount, total, rating, nextDays }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function nextChapter() {
    setAnswers({});
    setOrderPicks({});
    setRevealedP({});
    setIdx(i => i + 1);
  }

  function answerChoice(q, opt) {
    if (answers[q.id]) return;
    setAnswers(prev => ({ ...prev, [q.id]: { ok: opt === q.correct, picked: opt } }));
  }

  function pickToken(q, bankIdx) {
    if (answers[q.id]) return;
    setOrderPicks(prev => {
      const cur = prev[q.id] || [];
      if (cur.includes(bankIdx)) return prev;
      const nextPicks = [...cur, bankIdx];
      if (nextPicks.length === q.tokens.length) {
        const built = nextPicks.map(bi => q.bank[bi].t).join(' ');
        const answer = q.tokens.join(' ');
        setAnswers(a => ({ ...a, [q.id]: { ok: built === answer, picked: built } }));
      }
      return { ...prev, [q.id]: nextPicks };
    });
  }

  function unpickToken(q, pos) {
    if (answers[q.id]) return;
    setOrderPicks(prev => {
      const cur = prev[q.id] || [];
      return { ...prev, [q.id]: cur.filter((_, i) => i !== pos) };
    });
  }

  function gradeProduce(q, ok) {
    if (answers[q.id]) return;
    setAnswers(prev => ({ ...prev, [q.id]: { ok } }));
  }

  const renderMain = (text, pron, langCode) =>
    langCode === 'ja'
      ? <JaText ja={text} yomi={pron} />
      : <>{text}{pron && <span className="fr-check__pron"> {pron}</span>}</>;

  // ── 빈 상태 ──
  if (signedOut || items.length === 0) {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>문법 복습</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          {signedOut
            ? '로그인하면 통과한 문법 챕터가 며칠 뒤 자동으로 복습 큐에 돌아와요.'
            : '오늘 복습할 문법이 없어요. 강의에서 챕터의 패턴 체크를 통과하면 며칠 뒤 여기로 돌아옵니다.'}
        </p>
        <Link href={signedOut ? '/auth' : '/lessons'} className="btn btn--primary btn--md">
          {signedOut ? '로그인 →' : '강의 보러 가기 →'}
        </Link>
        {!signedOut && <UpcomingList upcoming={upcoming} />}
      </div>
    );
  }

  // ── 세션 종료 요약 ──
  if (idx >= items.length) {
    const totalRight = results.reduce((s, r) => s + r.right, 0);
    const totalQ = results.reduce((s, r) => s + r.total, 0);
    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '20px 0 6px' }}>복습 완료</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          챕터 {results.length}개 · 정답 {totalRight}/{totalQ}. 결과에 따라 다음 복습일이 조정됐어요.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {results.map((r, i) => (
            <Link key={i} href={r.item.href} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.1rem' }}>{r.item.flag}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 600 }}>#{r.item.order} {r.item.title}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {r.right}/{r.total} · {RATING_LABEL[r.rating]}
                  {r.nextDays ? ` · 다음 복습 ${r.nextDays}일 후` : ''}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>→</span>
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/home" className="btn btn--ghost btn--md">홈으로</Link>
          <Link href="/lessons" className="btn btn--primary btn--md">강의 계속하기 →</Link>
        </div>
        <UpcomingList upcoming={upcoming} />
      </div>
    );
  }

  // ── 챕터 복습 진행 ──
  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <header style={{ margin: '14px 0 18px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
          문법 복습 · 챕터 {idx + 1}/{items.length}
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4 }}>
          {item.flag} #{item.order} {item.title}
        </h1>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {item.langName} · {item.level} · 기억이 흐려지기 전에 다시 확인해요
        </div>
      </header>

      {!questions && <p className="fr-check__lead">문항 준비 중…</p>}

      {questions && (
        <ol className="fr-quiz">
          {questions.map(q => {
            const ans = answers[q.id];
            return (
              <li key={`${idx}:${q.id}`} className="fr-quiz__item">
                {q.type === 'meaning' && (
                  <div className="fr-quiz__q">
                    <div className="fr-quiz__prompt" lang={item.langCode}>{q.sentence}</div>
                    <div className="fr-quiz__sub">“{q.ko}”</div>
                    <div className="fr-quiz__opts fr-quiz__opts--grid">
                      {q.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`fr-quiz__opt ${ans ? (opt === q.correct ? 'is-correct' : opt === ans.picked ? 'is-wrong' : 'is-locked') : ''}`}
                          onClick={() => answerChoice(q, opt)}
                          disabled={!!ans}
                          lang={item.langCode}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {ans && (
                      <div className="fr-quiz__answer">
                        {ans.ok ? '○' : '×'}{' '}
                        <span lang={item.langCode}>{renderMain(q.full, q.pron, item.langCode)}</span>
                        <RefSpeak text={q.full} lang={item.lang} size="xs" />
                      </div>
                    )}
                  </div>
                )}

                {q.type === 'order' && (
                  <div className="fr-quiz__q">
                    <div className="fr-quiz__prompt">“{q.ko}”</div>
                    <div className={`fr-quiz__line ${ans ? (ans.ok ? 'is-correct' : 'is-wrong') : ''}`}>
                      {(orderPicks[q.id] || []).map((bi, pos) => (
                        <button
                          key={pos}
                          type="button"
                          className="fr-quiz__token is-picked"
                          onClick={() => unpickToken(q, pos)}
                          disabled={!!ans}
                          lang={item.langCode}
                        >
                          {q.bank[bi].t}
                        </button>
                      ))}
                      {(orderPicks[q.id] || []).length === 0 && <span className="fr-quiz__line-hint">단어를 순서대로 탭하세요</span>}
                    </div>
                    {!ans && (
                      <div className="fr-quiz__tokens">
                        {q.bank.map((tok, bi) => (
                          (orderPicks[q.id] || []).includes(bi) ? null : (
                            <button key={bi} type="button" className="fr-quiz__token" onClick={() => pickToken(q, bi)} lang={item.langCode}>
                              {tok.t}
                            </button>
                          )
                        ))}
                      </div>
                    )}
                    {ans && (
                      <div className="fr-quiz__answer">
                        {ans.ok ? '○' : '×'}{' '}
                        <span lang={item.langCode}>{renderMain(q.answer, q.pron, item.langCode)}</span>
                        <RefSpeak text={q.answer} lang={item.lang} size="xs" />
                      </div>
                    )}
                  </div>
                )}

                {q.type === 'produce' && (
                  <div className="fr-quiz__q">
                    <div className="fr-quiz__prompt">“{q.ko}”</div>
                    {!revealedP[q.id] ? (
                      <button
                        type="button"
                        className="fr-check__answer"
                        onClick={() => setRevealedP(prev => ({ ...prev, [q.id]: true }))}
                      >
                        <span className="fr-check__hidden">입으로 만든 뒤 — 정답 보기</span>
                      </button>
                    ) : (
                      <div className="fr-quiz__answer">
                        <span className="fr-check__main" lang={item.langCode}>{renderMain(q.main, q.pron, item.langCode)}</span>
                        <RefSpeak text={q.main} lang={item.lang} size="xs" />
                        {!ans && (
                          <span className="fr-check__grade" role="group" aria-label="자가 채점">
                            <button type="button" className="fr-check__grade-btn" onClick={() => gradeProduce(q, true)}>맞음</button>
                            <button type="button" className="fr-check__grade-btn" onClick={() => gradeProduce(q, false)}>틀림</button>
                          </span>
                        )}
                        {ans && <span className={`fr-quiz__mark ${ans.ok ? 'is-correct' : 'is-wrong'}`}>{ans.ok ? '○' : '×'}</span>}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {done && (
        <div className={`fr-check__verdict ${rightCount === total ? 'is-pass' : rightCount >= Math.ceil(total * 0.5) ? '' : 'is-fail'}`}>
          <p className="fr-check__result">
            <strong>{rightCount}/{total} — {RATING_LABEL[ratingFromScore(rightCount, total)]}</strong>
            {results[idx]?.nextDays
              ? <> · 다음 복습은 <strong>{results[idx].nextDays}일 후</strong>에 돌아와요.</>
              : ' · 결과에 따라 다음 복습일이 조정돼요.'}
            {rightCount < total && <> 헷갈렸다면 <Link href={item.href} style={{ textDecoration: 'underline' }}>챕터를 다시 열어</Link> 확인해 보세요.</>}
          </p>
          <div className="fr-check__verdict-actions">
            <button type="button" className="fr-check__next" onClick={nextChapter}>
              {idx + 1 < items.length ? `다음 챕터 (${idx + 2}/${items.length}) →` : '결과 보기 →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
