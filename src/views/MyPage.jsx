'use client';

/**
 * 내 정보(`/profile`) — 시안 A: 한 화면 · 묶음 카드 · 줄마다 지금 값 (PROFILE-REDESIGN-001, 오너 승인 2026-10-25 KST 「권장대로」).
 *
 *   내 정보
 *   [(채) 채연 바꾸기 · learner@… · 이메일 로그인 · 3월 2일부터 함께하고 있어요]
 *   내 기록                                              현황 전체 →
 *   [12일 연속 · 쉼 1][248 담은 단어][7편 완독한 자료]
 *   학습        학습 언어 일본어 · N3 › · 목표 JLPT N3 · D-41 / 하루 복습 5 · 담기 5 › · 알림 매일 21시 · 이 브라우저 ›
 *   이 기기에서  앱으로 설치 ›(설치 전에만) · 단어 복습 ›(단어장 복습 설정)
 *   계정        비밀번호 바꾸기 › · 내 데이터 내보내기 JSON 파일 ↓    [로그아웃](따로 한 칸)
 *   도움        학습 가이드 › · 도움말 ›     약관 3종 · 계정 삭제(맨 아래, 입력 확인)
 *
 * 다듬기(PROFILE-POLISH-001, 오너 「권장대로」 2026-10-26 KST — 디자이너 · 사용자 검토 두 갈래 + 목업): 넓은 화면도 배움 · 현황과 같은
 * 한 단(본문 720)이다 — 예전 두 단(왼쪽 나 + 기록)은 왼쪽 아래가 비고, 탭을 옮길 때 제목 자리가 튀었다. 휴대폰 제목 · 여백도 배움과 같다.
 * 목표를 고치는 자리는 현황 하나다(D2) — 여기는 요약 줄과 그 창으로 가는 링크뿐이다. 통계도 요약 3칸과 「현황 전체 →」뿐이다.
 * 새 테이블 · 컬럼은 없다: 숫자 2개는 기존 표의 개수 조회(HEAD + count exact), 나머지는 이미 받은 프로필 행 · 이 기기 저장값이다.
 * 계정마다 다른 화면이다 — 조회 키에 계정 id를 넣고, 시트 입력은 열 때마다 지금 계정 값으로 채운다(계정 경계 e2e).
 */
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { syncAuthDisplayName } from '../lib/authDisplayName';
import { hasVapidKey, getSubscriptionState, subscribePush, unsubscribePush } from '../lib/push';
import { friendlyToastMessage } from '../lib/errorMessage';
import { authEntryHref } from '../lib/authRedirect';
import { streakView } from '../lib/learnDashboard';
import { LANG_NAME_KO, PROFILE_LEVEL_COLUMN, profileLevel } from '../lib/constants';
import { loadSessionLength } from '../lib/vocabStudy';
import {
  DEFAULT_LEVEL, countValue, goalSummary, joinedLine, languageAria, languageEntries, levelOptions,
  makePrimary, reminderSummary, sessionLengthLabel, sheetLanguageOrder, signInMethods, toggleLanguage,
} from '../lib/profileSummary';
import { StatTile } from '../components/learn/LearnTiles';
import { SkeletonLine, SkeletonRegion } from '../components/Skeleton';
import { ProfileGroup, ProfileRow, ProfileSheet } from '../components/profile/ProfileParts';
import AccountSettings, { AccountDelete } from '../components/AccountSettings';
import InstallPrompt from '../components/InstallPrompt';
import '../components/learn/learn.css';
import '../components/profile/profile.css';

const REMINDER_HOURS = ['7', '9', '12', '18', '21'];
const BLOCKED_HELP = '브라우저에서 알림이 막혀 있어요. 주소창의 자물쇠에서 알림을 허용한 뒤 다시 열어 주세요.';

/** 기록 2칸의 개수 — 담은 단어(user_vocabulary) · 완독한 자료(reading_progress.is_completed, 주간 거울과 같은 열). 실패한 칸은 「–」. */
export async function fetchProfileCounts(userId) {
  const [words, reads] = await Promise.all([
    supabase.from('user_vocabulary').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('reading_progress').select('material_id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
  ]);
  return { words: words.error ? null : words.count, reads: reads.error ? null : reads.count };
}

export default function MyPage() {
  // 로그인 뒤 지금 화면으로 돌아온다(맨 /auth는 /home으로 보낸다) — 대상 검증은 authEntryHref 규칙.
  const signInHref = authEntryHref(usePathname());
  const { user, profile, loading: authLoading, fetchProfile, signOut } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState(null); // 'name' | 'lang' | 'alarm'

  // 알림 — 푸시(서버가 보냄) 먼저, 이 브라우저를 열어 둔 동안의 시각 알림은 보조(D3). 둘 다 기기 상태라 마운트 뒤 읽는다.
  const pushEnabled = hasVapidKey(); // 공개 키가 없으면 푸시 칸 전체를 숨긴다
  const [pushState, setPushState] = useState(null); // { supported, permission, subscribed }
  const [pushBusy, setPushBusy] = useState(false);
  const [reminderHour, setReminderHour] = useState('');
  const [notifPerm, setNotifPerm] = useState('default');
  const [sessionLength, setSessionLength] = useState(undefined); // 단어장 복습 설정(이 기기) — 마운트 뒤 읽는다

  useEffect(() => {
    try { const saved = localStorage.getItem('as_reminder_hour'); if (saved !== null) setReminderHour(saved); } catch { /* 저장소 차단 */ }
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
    setSessionLength(loadSessionLength());
  }, []);

  useEffect(() => {
    if (!pushEnabled) return;
    getSubscriptionState().then(setPushState).catch(() => {});
  }, [pushEnabled]);

  const { data: counts } = useQuery({
    queryKey: ['profile-counts', user?.id],
    queryFn: () => fetchProfileCounts(user.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  async function togglePush() {
    if (pushBusy || !user?.id) return;
    setPushBusy(true);
    try {
      if (pushState?.subscribed) {
        await unsubscribePush();
        toast('알림을 껐어요.', 'success');
      } else {
        const ok = await subscribePush(user.id, languageEntries(profile)[0]?.lang);
        if (ok) toast('알림을 켰어요.', 'success');
        else toast('알림 권한을 허용해야 켤 수 있어요.', 'error');
      }
      setPushState(await getSubscriptionState());
    } catch {
      // 구독 실패는 학습을 막지 않는다(push.js 원칙) — 상태 줄이 그대로 남는다
    } finally {
      setPushBusy(false);
    }
  }

  async function handleReminderChange(hour) {
    if (hour === '') {
      try { localStorage.removeItem('as_reminder_hour'); localStorage.removeItem('as_reminder_last_sent'); } catch { /* 저장소 차단 */ }
      setReminderHour('');
      toast('복습 알림을 껐어요.', 'success');
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm !== 'granted') { toast('알림 권한을 허용해야 해요.', 'error'); return; }
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      toast('브라우저 설정에서 알림이 차단돼 있어요.', 'error');
      return;
    }
    try { localStorage.setItem('as_reminder_hour', hour); } catch { /* 저장소 차단 */ }
    setReminderHour(hour);
    toast(`매일 ${hour}시에 복습 알림을 보낼게요.`, 'success');
  }

  const afterProfileSave = (message) => {
    fetchProfile(user.id, user.user_metadata);
    queryClient.invalidateQueries({ queryKey: ['home', user.id] });
    toast(message, 'success');
    setSheet(null);
  };

  const saveNameMutation = useMutation({
    mutationFn: async (name) => {
      if (!name.trim()) throw new Error('닉네임을 입력해 주세요.');
      const base = { display_name: name.trim() };
      const { error } = await supabase.from('profiles').update(base).eq('id', user.id);
      if (error) throw error;
      await syncAuthDisplayName(supabase, user, base.display_name);
    },
    onSuccess: () => afterProfileSave('닉네임을 저장했어요.'),
    onError: (err) => toast(friendlyToastMessage(err), 'error'),
  });

  const saveLanguagesMutation = useMutation({
    mutationFn: async ({ languages, levels }) => {
      const level = lang => levels[lang] || DEFAULT_LEVEL[lang];
      const base = {
        learning_language: languages,
        [PROFILE_LEVEL_COLUMN.Japanese]: level('Japanese'),
        [PROFILE_LEVEL_COLUMN.English]: level('English'),
      };
      // fr/zh 컬럼 미적용 환경 폴백 — 컬럼 오류일 때만 해당 필드 없이 재시도(온보딩과 같은 방식)
      let { error } = await supabase.from('profiles')
        .update({ ...base, [PROFILE_LEVEL_COLUMN.French]: level('French'), [PROFILE_LEVEL_COLUMN.Chinese]: level('Chinese') })
        .eq('id', user.id);
      if (error && /column|schema/i.test(error.message || '')) {
        ({ error } = await supabase.from('profiles').update(base).eq('id', user.id));
      }
      if (error) throw error;
    },
    onSuccess: () => afterProfileSave('학습 언어를 저장했어요.'),
    onError: (err) => toast(friendlyToastMessage(err), 'error'),
  });

  if (!user) {
    if (authLoading) {
      return (
        <div className="manabi-page pf">
          <h1>내 정보</h1>
          <SkeletonRegion className="pf-id" label="내 정보" announce>
            <span className="pf-avatar" aria-hidden="true" />
            <span className="pf-id__text"><SkeletonLine width="6em" /><SkeletonLine width="12em" /></span>
          </SkeletonRegion>
        </div>
      );
    }
    return (
      <div className="manabi-page pf">
        <h1>내 정보</h1>
        <div className="manabi-inline-state pf-login" role="status">
          <span>로그인이 필요해요.</span>
          <Link href={signInHref} prefetch={false} className="pf-pill">로그인</Link>
        </div>
      </div>
    );
  }

  const name = profile?.display_name || '학습자';
  const streak = streakView(profile);
  const langs = languageEntries(profile);
  const goal = goalSummary(profile);
  const notifBlocked = notifPerm === 'denied';
  const alarm = reminderSummary({ pushOn: !!pushState?.subscribed, hour: reminderHour, blocked: notifBlocked && !pushState?.subscribed });
  const joined = joinedLine(user.created_at);
  const pending = <SkeletonLine width="7em" />;
  const multi = langs.length > 1;

  return (
    <div className="manabi-page pf">
      <h1>내 정보</h1>
      <section className="pf-id" aria-label="나">
        <div className="pf-avatar" aria-hidden="true">{profile ? name[0] : ''}</div>
        <div className="pf-id__text">
          <span className="pf-id__name">
            {profile ? name : <SkeletonLine width="5em" />}
            {/* 닉네임은 이름 옆 글자 단추로 — 나머지 편집처럼 시트를 연다(따로 떨어진 큰 단추였다, 디자이너 검토 #14). */}
            <button type="button" className="pf-id__edit" aria-haspopup="dialog" aria-label="닉네임 바꾸기" disabled={!profile}
              onClick={() => setSheet('name')}>바꾸기</button>
          </span>
          {/* 로그인 방법은 계정 묶음의 읽기 전용 줄이었다 — 이메일과 같은 자리에 한 번만(검토 #5). */}
          <span className="pf-id__meta">{user.email} <span className="pf-nowrap">· {signInMethods(user)} 로그인</span>{joined && <><br />{joined}</>}</span>
        </div>
      </section>

      <section className="pf-group pf-record" aria-labelledby="pf-record-title">
        <div className="pf-group__head">
          <h2 id="pf-record-title">내 기록</h2>
          <Link href="/progress" prefetch={false} className="pf-more">현황 전체 →</Link>
        </div>
        <div className="pf-stats" role="group" aria-label="내 기록">
          <StatTile value={streak.value} label={streak.label} title={streak.title} ariaLabel={streak.aria} />
          <StatTile value={countValue(counts?.words)} label="담은 단어" />
          <StatTile value={countValue(counts?.reads, '편')} label="완독한 자료" />
        </div>
      </section>

      <ProfileGroup title="학습">
        <ProfileRow label="학습 언어" dialog onClick={() => setSheet('lang')} disabled={!profile}
          ariaLabel={profile ? languageAria(langs) : undefined}
          value={profile ? langs.map((e, i) => (
            <Fragment key={e.lang}>
              {i > 0 && ', '}
              {/* 굵게는 언어가 둘 이상일 때 기본 언어에만(검토 #8). 수준을 저장하지 않았으면 그렇다고 말한다. */}
              {e.primary && multi ? <strong>{e.name}</strong> : e.name}
              {' · '}{e.short || '수준 미정'}
              {e.primary && multi && <span className="pf-tag">기본</span>}
            </Fragment>
          )) : pending} />
        {/* 목표를 고치는 자리는 현황 「목표 수정」 하나다(D2) — 같은 창을 연다. 날짜 목표가 없으면 없다고 말한다 —
            하루 목표 기본값(5 · 5)만 보이면 정한 목표처럼 읽혔다(배움 · 현황은 「목표를 정하면」이라 말한다, 검토 #4). */}
        <ProfileRow label="목표" href="/progress?goal=edit"
          ariaLabel={profile ? ['목표', goal.head || '시험 · 날짜 목표 없음', goal.daily].join(', ') : undefined}
          value={profile ? (goal.head ? <strong>{goal.head}</strong> : '시험 · 날짜 목표 없음') : pending}
          sub={profile ? goal.daily : null} />
        <ProfileRow label="알림" dialog onClick={() => setSheet('alarm')} value={alarm} ariaLabel={`알림, ${alarm}`} />
      </ProfileGroup>

      <ProfileGroup title="이 기기에서" note="읽기 화면(서체 · 발음 표기 · 배경)은 자료를 연 뒤 Aa에서 바꿔요.">
        <InstallPrompt />
        <ProfileRow label="단어 복습" href="/vocab"
          value={sessionLength === undefined ? '' : sessionLengthLabel(sessionLength)}
          ariaLabel={sessionLength === undefined ? '단어 복습 설정' : `단어 복습 설정, ${sessionLengthLabel(sessionLength)}`} />
      </ProfileGroup>

      <AccountSettings user={user} toast={toast} signOut={signOut} />

      <ProfileGroup title="도움">
        <ProfileRow label="학습 가이드" href="/guide" />
        <ProfileRow label="도움말" href="/help" />
      </ProfileGroup>
      <nav className="pf-foot" aria-label="약관과 출처">
        <Link href="/terms" prefetch={false}>이용약관</Link>
        <Link href="/privacy" prefetch={false}>개인정보 처리방침</Link>
        <Link href="/credits" prefetch={false}>자료 출처</Link>
      </nav>
      <AccountDelete toast={toast} signOut={signOut} />

      {sheet === 'name' && (
        <NameSheet initial={profile?.display_name || ''} busy={saveNameMutation.isPending}
          onSave={value => saveNameMutation.mutate(value)} onClose={() => setSheet(null)} />
      )}
      {sheet === 'lang' && (
        <LanguageSheet profile={profile} busy={saveLanguagesMutation.isPending}
          onSave={value => saveLanguagesMutation.mutate(value)} onClose={() => setSheet(null)} />
      )}
      {sheet === 'alarm' && (
        // 알림 — 푸시가 있으면 먼저, 정한 시간 알림은 이 브라우저를 열어 둔 동안만. 칩은 누르면 바로 저장된다(시트 아래에 그렇게 말하고
        // 「닫기」로 끝맺는다 — 다른 시트의 「취소/저장」과 다른 이유를 보인다, 검토 #15). 안내문은 화면에 있는 것만 말한다(#17).
        <ProfileSheet title="알림" onClose={() => setSheet(null)}
          lead={pushEnabled ? '복습할 때를 알려 드려요. 푸시 알림이 먼저이고, 정한 시간 알림은 앱을 열어 둔 동안만 와요.'
            : '앱을 열어 둔 동안 정한 시간에 복습을 알려 드려요.'}
          actions={<button type="button" className="pf-pill" onClick={() => setSheet(null)}>닫기</button>}>
          {pushEnabled && (
            <div className="pf-sec">
              <h3>알림 받기</h3>
              {pushState && !pushState.supported ? (
                <p className="pf-warn">이 브라우저에서는 푸시 알림을 지원하지 않아요.</p>
              ) : (
                <>
                  {pushState?.permission === 'denied' && <p className="pf-warn">{BLOCKED_HELP}</p>}
                  <p className="pf-hint">내일 이야기가 도착하거나 오늘 복습할 단어가 있으면 알려 드려요.</p>
                  <button type="button" className="pf-switch" aria-pressed={!!pushState?.subscribed} onClick={togglePush}
                    disabled={pushBusy || pushState?.permission === 'denied'}>
                    <span>푸시 알림</span>
                    <span className="pf-switch__state">{pushBusy ? '처리 중…' : pushState?.subscribed ? '켜짐' : '꺼짐'}</span>
                  </button>
                </>
              )}
            </div>
          )}
          <div className="pf-sec">
            {/* 「시각 알림」은 視覺으로 읽혔다(사용자 검토) — 「정한 시간」 */}
            <h3 id="pf-reminder-title">알림 시간</h3>
            {/* 막혀 있으면 칩을 끄고 푸는 길을 말한다 — 눌러야 오류 토스트가 나던 것(#16). 이미 정한 시간은 「끄기」로 지울 수 있다. */}
            {notifBlocked && !pushEnabled && <p className="pf-warn">{BLOCKED_HELP}</p>}
            {pushEnabled && <p className="pf-hint">앱을 열어 둔 브라우저에서 정한 시간에 복습을 알려 드려요.</p>}
            <div className="pf-chips" role="group" aria-labelledby="pf-reminder-title">
              {['', ...REMINDER_HOURS].map(h => (
                <button key={h || 'off'} type="button" aria-pressed={reminderHour === h} onClick={() => handleReminderChange(h)}
                  disabled={h !== '' && notifBlocked}>
                  {h === '' ? '끄기' : `${h}시`}
                </button>
              ))}
            </div>
            <p className="pf-hint pf-hint--after">고르면 바로 저장돼요.</p>
          </div>
        </ProfileSheet>
      )}
    </div>
  );
}

/**
 * 닉네임 바꾸기 — 머리말 이름 · 배움 인사에 쓰이고, 함께 읽기 그룹 · 댓글에서 남에게 보인다(public_profiles). 저장은 profiles 뒤
 * Auth 메타데이터(syncAuthDisplayName). 시트 제목이 「닉네임 바꾸기」라 칸 이름은 읽기 도구에만 둔다(검토 #18).
 */
function NameSheet({ initial, busy, onSave, onClose }) {
  const [value, setValue] = useState(initial);
  return (
    <ProfileSheet title="닉네임 바꾸기" onClose={onClose} busy={busy}
      actions={<>
        <button type="button" className="pf-pill" onClick={onClose} disabled={busy}>취소</button>
        <button type="submit" form="pf-name-form" className="pf-pill pf-pill--fill" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}>
      <form id="pf-name-form" onSubmit={e => { e.preventDefault(); onSave(value); }}>
        <div className="pf-field">
          <label htmlFor="pf-name" className="sr-only">닉네임</label>
          <span className="pf-field__box">
            <input id="pf-name" className="form-input" value={value} onChange={e => setValue(e.target.value)} maxLength={20} autoComplete="nickname"
              aria-describedby="pf-name-hint" />
            <span className="pf-field__count" aria-hidden="true">{value.length} / 20</span>
          </span>
          <p id="pf-name-hint" className="pf-hint">함께 읽기 그룹과 댓글에서 다른 사람에게 보이는 이름이에요.</p>
        </div>
      </form>
    </ProfileSheet>
  );
}

/**
 * 학습 언어 · 수준 — 기본 언어(배열 첫 번째)를 화면에 보인다(설계 P5). 「기본으로」는 배열 맨 앞으로 옮길 뿐 새 필드가 없다.
 * 늘어놓는 순서는 열 때 한 번 정한다(고르는 동안 칸이 움직이지 않게).
 * 수준은 미리 골라 두지 않는다 — 새로 켠 언어에 「H3」가 이미 칠해져 있어 고른 줄 알고 저장했다(검토 양쪽). 켠 언어마다 수준을 골라야
 * 저장된다. 켜지 않은 언어의 칸은 예전과 같다(저장된 값, 없으면 DEFAULT_LEVEL — 저장 페이로드 불변).
 */
function LanguageSheet({ profile, busy, onSave, onClose }) {
  const [selected, setSelected] = useState(() => languageEntries(profile).map(e => e.lang));
  const [order] = useState(() => sheetLanguageOrder(languageEntries(profile).map(e => e.lang)));
  const [levels, setLevels] = useState(() => Object.fromEntries(order.map(lang => [lang, profileLevel(profile, lang) || ''])));
  const missing = selected.filter(lang => !levels[lang]);
  return (
    <ProfileSheet title="학습 언어" onClose={onClose} busy={busy}
      lead="배우는 언어와 수준을 골라요. 기본 언어는 배움 · 오늘 학습이 먼저 여는 언어예요."
      actions={<>
        <button type="button" className="pf-pill" onClick={onClose} disabled={busy}>취소</button>
        <button type="button" className="pf-pill pf-pill--fill" disabled={busy || missing.length > 0} aria-describedby={missing.length ? 'pf-lang-missing' : undefined}
          onClick={() => onSave({ languages: selected, levels })}>{busy ? '저장 중…' : '저장'}</button>
      </>}
      after={missing.length > 0 && <p id="pf-lang-missing" className="pf-hint pf-hint--after">수준을 고르면 저장할 수 있어요.</p>}>
      {order.map(lang => {
        const on = selected.includes(lang);
        const primary = selected[0] === lang;
        const name = LANG_NAME_KO[lang];
        return (
          <div key={lang} className={`pf-lang${on ? ' is-on' : ''}`} role="group" aria-label={name}>
            <div className="pf-lang__top">
              <label>
                <input type="checkbox" checked={on} disabled={busy} aria-describedby={on && selected.length === 1 ? `pf-keep-${lang}` : undefined}
                  onChange={() => setSelected(prev => toggleLanguage(prev, lang))} />
                {name}
              </label>
              {on && selected.length === 1 && <span id={`pf-keep-${lang}`} className="pf-lang__keep">하나는 남겨요</span>}
              {on && selected.length > 1 && (primary
                ? <span className="pf-tag">기본</span>
                : <button type="button" className="pf-lang__base" disabled={busy} aria-label={`${name}를 기본 언어로`}
                    onClick={() => setSelected(prev => makePrimary(prev, lang))}>기본으로</button>)}
            </div>
            {on && !levels[lang] && <p className="pf-lang__need">지금 수준을 골라 주세요</p>}
            {on && (
              <div className="pf-chips" role="group" aria-label={`${name} 수준`}>
                {levelOptions(lang).map(level => (
                  <button key={level} type="button" aria-pressed={levels[lang] === level} disabled={busy}
                    onClick={() => setLevels(prev => ({ ...prev, [lang]: level }))}>{level}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </ProfileSheet>
  );
}
