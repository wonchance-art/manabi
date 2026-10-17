'use client';
/**
 * 진행바 반쪽(2×1) — 목표 궤도 (LEARN-HOME-AK-001, 세로 배치 = 오너 채택 B 등간격).
 *
 * 계산은 예전 궤도 카드와 같은 정본이다: 계획 = studyPlan.buildPlan(관리자 진도표와 같은 함수),
 * 진도 = markProgress(user_ref_progress), 속도 · 예상 완주 = goalPace.pace · countRecentDone.
 * 과정 목록은 목표가 있을 때만 /api/goal-catalog에서 받는다(홈 페이지에 정본 투영을 싣지 않는다 — P4).
 * 목표가 없으면 「목표를 정하면」 빈 상태 — 목표 편집은 현황의 한 모달(목표 · D-Day)에서만 한다.
 */
import { useId, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { buildPlan, markProgress } from '@/lib/studyPlan';
import { countRecentDone, pace } from '@/lib/goalPace';
import { fetchGoalProgressRows } from '@/lib/goalRows';
import { goalTrackView } from '@/lib/learnDashboard';
import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';

export async function fetchGoalCatalog() {
  const response = await fetch('/api/goal-catalog');
  if (!response.ok) throw new Error('goal_catalog_unavailable');
  return response.json();
}

export function useGoalCatalog(enabled = true) {
  return useQuery({ queryKey: ['goal-catalog'], queryFn: fetchGoalCatalog, enabled, staleTime: Infinity, gcTime: Infinity });
}

/** 목표 궤도 — { status: 'none' | 'loading' | 'error' | 'ready', view, retry? } */
export function useGoalTrack() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const goalLang = profile?.goal_lang;
  const goalLevel = profile?.goal_level;
  const goalDate = profile?.dday_date;
  const hasGoal = !!(user?.id && goalLang && goalLevel && goalDate);
  const catalog = useGoalCatalog(hasGoal);
  const plan = useMemo(
    () => (hasGoal && catalog.data ? buildPlan({ languages: catalog.data }, goalLang, { upto: goalLevel }) : null),
    [hasGoal, catalog.data, goalLang, goalLevel],
  );
  const progress = useQuery({
    queryKey: ['goal-progress', user?.id, goalLang],
    enabled: hasGoal && !!plan,
    queryFn: () => fetchGoalProgressRows(user.id, goalLang),
    staleTime: 1000 * 60 * 5,
  });
  const rows = progress.data;
  const view = useMemo(() => {
    if (!plan || !rows) return null;
    const marked = markProgress(plan, rows);
    const slugSet = new Set(plan.levels.flatMap(lv => lv.chapters).map(c => c.slug));
    const p = pace({ remaining: marked.remaining, targetDate: goalDate, recentDone: countRecentDone(rows, slugSet) });
    // 목표 이름은 사용자가 D-Day에 적어 둔 말이 우선 — 「HSK 5」라고 적었으면 그대로 부른다.
    const goalName = profile?.dday_label || plan.levels[plan.levels.length - 1]?.label || goalLevel;
    return goalTrackView({ marked, p, goalName, goalDate });
  }, [plan, rows, goalDate, goalLevel, profile?.dday_label]);
  // 받는 중 · 없음 · 실패를 가른다(LOADING-SKELETON-001 리뷰). 로그인 확인 · 프로필 받는 중에 profile이 비어 있다고
  // 「목표를 정하면」(거짓 빈 상태)을 보이지 않고, 실패 · 셀 수 없음을 「불러오는 중」으로 영원히 두지도 않는다.
  if (authLoading || (user?.id && profileLoading)) return { status: 'loading', view: null };
  if (!hasGoal || catalog.isError) return { status: 'none', view: null };
  if (view) return { status: 'ready', view };
  if (!catalog.data) return { status: 'loading', view: null };
  if (!plan) return { status: 'none', view: null }; // 목표 언어 · 과정이 목록에 없다 — 궤도를 셀 수 없다
  if (progress.isError) return { status: 'error', view: null, retry: () => progress.refetch() };
  return { status: 'loading', view: null };
}

/** 칸 겉 — 배움에서는 링크(현황으로), 현황에서는 목표 편집을 여는 버튼(onOpen). */
function Shell({ onOpen, href, className, children, ...rest }) {
  if (onOpen) return <button type="button" className={className} onClick={onOpen} {...rest}>{children}</button>;
  return <Link href={href} prefetch={false} className={className} {...rest}>{children}</Link>;
}

/** 목표 칸 골격(LOADING-SKELETON-001) — 받는 중 · 배움 대기 화면(home/loading.jsx)이 같은 칸을 쓴다. */
export function GoalTrackSkeleton({ className = '' }) {
  return (
    <SkeletonRegion className={`learn-tile learn-goal learn-goal--empty ${className}`.trim()} label="목표">
      <span aria-hidden="true">
        <span className="learn-goal__title"><SkeletonLine width="7em" /></span>
        <span className="learn-goal__line"><SkeletonLine width="14em" /></span>
      </span>
    </SkeletonRegion>
  );
}

// 진도 실패 알림 — 알림 영역은 칸 바깥에 늘 그려 두고 내용만 넣는다(칸은 상태마다 다른 요소라 칸 안의 영역은 매번 새로 생기고,
// 내용과 함께 생기는 role=status는 화면 낭독기가 놓칠 수 있다 — StudySessionPage grammarNotice와 같은 방식). 칸 밖이어도
// .skeleton-sr(absolute)라 배움 격자의 칸을 차지하지 않는다. 보이는 실패 줄은 같은 말을 두 번 읽지 않게 숨기고, 「다시 시도」가 이 영역을 설명으로 가리킨다.
export const GOAL_PROGRESS_FAILED = '목표 진도를 불러오지 못했어요.';

export default function GoalTrackTile(props) {
  const track = useGoalTrack();
  const noticeId = useId();
  return <>
    <span className="skeleton-sr" role="status" id={noticeId}>{track.status === 'error' ? GOAL_PROGRESS_FAILED : ''}</span>
    <GoalTrackBody {...props} track={track} noticeId={noticeId} />
  </>;
}

function GoalTrackBody({ className = '', href = '/progress', editHref = '/progress?goal=edit', onOpen, track, noticeId }) {
  const { status, view, retry } = track;
  if (status === 'loading') return <GoalTrackSkeleton className={className} />;
  // 진도를 받지 못했다 — 링크 칸 안에 버튼을 둘 수 없어 칸 자체는 링크가 아니다(문구 표준 「…지 못했어요.」 + 「다시 시도」).
  if (status === 'error') {
    return (
      <div className={`learn-tile learn-goal learn-goal--empty ${className}`.trim()}>
        <span aria-hidden="true"><span className="learn-goal__line">{GOAL_PROGRESS_FAILED}</span></span>
        <button type="button" className="learn-button-s" aria-describedby={noticeId} onClick={retry}>다시 시도</button>
      </div>
    );
  }
  if (!view) {
    return (
      <Shell onOpen={onOpen} href={editHref} className={`learn-tile learn-goal learn-goal--empty ${className}`.trim()}>
        <span>
          <span className="learn-goal__title">목표를 정하면</span>
          <span className="learn-goal__line">하루에 몇 과가 필요한지, 언제 끝날지 계산해 드려요</span>
        </span>
        <span className="learn-button-s">목표 정하기</span>
      </Shell>
    );
  }
  return (
    <Shell onOpen={onOpen} href={href} className={`learn-tile learn-goal ${className}`.trim()} aria-label={view.aria}>
      <small className="learn-goal__head">{view.head}</small>
      <b className="learn-goal__big learn-goal__d">{view.dLabel}</b>
      <b className={`learn-goal__big learn-goal__eta${view.signal ? ` is-${view.signal}` : ''}`}>
        {view.signal && view.eta && <span className="learn-goal__signal" aria-hidden="true" />}{view.eta || ''}
      </b>
      <span className="learn-goal__barcell"><span className="learn-goal__bar"><i style={{ width: `${view.pct}%` }} /><b style={{ left: `${view.pct}%` }} /></span></span>
      <span className="learn-goal__cap">
        <span><em>{view.count.done}</em> / {view.count.total}과</span>
        <span className={view.signal ? `is-${view.signal}` : undefined}>{view.caption}</span>
      </span>
    </Shell>
  );
}
