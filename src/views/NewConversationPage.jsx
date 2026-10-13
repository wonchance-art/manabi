'use client';
// 새 대화(자료 없이) — v2-Z Z-R2, 시안 conv.html 「새 대화」.
// 주제·언어·수준을 고르면 서버 대화 턴 경로가 비공개 대화 자료를 만들고 수준에 맞춘 첫 질문까지 받아 온다.
// 「써 볼 말」은 오늘 복습한 말(useOutputWords) 표시만이다 — 첫 질문 프롬프트에 함께 넘긴다.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { langNameKo, profileLevel } from '@/lib/constants';
import { useOutputWords } from '@/lib/useOutputWords';
import { CONVERSATION_ERRORS, CONVERSATION_LANGUAGES, CONVERSATION_MAX_TOPIC_CHARS } from '@/lib/conversation/turnModel';
import { startTopicConversation } from '@/lib/conversation/conversationClient';
import { fetchConversations, conversationHref, conversationShelfMeta } from '@/lib/conversation/conversationLibrary';
import {
  CONVERSATION_TOPICS, canStartConversation, conversationLevels, newConversationDefaults, recommendedLevel,
} from '@/lib/conversation/newConversation';
import { safeReaderReturn } from '@/lib/libraryReturn';
import { friendlyToastMessage } from '@/lib/errorMessage';
import '@/components/conversation/conversation.css';

const RECENT = 3;

export default function NewConversationPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const initial = useMemo(() => newConversationDefaults(params, { profileLevelOf: (l) => profileLevel(profile, l) }), [params, profile]);
  const [language, setLanguage] = useState(initial.language);
  const [level, setLevel] = useState(initial.level);
  const [topic, setTopic] = useState(CONVERSATION_TOPICS.includes(initial.topic) ? initial.topic : '');
  const [ownTopic, setOwnTopic] = useState(CONVERSATION_TOPICS.includes(initial.topic) ? '' : initial.topic);
  const [writing, setWriting] = useState(!!ownTopic);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const outputWords = useOutputWords(language, { enabled: !!user });
  const recent = useQuery({
    queryKey: ['library-conversations', user?.id], enabled: !!user, staleTime: 30000,
    queryFn: () => fetchConversations(supabase, user.id),
  });
  const returnTo = safeReaderReturn(params.get('returnTo'));
  const chosenTopic = writing ? ownTopic.trim() : topic;
  const ready = canStartConversation({ topic: chosenTopic, language, level });

  function pickLanguage(next) {
    setLanguage(next);
    setLevel(recommendedLevel(next, profileLevel(profile, next)));
    setError('');
  }

  async function start() {
    if (!ready || starting) return;
    setStarting(true); setError('');
    try {
      const id = await startTopicConversation({ topic: chosenTopic, language, level, outputWords: outputWords.map((w) => w.word_text) });
      router.push(`${conversationHref(id)}?returnTo=${encodeURIComponent(returnTo)}`);
    } catch (cause) {
      setError(cause?.code === 'daily_limit' ? CONVERSATION_ERRORS.dailyLimit : friendlyToastMessage(cause));
      setStarting(false);
    }
  }

  if (loading) return <p className="manabi-page" role="status">불러오는 중…</p>;
  if (!user) {
    return (
      <div className="manabi-page conv-new">
        <h1>새 대화</h1>
        <p>대화는 내 서재에 비공개로 남아요. 로그인하고 시작해 주세요.</p>
        <Link className="manabi-button" href="/auth?from=/conversation/new">로그인</Link>
      </div>
    );
  }

  const recentRows = (recent.data || []).slice(0, RECENT);
  return (
    <div className="manabi-page conv-new">
      <header className="conv-new__head">
        <h1>새 대화</h1>
        <p className="conv-new__lede">AI 튜터와 목표어로 이야기해요</p>
      </header>

      <section className="conv-new__group" aria-labelledby="conv-new-topic">
        <h2 id="conv-new-topic">무엇에 대해 이야기할까요?</h2>
        <div className="conv-new__chips">
          {CONVERSATION_TOPICS.map((t) => (
            <button key={t} type="button" className="conv-chip" aria-pressed={!writing && topic === t}
              onClick={() => { setTopic(t); setWriting(false); setError(''); }}>{t}</button>
          ))}
          <button type="button" className="conv-chip" aria-pressed={writing} onClick={() => setWriting(true)}>+ 직접 적기</button>
        </div>
        {writing && (
          <label className="conv-new__own">
            <span className="conv-sr">대화 주제 직접 적기</span>
            <input type="text" value={ownTopic} maxLength={CONVERSATION_MAX_TOPIC_CHARS} placeholder="예: 좋아하는 영화"
              onChange={(e) => setOwnTopic(e.target.value)} autoFocus />
          </label>
        )}
      </section>

      <section className="conv-new__group" aria-labelledby="conv-new-lang">
        <h2 id="conv-new-lang">언어</h2>
        <div className="conv-new__chips">
          {CONVERSATION_LANGUAGES.map((l) => (
            <button key={l} type="button" className="conv-chip" aria-pressed={language === l} onClick={() => pickLanguage(l)}>{langNameKo(l)}</button>
          ))}
        </div>
      </section>

      <section className="conv-new__group" aria-labelledby="conv-new-level">
        <h2 id="conv-new-level">말 수준 <small>{profileLevel(profile, language) ? '내 학습 수준 기준 추천' : '처음 단계부터'}</small></h2>
        <div className="conv-new__chips">
          {conversationLevels(language).map((lv) => (
            <button key={lv} type="button" className="conv-chip" aria-pressed={level === lv} onClick={() => setLevel(lv)}>{lv}</button>
          ))}
        </div>
      </section>

      {outputWords.length > 0 && (
        <section className="conv-new__group" aria-labelledby="conv-new-words">
          <h2 id="conv-new-words">이번 대화에서 써 볼 말 <small>오늘 복습한 말</small></h2>
          <p className="conv-new__words" lang="und">{outputWords.map((w) => w.word_text).join(' · ')}</p>
        </section>
      )}

      <div className="conv-new__start">
        <button type="button" className="manabi-button" disabled={!ready || starting} onClick={start}>
          {starting ? '첫 질문을 받는 중…' : '대화 시작'}
        </button>
        <p className="conv-new__note">대화는 내 서재에 비공개로 남아요. 언제든 지울 수 있어요.</p>
        {error && <p className="conv-new__error" role="alert">{error}</p>}
      </div>

      {recentRows.length > 0 && (
        <section className="conv-new__group" aria-labelledby="conv-new-recent">
          <h2 id="conv-new-recent">이어서 하기</h2>
          <ul className="conv-new__recent">
            {recentRows.map((row) => (
              <li key={row.id}>
                <Link href={`${conversationHref(row.id)}?returnTo=${encodeURIComponent(returnTo)}`}>
                  <b>{row.title}</b>
                  <small>{conversationShelfMeta(row, { languageName: langNameKo })}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
