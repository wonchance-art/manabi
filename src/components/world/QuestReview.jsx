'use client';

// 🪧 학습 월드 — 인게임 즉석 리뷰 (표지판에 '말 걸기'로 열리는 다이얼로그).
// 오너 지시: "게임 통해 진행되는 건 게임 내에 띄워서" → /study 이탈 없이 캔버스 위에서 바로 복습한다.
//
// 데이터·채점 규약은 앱 본편과 동일해야 한다(신규 규약 금지):
//   · due 조회 : user_vocabulary에서 next_review_at <= now 상위 N개 (VocabPage/StudySessionPage 패턴)
//   · SRS 갱신 : fsrs.js의 calculateFSRS (srs.js는 죽은 코드 — 절대 사용 금지)
//                → user_vocabulary UPDATE { ...nextStats, last_reviewed_at }  (useVocabData.scoreMutation과 동일 페이로드)
//   · 이벤트   : logReviewEvents { lang, source:'vocab', item_key, correct, detail:{ qtype:'flash', ... } }
//                플래시 자가채점은 '비대칭 신뢰' — qtype:'flash'로 기록해 rung이 성공을 크레딧 0으로 다룬다(기존 규약).
//                FSRS는 due(예정된 인출) 항목이므로 정당하게 갱신한다.
//   · 버스     : 채점마다 'quest:scored' {correct} · 완료 시 'quest:done' {right,total}  (GameCanvas 연출 + WorldPage 펫 성장)

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { calculateFSRS } from '../../lib/fsrs';
import { logReviewEvents } from '../../lib/reviewEvents';
import { detectLang, displayWord } from '../../lib/constants';
import bus from './bus';

const DUE_LIMIT = 8; // 즉석 리뷰 한 판(5~8문항)

// ── GBC 다이얼로그 문법 (월드 오버레이 공용 토큰) ──
// 하드 엣지 · 두꺼운 이중 보더(밝은 안/어두운 밖) · 크림 패널 · 모노스페이스 · 하드 오프셋 그림자.
export const GBC = {
  cream: '#f6edcf',
  creamHi: '#fffaf0',
  creamShade: '#e4d5a6',
  ink: '#2a2118',
  inkSoft: '#5a4b38',
  border: '#2a2118',
  brown: '#8a5a2b',
  green: '#5f9a46',
  greenInk: '#12290c',
  red: '#c14b38',
  // 도트 폰트(Galmuri9, OFL) 우선 — @font-face 는 WorldPage 가 galmuri9.css 로 로드한다.
  // 미로드 창에는 기존 모노스페이스로 폴백. 이 토큰이 월드 내 모든 대화창·게이트·팝오버에 퍼진다.
  font: '"Galmuri9", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  shadow: '4px 4px 0 rgba(42,33,24,0.35)',
};

export const gbcPanel = {
  background: GBC.cream,
  color: GBC.ink,
  border: `3px solid ${GBC.border}`,
  boxShadow: `inset 0 0 0 2px ${GBC.creamHi}, ${GBC.shadow}`,
  borderRadius: 2,
  fontFamily: GBC.font,
};

export const gbcButton = {
  fontFamily: GBC.font,
  fontWeight: 700,
  fontSize: '0.86rem',
  color: GBC.ink,
  background: GBC.creamHi,
  border: `2px solid ${GBC.border}`,
  borderRadius: 2,
  boxShadow: '2px 2px 0 rgba(42,33,24,0.30)',
  padding: '9px 14px',
  cursor: 'pointer',
  lineHeight: 1.2,
};

export const gbcButtonPrimary = {
  ...gbcButton,
  background: GBC.green,
  color: GBC.creamHi,
};

export default function QuestReview({ userId, onClose }) {
  const [phase, setPhase] = useState('loading'); // loading | empty | active | done
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [right, setRight] = useState(0);
  const rightRef = useRef(0);   // quest:done의 정답 수 — 상태 클로저 지연 회피
  const gradingRef = useRef(false); // 채점 1회 잠금(더블탭 방지)

  // ── due 어휘 조회 (마운트 1회) — next_review_at <= now 상위 N개 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { if (!cancelled) setPhase('empty'); return; }
      try {
        const { data, error } = await supabase
          .from('user_vocabulary')
          .select('*')
          .eq('user_id', userId)
          .lte('next_review_at', new Date().toISOString())
          .order('next_review_at', { ascending: true })
          .limit(DUE_LIMIT * 2); // 뜻 없는 카드를 걸러도 충분하도록 여유분
        if (cancelled) return;
        if (error) { setPhase('empty'); return; }
        const usable = (data || []).filter((w) => w.meaning && w.meaning.trim()).slice(0, DUE_LIMIT);
        if (usable.length === 0) { setPhase('empty'); return; }
        setItems(usable);
        setPhase('active');
      } catch {
        if (!cancelled) setPhase('empty');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const current = items[idx];

  // ── 채점 확정 — FSRS 갱신 + 이벤트 기록 + 버스 연출, 그리고 다음 문항/완료 ──
  const grade = (correct) => {
    if (!current || gradingRef.current) return;
    gradingRef.current = true;

    const rating = correct ? 3 : 1; // 맞았어요=Good / 틀렸어요=Again (기존 채점 규약)
    const lang = current.language || detectLang(current.word_text);

    // 1) FSRS — 기존 호출부와 동일(fsrs.js). due 항목이므로 정당한 예정 인출.
    const nextStats = calculateFSRS(rating, {
      interval: current.interval ?? 0,
      ease_factor: current.ease_factor ?? 0,
      repetitions: current.repetitions ?? 0,
      next_review_at: current.next_review_at,
    });
    // useVocabData.scoreMutation과 동일 페이로드 — fire-and-forget(학습 흐름 비차단).
    supabase
      .from('user_vocabulary')
      .update({ ...nextStats, last_reviewed_at: new Date().toISOString() })
      .eq('id', current.id)
      .then(() => {}, () => {});

    // 2) 이벤트 로그 — qtype:'flash'(자가채점 = 비대칭 신뢰, rung 규약 준수).
    logReviewEvents(userId, [{
      lang,
      source: 'vocab',
      item_key: current.word_text,
      correct,
      detail: { word_id: current.id, meaning: current.meaning, rating, mode: 'world', qtype: 'flash' },
    }]);

    // 3) 즉시 연출 신호.
    bus.emit('quest:scored', { correct });

    const nextRight = rightRef.current + (correct ? 1 : 0);
    rightRef.current = nextRight;
    setRight(nextRight);

    // 4) 다음 문항 or 완료.
    if (idx < items.length - 1) {
      setIdx((i) => i + 1);
      setFlipped(false);
      gradingRef.current = false;
    } else {
      setPhase('done');
      bus.emit('quest:done', { right: nextRight, total: items.length });
    }
  };

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 60,
        display: 'grid', placeItems: 'center', padding: 16,
        background: 'rgba(20,16,10,0.55)',
      }}
      // 오버레이가 포인터를 잡아 캔버스 탭-이동을 막는다(게임 입력 잠금의 일부).
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'active') onClose?.(); }}
    >
      <div style={{ ...gbcPanel, width: 'min(92%, 380px)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 헤더 — 제목 + 진행 + 나가기 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.02em' }}>🪧 즉석 복습</span>
          {phase === 'active' && (
            <span style={{ fontSize: '0.72rem', color: GBC.inkSoft }}>{idx + 1} / {items.length}</span>
          )}
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="닫기"
            style={{ ...gbcButton, padding: '2px 8px', fontSize: '0.9rem', boxShadow: 'none' }}
          >
            ✕
          </button>
        </div>

        {/* 로딩 */}
        {phase === 'loading' && (
          <p style={{ textAlign: 'center', padding: '18px 0', color: GBC.inkSoft, fontSize: '0.86rem' }}>
            불러오는 중…
          </p>
        )}

        {/* due 0개 폴백 */}
        {phase === 'empty' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
            <p style={{ fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
              지금은 복습할 게 없어요 — 내일 다시 와요
            </p>
            <p style={{ fontSize: '0.74rem', color: GBC.inkSoft, lineHeight: 1.5, margin: 0 }}>
              새 단어는 자료를 읽으며 모을 수 있어요(어휘 학습).
            </p>
            <button type="button" onClick={() => onClose?.()} style={{ ...gbcButtonPrimary, alignSelf: 'center', marginTop: 4 }}>
              닫기
            </button>
          </div>
        )}

        {/* 플래시 카드 */}
        {phase === 'active' && current && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              minHeight: 92, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              background: GBC.creamHi, border: `2px solid ${GBC.creamShade}`, borderRadius: 2,
              padding: '14px 12px',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', wordBreak: 'break-word' }}>
                {displayWord(current.word_text, current.pos)}
              </span>
              {flipped && (
                <>
                  {current.furigana && (
                    <span style={{ fontSize: '0.78rem', color: GBC.inkSoft }}>[{current.furigana}]</span>
                  )}
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: GBC.brown, textAlign: 'center' }}>
                    {current.meaning}
                  </span>
                </>
              )}
              {!flipped && (
                <span style={{ fontSize: '0.72rem', color: GBC.inkSoft }}>뜻을 떠올려 보세요</span>
              )}
            </div>

            {!flipped ? (
              <button type="button" onClick={() => setFlipped(true)} style={{ ...gbcButtonPrimary, width: '100%' }}>
                뒤집기
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => grade(false)}
                  style={{ ...gbcButton, flex: 1, background: GBC.red, color: GBC.creamHi, borderColor: GBC.border }}
                >
                  틀렸어요
                </button>
                <button
                  type="button"
                  onClick={() => grade(true)}
                  style={{ ...gbcButtonPrimary, flex: 1 }}
                >
                  맞았어요
                </button>
              </div>
            )}
          </div>
        )}

        {/* 완료 */}
        {phase === 'done' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
            <span style={{ fontSize: '1.6rem' }}>🎉</span>
            <p style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0 }}>
              복습 완료 · {right} / {items.length}
            </p>
            <p style={{ fontSize: '0.76rem', color: GBC.inkSoft, lineHeight: 1.5, margin: 0 }}>
              펫이 그 자리에서 자랐어요.
            </p>
            <button type="button" onClick={() => onClose?.()} style={{ ...gbcButtonPrimary, alignSelf: 'center', marginTop: 4 }}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
