'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/ToastContext';

const EMPTY_ENTRY = {
  checkin_state: '',
  focus_goal: '',
  completed: '',
  learned: '',
  blocker: '',
  next_action: '',
  help_needed: '',
  advice_mode: 'listen',
  meaningful: '',
  energy_gain: '',
  energy_drain: '',
  repeated_issue: '',
  keep_doing: '',
  stop_doing: '',
  monthly_priority: '',
  monthly_experiment: '',
};

const ADVICE_LABELS = {
  listen: '그냥 들어주기',
  questions: '질문으로 도와주기',
  advice: '솔직한 조언 환영',
};

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getThisOrNextSaturday() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const distance = (6 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + distance);
  return toLocalDateString(date);
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

function isLastSaturday(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const nextWeek = new Date(date);
  nextWeek.setDate(nextWeek.getDate() + 7);
  return date.getDay() === 6 && nextWeek.getMonth() !== date.getMonth();
}

function formatMeetingDate(dateString) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${dateString}T12:00:00`));
}

function shortTime(value) {
  return value?.slice(0, 5) || '';
}

function normalizeInvite(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('join') || '';
  } catch {
    return trimmed;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function fetchCircleWorkspace(userId) {
  const { data: membership, error: membershipError } = await supabase
    .from('focus_circle_members')
    .select(`
      circle_id,
      role,
      joined_at,
      circle:focus_circles (
        id,
        name,
        owner_id,
        meeting_weekday,
        start_time,
        end_time,
        timezone
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership?.circle) return { circle: null, members: [], meetings: [], entries: [] };

  const circle = membership.circle;
  const [{ data: members, error: membersError }, { data: meetings, error: meetingsError }] = await Promise.all([
    supabase
      .from('focus_circle_members')
      .select('user_id, role, joined_at, profile:profiles(display_name)')
      .eq('circle_id', circle.id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('focus_meetings')
      .select('id, circle_id, meeting_date, kind, created_by, created_at, updated_at')
      .eq('circle_id', circle.id)
      .order('meeting_date', { ascending: false })
      .limit(20),
  ]);

  if (membersError) throw membersError;
  if (meetingsError) throw meetingsError;

  const meetingIds = (meetings || []).map((meeting) => meeting.id);
  let entries = [];
  if (meetingIds.length > 0) {
    const { data, error } = await supabase
      .from('focus_entries')
      .select('*')
      .in('meeting_id', meetingIds)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    entries = data || [];
  }

  return {
    circle,
    membership,
    members: members || [],
    meetings: meetings || [],
    entries,
  };
}

function FocusTimer() {
  const TOTAL_SECONDS = 80 * 60;
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, secondsLeft]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const progress = ((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100;

  return (
    <section className="focus-circle__timer card" aria-labelledby="focus-timer-title">
      <div>
        <span className="focus-circle__eyebrow">함께 몰입</span>
        <h2 id="focus-timer-title">80분 집중 타이머</h2>
        <p>각자 가장 중요한 한 가지에 조용히 머무는 시간입니다.</p>
      </div>
      <div className="focus-circle__timer-body">
        <div className="focus-circle__timer-clock" aria-live="polite">{minutes}:{seconds}</div>
        <div className="focus-circle__timer-track" aria-hidden="true">
          <div className="focus-circle__timer-progress" style={{ width: `${progress}%` }} />
        </div>
        <div className="focus-circle__timer-actions">
          <Button size="sm" onClick={() => setRunning((value) => !value)}>
            {running ? '잠시 멈춤' : secondsLeft === TOTAL_SECONDS ? '집중 시작' : '계속하기'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(TOTAL_SECONDS);
            }}
          >
            초기화
          </Button>
        </div>
      </div>
    </section>
  );
}

function TextField({ label, hint, name, value, onChange, rows = 2, placeholder = '' }) {
  return (
    <label className="focus-circle__field">
      <span className="focus-circle__field-label">{label}</span>
      {hint && <span className="focus-circle__field-hint">{hint}</span>}
      <textarea
        name={name}
        value={value}
        rows={rows}
        maxLength={2000}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

function EntryForm({ kind, form, onChange, onSave, saving }) {
  return (
    <section className="focus-circle__entry card" aria-labelledby="my-entry-title">
      <div className="focus-circle__section-heading">
        <div>
          <span className="focus-circle__eyebrow">나의 기록</span>
          <h2 id="my-entry-title">{kind === 'monthly' ? '이번 달의 방향' : '오늘의 한 가지'}</h2>
        </div>
        <span className="focus-circle__save-note">저장하면 서로에게 보여요</span>
      </div>

      {kind === 'weekly' ? (
        <div className="focus-circle__form-grid">
          <TextField
            label="지금 상태"
            hint="한 단어나 짧은 문장"
            name="checkin_state"
            value={form.checkin_state}
            onChange={onChange}
            rows={1}
            placeholder="차분함, 조금 지침, 기대됨…"
          />
          <TextField
            label="오늘 끝낼 한 가지"
            name="focus_goal"
            value={form.focus_goal}
            onChange={onChange}
            rows={2}
            placeholder="완료 여부를 알 수 있게 작게 적어보세요."
          />
          <TextField label="실제로 한 것" name="completed" value={form.completed} onChange={onChange} />
          <TextField label="새롭게 알게 된 것" name="learned" value={form.learned} onChange={onChange} />
          <TextField label="막힌 것" name="blocker" value={form.blocker} onChange={onChange} />
          <TextField label="다음에 할 가장 작은 행동" name="next_action" value={form.next_action} onChange={onChange} />
        </div>
      ) : (
        <div className="focus-circle__form-grid">
          <TextField label="이번 달 가장 의미 있었던 것" name="meaningful" value={form.meaningful} onChange={onChange} />
          <TextField label="에너지를 준 것" name="energy_gain" value={form.energy_gain} onChange={onChange} />
          <TextField label="에너지를 소모한 것" name="energy_drain" value={form.energy_drain} onChange={onChange} />
          <TextField label="반복해서 나타난 문제" name="repeated_issue" value={form.repeated_issue} onChange={onChange} />
          <TextField label="계속할 것" name="keep_doing" value={form.keep_doing} onChange={onChange} />
          <TextField label="중단하거나 줄일 것" name="stop_doing" value={form.stop_doing} onChange={onChange} />
          <TextField label="다음 달 가장 중요한 한 가지" name="monthly_priority" value={form.monthly_priority} onChange={onChange} />
          <TextField label="시험해볼 작은 실험" name="monthly_experiment" value={form.monthly_experiment} onChange={onChange} />
        </div>
      )}

      <div className="focus-circle__support-box">
        <TextField
          label="친구에게 바라는 도움"
          name="help_needed"
          value={form.help_needed}
          onChange={onChange}
          rows={2}
          placeholder="없다면 비워두어도 괜찮아요."
        />
        <fieldset className="focus-circle__advice">
          <legend>오늘 원하는 반응</legend>
          <div className="focus-circle__advice-options">
            {Object.entries(ADVICE_LABELS).map(([value, label]) => (
              <label key={value} className={form.advice_mode === value ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="advice_mode"
                  value={value}
                  checked={form.advice_mode === value}
                  onChange={() => onChange('advice_mode', value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="focus-circle__entry-actions">
        <Button onClick={onSave} disabled={saving}>
          {saving ? '저장 중…' : '내 기록 저장'}
        </Button>
      </div>
    </section>
  );
}

function SharedEntry({ member, entry, kind }) {
  const name = member.profile?.display_name || '함께하는 친구';
  const weeklyItems = [
    ['오늘의 목표', entry?.focus_goal],
    ['실제로 한 것', entry?.completed],
    ['알게 된 것', entry?.learned],
    ['막힌 것', entry?.blocker],
    ['다음 행동', entry?.next_action],
  ];
  const monthlyItems = [
    ['가장 의미 있었던 것', entry?.meaningful],
    ['에너지를 준 것', entry?.energy_gain],
    ['에너지를 소모한 것', entry?.energy_drain],
    ['반복된 문제', entry?.repeated_issue],
    ['계속할 것', entry?.keep_doing],
    ['중단할 것', entry?.stop_doing],
    ['다음 달 우선순위', entry?.monthly_priority],
    ['작은 실험', entry?.monthly_experiment],
  ];
  const items = kind === 'monthly' ? monthlyItems : weeklyItems;

  return (
    <article className="focus-circle__shared-card">
      <div className="focus-circle__person">
        <span className="focus-circle__avatar" aria-hidden="true">{name[0]}</span>
        <div>
          <strong>{name}</strong>
          <span>{entry?.checkin_state || (entry ? '기록을 남겼어요' : '아직 기록 전이에요')}</span>
        </div>
      </div>
      {!entry ? (
        <p className="focus-circle__empty-copy">저장된 기록이 생기면 이곳에서 함께 볼 수 있어요.</p>
      ) : (
        <>
          <dl className="focus-circle__shared-list">
            {items.filter(([, value]) => value).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {(entry.help_needed || entry.advice_mode) && (
            <div className="focus-circle__support-summary">
              <span>{ADVICE_LABELS[entry.advice_mode] || ADVICE_LABELS.listen}</span>
              {entry.help_needed && <p>{entry.help_needed}</p>}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function EmptyWorkspace({ initialInvite, onCreated, busy }) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('토요 집중 모임');
  const [invite, setInvite] = useState(initialInvite || '');

  useEffect(() => {
    if (initialInvite) setInvite(initialInvite);
  }, [initialInvite]);

  async function createCircle() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast('모임 이름을 적어주세요.', 'warning');
      return;
    }

    const circleId = crypto.randomUUID();
    const { error: circleError } = await supabase.from('focus_circles').insert({
      id: circleId,
      name: trimmedName,
      owner_id: user.id,
    });
    if (circleError) throw circleError;

    const { error: memberError } = await supabase.from('focus_circle_members').insert({
      circle_id: circleId,
      user_id: user.id,
      role: 'owner',
    });
    if (memberError) {
      await supabase.from('focus_circles').delete().eq('id', circleId);
      throw memberError;
    }
    onCreated();
  }

  async function joinCircle() {
    const circleId = normalizeInvite(invite);
    if (!isUuid(circleId)) {
      toast('올바른 초대 링크나 코드를 입력해주세요.', 'warning');
      return;
    }
    const { error } = await supabase.from('focus_circle_members').insert({
      circle_id: circleId,
      user_id: user.id,
      role: 'member',
    });
    if (error && error.code !== '23505') throw error;
    onCreated();
  }

  async function run(action) {
    try {
      await action();
      toast('함께할 공간이 준비됐어요.', 'success');
    } catch (error) {
      toast(`공간을 준비하지 못했어요: ${error.message}`, 'error');
    }
  }

  return (
    <div className="focus-circle__onboarding">
      <section className="focus-circle__welcome">
        <span className="focus-circle__eyebrow">작게 시작하는 공동체</span>
        <h1>토요일 두 시간을<br />함께 지켜주는 공간</h1>
        <p>각자 중요한 일에 집중하고, 짧게 기록하고, 한 달에 한 번 삶의 방향을 함께 바라봅니다.</p>
        <div className="focus-circle__principles">
          <span>비교하지 않기</span>
          <span>조언은 원할 때만</span>
          <span>목표는 한 가지</span>
        </div>
      </section>

      <div className="focus-circle__onboarding-grid">
        <section className="card focus-circle__setup-card">
          <span className="focus-circle__setup-number">01</span>
          <h2>새 모임 만들기</h2>
          <p>공간을 만든 뒤 초대 링크 하나만 친구에게 보내면 됩니다.</p>
          <label className="focus-circle__simple-field">
            <span>모임 이름</span>
            <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </label>
          <Button onClick={() => run(createCircle)} disabled={busy}>공간 만들기</Button>
        </section>

        <section className="card focus-circle__setup-card">
          <span className="focus-circle__setup-number">02</span>
          <h2>친구 모임에 들어가기</h2>
          <p>친구가 보낸 링크 전체 또는 초대 코드를 붙여넣으세요.</p>
          <label className="focus-circle__simple-field">
            <span>초대 링크 또는 코드</span>
            <input value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="초대 링크 붙여넣기" />
          </label>
          <Button variant="secondary" onClick={() => run(joinCircle)} disabled={busy}>초대받은 공간 들어가기</Button>
        </section>
      </div>
    </div>
  );
}

export default function FocusCirclePage() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const toast = useToast();
  const inviteFromUrl = searchParams.get('join') || '';
  const [selectedDate, setSelectedDate] = useState(getThisOrNextSaturday);
  const [meetingKind, setMeetingKind] = useState(() => isLastSaturday(getThisOrNextSaturday()) ? 'monthly' : 'weekly');
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ['focus-circle-workspace', user?.id],
    queryFn: () => fetchCircleWorkspace(user.id),
    enabled: !!user,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });

  const workspace = workspaceQuery.data;
  const currentMeeting = workspace?.meetings.find((meeting) => meeting.meeting_date === selectedDate);
  const currentEntries = useMemo(
    () => workspace?.entries.filter((entry) => entry.meeting_id === currentMeeting?.id) || [],
    [workspace?.entries, currentMeeting?.id]
  );
  const myEntry = currentEntries.find((entry) => entry.user_id === user?.id);

  useEffect(() => {
    setMeetingKind(currentMeeting?.kind || (isLastSaturday(selectedDate) ? 'monthly' : 'weekly'));
  }, [currentMeeting?.kind, selectedDate]);

  useEffect(() => {
    if (!currentMeeting) {
      setForm(EMPTY_ENTRY);
      return;
    }
    setForm({ ...EMPTY_ENTRY, ...(myEntry || {}) });
  }, [currentMeeting?.id, myEntry?.id, myEntry?.updated_at]);

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createMeeting() {
    setCreatingMeeting(true);
    try {
      const { error } = await supabase.from('focus_meetings').insert({
        circle_id: workspace.circle.id,
        meeting_date: selectedDate,
        kind: meetingKind,
        created_by: user.id,
      });
      if (error && error.code !== '23505') throw error;
      await workspaceQuery.refetch();
      toast('이번 모임을 열었어요.', 'success');
    } catch (error) {
      toast(`모임을 열지 못했어요: ${error.message}`, 'error');
    } finally {
      setCreatingMeeting(false);
    }
  }

  async function changeMeetingKind(kind) {
    setMeetingKind(kind);
    if (!currentMeeting || currentMeeting.kind === kind) return;
    const { error } = await supabase
      .from('focus_meetings')
      .update({ kind, updated_at: new Date().toISOString() })
      .eq('id', currentMeeting.id);
    if (error) {
      toast(`모임 형식을 바꾸지 못했어요: ${error.message}`, 'error');
      return;
    }
    await workspaceQuery.refetch();
  }

  async function saveEntry() {
    if (!currentMeeting) return;
    setSaving(true);
    const payload = Object.fromEntries(
      Object.keys(EMPTY_ENTRY).map((key) => [key, form[key] || ''])
    );
    try {
      const { error } = await supabase.from('focus_entries').upsert({
        ...payload,
        meeting_id: currentMeeting.id,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'meeting_id,user_id' });
      if (error) throw error;
      await workspaceQuery.refetch();
      toast('기록을 함께 볼 수 있게 저장했어요.', 'success');
    } catch (error) {
      toast(`기록을 저장하지 못했어요: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/circle?join=${workspace.circle.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('초대 링크를 복사했어요.', 'success');
    } catch {
      window.prompt('이 링크를 친구에게 보내주세요.', link);
    }
  }

  if (loading || (user && workspaceQuery.isLoading)) {
    return <Spinner message="함께할 공간을 불러오는 중…" />;
  }

  if (!user) {
    return (
      <div className="page-container focus-circle">
        <section className="card focus-circle__login-card">
          <span aria-hidden="true">🤝</span>
          <h1>로그인하고 친구와 함께 시작하세요</h1>
          <p>각자의 기록은 초대한 사람끼리만 볼 수 있습니다.</p>
          <Link href={`/auth?from=${encodeURIComponent(`/circle${inviteFromUrl ? `?join=${inviteFromUrl}` : ''}`)}`} className="btn btn--primary btn--md">
            로그인하기
          </Link>
        </section>
      </div>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <div className="page-container focus-circle">
        <section className="card focus-circle__error-card">
          <span aria-hidden="true">🌱</span>
          <h1>공용 공간을 불러오지 못했어요</h1>
          <p>{workspaceQuery.error?.message || '잠시 후 다시 시도해주세요.'}</p>
          <Button onClick={() => workspaceQuery.refetch()}>다시 시도</Button>
        </section>
      </div>
    );
  }

  if (!workspace?.circle) {
    return (
      <div className="page-container focus-circle">
        <EmptyWorkspace
          initialInvite={inviteFromUrl}
          onCreated={() => workspaceQuery.refetch()}
          busy={workspaceQuery.isFetching}
        />
      </div>
    );
  }

  const otherMembers = workspace.members.filter((member) => member.user_id !== user.id);
  const agenda = meetingKind === 'monthly'
    ? [['18:00', '안부'], ['18:15', '한 달 돌아보기'], ['18:30', '깊은 공유'], ['19:35', '다음 달 방향']]
    : [['18:00', '안부와 목표'], ['18:10', '함께 몰입'], ['19:30', '휴식'], ['19:40', '짧은 공유']];

  return (
    <div className="page-container focus-circle">
      <header className="focus-circle__hero">
        <div>
          <span className="focus-circle__eyebrow">매주 실행 · 매월 방향</span>
          <h1>{workspace.circle.name}</h1>
          <p>
            매주 토요일 {shortTime(workspace.circle.start_time)}–{shortTime(workspace.circle.end_time)} · 서로의 중요한 시간을 지켜주는 자리
          </p>
        </div>
        <div className="focus-circle__hero-actions">
          <div className="focus-circle__member-stack" aria-label={`${workspace.members.length}명 참여 중`}>
            {workspace.members.map((member) => {
              const name = member.profile?.display_name || '친구';
              return <span key={member.user_id} title={name}>{name[0]}</span>;
            })}
          </div>
          <Button variant="secondary" size="sm" onClick={copyInvite}>친구 초대</Button>
        </div>
      </header>

      <section className="focus-circle__date-bar" aria-label="모임 날짜 선택">
        <button type="button" onClick={() => setSelectedDate((date) => shiftDate(date, -7))} aria-label="이전 토요일">←</button>
        <label>
          <span>{formatMeetingDate(selectedDate)}</span>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
        <button type="button" onClick={() => setSelectedDate((date) => shiftDate(date, 7))} aria-label="다음 토요일">→</button>
        <div className="focus-circle__kind-toggle" aria-label="모임 형식">
          <button type="button" className={meetingKind === 'weekly' ? 'is-active' : ''} onClick={() => changeMeetingKind('weekly')}>주간 실행</button>
          <button type="button" className={meetingKind === 'monthly' ? 'is-active' : ''} onClick={() => changeMeetingKind('monthly')}>월간 방향</button>
        </div>
      </section>

      <section className="focus-circle__agenda" aria-label="오늘의 진행 순서">
        {agenda.map(([time, label], index) => (
          <div key={label}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
            <small>{time}</small>
          </div>
        ))}
      </section>

      {!currentMeeting ? (
        <section className="card focus-circle__open-meeting">
          <span aria-hidden="true">🕯️</span>
          <div>
            <h2>{formatMeetingDate(selectedDate)} 모임을 열까요?</h2>
            <p>모임을 열면 두 사람이 같은 기록 공간을 사용하게 됩니다.</p>
          </div>
          <Button onClick={createMeeting} disabled={creatingMeeting}>
            {creatingMeeting ? '여는 중…' : '이번 모임 열기'}
          </Button>
        </section>
      ) : (
        <>
          {meetingKind === 'weekly' && <FocusTimer />}
          <EntryForm
            kind={meetingKind}
            form={form}
            onChange={updateForm}
            onSave={saveEntry}
            saving={saving}
          />

          <section className="card focus-circle__shared" aria-labelledby="shared-record-title">
            <div className="focus-circle__section-heading">
              <div>
                <span className="focus-circle__eyebrow">서로의 과정</span>
                <h2 id="shared-record-title">함께 보는 기록</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => workspaceQuery.refetch()} disabled={workspaceQuery.isFetching}>
                {workspaceQuery.isFetching ? '확인 중…' : '새로 확인'}
              </Button>
            </div>
            <div className="focus-circle__shared-grid">
              {otherMembers.length > 0 ? otherMembers.map((member) => (
                <SharedEntry
                  key={member.user_id}
                  member={member}
                  kind={meetingKind}
                  entry={currentEntries.find((entry) => entry.user_id === member.user_id)}
                />
              )) : (
                <div className="focus-circle__invite-empty">
                  <span aria-hidden="true">↗</span>
                  <h3>아직 혼자 있는 공간이에요</h3>
                  <p>초대 링크를 친구에게 보내면 이곳에서 서로의 기록을 볼 수 있어요.</p>
                  <Button variant="secondary" size="sm" onClick={copyInvite}>초대 링크 복사</Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="focus-circle__history" aria-labelledby="focus-history-title">
        <div className="focus-circle__section-heading">
          <div>
            <span className="focus-circle__eyebrow">함께 쌓인 시간</span>
            <h2 id="focus-history-title">지난 모임</h2>
          </div>
        </div>
        {workspace.meetings.length === 0 ? (
          <p className="focus-circle__empty-copy">첫 모임을 열면 기록이 여기에 차곡차곡 쌓여요.</p>
        ) : (
          <div className="focus-circle__history-list">
            {workspace.meetings.map((meeting) => {
              const count = workspace.entries.filter((entry) => entry.meeting_id === meeting.id).length;
              return (
                <button
                  type="button"
                  key={meeting.id}
                  className={selectedDate === meeting.meeting_date ? 'is-active' : ''}
                  onClick={() => setSelectedDate(meeting.meeting_date)}
                >
                  <span>{meeting.kind === 'monthly' ? '월간 방향' : '주간 실행'}</span>
                  <strong>{formatMeetingDate(meeting.meeting_date)}</strong>
                  <small>{count}명 기록</small>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className="focus-circle__footer-note">
        <p>성과보다 관계를 먼저 지킵니다. 지친 날에는 공부하지 않고 이야기만 나누어도 괜찮아요.</p>
      </footer>
    </div>
  );
}
