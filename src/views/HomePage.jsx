'use client';
import { useMemo, useRef } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { bookHref } from '@/lib/textbook/contract';
import { bookResume, chooseResume, recentMaterial } from '@/lib/webNavigation';
import useReadingProgress from '@/components/books/useReadingProgress';
import BookCover from '@/components/books/BookCover';
import SuggestionArtwork from '@/components/SuggestionArtwork';
import ContinueDeck from '@/components/ContinueDeck';
import { useRereadCandidate } from '@/lib/useRereadCandidate';
import { useGroupEntryItem } from '@/lib/useGroupEntryItem';
import { buildForecastTapEvent } from '@/lib/forecastTapEvent';
import { logReviewEvents } from '@/lib/reviewEvents';
import { getIdealLevel } from '@/lib/levels';
import { materialFit } from '@/lib/materialFit';
import { rankSuggestions, REASON } from '@/lib/suggestionRank';
import { detectLang, langNameKo } from '@/lib/constants';
import { canReadSuggestion, suggestionHref } from '@/lib/suggestionReading';

export async function fetchHomeData(userId, lang, nowMs = Date.now()) {
  const [dueResult, recentResult, allVocabResult, forecastResult, { buildForecast }] = await Promise.all([
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).lte('next_review_at', new Date(nowMs).toISOString()),
    supabase.from('reading_progress')
      .select('material_id, is_completed, updated_at, reading_materials(id, title)')
      .eq('user_id', userId).eq('is_completed', false).order('updated_at', { ascending: false }).limit(20),
    supabase.from('user_vocabulary').select('language, word_text, base_form').eq('user_id', userId),
    supabase.from('user_vocabulary').select('word_text, interval, last_reviewed_at')
      .eq('user_id', userId).eq('language', lang).not('last_reviewed_at', 'is', null).gt('interval', 0),
    import('@/lib/forecast'),
  ]);
  const dbResults = [dueResult, recentResult, allVocabResult, forecastResult];
  const failed = dbResults.find(result => result?.error);
  if (failed) throw failed.error;
  const vocab = allVocabResult.data || [];
  return { dueCount: dueResult.count || 0, recentProgress: recentResult.data || [], vocab,
    vocabByLang: vocab.reduce((all, v) => { const key = v.language || detectLang(v.word_text || ''); all[key] = (all[key] || 0) + 1; return all; }, {}),
    forecast: buildForecast(forecastResult.data || [], new Date(nowMs)) };
}

async function fetchSuggestions() {
  const response = await fetch('/api/suggestions/today');
  if (!response.ok) throw new Error('추천을 불러오지 못했어요.');
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function reasonText(rank) {
  const pct = rank?.unknownRatio == null ? null : Math.round((1 - rank.unknownRatio) * 100);
  switch (rank?.reason) {
    case REASON.FIT: return `아는 단어 ${pct}% · 알맞은 난이도`;
    case REASON.FIT_EASY: return `아는 단어 ${pct}% · 가볍게 읽기`;
    case REASON.FIT_HARD: return `아는 단어 ${pct}% · 도전하는 읽기`;
    case REASON.LEVEL: return '내 수준에 맞춘 추천';
    case REASON.LEVEL_NEAR: return '내 수준 근처';
    case REASON.LANG: return '학습 중인 언어';
    case REASON.OTHER: return '오늘의 추천';
    default: return null;
  }
}

export default function HomePage({ book = null }) {
  const { user, profile, loading: authLoading } = useAuth();
  const local = useReadingProgress(book?.edition);
  const resume = bookResume(book, local.progress, local.hasProgress);
  const lang = (Array.isArray(profile?.learning_language) ? profile.learning_language[0] : profile?.learning_language) || 'Japanese';
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['home-v2', user?.id, lang], queryFn: () => fetchHomeData(user.id, lang),
    enabled: !!user && !authLoading, staleTime: 60000, refetchOnWindowFocus: true,
  });
  const recommendations = useQuery({ queryKey: ['today-suggestions'], queryFn: fetchSuggestions, staleTime: 300000 });
  const fitIds = useMemo(() => [...new Set((recommendations.data || []).map(s => s.material_id).filter(Boolean))].slice(0, 12), [recommendations.data]);
  const fits = useQuery({ queryKey: ['home-suggestion-fit-v2', user?.id, fitIds], enabled: !!user && fitIds.length > 0,
    queryFn: async () => { const result = await supabase.from('reading_materials').select('id, processed_json').in('id', fitIds); if (result.error) throw result.error; return result.data || []; }, staleTime: 300000 });
  const suggestions = useMemo(() => {
    const known = { surfaces: new Set((data?.vocab || []).map(v => v.word_text).filter(Boolean)), bases: new Set((data?.vocab || []).map(v => v.base_form).filter(Boolean)) };
    const fitMap = Object.fromEntries((fits.data || []).map(m => [m.id, materialFit(m.processed_json, known)]));
    return rankSuggestions((recommendations.data || []).filter(canReadSuggestion), {
      langs: Array.isArray(profile?.learning_language) ? profile.learning_language : [lang],
      fitOf: s => fitMap[s.material_id] ?? null,
      levelOf: s => getIdealLevel(s.language, data?.vocabByLang?.[s.language] || 0),
    }).slice(0, 2);
  }, [recommendations.data, fits.data, data, profile, lang]);
  const rereadItem = useRereadCandidate();
  const groupItem = useGroupEntryItem();
  const forecast = data?.forecast;
  const continueDeckItems = [forecast?.count > 0 && forecast.top3?.length > 0 && {
    key: 'forecast', href: '/study', tone: 'review', kicker: '다시 꺼낼 표현',
    title: `${forecast.top3[0].word_text} · ${forecast.count}개 표현을 가볍게 복습해요.`,
    chips: forecast.top3.map(w => w.word_text), onClick: () => {
      if (user?.id) { try { logReviewEvents(user.id, [buildForecastTapEvent(lang, forecast)]); } catch { /* Existing optional telemetry. */ } }
    },
  }, rereadItem, groupItem].filter(Boolean);
  const material = recentMaterial(data?.recentProgress);
  const pending = authLoading || (!!book && !local.ready) || (!!user && isLoading);
  // Once rendered, keep the primary destination stable during background query refreshes.
  // A user/account or edition change gets a fresh choice. Position still updates from real records.
  const choice = useRef(null);
  const choiceKey = `${user?.id || 'guest'}:${book?.edition || ''}`;
  if (choice.current?.key !== choiceKey) choice.current = null;
  if (!pending && !choice.current) choice.current = { key: choiceKey, kind: chooseResume(resume, local.updatedAt, material), material };
  const activeMaterial = choice.current?.kind === 'material' ? choice.current.material : null;
  const activeTitle = activeMaterial?.reading_materials.title || resume?.lesson.title;
  const activeHref = activeMaterial ? `/viewer/${activeMaterial.reading_materials.id}` : resume ? bookHref(book.edition, resume.page) : '/lessons';
  const started = !!activeMaterial || resume?.started;
  const quote = resume?.lesson.quote;
  return <div className="manabi-page manabi-today">
    <section className="today-opening" aria-label="오늘의 읽기">
      <div className="today-copy"><p className="manabi-eyebrow">YOUR NEXT PAGE / 오늘</p>
        <h1>당신의<br /><em>다음 페이지.</em></h1>
        <p className="today-intro">한 문장을 읽고, 나의 세계를 조금 더 넓게.</p>
        {pending ? <div className="today-location" role="status">읽던 위치를 확인하고 있어요…</div> : <div className="today-location">
          <span className="today-location__number" aria-hidden="true">{activeMaterial || !resume ? '↗' : String(resume.lesson.number).padStart(2, '0')}</span>
          <div><small>{activeMaterial ? '내 서재 · 읽는 중' : resume ? `일본어 N5 · ${resume.total}과` : 'manabi books'}</small><strong>{activeTitle || '나에게 맞는 책을 골라 보세요'}</strong><span>{started ? '기억해 둔 곳에서 이어가요.' : '처음이라면, 이 한 문장부터.'}</span></div>
        </div>}
        <div className="manabi-row"><Link className="manabi-button" href={activeHref} aria-disabled={pending || undefined} onClick={event => { if (pending) event.preventDefault(); }}>{started ? '이어서 읽기' : '첫 페이지 열기'} <span aria-hidden="true">↗</span></Link><Link className="manabi-link" href="/lessons">책장 둘러보기</Link></div>
        {resume && local.ready && <p className="today-record">이 브라우저의 교재 기록 · {resume.completed} / {resume.total}과 학습</p>}
        {!local.storageAvailable && <p role="status" className="today-record">이 브라우저에서는 읽던 위치를 저장할 수 없어요.</p>}
        {!book && <p role="status" className="today-record">지금은 교재 정보를 불러올 수 없어요. <button type="button" onClick={() => location.reload()}>다시 확인</button></p>}
      </div>
      <div className="today-book-scene" aria-label={activeMaterial ? '내 서재에서 읽는 글' : '지금 펼칠 일본어'}>
        <div className="today-open-book">{activeMaterial ? <div className="today-material-cover"><small>manabi library</small><strong>읽는 중</strong><span aria-hidden="true">↗</span><small>나의 다음 페이지</small></div> : <BookCover />}<div className="today-open-page"><div className="today-page-top"><span>{activeMaterial ? 'MY LIBRARY' : 'JAPANESE / N5'}</span><i aria-hidden="true" /></div>
          <span className="today-page-orb" aria-hidden="true" /><div className="today-page-quote">{activeMaterial ? <h2>{activeTitle}</h2> : <><small>{String(resume?.lesson.number || 1).padStart(2, '0')} / {resume?.lesson.subtitle || '일본어로 만나는 일상'}</small><p lang="ja">{typeof quote === 'string' ? quote : quote?.ja || '日本語'}</p>{quote?.ko && <span>{quote.ko}</span>}</>}</div>
          <div className="today-page-bottom"><span>manabi reading room</span><span>↗</span></div></div></div>
        <p>조금씩 읽고, 오래 기억하는.</p>
      </div>
    </section>
    {error && <div className="manabi-inline-state" role="alert">학습 기록을 불러오지 못했어요. 읽기와 책장은 계속 이용할 수 있어요. <button type="button" onClick={() => refetch()}>다시 불러오기</button></div>}
    <div className="today-bottom">
      <section className="today-review"><p className="manabi-eyebrow">KEEP IT WITH YOU / 복습</p><h2>{authLoading || (user && isLoading) ? '복습 일정을 확인하는 중.' : !user ? '좋은 표현을 내 것으로.' : error ? '복습 기록을 다시 확인해요.' : data?.dueCount > 0 ? <><b>{data.dueCount}</b>개의 표현이<br /> 기다리고 있어요.</> : data?.vocab?.length ? <>오늘은 가볍게,<br /> 읽기를 이어가요.</> : <>기억하고 싶은<br /> 첫 표현을 담아 보세요.</>}</h2>
        <p>{!user ? '로그인하면 읽다가 고른 표현을 담고 복습할 수 있어요.' : error ? '복습 화면에서 기록을 다시 확인할 수 있어요.' : isLoading ? '복습 일정을 확인하고 있어요…' : data?.dueCount > 0 ? '새 표현을 포함한 대기 목록이에요. 오늘 분량은 복습 화면에서 확인하세요.' : '예문 아래 ‘이 예문 담기’로 시작할 수 있어요.'}</p><Link href={user ? '/vocab' : '/auth'} prefetch={false} className="manabi-link">{user ? '표현과 복습 열기' : '로그인하고 시작하기'} ↗</Link>
        {user && <Link className="today-growth" href="/profile">성장 기록과 설정 →</Link>}
      </section>
      <section className="today-discovery"><div className="manabi-section-heading"><div><p className="manabi-eyebrow">OFF THE PAGE</p><h2>책 밖의 한 장면</h2></div><Link className="manabi-link" href="/discover">발견 ↗</Link></div>
        {recommendations.isLoading ? <p role="status">오늘의 읽을거리를 펼치고 있어요…</p> : recommendations.error ? <p role="status">추천을 불러오지 못했어요. <button type="button" onClick={() => recommendations.refetch()}>다시 확인</button></p> : suggestions.length ? suggestions.map(s => <Link key={s.id} className="today-story" href={suggestionHref(s, 'home')} prefetch={false}><SuggestionArtwork suggestion={s} /><div><small>{langNameKo(s.language)} · {s.level || '읽을거리'}</small><h3>{s.title}</h3><p>{(user && data?.vocab?.length ? reasonText(s.rank) : null) || s.channel_name || '오늘의 추천'} <span>↗</span></p><small>바로 읽기</small></div></Link>) : <Link className="today-editorial" href="/discover"><span lang="ja" aria-hidden="true">文 化</span><div><small>문화와 지역학</small><h3>말이 태어나는 곳을<br />함께 읽어볼까요?</h3><p>일본·한국·프랑스의 이야기 ↗</p></div></Link>}
      </section>
    </div>
    {user && continueDeckItems.length > 0 && <section className="today-tools"><div className="manabi-section-heading"><h2>학습을 이어가는 방법</h2><Link href="/materials" className="manabi-link">내 서재 ↗</Link></div><ContinueDeck items={continueDeckItems} /></section>}
    {material && !activeMaterial && <Link className="today-library-row" href={`/viewer/${material.reading_materials.id}`}><span>내 서재에서 읽는 중</span><strong>{material.reading_materials.title}</strong><span>이어 읽기 ↗</span></Link>}
  </div>;
}
