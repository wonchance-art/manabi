'use client';
/**
 * 배움(`/home`) — 대시보드 (LEARN-HOME-AK-001, 오너 확정 목업 2026-10-09 · 정정 2026-10-11 · D-X6 2026-10-12).
 *
 *   배움 [언어 칩]                                현황 전체 →
 *   [ 이어 읽기 2×2 ][ 진행바 2×1               ]
 *   [               ][ 오늘 목표 ][ 연속         ]
 *   [ 단어 복습 2×2 ][ 오늘 문단 2×2            ]
 *
 * - 언어 칩(글자, LANG_NAME_KO)이 이어 읽기 · 단어 복습 · 오늘 문단의 언어를 정한다.
 * - 단어 복습 숫자 = countReviewScope({…, scope:{lang}}).total(문법 제외). 칸 주소 = serializeReviewScope({lang}).
 * - 이어 읽기 목적지 선택은 기존 정본 그대로: 계정 · 판별 기록(useReadingProgress) vs 서재 자료를 실제 시각으로
 *   비교(chooseResume)하고, 첫 렌더 뒤에는 목적지를 고정한다(배경 재조회로 버튼이 바뀌지 않게).
 * - 예보 탭 기록(buildForecastTapEvent → logReviewEvents)은 오늘 문단 칸으로 옮겼다.
 * - 휴대폰 순서(이어 읽기 → 단어 복습 → 오늘 문단 → 상태 묶음)는 클래스 order로 정한다(nth-child 금지).
 */
import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { literatureDisplayTitle } from '@/lib/literatureWorks'; // 표시용 대조표만(LIT-DISPLAY-001) — 전체 대조표를 홈 번들에 싣지 않는다
import { bookHref } from '@/lib/textbook/contract';
import { bookResume, chooseResume, recentMaterial } from '@/lib/webNavigation';
import useReadingProgress from '@/components/books/useReadingProgress';
import ContinueDeck from '@/components/ContinueDeck';
import { useGroupEntryItem } from '@/lib/useGroupEntryItem';
import { buildForecastTapEvent } from '@/lib/forecastTapEvent';
import { logReviewEvents } from '@/lib/reviewEvents';
import { getIdealLevel } from '@/lib/levels';
import { rankSuggestions } from '@/lib/suggestionRank';
import { detectLang, langNameKo } from '@/lib/constants';
import { canReadSuggestion, suggestionHref, TODAY_SUGGESTIONS_KEY, fetchTodaySuggestions } from '@/lib/suggestionReading';
import { fetchVocabularyLearningRows } from '@/lib/vocabularyLearningRows';
import { countReviewScope, reviewScopeQuota, serializeReviewScope } from '@/lib/reviewScope';
import { useLearningAdmission } from '@/lib/useLearningAdmission';
import { DEFAULT_NEW_PER_DAY, loadIntroIds, loadNewPerDay } from '@/lib/vocabStudy';
import { levelResumeCard, readLevelSnapshot } from '@/lib/levelList';
import { GUEST_RESUME_GLYPH, LEARN_LANGS, PREFETCH_WINDOW_MS, RESUME_GLYPH, learnLangLabel, materialInLang, paragraphState } from '@/lib/learnDashboard';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import useLearnLanguage from '@/components/learn/useLearnLanguage';
import LangChips from '@/components/learn/LangChips';
import ResumeTile from '@/components/learn/ResumeTile';
import ParagraphTile from '@/components/learn/ParagraphTile';
import { keepPreviousForUser } from '@/lib/keepPreviousForUser';
import GoalTrackTile from '@/components/learn/GoalTrackTile';
import { GuestLoginTile, ReviewTile, StreakTile, TodayGoalTile } from '@/components/learn/LearnTiles';
import '@/components/learn/learn.css';
import { authEntryHref } from '../lib/authRedirect';

export async function fetchHomeData(userId, nowMs = Date.now()) {
  // 전체 두 코호트를 같은 snapshot에서 합친 뒤 센다. 구형 due WHERE로 먼저 자르지 않는다.
  const [learning, recentResult, { buildForecast }] = await Promise.all([
    fetchVocabularyLearningRows(userId, { fields: 'summary' }),
    supabase.from('reading_progress')
      .select('material_id, is_completed, updated_at, reading_materials(id, title, language:processed_json->metadata->>language, level:processed_json->metadata->>level, book:processed_json->metadata->book, provider:processed_json->metadata->literature->>provider)')
      .eq('user_id', userId).eq('is_completed', false).order('updated_at', { ascending: false }).limit(20),
    import('@/lib/forecast'),
  ]);
  if (recentResult.error) throw recentResult.error;
  const vocab = learning.rows;
  const effectiveNow = Math.max(nowMs, Date.parse(learning.now));
  const forecastByLang = Object.fromEntries(LEARN_LANGS.map(lang => [lang,
    buildForecast(learning.projections.filter(p => p.vocabulary.language === lang), new Date(effectiveNow))]));
  return { learning, now: effectiveNow, recentProgress: recentResult.data || [], vocab,
    vocabByLang: vocab.reduce((all, v) => { const key = v.language || detectLang(v.word_text || ''); all[key] = (all[key] || 0) + 1; return all; }, {}),
    forecastByLang };
}

/** 배움 단어 복습 칸 숫자 — 복습방과 같은 개수 함수(countReviewScope)의 total. 문법은 넣지 않는다. 한도를 모르면 null(숫자 없음). */
export function learnReviewCount({ snapshot, lang, quota, now }) {
  if (!snapshot || !quota || !lang) return null;
  const result = countReviewScope({ snapshot, quota, scope: { lang, level: null, source: null, state: 'due' }, now });
  return result.status === 'ready' ? result.total : null;
}

/** 오늘 문단 — 준비된(prefetched · 48시간 이내) 문단의 첫 문장. 테이블이 없거나 실패하면 null(다음 상태로). */
export async function fetchPrefetchedSentence(userId, lang, nowMs = Date.now()) {
  const cutoff = new Date(nowMs - PREFETCH_WINDOW_MS).toISOString();
  const { data, error } = await supabase.from('study_paragraphs')
    .select('created_at, sentence:paragraph->sentences->0->>text')
    .eq('user_id', userId).eq('lang', lang).eq('status', 'prefetched').gt('created_at', cutoff)
    .order('created_at', { ascending: false }).limit(1);
  if (error) return null;
  return data?.[0]?.sentence || null;
}

const GLYPH = RESUME_GLYPH;
const GUEST_SAMPLE = '駅前の小さなパン屋で、今日も同じパンを買いました。';

function bookItem(book, resume) {
  const lesson = resume.lesson;
  const titleJa = typeof lesson.titleJa === 'string' && lesson.titleJa.trim() ? lesson.titleJa.trim() : null;
  return { lang: 'Japanese', kicker: '일본어 N5', number: String(lesson.number).padStart(2, '0'), glyph: GLYPH.Japanese,
    // 원어 제목이 비면 한국어 제목이 주 제목(지금 동작과 같음) — 42과 원어 제목 저작은 별도 콘텐츠 작업.
    title: titleJa || lesson.title, titleLang: titleJa ? 'ja' : 'ko', sub: titleJa ? lesson.title : lesson.subtitle,
    count: { done: resume.completed, total: resume.total }, href: bookHref(book.edition, resume.page),
    cta: resume.started ? '이어 읽기' : '첫 페이지 열기' };
}

function materialItem(material, lang) {
  const m = material.reading_materials;
  const materialLang = m.language || lang;
  return { lang: materialLang, kicker: `내 서재 · ${learnLangLabel(materialLang)}`, glyph: GLYPH[materialLang] || '文',
    // 서재에 예전 표기(「鼻 — 1편」)로 옮겨 둔 정본 문학책도 정본 표기(「鼻 (1/2)」)로(AOZORA-P0-5 — 다시 받지 않아도 된다)
    title: literatureDisplayTitle({ book: m.book, literature: { provider: m.provider } }, m.title),
    titleLang: encounterLookupLang(materialLang) || undefined, sub: m.level || null,
    href: `/viewer/${m.id}`, cta: '이어 읽기' };
}

const HSK_WORDS_ITEM = { key: 'hsk-words', href: '/chinese/vocab/h1', tone: 'progress',
  kicker: '중국어 · HSK', title: 'HSK 단어 목록', meta: '1급부터 ↗' };

// 교재 판본(book)은 서버가 기다리지 않고 약속(bookPromise)으로 넘긴다(LCP-UNSUSPEND — 조정 승인 2026-10-17 KST).
// 판본이 필요한 것은 이어 읽기 칸과 저장 불가 안내뿐이라, 그 둘만 안쪽 Suspense에서 받는다 — 맛보기 문단 · 로그인 칸 ·
// 제목은 서버 첫 HTML(뼈대)에 바로 들어간다(예전엔 화면 전체가 판본 조회 뒤 스트리밍 조각으로 늦게 끼워졌다).
// 대기 그림은 배움 대기 화면(loading.jsx)과 같은 <ResumeTile pending /> — 자리 · 모양이 같다.
// book(값)도 받는다 — 판본을 이미 가진 호출부 · 테스트용. 약속이 있으면 약속이 우선이다.
function useBook(bookPromise, book) {
  return bookPromise ? use(bookPromise) : book;
}

function ResumeSlot({ bookPromise, book: bookValue, user, authLoading, isLoading, data, lang, pendingGlyph }) {
  const book = useBook(bookPromise, bookValue);
  const local = useReadingProgress(book?.edition);
  const resume = bookResume(book, local.progress, local.hasProgress);
  // 이어 읽기 — 일본어는 교재 기록과 서재 자료를 실제 시각으로 비교, 다른 언어는 그 언어의 서재 자료 → 산책 추천.
  const pending = authLoading || (!!book && !local.ready) || (!!user && isLoading);
  const material = recentMaterial((data?.recentProgress || []).filter(row => materialInLang(row, lang)));
  const bookForLang = lang === 'Japanese' ? resume : null;
  // Once rendered, keep the primary destination stable during background query refreshes.
  // A user/account, edition or language change gets a fresh choice. Position still updates from real records.
  const choice = useRef(null);
  const choiceKey = `${user?.id || 'guest'}:${book?.edition || ''}:${lang}`;
  if (choice.current?.key !== choiceKey) choice.current = null;
  if (!pending && !choice.current) choice.current = { key: choiceKey, kind: chooseResume(bookForLang, local.updatedAt, material), material };
  const kind = choice.current?.kind || null;
  const needSuggestion = !pending && !kind && !(lang === 'Japanese' && !book);
  const recommendations = useQuery({ queryKey: TODAY_SUGGESTIONS_KEY, queryFn: fetchTodaySuggestions, staleTime: 300000, enabled: needSuggestion });
  const suggestion = useMemo(() => rankSuggestions((recommendations.data || []).filter(canReadSuggestion), {
    langs: [lang], fitOf: () => null,
    levelOf: s => getIdealLevel(s.language, data?.vocabByLang?.[s.language] || 0),
  }).find(s => s.language === lang) || null, [recommendations.data, data, lang]);

  let resumeItem = null;
  if (kind === 'material' && choice.current.material) resumeItem = materialItem(choice.current.material, lang);
  else if (kind === 'book' && resume) resumeItem = bookItem(book, resume);
  else if (lang === 'Japanese' && !book) resumeItem = { lang, kicker: '교재', glyph: GLYPH.Japanese, title: '교재 정보를 불러오지 못했어요',
    sub: '교재 목록에서 다시 골라 주세요.', href: '/lessons', cta: '교재 보기' };
  else if (suggestion) resumeItem = { lang, kicker: '산책 추천', glyph: '文', title: suggestion.title, titleLang: encounterLookupLang(suggestion.language) || undefined,
    sub: [langNameKo(suggestion.language), suggestion.level].filter(Boolean).join(' · '), href: suggestionHref(suggestion, 'home'), cta: '읽어 보기' };
  else if (!pending) resumeItem = { lang, kicker: '산책', glyph: GLYPH[lang] || '文', title: '오늘 읽을 글을 골라 보세요',
    sub: `${learnLangLabel(lang)} 읽을거리`, href: '/discover', cta: '산책하기' };
  const resumePending = pending || (needSuggestion && recommendations.isLoading);
  return <ResumeTile item={resumeItem} pending={resumePending} glyph={pendingGlyph} />;
}

// 저장 불가 안내 — 판본(edition)별 읽은 위치 저장소를 읽어 본 뒤에만 안다(useReadingProgress). 판본을 기다리는 동안은 없다(예전과 같다).
function StorageNote({ bookPromise, book: bookValue }) {
  const book = useBook(bookPromise, bookValue);
  const local = useReadingProgress(book?.edition);
  return !local.storageAvailable ? <p role="status" className="learn-note">이 브라우저에서는 읽던 위치를 저장할 수 없어요.</p> : null;
}

export default function HomePage({ book = null, bookPromise, sessionHint }) {
  const { user, profile, loading: authLoading } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['home-v3', user?.id], queryFn: () => fetchHomeData(user.id),
    enabled: !!user && !authLoading, staleTime: 60000, refetchOnWindowFocus: true,
  });
  const { langs, lang, choose } = useLearnLanguage(profile, data?.vocabByLang);
  // 언어 칩을 바꾸는 동안 이전 언어의 문단을 흐리게 남긴다(LIST-KEEP — 「시작하면 오늘 문단을 만들어요」 거짓 빈 상태가
  // 잠깐 끼던 것). 결과에 언어를 함께 담아, 남긴 문장의 lang 속성이 그 문장의 언어를 따른다. 같은 계정일 때만.
  const paragraph = useQuery({
    queryKey: ['learn-paragraph', user?.id, lang], queryFn: async () => ({ lang, sentence: await fetchPrefetchedSentence(user.id, lang) }),
    enabled: !!user && !authLoading, staleTime: 300000, placeholderData: keepPreviousForUser(user?.id),
  });
  // 새 표현 한도 — 복습방과 같은 입력(reviewScopeQuota): 서버 한도, 호환 모드면 이 기기의 하루 한도 − 오늘 시작한 수.
  const admission = useLearningAdmission({ accountId: user?.id });
  const [device, setDevice] = useState({ newPerDay: DEFAULT_NEW_PER_DAY, introIds: [] });
  useEffect(() => {
    setDevice({ newPerDay: loadNewPerDay(), introIds: loadIntroIds() });
  }, []);
  const quota = reviewScopeQuota(admission, { ...device, vocabIds: data?.vocab?.map(v => v.id) });
  const reviewCount = learnReviewCount({ snapshot: data?.learning, lang, quota, now: data?.now });
  const reviewHref = serializeReviewScope({ lang });

  const forecast = data?.forecastByLang?.[lang];
  const forecastWords = forecast?.count > 0 && forecast.top3?.length > 0 && forecast.top3.map(w => w.word_text);
  const paragraphTileState = paragraphState({ sentence: paragraph.data?.sentence, forecastWords });
  const onForecastTap = () => {
    if (user?.id && forecast) { try { logReviewEvents(user.id, [buildForecastTapEvent(lang, forecast)]); } catch { /* Existing optional telemetry. */ } }
  };
  // 「다시 읽기」 · 「말해 보기」 칸은 배움에서 뺐다(오너 지시 2026-10-25 KST) — 새 대화는 하단 「대화」 · 서재 · 자료 추가 입구가 그대로 연다.
  // 덱에는 학습 그룹(있을 때만)이 남는다.
  const groupItem = useGroupEntryItem({ invite: false });
  const continueDeckItems = [groupItem].filter(Boolean);
  // HSK 단어 — 이 기기에 남은 진도가 있으면 마지막 레벨로 이어 하기(붙은 뒤에 읽는다 — 서버 렌더와 첫 렌더는 「1급부터」로 같다).
  const [hskResume, setHskResume] = useState(null);
  useEffect(() => { try { setHskResume(levelResumeCard(readLevelSnapshot(localStorage, 'chinese'))); } catch { /* 저장소 차단 — 1급부터 */ } }, []);
  const hskItem = hskResume ? { ...HSK_WORDS_ITEM, ...hskResume } : HSK_WORDS_ITEM;

  // 손님 배치 판정 — 아래 손님 화면과 같은 조건(B1).
  const guestLayout = !user && (!authLoading || sessionHint === false);
  // 이어 읽기 칸 · 저장 불가 안내 — 판본을 받는 동안은 배움 대기 화면과 같은 골격 칸(자리 · 모양 같음).
  // 손님이면 골격도 장식 글자(「あ」)를 첫 그림부터 그린다(HOME-GLYPH-LCP-001) — 손님 학습 언어는 늘 일본어라 글자를 서버도 안다.
  // 붙은 뒤 늦게 끼던 130px 글자가 화면에서 가장 큰 글이라 LCP를 늦췄다. 자리는 absolute라 CLS 0.
  // 로그인은 글자가 학습 언어 · 고른 칩 · 서재 자료로 정해져 서버가 모른다 — 골격에 글자 없음(그대로, 틀린 글자 → 바뀜 금지).
  const pendingGlyph = guestLayout ? GUEST_RESUME_GLYPH : null;
  const resumeSlot = <Suspense fallback={<ResumeTile pending glyph={pendingGlyph} />}><ResumeSlot bookPromise={bookPromise} book={book} user={user} authLoading={authLoading} isLoading={isLoading} data={data} lang={lang} pendingGlyph={pendingGlyph} /></Suspense>;
  const storageNote = <Suspense fallback={null}><StorageNote bookPromise={bookPromise} book={book} /></Suspense>;

  // 손님 배치 — 서버가 세션 쿠키가 없다고 알려 주면(sessionHint === false) 로그인 확인을 기다리지 않는다(B1 — 오너 승인
  // 2026-10-17 KST). 서버 HTML · 첫 그림 · 확인 뒤가 모두 같은 손님 배치라, 로그인 배치 골격이 0.7초 보였다가 바뀌던 것이 없다.
  // 쿠키가 있는데 세션이 끝났으면(만료 등) 예전처럼 확인을 기다린다.
  if (guestLayout) {
    return <div className="manabi-page learn-page">
      <div className="learn-top"><div className="learn-top__title"><h1>배움</h1></div></div>
      <div className="learn-grid">
        {resumeSlot}
        <ParagraphTile state={{ kind: 'ready', sentence: GUEST_SAMPLE }} lang="Japanese" href="/study" kicker="오늘 문단 · 맛보기" />
        <GuestLoginTile href={authEntryHref('/home')} />
      </div>
      {storageNote}
    </div>;
  }

  return <div className="manabi-page learn-page">
    <div className="learn-top">
      <div className="learn-top__title"><h1>배움</h1><LangChips langs={langs} lang={lang} onChange={choose} /></div>
      <Link href="/progress" prefetch={false} className="learn-toplink">현황 전체 →</Link>
    </div>
    {error && <div className="manabi-inline-state" role="alert">학습 기록을 불러오지 못했어요. 읽기와 책장은 계속 이용할 수 있어요. <button type="button" onClick={() => refetch()}>다시 시도</button></div>}
    <div className="learn-grid">
      {resumeSlot}
      <div className="learn-quad learn-order-status">
        <GoalTrackTile />
        <TodayGoalTile vocab={data?.vocab || []} projections={data?.learning?.projections || []} profile={profile} empty={!data} />
        <StreakTile profile={profile} />
      </div>
      {/* 처음 받는 중에는 빈 상태(「아직 수집한 단어가 없어요」 · 「시작하면 오늘 문단을 만들어요」) 대신 골격(LOADING-SKELETON-001). */}
      <ReviewTile projections={data?.learning?.projections || []} lang={lang} count={reviewCount} href={reviewHref} className="learn-order-review"
        pending={!data && (authLoading || isLoading)} />
      <ParagraphTile state={paragraphTileState} lang={paragraphTileState.kind === 'ready' ? paragraph.data?.lang || lang : lang} busy={paragraph.isPlaceholderData}
        pending={paragraph.isPending} href={`/study?lang=${lang}`} onForecastTap={onForecastTap} />
    </div>
    {storageNote}
    {continueDeckItems.length > 0 && <section className="learn-more" aria-label="이어서"><ContinueDeck items={continueDeckItems} /></section>}
    {/* 임시 입구(오너 지시 2026-10-15 KST) — HSK 단어 목록이 내비에 자리를 잡을 때까지. 덱과 같은 카드 양식. */}
    <section className="learn-more" aria-label="HSK 단어"><ContinueDeck items={[hskItem]} /></section>
  </div>;
}
