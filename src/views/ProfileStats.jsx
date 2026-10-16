'use client';

/**
 * 현황(`/progress`) — 배움의 「현황 전체 →」 (LEARN-HOME-AK-001, 오너 확정 목업 2026-10-09 · 정정 2026-10-11 · D-X6).
 *
 *   ← 배움
 *   현황 [언어 칩]                                    [목표 수정]
 *   [ 진행바 반쪽 2×1   ][ 오늘 목표 ][ 연속      ]
 *   [ 히트맵 24주 2×1   ][ 이번 주   ][ 아는 단어 ]
 *   [ 레벨 어휘 2×2     ][ 기억 건강 2×2          ]
 *
 * 예전 홈 메트로 대시보드(어느 경로에도 마운트돼 있지 않던 이 파일)를 현황으로 되살렸다. 배움(홈)과 함께 쓰는 칸은
 * components/learn으로 떼어 냈다 — 홈은 이 파일을 불러오지 않는다(performanceRepairs P4).
 * 언어 칩은 레벨 어휘 · 기억 건강 · 아는 단어를 그 언어로 거른다. 복습 개수 칸은 없다(진입 링크만 범위 주소).
 * 휴대폰은 한 격자를 펴고 클래스 order로 순서를 정한다(진행바 → 오늘 목표 · 연속 → 이번 주 · 아는 단어 → 히트맵 → 레벨 어휘 → 기억 건강).
 */
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { buildWeeklyReport, weekRangeLabel } from '../lib/weeklyReport';
import { fetchWeeklyReportRows } from '../lib/weeklyReportRows';
import { topLabeledWeakness, weaknessLine, weaknessProfile } from '../lib/weaknessProfile';
import { fetchKnownWords, knownWordsLang } from '../lib/knownWords';
import { LANG_NAME_KO, detectLang } from '../lib/constants';
import Button from '../components/Button';
import { fetchVocabularyLearningRows } from '../lib/vocabularyLearningRows';
import { kstDayStartMs, kstDateString } from '../lib/growthStats';
import useLearnLanguage from '../components/learn/useLearnLanguage';
import LangChips from '../components/learn/LangChips';
import GoalTrackTile, { useGoalCatalog } from '../components/learn/GoalTrackTile';
import { StatTile, StreakTile, TodayGoalTile } from '../components/learn/LearnTiles';
import LevelVocabCard from '../components/learn/LevelVocabCard';
import MemoryHealthCard from '../components/learn/MemoryHealthCard';
import '../components/learn/learn.css';
import { authEntryHref } from '../lib/authRedirect';

/** 히트맵 — 최근 24주(168일), 가장 오른쪽 아래가 오늘. */
export const HEATMAP_DAYS = 168;
const DAY_MS = 24 * 3600 * 1000;

export async function fetchProfileStats(userId, now = Date.now()) {
  const learning = await fetchVocabularyLearningRows(userId, { fields: 'summary' });
  const heatmapStart = kstDayStartMs(now) - (HEATMAP_DAYS - 1) * DAY_MS;
  const heatmapDayCounts = {};
  for (const v of learning.rows) {
    const created = Date.parse(v.created_at);
    if (!Number.isFinite(created) || created < heatmapStart) continue;
    const day = kstDateString(created);
    heatmapDayCounts[day] = (heatmapDayCounts[day] || 0) + 1;
  }
  return { vocab: learning.rows, projections: learning.projections, now: learning.now, heatmapDayCounts };
}

export default function ProfileStats() {
  // 로그인 뒤 지금 화면으로 돌아온다(맨 /auth는 /home으로 보낸다) — 대상 검증은 authEntryHref 규칙.
  const signInHref = authEntryHref(usePathname());
  const { user, profile, loading: authLoading } = useAuth();
  const catalog = useGoalCatalog(!!user);
  const [goalSignal, setGoalSignal] = useState(0);

  const { data, error, refetch } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: () => fetchProfileStats(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const vocabCounts = useMemo(() => (data?.vocab || []).reduce((all, v) => {
    const key = v.language || detectLang(v.word_text || ''); all[key] = (all[key] || 0) + 1; return all;
  }, {}), [data?.vocab]);
  const { langs, lang, choose } = useLearnLanguage(profile, vocabCounts);

  // 이번 주 카드(rfc-weekly-report 목업 A) — 실패·빈 주는 카드 생략으로 조용히.
  const { data: weeklyRows } = useQuery({
    queryKey: ['weekly-report', user?.id],
    queryFn: () => fetchWeeklyReportRows(user.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const weekly = useMemo(() => (weeklyRows ? buildWeeklyReport(weeklyRows) : null), [weeklyRows]);

  // 아는 단어 — 칩 언어의 「이미 앎」 표시. 미적용 · 실패는 조용히(칸만 「–」).
  const knownLang = knownWordsLang(lang);
  const { data: knownRows } = useQuery({
    queryKey: ['known-words', user?.id, knownLang],
    enabled: !!user?.id && !!knownLang,
    queryFn: async () => {
      try { return await fetchKnownWords(user.id, knownLang); }
      catch { return null; }
    },
    staleTime: 1000 * 60 * 5,
  });

  // 배움의 「목표 정하기」(/progress?goal=edit)로 들어오면 프로필을 받은 뒤 목표 편집을 연다.
  useEffect(() => {
    if (!profile) return;
    try { if (new URLSearchParams(window.location.search).get('goal') === 'edit') setGoalSignal(n => n + 1); } catch { /* 주소를 못 읽으면 닫힌 채로 */ }
  }, [profile]);

  if (!authLoading && !user) {
    return (
      <div className="manabi-page learn-page">
        <Link href="/home" prefetch={false} className="learn-crumb">← 배움</Link>
        <div className="learn-top"><div className="learn-top__title"><h1>현황</h1></div></div>
        <div className="manabi-inline-state learn-login" role="status"><span>로그인이 필요해요.</span><Link href={signInHref} prefetch={false} className="learn-button-s">로그인</Link></div>
      </div>
    );
  }
  const vocab = data?.vocab || [];
  const projections = data?.projections || [];

  return (
    <div className="manabi-page learn-page">
      <Link href="/home" prefetch={false} className="learn-crumb">← 배움</Link>
      <div className="learn-top">
        <div className="learn-top__title"><h1>현황</h1><LangChips langs={langs} lang={lang} onChange={choose} /></div>
        <button type="button" className="learn-button-s" onClick={() => setGoalSignal(n => n + 1)}>목표 수정</button>
      </div>
      {error && (
        <div className="manabi-inline-state" role="alert">
          학습 통계를 불러오지 못했어요. <button type="button" onClick={() => refetch()}>다시 시도</button>
        </div>
      )}
      <div className="learn-grid learn-stats">
        <GoalTrackTile className="learn-order-1" onOpen={() => setGoalSignal(n => n + 1)} />
        <TodayGoalTile vocab={vocab} projections={projections} profile={profile} empty={!data} className="learn-order-2" />
        <StreakTile profile={profile} className="learn-order-3" />
        <HeatmapCard dayCounts={data?.heatmapDayCounts || {}} className="learn-order-6" />
        {/* 빈 주에도 칸은 자리를 지킨다(오너 확정 2026-08-30 "상시 표시") — 게이트는 로드 대기만, 로드 전은 같은 칸의 「–」. */}
        {weekly ? <WeeklyTile weekly={weekly} className="learn-order-4" /> : <StatTile value="–" label="이번 주" className="learn-order-4" />}
        <StatTile value={Array.isArray(knownRows) ? knownRows.length.toLocaleString('ko-KR') : '–'} label="아는 단어" className="learn-order-5" />
        <LevelVocabCard lang={lang} vocab={vocab} projections={projections} knownRows={knownRows || []} className="learn-order-7" />
        <MemoryHealthCard lang={lang} projections={projections} now={data?.now || Date.now()} className="learn-order-8" />
      </div>
      <GoalEditor catalog={catalog.data} openSignal={goalSignal} />
    </div>
  );
}

/* ── 이번 주 타일(오너 확정 2026-08-26) — 주간 거울을 '오늘 활동' 자리·크기(1×1)로.
     대표 축 하나만 크게: 복습 → 담은 말 → 만난 말 → 완독 순으로 처음 0이 아닌 것.
     빈 주에도 타일은 자리를 지킨다(오너 확정 2026-08-30 "상시 표시" — 숨김이 '위젯
     사라짐'으로 읽혔다). 값은 0 대신 스트릭 타일의 '–' 선례 — 0 무표기 원칙과의
     절충점. 탭하면 전체 거울을 모달로 편다(DdayTile의 타일→모달 정본 재사용 —
     지난주 병기는 모달에만 남는다). ── */
function WeeklyTile({ weekly, className = '' }) {
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
      <button type="button" className={`learn-tile learn-stat learn-stat--btn ${className}`.trim()} onClick={() => setOpen(true)}>
        <span className="learn-stat__value">{value}</span>
        <span className="learn-stat__label">{label}</span>
      </button>
      {open && (
        <TileModal title={`이번 주 (${weekRangeLabel(weekly.week)})`} onClose={() => setOpen(false)}>
          <WeeklyReportCard weekly={weekly} header={false} showWeakness />
        </TileModal>
      )}
    </>
  );
}

/* ── 이번 주 카드(rfc-weekly-report 목업 A) — 거울이지 성적표가 아니다:
     지난주는 회색 병기만(증감 화살표·색상 없음), 0인 축은 그리지 않는다. ── */
function WeeklyReportCard({ weekly, header = true, showWeakness = false }) {
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
      {showWeakness && <WeakSpotLine weekStartMs={weekly.week.startMs} />}
      {!weekly.hasAny && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          이번 주 기록이 아직 없어요.
        </p>
      )}
    </div>
  );
}

/* ── 이번 주 약한 곳 한 줄(v2-A R1, #1077 설계 §3.1) — 침습 순서의 첫 칸: 읽기 전용.
     아무것도 적재하지 않고 이미 쌓인 review_events에서 태그를 **유도**만 한다(원칙 P1).
     표본이 미달이면 줄 자체가 없다(P3 — weeklyReport의 '0 무표기'와 같은 결).
     색은 회색 하나 — 이 카드는 거울이지 성적표가 아니라서 경고색을 쓰면 규약을 깬다. ── */
function WeakSpotLine({ weekStartMs }) {
  const { user } = useAuth();
  // 모달을 연 사람에게만 조회한다 — 홈 첫 화면이 태그 유도용 600행을 치를 이유가 없다.
  const { data: rows } = useQuery({
    queryKey: ['weak-spot', user?.id, weekStartMs],
    queryFn: () => fetchWeaknessRows(user.id, { sinceMs: weekStartMs }),
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
  // 창을 카드와 맞춘다 — 카드가 "이번 주"라고 말하는데 줄만 2주면 같은 카드가 두 기간을 섞는다.
  const top = useMemo(() => topLabeledWeakness(
    weaknessProfile(rows || [], { sinceMs: weekStartMs }),
  ), [rows, weekStartMs]);
  const line = weaknessLine(top);
  if (!line) return null;
  return (
    <div style={{ marginTop: 6, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
      약한 곳 — {line}
    </div>
  );
}

/* ── 목표 편집(목표 · D-Day 모달) — 목표일 설정 (서버 동기화, 비로그인·오프라인은 localStorage 폴백).
     v2-D R2에서 '무엇을 향해 가는가'(언어·도달 레벨)가 여기 붙었다. 날짜 편집기와 과정을 한 모달에 모은다 —
     목표가 두 곳으로 갈리지 않게, 목표를 고치는 자리는 현황의 「목표 수정」(배움의 「목표 정하기」도 여기로 온다) 하나다.
     예전 D-Day 타일은 진행바 반쪽(D-58)으로 흡수됐다(LEARN-HOME-AK-001). ── */

function GoalEditor({ catalog, openSignal = 0 }) {
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const [local, setLocal] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [goalLang, setGoalLang] = useState('');
  const [goalLevel, setGoalLevel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    try { setLocal(JSON.parse(localStorage.getItem('as_dday') || 'null')); } catch {}
  }, []);

  // 서버 값 우선, 없으면 로컬 폴백. 매 렌더 새 객체면 아래 diff 메모가 매번 다시 계산되므로 메모한다.
  const ddayDate = profile?.dday_date;
  const ddayLabel = profile?.dday_label;
  const dday = useMemo(
    () => (ddayDate ? { date: ddayDate, label: ddayLabel || '' } : local),
    [ddayDate, ddayLabel, local],
  );

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

  // 레벨은 그 언어에 챕터가 있는 것만 — 어휘 전용 레벨을 목표로 잡으면 계획이 빈다.
  const levelOptions = ((catalog?.[goalLang]?.levels) || []).filter(lv => (lv.chapters || []).length > 0);

  function openModal() {
    setDate(dday?.date || '');
    setLabel(dday?.label || '');
    setGoalLang(profile?.goal_lang || '');
    setGoalLevel(profile?.goal_level || '');
    setOpen(true);
  }
  // 「목표 수정」 버튼 · ?goal=edit 진입이 신호를 올리면 연다(열 때마다 지금 값으로 채운다).
  useEffect(() => {
    if (openSignal > 0) openModal();
    // openModal은 매 렌더 새 함수 — 신호가 바뀔 때만 연다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  async function persist(nextDate, nextLabel, nextLang, nextLevel) {
    if (busy) return;
    setBusy(true);
    // 로컬은 항상 기록 (오프라인 폴백)
    try {
      if (nextDate) localStorage.setItem('as_dday', JSON.stringify({ date: nextDate, label: nextLabel }));
      else localStorage.removeItem('as_dday');
    } catch {}
    setLocal(nextDate ? { date: nextDate, label: nextLabel } : null);
    if (user?.id) {
      const base = { dday_date: nextDate || null, dday_label: nextLabel || null };
      // 목표 2컬럼은 마이그레이션(20260831010000_profile_goal.sql) 적용 후 생긴다.
      // 미적용 환경에서 미지 컬럼이 payload에 있으면 PostgREST가 요청 전체를 거부하므로,
      // 컬럼 오류일 때만 목표를 빼고 재시도한다(profile_levels_fr_zh 폴백과 같은 패턴).
      let { error } = await supabase.from('profiles')
        .update({ ...base, goal_lang: nextLang || null, goal_level: nextLevel || null })
        .eq('id', user.id);
      if (error && /column|schema/i.test(error.message || '')) {
        ({ error } = await supabase.from('profiles').update(base).eq('id', user.id));
        // 조용히 삼키면 "과정을 골랐는데 궤도가 안 뜬다"가 된다 — 무엇이 저장됐는지 말한다.
        if (!error && (nextLang || nextLevel)) toast('날짜는 저장했어요 — 목표 과정은 아직 준비 중이에요', 'info');
      }
      if (error) toast('동기화하지 못했어요. 이 기기에는 저장됐어요.', 'error');
      else fetchProfile(user.id, user.user_metadata);
    }
    setBusy(false);
    setOpen(false);
  }

  if (!mounted) return null;
  return (
    <>
      {open && (
        <TileModal title="목표 · D-Day" onClose={() => setOpen(false)}>
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
          {/* 과정을 고르면 그 날까지의 궤도(남은 챕터·필요 속도·예상 완료일)가 홈에 뜬다.
              안 고르면 지금까지처럼 날짜 카운트다운만 — 목표는 강요가 아니다. */}
          <div className="tile-modal__row">
            <span>과정</span>
            <span className="dday-goal">
              <select className="form-input dday-goal__sel" aria-label="목표 언어"
                value={goalLang} onChange={e => { setGoalLang(e.target.value); setGoalLevel(''); }}>
                <option value="">선택 안 함</option>
                {Object.keys(catalog || {}).filter(l => LANG_NAME_KO[l]).map(l => (
                  <option key={l} value={l}>{LANG_NAME_KO[l]}</option>
                ))}
              </select>
              <select className="form-input dday-goal__sel" aria-label="목표 레벨"
                value={goalLevel} disabled={!goalLang} onChange={e => setGoalLevel(e.target.value)}>
                <option value="">레벨</option>
                {levelOptions.map(lv => (
                  <option key={lv.key} value={lv.key}>{lv.short || lv.key}</option>
                ))}
              </select>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={() => persist(date, label.trim(), goalLang, goalLang ? goalLevel : '')}
              disabled={!date || busy} style={{ flex: 1 }}>
              {busy ? '저장 중…' : '저장'}
            </Button>
            {dday && <Button size="sm" variant="secondary" onClick={() => persist('', '', '', '')} disabled={busy} style={{ flex: 1 }}>삭제</Button>}
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

/* ── 히트맵 반쪽(2×1) — 최근 24주, 칸 10px · 간격 2px, 범례 없음(칸마다 개수 툴팁). 좌→우로 시간이 흐르고 맨 오른쪽 아래가 오늘. ── */

function HeatmapCard({ dayCounts, className = '' }) {
  const todayStart = kstDayStartMs(Date.now());
  const days = Array.from({ length: HEATMAP_DAYS }, (_, i) => kstDateString(todayStart - (HEATMAP_DAYS - 1 - i) * DAY_MS));
  const maxCount = Math.max(1, ...Object.values(dayCounts));
  const shown = days.filter(key => dayCounts[key] > 0);
  const totalWords = shown.reduce((sum, key) => sum + dayCounts[key], 0);
  const levelOf = n => (!n ? '' : `l${Math.min(4, Math.max(1, Math.ceil((n / maxCount) * 4)))}`);

  return (
    <div className={`learn-tile learn-heatmap ${className}`.trim()}>
      <div className="learn-sec-head">
        <h2 className="learn-sec-title">히트맵</h2>
        {shown.length > 0 && <span className="learn-sec-meta">{shown.length}일 · {totalWords.toLocaleString('ko-KR')}개</span>}
      </div>
      <div className="learn-heatmap__strip">
        {days.map(key => {
          const n = dayCounts[key] || 0;
          return <i key={key} className={levelOf(n) || undefined} title={`${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일 · ${n}개`} />;
        })}
      </div>
    </div>
  );
}
