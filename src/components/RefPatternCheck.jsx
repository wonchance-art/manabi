'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RefSpeak from './RefSpeak';
import { JaText } from '../views/refShared';
import { useAuth } from '../lib/AuthContext';
import { syncCheckRemote } from '../lib/refProgress';

/** 통과 기준 — 정답률 80% 이상 */
export function isPassed(result) {
  if (!result || !result.total) return false;
  if (typeof result.passed === 'boolean') return result.passed;
  return result.right >= Math.ceil(result.total * 0.8);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 셔플 결과가 원본과 같으면 한 번 더 (짧은 배열의 '이미 정답' 방지) */
function shuffleDistinct(arr) {
  if (arr.length < 2) return [...arr];
  for (let tries = 0; tries < 5; tries++) {
    const s = shuffle(arr);
    if (s.some((v, i) => v !== arr[i])) return s;
  }
  return [...arr].reverse();
}

const STAGE_META = {
  meaning: { num: '①', label: '뜻 고르기', hint: '패턴의 뜻을 고르세요' },
  apply:   { num: '②', label: '문장 만들기', hint: '한국어에 맞게 답하세요' },
  produce: { num: '③', label: '입으로 만들기', hint: '문장을 만든 뒤 확인하고 스스로 채점하세요' },
};

/**
 * 패턴 체크 v2 — 챕터 끝 3단계 퀴즈이자 통과 관문.
 * ① 뜻 고르기(객관식·자동 채점) ② 문장 만들기(어순 배열/번역 고르기·자동 채점)
 * ③ 입으로 만들기(회상·자가 채점). 정답률 80% 이상이면 통과로 기록하고 다음 챕터를 안내한다.
 * quiz: { meaning:[{pattern,correct,distractors}], apply:[{type:'order',tokens,answer,ko,pron}|{type:'choose',ko,correct,distractors,pron}], produce:[{ko,main,pron}] }
 */
export default function RefPatternCheck({ quiz, lang, langCode, storageKey, slug, next = null, reviewLinks = [] }) {
  const { user } = useAuth();
  const [seed, setSeed] = useState(0);          // 재도전 시 +1 → 보기 재셔플
  const [mounted, setMounted] = useState(false); // SSR 셔플 불일치 방지
  const [lastResult, setLastResult] = useState(null);
  const [answers, setAnswers] = useState({});    // id → { ok, picked? }
  const [orderPicks, setOrderPicks] = useState({}); // id → 선택한 토큰 인덱스 배열
  const [revealedP, setRevealedP] = useState({});   // 생산 문항 정답 공개

  useEffect(() => setMounted(true), []);

  // 지난 결과 불러오기
  useEffect(() => {
    if (!storageKey || !slug) return;
    try {
      const map = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (map[slug]) setLastResult(map[slug]);
    } catch {}
  }, [storageKey, slug]);

  // 문항 구성 — 마운트 후 셔플
  const questions = useMemo(() => {
    if (!mounted || !quiz) return null;
    const qs = [];
    (quiz.meaning || []).forEach((m, i) =>
      qs.push({ id: `m${i}`, stage: 'meaning', type: 'meaning', ...m, options: shuffle([m.correct, ...m.distractors.slice(0, 3)]) })
    );
    (quiz.apply || []).forEach((a, i) => {
      if (a.type === 'order') {
        qs.push({ id: `a${i}`, stage: 'apply', ...a, bank: shuffleDistinct(a.tokens.map((t, ti) => ({ t, ti }))) });
      } else {
        qs.push({ id: `a${i}`, stage: 'apply', ...a, options: shuffle([a.correct, ...a.distractors.slice(0, 3)]) });
      }
    });
    (quiz.produce || []).forEach((p, i) =>
      qs.push({ id: `p${i}`, stage: 'produce', type: 'produce', ...p })
    );
    return qs;
    // seed 변경 시 재셔플
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, quiz, seed]);

  const total = questions?.length ?? 0;
  if (!quiz || ((quiz.meaning?.length || 0) + (quiz.apply?.length || 0) + (quiz.produce?.length || 0)) === 0) return null;

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

  function retry() {
    setAnswers({});
    setOrderPicks({});
    setRevealedP({});
    setSeed(s => s + 1);
  }

  const answeredCount = Object.keys(answers).length;
  const done = total > 0 && answeredCount === total;
  const rightCount = Object.values(answers).filter(a => a.ok).length;
  const passNeed = Math.ceil(total * 0.8);
  const passedNow = done && rightCount >= passNeed;

  // 완료 → 결과 저장 (1회)
  useEffect(() => {
    if (!done || !storageKey || !slug) return;
    const result = { right: rightCount, total, at: Date.now(), passed: rightCount >= Math.ceil(total * 0.8) };
    try {
      const map = JSON.parse(localStorage.getItem(storageKey) || '{}');
      map[slug] = result;
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {}
    setLastResult(result);
    if (user?.id) syncCheckRemote(user.id, lang, slug, result);
    // done 전환 시 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const renderMain = (text, pron) =>
    langCode === 'ja'
      ? <JaText ja={text} yomi={pron} />
      : <>{text}{pron && <span className="fr-check__pron"> {pron}</span>}</>;

  let lastStage = null;

  return (
    <section className="card fr-section fr-check">
      <h2 className="fr-section__heading">
        패턴 체크
        {total > 0 && <span className="fr-check__count">{answeredCount}/{total}</span>}
      </h2>
      <p className="fr-check__lead">
        세 단계로 이 챕터를 확인해요. <strong>{passNeed > 0 ? `${passNeed}/${total}` : '80%'} 이상</strong>이면 통과!
        {lastResult && !done && (
          <span className="fr-check__last">
            {' '}· 지난 결과 {lastResult.right}/{lastResult.total} {isPassed(lastResult) ? '— 통과' : '— 재도전 추천'}
          </span>
        )}
      </p>

      {!questions && <p className="fr-check__lead">문항 준비 중…</p>}

      {questions && (
        <ol className="fr-quiz">
          {questions.map(q => {
            const showStage = q.stage !== lastStage;
            lastStage = q.stage;
            const ans = answers[q.id];
            const stage = STAGE_META[q.stage];
            return (
              <li key={`${seed}:${q.id}`} className="fr-quiz__item">
                {showStage && (
                  <div className="fr-quiz__stage">
                    <span className="fr-quiz__stage-num">{stage.num}</span> {stage.label}
                    <span className="fr-quiz__stage-hint">{stage.hint}</span>
                  </div>
                )}

                {/* ① 패턴 → 뜻 객관식 */}
                {q.type === 'meaning' && (
                  <div className="fr-quiz__q">
                    <div className="fr-quiz__prompt" lang={langCode}>{q.pattern}</div>
                    <div className="fr-quiz__opts">
                      {q.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`fr-quiz__opt ${ans ? (opt === q.correct ? 'is-correct' : opt === ans.picked ? 'is-wrong' : 'is-locked') : ''}`}
                          onClick={() => answerChoice(q, opt)}
                          disabled={!!ans}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ② 어순 배열 */}
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
                          lang={langCode}
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
                            <button key={bi} type="button" className="fr-quiz__token" onClick={() => pickToken(q, bi)} lang={langCode}>
                              {tok.t}
                            </button>
                          )
                        ))}
                      </div>
                    )}
                    {ans && (
                      <div className="fr-quiz__answer">
                        {ans.ok ? '○' : '×'}{' '}
                        <span lang={langCode}>{renderMain(q.answer, q.pron)}</span>
                        <RefSpeak text={q.answer} lang={lang} size="xs" />
                      </div>
                    )}
                  </div>
                )}

                {/* ② 번역 고르기 (어순 배열 불가 예문) */}
                {q.type === 'choose' && (
                  <div className="fr-quiz__q">
                    <div className="fr-quiz__prompt">“{q.ko}”</div>
                    <div className="fr-quiz__opts fr-quiz__opts--col">
                      {q.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`fr-quiz__opt ${ans ? (opt === q.correct ? 'is-correct' : opt === ans.picked ? 'is-wrong' : 'is-locked') : ''}`}
                          onClick={() => answerChoice(q, opt)}
                          disabled={!!ans}
                          lang={langCode}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {ans && <div className="fr-quiz__answer">{ans.ok ? '○ 정확해요' : <>× 정답: <span lang={langCode}>{q.correct}</span></>}<RefSpeak text={q.correct} lang={lang} size="xs" /></div>}
                  </div>
                )}

                {/* ③ 생산 — 회상 후 자가 채점 */}
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
                        <span className="fr-check__main" lang={langCode}>{renderMain(q.main, q.pron)}</span>
                        <RefSpeak text={q.main} lang={lang} size="xs" />
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
        <div className={`fr-check__verdict ${passedNow ? 'is-pass' : 'is-fail'}`}>
          <p className="fr-check__result">
            {passedNow ? (
              <><strong>통과 — {rightCount}/{total}</strong>. 이 챕터의 패턴이 손에 익었어요.</>
            ) : (
              <><strong>{rightCount}/{total}</strong> — 통과까지 {passNeed - rightCount}개. 틀린 패턴을 위 섹션에서 다시 본 뒤 재도전해보세요.</>
            )}
          </p>
          <div className="fr-check__verdict-actions">
            <button type="button" className="chip" onClick={retry}>다시 도전</button>
            {passedNow && next && (
              <Link href={next.href} className="fr-check__next">
                다음 챕터 · {next.title} →
              </Link>
            )}
            {passedNow && !next && (
              <span className="fr-check__last">마지막 챕터까지 마쳤습니다.</span>
            )}
          </div>
          {passedNow && reviewLinks.length > 0 && (
            <div className="fr-check__review">
              <span className="fr-check__review-label">복습으로 단단히 —</span>
              {reviewLinks.map(l => (
                <Link key={l.href} href={l.href} className="fr-check__review-link">{l.label}</Link>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
