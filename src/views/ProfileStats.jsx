'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { isPassed } from '../components/RefPatternCheck';
import { pullProgress } from '../lib/refProgress';
import { buildWeeklyReport, weekRangeLabel } from '../lib/weeklyReport';
import { fetchWeeklyReportRows } from '../lib/weeklyReportRows';
import Button from '../components/Button';
import VocabStats from './VocabStats';

const LANG_KO = { Japanese: '일본어', English: '영어', Chinese: '중국어', French: '프랑스어' };
// 진도 탭은 국기 이모지만(오너 지정 — 좁은 폭 글자 잘림 해소). 이름은 aria-label·title로.
const LANG_FLAG = { Japanese: '🇯🇵', English: '🇬🇧', Chinese: '🇨🇳', French: '🇫🇷' };

async function fetchProfileStats(userId) {
  const heatmapStart = new Date();
  heatmapStart.setHours(0, 0, 0, 0);
  heatmapStart.setDate(heatmapStart.getDate() - 179);

  const [
    heatmapResult,
    vocabResult,
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('created_at').eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
    // 통계는 세 시각 컬럼, 복습 타일은 id·표기·뜻만 소비 — 전 컬럼(*)을 단어 수만큼
    // 끌지 않는다(쿼리 다이어트 #1079). **타일이 그리는 필드는 반드시 여기 있어야 한다** —
    // #1079가 표기·뜻을 빼는 바람에 타일이 빈 글자를 돌리고 있었다(2026-08-24 수리).
    // 드리프트 재발은 profileStatsSelect 계약 테스트가 막는다.
    supabase.from('user_vocabulary')
      .select('id, word_text, meaning, created_at, last_reviewed_at, next_review_at')
      .eq('user_id', userId),
  ]);
  if (heatmapResult.error) throw heatmapResult.error;
  if (vocabResult.error) throw vocabResult.error;
  const heatmapRows = heatmapResult.data;
  const allVocab = vocabResult.data;

  const heatmapDayCounts = {};
  for (const v of (heatmapRows || [])) {
    const day = v.created_at.slice(0, 10);
    heatmapDayCounts[day] = (heatmapDayCounts[day] || 0) + 1;
  }

  return { vocab: allVocab || [], heatmapDayCounts };
}

const isToday = ts => ts && new Date(ts).toDateString() === new Date().toDateString();

/** 가장 최근 학습 기록이 있는 언어 — 진도 탭 기본값 */
function lastActiveLang(refManifest) {
  let best = null, bestTs = 0;
  try {
    for (const [lang, ref] of Object.entries(refManifest)) {
      let ts = 0;
      const dates = JSON.parse(localStorage.getItem(`${ref.readKey}_dates`) || '{}');
      for (const t of Object.values(dates)) ts = Math.max(ts, t || 0);
      const checks = JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}');
      for (const r of Object.values(checks)) ts = Math.max(ts, r?.at || 0);
      if (ts > bestTs) { bestTs = ts; best = lang; }
    }
  } catch {}
  return best;
}

export default function ProfileStats({ refManifest = {} }) {
  const { user, profile } = useAuth();

  const { data, error, refetch } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: () => fetchProfileStats(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // 이번 주 카드(rfc-weekly-report 목업 A) — 실패·빈 주는 카드 생략으로 조용히.
  const { data: weeklyRows } = useQuery({
    queryKey: ['weekly-report', user?.id],
    queryFn: () => fetchWeeklyReportRows(user.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const weekly = useMemo(() => (weeklyRows ? buildWeeklyReport(weeklyRows) : null), [weeklyRows]);

  if (!user) return null;
  if (error) return (
    <div className="bento">
      <div className="bento-item bento--4x1 card" role="alert">
        <p>학습 통계를 불러오지 못했어요.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>다시 시도</Button>
      </div>
    </div>
  );
  const vocab = data?.vocab || [];
  const streak = profile?.streak_count ?? 0;
  const streakFreeze = profile?.streak_freeze_count;
  const hasHeatmap = data?.heatmapDayCounts && Object.keys(data.heatmapDayCounts).length > 0;

  return (
    <div className="bento">
      <GoalTile vocab={vocab} />
      <DdayTile />
      <div className="bento-item bento--2x2">
        <ReviewTile vocab={vocab} />
      </div>
      <StatTile
        label="스트릭"
        value={streak ? `${streak}일${streakFreeze > 0 ? ` · 🛡${streakFreeze}` : ''}` : '–'}
      />
      {/* '오늘 활동' 타일이 있던 자리(오너 확정 2026-08-26: 제거·이번 주를 이 크기로).
          오늘 활동은 ⑴ 챕터 수가 이 기기 localStorage 한정 ⑵ 단어 축은 '오늘 목표'
          타일과 중복 ⑶ 활동한 날에도 0을 크게 보여줘 0 무표기 원칙과 충돌 — 반쪽
          지표라 지운다. 주간 거울은 4×1 카드 대신 이 한 칸으로 줄인다. */}
      {weekly && <WeeklyTile weekly={weekly} />}
      <div className="bento-item bento--2x2">
        <LevelCoverageCard refManifest={refManifest} />
      </div>
      {vocab.length > 0 && (
        <div className="bento-item bento--2x2">
          <VocabStats vocab={vocab} profile={profile} section="memory" />
        </div>
      )}
      {hasHeatmap && (
        <div className="bento-item bento--4x1">
          <HeatmapCard dayCounts={data.heatmapDayCounts} />
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bento-item bento--1x1 card bento-stat">
      <span className="mypage-stat-cell__value">{value}</span>
      <span className="mypage-stat-cell__label">{label}</span>
    </div>
  );
}

/* ── 이번 주 타일(오너 확정 2026-08-26) — 주간 거울을 '오늘 활동' 자리·크기(1×1)로.
     대표 축 하나만 크게: 복습 → 담은 말 → 만난 말 → 완독 순으로 처음 0이 아닌 것.
     빈 주에도 타일은 자리를 지킨다(오너 확정 2026-08-30 "상시 표시" — 숨김이 '위젯
     사라짐'으로 읽혔다). 값은 0 대신 스트릭 타일의 '–' 선례 — 0 무표기 원칙과의
     절충점. 탭하면 전체 거울을 모달로 편다(DdayTile의 타일→모달 정본 재사용 —
     지난주 병기는 모달에만 남는다). ── */
function WeeklyTile({ weekly }) {
  const [open, setOpen] = useState(false);
  const acc = weekly.reviews.accuracy == null ? null : Math.round(weekly.reviews.accuracy * 100);
  const [value, label] = weekly.reviews.total > 0
    ? [`${weekly.reviews.total}`, `이번 주 복습${acc != null ? ` · ${acc}%` : ''}`]
    : weekly.newWords > 0 ? [`${weekly.newWords}`, '이번 주 담은 말']
    : weekly.metWords > 0 ? [`${weekly.metWords}`, '이번 주 만난 말']
    : weekly.readsCompleted > 0 ? [`${weekly.readsCompleted}`, '이번 주 완독']
    : ['–', '이번 주'];
  return (
    <>
      <button type="button" className="bento-item bento--1x1 card bento-stat bento-stat--btn" onClick={() => setOpen(true)}>
        <span className="mypage-stat-cell__value">{value}</span>
        <span className="mypage-stat-cell__label">{label}</span>
      </button>
      {open && (
        <TileModal title={`이번 주 (${weekRangeLabel(weekly.week)})`} onClose={() => setOpen(false)}>
          <WeeklyReportCard weekly={weekly} header={false} />
        </TileModal>
      )}
    </>
  );
}

/* ── 이번 주 카드(rfc-weekly-report 목업 A) — 거울이지 성적표가 아니다:
     지난주는 회색 병기만(증감 화살표·색상 없음), 0인 축은 그리지 않는다. ── */
function WeeklyReportCard({ weekly, header = true }) {
  const pct = (a) => (a == null ? null : Math.round(a * 100));
  const acc = pct(weekly.reviews.accuracy);
  const prevAcc = pct(weekly.prevReviews.accuracy);
  const parts = [];
  if (weekly.newWords > 0) parts.push(`새로 담은 말 ${weekly.newWords}`);
  if (weekly.metWords > 0) parts.push(`만난 말 ${weekly.metWords}`);
  if (weekly.readsCompleted > 0) parts.push(`완독 ${weekly.readsCompleted}편`);
  return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      {header && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          이번 주 ({weekRangeLabel(weekly.week)})
        </div>
      )}
      {weekly.reviews.total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 12px' }}>
          <span style={{ fontWeight: 600 }}>
            복습 {weekly.reviews.total}문항{acc != null ? ` · 정답 ${acc}%` : ''}
          </span>
          {weekly.prevReviews.total > 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              지난주 {weekly.prevReviews.total}{prevAcc != null ? ` · ${prevAcc}%` : ''}
            </span>
          )}
        </div>
      )}
      {parts.length > 0 && (
        <div style={{ marginTop: 4, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {parts.join(' · ')}
        </div>
      )}
      {!weekly.hasAny && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          이번 주 기록이 아직 없어요.
        </p>
      )}
    </div>
  );
}

/* ── 목표 타일 — 오늘 달성률 표시 전용. 탭하면 마이페이지에서 목표 편집(정본 슬라이더). ── */

function GoalTile({ vocab }) {
  const { profile } = useAuth();

  const gReview = profile?.goal_review ?? 5;
  const gWords = profile?.goal_words ?? 5;
  const reviewsToday = vocab.filter(v => isToday(v.last_reviewed_at)).length;
  const wordsToday = vocab.filter(v => isToday(v.created_at)).length;
  // 달성률 — 복습·수집 목표 기준 (완독은 목표 설정만 지원)
  const pct = Math.round(
    (Math.min(1, reviewsToday / Math.max(gReview, 1)) + Math.min(1, wordsToday / Math.max(gWords, 1))) / 2 * 100
  );

  return (
    <Link href="/profile" className="bento-item bento--1x1 card bento-stat bento-stat--btn">
      <span className="mypage-stat-cell__value">{pct}%</span>
      <span className="mypage-stat-cell__label">오늘 목표</span>
    </Link>
  );
}

/* ── D-Day 타일 — 시험일 등 목표일 설정 (서버 동기화, 비로그인·오프라인은 localStorage 폴백) ── */

function DdayTile() {
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const [local, setLocal] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    try { setLocal(JSON.parse(localStorage.getItem('as_dday') || 'null')); } catch {}
  }, []);

  // 서버 값 우선, 없으면 로컬 폴백
  const dday = profile?.dday_date
    ? { date: profile.dday_date, label: profile.dday_label || '' }
    : local;

  // 서버가 비어 있고 로컬에 있으면 1회 끌어올림 (기기 마이그레이션)
  useEffect(() => {
    if (!user?.id || !profile || profile.dday_date || !local?.date) return;
    supabase.from('profiles')
      .update({ dday_date: local.date, dday_label: local.label || null })
      .eq('id', user.id)
      .then(({ error }) => { if (!error) fetchProfile(user.id, user.user_metadata); }, () => {});
    // 최초 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.dday_date, local?.date]);

  const diff = useMemo(() => {
    if (!dday?.date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(dday.date); target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }, [dday]);

  function openModal() {
    setDate(dday?.date || '');
    setLabel(dday?.label || '');
    setOpen(true);
  }

  async function persist(nextDate, nextLabel) {
    if (busy) return;
    setBusy(true);
    // 로컬은 항상 기록 (오프라인 폴백)
    try {
      if (nextDate) localStorage.setItem('as_dday', JSON.stringify({ date: nextDate, label: nextLabel }));
      else localStorage.removeItem('as_dday');
    } catch {}
    setLocal(nextDate ? { date: nextDate, label: nextLabel } : null);
    if (user?.id) {
      const { error } = await supabase.from('profiles')
        .update({ dday_date: nextDate || null, dday_label: nextLabel || null })
        .eq('id', user.id);
      if (error) toast('동기화 실패 — 이 기기에는 저장됐어요', 'error');
      else fetchProfile(user.id, user.user_metadata);
    }
    setBusy(false);
    setOpen(false);
  }

  const value = !mounted || !dday ? '설정'
    : diff === 0 ? 'D-Day'
    : diff > 0 ? `D-${diff}`
    : `D+${Math.abs(diff)}`;

  return (
    <>
      <button type="button" className="bento-item bento--1x1 card bento-stat bento-stat--btn" onClick={openModal}>
        <span className="mypage-stat-cell__value">{value}</span>
        <span className="mypage-stat-cell__label">{(mounted && dday?.label) || 'D-Day'}</span>
      </button>
      {open && (
        <TileModal title="D-Day 설정" onClose={() => setOpen(false)}>
          <div className="tile-modal__row">
            <span>날짜</span>
            <input type="date" className="form-input tile-modal__num" style={{ maxWidth: 160 }}
              value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="tile-modal__row">
            <span>이름</span>
            <input className="form-input tile-modal__num" style={{ maxWidth: 160 }} maxLength={12}
              placeholder="예: JLPT N3" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={() => persist(date, label.trim())} disabled={!date || busy} style={{ flex: 1 }}>
              {busy ? '저장 중...' : '저장'}
            </Button>
            {dday && <Button size="sm" variant="secondary" onClick={() => persist('', '')} disabled={busy} style={{ flex: 1 }}>삭제</Button>}
          </div>
        </TileModal>
      )}
    </>
  );
}

/** 타일 공용 미니 모달 */
function TileModal({ title, onClose, children }) {
  return (
    <div className="tile-modal__overlay" onClick={onClose} role="dialog" aria-label={title}>
      <div className="card tile-modal" onClick={e => e.stopPropagation()}>
        <div className="tile-modal__head">
          <h3 className="tile-modal__title">{title}</h3>
          <button type="button" className="tile-modal__close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── 단어 복습 라이브 타일 — 단어가 시간차로 넘어가는 메트로식 타일, 클릭 시 단어장 ── */

function ReviewTile({ vocab }) {
  const now = Date.now();
  // 복습 대기 단어 우선, 없으면 최근 수집 단어
  const pool = useMemo(() => {
    const due = vocab
      .filter(v => v.next_review_at && new Date(v.next_review_at).getTime() <= now)
      .sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at));
    if (due.length > 0) return due.slice(0, 20);
    return [...vocab]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
    // now는 렌더 시점 고정으로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab]);
  const dueCount = useMemo(
    () => vocab.filter(v => v.next_review_at && new Date(v.next_review_at).getTime() <= now).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vocab]
  );

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % pool.length), 3500);
    return () => clearInterval(t);
  }, [pool.length]);

  const word = pool[idx % Math.max(pool.length, 1)];

  return (
    <Link href="/vocab" className="card review-tile">
      <span className="review-tile__head">
        <span className="review-tile__kicker">단어 복습</span>
        {dueCount > 0 && <span className="review-tile__due">{dueCount}개 대기</span>}
      </span>
      {word ? (
        <span className="review-tile__cycle" key={word.id ?? idx}>
          <span className="review-tile__word">{word.word_text}</span>
          <span className="review-tile__meaning">{word.meaning}</span>
        </span>
      ) : (
        <span className="review-tile__cycle">
          <span className="review-tile__meaning">아직 수집한 단어가 없어요.<br />자료를 읽으며 단어를 모아보세요.</span>
        </span>
      )}
      <span className="review-tile__cta">복습하기 →</span>
    </Link>
  );
}

/* ── 진도 — 레벨별 챕터(교재) 통과 + 어휘 수집 통합, 3개 언어 ── */

function LevelCoverageCard({ refManifest }) {
  const { user } = useAuth();
  const langs = Object.keys(refManifest);
  const [lang, setLang] = useState(langs[0] || 'Japanese');
  // SSR과 첫 클라이언트 렌더를 일치시키기 위해 localStorage는 마운트 후에만 읽는다
  const [mounted, setMounted] = useState(false);
  // 서버 병합으로 localStorage가 갱신되면 progress 메모를 재실행하기 위한 카운터
  const [merged, setMerged] = useState(0);
  useEffect(() => {
    setMounted(true);
    // 최근 학습 기록이 있는 언어 우선 → 마지막 선택 언어 폴백
    const recent = lastActiveLang(refManifest);
    const saved = localStorage.getItem('lessons_lang');
    if (recent && langs.includes(recent)) setLang(recent);
    else if (langs.includes(saved)) setLang(saved);
    // langs·refManifest는 정적 매니페스트에서 파생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그인 시 서버 기록과 병합 — 다른 기기에서 읽은 챕터 반영 (LessonsPage와 동일 패턴).
  // 먼저 localStorage로 렌더한 뒤 병합이 끝나면 재읽기(깜빡임 최소). 실패 시 localStorage 유지.
  useEffect(() => {
    if (!user?.id) return;
    const readKeys = Object.fromEntries(
      Object.entries(refManifest).map(([name, r]) => [name, r.readKey])
    );
    pullProgress(user.id, readKeys).then(changed => { if (changed) setMerged(m => m + 1); });
    // refManifest는 서버에서 내려오는 정적 데이터
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const ref = refManifest[lang];

  // 교재 진행 — localStorage (교재 목록과 동일 원본, 로그인 시 서버 병합 반영)
  const progress = useMemo(() => {
    if (!ref || !mounted) return { readSet: new Set(), checkMap: {} };
    try {
      return {
        readSet: new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]')),
        checkMap: JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}'),
      };
    } catch { return { readSet: new Set(), checkMap: {} }; }
  }, [ref, mounted, merged]);

  if (!ref) return null;

  return (
    <div className="card mypage-section">
      <div className="lvprog__head">
        <h2 className="mypage-section__title" style={{ margin: 0 }}>진도</h2>
        <div className="lvprog__tabs">
          {langs.map(l => (
            <button key={l} type="button"
              className={`chip ${lang === l ? 'chip--active' : ''}`}
              aria-label={LANG_KO[l] || l}
              aria-pressed={lang === l}
              title={LANG_KO[l] || l}
              style={{ fontSize: '1.05rem', lineHeight: 1 }}
              onClick={() => setLang(l)}>
              <span aria-hidden="true">{LANG_FLAG[l] || (LANG_KO[l] || l)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="lvprog__rows">
        {ref.levels.map(lv => {
          const total = lv.chapters.length;
          const passed = lv.chapters.filter(c => isPassed(progress.checkMap[c.slug])).length;
          const read = lv.chapters.filter(c => progress.readSet.has(c.slug)).length;
          // 인트로 레벨(OT/A0 — levels 첫 항목)은 관문이 없어 '전부 읽음'이 완료 기준
          const isIntro = lv.key === ref.levels[0]?.key;
          const done = total > 0 && (isIntro ? read === total : passed === total);
          return (
            <div key={lv.key} className="lvprog__row">
              <span className={`lvprog__key ${done ? 'is-done' : ''}`}>{lv.short || lv.key}</span>
              <span className="lvprog__bar">
                <span className="lvprog__bar-read" style={{ width: `${total ? (read / total) * 100 : 0}%` }} />
                <span className="lvprog__bar-pass" style={{ width: `${total ? (passed / total) * 100 : 0}%` }} />
              </span>
              <span className="lvprog__count">
                {done ? '수료' : (
                  <span className="lvprog__frac">
                    <span className="lvprog__frac-n">{passed}</span>
                    <span className="lvprog__frac-sep">/</span>
                    <span className="lvprog__frac-d">{total}</span>
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="lvprog__legend">
        <span><span className="lvprog__dot lvprog__dot--read" />읽음</span>
        <span><span className="lvprog__dot lvprog__dot--pass" />통과</span>
      </div>
    </div>
  );
}

/* ── 히트맵 — 좌→우로 진행되는 연속 주 스트립, 호버·터치 시 날짜·개수 ── */

function HeatmapCard({ dayCounts }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // 최근 180일 — 가장 오른쪽 아래가 오늘 (좌→우 시간 진행)
  const days = useMemo(() => {
    const total = 180;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (total - 1 - i));
      return d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxCount = Math.max(1, ...Object.values(dayCounts));
  const totalActive = Object.keys(dayCounts).length;
  const totalWords = Object.values(dayCounts).reduce((a, b) => a + b, 0);
  const colorOf = n => {
    if (!n) return 'var(--bg-secondary)';
    const lvl = Math.ceil((n / maxCount) * 4);
    return ['', 'var(--primary-glow)', 'var(--primary)', 'var(--accent)', 'var(--accent)'][lvl] || 'var(--accent)';
  };

  return (
    <div className="card mypage-section">
      <div className="lvprog__head">
        <h2 className="mypage-section__title" style={{ margin: 0 }}>히트맵</h2>
        <span className="lvprog__count">{totalActive}일 · {totalWords}개</span>
      </div>
      <div className="hm-scroll">
        <div className="hm-strip">
          {days.map((d, i) => {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const n = dayCounts[key] || 0;
            return (
              <span
                key={i}
                className="hm-day"
                style={{ background: colorOf(n) }}
                title={`${d.getMonth() + 1}월 ${d.getDate()}일 · ${n}개`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
