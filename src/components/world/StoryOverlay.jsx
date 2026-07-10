'use client';

// 🗨️ 월드 스토리 오버레이 — GBC 텍스트박스 + 인게임 문답(캔버스 위 HTML).
// 오너 결정: 포켓몬식 텍스트박스 연쇄로 이야기를 전달한다. Phaser 내 DOM 금지 규약에 따라
// 대사·문항은 캔버스 위 React 오버레이로 띄운다(QuestReview 관행 재사용).
//
// 두 컴포넌트:
//   · StoryTextbox — 화면 하단 고정 크림 패널. narr 청크/ja 대사를 한 박스씩. A/탭/스페이스=다음.
//     ja 대사는 후리가나 루비(JaText 재사용) + 한국어 뜻은 B(토글)로.
//   · AirportQuiz  — 심사관 출제(문형 4·내용 2). 문형 전부 정답 = 통과. 오답 시 해당 일본어
//     문장 재생 후 재시도(tries 기록). 채점마다 quest:scored, 완료 시 quest:done.

import { useEffect, useMemo, useRef, useState } from 'react';
import { GBC, gbcPanel, gbcButton, gbcButtonPrimary } from './QuestReview';
import { JaText } from '../../views/refShared';
// 이벤트 계약 단일 원천 — lang('Japanese')·최초 시도 correct·미응답 제외 규칙을 강제한다.
import { buildReadingEvents } from '../../lib/readingProgress';
import bus from './bus';

const SPEAKER_LABEL = { officer: '심사관', player: '민준', sign: '안내' };

// ── 하단 고정 텍스트박스 ──
// step: { kind:'narr', text } | { kind:'speech', speaker, ja, yomi, ko }
export function StoryTextbox({ step, index, total, showKo, onToggleKo, onNext, onExit }) {
  if (!step) return null;
  const isSpeech = step.kind === 'speech';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: 'none' }}>
      {/* 나가기 — 상단 우측(길게 누르는 B 대체 어포던스) */}
      <button
        type="button" onClick={onExit} aria-label="공항에서 나가기"
        style={{ ...gbcButton, position: 'absolute', top: 6, right: 6, padding: '2px 8px', fontSize: '0.7rem', boxShadow: 'none', pointerEvents: 'auto' }}
      >
        나가기
      </button>

      {/* 화자 이름표(대사일 때만) */}
      {isSpeech && (
        <div style={{ pointerEvents: 'none', margin: '0 8px -1px', alignSelf: 'flex-start' }}>
          <span style={{
            ...gbcPanel, display: 'inline-block', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
            borderBottom: 'none', borderRadius: '2px 2px 0 0',
          }}>
            {SPEAKER_LABEL[step.speaker] || '안내'}
          </span>
        </div>
      )}

      {/* 텍스트박스 본체 — 클릭/탭하면 다음 */}
      <div
        onClick={onNext} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNext(); } }}
        style={{
          ...gbcPanel, pointerEvents: 'auto', cursor: 'pointer',
          margin: 8, padding: '12px 14px 10px', minHeight: 74,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
      >
        {isSpeech ? (
          <>
            <div lang="ja" style={{ fontSize: '1.05rem', lineHeight: 1.9 }}>
              <JaText ja={step.ja} yomi={step.yomi} fallbackPron={false} />
            </div>
            {showKo && (
              <div style={{ fontSize: '0.8rem', color: GBC.brown }}>{step.ko}</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '0.86rem', lineHeight: 1.6, color: GBC.ink }}>{step.text}</div>
        )}

        {/* 하단 힌트 줄: 진행 + 조작 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', fontSize: '0.62rem', color: GBC.inkSoft }}>
          <span>
            {isSpeech && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleKo(); }}
                style={{ ...gbcButton, padding: '1px 7px', fontSize: '0.62rem', boxShadow: 'none' }}
              >
                {showKo ? '뜻 숨기기 Ⓑ' : '한국어 뜻 Ⓑ'}
              </button>
            )}
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>{index + 1}/{total} · 다음 Ⓐ ▼</span>
        </div>
      </div>
    </div>
  );
}

// 정답 보존 셔플(ReadingTextView 관행).
function shuffled(choices, answerIdx) {
  const answer = choices[answerIdx];
  const arr = choices.map((c) => c);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { choices: arr, answer };
}

// ── 심사관 문답(GBC 패널) ──
// text.questions 소비: pattern(게이팅) 전부 정답 = 통과, content는 출제하되 통과 판정 제외.
// onPass(events, right, total): 통과 1회 — 부모가 readingProgress·grammar·게이트 개방 처리.
export function AirportQuiz({ text, onPass, onExit }) {
  // 문항 셔플은 최초 1회.
  const qs = useMemo(() => (text.questions || []).map((q, i) => {
    const s = shuffled(q.choices, q.answer);
    return {
      key: `${text.id}-q${i}`,
      id: q.id,  // 안정 문항 id(n5-tokyo-NN-qK) — content item_key 고유화용(P3-11)
      index: i,  // id 부재 시 폴백 위치 — buildReadingEvents 가 textId#c<index> 로 조합
      qtype: q.type === 'pattern' ? 'pattern' : 'content',
      itemKey: q.type === 'pattern' ? q.pattern : 'content',
      gating: q.type === 'pattern',
      prompt: q.q,
      choices: s.choices,
      answerText: s.answer,
      why: q.why || '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);   // 이번 문항에서 고른 오답(재시도 텍스트박스 표시용)
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);      // onPass 대기 중("기록 중…") — 완료 화면 차단(P2-7)
  const [saveError, setSaveError] = useState(false); // 기록 실패 → 재시도 UI(P2-8)
  const resultsRef = useRef([]);  // 문항별 { itemKey, id, qtype, firstOk, tries, index } — 통과 시 buildReadingEvents 로 일괄 변환
  const rightRef = useRef(0);
  const totalRef = useRef(0);     // 통과 확정 시점 문항 수 — 재시도(재-push)가 같은 값으로 재발화
  const lockRef = useRef(false);    // 완료 후 영구 잠금
  const answeringRef = useRef(false); // 응답 처리 진입~다음 문항 전환까지 동기 잠금(P2-8)
  const passedRef = useRef(false);  // 마지막 문항 확정 멱등 — 2회째 무시
  const savingRef = useRef(false);  // savePass 중복 발화 동기 가드(재시도 포함)

  // 문항 뷰가 갱신되면(다음 문항 전환·재시도 피드백 렌더) 동기 잠금 해제 — 같은 tick 이중 클릭만 막는다
  useEffect(() => { answeringRef.current = false; }, [idx, picked, tries]);

  const q = qs[idx];

  // onPass(원격 기록) 를 await — 성공 후에만 통과(done) 화면, 실패면 재시도(재-push, P2-7·P2-8).
  async function savePass() {
    if (savingRef.current) return; // 동기 가드 — 저장 중 중복 재시도 차단
    savingRef.current = true;
    setSaveError(false);
    setSaving(true);
    try {
      await onPass?.(buildReadingEvents(text.id, resultsRef.current), rightRef.current, totalRef.current);
      setDone(true); // 성공 뒤에만 통과 화면
    } catch {
      setSaveError(true); // 실패 — 재시도 버튼 노출
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  function pick(opt) {
    if (!q || lockRef.current || answeringRef.current) return; // 동기 잠금 — state 반영 전 이중 클릭 차단
    answeringRef.current = true; // 응답 처리 진입 즉시 잠금(전환/피드백 렌더 시 위 effect 가 해제)
    const ok = opt === q.answerText;
    const nextTries = tries + 1;
    bus.emit('quest:scored', { correct: ok });

    if (!ok && q.gating) {
      // 오답 → 해당 일본어 문장(정답) 재생 후 재시도. tries 누적.
      setPicked(opt); setTries(nextTries);
      return;
    }

    // 정답(또는 content 첫 응답으로 확정) → 결과 누적 후 다음.
    // correct 는 최초 시도 기준 — 게이팅 재시도는 오답에서만 생기므로
    // nextTries>1 이면 최초 시도는 반드시 오답(firstOk=false)이다.
    // content 는 안정 문항 id(q.id)를 실어 글별 고유 item_key 로 집계된다(P3-11, index 는 폴백).
    resultsRef.current.push({ itemKey: q.itemKey, id: q.id, qtype: q.qtype, firstOk: nextTries === 1 && ok, tries: nextTries, index: q.index });
    if (ok) rightRef.current += 1; // 연출용 right/total 은 종전대로 확정 시점 정오(quest:done 표시 계약 유지)

    if (idx < qs.length - 1) {
      setIdx(idx + 1); setPicked(null); setTries(0);
    } else {
      lockRef.current = true;
      if (passedRef.current) return; // 멱등 — 마지막 문항 확정은 1회만
      passedRef.current = true;
      totalRef.current = qs.length;
      bus.emit('quest:done', { right: rightRef.current, total: totalRef.current }); // 펫 낙관 성장(연출)
      savePass(); // 원격 기록 대기 — 성공 후에만 done 화면(await 는 savePass 내부)
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'end center', padding: 8, pointerEvents: 'auto' }}>
      <div style={{ ...gbcPanel, width: '100%', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {done ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 0' }}>
            <span style={{ fontSize: '1.4rem' }}>🛂✅</span>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>통과 · 출구가 열렸어요</p>
            <p style={{ fontSize: '0.72rem', color: GBC.inkSoft, margin: 0, lineHeight: 1.5 }}>
              심사관이 도장을 찍었어요. 아래 출구로 나가면 광장으로 돌아가요.
            </p>
            <button type="button" onClick={onExit} style={{ ...gbcButtonPrimary, alignSelf: 'center', marginTop: 2 }}>
              출구로 →
            </button>
          </div>
        ) : saving ? (
          // 원격 기록 대기 — 성공 전엔 통과 화면·출구를 열지 않는다(P2-7)
          <div style={{ textAlign: 'center', padding: '10px 0', fontSize: '0.82rem', color: GBC.inkSoft }}>
            기록 중이에요…
          </div>
        ) : saveError ? (
          // 원격 upsert 실패({error}) — push 부터 다시 시도(P2-8)
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 0' }}>
            <p style={{ fontSize: '0.82rem', color: GBC.red, margin: 0, lineHeight: 1.5 }}>
              기록에 실패했어요. 다시 시도해 주세요.
            </p>
            <button type="button" onClick={savePass} style={{ ...gbcButtonPrimary, alignSelf: 'center' }}>
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>🛂 심사관</span>
              <span style={{ fontSize: '0.68rem', color: GBC.inkSoft }}>
                {q.qtype === 'content' ? '내용 확인' : '문형'} · {idx + 1}/{qs.length}
              </span>
            </div>

            <div lang="ja" style={{ fontSize: '0.86rem', lineHeight: 1.55 }}>{q.prompt}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.choices.map((opt) => {
                const isWrongPick = picked === opt;
                return (
                  <button
                    key={opt} type="button" lang="ja" onClick={() => pick(opt)}
                    style={{
                      ...gbcButton, textAlign: 'left',
                      background: isWrongPick ? GBC.red : GBC.creamHi,
                      color: isWrongPick ? GBC.creamHi : GBC.ink,
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* 오답 재시도 — 해당 일본어 정답 문장 재생 + 근거 */}
            {picked && (
              <div style={{ background: GBC.creamHi, border: `2px solid ${GBC.creamShade}`, borderRadius: 2, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.72rem', color: GBC.red, fontWeight: 700, marginBottom: 4 }}>× 다시 — 시도 {tries}회</div>
                <div lang="ja" style={{ fontSize: '0.9rem', marginBottom: 4 }}>{q.answerText}</div>
                {q.why && <div style={{ fontSize: '0.72rem', color: GBC.inkSoft, lineHeight: 1.5 }}>{q.why}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
