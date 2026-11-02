'use client';

/**
 * 현황(`/progress`) — 배움의 「현황 전체 →」 (LEARN-HOME-AK-001, 오너 확정 목업 2026-10-09 · 정정 2026-10-11 · D-X6).
 *
 *   ← 배움
 *   현황 [언어 칩]                                    [목표 수정]
 *   [ 진행바 반쪽 2×1   ][ 오늘 목표 ][ 연속      ]
 *   [ 공부한 날 24주 2×1 ][ 이번 주   ][ 이미 아는 단어 ]
 *   [ 레벨 어휘 2×2     ][ 기억 건강 2×2          ]
 *
 * 예전 홈 메트로 대시보드(어느 경로에도 마운트돼 있지 않던 이 파일)를 현황으로 되살렸다. 배움(홈)과 함께 쓰는 칸은
 * components/learn으로 떼어 냈다 — 홈은 이 파일을 불러오지 않는다(performanceRepairs P4).
 * 언어 칩은 레벨 어휘 · 기억 건강 · 아는 단어를 그 언어로 거른다. 복습 개수 칸은 없다(진입 링크만 범위 주소).
 * 휴대폰은 한 격자를 펴고 클래스 order로 순서를 정한다(진행바 → 오늘 목표 · 연속 → 이번 주 · 이미 아는 단어 → 공부한 날 → 레벨 어휘 → 기억 건강).
 * 「목표 수정」 · 진행바 · 오늘 목표 칸 · 주소 ?goal=edit는 목표 창(components/goal/GoalSheet — GOAL-SHEET-001)을 연다.
 */
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { SAVED_SOURCES, buildWeeklyReport, weekRangeLabel } from '../lib/weeklyReport';
import { fetchWeeklyReportRows } from '../lib/weeklyReportRows';
import { topLabeledWeakness, weaknessLine, weaknessProfile } from '../lib/weaknessProfile';
import { fetchKnownWords, knownWordsLang } from '../lib/knownWords';
import { detectLang } from '../lib/constants';
import { fetchVocabularyLearningRows } from '../lib/vocabularyLearningRows';
import { fetchSharedVocabularySummary } from '../lib/vocabularyLearningShare';
// 약점 칸 — import가 빠져 queryFn이 ReferenceError로 늘 실패했다(no-undef 전수, 2026-10-17 KST).
import { fetchWeaknessRows } from '../lib/weaknessRows';
import { fetchRemetWeeks } from '../lib/remetRows';
import { fetchOutputWeeks } from '../lib/usedWordsRows';

// 다시 만난 말 칩 → 단어 카드(복습실과 같은 VocabDetailCard) — 칩을 누를 때만 받는다.
const VocabDetailCard = dynamic(() => import('./VocabDetailCard'), { loading: () => null });
import { learningDayStartMs, learningDateString } from '../lib/growthStats';
import useLearnLanguage from '../components/learn/useLearnLanguage';
import LangChips from '../components/learn/LangChips';
import GoalTrackTile, { useGoalCatalog } from '../components/learn/GoalTrackTile';
import { StatTile, StreakTile, TodayGoalTile } from '../components/learn/LearnTiles';
import LevelVocabCard from '../components/learn/LevelVocabCard';
import MemoryHealthCard from '../components/learn/MemoryHealthCard';
import TrueRetentionTable from '../components/learn/TrueRetentionTable';
import { buildTrueRetention } from '../lib/trueRetention';
import { fetchTrueRetentionRows, trueRetentionQueryKey } from '../lib/trueRetentionRows';
import { serializeReviewScope } from '../lib/reviewScope';
import '../components/learn/learn.css';
import { authEntryHref } from '../lib/authRedirect';
import { useDialogReturn } from '../lib/useDialogReturn';
import GoalSheet from '../components/goal/GoalSheet';
import { useGroupSnapshotPush } from '../lib/useGroupSnapshotPush';
import { STUDY_DAYS_SPAN, fetchStudyAnswerRows, studyDayCounts, studyDayLabel, studyDaysBasis } from '../lib/studyDays';
import { METRICS } from '../lib/metrics/registry';

/** 공부한 날(히트맵) — 최근 1년(52주 · 364일), 가장 오른쪽 아래가 오늘. */
export const HEATMAP_DAYS = STUDY_DAYS_SPAN;
const DAY_MS = 24 * 3600 * 1000;

export async function fetchProfileStats(userId, now = Date.now(), { queryClient } = {}) {
  // 화면에서는 배움 · 읽을거리와 같은 요약 snapshot을 나눠 쓴다(SNAPSHOT-SHARE-001 — 신선하면 다시 받지 않는다).
  const learning = queryClient ? await fetchSharedVocabularySummary(queryClient, userId)
    : await fetchVocabularyLearningRows(userId, { fields: 'summary' });
  const heatmapStart = learningDayStartMs(now) - (HEATMAP_DAYS - 1) * DAY_MS;
  // 공부한 날 칸의 「담은 말」 몫 — 답 몫은 화면이 따로 늦게 받는다(첫 칸들을 기다리게 하지 않게).
  const heatmapDayCounts = studyDayCounts({ saved: learning.rows, sinceMs: heatmapStart });
  return { vocab: learning.rows, projections: learning.projections, now: learning.now, heatmapStart, heatmapDayCounts };
}

export default function ProfileStats() {
  // 로그인 뒤 지금 화면으로 돌아온다(맨 /auth는 /home으로 보낸다) — 대상 검증은 authEntryHref 규칙.
  const signInHref = authEntryHref(usePathname());
  const { user, profile, loading: authLoading } = useAuth();
  // 목표 창이 열리기 전에 과정 목록을 받아 둔다(목표 창도 같은 쿼리 키 — 한 번만 받는다).
  useGoalCatalog(!!user);
  const [goalOpen, setGoalOpen] = useState(false);

  const { data, error, refetch } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: ({ client }) => fetchProfileStats(user.id, Date.now(), { queryClient: client }),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const vocabCounts = useMemo(() => (data?.vocab || []).reduce((all, v) => {
    const key = v.language || detectLang(v.word_text || ''); all[key] = (all[key] || 0) + 1; return all;
  }, {}), [data?.vocab]);
  const { langs, lang, choose } = useLearnLanguage(profile, vocabCounts);

  // 공부한 날 — 답 몫(review_events 1년). 첫 칸들이 뜬 뒤에 받고, 실패하면 담은 말만으로 칸을 그린다.
  const { data: answerRows } = useQuery({
    queryKey: ['study-days', user?.id, data?.heatmapStart],
    queryFn: () => fetchStudyAnswerRows(user.id, new Date(data.heatmapStart).toISOString()),
    enabled: !!user && !!data?.heatmapStart,
    staleTime: 1000 * 60 * 5,
  });
  const studyDays = useMemo(() => {
    if (!data) return {};
    const answers = studyDayCounts({ answers: answerRows || [], sinceMs: data.heatmapStart });
    const merged = {};
    for (const source of [data.heatmapDayCounts || {}, answers]) {
      for (const [day, c] of Object.entries(source)) {
        const cell = (merged[day] ||= { answers: 0, saved: 0 });
        cell.answers += c.answers; cell.saved += c.saved;
      }
    }
    return merged;
  }, [data, answerRows]);
  // 칸 기간(1년)보다 이른 기록 — 있으면 머리글은 「1년 중」, 없으면 첫 기록 날부터(담은 말은 전체 기록을 이미 받아 둔다).
  const hasOlderRecord = useMemo(() => !!data && (data.vocab || []).some(v => Date.parse(v.created_at) < data.heatmapStart), [data]);

  // 이번 주 카드(rfc-weekly-report 목업 A) — 실패·빈 주는 카드 생략으로 조용히.
  const { data: weeklyRows } = useQuery({
    queryKey: ['weekly-report', user?.id],
    queryFn: () => fetchWeeklyReportRows(user.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const weekly = useMemo(() => (weeklyRows ? buildWeeklyReport(weeklyRows) : null), [weeklyRows]);
  // 그룹이 있으면 이 주간 값을 그룹 합계에도 올린다 — /groups를 안 여는 멤버가 「이번 주 우리」에서 빠지지 않게(STATS-MAP-001).
  useGroupSnapshotPush(user?.id, weekly);

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

  // 실제 기억률(TRUE-RET-001) — 진입 때는 지난 30일만(칸 한 줄), 1년 · 전체는 표를 열 때만 받는다(1년 ≈ 15쪽 — 첫 화면에 얹지 않는다).
  // 긴 조회가 끝나면 칸 줄도 그것으로 센다(30일 밖의 직전 채점까지 보여 예전 일정 추정이 맞아진다 — 표와 칸이 같은 값).
  const [retentionOpen, setRetentionOpen] = useState(false);
  const recentRetention = useQuery({
    queryKey: trueRetentionQueryKey(user?.id, 'recent'),
    queryFn: () => fetchTrueRetentionRows(user.id, { range: 'recent' }),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const longRetention = useQuery({
    queryKey: trueRetentionQueryKey(user?.id, 'all'),
    queryFn: () => fetchTrueRetentionRows(user.id, { range: 'all' }),
    enabled: !!user && retentionOpen,
    staleTime: 1000 * 60 * 5,
  });
  const retentionRows = longRetention.data || recentRetention.data;
  const retention = useMemo(() => (retentionRows ? buildTrueRetention({ ...retentionRows, lang }) : null), [retentionRows, lang]);
  const longRetentionStatus = longRetention.data ? 'ready' : longRetention.isError ? 'error' : 'loading';

  // 배움의 「목표 정하기」 · 오늘 목표 칸(/progress?goal=edit)으로 들어오면 프로필을 받은 뒤 목표 편집을 연다 — 들어올 때 한 번만.
  // 저장하면 프로필을 다시 받아 profile이 바뀌는데, 그때마다 주소를 다시 읽으면 방금 닫은 창이 또 열렸다(PROFILE-REDESIGN-001 실화면 확인).
  const goalParamRead = useRef(false);
  useEffect(() => {
    if (!profile || goalParamRead.current) return;
    goalParamRead.current = true;
    try { if (new URLSearchParams(window.location.search).get('goal') === 'edit') setGoalOpen(true); } catch { /* 주소를 못 읽으면 닫힌 채로 */ }
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
        <button type="button" className="learn-button-s" onClick={() => setGoalOpen(true)} aria-haspopup="dialog">목표 수정</button>
      </div>
      {error && (
        <div className="manabi-inline-state" role="alert">
          학습 통계를 불러오지 못했어요. <button type="button" onClick={() => refetch()}>다시 시도</button>
        </div>
      )}
      <div className="learn-grid learn-stats">
        <GoalTrackTile className="learn-order-1" onOpen={() => setGoalOpen(true)} />
        <TodayGoalTile vocab={vocab} projections={projections} profile={profile} empty={!data} className="learn-order-2" onOpen={() => setGoalOpen(true)} />
        <StreakTile profile={profile} className="learn-order-3" />
        <HeatmapCard dayCounts={studyDays} hasOlder={hasOlderRecord} className="learn-order-6" />
        {/* 빈 주에도 칸은 자리를 지킨다(오너 확정 2026-08-30 "상시 표시") — 게이트는 로드 대기만, 로드 전은 같은 칸의 「–」. */}
        {weekly ? <WeeklyTile weekly={weekly} vocab={data?.vocab} projections={projections} className="learn-order-4" /> : <StatTile value="–" label="이번 주" className="learn-order-4" />}
        <StatTile value={Array.isArray(knownRows) ? knownRows.length.toLocaleString('ko-KR') : '–'} label={METRICS.knownMarked.label} className="learn-order-5" />
        <LevelVocabCard lang={lang} vocab={vocab} projections={projections} knownRows={knownRows || []} className="learn-order-7" />
        <MemoryHealthCard lang={lang} projections={projections} now={data?.now || Date.now()} className="learn-order-8"
          trueRetention={user ? { table: retention, loading: !retention && !recentRetention.isError } : null}
          onOpenTrueRetention={() => setRetentionOpen(true)} />
      </div>
      {retentionOpen && (
        <TileModal title="실제 기억률" className="tile-modal--wide" onClose={() => setRetentionOpen(false)}>
          <TrueRetentionTable table={retention} longStatus={longRetentionStatus} failed={!retention && recentRetention.isError}
            onRetry={() => { if (!retention) recentRetention.refetch(); longRetention.refetch(); }}
            reviewHref={serializeReviewScope({ lang })} />
        </TileModal>
      )}
      {/* 목표 창(GOAL-SHEET-001) — 닫혀 있어도 붙여 둔다(이 기기 목표를 서버로 한 번 끌어올린다). */}
      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} />
    </div>
  );
}

/* ── 이번 주 타일(오너 확정 2026-08-26) — 주간 거울을 '오늘 활동' 자리·크기(1×1)로.
     대표 축 하나만 크게: 복습 → 담은 말 → 만난 말 → 완독 순으로 처음 0이 아닌 것.
     빈 주에도 타일은 자리를 지킨다(오너 확정 2026-08-30 "상시 표시" — 숨김이 '위젯
     사라짐'으로 읽혔다). 값은 0 대신 스트릭 타일의 '–' 선례 — 0 무표기 원칙과의
     절충점. 탭하면 전체 거울을 모달로 편다(DdayTile의 타일→모달 정본 재사용 —
     지난주 병기는 모달에만 남는다). ── */
function WeeklyTile({ weekly, vocab = null, projections = null, className = '' }) {
  const [open, setOpen] = useState(false);
  // 창 안의 한 겹 더 — 「다시 만난 말」(STATS-MAP-001). 닫으면 다음에 다시 이번 주부터.
  const [view, setView] = useState('week');
  const close = () => { setOpen(false); setView('week'); };
  const acc = weekly.reviews.accuracy == null ? null : Math.round(weekly.reviews.accuracy * 100);
  const [value, label] = weekly.reviews.total > 0
    ? [`${weekly.reviews.total}`, `이번 주 복습${acc != null ? ` · ${acc}%` : ''}`]
    : weekly.newWords > 0 ? [`${weekly.newWords}`, '이번 주 담은 말']
    : weekly.conversation?.turns > 0 ? [`${weekly.conversation.turns}`, '이번 주 대화'] // 복습 없이 대화만 한 주(오너 「권장대로」 — 담은 말 다음)
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
        <WeeklyModal weekly={weekly} vocab={vocab} projections={projections} view={view} setView={setView} onClose={close} />
      )}
    </>
  );
}

/* ── 이번 주 창 — 이번 주 · 다시 만난 말(들어옴) · 직접 쓴 말(나감) 겹. 두 지표 재료는 창을 연 사람에게만 받는다(홈 · 현황 첫 화면 비용 0). ── */
function WeeklyModal({ weekly, vocab, projections, view, setView, onClose }) {
  const { user } = useAuth();
  const weekStartMs = weekly.week.startMs;
  const { data: remet } = useQuery({
    queryKey: ['remet', user?.id, weekStartMs],
    queryFn: () => fetchRemetWeeks(user.id, { weekStartMs, vocabRows: Array.isArray(vocab) ? vocab : null }),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const { data: output } = useQuery({
    queryKey: ['output-words', user?.id, weekStartMs],
    queryFn: () => fetchOutputWeeks(user.id, { weekStartMs, vocabRows: Array.isArray(vocab) ? vocab : [] }),
    enabled: !!user?.id && Array.isArray(vocab),
    staleTime: 1000 * 60 * 5,
  });
  // 칩 → 단어 카드. 카드가 떠 있으면 Esc · 바깥 누르기는 카드만 닫는다(창의 Esc 처리기가 먼저 걸려 있어 둘 다 닫히던 것).
  const [detail, setDetail] = useState(null);
  const rowsByWord = useMemo(() => new Map((vocab || []).map(v => [v.word_text, v])), [vocab]);
  const projectionById = useMemo(() => new Map((projections || []).map(p => [p?.vocabulary?.id, p])), [projections]);
  const openWord = word => { const row = rowsByWord.get(word); if (row) setDetail(row); };
  const trail = view === 'remet' ? remet : view === 'output' ? output : null;
  if (trail && TRAILS[view]) {
    return (
      <>
        <TileModal title={TRAILS[view].title} className="tile-modal--wide" onClose={detail ? () => setDetail(null) : onClose} onBack={() => setView('week')} backLabel="이번 주">
          <TrailView spec={TRAILS[view]} data={trail} onWord={rowsByWord.size ? openWord : null} />
        </TileModal>
        {detail && <VocabDetailCard word={detail} projection={projectionById.get(detail.id)} now={new Date()} onClose={() => setDetail(null)} ttsSupported={false} />}
      </>
    );
  }
  return (
    <TileModal title={`이번 주 (${weekRangeLabel(weekly.week)})`} className="tile-modal--wide" onClose={onClose}>
      <WeeklyReportCard weekly={weekly} header={false} showWeakness remetTotal={remet?.week.total || 0} onOpenRemet={() => setView('remet')}
        outputTotal={output?.week.total || 0} onOpenOutput={() => setView('output')} />
    </TileModal>
  );
}

/* ── 다시 만난 말 · 직접 쓴 말 창(목업 「ㅇㅋ 진행해」 2026-11-01 · 「2번 좋네 이대로 ㄱㄱ」 2026-11-02 KST) — 이번 주 창과 같은 부품:
     장미색 큰 숫자 · 세 칸 · 목록. 큰 숫자 = 서로 다른 말 · 목록 = 글 · 작문 · 대화별 말(많은 순, 다섯 개 + N).
     지난주는 회색 한 줄(화살표 · 색 평가 없음 — 거울 규약). 정의 · 셈은 lib/remetWords · lib/usedWords.
     다시 만난 말 = 들어옴(복습한 말이 읽은 글 · 대화에 다시 나옴) ↔ 직접 쓴 말 = 나감(담은 말을 작문 · 대화에서 직접 씀). ── */
const REMET_CHIPS = 5;
const TRAILS = Object.freeze({
  remet: {
    title: '다시 만난 말',
    cells: d => [[d.reading, '편', '글'], [d.conversation, '개', '대화'], [d.reviews, '번', '복습']],
    note: '복습한 말이 이번 주 읽은 글 · 대화에 다시 나왔어요',
    empty: '이번 주에는 아직 없어요. 복습한 말이 나오는 글을 읽으면 여기에 쌓여요.',
    kind: { reading: '글', conversation: '대화' },
    href: src => `/viewer/${src.id}`,
  },
  output: {
    title: '직접 쓴 말',
    cells: d => [[d.writing, '편', '작문'], [d.conversation, '개', '대화'], [d.firstTime, '개', '처음 씀']],
    note: '담은 말을 이번 주 작문 · 대화에서 직접 썼어요',
    empty: '이번 주에는 아직 없어요. 작문이나 대화에서 담은 말을 써 보면 여기에 쌓여요.',
    kind: { writing: '작문', conversation: '대화' },
    href: src => (src.kind === 'writing' ? '/writing' : `/viewer/${src.id}`),
  },
});
function TrailView({ spec, data, onWord = null }) {
  const { week, prev } = data;
  const cells = spec.cells(week);
  return (
    <div className="learn-week">
      <div className="learn-week__hero">
        <div className="learn-week__hero-k">
          <span>이번 주</span>
          {prev.total > 0 && <span>지난주 {prev.total}개</span>}
        </div>
        {week.total > 0 ? <>
          <div className="learn-week__num"><strong>{week.total.toLocaleString('ko-KR')}</strong><span>개</span></div>
          <p className="learn-week__note">{spec.note}</p>
        </> : <p className="learn-week__empty">{spec.empty}</p>}
      </div>
      {week.total > 0 && <>
        <div className="learn-week__cells">
          {cells.map(([n, unit, label]) => (
            <div key={label} className="learn-week__cell">
              <b>{n > 0 ? `${n.toLocaleString('ko-KR')}${unit}` : '–'}</b><span>{label}</span>
            </div>
          ))}
        </div>
        <div className="learn-week__list">
          {week.sources.map(src => (
            <div key={`${src.kind}:${src.id}`} className="learn-remet__src">
              <Link href={spec.href(src)} prefetch={false} className="learn-remet__top">
                <span className="learn-remet__title"><span className="learn-remet__kind">{spec.kind[src.kind] || ''}</span><span>{src.title || '제목 없음'}</span></span>
                <em>{src.words.length}개 <span aria-hidden="true">›</span></em>
              </Link>
              <span className="learn-remet__chips">
                {src.words.slice(0, REMET_CHIPS).map(w => (onWord
                  ? <button key={w} type="button" onClick={() => onWord(w)} aria-label={`${w} 단어 카드`}>{w}</button>
                  : <span key={w}>{w}</span>))}
                {src.words.length > REMET_CHIPS && <span className="is-more">+{src.words.length - REMET_CHIPS}</span>}
              </span>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

/** 담은 곳 이름 — SAVED_SOURCES 순서 그대로. */
const SAVED_SOURCE_LABEL = Object.freeze({ reading: '읽기', conversation: '대화', level: '단어 목록', study: '오늘 학습', manual: '직접' });

/* ── 이번 주 카드(rfc-weekly-report 목업 A → 2차 목업 「ㅇㅋ」 2026-11-01 KST) — 거울이지 성적표가 아니다:
     지난주는 회색 병기만(증감 화살표 · 빨강 · 초록 없음). 새 모양 없이 있는 화면 부품을 빌린다 —
     복습 큰 숫자 = 복습 화면 「오늘 다시 볼 표현」, 세 칸 = 내 정보 「내 기록」(0은 「–」로 자리 지킴),
     자세히 목록 = 내 정보 목록 묶음(줄이라 0인 항목은 줄째 빠진다 — 「0은 쓰지 않는다」 그대로). ── */
function WeeklyReportCard({ weekly, header = true, showWeakness = false, remetTotal = 0, onOpenRemet = null, outputTotal = 0, onOpenOutput = null }) {
  const pct = (a) => (a == null ? null : Math.round(a * 100));
  const acc = pct(weekly.reviews.accuracy);
  const prevAcc = pct(weekly.prevReviews.accuracy);
  const cells = [
    [weekly.newWords, '', '새로 담은 말'],
    [weekly.metWords, '', '만난 말'],
    [weekly.readsCompleted, '편', '완독'],
  ];
  // 대화 성과 · 담은 곳(STATS-MAP-001 S7). 0인 항목은 쓰지 않는다.
  const conv = weekly.conversation || {};
  const convParts = [];
  if (conv.fixed > 0) convParts.push(`고친 문장 ${conv.fixed}`);
  if (conv.reaskOk > 0) convParts.push(`다시 쓴 문형 ${conv.reaskOk}`);
  // 담은 곳 — 많은 순(같으면 SAVED_SOURCES 순서). 막대 색은 순위로(공부한 날 칸과 같은 장미색 단계).
  const sources = weekly.newWords > 0
    ? SAVED_SOURCES.filter(key => weekly.savedBySource?.[key] > 0)
      .map(key => ({ key, label: SAVED_SOURCE_LABEL[key], n: weekly.savedBySource[key] }))
      .sort((x, y) => y.n - x.n)
    : [];
  const sourceTotal = sources.reduce((sum, src) => sum + src.n, 0);
  if (!weekly.hasAny) {
    return (
      <div className="learn-week">
        {header && <div className="learn-week__head">이번 주 ({weekRangeLabel(weekly.week)})</div>}
        <p className="learn-week__empty">이번 주 기록이 아직 없어요.</p>
      </div>
    );
  }
  return (
    <div className="learn-week">
      {header && <div className="learn-week__head">이번 주 ({weekRangeLabel(weekly.week)})</div>}
      <div className="learn-week__hero">
        <div className="learn-week__hero-k">
          <span>복습</span>
          {weekly.prevReviews.total > 0 && <span>지난주 {weekly.prevReviews.total}문항{prevAcc != null ? ` · ${prevAcc}%` : ''}</span>}
        </div>
        {weekly.reviews.total > 0 ? <>
          <div className="learn-week__num"><strong>{weekly.reviews.total.toLocaleString('ko-KR')}</strong><span>문항</span></div>
          {acc != null && (
            <div className="learn-week__acc">
              <span>정답 <b>{acc}%</b></span>
              <span className="learn-week__bar" role="img" aria-label={`정답 ${acc}%`}><i style={{ width: `${acc}%` }} /></span>
            </div>
          )}
        </> : <p className="learn-week__empty">이번 주 복습 기록이 아직 없어요.</p>}
      </div>
      <div className="learn-week__cells">
        {cells.map(([n, unit, label]) => (
          <div key={label} className="learn-week__cell">
            <b>{n > 0 ? `${n.toLocaleString('ko-KR')}${unit}` : '–'}</b><span>{label}</span>
          </div>
        ))}
      </div>
      <div className="learn-week__list">
        {conv.turns > 0 && (
          <div className="learn-week__row">
            <span>대화</span>
            <div><b>{`${conv.turns}마디`}</b>{convParts.length > 0 && <><br />{convParts.join(' · ')}</>}</div>
          </div>
        )}
        {sources.length > 0 && (
          <div className="learn-week__row learn-week__row--full">
            <div className="learn-week__row-top"><span>담은 곳</span><em>{sourceTotal}개</em></div>
            <span className="learn-week__stack" role="img" aria-label={`담은 곳: ${sources.map(src => `${src.label} ${src.n}`).join(', ')}`}>
              {sources.map((src, i) => <i key={src.key} className={`r${i}`} style={{ flexGrow: src.n }} />)}
            </span>
            <span className="learn-week__legend">
              {sources.map((src, i) => <span key={src.key}><i className={`r${i}`} />{src.label} <b>{src.n}</b></span>)}
            </span>
          </div>
        )}
        {remetTotal > 0 && onOpenRemet && (
          <button type="button" className="learn-week__row learn-week__row--tap" onClick={onOpenRemet}>
            <span>다시 만난 말</span>
            <div><b>{remetTotal.toLocaleString('ko-KR')}개</b> <span aria-hidden="true">›</span></div>
          </button>
        )}
        {outputTotal > 0 && onOpenOutput && (
          <button type="button" className="learn-week__row learn-week__row--tap" onClick={onOpenOutput}>
            <span>직접 쓴 말</span>
            <div><b>{outputTotal.toLocaleString('ko-KR')}개</b> <span aria-hidden="true">›</span></div>
          </button>
        )}
        {showWeakness && <WeakSpotLine weekStartMs={weekly.week.startMs} />}
      </div>
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
    <div className="learn-week__row">
      <span>약한 곳</span>
      <div style={{ color: 'var(--text-muted)' }}>{line}</div>
    </div>
  );
}

/** 타일 공용 미니 모달 */
function TileModal({ title, onClose, children, className = '', onBack = null, backLabel = '' }) {
  // 열면 창 안으로 · Esc로 닫기 · 닫으면 연 타일로 포커스(useDialogReturn — ConfirmModal 선례).
  const dialogRef = useDialogReturn(onClose);
  return (
    <div className="tile-modal__overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title} ref={dialogRef} tabIndex={-1}>
      <div className={`card tile-modal ${className}`.trim()} onClick={e => e.stopPropagation()}>
        <div className="tile-modal__head">
          {onBack ? (
            <div>
              <button type="button" className="tile-modal__back" onClick={onBack}><span aria-hidden="true">‹ </span>{backLabel}</button>
              <h3 className="tile-modal__title">{title}</h3>
            </div>
          ) : <h3 className="tile-modal__title">{title}</h3>}
          <button type="button" className="tile-modal__close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── 공부한 날 반쪽(2×1, 오너 결정 3 · 2026-11-01 KST) — 최근 1년(52주). 칸 크기 · 카드 크기는 그대로라 한 번에 24주가 보이고,
     옆으로 밀면 1년 전까지 이어진다(오너 「ㅇㅋ」 시안 2 — 버튼 · 달 이름 · 범례 없이 밀기만). 처음엔 오늘이 맨 오른쪽 아래.
     한 칸 = 학습일(04시) 하나 = 답한 문항 + 담은 말. 색은 그 기간 최대 대비 4단계(A안). 왼쪽 가장자리 흐림 = 더 있다는 표시.
     퍼센트는 회색 그대로 — 색 · 목표선 없음(거울이지 성적표가 아니다). 기준은 첫 기록부터(1년 넘으면 1년) — studyDaysBasis.
     머리글은 「N일 · Z%」만(오너 「더 심플하게」), 기준은 말풍선. ── */

/** 공부한 날 칸 요약(화면 읽기) — 「지난 1년 228일 공부 · 63% · 마지막 11월 1일」. 기록이 없으면 「아직 공부한 날이 없어요」. */
function studyStripLabel(days, total, basis) {
  const last = [...days].reverse().find(key => total(key) > 0);
  if (!basis || !last) return '공부한 날 — 아직 공부한 날이 없어요';
  const since = basis.sinceDay ? `${Number(basis.sinceDay.slice(5, 7))}월 ${Number(basis.sinceDay.slice(8))}일부터` : '지난 1년';
  return `공부한 날 — ${since} ${basis.studied}일 공부 · ${basis.percent}% · 마지막 ${Number(last.slice(5, 7))}월 ${Number(last.slice(8))}일`;
}

function HeatmapCard({ dayCounts, hasOlder = false, className = '' }) {
  const todayStart = learningDayStartMs(Date.now());
  const days = Array.from({ length: HEATMAP_DAYS }, (_, i) => learningDateString(todayStart - (HEATMAP_DAYS - 1 - i) * DAY_MS));
  const total = key => (dayCounts[key]?.answers || 0) + (dayCounts[key]?.saved || 0);
  const maxCount = Math.max(1, ...days.map(total));
  const basis = studyDaysBasis(days, dayCounts, { hasOlder });
  const levelOf = n => (!n ? '' : `l${Math.min(4, Math.max(1, Math.ceil((n / maxCount) * 4)))}`);
  const viewRef = useRef(null);
  const [atStart, setAtStart] = useState(false);
  // 처음엔 오늘(맨 오른쪽)이 보이게 — 칠하기 전에 맞추고, 사람이 넘기기 전까지는 폭이 바뀌어도(칸 크기는 보이는 폭에서 나온다)
  // 오른쪽 끝에 붙어 있는다. 늦게 정해지는 격자 폭에 처음 위치가 어긋나던 것(실측: 끝 336px 중 102px에 멈춤).
  const touched = useRef(false);
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return undefined;
    const pin = () => { if (!touched.current) view.scrollLeft = view.scrollWidth; setAtStart(view.scrollLeft <= 1); };
    pin();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(pin);
    observer.observe(view);
    if (view.firstElementChild) observer.observe(view.firstElementChild);
    return () => observer.disconnect();
  }, []);
  const touch = () => { touched.current = true; };
  // 마우스로 끌어 넘기기 — 손가락 · 트랙패드 · 키보드(← →)는 브라우저 기본 가로 스크롤.
  const drag = useRef(null);
  const onPointerDown = e => {
    touch();
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { x: e.clientX, left: viewRef.current.scrollLeft };
    viewRef.current.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = e => { if (drag.current) viewRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x); };
  const endDrag = () => { drag.current = null; };

  return (
    <div className={`learn-tile learn-heatmap ${className}`.trim()}>
      <div className="learn-sec-head">
        <h2 className="learn-sec-title">공부한 날</h2>
        {basis && (
          <span className="learn-sec-meta" title={basis.sinceDay ? `${Number(basis.sinceDay.slice(5, 7))}월 ${Number(basis.sinceDay.slice(8))}일 첫 기록부터` : '지난 1년'}>
            <b>{basis.studied}일</b> · {basis.percent}%
          </span>
        )}
      </div>
      <div ref={viewRef} className={`learn-heatmap__view${atStart ? ' is-start' : ''}`} tabIndex={0}
        aria-label="공부한 날 1년 — 옆으로 밀면 지난 기록" onScroll={e => setAtStart(e.currentTarget.scrollLeft <= 1)}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onWheel={touch} onKeyDown={touch} onTouchStart={touch}>
        {/* 화면 읽기 — 빈 칸 364개 대신 요약 한 줄(칸 설명은 마우스 말풍선용 title 그대로). */}
        <div className="learn-heatmap__strip" role="img" aria-label={studyStripLabel(days, total, basis)}>
          {days.map(key => <i key={key} aria-hidden="true" className={levelOf(total(key)) || undefined} title={studyDayLabel(key, dayCounts[key])} />)}
        </div>
      </div>
    </div>
  );
}
