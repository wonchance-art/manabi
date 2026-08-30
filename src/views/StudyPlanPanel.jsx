'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { REF_GRAMMAR_MANIFEST } from '../content/refGrammarManifest';
import { buildPlan, markProgress } from '../lib/studyPlan';

/**
 * 내 진도 — 관리자 학습 진도표 (v2-D R1, #1077 설계 §1).
 *
 * 예전에는 표가 세 곳으로 갈려 있었다: 계획은 이 파일의 PLAN 상수(정본의 손복사본,
 * slug가 없어 대조 불가), 진도는 서버 `user_ref_progress`, 체크는 손으로 누르는
 * localStorage. 손 체크는 실제로 읽었는지와 무관해서 표가 학습을 반영하지 못했다.
 *
 * 이제 계획은 정본 manifest에서 유도하고(`buildPlan`), 진도는 서버 한 곳에서만 읽는다
 * (`markProgress`). 계획표가 곧 진도표라 누를 것이 없고, 정본 챕터가 개편되면 표가
 * 저절로 따라온다. 번호는 그 챕터로 가는 문이다.
 */

// R2에서 `profiles.dday_date`(이미 있는 목표 날짜)로 대체한다 — 설계 §2.
const TARGET = '2026-12-31';

// 목표 레벨. 정본 복사본이 아니라 **레벨 키 하나씩**을 가리킬 뿐이다(챕터·제목·순서·
// 개수는 전부 manifest에서 온다). R2에서 `profiles.goal_lang`·`goal_level`로 옮긴다.
const GOALS = [
  { lang: 'Chinese', upto: 'H5', goalLabel: 'HSK 5' },
  { lang: 'French', upto: 'B2', goalLabel: 'B2' },
];

// 계획은 정본에서 한 번 유도하면 끝이다 — 사용자·진도와 무관한 정적 산출이라 모듈에서 굳힌다.
const LANGS = GOALS.map(g => g.lang);
const PLANS = GOALS
  .map(g => {
    const plan = buildPlan(REF_GRAMMAR_MANIFEST, g.lang, { upto: g.upto });
    return plan ? { ...plan, goalLabel: g.goalLabel } : null;
  })
  .filter(Boolean);

const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / 86400000);

function LangPlan({ plan, rows, state }) {
  const p = useMemo(() => markProgress(plan, rows), [plan, rows]);

  const daysLeft = Math.max(1, daysBetween(new Date(), new Date(TARGET + 'T23:59:59')));
  const weeksLeft = Math.max(0.5, daysLeft / 7);
  const perWeek = Math.ceil(p.remaining / weeksLeft);

  return (
    <section className="myplan-lang">
      <div className="myplan-lang__head">
        <h3 className="myplan-lang__title">{p.flag} {p.name} → {p.goalLabel}</h3>
        <span className="myplan-lang__sub">정본 문법 {p.total}챕터</span>
      </div>
      <div className="myplan-bar"><div className="myplan-bar__fill" style={{ width: `${p.pct}%` }} /></div>
      <div className="myplan-stat">
        {state === 'loading' && <>진도 불러오는 중…</>}
        {state === 'error' && <>진도를 불러오지 못했어요 — 계획만 보여요</>}
        {state === 'guest' && <>로그인하면 읽음·통과 기록이 그대로 진도가 돼요</>}
        {state === 'ready' && (
          <>
            <strong>{p.done}/{p.total}</strong> ({p.pct}%)
            {p.next ? (
              <> · 남은 {p.remaining} · 권장 <strong>주 {perWeek}</strong> · 다음{' '}
                <Link className="myplan-next" href={p.next.href}>#{p.next.seq} {p.next.topic}</Link>
              </>
            ) : <> · 🎉 완주!</>}
          </>
        )}
      </div>

      {p.levels.map(level => (
        <div key={level.key} className="myplan-level">
          <div className="myplan-level__name">
            {level.label}
            <span className="myplan-level__count">{level.done}/{level.total}</span>
            {/* 문형·어휘는 레벨 단위 화면이라 진도가 아니라 길만 놓는다(어휘 축 합류는 R3). */}
            {level.bunkeiHref && <Link className="myplan-level__link" href={level.bunkeiHref}>문형 {level.bunkeiCount}</Link>}
            {level.vocabHref && <Link className="myplan-level__link" href={level.vocabHref}>어휘 {level.vocabCount}</Link>}
          </div>
          <div className="myplan-chips">
            {level.chapters.map(c => (
              <Link
                key={c.slug}
                href={c.href}
                className={`myplan-chip ${c.done ? 'is-done' : ''} ${c.slug === p.next?.slug ? 'is-next' : ''}`}
                title={c.title}
              >
                <span className="myplan-chip__n">{c.done ? '✓' : c.seq}</span>
                <span className="myplan-chip__label">{c.topic}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function StudyPlanPanel() {
  const { user } = useAuth();

  // 진도는 이미 쌓이고 있는 것을 읽기만 한다 — 새 테이블·새 이벤트 0(설계 §5 이음새 신설 0).
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['study-plan-progress', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_ref_progress')
        .select('lang, slug, read, passed')
        .eq('user_id', user.id)
        .in('lang', LANGS);
      if (error) throw error;
      return data || [];
    },
  });

  const state = !user?.id ? 'guest' : isLoading ? 'loading' : isError ? 'error' : 'ready';
  const dleft = daysBetween(new Date(), new Date(TARGET + 'T23:59:59'));

  return (
    <div className="myplan">
      <div className="myplan__head">
        <h2 className="myplan__title">📅 내 진도 — 올 12월까지</h2>
        <p className="myplan__lead">
          정본 문법 챕터를 순서대로. <strong>진도는 읽음·통과 기록에서 그대로</strong> 와요 —
          따로 체크할 것이 없고, 챕터가 개편되면 표도 같이 바뀝니다.
          {' '}번호를 누르면 그 챕터로 가요.
          {' '}목표 <strong>{TARGET}</strong> · <strong>D-{dleft}</strong>
        </p>
      </div>
      <div className="myplan__grid">
        {PLANS.map(plan => <LangPlan key={plan.lang} plan={plan} rows={rows} state={state} />)}
      </div>
    </div>
  );
}
