'use client';

// 🪧 학습 월드 — 인게임 즉석 리뷰 (표지판에 '말 걸기'로 열리는 다이얼로그).
// 오너 지시: "게임 통해 진행되는 건 게임 내에 띄워서" → /study 이탈 없이 캔버스 위에서 바로 복습한다.
//
// 데이터·채점 규약은 앱 본편과 동일해야 한다(신규 규약 금지):
//   · due 조회 : user_vocabulary에서 next_review_at <= now 상위 N개 (VocabPage/StudySessionPage 패턴)
//   · SRS 갱신 : fsrs.js의 calculateFSRS (srs.js는 죽은 코드 — 절대 사용 금지)
//                → user_vocabulary UPDATE { ...nextStats, last_reviewed_at }  (useVocabData.scoreMutation과 동일 페이로드)
//   · 척도     : 복습 화면 정본과 같은 4등급(SAVE_GRADES — 1 다시·2 어려움·3 알맞음·4 쉬움, W R3㉯ 동결 예외
//                #1077 5504406191: 월드 기능이 아니라 SRS 데이터 정합. 옛 틀/맞=1/3은 Easy가 없었다)
//   · undo     : 키 Ctrl/⌘+Z — R2 모델(SRS 5필드 복원 + source:'ui' 보상 이벤트). 버스 신호는 되돌리지 않는다
//   · 이벤트   : logReviewEvents { lang, source:'vocab', item_key, correct, detail:{ qtype:'flash', ... } }
//                플래시 자가채점은 '비대칭 신뢰' — qtype:'flash'로 기록해 rung이 성공을 크레딧 0으로 다룬다(기존 규약).
//                FSRS는 due(예정된 인출) 항목이므로 정당하게 갱신한다.
//   · 버스     : 채점마다 'quest:scored' {correct} · 완료 시 'quest:done' {right,total}  (GameCanvas 연출 + WorldPage 펫 성장)

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logReviewEvents } from '../../lib/reviewEvents';
import { detectLang, displayWord } from '../../lib/constants';
import { persistVocabGrade } from '../../lib/fsrs';
import { recordReviewCompleted } from '../../lib/learn/progressStore';
import { SAVE_GRADES } from '../../lib/vocabIO';
import bus from './bus';

const DUE_LIMIT = 8; // 즉석 리뷰 한 판(5~8문항)
// W R3㉯ undo가 복원하는 SRS 5필드 — persistVocabGrade 페이로드와 같은 snake_case
const QUEST_SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];

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

// 채점 저장은 fsrs.persistVocabGrade 정본으로 수렴 — 이 이름은 기존 테스트·호출 계약 유지용
export const persistQuestReviewGrade = persistVocabGrade;

export default function QuestReview({ userId, onClose }) {
  const [phase, setPhase] = useState('loading'); // loading | empty | active | done
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [right, setRight] = useState(0);
  const [gradeError, setGradeError] = useState('');
  const rightRef = useRef(0);   // quest:done의 정답 수 — 상태 클로저 지연 회피
  const gradingRef = useRef(false); // 채점 1회 잠금(더블탭 방지)
  const mountedRef = useRef(true);
  const lastGradeRef = useRef(null); // W R3㉯ undo 스냅샷(단일 레벨 — 다음 채점이 덮는다)

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
  const grade = async (rating) => {
    if (!current || gradingRef.current) return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 4) return;
    gradingRef.current = true;
    setGradeError('');

    const correct = rating > 1; // 정렬 뒤에도 correct = rating > 1 · qtype:'flash' 규약 불변(rung 비대칭 신뢰 승계)
    const lang = current.language || detectLang(current.word_text);
    // undo 스냅샷 — 채점 직전 5필드(select('*') 행 값 그대로) + 세션 상태. 저장 성공 뒤에만 유효화.
    lastGradeRef.current = null;
    const snapshot = {
      wordId: current.id, itemKey: current.word_text, word: current.word_text, lang, rating,
      prev: Object.fromEntries(QUEST_SRS_FIELDS.filter((k) => current[k] !== undefined).map((k) => [k, current[k]])),
      idx, right: rightRef.current,
    };

    // 1) FSRS 계산 — 기존 호출부와 동일(fsrs.js). due 항목이므로 정당한 예정 인출.
    let calculateFSRS;
    try {
      ({ calculateFSRS } = await import('../../lib/fsrs'));
    } catch {
      gradingRef.current = false;
      return;
    }
    const nextStats = calculateFSRS(rating, {
      interval: current.interval ?? 0,
      ease_factor: current.ease_factor ?? 0,
      repetitions: current.repetitions ?? 0,
      next_review_at: current.next_review_at,
    });
    // 2) 저장 — 복습 화면과 같은 한 길(recordReviewCompleted: 이벤트 + FSRS(fsrs 정본) + 보상 + 오프라인 큐,
    //    W 후속 ③). 이벤트는 qtype:'flash'(자가채점 = 비대칭 신뢰, rung 규약 준수). 저장(또는 큐 적재)
    //    성공이 확인된 뒤에만 점수·진행·완료 연출을 확정한다 — 시각은 정본이 한 번 찍고 돌려준다.
    let r;
    try {
      r = await recordReviewCompleted(userId, {
        type: 'vocab',
        itemKey: current.word_text,
        lang,
        correct,
        detail: { word_id: current.id, meaning: current.meaning, rating, mode: 'world', qtype: 'flash' },
      }, {
        interval: nextStats.interval ?? 0,
        ease_factor: nextStats.ease_factor ?? 0,
        repetitions: nextStats.repetitions ?? 0,
        next_review_at: nextStats.next_review_at,
      });
    } catch (err) {
      r = { ok: false, error: err };
    }
    if (!mountedRef.current) return;
    if (!r?.ok) {
      setGradeError('복습 결과를 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.');
      gradingRef.current = false;
      return;
    }
    lastGradeRef.current = { ...snapshot, reviewedAt: r.reviewedAt, queued: !!r.queued };

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

  // ── undo(W R3㉯) — SRS 5필드 복원 + 보상 이벤트 + 세션 되감기(idx·flipped·right·phase).
  // quest:scored / quest:done 버스 신호는 재방출도 취소도 하지 않는다 — 소비처가 연출·펫 재조회(읽기만)라
  // 되돌릴 쓰기가 없다. 펫 count의 원 이벤트 +1 잔류는 R2와 같은 종류(undo_of가 단서).
  const undoLast = async () => {
    const last = lastGradeRef.current;
    if (!last || gradingRef.current) return;
    lastGradeRef.current = null;
    setGradeError('');
    try {
      if (last.queued) {
        // 큐에 있던 채점은 아직 서버에 없다 — 큐 항목을 지우는 게 곧 undo(복습 화면 R2와 같은 잣대), 보상 이벤트 없음
        const { removeOutboxEntry } = await import('../../lib/reviewOutbox');
        await removeOutboxEntry({ userId, itemKey: last.itemKey, reviewedAt: last.reviewedAt });
      } else {
        const { last_reviewed_at: prevReviewedAt = null, ...prevStats } = last.prev;
        await persistQuestReviewGrade(supabase, last.wordId, prevStats, prevReviewedAt);
      }
      if (!mountedRef.current) return;
    } catch {
      if (!mountedRef.current) return;
      setGradeError('되돌리지 못했어요. 연결을 확인해 주세요.');
      return;
    }
    if (!last.queued) logReviewEvents(userId, [{
      lang: last.lang, source: 'ui', item_key: last.itemKey, correct: true,
      detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } },
    }]);
    rightRef.current = last.right;
    setRight(last.right);
    setIdx(last.idx);
    setFlipped(true);
    setPhase('active');
    gradingRef.current = false;
  };

  // ── 키 1~4·Ctrl/⌘+Z — 다이얼로그가 열려 있는 동안만(마운트 = 열림). 처리한 키는 전파를 끊어
  // 월드 캔버스(Phaser, window 리스너)와 경쟁하지 않는다. 입력 요소 안·조합키는 무시.
  const keysRef = useRef({});
  keysRef.current = { row: phase === 'active' && !!current && flipped, grade, undo: undoLast, canUndo: !!lastGradeRef.current && !gradingRef.current };
  useEffect(() => {
    function onKeyDown(e) {
      const t = e.target;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const h = keysRef.current;
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.altKey) {
        if (inField || !h.canUndo) return;
        e.preventDefault(); e.stopPropagation();
        h.undo?.();
        return;
      }
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!/^[1-4]$/.test(e.key) || !h.row) return;
      e.preventDefault(); e.stopPropagation();
      h.grade?.(Number(e.key));
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
            {gradeError && (
              <p role="alert" style={{ margin: 0, color: GBC.red, fontSize: '0.74rem', lineHeight: 1.5 }}>
                {gradeError}
              </p>
            )}
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
              // 4등급 정본(모양은 GBC, 값·순서는 SAVE_GRADES). 좁은 임베드에서는 2단 2열 — 값·순서 불변.
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {SAVE_GRADES.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => grade(g.grade)}
                    title={`${g.label} (키 ${g.key})`}
                    style={g.grade === 1
                      ? { ...gbcButton, background: GBC.red, color: GBC.creamHi, borderColor: GBC.border }
                      : g.grade >= 3 ? { ...gbcButtonPrimary } : { ...gbcButton }}
                  >
                    <span style={{ opacity: 0.7, fontSize: '0.7rem', marginRight: 6 }} aria-hidden="true">{g.key}</span>
                    {g.label}
                  </button>
                ))}
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
