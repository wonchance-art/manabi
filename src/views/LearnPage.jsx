'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { kstWeekStartIso, KNOWN_WORD_MIN_INTERVAL, GROWTH_LABELS } from '../lib/growthStats';

/**
 * 학습 허브 — 오늘 할 학습으로 가는 단일 진입점.
 * 홈(HomePage)의 시각 언어를 그대로 재사용한다: 같은 컨테이너(home-layout)·
 * 인사 헤더(home-greeting)·이어하기 카드(lessons-continue)·읽기 카드·bento 타일.
 * 데이터도 홈과 동일하게 클라이언트 useQuery로 페칭한다.
 */
async function fetchLearnData(userId, lang) {
  const now = new Date().toISOString();
  const weekStartIso = kstWeekStartIso();

  // 실패 시 null (문구 생략용) — 홈/서재의 방어적 count 패턴과 동일
  const countOf = (q) => q.then(({ count }) => count ?? null, () => null);

  const [dueVocab, dueGrammar, knownWords, passedChapters, weekSessions, latestUsed] = await Promise.all([
    // due 어휘 — 현재 학습 언어, next_review_at <= now
    countOf(supabase.from('user_vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('language', lang).lte('next_review_at', now)),
    // due 문법 — grammar_review, next_review_at <= now
    countOf(supabase.from('grammar_review')
      .select('slug', { count: 'exact', head: true })
      .eq('user_id', userId).eq('lang', lang).lte('next_review_at', now)),
    // 아는 단어 — interval(안정도) ≥ 기준 (정의: growthStats.isKnownWord / 서재와 동치)
    countOf(supabase.from('user_vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('language', lang).gte('interval', KNOWN_WORD_MIN_INTERVAL)),
    // 통과 챕터 — user_ref_progress passed=true (서재와 동치)
    countOf(supabase.from('user_ref_progress')
      .select('slug', { count: 'exact', head: true })
      .eq('user_id', userId).eq('lang', lang).eq('passed', true)),
    // 이번 주 세션 — study_paragraphs status='used', used_at >= 주 시작 (서재와 동일 정의)
    countOf(supabase.from('study_paragraphs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('lang', lang).eq('status', 'used').gte('used_at', weekStartIso)),
    // 연재 — 가장 최근 used 문단 1행 (테이블 부재 시 null)
    supabase.from('study_paragraphs')
      .select('paragraph, materials, used_at, created_at')
      .eq('user_id', userId).eq('lang', lang).eq('status', 'used')
      .order('used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => (data && data[0]) || null, () => null),
  ]);

  // 이어지는 이야기 — arcSummary와 episode가 모두 있을 때만
  let episode = null;
  if (latestUsed) {
    const arc = latestUsed.paragraph?.arcSummary;
    const ep = Number(latestUsed.materials?.episode);
    if (typeof arc === 'string' && arc.trim() && Number.isFinite(ep) && ep >= 1) episode = ep;
  }

  return { dueVocab, dueGrammar, knownWords, passedChapters, weekSessions, episode };
}

export default function LearnPage() {
  const { user, profile } = useAuth();

  const lang = useMemo(() => {
    const fromProfile = Array.isArray(profile?.learning_language)
      ? profile.learning_language[0]
      : profile?.learning_language;
    return fromProfile || 'Japanese';
  }, [profile]);

  const { data } = useQuery({
    queryKey: ['learn', user?.id, lang],
    queryFn: () => fetchLearnData(user.id, lang),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  if (!user) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h2 style={{ marginBottom: '16px' }}>로그인이 필요합니다</h2>
      <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
    </div>
  );

  const displayName  = profile?.display_name || '학습자';
  const dueVocab     = data?.dueVocab;
  const dueGrammar   = data?.dueGrammar;
  const knownWords   = data?.knownWords;
  const passedChapters = data?.passedChapters;
  const weekSessions = data?.weekSessions;
  const episode      = data?.episode ?? null;
  const streak       = profile?.streak_count ?? 0;
  const streakFreeze = profile?.streak_freeze_count;

  const practice = [
    { href: '/study/library',  title: '서재',          desc: '지난 문단 다시 읽기',            accent: 'var(--primary)',    icon: '📖' },
    { href: '/review/grammar', title: '문법 복습',      desc: '돌아온 문법 다시 풀기', badge: dueGrammar, accent: 'var(--accent)', icon: '🧩' },
    { href: '/writing',        title: '작문 기록실',    desc: '내 작문 돌아보기',              accent: 'var(--warning)',    icon: '✍️' },
    { href: '/vocab',          title: '어휘 복습',      desc: '단어장 몰아서 복습', badge: dueVocab, accent: 'var(--danger)',  icon: '🗂️' },
    { href: '/study/library',  title: '내 자료로 학습', desc: '기사·문장을 붙여넣어 이야기로',  accent: 'var(--text-muted)', icon: '📥' },
    { href: '/guide',          title: '학습 가이드',    desc: '처음이라면 — 하루의 흐름 안내',  accent: 'var(--text-muted)', icon: '🧭' },
  ];

  return (
    <div className="page-container home-page home-layout" style={{ maxWidth: 720 }}>

      {/* 인사 헤더 — 홈 그리팅 패턴 그대로 */}
      <div className="home-greeting">
        <h1 className="home-greeting__name">오늘의 학습, {displayName}님</h1>
        <p className="home-greeting__sub">필요한 연습을 한곳에서 이어가 볼까요?</p>
      </div>

      {/* ① 오늘 학습 주 CTA — 홈 이어하기 카드 급 비중 */}
      <div>
        <Link href="/study" className="lessons-continue learn-cta">
          <span className="lessons-continue__body">
            <span className="lessons-continue__kicker">오늘 학습</span>
            <span className="lessons-continue__title">이야기 한 편이 준비됐어요</span>
          </span>
          <span className="lessons-continue__meta">→</span>
        </Link>
        {dueVocab != null && dueGrammar != null && (
          <p className="home-greeting__sub" style={{ padding: '0 2px' }}>
            오늘 복습할 단어 {dueVocab}개 · 문법 {dueGrammar}개
          </p>
        )}
      </div>

      {/* ② 이어지는 이야기 — 연재가 진행 중일 때만 (홈 '오늘 읽기' 카드 스타일) */}
      {episode != null && (
        <Link href="/study" className="learn-story">
          <div className="learn-story__kicker">이어지는 이야기</div>
          <h2 className="learn-story__title">
            {episode >= 10
              ? '이야기가 완결됐어요 — 새 이야기가 시작돼요'
              : `${episode}화까지 읽었어요 — 다음 화가 기다려요`}
          </h2>
          <div className="learn-story__more">이어서 학습하기 →</div>
        </Link>
      )}

      {/* ③ 연습실 그리드 — 타일별 고유 악센트(좌보더·아이콘원·hover 틴트) */}
      <div className="learn-grid">
        {practice.map(t => (
          <Link key={t.title} href={t.href} className="card learn-tile" style={{ '--tile-accent': t.accent }}>
            <div className="learn-tile__head">
              <span className="learn-tile__icon" aria-hidden="true">{t.icon}</span>
              <span className="home-gs-step__title">
                {t.title}
                {t.badge > 0 && <span className="learn-tile__badge">{t.badge}</span>}
              </span>
            </div>
            <div className="home-gs-step__desc">{t.desc}</div>
          </Link>
        ))}
      </div>

      {/* ④ 성장 요약 — bento 타일 (ProfileStats 패턴, 성장 지표는 growthStats 카피 재사용) */}
      <div className="bento">
        {weekSessions != null && (
          <div className="bento-item bento--2x2 card bento-stat learn-stat" style={{ '--tile-accent': 'var(--accent)' }}>
            <span className="mypage-stat-cell__value">{weekSessions}</span>
            <span className="mypage-stat-cell__label">{GROWTH_LABELS.weekSessions}</span>
          </div>
        )}
        <div className="bento-item bento--2x2 card bento-stat learn-stat" style={{ '--tile-accent': 'var(--warning)' }}>
          <span className="mypage-stat-cell__value">
            {streak ? `${streak}일${streakFreeze > 0 ? ` · 🛡${streakFreeze}` : ''}` : '–'}
          </span>
          <span className="mypage-stat-cell__label">스트릭</span>
        </div>
        {knownWords != null && (
          <div className="bento-item bento--2x2 card bento-stat learn-stat" style={{ '--tile-accent': 'var(--danger)' }}>
            <span className="mypage-stat-cell__value">{knownWords}</span>
            <span className="mypage-stat-cell__label">{GROWTH_LABELS.knownWords}</span>
          </div>
        )}
        {passedChapters != null && (
          <div className="bento-item bento--2x2 card bento-stat learn-stat" style={{ '--tile-accent': 'var(--primary)' }}>
            <span className="mypage-stat-cell__value">{passedChapters}</span>
            <span className="mypage-stat-cell__label">{GROWTH_LABELS.passedChapters}</span>
          </div>
        )}
      </div>

    </div>
  );
}
