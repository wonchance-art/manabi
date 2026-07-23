'use client';

// 🗨️ NPC 도트 대화 오버레이 — 캔버스 위 HTML(공항 StoryOverlay 와 같은 관행).
//
// 재활용: GBC 다이얼로그 문법(gbcPanel/gbcButton)·후리가나 루비(JaText)·quest:scored 하트 연출은
//   공항 오버레이(StoryOverlay·QuestReview)와 그대로 공유한다. 다만 공항 AirportQuiz 는 독해
//   진도 기록(readingProgress)에 강결합돼 있어, NPC 대화는 진도와 무관한 자립 컴포넌트로 둔다.
//   판정은 순수 모듈(npcScripts.judgeType)로, 대화 데이터도 npcScripts.NPC_SCRIPTS 로 분리.
//
// 흐름: script.steps 를 한 스텝씩 진행. say/narr = 텍스트박스(A=다음·B=뜻 토글). ask = 정답 게이팅
//   (오답이면 근거 표시 후 재시도). omikuji = 뽑기 연출(균등 랜덤) + 凶이면 "묶고 가기" 리추얼.
//   마지막 스텝을 넘기면 onComplete() 후 완료 카드. 재대화 가능(보상 기록은 호출부에서 멱등 처리).
//
// 소프트락 방지(P1-1): GameCanvas 가 대화 중 이동을 잠그므로, 답을 모르는 사용자가 갇히지 않게
//   「나가기」 버튼을 모든 스텝(ask·omikuji 포함)에 항상 렌더한다. B(cancel)는 say 대사에선 뜻 토글,
//   그 외 스텝에선 대화 종료. 중도 이탈은 onComplete 미호출(스탬프 미지급 — 완주 조건 유지),
//   재진입하면 처음부터. 긴 오답 근거·凶 선택지는 패널 maxHeight+overflow 스크롤로 288px 화면을 지킨다.
//
// 스탬프 시맨틱(P2): 완주 스탬프는 보안성 없는 "방문 기념"이다 — /api/world/stamps 는 실존 노드+
//   본인만 검증하고 완주 여부는 검증하지 않는다(직접 POST 로 위조 가능). 학습 달성·보상으로 쓰려면
//   서버 검증 claim(마스터플랜 A-4 원칙)이 필요하다. UI 문구도 "기념 스탬프"로 통일한다.

import { useEffect, useMemo, useRef, useState } from 'react';
import { GBC, gbcPanel, gbcButton, gbcButtonPrimary } from './QuestReview';
import { JaText } from '../../views/refShared';
import bus from './bus';
import { getNpcScript, judgeType, drawOmikuji } from './npcScripts';

const WHO_LABEL = { me: '나' };

export default function NpcDialog({
  npcKey,
  npcName,
  actionRef,
  cancelRef,
  completionNote,
  onComplete,
  onExit,
}) {
  const script = useMemo(() => getNpcScript(npcKey), [npcKey]);
  const steps = script?.steps || [];

  const [idx, setIdx] = useState(0);
  const [showKo, setShowKo] = useState(false);
  const [typeInput, setTypeInput] = useState('');
  const [tries, setTries] = useState(0);          // 현재 ask 오답 횟수(>0 이면 근거 노출)
  const [omikuji, setOmikuji] = useState(null);   // 뽑은 결과 { grade, yomi, ko, line, isKyo? } | null
  const [omikujiRolling, setOmikujiRolling] = useState(false);
  const [rollFace, setRollFace] = useState('大吉'); // 뽑는 중 빠르게 바뀌는 등급 표시
  const [tiedKyo, setTiedKyo] = useState(false);  // 凶 리추얼(묶고 가기/그냥) 선택 완료
  const [done, setDone] = useState(false);
  const completedRef = useRef(false);             // onComplete 멱등(스탬프 1회)

  const step = steps[idx] || null;
  const isSpeech = step?.t === 'say';

  // 스텝 전환 시 문항별 임시 상태 초기화.
  useEffect(() => {
    setShowKo(false); setTypeInput(''); setTries(0);
    setOmikuji(null); setOmikujiRolling(false); setTiedKyo(false);
  }, [idx]);

  // 마지막 스텝을 넘기면 완주 — 스탬프 1회 + 완료 카드.
  function finish() {
    if (!completedRef.current) { completedRef.current = true; onComplete?.(); }
    setDone(true);
  }
  function goNext() {
    if (idx + 1 >= steps.length) finish();
    else setIdx((i) => i + 1);
  }

  // 선다 채점 — 정답이면 하트 연출 후 진행, 오답이면 근거(why) 노출·재시도.
  function pickChoice(choice) {
    const ok = !!choice.correct;
    bus.emit('quest:scored', { correct: ok });
    if (ok) goNext();
    else setTries((t) => t + 1);
  }
  // 타이핑 채점 — judgeType(순수). 오답이면 tries++.
  function submitType() {
    const ok = judgeType(typeInput, step.accept);
    bus.emit('quest:scored', { correct: ok });
    if (ok) goNext();
    else setTries((t) => t + 1);
  }

  // 오미쿠지 뽑기 — ~0.9초 등급 셔플 연출 후 균등 랜덤 확정(凶이면 리추얼 대기).
  function rollOmikuji() {
    if (omikujiRolling || omikuji) return;
    setOmikujiRolling(true);
    const faces = ['大吉', '吉', '中吉', '小吉', '末吉', '凶'];
    let n = 0;
    const spin = setInterval(() => {
      n += 1;
      setRollFace(faces[Math.floor(Math.random() * faces.length)]);
      if (n >= 12) {
        clearInterval(spin);
        const result = drawOmikuji();
        setOmikuji(result);
        setOmikujiRolling(false);
        bus.emit('quest:scored', { correct: true });
      }
    }, 75);
  }

  // ── 셸 A/B(하드웨어 버튼) 위임 ──
  // A: say/narr = 다음, 완료 카드 = 나가기. ask/omikuji 는 화면 버튼으로(오답 게이팅과 충돌 방지).
  // B: say 대사 = 한국어 뜻 토글, 그 외(narr·ask·omikuji·완료) = 대화 종료(P1-1 — B로 언제든 탈출).
  useEffect(() => {
    if (!actionRef) return undefined;
    actionRef.current = () => {
      if (done) { onExit?.(); return; }
      if (step && (step.t === 'say' || step.t === 'narr')) goNext();
    };
    return () => { if (actionRef) actionRef.current = null; };
  });
  useEffect(() => {
    if (!cancelRef) return undefined;
    cancelRef.current = () => {
      if (isSpeech && !done) { setShowKo((v) => !v); return; }
      onExit?.();
    };
    return () => { if (cancelRef) cancelRef.current = null; };
  });

  if (!script) return null;

  const speakerLabel = (who) => (who === 'me' ? WHO_LABEL.me : (npcName || script.label));

  // 「나가기」 — 모든 스텝(ask·omikuji 포함)에서 항상 보인다(P1-1 소프트락 방지).
  // B(cancel)가 나가기로 배선되는 스텝(say 대사 제외 — 거기선 B=뜻 토글)에서만 Ⓑ 를 병기한다.
  const header = (
    <button
      type="button" onClick={onExit} aria-label="대화 나가기"
      style={{ ...gbcButton, position: 'absolute', top: 6, right: 6, zIndex: 1, padding: '2px 8px', fontSize: '0.7rem', boxShadow: 'none', pointerEvents: 'auto' }}
    >
      {isSpeech && !done ? '나가기' : '나가기 Ⓑ'}
    </button>
  );

  // ask·omikuji 패널 공통 — 긴 오답 근거·凶 리추얼에도 288px 화면을 넘지 않게 스크롤(P1-1).
  const panelScroll = { maxHeight: '76%', overflowY: 'auto' };

  // ── 완료 카드 ──
  if (done) {
    return (
      <div style={overlayWrap}>
        {header}
        <div style={{ ...gbcPanel, margin: 8, padding: '14px 16px', textAlign: 'center', pointerEvents: 'auto' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{script.emoji} 🗾</div>
          <p style={{ fontSize: '0.86rem', fontWeight: 700, margin: '0 0 6px' }}>{script.reward}</p>
          {/* noStamp 도시 NPC는 스탬프 대신 수첩 만남 기록을 안내한다. */}
          <p style={{ fontSize: '0.68rem', color: GBC.inkSoft, margin: '0 0 4px' }}>
            {completionNote || '🗾 방문 기념 스탬프를 받았어요.'}
          </p>
          <button type="button" onClick={onExit} style={{ ...gbcButtonPrimary, marginTop: 4 }}>돌아가기 →</button>
        </div>
      </div>
    );
  }

  // ── say / narr 텍스트박스 ──
  if (step && (step.t === 'say' || step.t === 'narr')) {
    return (
      <div style={overlayWrap}>
        {header}
        {isSpeech && (
          <div style={{ margin: '0 8px -1px', alignSelf: 'flex-start' }}>
            <span style={{ ...gbcPanel, display: 'inline-block', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, borderBottom: 'none', borderRadius: '2px 2px 0 0' }}>
              {speakerLabel(step.who)}
            </span>
          </div>
        )}
        <div
          onClick={goNext} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goNext(); } }}
          style={{ ...gbcPanel, pointerEvents: 'auto', cursor: 'pointer', margin: 8, padding: '12px 14px 10px', minHeight: 74, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {isSpeech ? (
            <>
              <div lang="ja" style={{ fontSize: '1.05rem', lineHeight: 1.9 }}>
                <JaText ja={step.ja} yomi={step.yomi} fallbackPron={false} />
              </div>
              {showKo && <div style={{ fontSize: '0.8rem', color: GBC.brown }}>{step.ko}</div>}
              {step.narr && <div style={{ fontSize: '0.72rem', color: GBC.inkSoft, lineHeight: 1.5 }}>{step.narr}</div>}
            </>
          ) : (
            <div style={{ fontSize: '0.86rem', lineHeight: 1.6, color: GBC.ink }}>{step.text}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', fontSize: '0.62rem', color: GBC.inkSoft }}>
            <span>
              {isSpeech && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowKo((v) => !v); }}
                  style={{ ...gbcButton, padding: '1px 7px', fontSize: '0.62rem', boxShadow: 'none' }}
                >
                  {showKo ? '뜻 숨기기 Ⓑ' : '한국어 뜻 Ⓑ'}
                </button>
              )}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>{idx + 1}/{steps.length} · 다음 Ⓐ ▼</span>
          </div>
        </div>
      </div>
    );
  }

  // ── omikuji 뽑기 ──
  if (step && step.t === 'omikuji') {
    return (
      <div style={overlayGrid}>
        {header}
        <div style={{ ...gbcPanel, ...panelScroll, width: '100%', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>⛩️ おみくじ</div>
          {!omikuji ? (
            <>
              <div lang="ja" style={{ textAlign: 'center', fontSize: '2rem', lineHeight: 1.2, minHeight: 44, color: omikujiRolling ? GBC.ink : GBC.inkSoft }}>
                {omikujiRolling ? rollFace : '❓'}
              </div>
              <button type="button" onClick={rollOmikuji} disabled={omikujiRolling} style={{ ...gbcButtonPrimary, opacity: omikujiRolling ? 0.6 : 1 }}>
                {omikujiRolling ? '뽑는 중…' : '오미쿠지 뽑기'}
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <div lang="ja" style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 }}>{omikuji.grade}</div>
                <div style={{ fontSize: '0.72rem', color: GBC.inkSoft }}>{omikuji.yomi} · {omikuji.ko}</div>
              </div>
              <p style={{ fontSize: '0.78rem', lineHeight: 1.55, margin: 0 }}>{omikuji.line}</p>
              {omikuji.isKyo && !tiedKyo ? (
                <>
                  <div lang="ja" style={{ fontSize: '0.86rem', textAlign: 'center' }}>
                    <JaText ja="凶は 木に むすぶ。" yomi="きょうは きに むすぶ (쿄-와 키니 무스부)" fallbackPron={false} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button type="button" onClick={() => setTiedKyo(true)} style={{ ...gbcButtonPrimary }}>
                      나뭇가지에 묶고 가기 (結ぶ)
                    </button>
                    <button type="button" onClick={() => setTiedKyo(true)} style={{ ...gbcButton }}>
                      그냥 지니고 가기
                    </button>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: GBC.inkSoft, lineHeight: 1.5 }}>
                    나쁜 운은 경내 줄·나뭇가지에 묶어 두고 홀가분하게 나오는 리추얼이에요. 지니든 두고 가든 마음 편한 대로!
                  </div>
                </>
              ) : (
                <button type="button" onClick={goNext} style={{ ...gbcButtonPrimary }}>다음 →</button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── ask (choice / type) ──
  if (step && step.t === 'ask') {
    return (
      <div style={overlayGrid}>
        {header}
        <div style={{ ...gbcPanel, ...panelScroll, width: '100%', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{script.emoji} {npcName || script.label}</span>
            <span style={{ fontSize: '0.68rem', color: GBC.inkSoft }}>{step.mode === 'type' ? '빈칸 채우기' : '골라 말하기'} · {idx + 1}/{steps.length}</span>
          </div>
          <div style={{ fontSize: '0.82rem', lineHeight: 1.55 }}>{step.prompt}</div>

          {step.mode === 'choice' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {step.choices.map((c, i) => (
                <button
                  key={i} type="button" lang={c.ja ? 'ja' : undefined} onClick={() => pickChoice(c)}
                  style={{ ...gbcButton, textAlign: 'left', padding: '8px 10px' }}
                >
                  {c.ja ? <JaText ja={c.ja} yomi={c.yomi} fallbackPron={false} /> : c.text}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div lang="ja" style={{ fontSize: '0.95rem', lineHeight: 1.9, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                <span>{step.before}</span>
                <input
                  type="text" lang="ja" value={typeInput} inputMode="text"
                  onChange={(e) => setTypeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitType(); } }}
                  aria-label="빈칸에 들어갈 말"
                  style={{ width: '6em', textAlign: 'center', fontFamily: GBC.font, fontSize: '0.95rem', padding: '2px 4px', margin: '0 2px', border: `2px solid ${GBC.border}`, borderRadius: 2, background: GBC.creamHi, color: GBC.ink }}
                />
                <span>{step.after}</span>
              </div>
              {step.hint && <div style={{ fontSize: '0.66rem', color: GBC.inkSoft }}>힌트 — {step.hint}</div>}
              <button type="button" onClick={submitType} style={{ ...gbcButtonPrimary }}>제출</button>
            </>
          )}

          {tries > 0 && (
            <div style={{ background: GBC.creamHi, border: `2px solid ${GBC.creamShade}`, borderRadius: 2, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.72rem', color: GBC.red, fontWeight: 700, marginBottom: 4 }}>× 다시 — 시도 {tries}회</div>
              {step.why && <div style={{ fontSize: '0.72rem', color: GBC.inkSoft, lineHeight: 1.5 }}>{step.why}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const overlayWrap = {
  position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column',
  justifyContent: 'flex-end', pointerEvents: 'none',
};
const overlayGrid = {
  position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'end center',
  padding: 8, pointerEvents: 'auto',
};
