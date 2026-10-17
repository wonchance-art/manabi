'use client';
// 대화 — 방 목록(CONV-CHAT-001 2차, 오너 지시 2026-10-15 「대화창을 누르면 대화방을 고르는 영역 — 옵션 설정 없이 주제로 들어가게」).
// 메신저 「채팅」 탭처럼 한 줄 = 한 방이다. 이야기한 방은 마지막 말·시각이 보이고, 처음 여는 주제는 누르면 튜터가 첫 말을 건다.
// - 언어는 배움에서 고른 학습 언어(useLearnLanguage, 같은 저장 키), 수준은 내 학습 수준 정본(recommendedLevel)으로 정한다.
//   언어·수준을 고르는 칸은 없다. 언어가 둘 이상이면 머리의 칩으로만 바꾼다.
// - 한 주제 = 한 방: 같은 주제(·자료)의 대화가 여럿이면 가장 최근 것 하나만 방으로 보인다. 나머지는 서재 「대화」 묶음에 그대로 있다.
// - 맨 위에는 모두의 대화방(CONV-LOBBY-001) — 같은 언어를 배우는 사람끼리의 방. 마지막 말·시각이 보인다.
// - 「써 볼 말」은 화면에 따로 늘어놓지 않고 첫 질문 프롬프트에만 넘긴다(표시 전용이던 칸 — 목록을 방으로 비운다).
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { langNameKo, profileLevel } from '@/lib/constants';
import { useOutputWords } from '@/lib/useOutputWords';
import useLearnLanguage from '@/components/learn/useLearnLanguage';
import { CONVERSATION_ERRORS, CONVERSATION_LANGUAGES, CONVERSATION_MAX_TOPIC_CHARS } from '@/lib/conversation/turnModel';
import { startTopicConversation } from '@/lib/conversation/conversationClient';
import { fetchConversationRooms, conversationHref } from '@/lib/conversation/conversationLibrary';
import { CONVERSATION_TOPICS, recommendedLevel } from '@/lib/conversation/newConversation';
import { conversationRooms, roomTimeLabel } from '@/lib/conversation/chatView';
import { fetchLobby, isLobbyMissing, lobbyHref, lobbyKey } from '@/lib/conversation/lobby';
import { isMuted } from '@/lib/world/muteStore';
import { friendlyToastMessage } from '@/lib/errorMessage';
import PhoneFrame from '@/components/conversation/PhoneFrame';
import '@/components/conversation/conversation.css';

export default function NewConversationPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { langs, lang: learnLang, choose } = useLearnLanguage(profile);
  const chatLangs = langs.filter((l) => CONVERSATION_LANGUAGES.includes(l));
  const asked = params.get('lang');
  const language = chatLangs.includes(learnLang) ? learnLang
    : chatLangs[0] || (CONVERSATION_LANGUAGES.includes(asked) ? asked : CONVERSATION_LANGUAGES[0]);
  const level = recommendedLevel(language, profileLevel(profile, language));
  const [opening, setOpening] = useState(''); // 여는 중인 방(주제)
  const [writing, setWriting] = useState(false);
  const [ownTopic, setOwnTopic] = useState('');
  const [error, setError] = useState('');
  const outputWords = useOutputWords(language, { enabled: !!user });
  const roomsQuery = useQuery({
    queryKey: ['conversation-rooms', user?.id], enabled: !!user, staleTime: 15000,
    queryFn: () => fetchConversationRooms(supabase, user.id),
  });
  // 모두의 대화방 미리보기 — 마지막 말 하나만 읽는다(방에 들어가면 100개).
  const lobbyQuery = useQuery({
    queryKey: [...lobbyKey(language), 'last'], enabled: !!user, staleTime: 15000,
    retry: (count, cause) => !isLobbyMissing(cause) && count < 2,
    queryFn: () => fetchLobby(supabase, language, { limit: 1 }),
  });
  const lobbySoon = isLobbyMissing(lobbyQuery.error);
  const lobbyLast = (lobbyQuery.data || []).find((row) => row.user_id === user?.id || !isMuted(row.user_id)) || null;
  const rooms = useMemo(() => conversationRooms(roomsQuery.data || [], { language, topics: CONVERSATION_TOPICS }),
    [roomsQuery.data, language]);
  const now = Date.now();

  async function openTopic(topic) {
    const chosen = String(topic || '').trim().slice(0, CONVERSATION_MAX_TOPIC_CHARS);
    if (!chosen || opening) return;
    setOpening(chosen); setError('');
    try {
      const id = await startTopicConversation({ topic: chosen, language, level, outputWords: outputWords.map((w) => w.word_text) });
      router.push(conversationHref(id));
    } catch (cause) {
      setError(cause?.code === 'daily_limit' ? CONVERSATION_ERRORS.dailyLimit : friendlyToastMessage(cause));
      setOpening('');
    }
  }

  if (loading) return <PhoneFrame><p className="manabi-page conv-rooms" role="status">대화 불러오는 중…</p></PhoneFrame>;
  if (!user) {
    return (
      <PhoneFrame>
        <div className="manabi-page conv-rooms">
          <h1 className="conv-rooms__title">대화</h1>
          <p>AI 튜터와 주제별 방에서 이야기해요. 로그인하고 시작해 주세요.</p>
          <Link className="manabi-button" href="/auth?from=/conversation/new">로그인</Link>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
    <div className="manabi-page conv-rooms">
      <header className="conv-rooms__head">
        <h1 className="conv-rooms__title">대화</h1>
        {chatLangs.length > 1 && (
          <label className="conv-rooms__lang">
            <span className="conv-sr">대화 언어</span>
            <select value={language} onChange={(e) => choose(e.target.value)}>
              {chatLangs.map((l) => <option key={l} value={l}>{langNameKo(l)}</option>)}
            </select>
          </label>
        )}
      </header>
      {error && <p className="conv-new__error" role="alert">{error}</p>}
      <ul className="conv-rooms__list" aria-label={`${langNameKo(language)} 대화방`} aria-busy={roomsQuery.isLoading || undefined}>
        <li>
          <Link className="conv-rooms__row conv-rooms__row--lobby" href={lobbyHref(language)}>
            <span className="conv-rooms__avatar conv-rooms__avatar--lobby" aria-hidden="true">👥</span>
            <span className="conv-rooms__text">
              <span className="conv-rooms__name">모두의 대화방</span>
              <span className="conv-rooms__preview" lang={lobbyLast ? 'und' : 'ko'}>
                {lobbyLast ? `${String(lobbyLast.author?.display_name || '').trim() || '학습자'}: ${lobbyLast.body.replace(/\s+/g, ' ')}`
                  : lobbySoon ? '곧 열려요' : `${langNameKo(language)}를 배우는 사람들과 이야기해요`}
              </span>
            </span>
            {lobbyLast && <span className="conv-rooms__time">{roomTimeLabel(lobbyLast.created_at, now)}</span>}
          </Link>
        </li>
        {rooms.map((room) => {
          const busy = opening && opening === room.topic;
          const body = (
            <>
              <span className="conv-rooms__avatar" aria-hidden="true">{room.icon}</span>
              <span className="conv-rooms__text">
                <span className="conv-rooms__name">{room.name}</span>
                <span className="conv-rooms__preview" lang={room.id ? 'und' : 'ko'}>
                  {busy ? '튜터가 말을 거는 중…' : room.preview || '튜터가 먼저 말을 걸어요'}
                </span>
              </span>
              {room.lastAt && <span className="conv-rooms__time">{roomTimeLabel(room.lastAt, now)}</span>}
            </>
          );
          return (
            <li key={room.key}>
              {room.id
                ? <Link className="conv-rooms__row" href={conversationHref(room.id)}>{body}</Link>
                : <button type="button" className="conv-rooms__row" disabled={!!opening} onClick={() => openTopic(room.topic)}>{body}</button>}
            </li>
          );
        })}
        <li>
          {writing ? (
            <form className="conv-rooms__row conv-rooms__own" onSubmit={(e) => { e.preventDefault(); openTopic(ownTopic); }}>
              <span className="conv-rooms__avatar" aria-hidden="true">＋</span>
              <label className="conv-rooms__text">
                <span className="conv-sr">내 주제</span>
                <input type="text" value={ownTopic} maxLength={CONVERSATION_MAX_TOPIC_CHARS} placeholder="예: 좋아하는 영화" enterKeyHint="go"
                  onChange={(e) => setOwnTopic(e.target.value)} autoFocus disabled={!!opening} />
              </label>
              <button type="submit" className="conv__icon conv__icon--send" aria-label="이 주제로 이야기하기" disabled={!ownTopic.trim() || !!opening}>➤</button>
            </form>
          ) : (
            <button type="button" className="conv-rooms__row" onClick={() => setWriting(true)}>
              <span className="conv-rooms__avatar" aria-hidden="true">＋</span>
              <span className="conv-rooms__text">
                <span className="conv-rooms__name">내 주제로 이야기하기</span>
                <span className="conv-rooms__preview">적은 주제로 새 방을 열어요</span>
              </span>
            </button>
          )}
        </li>
      </ul>
      <p className="conv-new__note">튜터와의 대화는 나만 볼 수 있고, 이 목록에 남아요. {langNameKo(language)} · {level}</p>
    </div>
    </PhoneFrame>
  );
}
