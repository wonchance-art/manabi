'use client';

import { useMemo, useRef, useState } from 'react';
import { JaText } from './refShared';
import { buildReadingEvents, accumulateAnswer } from '../lib/readingProgress';

/**
 * 독해 글 뷰어 + 문항 흐름 (신규 컴포넌트).
 * RefPatternCheck 는 80% 통과·3단계 구조라 재사용 불가(RT-11) — 셔플만 관행 참조.
 *
 * 문항 흐름 규칙(기획 §5·RT-14):
 * - pattern 문항 전부 정답이 통과 조건. content 문항은 출제하되 통과 판정에서 제외.
 * - 오답 시 근거(본문)로 스크롤·재독 후 재시도(무한). 시도 횟수(tries)를 기록한다.
 * - 이벤트 계약은 buildReadingEvents(readingProgress.js)가 단일 원천 — correct 는 최초 시도
 *   기준(재시도 횟수는 detail.tries), 미응답 content 는 발행하지 않는다.
 */

function shuffleWithAnswer(choices, answerIdx) {
  // 정답 문자열을 보존한 채 보기 순서만 섞는다(정답 인덱스는 셔플 후 재계산)
  const answer = choices[answerIdx];
  const arr = choices.map((c, i) => ({ c, i }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { choices: arr.map((x) => x.c), answer };
}

/**
 * 공용 문항 흐름 — 글·드릴 모두 사용.
 * questions: [{ key, qtype:'pattern'|'content', itemKey, prompt, contextJa?, choices, answerText, gating, why }]
 * onScrollToEvidence: 오답 시 근거로 스크롤(뷰어가 주입, 드릴은 없음)
 * onPass(events): 통과(모든 gating 정답) 시 1회 — review_events 페이로드 배열
 */
function QuestionFlow({ questions, textId, onScrollToEvidence, onPass, passLabel = '통과' }) {
  // 최초 1회 셔플 — 뷰어는 클라이언트 상태 진입 후에만 렌더되므로 하이드레이션 불일치 없음
  const shuffled = useMemo(() => {
    return questions.map((q) => {
      const s = shuffleWithAnswer(q.choices, q.choices.indexOf(q.answerText));
      return { ...q, choices: s.choices, answerText: s.answer };
    });
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [answers, setAnswers] = useState({}); // key → { picked, ok, tries, firstOk }
  const [passed, setPassed] = useState(false);
  const [saving, setSaving] = useState(false);      // onPass 대기 중("기록 중…") — 완료·이동 차단(P2-7)
  const [saveError, setSaveError] = useState(false); // 기록 실패 → 재시도 UI(P2-8)
  // 동기 잠금 — state 반영 전 재클릭이 이중 채점되지 않게 답안을 ref 로도 즉시 확정한다(P2-8).
  const answeringRef = useRef({}); // key → { picked, ok, tries, firstOk }(진실원)
  const savingRef = useRef(false); // onPass 중복 발화 동기 가드(state 반영 전 이중 클릭 차단)
  const eventsRef = useRef(null);  // 통과 시 조립한 이벤트 — 재시도가 같은 페이로드로 push 부터 재시도

  const gating = shuffled.filter((q) => q.gating);
  const allGatingOk = gating.length > 0 && gating.every((q) => answers[q.key]?.ok);

  function pick(q, opt) {
    const cur = answeringRef.current[q.key]; // state 아닌 ref 가 진실원 — 동기 이중 클릭 차단
    const ok = opt === q.answerText;
    // 게이팅·잠금·firstOk 규칙은 accumulateAnswer(단일 원천). null 이면 이번 클릭 무시.
    const next = accumulateAnswer(cur, { ok, gating: q.gating });
    if (!next) return;
    const rec = { ...next, picked: opt };
    answeringRef.current[q.key] = rec;                 // 동기 확정(다음 클릭이 즉시 본다)
    setAnswers((prev) => ({ ...prev, [q.key]: rec })); // 렌더 반영
    if (!ok && q.gating && onScrollToEvidence) onScrollToEvidence();
  }

  // onPass(원격 기록) 를 await — 성공 후에만 완료 화면으로, 실패면 재시도 UI 로 전환(P2-7·P2-8).
  async function runSave() {
    if (savingRef.current) return; // 동기 가드 — 저장 중 재클릭·중복 재시도 차단
    savingRef.current = true;
    setSaveError(false);
    setSaving(true);
    try {
      await onPass?.(eventsRef.current);
      setPassed(true); // 성공 뒤에만 완료 화면
    } catch {
      setSaveError(true); // 실패 — 재시도 버튼 노출(재-push)
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  function finish() {
    if (passed || savingRef.current) return; // 이미 통과했거나 저장 중이면 무시
    // 페이로드는 buildReadingEvents(단일 원천)가 조립 — lang:'Japanese' 고정,
    // correct=최초 시도(firstOk), 미응답(tries 0) content 는 이벤트 자체를 내지 않는다.
    // content 는 안정 문항 id(q.id)를 넘겨 글별 고유 item_key 로 집계된다(P3-11, index 는 폴백용).
    eventsRef.current = buildReadingEvents(
      textId,
      shuffled.map((q, idx) => {
        const a = answeringRef.current[q.key];
        return { itemKey: q.itemKey, id: q.id, qtype: q.qtype, firstOk: !!a?.firstOk, tries: a?.tries || 0, index: idx };
      })
    );
    runSave();
  }

  return (
    <div>
      <ol className="fr-quiz" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {shuffled.map((q, i) => {
          const a = answers[q.key];
          const locked = a?.ok || (!q.gating && !!a);
          return (
            <li key={q.key} className="fr-quiz__item">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                {i + 1}. {q.qtype === 'content' ? '내용 확인 (통과 판정 제외)' : '문형'}
              </div>
              {q.contextJa && (
                <div lang="ja" style={{ marginBottom: 6, fontSize: '1rem' }}>{q.contextJa}</div>
              )}
              <div className="fr-quiz__prompt" style={{ marginBottom: 8 }} lang="ja">{q.prompt}</div>
              <div className="fr-quiz__opts fr-quiz__opts--col">
                {q.choices.map((opt) => {
                  const isPicked = a?.picked === opt;
                  const cls = a
                    ? opt === q.answerText && (a.ok || locked)
                      ? 'is-correct'
                      : isPicked && !a.ok
                      ? 'is-wrong'
                      : locked
                      ? 'is-locked'
                      : ''
                    : '';
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`fr-quiz__opt ${cls}`}
                      onClick={() => pick(q, opt)}
                      disabled={locked}
                      lang="ja"
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {a && !a.ok && q.gating && (
                <div className="fr-quiz__answer" style={{ color: 'var(--danger)' }}>
                  × 다시 — {q.why || '본문을 다시 읽고 재도전하세요.'} (시도 {a.tries}회)
                </div>
              )}
              {a?.ok && (
                <div className="fr-quiz__answer">○ {q.why || '정답입니다.'}{a.tries > 1 ? ` (${a.tries}회 시도)` : ''}</div>
              )}
              {a && !a.ok && !q.gating && (
                <div className="fr-quiz__answer">정답: <span lang="ja">{q.answerText}</span></div>
              )}
            </li>
          );
        })}
      </ol>

      <div style={{ marginTop: 18 }}>
        {allGatingOk ? (
          passed ? (
            <div className="fr-check__verdict is-pass" style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)' }}>
              <strong>{passLabel} 완료</strong> — 문형 문항을 전부 맞혔어요.
            </div>
          ) : saving ? (
            // 원격 기록 대기 — 성공 전엔 완료 화면·다음 이동을 열지 않는다(P2-7)
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '12px 4px' }}>
              기록 중이에요…
            </div>
          ) : saveError ? (
            // 원격 upsert 실패({error}) — push 부터 다시 시도(P2-8)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--danger)', margin: 0 }}>
                기록에 실패했어요. 잠시 후 다시 시도해 주세요.
              </p>
              <button type="button" className="btn btn--primary btn--md" onClick={runSave}>
                다시 시도
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--md" onClick={finish}>
              {passLabel}하기 →
            </button>
          )
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            문형 문항을 모두 맞히면 {passLabel}돼요. 틀리면 본문을 다시 읽고 재도전하세요.
          </p>
        )}
      </div>
    </div>
  );
}

/** 신규 문형 사전 카드 팝오버 — bunkei explain·contrast·ex 이관분 표시 */
function PatternCard({ card, onClose }) {
  if (!card) return null;
  return (
    <div
      role="dialog"
      aria-label={`문형 ${card.pattern}`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, borderRadius: '16px 16px 0 0', padding: '18px 18px 26px', maxHeight: '78vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span lang="ja" style={{ fontSize: '1.15rem', fontWeight: 700 }}>{card.pattern}</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{card.ko}</span>
          <button type="button" className="chip" style={{ marginLeft: 'auto' }} onClick={onClose}>닫기</button>
        </div>
        {card.explain && (
          <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 10 }}>{card.explain}</p>
        )}
        {card.contrast && (
          <p style={{ fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: 10 }}>🇰🇷 {card.contrast}</p>
        )}
        {card.ex && (
          <div style={{ fontSize: '0.95rem', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <JaText ja={card.ex.ja} yomi={card.ex.yomi} />
            {card.ex.ko && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>{card.ex.ko}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 글 뷰어 — 문장별 어시스트 계층(원문 → 요미 → 한국어, 문장 단위 토글).
 * 상단 신규 문형 칩 → 사전 카드 팝오버. 읽기 후 "문제 풀기" → 문항 흐름.
 */
export default function ReadingTextView({ text, onPass, onBack }) {
  const [revealed, setRevealed] = useState({}); // 문장 index → 한국어 뜻 펼침 여부
  const [furigana, setFurigana] = useState(true); // 후리가나 루비 — 기본 표시(초심자 배려)
  const [card, setCard] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const bodyRef = useRef(null);

  const toggleKo = (i) => setRevealed((prev) => ({ ...prev, [i]: !prev[i] }));
  // narr 문단이 섞인 그레이디드 리더 형식인지 — ja 없는 body 항목이 하나라도 있으면 참
  const graded = (text.body || []).some((b) => b.narr != null);

  const questions = useMemo(() => {
    return (text.questions || []).map((q, i) => ({
      key: `${text.id}-q${i}`,
      id: q.id, // 안정 문항 id(n5-tokyo-NN-qK) — content item_key 고유화용(P3-11)
      qtype: q.type === 'pattern' ? 'pattern' : 'content',
      itemKey: q.type === 'pattern' ? q.pattern : 'content',
      prompt: q.q,
      choices: q.choices,
      answerText: q.choices[q.answer],
      gating: q.type === 'pattern',
      why: q.why || '',
    }));
  }, [text]);

  const placeName = typeof text.place === 'string' ? text.place : text.place?.ja || text.place?.name;

  return (
    <div>
      <button type="button" className="chip" onClick={onBack} style={{ marginBottom: 12 }}>← 목록</button>

      <header style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          글 {text.order} · {placeName} · {text.situation}
        </div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: 4 }} lang="ja">{text.title}</h1>
      </header>

      {/* 신규 문형 칩 — 탭 시 사전 카드 */}
      {(text.patternCards || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 6 }}>이 글의 신규 문형 — 탭하면 설명</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(text.patternCards || []).map((c) => (
              <button key={c.pattern} type="button" className="chip" lang="ja" onClick={() => setCard(c)}>
                {c.pattern}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 본문 — 이야기(한국어 내레이션) + 학습 문장(일본어 카드) */}
      <div ref={bodyRef} className="card" style={{ padding: '18px 16px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, flex: '1 1 180px' }}>
            {graded
              ? '일본어 문장을 탭하면 한국어 뜻이 열려요. 후리가나(요미)는 위 버튼으로 켜고 끌 수 있어요.'
              : '일본어 문장을 탭하면 한국어 뜻이 열려요.'}
          </div>
          <button
            type="button"
            className="chip"
            aria-pressed={furigana}
            onClick={() => setFurigana((v) => !v)}
            style={{ flex: '0 0 auto', opacity: furigana ? 1 : 0.55 }}
          >
            {furigana ? '가나 ON' : '가나 OFF'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(text.body || []).map((b, i) => {
            // 내레이션 문단 — 이야기용 세리프 본문 타이포
            if (b.narr != null) {
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: 'var(--font-serif, Georgia, "Nanum Myeongjo", "Apple SD Gothic Neo", serif)',
                    fontSize: '1.02rem',
                    lineHeight: 1.9,
                    color: 'var(--text-primary, var(--text-secondary))',
                    margin: '4px 0',
                    letterSpacing: '0.01em',
                  }}
                >
                  {b.narr}
                </p>
              );
            }
            // 학습 대상 일본어 문장 카드
            const open = !!revealed[i];
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => toggleKo(i)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleKo(i))}
                style={{
                  cursor: 'pointer',
                  background: 'var(--surface-2, rgba(127,127,127,0.06))',
                  borderLeft: '3px solid var(--accent, var(--brand, #6c7cff))',
                  borderRadius: '4px 8px 8px 4px',
                  padding: '11px 13px',
                }}
              >
                <div lang="ja" style={{ fontSize: '1.12rem', lineHeight: furigana ? 2.1 : 1.7 }}>
                  {furigana ? (
                    <JaText ja={b.ja} yomi={b.yomi} fallbackPron={false} />
                  ) : (
                    <span lang="ja">{b.ja}</span>
                  )}
                </div>
                {open ? (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 6 }}>{b.ko}</div>
                ) : (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>탭하면 한국어 뜻 ▾</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!quizOpen ? (
        <button type="button" className="btn btn--primary btn--md" onClick={() => setQuizOpen(true)}>
          문제 풀기 →
        </button>
      ) : (
        <section className="card" style={{ padding: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>문항</h2>
          <QuestionFlow
            questions={questions}
            textId={text.id}
            onScrollToEvidence={() => bodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onPass={onPass}
            passLabel="통과"
          />
        </section>
      )}

      <PatternCard card={card} onClose={() => setCard(null)} />
    </div>
  );
}

/**
 * 드릴 뷰 — 같은 문항 흐름의 간소판(items 전부 정답 = 통과).
 * 드릴 items: { q, ja?, choices, answer, why }
 */
export function ReadingDrillView({ drill, drillId, onPass, onBack }) {
  const [card, setCard] = useState(null);

  const questions = useMemo(() => {
    return (drill.items || []).map((it, i) => ({
      key: `${drillId}-i${i}`,
      qtype: 'pattern',
      itemKey: drillId,
      prompt: it.q,
      contextJa: it.ja || null,
      choices: it.choices,
      answerText: it.choices[it.answer],
      gating: true,
      why: it.why || '',
    }));
  }, [drill, drillId]);

  return (
    <div>
      <button type="button" className="chip" onClick={onBack} style={{ marginBottom: 12 }}>← 목록</button>
      <header style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>드릴</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{drill.title}</h1>
      </header>

      {(drill.patternCards || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(drill.patternCards || []).map((c) => (
            <button key={c.pattern} type="button" className="chip" lang="ja" onClick={() => setCard(c)}>
              {c.pattern}
            </button>
          ))}
        </div>
      )}

      <section className="card" style={{ padding: '16px' }}>
        <QuestionFlow questions={questions} textId={drillId} onPass={onPass} passLabel="통과" />
      </section>

      <PatternCard card={card} onClose={() => setCard(null)} />
    </div>
  );
}
