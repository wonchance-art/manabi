'use client';
/**
 * 진행바 반쪽(2×1) — 목표 궤도 (LEARN-HOME-AK-001, 세로 배치 = 오너 채택 B 등간격).
 *
 * 계산은 예전 궤도 카드와 같은 정본이다: 계획 = studyPlan.buildPlan(관리자 진도표와 같은 함수),
 * 진도 = markProgress(user_ref_progress), 속도 · 예상 완주 = goalPace.pace · countRecentDone.
 * 과정 목록은 목표가 있을 때만 /api/goal-catalog에서 받는다(홈 페이지에 정본 투영을 싣지 않는다 — P4).
 * 목표가 없으면 「목표를 정하면」 빈 상태 — 목표 편집은 현황의 한 모달(목표 · D-Day)에서만 한다.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { buildPlan, markProgress } from '@/lib/studyPlan';
import { countRecentDone, pace } from '@/lib/goalPace';
import { fetchGoalProgressRows } from '@/lib/goalRows';
import { goalTrackView } from '@/lib/learnDashboard';

export async function fetchGoalCatalog() {
  const response = await fetch('/api/goal-catalog');
  if (!response.ok) throw new Error('goal_catalog_unavailable');
  return response.json();
}

export function useGoalCatalog(enabled = true) {
  return useQuery({ queryKey: ['goal-catalog'], queryFn: fetchGoalCatalog, enabled, staleTime: Infinity, gcTime: Infinity });
}

/** 목표 궤도 — { status: 'none' | 'loading' | 'ready', view } */
export function useGoalTrack() {
  const { user, profile } = useAuth();
  const goalLang = profile?.goal_lang;
  const goalLevel = profile?.goal_level;
  const goalDate = profile?.dday_date;
  const hasGoal = !!(user?.id && goalLang && goalLevel && goalDate);
  const catalog = useGoalCatalog(hasGoal);
  const plan = useMemo(
    () => (hasGoal && catalog.data ? buildPlan({ languages: catalog.data }, goalLang, { upto: goalLevel }) : null),
    [hasGoal, catalog.data, goalLang, goalLevel],
  );
  const { data: rows, isLoading } = useQuery({
    queryKey: ['goal-progress', user?.id, goalLang],
    enabled: hasGoal && !!plan,
    queryFn: () => fetchGoalProgressRows(user.id, goalLang),
    staleTime: 1000 * 60 * 5,
  });
  const view = useMemo(() => {
    if (!plan || !rows) return null;
    const marked = markProgress(plan, rows);
    const slugSet = new Set(plan.levels.flatMap(lv => lv.chapters).map(c => c.slug));
    const p = pace({ remaining: marked.remaining, targetDate: goalDate, recentDone: countRecentDone(rows, slugSet) });
    // 목표 이름은 사용자가 D-Day에 적어 둔 말이 우선 — 「HSK 5」라고 적었으면 그대로 부른다.
    const goalName = profile?.dday_label || plan.levels[plan.levels.length - 1]?.label || goalLevel;
    return goalTrackView({ marked, p, goalName, goalDate });
  }, [plan, rows, goalDate, goalLevel, profile?.dday_label]);
  if (!hasGoal || catalog.isError) return { status: 'none', view: null };
  if (!view) return { status: catalog.isLoading || isLoading || !rows ? 'loading' : 'none', view: null };
  return { status: 'ready', view };
}

/** 칸 겉 — 배움에서는 링크(현황으로), 현황에서는 목표 편집을 여는 버튼(onOpen). */
function Shell({ onOpen, href, className, children, ...rest }) {
  if (onOpen) return <button type="button" className={className} onClick={onOpen} {...rest}>{children}</button>;
  return <Link href={href} prefetch={false} className={className} {...rest}>{children}</Link>;
}

export default function GoalTrackTile({ className = '', href = '/progress', editHref = '/progress?goal=edit', onOpen }) {
  const { status, view } = useGoalTrack();
  if (status === 'loading') {
    return <div className={`learn-tile learn-goal learn-goal--empty ${className}`.trim()} role="status"><span className="learn-goal__line">목표 불러오는 중…</span></div>;
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
