'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { isPassed } from '../components/RefPatternCheck';
import Button from '../components/Button';

/* ── 공용 헬퍼 ── */

const LANG_KO = { Japanese: '일본어', English: '영어', French: '프랑스어' };
const STATUS_KO = { recruiting: '모집 중', active: '진행 중', done: '수료' };

/** 오늘 기준 주차 (모집 중 = 0, 진행 중 = 1..weeks 클램프) */
function weekOf(cohort) {
  if (cohort.status === 'recruiting') return 0;
  const days = Math.floor((Date.now() - new Date(cohort.start_date).getTime()) / 86400000);
  return Math.min(cohort.weeks, Math.max(1, Math.floor(days / 7) + 1));
}

/** 챕터를 주차 수만큼 균등 분할 — 커리큘럼 자동 생성 */
function chunkCurriculum(chapters, weeks) {
  const out = [];
  const per = Math.ceil(chapters.length / weeks);
  for (let w = 0; w < weeks; w++) {
    const slice = chapters.slice(w * per, (w + 1) * per);
    if (slice.length) out.push({ week: w + 1, chapters: slice.map(c => c.slug) });
  }
  return out;
}

function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** 진도 행 → 글리프 (강의 목록과 동일 어휘) */
function glyphOf(row) {
  if (!row) return '○';
  if (row.passed) return '●';
  return row.read ? '◐' : '○';
}

/** 마지막 활동일 기준 상태 단어 */
function signalOf(rows, weekSlugs) {
  if (!rows.length) return { word: '이탈 위험', warn: true };
  const lastAt = Math.max(...rows.map(r => new Date(r.updated_at).getTime()));
  const days = Math.floor((Date.now() - lastAt) / 86400000);
  if (days >= 7) return { word: '이탈 위험', warn: true, days };
  if (days >= 4) return { word: '정체', warn: true, days };
  const stuck = rows.some(r => weekSlugs.includes(r.slug) && r.check_total && !r.passed);
  if (stuck) return { word: '미통과 있음', warn: true, days };
  return { word: '순항', warn: false, days };
}

function daysLabel(days) {
  if (days == null) return '기록 없음';
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

/* ── 페이지 ── */

export default function CohortsPage({ refManifest = {} }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  // slug → 챕터 메타 (언어별)
  const chapterMaps = useMemo(() => {
    const out = {};
    for (const [lang, ref] of Object.entries(refManifest)) {
      const map = {};
      for (const lv of ref.levels) for (const ch of lv.chapters) map[ch.slug] = ch;
      out[lang] = map;
    }
    return out;
  }, [refManifest]);

  /* 내 소속 */
  const { data: memberships = [] } = useQuery({
    queryKey: ['cohort-memberships', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cohort_members')
        .select('cohort_id, team_id, joined_at, cohorts(*), cohort_teams(id, name, leader_id)')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
  });

  /* 내가 리더인 팀 */
  const { data: ledTeams = [] } = useQuery({
    queryKey: ['cohort-led-teams', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cohort_teams')
        .select('id, name, cohort_id, cohorts(*), cohort_members(user_id, joined_at)')
        .eq('leader_id', user.id);
      if (error) throw error;
      return data || [];
    },
  });

  /* 총괄: 전체 기수 */
  const { data: allCohorts = [] } = useQuery({
    queryKey: ['cohorts-all'],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cohorts')
        .select('*, cohort_members(user_id, team_id), cohort_teams(id, name, leader_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (!user) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <h2 style={{ marginBottom: 16 }}>클래스는 로그인 후 이용할 수 있어요</h2>
        <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <div className="page-header">
        <h1 className="page-header__title">클래스</h1>
        <p className="page-header__subtitle">같은 시기에, 같은 진도를 함께 — 기수제 학습 과정</p>
      </div>

      {memberships.map(m => (
        <MyCohortCard key={m.cohort_id} membership={m} manifest={refManifest} chapterMaps={chapterMaps} />
      ))}

      <JoinCard onJoined={() => queryClient.invalidateQueries({ queryKey: ['cohort-memberships'] })} toast={toast} hasAny={memberships.length > 0} />

      {ledTeams.map(team => (
        <LeaderTeamCard key={team.id} team={team} chapterMaps={chapterMaps} />
      ))}

      {isAdmin && (
        <AdminSection
          cohorts={allCohorts}
          manifest={refManifest}
          chapterMaps={chapterMaps}
          toast={toast}
          refresh={() => queryClient.invalidateQueries({ queryKey: ['cohorts-all'] })}
        />
      )}
    </div>
  );
}

/* ── 멤버: 내 기수 카드 ── */

function MyCohortCard({ membership, manifest, chapterMaps }) {
  const cohort = membership.cohorts;
  if (!cohort) return null;
  const week = weekOf(cohort);
  const ref = manifest[cohort.lang];
  const map = chapterMaps[cohort.lang] || {};
  const thisWeek = (cohort.curriculum || []).find(w => w.week === week);

  // 내 진행 — localStorage (강의 목록과 동일한 원본)
  const myProgress = useMemo(() => {
    if (!ref || typeof window === 'undefined') return { readSet: new Set(), checkMap: {} };
    try {
      return {
        readSet: new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]')),
        checkMap: JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}'),
      };
    } catch { return { readSet: new Set(), checkMap: {} }; }
  }, [ref]);

  return (
    <div className="card cohort-card">
      <div className="cohort-card__head">
        <div>
          <div className="cohort-card__kicker">내 클래스 · {STATUS_KO[cohort.status]}</div>
          <h2 className="cohort-card__name">{cohort.name}</h2>
        </div>
        <div className="cohort-card__week">
          {week === 0 ? '시작 전' : `${week}주차 / ${cohort.weeks}주`}
        </div>
      </div>
      {membership.cohort_teams && (
        <div className="cohort-card__meta">{membership.cohort_teams.name} 팀</div>
      )}
      {thisWeek ? (
        <ul className="cohort-chapters">
          {thisWeek.chapters.map(slug => {
            const ch = map[slug];
            const result = myProgress.checkMap[slug];
            const glyph = isPassed(result) ? '●' : myProgress.readSet.has(slug) ? '◐' : '○';
            return (
              <li key={slug}>
                <Link href={`${ref?.base || ''}/grammar/${slug}`} className="cohort-chapters__row">
                  <span className="lessons-list__status" aria-hidden="true">{glyph}</span>
                  <span className="cohort-chapters__title">{ch ? `#${ch.order} ${ch.title}` : slug}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cohort-card__meta">
          {week === 0 ? `${cohort.start_date}에 시작해요.` : '이번 주 배정 챕터가 없어요.'}
        </p>
      )}
    </div>
  );
}

/* ── 참가 코드 ── */

function JoinCard({ onJoined, toast, hasAny }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  async function join() {
    if (!code.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('join_cohort', { code: code.trim() });
    setBusy(false);
    if (error) {
      toast(error.message.includes('invalid') ? '참가 코드가 올바르지 않아요.' : '참가에 실패했어요 — ' + error.message, 'error');
      return;
    }
    toast('클래스에 참가했어요.', 'success');
    setCode('');
    onJoined();
  }
  return (
    <div className="card cohort-join">
      <span className="cohort-join__label">{hasAny ? '다른 클래스 참가' : '참가 코드가 있나요?'}</span>
      <input
        className="form-input cohort-join__input"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && join()}
        placeholder="참가 코드"
        maxLength={12}
      />
      <Button size="sm" onClick={join} disabled={busy || !code.trim()}>
        {busy ? '확인 중...' : '참가'}
      </Button>
    </div>
  );
}

/* ── 팀 리더: 팀 현황 ── */

function LeaderTeamCard({ team, chapterMaps }) {
  const cohort = team.cohorts;
  const memberIds = (team.cohort_members || []).map(m => m.user_id);
  const week = cohort ? weekOf(cohort) : 0;
  const thisWeek = (cohort?.curriculum || []).find(w => w.week === week);
  const weekSlugs = thisWeek?.chapters || [];
  const map = cohort ? chapterMaps[cohort.lang] || {} : {};

  const { data } = useQuery({
    queryKey: ['team-progress', team.id, memberIds.join(','), cohort?.lang],
    enabled: !!cohort && memberIds.length > 0,
    queryFn: async () => {
      const [progressRes, profilesRes] = await Promise.all([
        supabase.from('user_ref_progress')
          .select('user_id, slug, read, check_total, passed, updated_at')
          .in('user_id', memberIds).eq('lang', cohort.lang),
        supabase.from('profiles').select('id, display_name').in('id', memberIds),
      ]);
      return {
        progress: progressRes.data || [],
        names: Object.fromEntries((profilesRes.data || []).map(p => [p.id, p.display_name])),
      };
    },
  });

  if (!cohort) return null;
  const byUser = new Map(memberIds.map(id => [id, []]));
  for (const row of data?.progress || []) byUser.get(row.user_id)?.push(row);

  const passCount = memberIds.length * weekSlugs.length;
  const passed = (data?.progress || []).filter(r => weekSlugs.includes(r.slug) && r.passed).length;

  return (
    <div className="card cohort-card">
      <div className="cohort-card__head">
        <div>
          <div className="cohort-card__kicker">내 팀 · {cohort.name}</div>
          <h2 className="cohort-card__name">{team.name}</h2>
        </div>
        <div className="cohort-card__week">
          {week === 0 ? '시작 전' : `${week}주차 · 팀 통과율 ${passCount ? Math.round((passed / passCount) * 100) : 0}%`}
        </div>
      </div>
      {weekSlugs.length > 0 && (
        <div className="cohort-card__meta">
          이번 주 — {weekSlugs.map(s => (map[s] ? `#${map[s].order}` : s)).join(' ')}
        </div>
      )}
      <ul className="cohort-team">
        {memberIds.map(uid => {
          const rows = byUser.get(uid) || [];
          const rowMap = Object.fromEntries(rows.map(r => [r.slug, r]));
          const sig = signalOf(rows, weekSlugs);
          return (
            <li key={uid} className="cohort-team__row">
              <span className="cohort-team__name">{data?.names?.[uid] || '멤버'}</span>
              <span className="cohort-team__glyphs" aria-hidden="true">
                {weekSlugs.map(s => glyphOf(rowMap[s])).join(' ')}
              </span>
              <span className="cohort-team__last">{daysLabel(sig.days)}</span>
              <span className={`cohort-team__signal ${sig.warn ? 'is-warn' : ''}`}>{sig.word}</span>
            </li>
          );
        })}
        {memberIds.length === 0 && <li className="cohort-card__meta">아직 배정된 팀원이 없어요.</li>}
      </ul>
    </div>
  );
}

/* ── 총괄(관리자) ── */

function AdminSection({ cohorts, manifest, chapterMaps, toast, refresh }) {
  const [showCreate, setShowCreate] = useState(false);

  // 가입 유저 전체 — 수동 배정용 (관리자만 이 섹션에 도달)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['cohort-all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, last_login_at')
        .order('last_login_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <section className="cohort-admin">
      <div className="cohort-admin__head">
        <h2 className="cohort-admin__title">전체 클래스</h2>
        <Button size="sm" variant="secondary" onClick={() => setShowCreate(v => !v)}>
          {showCreate ? '닫기' : '새 클래스'}
        </Button>
      </div>
      {showCreate && (
        <CreateCohortForm manifest={manifest} toast={toast} onCreated={() => { setShowCreate(false); refresh(); }} />
      )}
      {cohorts.map(c => (
        <AdminCohortCard key={c.id} cohort={c} chapterMaps={chapterMaps} toast={toast} refresh={refresh} allUsers={allUsers} />
      ))}
      {cohorts.length === 0 && !showCreate && (
        <p className="cohort-card__meta">아직 클래스가 없어요. 첫 기수를 만들어보세요.</p>
      )}
    </section>
  );
}

function CreateCohortForm({ manifest, toast, onCreated }) {
  const langs = Object.keys(manifest);
  const [lang, setLang] = useState(langs[0] || 'Japanese');
  const [levelKey, setLevelKey] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [weeks, setWeeks] = useState(8);
  const [busy, setBusy] = useState(false);

  const levels = manifest[lang]?.levels || [];
  const level = levels.find(l => l.key === levelKey) || null;
  const curriculum = useMemo(
    () => (level ? chunkCurriculum(level.chapters, weeks) : []),
    [level, weeks]
  );

  async function create() {
    if (!name.trim() || !level || !startDate || busy) {
      toast('이름·레벨·시작일을 채워주세요.', 'error');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('cohorts').insert({
      name: name.trim(),
      lang,
      level: level.key,
      start_date: startDate,
      weeks,
      curriculum,
      join_code: genCode(),
    });
    setBusy(false);
    if (error) { toast('생성 실패 — ' + error.message, 'error'); return; }
    toast('클래스를 만들었어요.', 'success');
    onCreated();
  }

  return (
    <div className="card cohort-form">
      <div className="form-field">
        <label className="form-label">이름</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)}
          placeholder="예: 7월 N5 기수" maxLength={40} />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">언어</label>
          <select className="form-input" value={lang} onChange={e => { setLang(e.target.value); setLevelKey(''); }}>
            {langs.map(l => <option key={l} value={l}>{LANG_KO[l] || l}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">레벨</label>
          <select className="form-input" value={levelKey} onChange={e => setLevelKey(e.target.value)}>
            <option value="">선택</option>
            {levels.map(l => <option key={l.key} value={l.key}>{l.label} ({l.chapters.length}챕터)</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">시작일</label>
          <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">기간 (주)</label>
          <input type="number" min={1} max={52} className="form-input" value={weeks}
            onChange={e => setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} />
        </div>
      </div>
      {level && (
        <p className="cohort-card__meta">
          커리큘럼 자동 배분 — 주당 약 {Math.ceil(level.chapters.length / weeks)}챕터 × {curriculum.length}주
        </p>
      )}
      <Button size="sm" onClick={create} disabled={busy}>{busy ? '생성 중...' : '클래스 만들기'}</Button>
    </div>
  );
}

/** 가입 유저 검색 → 클래스에 수동 배정 */
function AddMemberControl({ allUsers, members, onAdd }) {
  const [q, setQ] = useState('');
  const memberSet = useMemo(() => new Set(members.map(m => m.user_id)), [members]);
  const matches = useMemo(() => {
    const pool = allUsers.filter(u => !memberSet.has(u.id));
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return pool.filter(u => (u.display_name || '').toLowerCase().includes(needle)).slice(0, 5);
  }, [allUsers, memberSet, q]);

  return (
    <div className="cohort-addmember">
      <input
        className="form-input cohort-addmember__input"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="가입 유저 검색해서 직접 추가"
      />
      {matches.length > 0 && (
        <ul className="cohort-addmember__list">
          {matches.map(u => (
            <li key={u.id} className="cohort-addmember__item">
              <span className="cohort-team__name">{u.display_name || u.id.slice(0, 8)}</span>
              <span className="cohort-team__last">
                {u.last_login_at ? `최근 접속 ${new Date(u.last_login_at).toLocaleDateString('ko-KR')}` : ''}
              </span>
              <Button size="sm" variant="ghost" onClick={() => { onAdd(u.id); setQ(''); }}>추가</Button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && matches.length === 0 && (
        <p className="cohort-card__meta">일치하는 가입 유저가 없어요.</p>
      )}
    </div>
  );
}

function AdminCohortCard({ cohort, chapterMaps, toast, refresh, allUsers = [] }) {
  const [open, setOpen] = useState(false);
  const week = weekOf(cohort);
  const members = cohort.cohort_members || [];
  const teams = cohort.cohort_teams || [];
  const map = chapterMaps[cohort.lang] || {};
  const memberIds = members.map(m => m.user_id);
  const allSlugs = (cohort.curriculum || []).flatMap(w => w.chapters);

  const { data } = useQuery({
    queryKey: ['cohort-progress', cohort.id, memberIds.join(',')],
    enabled: open && memberIds.length > 0,
    queryFn: async () => {
      const [progressRes, profilesRes] = await Promise.all([
        supabase.from('user_ref_progress')
          .select('user_id, slug, read, check_total, passed, updated_at')
          .in('user_id', memberIds).eq('lang', cohort.lang),
        supabase.from('profiles').select('id, display_name').in('id', memberIds),
      ]);
      return {
        progress: (progressRes.data || []).filter(r => allSlugs.includes(r.slug)),
        names: Object.fromEntries((profilesRes.data || []).map(p => [p.id, p.display_name])),
      };
    },
  });

  // 주차별 통과율 퍼널
  const funnel = useMemo(() => {
    if (!data || !members.length) return [];
    const passedSet = new Set(data.progress.filter(r => r.passed).map(r => `${r.user_id}|${r.slug}`));
    return (cohort.curriculum || [])
      .filter(w => week === 0 || w.week <= week)
      .map(w => {
        const total = members.length * w.chapters.length;
        const done = members.reduce(
          (n, m) => n + w.chapters.filter(s => passedSet.has(`${m.user_id}|${s}`)).length, 0);
        return { week: w.week, pct: total ? Math.round((done / total) * 100) : 0 };
      });
  }, [data, cohort.curriculum, members, week]);

  async function setStatus(status) {
    const { error } = await supabase.from('cohorts').update({ status }).eq('id', cohort.id);
    if (error) toast('변경 실패 — ' + error.message, 'error');
    else refresh();
  }

  async function createTeam() {
    const name = window.prompt('팀 이름');
    if (!name?.trim()) return;
    const { error } = await supabase.from('cohort_teams').insert({ cohort_id: cohort.id, name: name.trim() });
    if (error) toast('팀 생성 실패 — ' + error.message, 'error');
    else refresh();
  }

  async function assignTeam(userId, teamId) {
    const { error } = await supabase.from('cohort_members')
      .update({ team_id: teamId || null })
      .eq('cohort_id', cohort.id).eq('user_id', userId);
    if (error) toast('배정 실패 — ' + error.message, 'error');
    else refresh();
  }

  async function setLeader(teamId, userId) {
    const { error } = await supabase.from('cohort_teams')
      .update({ leader_id: userId || null }).eq('id', teamId);
    if (error) toast('리더 지정 실패 — ' + error.message, 'error');
    else refresh();
  }

  async function addMember(userId) {
    const { error } = await supabase.from('cohort_members')
      .insert({ cohort_id: cohort.id, user_id: userId });
    if (error) toast('추가 실패 — ' + error.message, 'error');
    else refresh();
  }

  async function removeMember(userId) {
    const name = data?.names?.[userId] || allUsers.find(u => u.id === userId)?.display_name || '이 멤버';
    if (!window.confirm(`${name}을(를) 클래스에서 제외할까요? 학습 기록은 지워지지 않아요.`)) return;
    const { error } = await supabase.from('cohort_members')
      .delete().eq('cohort_id', cohort.id).eq('user_id', userId);
    if (error) toast('제외 실패 — ' + error.message, 'error');
    else refresh();
  }

  return (
    <div className="card cohort-card">
      <button type="button" className="cohort-card__head cohort-card__head--btn" onClick={() => setOpen(v => !v)}>
        <div>
          <div className="cohort-card__kicker">{STATUS_KO[cohort.status]} · {LANG_KO[cohort.lang]} {cohort.level}</div>
          <h2 className="cohort-card__name">{cohort.name}</h2>
        </div>
        <div className="cohort-card__week">
          {week === 0 ? `${cohort.start_date} 시작` : `${week}주차 / ${cohort.weeks}주`} · {members.length}명 · {teams.length}팀
        </div>
      </button>

      {open && (
        <div className="cohort-admin__body">
          <div className="cohort-card__meta">참가 코드 <strong>{cohort.join_code}</strong></div>

          {funnel.length > 0 && (
            <div className="cohort-funnel">
              {funnel.map(f => (
                <div key={f.week} className="cohort-funnel__row">
                  <span className="cohort-funnel__label">{f.week}주</span>
                  <span className="cohort-funnel__bar"><span style={{ width: `${f.pct}%` }} /></span>
                  <span className="cohort-funnel__pct">{f.pct}%</span>
                </div>
              ))}
            </div>
          )}

          <div className="cohort-admin__sub">
            팀
            <Button size="sm" variant="ghost" onClick={createTeam}>＋ 팀 추가</Button>
          </div>
          {teams.map(t => (
            <div key={t.id} className="cohort-team__row">
              <span className="cohort-team__name">{t.name}</span>
              <select
                className="form-input cohort-admin__select"
                value={t.leader_id || ''}
                onChange={e => setLeader(t.id, e.target.value)}
              >
                <option value="">리더 없음</option>
                {members.filter(m => m.team_id === t.id).map(m => (
                  <option key={m.user_id} value={m.user_id}>{data?.names?.[m.user_id] || m.user_id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="cohort-admin__sub">멤버 {members.length > 0 && `(${members.length})`}</div>
          <AddMemberControl allUsers={allUsers} members={members} onAdd={addMember} />
          {members.map(m => {
            const rows = (data?.progress || []).filter(r => r.user_id === m.user_id);
            const passedCount = rows.filter(r => r.passed).length;
            return (
              <div key={m.user_id} className="cohort-team__row">
                <span className="cohort-team__name">{data?.names?.[m.user_id] || m.user_id.slice(0, 8)}</span>
                <span className="cohort-team__last">통과 {passedCount} / {allSlugs.length}</span>
                <select
                  className="form-input cohort-admin__select"
                  value={m.team_id || ''}
                  onChange={e => assignTeam(m.user_id, e.target.value)}
                >
                  <option value="">팀 미배정</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button
                  type="button"
                  className="cohort-team__remove"
                  title="클래스에서 제외"
                  aria-label="클래스에서 제외"
                  onClick={() => removeMember(m.user_id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
          {members.length === 0 && <p className="cohort-card__meta">아직 참가자가 없어요. 참가 코드를 공유하거나 위에서 직접 추가하세요.</p>}

          <div className="cohort-admin__status">
            {cohort.status === 'recruiting' && <Button size="sm" onClick={() => setStatus('active')}>진행 시작</Button>}
            {cohort.status === 'active' && <Button size="sm" variant="secondary" onClick={() => setStatus('done')}>수료 처리</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
