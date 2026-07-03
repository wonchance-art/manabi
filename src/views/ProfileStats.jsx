'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { isPassed } from '../components/RefPatternCheck';
import Button from '../components/Button';
import VocabStats from './VocabStats';

const LANG_KO = { Japanese: '일본어', English: '영어', Chinese: '중국어', French: '프랑스어' };

async function fetchProfileStats(userId) {
  const heatmapStart = new Date();
  heatmapStart.setHours(0, 0, 0, 0);
  heatmapStart.setDate(heatmapStart.getDate() - 179);

  const [
    { data: heatmapRows },
    { data: allVocab },
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('created_at').eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
    supabase.from('user_vocabulary').select('*').eq('user_id', userId),
  ]);

  const heatmapDayCounts = {};
  for (const v of (heatmapRows || [])) {
    const day = v.created_at.slice(0, 10);
    heatmapDayCounts[day] = (heatmapDayCounts[day] || 0) + 1;
  }

  return { vocab: allVocab || [], heatmapDayCounts };
}

const isToday = ts => ts && new Date(ts).toDateString() === new Date().toDateString();

/** 오늘 학습한 챕터 수 — 읽음 날짜·퀴즈 기록(localStorage) 합산, slug 중복 제거 */
function chapterActivityToday(refManifest) {
  let n = 0;
  try {
    for (const ref of Object.values(refManifest)) {
      const seen = new Set();
      const dates = JSON.parse(localStorage.getItem(`${ref.readKey}_dates`) || '{}');
      for (const [slug, ts] of Object.entries(dates)) if (isToday(ts)) seen.add(slug);
      const checks = JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}');
      for (const [slug, r] of Object.entries(checks)) if (isToday(r?.at)) seen.add(slug);
      n += seen.size;
    }
  } catch {}
  return n;
}

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
  // localStorage 기반 집계는 마운트 후에만 (SSR 일치)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: () => fetchProfileStats(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  if (!user) return null;
  const vocab = data?.vocab || [];
  const streak = profile?.streak_count ?? 0;
  const hasHeatmap = data?.heatmapDayCounts && Object.keys(data.heatmapDayCounts).length > 0;
  const todayActivity =
    vocab.filter(v => isToday(v.created_at)).length +
    vocab.filter(v => isToday(v.last_reviewed_at)).length +
    (mounted ? chapterActivityToday(refManifest) : 0);

  return (
    <div className="bento">
      <GoalTile vocab={vocab} />
      <DdayTile />
      <div className="bento-item bento--2x2">
        <ReviewTile vocab={vocab} />
      </div>
      <StatTile label="스트릭" value={streak ? `${streak}일` : '–'} />
      <StatTile label="오늘 활동" value={todayActivity} />
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

/* ── 목표 타일 — 오늘 달성률, 누르면 일일 목표 설정 ── */

function GoalTile({ vocab }) {
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [goalReview, setGoalReview] = useState(5);
  const [goalWords, setGoalWords] = useState(5);
  const [goalRead, setGoalRead] = useState(1);
  const [busy, setBusy] = useState(false);

  const gReview = profile?.goal_review ?? 5;
  const gWords = profile?.goal_words ?? 5;
  const reviewsToday = vocab.filter(v => isToday(v.last_reviewed_at)).length;
  const wordsToday = vocab.filter(v => isToday(v.created_at)).length;
  // 달성률 — 복습·수집 목표 기준 (완독은 목표 설정만 지원)
  const pct = Math.round(
    (Math.min(1, reviewsToday / Math.max(gReview, 1)) + Math.min(1, wordsToday / Math.max(gWords, 1))) / 2 * 100
  );

  function openModal() {
    setGoalReview(profile?.goal_review ?? 5);
    setGoalWords(profile?.goal_words ?? 5);
    setGoalRead(profile?.goal_read ?? 1);
    setOpen(true);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      goal_review: Math.max(1, goalReview),
      goal_words: Math.max(1, goalWords),
      goal_read: Math.max(1, goalRead),
    }).eq('id', user.id);
    setBusy(false);
    if (error) { toast('저장 실패 — ' + error.message, 'error'); return; }
    fetchProfile(user.id, user.user_metadata);
    toast('일일 목표를 저장했어요.', 'success');
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="bento-item bento--1x1 card bento-stat bento-stat--btn" onClick={openModal}>
        <span className="mypage-stat-cell__value">{pct}%</span>
        <span className="mypage-stat-cell__label">오늘 목표</span>
      </button>
      {open && (
        <TileModal title="일일 목표" onClose={() => setOpen(false)}>
          {[
            { label: '단어 복습', value: goalReview, set: setGoalReview, max: 50 },
            { label: '단어 수집', value: goalWords, set: setGoalWords, max: 30 },
            { label: '자료 완독', value: goalRead, set: setGoalRead, max: 5 },
          ].map(g => (
            <div key={g.label} className="tile-modal__row">
              <span>{g.label}</span>
              <input type="number" min={1} max={g.max} className="form-input tile-modal__num"
                value={g.value} onChange={e => g.set(Math.max(1, Math.min(g.max, Number(e.target.value) || 1)))} />
            </div>
          ))}
          <Button size="sm" onClick={save} disabled={busy}>{busy ? '저장 중...' : '저장'}</Button>
        </TileModal>
      )}
    </>
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
  const langs = Object.keys(refManifest);
  const [lang, setLang] = useState(langs[0] || 'Japanese');
  // SSR과 첫 클라이언트 렌더를 일치시키기 위해 localStorage는 마운트 후에만 읽는다
  const [mounted, setMounted] = useState(false);
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
  const ref = refManifest[lang];

  // 교재 진행 — localStorage (교재 목록과 동일 원본)
  const progress = useMemo(() => {
    if (!ref || !mounted) return { readSet: new Set(), checkMap: {} };
    try {
      return {
        readSet: new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]')),
        checkMap: JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}'),
      };
    } catch { return { readSet: new Set(), checkMap: {} }; }
  }, [ref, mounted]);

  if (!ref) return null;

  return (
    <div className="card mypage-section">
      <div className="lvprog__head">
        <h2 className="mypage-section__title" style={{ margin: 0 }}>진도</h2>
        <div className="lvprog__tabs">
          {langs.map(l => (
            <button key={l} type="button"
              className={`chip ${lang === l ? 'chip--active' : ''}`}
              onClick={() => setLang(l)}>
              {LANG_KO[l] || l}
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
