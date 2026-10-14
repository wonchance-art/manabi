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
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { bookHref } from '@/lib/textbook/contract';
import { bookResume, chooseResume, recentMaterial } from '@/lib/webNavigation';
import useReadingProgress from '@/components/books/useReadingProgress';
import ContinueDeck from '@/components/ContinueDeck';
import { useRereadCandidate } from '@/lib/useRereadCandidate';
import { useGroupEntryItem } from '@/lib/useGroupEntryItem';
import { buildForecastTapEvent } from '@/lib/forecastTapEvent';
import { logReviewEvents } from '@/lib/reviewEvents';
import { getIdealLevel } from '@/lib/levels';
import { rankSuggestions } from '@/lib/suggestionRank';
import { detectLang, langNameKo } from '@/lib/constants';
import { canReadSuggestion, suggestionHref } from '@/lib/suggestionReading';
import { fetchVocabularyLearningRows } from '@/lib/vocabularyLearningRows';
import { countReviewScope, reviewScopeQuota, serializeReviewScope } from '@/lib/reviewScope';
import { useLearningAdmission } from '@/lib/useLearningAdmission';
import { DEFAULT_NEW_PER_DAY, NEW_PER_DAY_OPTIONS, loadIntroIds } from '@/lib/vocabStudy';
import { LEARN_LANGS, PREFETCH_WINDOW_MS, learnLangLabel, materialInLang, paragraphState } from '@/lib/learnDashboard';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import useLearnLanguage from '@/components/learn/useLearnLanguage';
import LangChips from '@/components/learn/LangChips';
import ResumeTile from '@/components/learn/ResumeTile';
import ParagraphTile from '@/components/learn/ParagraphTile';
import GoalTrackTile from '@/components/learn/GoalTrackTile';
import { ReviewTile, StreakTile, TodayGoalTile } from '@/components/learn/LearnTiles';
import '@/components/learn/learn.css';

export async function fetchHomeData(userId, nowMs = Date.now()) {
  // 전체 두 코호트를 같은 snapshot에서 합친 뒤 센다. 구형 due WHERE로 먼저 자르지 않는다.
  const [learning, recentResult, { buildForecast }] = await Promise.all([
    fetchVocabularyLearningRows(userId, { fields: 'summary' }),
    supabase.from('reading_progress')
      .select('material_id, is_completed, updated_at, reading_materials(id, title, language:processed_json->metadata->>language, level:processed_json->metadata->>level)')
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

async function fetchSuggestions() {
  const response = await fetch('/api/suggestions/today');
  if (!response.ok) throw new Error('추천을 불러오지 못했어요.');
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

const GLYPH = { Japanese: 'あ', Chinese: '汉', English: 'A', French: 'É' };
const GUEST_SAMPLE = '駅前の小さなパン屋で、今日も同じパンを買いました。';

function bookItem(book, resume) {
  const lesson = resume.lesson;
  const titleJa = typeof lesson.titleJa === 'string' && lesson.titleJa.trim() ? lesson.titleJa.trim() : null;
  return { lang: 'Japanese', kicker: '일본어 N5', number: String(lesson.number).padStart(2, '0'), glyph: GLYPH.Japanese,
    // 원어 제목이 비면 한국어 제목이 주 제목(지금 동작과 같음) — 42과 원어 제목 저작은 별도 콘텐츠 작업.
    title: titleJa || lesson.title, titleLang: titleJa ? 'ja' : 'ko', sub: titleJa ? lesson.title : lesson.subtitle,
    count: { done: resume.completed, total: resume.total }, href: bookHref(book.edition, resume.page),
    cta: resume.started ? '이어서 읽기' : '첫 페이지 열기' };
}

function materialItem(material, lang) {
  const m = material.reading_materials;
  const materialLang = m.language || lang;
  return { lang: materialLang, kicker: `내 서재 · ${learnLangLabel(materialLang)}`, glyph: GLYPH[materialLang] || '文',
    title: m.title, titleLang: encounterLookupLang(materialLang) || undefined, sub: m.level || null,
    href: `/viewer/${m.id}`, cta: '이어서 읽기' };
}

export default function HomePage({ book = null }) {
  const { user, profile, loading: authLoading } = useAuth();
  const local = useReadingProgress(book?.edition);
  const resume = bookResume(book, local.progress, local.hasProgress);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['home-v3', user?.id], queryFn: () => fetchHomeData(user.id),
    enabled: !!user && !authLoading, staleTime: 60000, refetchOnWindowFocus: true,
  });
  const { langs, lang, choose } = useLearnLanguage(profile, data?.vocabByLang);
  const paragraph = useQuery({
    queryKey: ['learn-paragraph', user?.id, lang], queryFn: () => fetchPrefetchedSentence(user.id, lang),
    enabled: !!user && !authLoading, staleTime: 300000,
  });
  // 새 표현 한도 — 복습방과 같은 입력(reviewScopeQuota): 서버 한도, 호환 모드면 이 기기의 하루 한도 − 오늘 시작한 수.
  const admission = useLearningAdmission({ accountId: user?.id });
  const [device, setDevice] = useState({ newPerDay: DEFAULT_NEW_PER_DAY, introIds: [] });
  useEffect(() => {
    let newPerDay = DEFAULT_NEW_PER_DAY;
    try { const stored = parseInt(localStorage.getItem('vocab_new_per_day'), 10); if (NEW_PER_DAY_OPTIONS.includes(stored)) newPerDay = stored; } catch { /* 저장소 차단 — 기본값 */ }
    setDevice({ newPerDay, introIds: loadIntroIds() });
  }, []);
  const quota = reviewScopeQuota(admission, { ...device, vocabIds: data?.vocab?.map(v => v.id) });
  const reviewCount = learnReviewCount({ snapshot: data?.learning, lang, quota, now: data?.now });
  const reviewHref = serializeReviewScope({ lang });

  const forecast = data?.forecastByLang?.[lang];
  const forecastWords = forecast?.count > 0 && forecast.top3?.length > 0 && forecast.top3.map(w => w.word_text);
  const onForecastTap = () => {
    if (user?.id && forecast) { try { logReviewEvents(user.id, [buildForecastTapEvent(lang, forecast)]); } catch { /* Existing optional telemetry. */ } }
  };
  const rereadItem = useRereadCandidate();
  const groupItem = useGroupEntryItem({ invite: false });
  const continueDeckItems = [rereadItem, groupItem].filter(Boolean);

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
  const recommendations = useQuery({ queryKey: ['today-suggestions'], queryFn: fetchSuggestions, staleTime: 300000, enabled: needSuggestion });
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

  if (!authLoading && !user) {
    return <div className="manabi-page learn-page">
      <div className="learn-top"><div className="learn-top__title"><h1>배움</h1></div></div>
      <div className="learn-grid">
        <ResumeTile item={resumeItem} pending={resumePending} />
        <ParagraphTile state={{ kind: 'ready', sentence: GUEST_SAMPLE }} lang="Japanese" href="/study" kicker="오늘 문단 · 맛보기" />
        <Link href="/auth" prefetch={false} className="learn-tile learn-goal--empty learn-guest">
          <span>
            <span className="learn-goal__title">로그인하면 여기에 쌓여요</span>
            <span className="learn-goal__line">단어 복습 · 오늘 목표 · 레벨 어휘 · 기록</span>
          </span>
          <span className="learn-button-s">로그인</span>
        </Link>
      </div>
      {!local.storageAvailable && <p role="status" className="learn-note">이 브라우저에서는 읽던 위치를 저장할 수 없어요.</p>}
    </div>;
  }

  return <div className="manabi-page learn-page">
    <div className="learn-top">
      <div className="learn-top__title"><h1>배움</h1><LangChips langs={langs} lang={lang} onChange={choose} /></div>
      <Link href="/progress" prefetch={false} className="learn-toplink">현황 전체 →</Link>
    </div>
    {error && <div className="manabi-inline-state" role="alert">학습 기록을 불러오지 못했어요. 읽기와 책장은 계속 이용할 수 있어요. <button type="button" onClick={() => refetch()}>다시 시도</button></div>}
    <div className="learn-grid">
      <ResumeTile item={resumeItem} pending={resumePending} />
      <div className="learn-quad learn-order-status">
        <GoalTrackTile />
        <TodayGoalTile vocab={data?.vocab || []} projections={data?.learning?.projections || []} profile={profile} empty={!data} />
        <StreakTile profile={profile} />
      </div>
      <ReviewTile projections={data?.learning?.projections || []} lang={lang} count={reviewCount} href={reviewHref} className="learn-order-review" />
      <ParagraphTile state={paragraphState({ sentence: paragraph.data, forecastWords })} lang={lang} href={`/study?lang=${lang}`} onForecastTap={onForecastTap} />
    </div>
    {!local.storageAvailable && <p role="status" className="learn-note">이 브라우저에서는 읽던 위치를 저장할 수 없어요.</p>}
    {continueDeckItems.length > 0 && <section className="learn-more" aria-label="이어서"><ContinueDeck items={continueDeckItems} /></section>}
  </div>;
}
