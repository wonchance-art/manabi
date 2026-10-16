'use client';
// 모두의 대화방(CONV-LOBBY-001, 오너 지시 2026-10-15 「대화방 목록 맨 위에 사용자들끼리 채팅 남길 수 있는 방」,
// 결정 「기록 남기기」) — 학습 언어마다 하나인 방. 지난 말 100개가 남고, 새 말은 실시간으로 붙는다.
// 화면은 튜터 대화방과 같은 껍데기(.conv · useChatShell)다: 머리 한 줄 · 혼자 스크롤하는 목록 · 맨 아래 입력창.
// - 남의 말은 왼쪽(묶음 첫 말에만 프로필·이름), 내 말은 오른쪽, 시각은 묶음 마지막 말 옆(메신저 관례).
// - 말풍선을 누르면 그 말 아래에 할 일이 열린다: 내 말 = 지우기, 남의 말 = 신고 · 이 사람 가리기(월드 채팅 음소거 정본).
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { langNameKo } from '@/lib/constants';
import { bcp47ForLanguage } from '@/lib/speechLang';
import useLearnLanguage from '@/components/learn/useLearnLanguage';
import ConfirmModal from '@/components/ConfirmModal';
import { CONVERSATION_LANGUAGES } from '@/lib/conversation/turnModel';
import { newConversationHref } from '@/lib/conversation/newConversation';
import { chatDateLabel, profileLook } from '@/lib/conversation/chatView';
import {
  LOBBY_MAX_CHARS, LOBBY_SOON_TEXT, cleanLobbyText, isLobbyMissing, deleteLobby, fetchLobby, lobbyErrorText, lobbyKey, lobbyMessages,
  lobbyRateGate, lobbyThread, postLobby, reportLobby, subscribeLobby,
} from '@/lib/conversation/lobby';
import { isMuted, onChange as onMuteChange, toggleMute } from '@/lib/world/muteStore';
import { handleConversationKeyDown } from '@/components/conversation/ConversationThread';
import { useArrivals, useAutoGrow, useChatScroll, useChatViewport } from '@/components/conversation/useChatShell';
import { useToast } from '@/lib/ToastContext';
import '@/components/conversation/conversation.css';

export default function ConversationLobbyPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const params = useSearchParams();
  const { lang: learnLang } = useLearnLanguage(profile);
  const asked = params.get('lang');
  const language = CONVERSATION_LANGUAGES.includes(asked) ? asked
    : CONVERSATION_LANGUAGES.includes(learnLang) ? learnLang : CONVERSATION_LANGUAGES[0];
  const langKo = langNameKo(language);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null); // 보내는 중인 내 말
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(null); // 할 일을 연 말 id
  const [confirm, setConfirm] = useState(null); // { kind: 'delete'|'report', id }
  const [, setMuteTick] = useState(0);
  const recentRef = useRef([]);
  const shellRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  const query = useQuery({
    queryKey: lobbyKey(language), enabled: !!user, staleTime: 5000,
    // 실시간 알림이 끊겨도(백그라운드 탭·네트워크) 30초마다 따라잡는다.
    refetchInterval: (q) => (isLobbyMissing(q.state.error) ? false : 30000),
    retry: (count, cause) => !isLobbyMissing(cause) && count < 2,
    queryFn: () => fetchLobby(supabase, language),
  });
  // 표를 아직 운영에 적용하기 전이면 오류 대신 「곧 열려요」 — 입력창도 닫아 저장 오류를 만들지 않는다.
  const missing = isLobbyMissing(query.error);
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: lobbyKey(language) }), [queryClient, language]);
  useEffect(() => (user ? subscribeLobby(supabase, language, refresh) : undefined), [user, language, refresh]);
  useEffect(() => onMuteChange(() => setMuteTick((t) => t + 1)), []);

  const messages = useMemo(
    () => lobbyThread(lobbyMessages(query.data, { me: user?.id, isMuted })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 음소거가 바뀌면 setMuteTick으로 다시 그린다
    [query.data, user?.id, query.dataUpdatedAt],
  );
  const lastId = messages.length ? messages[messages.length - 1].id : '';
  const { jump, onScroll, toBottom, nearBottomRef, markSent } = useChatScroll(logRef, {
    resetKey: `${language}|${query.isSuccess}`, changeKey: `${lastId}|${pending || ''}`,
  });
  useChatViewport(shellRef, { nearBottomRef, toBottom });
  useAutoGrow(inputRef, input);
  // 다른 사람의 새 말만 떠오른다 — 처음 불러온 말은 그대로, 내 말은 보내는 중 말풍선이 이미 떠올랐다.
  const arrived = useArrivals(messages.map((m) => m.id), { resetKey: language, ready: query.isSuccess });

  async function send() {
    const text = cleanLobbyText(input);
    if (!text || pending) return;
    const gate = lobbyRateGate(recentRef.current, Date.now());
    recentRef.current = gate.recent;
    if (!gate.allowed) { setError(lobbyErrorText({ message: 'lobby_rate_limited' })); return; }
    markSent(); setPending(text); setInput(''); setError(''); setPicked(null);
    try {
      await postLobby(supabase, { language, text });
      await refresh();
      setPending(null);
    } catch (cause) {
      setPending(null);
      setInput((now) => now || text);
      setError(lobbyErrorText(cause));
    }
  }

  async function confirmAction() {
    const { kind, id } = confirm;
    setConfirm(null); setPicked(null);
    try {
      if (kind === 'delete') await deleteLobby(supabase, id);
      else { await reportLobby(supabase, id); toast?.('신고했어요. 여러 사람이 신고하면 그 말은 가려져요.', 'success'); }
      refresh();
    } catch {
      toast?.(kind === 'delete' ? '지우지 못했어요. 잠시 뒤 다시 해 주세요.' : '신고하지 못했어요. 잠시 뒤 다시 해 주세요.', 'error');
    }
  }

  const head = (
    <div className="conv__head">
      <Link href={newConversationHref({ language })} aria-label="대화방 목록">‹</Link>
      <span className="conv-avatar conv-avatar--head conv-avatar--lobby" aria-hidden="true">👥</span>
      <div className="conv__title">
        <p className="conv__meta">모두의 대화방</p>
        <p className="conv__sub">{langKo} · 함께 배우는 사람들</p>
      </div>
    </div>
  );

  if (authLoading) return <div className="conv-page" data-chat="true"><div className="conv" ref={shellRef}>{head}<p className="conv__notice conv-lobby__empty" role="status">불러오는 중…</p></div></div>;
  if (!user) {
    return (
      <div className="conv-page" data-chat="true">
        <div className="conv" ref={shellRef}>
          {head}
          <div className="conv-lobby__empty">
            <p>로그인하면 {langKo}를 배우는 사람들과 이야기할 수 있어요.</p>
            <Link className="manabi-button" href={`/auth?from=${encodeURIComponent(`/conversation/lobby?lang=${language}`)}`}>로그인</Link>
          </div>
        </div>
      </div>
    );
  }

  const canSend = !!cleanLobbyText(input) && !pending && !missing;
  const placeholder = missing ? '곧 열려요' : `${langKo}로 한마디 남겨 보세요`;
  const lang = bcp47ForLanguage(language);

  return (
    <div className="conv-page" data-chat="true">
      <div className="conv" ref={shellRef}>
        {head}
        <div className="conv__log" role="log" aria-live="polite" aria-relevant="additions" ref={logRef} onScroll={onScroll}>
          {query.isLoading && <p className="conv__notice" role="status">불러오는 중…</p>}
          {missing && <p className="conv__notice conv-lobby__empty" role="status">{LOBBY_SOON_TEXT}</p>}
          {query.isError && !missing && (
            <div className="conv__notice" role="status">
              <span>말을 불러오지 못했어요.</span>
              <button type="button" className="conv-chip" onClick={() => query.refetch()}>다시 받기</button>
            </div>
          )}
          {query.isSuccess && messages.length === 0 && !pending && (
            <p className="conv__notice conv-lobby__empty">아직 아무도 말하지 않았어요. {langKo}로 첫 인사를 남겨 보세요.</p>
          )}
          {messages.map((m) => {
            const open = picked === m.id;
            const bubble = (
              <button type="button" className={`conv-bubble conv-lobby__bubble conv-bubble--${m.mine ? 'me' : 'tutor'}${m.first ? ' conv-bubble--tail' : ''}`}
                lang={lang} aria-expanded={open} onClick={() => setPicked(open ? null : m.id)}>
                {m.text}
              </button>
            );
            const time = m.last && <span className="conv-time">{m.time}</span>;
            const actions = open && (
              <div className="conv-lobby__actions" role="group" aria-label="이 말에 할 일">
                {m.mine
                  ? <button type="button" className="conv-chip" onClick={() => setConfirm({ kind: 'delete', id: m.id })}>지우기</button>
                  : (
                    <>
                      <button type="button" className="conv-chip" onClick={() => setConfirm({ kind: 'report', id: m.id })}>신고</button>
                      <button type="button" className="conv-chip" onClick={() => { toggleMute(m.userId); setPicked(null); }}>이 사람 가리기</button>
                    </>
                  )}
              </div>
            );
            return (
              <Fragment key={m.id}>
                {m.dateSep && <p className="conv__date" role="separator">{chatDateLabel(m.at)}</p>}
                {m.mine ? (
                  <div className={`conv-lobby__row conv-lobby__row--me${m.first ? ' conv-lobby__row--first' : ''}`}>
                    <div className="conv-lobby__line">{time}{bubble}</div>
                    {m.hidden && <p className="conv-lobby__hidden" lang="ko">신고가 쌓여 다른 사람에게는 가려진 말이에요</p>}
                    {actions}
                  </div>
                ) : (
                  <div className={`conv-lobby__row${m.first ? ' conv-lobby__row--first' : ''}${arrived(m.id) ? ' conv-anim-in' : ''}`}>
                    {m.first
                      ? <span className={`conv-avatar conv-avatar--tone${profileLook(m.userId).tone}`} aria-hidden="true">{profileLook(m.userId).icon}</span>
                      : <span className="conv-lobby__gap" aria-hidden="true" />}
                    <div className="conv__stack">
                      {m.first && <p className="conv__name">{m.name}</p>}
                      <div className="conv-lobby__line">{bubble}{time}</div>
                      {actions}
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
          {pending && (
            <div className="conv-lobby__row conv-lobby__row--me conv-anim-in">
              <div className="conv-lobby__line">
                <span className="conv-bubble conv-bubble--me conv-bubble--tail conv-bubble--pending" lang={lang}>{pending}</span>
              </div>
            </div>
          )}
          {error && <p className="conv__notice" role="alert">{error}</p>}
        </div>
        {jump && <button type="button" className="conv__jump" onClick={() => toBottom(true)}>새 메시지 ↓</button>}
        <ConfirmModal
          open={!!confirm}
          title={confirm?.kind === 'delete' ? '이 말을 지울까요?' : '이 말을 신고할까요?'}
          message={confirm?.kind === 'delete' ? '지운 말은 모두에게서 사라져요.' : '서로 다른 세 사람이 신고하면 그 말은 가려져요.'}
          variant={confirm?.kind === 'delete' ? 'danger' : 'primary'}
          confirmLabel={confirm?.kind === 'delete' ? '지우기' : '신고'}
          onConfirm={confirmAction}
          onCancel={() => setConfirm(null)}
        />
        <div className="conv__input">
          <textarea
            ref={inputRef}
            className="conv__textarea"
            lang={lang}
            value={input}
            maxLength={LOBBY_MAX_CHARS}
            onChange={(e) => { setInput(e.target.value); if (error) setError(''); }}
            onKeyDown={(e) => handleConversationKeyDown(e, send)}
            placeholder={placeholder}
            aria-label={placeholder}
            rows={1}
            enterKeyHint="enter"
            disabled={missing}
          />
          <button type="button" className="conv__icon conv__icon--send" onClick={send} aria-label="보내기" disabled={!canSend}>➤</button>
        </div>
      </div>
    </div>
  );
}
