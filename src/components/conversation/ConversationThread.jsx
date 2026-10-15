'use client';

// 대화 모드 화면(v2-Z Z-R1 ③, CONVERSATION-V2Z-001 §5) — 뷰어 본문 자리에 대화 자료를 말풍선으로 편다.
//
// - 튜터 말풍선의 글은 뷰어와 같은 토큰 부품(ViewerPage renderToken)이다 — 병음·후리가나·단어 상태 색이 같고,
//   누르면 같은 v2-AE 단어창이 열리고, 저장은 같은 함수·같은 출처({kind:'reading', materialId, tokenId})다.
// - 튜터 말풍선(듣기에 넘기는 글)은 목표어 100%. 한국어 설명은 내 말 아래 피드백 창 하나로만 보인다.
//   피드백 창과 내 말풍선에는 토큰이 없고, 정답 줄(「이렇게 말해요」)은 토큰이다.
// - 번역은 받아 둔 번역(metadata.translations)이라 호출 0. 처음엔 닫혀 있다.
// - 말풍선은 분석이 붙은 완성본을 한 번만 그린다(기다리는 동안은 「입력 중」 점, 입력 칸은 열려 있다).
// - 채팅앱 껍데기(CONV-CHAT-001 ②, notes/conversation-chat-shell.md): 뷰어 상단바·제목·쪽 넘김 없이 화면 전체 높이.
//   머리 한 줄 · 혼자 스크롤하는 대화 목록 · 맨 아래 입력창. 키보드가 열리면 visualViewport 높이에 맞춰 입력창이 키보드 위에 붙는다.
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import {
  conversationItems, openRetryOf, missingConversationLines, CONVERSATION_ERRORS, CONVERSATION_MAX_TURNS, CONVERSATION_ANALYZED_LANGUAGES, countMyTurns,
} from '../../lib/conversation/turnModel';
import Link from 'next/link';
import { postConversationTurn, countConversationWords } from '../../lib/conversation/conversationClient';
import { newConversationHref } from '../../lib/conversation/newConversation';
import ConfirmModal from '../ConfirmModal';
import ConversationSummary from './ConversationSummary';
import { isImeComposing } from '../../lib/imeComposing';
import { bcp47ForLanguage } from '../../lib/speechLang';
import { langNameKo } from '../../lib/constants';
import OutputWordChips from '../OutputWordChips';
import { chatDateLabel, kstDateKey } from '../../lib/conversation/chatView';
import { CHAT_COMPOSER_MAX_LINES, CHAT_NEAR_BOTTOM_PX, useAutoGrow, useChatScroll, useChatViewport } from './useChatShell';
import './conversation.css';

/** 요청이 아직 이 화면(같은 자료·마지막 요청)의 것인가 — 옛 회화 패널 계약 그대로(자료를 바꾸면 늦은 응답을 버린다). */
export function isConversationRequestCurrent(requestRef, requestId, materialRef, materialId) {
  return requestRef.current === requestId && materialRef.current === materialId;
}

/** 터치 화면(폰·태블릿)인가 — 화면 키보드에는 Shift가 없어 Enter를 줄바꿈으로 둔다(메신저 관례). */
export function isTouchComposer() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
}

// PC: Enter = 전송, Shift+Enter = 줄바꿈. 터치: Enter = 줄바꿈, 전송은 ➤ 버튼.
// IME 후보 확정 Enter는 조합 중이므로 어느 쪽이든 보내지 않는다(#1381).
export function handleConversationKeyDown(e, send, touch = isTouchComposer()) {
  if (touch || e.key !== 'Enter' || e.shiftKey || isImeComposing(e)) return;
  e.preventDefault();
  send();
}

// 입력창은 한 줄에서 시작해 다섯 줄까지 자라고, 그 위로는 입력창 안에서 스크롤한다.
export const CONVERSATION_COMPOSER_MAX_LINES = CHAT_COMPOSER_MAX_LINES;
// 맨 아래에서 이만큼(px) 안이면 「맨 아래에 있다」 — 새 말을 따라 내려간다. 위를 보고 있으면 자리를 지킨다.
export const CONVERSATION_NEAR_BOTTOM_PX = CHAT_NEAR_BOTTOM_PX;

/** 실패 응답 → 화면 문구. 내 말은 입력 칸에 남겨 둔다(다시 보내기). */
export function conversationErrorView(error) {
  if (error?.code === 'daily_limit') return { text: CONVERSATION_ERRORS.dailyLimit, blocked: true };
  if (error?.code === 'conversation_full') return { text: CONVERSATION_ERRORS.conversationFull, full: true };
  if (error?.status === 409) return { text: CONVERSATION_ERRORS.conflict, reload: true };
  if (error?.status === 0) return { text: '연결이 끊겼어요 · 다시 받기', retry: true };
  if (error?.status === 429) return { text: '요청이 너무 많아요 · 잠시 뒤 다시 받기', retry: true };
  return { text: `${CONVERSATION_ERRORS.noReply} · 다시 받기`, retry: true };
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

// 못 한 줄 자동 채우기 간격(CONV-CHAT-001) — 바로 → 3초 → 10초 → 30초. 그 뒤는 다음에 자료를 열 때 다시 시작한다.
// 사용자에게 재분석 버튼을 떠넘기지 않는다: 말풍선은 평문으로 먼저 읽히고, 분석이 붙으면 단어가 눌린다.
export const CONVERSATION_FILL_DELAYS = Object.freeze([0, 3000, 10000, 30000]);

export default function ConversationThread({
  material, conversation, tokensByLine, renderToken, language, speak, ttsSupported,
  onTurnResult, onReload, onNewConversation, onFilled, onDelete, outputWords = [],
  backLink = null, menuExtras = [],
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
  const [fillTick, setFillTick] = useState(0);
  const [openFb, setOpenFb] = useState(() => new Set());
  const fillAttemptsRef = useRef(new Map());
  const requestRef = useRef(0);
  const materialRef = useRef(materialId);
  const recognitionRef = useRef(null);
  const shellRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
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
  // 스크롤·키보드·입력창 높이는 모두의 대화방과 같은 부품(useChatShell)을 쓴다.
  const { jump, onScroll: onLogScroll, toBottom, nearBottomRef, markSent } = useChatScroll(logRef, {
    resetKey: materialId, changeKey: `${turnCount}|${loading}|${pending ? pending.text : ''}`,
  });
  useChatViewport(shellRef, { nearBottomRef, toBottom });
  useAutoGrow(inputRef, input);

  // 못 한 줄 자동 채우기 — 소유자 화면에서만(onFilled가 있을 때), 턴을 기다리는 동안은 쉬었다가 이어 한다.
  const missingKey = onFilled && CONVERSATION_ANALYZED_LANGUAGES.includes(language)
    ? missingConversationLines(material?.processed_json).join(',') : '';
  useEffect(() => {
    if (!missingKey || loading) return undefined;
    const key = `${materialId}:${missingKey}`;
    const tried = fillAttemptsRef.current.get(key) || 0;
    if (tried >= CONVERSATION_FILL_DELAYS.length) return undefined;
    const fillMaterialId = materialId;
    const timer = setTimeout(async () => {
      fillAttemptsRef.current.set(key, tried + 1);
      try {
        const body = await postConversationTurn({ materialId: String(fillMaterialId), action: 'analyze' });
        if (materialRef.current !== fillMaterialId) return;
        if (Object.keys(body?.filled || {}).length) onFilled(body);
        else if (body?.analysis === 'skipped') fillAttemptsRef.current.set(key, CONVERSATION_FILL_DELAYS.length);
        else setFillTick((t) => t + 1);
      } catch {
        if (materialRef.current === fillMaterialId) setFillTick((t) => t + 1);
      }
    }, CONVERSATION_FILL_DELAYS[tried]);
    return () => clearTimeout(timer);
  }, [missingKey, loading, materialId, fillTick, onFilled]);

  async function send({ action = null, retryText = null } = {}) {
    const text = action ? '' : (retryText ?? input).trim();
    if ((!action && !text) || loading || full) return;
    const requestId = ++requestRef.current;
    const requestMaterialId = materialId;
    const mode = retryText != null ? pending?.inputMode || 'text' : inputMode;
    if (!action) { markSent(); setPending({ text, inputMode: mode }); setInput(''); setInputMode('text'); }
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

  const toggleIn = (setter) => (index) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
  const toggleTx = toggleIn(setOpenTx);
  const toggleFb = toggleIn(setOpenFb);

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

  const canSend = !!input.trim();
  const showMic = sttSupported && (!canSend || listening);
  const fbLabel = (item, open) => {
    const { turn } = item;
    const what = Number.isInteger(item.answerLine) || turn.focus ? '고칠 점' : '피드백';
    return `${what} ${open ? '접기 ▾' : '보기 ▸'}`;
  };

  const renderItem = (item) => {
    if (item.kind === 'tutor') {
      const lines = item.turn.lines || [];
      const sentence = lines.map((l) => rawLines[l]).join(' ');
      const ko = lines.map((l) => translations[rawLines[l]]).filter(Boolean);
      const txOpen = openTx.has(item.index);
      const actions = (ttsSupported || ko.length > 0) && (
        <div className="conv-bubble__actions">
          {ttsSupported && (
            <button type="button" className="conv-act" onClick={() => speak(sentence, language)} aria-label="튜터 말 듣기" title="듣기">🔊</button>
          )}
          {ko.length > 0 && (
            <button type="button" className="conv-act" aria-expanded={txOpen} onClick={() => toggleTx(item.index)} aria-label="번역" title="번역">文</button>
          )}
        </div>
      );
      // 메신저처럼 문장마다 말풍선 — 같은 턴은 한 묶음(프로필·이름은 첫 말풍선에만, 듣기·번역은 마지막 말풍선 옆).
      return (
        <div className="conv__row conv__row--tutor">
          <span className="conv-avatar" aria-hidden="true">튜</span>
          <div className="conv__stack">
            <p className="conv__name">튜터</p>
            {lines.map((line, k) => (
              <div key={line} className="conv__line">
                <div className="conv-bubble conv-bubble--tutor" lang={bcp47ForLanguage(language)}>{lineView(line)}</div>
                {k === lines.length - 1 && actions}
              </div>
            ))}
            {txOpen && <p className="conv-bubble__tx" lang="ko">{ko.join(' ')}</p>}
          </div>
        </div>
      );
    }
    const { turn } = item;
    const fbId = `${listId}-fb-${item.index}`;
    const hasFeedback = turn.feedback || item.fixed || Number.isInteger(item.answerLine) || item.openRetry;
    // 다시 말하기가 열려 있으면(힌트·답 보기) 펼쳐 둔다 — 학습자가 할 일이 있다. 그 밖의 피드백은 한 줄로 접는다.
    const onlyFixed = item.fixed && !Number.isInteger(item.answerLine);
    const fbOpen = item.openRetry || onlyFixed || openFb.has(item.index);
    return (
      <div className="conv__row conv__row--me">
        <div className="conv-bubble conv-bubble--me" lang={bcp47ForLanguage(language)} aria-describedby={hasFeedback && fbOpen ? fbId : undefined}>
          <MyText text={turn.text} focus={turn.focus} />
        </div>
        {hasFeedback && !item.openRetry && !onlyFixed && (
          <button type="button" className="conv-fb-toggle" aria-expanded={fbOpen} aria-controls={fbId} onClick={() => toggleFb(item.index)}>
            {fbLabel(item, fbOpen)}
          </button>
        )}
        {hasFeedback && fbOpen && (
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
                    <button type="button" className="conv-act" onClick={() => speak(rawLines[item.answerLine], language)} aria-label="정답 문장 듣기" title="듣기">🔊</button>
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
  };

  return (
    <div className="conv" ref={shellRef}>
      <div className="conv__head">
        {backLink}
        <span className="conv-avatar conv-avatar--head" aria-hidden="true">튜</span>
        <div className="conv__title">
          <p className="conv__meta">{conversation.topic || '대화'}</p>
          <p className="conv__sub">{[langKo, conversation.level].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="conv-menu">
          <button type="button" className="conv__icon conv__icon--bare" aria-label="대화 메뉴" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}>⋯</button>
          {menuOpen && (
            <div className="conv-menu__list" role="menu" onKeyDown={(e) => { if (e.key === 'Escape') setMenuOpen(false); }}>
              <button type="button" role="menuitem" className="conv-menu__item" onClick={() => { setMenuOpen(false); setSummaryOpen(true); }}>마치기</button>
              {onNewConversation && (
                <button type="button" role="menuitem" className="conv-menu__item" onClick={() => { setMenuOpen(false); onNewConversation(); }}>새 대화</button>
              )}
              <Link role="menuitem" className="conv-menu__item" href={newConversationHref({ language })}>다른 대화방</Link>
              {menuExtras.map((extra) => (
                <button key={extra.label} type="button" role="menuitem" className="conv-menu__item" onClick={() => { setMenuOpen(false); extra.onSelect(); }}>{extra.label}</button>
              ))}
              {onDelete && <button type="button" role="menuitem" className="conv-menu__item" onClick={askDelete}>지우기</button>}
            </div>
          )}
        </div>
      </div>
      <OutputWordChips words={outputWords} usedSet={usedWordSet} />
      <div className="conv__log" role="log" aria-live="polite" aria-relevant="additions" id={listId} ref={logRef} onScroll={onLogScroll}>
        {items.map((item, n) => {
          // 날짜가 바뀌면 가운데 구분선(KST) — 메신저 관례.
          const day = kstDateKey(item.turn.at);
          const prevDay = n > 0 ? kstDateKey(items[n - 1].turn.at) : null;
          const sep = day && day !== prevDay ? <p className="conv__date" role="separator">{chatDateLabel(item.turn.at)}</p> : null;
          return <Fragment key={item.index}>{sep}{renderItem(item)}</Fragment>;
        })}
        {pending && (
          <div className="conv__row conv__row--me">
            <div className="conv-bubble__send">
              {error?.retry && (
                <button type="button" className="conv-retry" disabled={loading} onClick={() => send({ retryText: pending.text })} aria-label="다시 보내기" title="다시 보내기">!</button>
              )}
              <div className={`conv-bubble conv-bubble--me conv-bubble--pending${error?.retry ? ' conv-bubble--failed' : ''}`}>{pending.text}</div>
            </div>
          </div>
        )}
        {loading && (
          <div className="conv__row conv__row--tutor" aria-label="입력 중">
            <span className="conv-avatar" aria-hidden="true">튜</span>
            <div className="conv__stack">
              <div className="conv-bubble conv-bubble--tutor conv-bubble--typing"><span /><span /><span /></div>
            </div>
          </div>
        )}
        {error && (
          <div className="conv__notice" role="status">
            <span>{error.text}</span>
            {error.retry && pending && (
              <button type="button" className="conv-chip" disabled={loading} onClick={() => send({ retryText: pending.text })}>다시 받기</button>
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
      </div>
      {jump && (
        <button type="button" className="conv__jump" onClick={() => toBottom(true)}>새 메시지 ↓</button>
      )}
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
          ref={inputRef}
          className="conv__textarea"
          value={input}
          onChange={(e) => { setInput(e.target.value); if (!e.target.value) setInputMode('text'); }}
          onKeyDown={(e) => handleConversationKeyDown(e, () => send())}
          placeholder={listening ? '듣는 중…' : placeholder}
          aria-label={placeholder}
          rows={1}
          enterKeyHint="enter"
          disabled={blocked}
        />
        {showMic ? (
          <button type="button" className="conv__icon conv__icon--bare" onClick={listening ? stopListening : startListening}
            aria-label={listening ? '음성 입력 중지' : '음성 입력'} disabled={blocked}>
            {listening ? '⏹' : '🎤'}
          </button>
        ) : (
          <button type="button" className="conv__icon conv__icon--send" onClick={() => send()} aria-label="보내기"
            disabled={blocked || loading || !canSend}>➤</button>
        )}
      </div>
    </div>
  );
}
