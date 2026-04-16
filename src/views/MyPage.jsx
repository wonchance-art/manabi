'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { LEVELS } from '../lib/constants';
import { getXPLevel } from '../lib/xp';
import Button from '../components/Button';
import AccountSettings from '../components/AccountSettings';
import InstallPrompt from '../components/InstallPrompt';

export default function MyPage() {
  const { user, profile, fetchProfile, signOut } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [editName, setEditName]           = useState('');
  const [editLanguages, setEditLanguages] = useState(['Japanese']);
  const [editLevelJp, setEditLevelJp]     = useState('N3 중급');
  const [editLevelEn, setEditLevelEn]     = useState('B1 중급');

  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalReview, setGoalReview]       = useState(5);
  const [goalWords, setGoalWords]         = useState(5);
  const [goalRead, setGoalRead]           = useState(1);

  const [openPanel, setOpenPanel] = useState(null);
  const togglePanel = (key) => setOpenPanel(prev => prev === key ? null : key);

  const [reminderHour, setReminderHour]   = useState('');
  const [notifPerm, setNotifPerm]         = useState('default');

  useEffect(() => {
    if (!profile) return;
    setEditName(profile.display_name || '');
    setEditLanguages(profile.learning_language?.length ? profile.learning_language : ['Japanese']);
    setEditLevelJp(profile.learning_level_japanese || 'N3 중급');
    setEditLevelEn(profile.learning_level_english  || 'B1 중급');
  }, [profile]);

  useEffect(() => {
    const saved = localStorage.getItem('as_reminder_hour');
    if (saved !== null) setReminderHour(saved);
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
  }, []);

  async function handleReminderChange(hour) {
    if (hour === '') {
      localStorage.removeItem('as_reminder_hour');
      localStorage.removeItem('as_reminder_last_sent');
      setReminderHour('');
      toast('복습 알림이 해제됐습니다.', 'success');
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
    localStorage.setItem('as_reminder_hour', hour);
    setReminderHour(hour);
    toast(`매일 ${hour}시에 복습 알림을 보낼게요!`, 'success');
  }

  function startEditGoals() {
    setGoalReview(profile?.goal_review ?? 5);
    setGoalWords(profile?.goal_words  ?? 5);
    setGoalRead(profile?.goal_read    ?? 1);
    setIsEditingGoals(true);
  }

  const saveGoalsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        goal_review: Math.max(1, goalReview),
        goal_words:  Math.max(1, goalWords),
        goal_read:   Math.max(1, goalRead),
      }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => { fetchProfile(user.id, user.user_metadata); setIsEditingGoals(false); toast('목표가 저장됐습니다.', 'success'); },
    onError: (err) => toast(err.message, 'error'),
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!editName.trim()) throw new Error('닉네임을 입력해주세요.');
      const { error } = await supabase.from('profiles').update({
        display_name: editName.trim(),
        learning_language: editLanguages,
        learning_level_japanese: editLevelJp,
        learning_level_english: editLevelEn,
      }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => { fetchProfile(user.id, user.user_metadata); queryClient.invalidateQueries({ queryKey: ['home', user.id] }); toast('프로필이 저장됐습니다.', 'success'); },
    onError: (err) => toast(err.message, 'error'),
  });

  if (!user) {
    return (
      <div className="page-container mypage-noauth">
        <h2 className="mypage-noauth__title">로그인이 필요합니다</h2>
        <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
      </div>
    );
  }

  const xp = profile?.xp ?? 0;
  const level = getXPLevel(xp);
  const streak = profile?.streak_count ?? 0;

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>

      {/* 헤더 */}
      <div className="mypage-profile-header">
        <div className="mypage-avatar">{profile?.display_name?.[0] || '👤'}</div>
        <div className="mypage-profile-info">
          <h1 className="mypage-profile-info__name">{profile?.display_name || '학습자'}</h1>
          <p className="mypage-profile-info__email">
            Lv.{level} · {xp.toLocaleString('ko-KR')} XP
            {streak > 0 && <> · 🔥 {streak}일</>}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
      </div>

      {/* 통계 요약 → /stats */}
      <Link href="/stats" className="card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', marginBottom: 16, textDecoration: 'none', color: 'var(--text-primary)',
      }}>
        <span style={{ fontSize: '0.9rem' }}>📊 학습 통계 · 업적 · 히트맵</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>더 보기 →</span>
      </Link>

      {/* 학습 설정 */}
      <div className="card mypage-section">
        <h2 className="mypage-section__title">⚙️ 학습 설정</h2>

        <details className="mypage-collapse" open={openPanel === 'profile'}
          onToggle={e => { if (e.currentTarget.open) setOpenPanel('profile'); else if (openPanel === 'profile') setOpenPanel(null); }}>
          <summary className="mypage-collapse__summary" onClick={e => { e.preventDefault(); togglePanel('profile'); }}>
            <span>👤 프로필 (닉네임 · 학습 언어 · 수준)</span>
            <span className="mypage-collapse__chevron">▾</span>
          </summary>
          <div className="mypage-collapse__body">
            <div className="form-field">
              <label className="form-label">닉네임</label>
              <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} maxLength={20} />
            </div>
            <div className="form-field">
              <label className="form-label">학습 언어</label>
              <div className="toggle-group">
                {['Japanese', 'English'].map(lang => (
                  <button key={lang} type="button"
                    className={`toggle-btn ${editLanguages.includes(lang) ? 'toggle-btn--primary' : ''}`}
                    onClick={() => setEditLanguages(prev =>
                      prev.includes(lang) ? prev.length > 1 ? prev.filter(l => l !== lang) : prev : [...prev, lang]
                    )}>
                    {lang === 'Japanese' ? '🇯🇵 Japanese' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            </div>
            {editLanguages.includes('Japanese') && (
              <div className="form-field">
                <label className="form-label">🇯🇵 일본어 수준</label>
                <div className="level-group">
                  {LEVELS.Japanese.map(lvl => (
                    <button key={lvl} type="button" className={`level-btn ${editLevelJp === lvl ? 'level-btn--active' : ''}`}
                      onClick={() => setEditLevelJp(lvl)}>{lvl}</button>
                  ))}
                </div>
              </div>
            )}
            {editLanguages.includes('English') && (
              <div className="form-field">
                <label className="form-label">🇬🇧 영어 수준</label>
                <div className="level-group">
                  {LEVELS.English.map(lvl => (
                    <button key={lvl} type="button" className={`level-btn ${editLevelEn === lvl ? 'level-btn--active' : ''}`}
                      onClick={() => setEditLevelEn(lvl)}>{lvl}</button>
                  ))}
                </div>
              </div>
            )}
            <Button size="sm" onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
              {saveProfileMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </details>

        <details className="mypage-collapse" open={openPanel === 'goals'}
          onToggle={e => { if (e.currentTarget.open) setOpenPanel('goals'); else if (openPanel === 'goals') setOpenPanel(null); }}>
          <summary className="mypage-collapse__summary" onClick={e => { e.preventDefault(); togglePanel('goals'); }}>
            <span>🎯 일일 목표 (복습 {profile?.goal_review ?? 5} · 수집 {profile?.goal_words ?? 5} · 완독 {profile?.goal_read ?? 1})</span>
            <span className="mypage-collapse__chevron">▾</span>
          </summary>
          <div className="mypage-collapse__body">
            {isEditingGoals ? (
              <>
                {[
                  { label: '🧠 단어 복습', value: goalReview, set: setGoalReview, min: 1, max: 50 },
                  { label: '⭐ 단어 수집', value: goalWords,  set: setGoalWords,  min: 1, max: 30 },
                  { label: '📖 자료 완독', value: goalRead,   set: setGoalRead,   min: 1, max: 5  },
                ].map(({ label, value, set, min, max }) => (
                  <div key={label} className="mypage-goal-slider">
                    <div className="mypage-goal-slider__head"><span>{label}</span><span className="mypage-goal-slider__value">{value}개</span></div>
                    <input type="range" className="mypage-range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} />
                  </div>
                ))}
                <div className="mypage-goal-actions">
                  <Button size="sm" onClick={() => saveGoalsMutation.mutate()} disabled={saveGoalsMutation.isPending} style={{ flex: 1 }}>
                    {saveGoalsMutation.isPending ? '저장 중...' : '저장'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setIsEditingGoals(false)} style={{ flex: 1 }}>취소</Button>
                </div>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={startEditGoals}>편집</Button>
            )}
          </div>
        </details>

        <details className="mypage-collapse" open={openPanel === 'alarm'}
          onToggle={e => { if (e.currentTarget.open) setOpenPanel('alarm'); else if (openPanel === 'alarm') setOpenPanel(null); }}>
          <summary className="mypage-collapse__summary" onClick={e => { e.preventDefault(); togglePanel('alarm'); }}>
            <span>🔔 복습 알림 {reminderHour ? `(매일 ${reminderHour}시)` : '(꺼짐)'}</span>
            <span className="mypage-collapse__chevron">▾</span>
          </summary>
          <div className="mypage-collapse__body">
            {typeof Notification !== 'undefined' && notifPerm === 'denied' && (
              <div className="mypage-reminder-blocked">⚠️ 브라우저에서 알림이 차단돼 있어요.</div>
            )}
            <div className="mypage-reminder-options">
              {['', '7', '9', '12', '18', '21'].map(h => (
                <button key={h} className={`mypage-reminder-btn ${reminderHour === h ? 'mypage-reminder-btn--active' : ''}`}
                  onClick={() => handleReminderChange(h)}>
                  {h === '' ? '끄기' : `${h}시`}
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* 계정 & 앱 */}
      <InstallPrompt />
      <AccountSettings user={user} toast={toast} signOut={signOut} />

      {/* 바로가기 + 정책 */}
      <div className="card mypage-section" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Link href="/guide" className="btn btn--ghost btn--sm">📚 가이드</Link>
          <Link href="/help" className="btn btn--ghost btn--sm">❓ 도움말</Link>
          <Link href="/leaderboard" className="btn btn--ghost btn--sm">🏆 랭킹</Link>
          <Link href="/forum" className="btn btn--ghost btn--sm">💬 포럼</Link>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          <Link href="/terms" style={{ color: 'inherit' }}>이용약관</Link>
          {' · '}
          <Link href="/privacy" style={{ color: 'inherit' }}>개인정보 처리방침</Link>
        </div>
      </div>

    </div>
  );
}
