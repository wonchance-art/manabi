'use client';

// 대화 모드 화면(v2-Z Z-R1 ③, CONVERSATION-V2Z-001 §5) — 뷰어 본문 자리에 대화 자료를 말풍선으로 편다.
//
// - 튜터 말풍선의 글은 뷰어와 같은 토큰 부품(ViewerPage renderToken)이다 — 병음·후리가나·단어 상태 색이 같고,
//   누르면 같은 v2-AE 단어창이 열리고, 저장은 같은 함수·같은 출처({kind:'reading', materialId, tokenId})다.
// - 튜터 말풍선(듣기에 넘기는 글)은 목표어 100%. 한국어 설명은 내 말 아래 피드백 창 하나로만 보인다.
//   피드백 창과 내 말풍선에는 토큰이 없고, 정답 줄(「이렇게 말해요」)은 토큰이다.
// - 번역은 받아 둔 번역(metadata.translations)이라 호출 0. 처음엔 닫혀 있다.
// - 말풍선은 분석이 붙은 완성본을 한 번만 그린다(기다리는 동안은 「입력 중」 점, 입력 칸은 열려 있다).
import { useEffect, useId, useRef, useState } from 'react';
import { conversationItems, openRetryOf, CONVERSATION_ERRORS, CONVERSATION_MAX_TURNS, countMyTurns } from '../../lib/conversation/turnModel';
import Link from 'next/link';
import { postConversationTurn, countConversationWords } from '../../lib/conversation/conversationClient';
import { newConversationHref } from '../../lib/conversation/newConversation';
import ConfirmModal from '../ConfirmModal';
import ConversationSummary from './ConversationSummary';
import { isImeComposing } from '../../lib/imeComposing';
import { bcp47ForLanguage } from '../../lib/speechLang';
import { langNameKo } from '../../lib/constants';
import OutputWordChips from '../OutputWordChips';
import './conversation.css';

/** 요청이 아직 이 화면(같은 자료·마지막 요청)의 것인가 — 옛 회화 패널 계약 그대로(자료를 바꾸면 늦은 응답을 버린다). */
export function isConversationRequestCurrent(requestRef, requestId, materialRef, materialId) {
  return requestRef.current === requestId && materialRef.current === materialId;
}

// Enter = 전송, Shift+Enter = 줄바꿈. IME 후보 확정 Enter는 조합 중이므로 보내지 않는다(#1381).
export function handleConversationKeyDown(e, send) {
  if (e.key !== 'Enter' || e.shiftKey || isImeComposing(e)) return;
  e.preventDefault();
  send();
}

/** 실패 응답 → 화면 문구. 내 말은 입력 칸에 남겨 둔다(다시 보내기). */
export function conversationErrorView(error) {
  if (error?.code === 'daily_limit') return { text: CONVERSATION_ERRORS.dailyLimit, blocked: true };
  if (error?.code === 'conversation_full') return { text: CONVERSATION_ERRORS.conversationFull, full: true };
  if (error?.status === 409) return { text: CONVERSATION_ERRORS.conflict, reload: true };
  if (error?.status === 0) return { text: '연결이 끊겼어요 · 다시 시도', retry: true };
  if (error?.status === 429) return { text: '요청이 너무 많아요 · 잠시 후 다시 시도', retry: true };
  return { text: `${CONVERSATION_ERRORS.noReply} · 다시 시도`, retry: true };
}

/** 내 말에서 짚은 곳(focus.from)에 물결 밑줄. */
function MyText({ text, focus }) {
  const at = focus?.from ? text.indexOf(focus.from) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="conv-wavy">{focus.from}</span>
      {text.slice(at + focus.from.length)}
    </>
  );
}

export default function ConversationThread({
  material, conversation, tokensByLine, renderToken, language, speak, ttsSupported,
  onTurnResult, onReload, onNewConversation, onRetryAnalysis, onDelete, analysisBusy = false, outputWords = [],
}) {
  const materialId = material?.id;
  const rawLines = (material?.raw_text || '').split('\n');
  const translations = material?.processed_json?.metadata?.translations || {};
  const items = conversationItems(conversation);
  const open = openRetryOf(conversation.turns);
  const full = countMyTurns(conversation.turns) >= CONVERSATION_MAX_TURNS;
  const langKo = langNameKo(language);
  const listId = useId();
  // 오늘 복습한 말 — 대화에서 쓰면 ✓. 표시만이고 review_events·FSRS에는 쓰지 않는다(v2 헌법 M7).
  const myTexts = (conversation.turns || []).filter((t) => t.who === 'me').map((t) => t.text || '');
  const usedWordSet = new Set(outputWords.filter((w) => myTexts.some((t) => t.includes(w.word_text))).map((w) => w.word_text));

  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState('text');
  const [pending, setPending] = useState(null); // { text } — 서버가 아직 기록하지 않은 내 말
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openTx, setOpenTx] = useState(() => new Set());
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { words: number|null } — 지우기 확인창
  const [deleting, setDeleting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shadow, setShadow] = useState(null); // { index, heard, listening } — [따라 말해 보기](채점 없음)
  const requestRef = useRef(0);
  const materialRef = useRef(materialId);
  const recognitionRef = useRef(null);
  const endRef = useRef(null);
  materialRef.current = materialId;

  useEffect(() => {
    setSttSupported(typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      requestRef.current += 1;
      try { recognitionRef.current?.abort?.(); } catch { /* 이미 끝남 */ }
    };
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    setPending(null); setLoading(false); setError(null); setInput(''); setInputMode('text');
  }, [materialId]);

  const turnCount = conversation.turnCount || 0;
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [turnCount, loading]);

  async function send({ action = null, retryText = null } = {}) {
    const text = action ? '' : (retryText ?? input).trim();
    if ((!action && !text) || loading || full) return;
    const requestId = ++requestRef.current;
    const requestMaterialId = materialId;
    const mode = retryText != null ? pending?.inputMode || 'text' : inputMode;
    if (!action) { setPending({ text, inputMode: mode }); setInput(''); setInputMode('text'); }
    setLoading(true); setError(null);
    try {
      const body = await postConversationTurn({
        materialId: String(materialId), expectedTurn: turnCount, outputWords: outputWords.map((w) => w.word_text),
        ...(action ? { action } : { text, inputMode: mode }),
      });
      if (!isConversationRequestCurrent(requestRef, requestId, materialRef, requestMaterialId)) return;
      setPending(null);
      onTurnResult(body);
    } catch (cause) {
      if (cause?.name === 'AbortError') return;
      if (!isConversationRequestCurrent(requestRef, requestId, materialRef, requestMaterialId)) return;
      const view = conversationErrorView(cause);
      setError(view);
      if (view.reload) {
        // 다른 탭이 먼저 이어 썼다 — 최신 대화를 다시 불러오고, 내 말은 입력 칸으로 되돌린다(턴 유실 0).
        if (text) setInput(text);
        setPending(null);
        onReload?.();
      }
    } finally {
      if (isConversationRequestCurrent(requestRef, requestId, materialRef, requestMaterialId)) setLoading(false);
    }
  }

  function startListening() {
    if (listening || !sttSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    const recognitionMaterialId = materialId;
    recog.lang = bcp47ForLanguage(language);
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (event) => {
      if (recognitionRef.current !== recog || materialRef.current !== recognitionMaterialId) return;
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ` : '') + transcript);
      setInputMode('voice'); // 인식기가 받아 적은 말 — 동음·글자 차이는 짚지 않는다(서버 규칙)
    };
    const end = () => {
      if (recognitionRef.current !== recog) return;
      recognitionRef.current = null;
      setListening(false);
    };
    recog.onend = end;
    recog.onerror = end;
    recognitionRef.current = recog;
    setListening(true);
    try { recog.start(); } catch { end(); }
  }

  function stopListening() {
    try { recognitionRef.current?.stop(); } catch { /* 이미 끝남 */ }
    setListening(false);
  }

  // [따라 말해 보기] — 정답 문장을 들은 뒤 내 입으로 말해 본다. 받아 적은 말만 보여 주고 채점하지 않는다(시안 · 하지 않는 것: 발음 채점).
  function startShadow(index) {
    if (!sttSupported || shadow?.listening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = bcp47ForLanguage(language);
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (event) => setShadow({ index, heard: event.results[0][0].transcript, listening: false });
    const end = () => setShadow((prev) => (prev?.index === index ? { ...prev, listening: false } : prev));
    recog.onend = end;
    recog.onerror = end;
    setShadow({ index, heard: '', listening: true });
    try { recog.start(); } catch { end(); }
  }

  const lineView = (line) => {
    const ids = tokensByLine.get(line);
    const analyzed = ids?.length && ids.every((id) => !material.processed_json.dictionary[id]?.failed);
    return analyzed ? ids.map((id) => renderToken(id)) : <span className="word-token--raw">{rawLines[line]}</span>;
  };
  const failedIn = (lines) => lines.some((line) => {
    const ids = tokensByLine.get(line);
    return !ids?.length || ids.some((id) => material.processed_json.dictionary[id]?.failed);
  });

  const toggleTx = (index) => setOpenTx((prev) => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  async function askDelete() {
    setMenuOpen(false);
    setConfirm({ words: null });
    const words = await countConversationWords(materialId).catch(() => null);
    setConfirm((prev) => (prev ? { words } : prev));
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    try { await onDelete?.(); setConfirm(null); } finally { setDeleting(false); }
  }

  // 무엇이 남고 무엇이 지워지는지 먼저(시안 「지우기」). 담은 단어 수는 조회가 끝나면 붙는다.
  const deleteMessage = confirm ? (
    <>
      {[conversation.topic, langKo, `말풍선 ${items.length}개`, confirm.words != null ? `담은 단어 ${confirm.words}개` : null].filter(Boolean).join(' · ')}
      <br />담은 단어와 복습 일정은 단어장에 그대로 남아요.
      <br />휴지통에서 되돌릴 수 있어요. 영구 삭제하면 복습 카드의 「대화로」 출처 문장도 함께 지워져요.
    </>
  ) : null;

  const placeholder = open ? '다시 말해 보세요' : `${langKo}로 답해 보세요`;
  const blocked = error?.blocked || full;

  return (
    <div className="conv">
      <div className="conv__head">
        <p className="conv__meta">{[conversation.topic, langKo, conversation.level, '대화'].filter(Boolean).join(' · ')}</p>
        <div className="conv-menu">
          <button type="button" className="conv__icon" aria-label="대화 메뉴" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}>⋯</button>
          {menuOpen && (
            <div className="conv-menu__list" role="menu" onKeyDown={(e) => { if (e.key === 'Escape') setMenuOpen(false); }}>
              <Link role="menuitem" className="conv-menu__item"
                href={newConversationHref({ language, level: conversation.level, topic: conversation.topic })}>주제·수준 바꾸기</Link>
              {onNewConversation && (
                <button type="button" role="menuitem" className="conv-menu__item" onClick={() => { setMenuOpen(false); onNewConversation(); }}>새 대화</button>
              )}
              <button type="button" role="menuitem" className="conv-menu__item" onClick={() => { setMenuOpen(false); setSummaryOpen(true); }}>마치기</button>
              {onDelete && <button type="button" role="menuitem" className="conv-menu__item" onClick={askDelete}>지우기</button>}
            </div>
          )}
        </div>
      </div>
      <OutputWordChips words={outputWords} usedSet={usedWordSet} />
      <div className="conv__log" role="log" aria-live="polite" aria-relevant="additions" id={listId}>
        {items.map((item) => {
          if (item.kind === 'tutor') {
            const lines = item.turn.lines || [];
            const sentence = lines.map((l) => rawLines[l]).join(' ');
            const ko = lines.map((l) => translations[rawLines[l]]).filter(Boolean);
            const txOpen = openTx.has(item.index);
            return (
              <div key={item.index} className="conv__row conv__row--tutor">
                <div className="conv-bubble conv-bubble--tutor" lang={bcp47ForLanguage(language)}>
                  {lines.map((line, k) => (
                    <span key={line} className="conv-bubble__line">
                      {lineView(line)}
                      {k < lines.length - 1 && <span className="line-break" />}
                    </span>
                  ))}
                </div>
                <div className="conv-bubble__actions">
                  {ttsSupported && (
                    <button type="button" className="conv-chip" onClick={() => speak(sentence, language)} aria-label="튜터 말 듣기">🔊 듣기</button>
                  )}
                  {ko.length > 0 && (
                    <button type="button" className="conv-chip" aria-expanded={txOpen} onClick={() => toggleTx(item.index)}>번역</button>
                  )}
                  {failedIn(lines) && onRetryAnalysis && (
                    <button type="button" className="conv-chip" disabled={analysisBusy} onClick={onRetryAnalysis}>
                      단어 분석을 못 했어요 · 다시 분석
                    </button>
                  )}
                </div>
                {txOpen && <p className="conv-bubble__tx">{ko.join(' ')}</p>}
              </div>
            );
          }
          const { turn } = item;
          const fbId = `${listId}-fb-${item.index}`;
          const hasFeedback = turn.feedback || item.fixed || Number.isInteger(item.answerLine) || item.openRetry;
          return (
            <div key={item.index} className="conv__row conv__row--me">
              <div className="conv-bubble conv-bubble--me" lang={bcp47ForLanguage(language)} aria-describedby={hasFeedback ? fbId : undefined}>
                <MyText text={turn.text} focus={turn.focus} />
              </div>
              {hasFeedback && (
                <div className="conv-feedback" id={fbId} lang="ko">
                  {item.fixed && <p className="conv-feedback__ok">✓ 스스로 고쳤어요</p>}
                  {turn.feedback && !item.fixed && <p>{turn.feedback}</p>}
                  {item.openRetry && turn.focus?.hint && (
                    <p className="conv-feedback__hint">힌트 <span lang={bcp47ForLanguage(language)}>{turn.focus.hint}</span></p>
                  )}
                  {item.openRetry && (
                    <button type="button" className="conv-chip" disabled={loading} onClick={() => send({ action: 'reveal' })}>답 보기</button>
                  )}
                  {Number.isInteger(item.answerLine) && (
                    <div className="conv-feedback__answer">
                      <p className="conv-feedback__label">이렇게 말해요</p>
                      <div className="conv-answer" lang={bcp47ForLanguage(language)}>{lineView(item.answerLine)}</div>
                      <div className="conv-bubble__actions">
                        {ttsSupported && (
                          <button type="button" className="conv-chip" onClick={() => speak(rawLines[item.answerLine], language)} aria-label="정답 문장 듣기">🔊 듣기</button>
                        )}
                        {sttSupported && (
                          <button type="button" className="conv-chip" disabled={shadow?.listening} onClick={() => startShadow(item.index)}>
                            {shadow?.index === item.index && shadow.listening ? '듣는 중…' : '따라 말해 보기'}
                          </button>
                        )}
                      </div>
                      {shadow?.index === item.index && shadow.heard && (
                        <p className="conv-feedback__heard">들린 말 <span lang={bcp47ForLanguage(language)}>{shadow.heard}</span></p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {pending && (
          <div className="conv__row conv__row--me">
            <div className="conv-bubble conv-bubble--me conv-bubble--pending">{pending.text}</div>
          </div>
        )}
        {loading && (
          <div className="conv__row conv__row--tutor" aria-label="입력 중">
            <div className="conv-bubble conv-bubble--tutor conv-bubble--typing"><span /><span /><span /></div>
          </div>
        )}
        {error && (
          <div className="conv__notice" role="status">
            <span>{error.text}</span>
            {error.retry && pending && (
              <button type="button" className="conv-chip" disabled={loading} onClick={() => send({ retryText: pending.text })}>다시 시도</button>
            )}
          </div>
        )}
        {full && (
          <div className="conv__notice" role="status">
            <span>{CONVERSATION_ERRORS.conversationFull}</span>
            {onNewConversation && <button type="button" className="conv-chip" onClick={onNewConversation}>이어서 새 대화</button>}
          </div>
        )}
        {summaryOpen && (
          <ConversationSummary materialId={materialId} conversation={conversation} language={language}
            outputWords={outputWords} onClose={() => setSummaryOpen(false)} />
        )}
        <div ref={endRef} />
      </div>
      <ConfirmModal
        open={!!confirm}
        title="이 대화를 휴지통으로 옮길까요?"
        message={deleteMessage}
        variant="primary"
        confirmLabel="휴지통으로"
        confirmDisabled={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setConfirm(null); }}
      />
      <div className="conv__input">
        <textarea
          className="conv__textarea"
          value={input}
          onChange={(e) => { setInput(e.target.value); if (!e.target.value) setInputMode('text'); }}
          onKeyDown={(e) => handleConversationKeyDown(e, () => send())}
          placeholder={listening ? '듣는 중…' : placeholder}
          aria-label={placeholder}
          rows={2}
          disabled={blocked}
        />
        {sttSupported && (
          <button type="button" className="conv__icon" onClick={listening ? stopListening : startListening}
            aria-label={listening ? '음성 입력 중지' : '음성 입력'} disabled={blocked}>
            {listening ? '⏹' : '🎤'}
          </button>
        )}
        <button type="button" className="conv__icon conv__icon--send" onClick={() => send()} aria-label="보내기"
          disabled={blocked || loading || !input.trim()}>➤</button>
      </div>
    </div>
  );
}
