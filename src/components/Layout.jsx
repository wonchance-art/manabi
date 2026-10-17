'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';
import { useState, useEffect, useRef } from 'react';
import OnboardingModal from './OnboardingModal';
import './books/reading-shell.css';
import './web/web-shell.css';
import { MAIN_NAV, navigationOwner, isFocusedReadingRoute } from '@/lib/webNavigation';
import './web/focused-reader.css';
import { librarySearchHref } from '@/lib/libraryReturn';
import { authEntryHref } from '@/lib/authRedirect';
import VersionBadge from './VersionBadge';
import NavPendingMark from './NavPendingMark';
import { focusPageIfLost, watchPageHeading } from '@/lib/routeFocus';
import { intentPrefetchProps } from '@/lib/intentPrefetch';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/ToastContext';
import ActionIcon from './ActionIcon';
import { shouldShowOnboarding } from '../lib/onboardingGate';
import { showLocalReminder } from '../lib/localReminder';
import { failureMessage } from '@/lib/errorMessage';


// 미완성 기능 임시 숨김 — true로 바꾸면 학습·클래스 내비가 함께 복원된다.

function ReaderSiteMenu({ isAdmin }) {
  const ref = useRef(null);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  useEffect(() => {
    const closeOutside = e => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    const closeWithKey = e => {
      if (e.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary').focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithKey);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeWithKey); };
  }, []);
  return <details ref={ref} className="reader-site-menu">
    <summary aria-label="메뉴" title="메뉴" data-icon-action><ActionIcon name="menu"/></summary>
    <nav aria-label="읽기 화면 내비게이션" onClick={e => { if (e.target.closest('a')) ref.current.open = false; }}>
      {/* 집중 읽기에서는 기본 메뉴가 숨으므로 이 메뉴가 지금 위치를 알려야 한다(뷰어 = 서재 — M09 6155101880) */}
      {MAIN_NAV.map(item => <Link key={item.href} href={item.href} prefetch={item.prefetch} {...intentPrefetchProps(router, item, navigationOwner(pathname) === item.href)} aria-current={navigationOwner(pathname) === item.href ? 'page' : undefined}>{item.label}<NavPendingMark /></Link>)}
      {isAdmin && <Link href="/class" prefetch={false}>수업</Link>}
      {isAdmin && <Link href="/admin" prefetch={false}>관리</Link>}
    </nav>
  </details>;
}

export default function Layout({ children }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const focusedReading = isFocusedReadingRoute(pathname);
  const isNavActive = href => navigationOwner(pathname) === href;
  const { theme, toggleTheme } = useTheme();

  // 화면이 바뀐 뒤 포커스가 body로 떨어졌으면(누른 카드 · 탭이 사라졌다) 새 화면의 첫 제목(h1, 없으면 본문)으로 옮긴다(APP-FEEL-003, 2026-10-17 KST).
  // 운영 실측: 배움 → 교재 카드 · 단어 목록 → 문형 탭 · 뷰어 「다음 편」 뒤 activeElement = body — 키보드 · 화면 읽기가 처음부터 다시 찾았다.
  // 다른 곳에 포커스가 살아 있으면(GNB 탭을 눌렀다 등) 빼앗지 않는다. 첫 마운트 · 해시만 바뀐 이동(pathname 같음)은 건너뛴다.
  const lastPathname = useRef(null);
  useEffect(() => {
    if (lastPathname.current === null || lastPathname.current === pathname) { lastPathname.current = pathname; return undefined; }
    lastPathname.current = pathname;
    // 옮긴 자리를 2초 지킨다(watchPageHeading — 사용자 조작 · 다음 이동에 끝): 본문이면 실제 제목이 보일 때 그리로,
    // 제목이면 그 제목이 빠지거나 감춰져 포커스가 body로 떨어질 때 다음 제목(없으면 본문)으로.
    let stopWatch = null;
    const frame = requestAnimationFrame(() => { if (focusPageIfLost(document)) stopWatch = watchPageHeading(document); });
    return () => { cancelAnimationFrame(frame); stopWatch?.(); };
  }, [pathname]);
  const [isOffline, setIsOffline] = useState(false);
  const [resendingConfirm, setResendingConfirm] = useState(false);
  const toast = useToast();
  const reviewActorRef = useRef(user?.id ?? null);
  reviewActorRef.current = user?.id ?? null;

  // 이메일 미검증 사용자 감지 (Supabase에서 confirm 필수가 꺼진 경우)
  const needsEmailConfirm = !!user && user.email && !user.email_confirmed_at && !user.confirmed_at;

  async function resendConfirmation() {
    if (!user?.email || resendingConfirm) return;
    setResendingConfirm(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
      toast('인증 메일을 다시 보냈어요. 받은편지함을 확인해 주세요.', 'success');
    } catch (err) {
      toast(failureMessage('인증 메일을 보내지 못했어요.', err), 'error');
    } finally {
      setResendingConfirm(false);
    }
  }

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    setIsOffline(!navigator.onLine);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // 미전송 복습 동기화(v2-N R2) — 앱 진입과 온라인 복귀 두 시점에.
  // 큐가 비어 있으면 IndexedDB 한 번 읽고 끝이라 상시 재실행이 싸다.
  // 화면에는 성공했을 때만 한 줄 — 오프라인 중에는 조용하다(오너 선택 '안 A').
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const sync = async () => {
      try {
        const [{ flushReviews: flushActorReviews }, { persistVocabGrade }] = await Promise.all([
          import('../lib/reviewOutbox'),
          import('../lib/fsrs'),
        ]);
        if (!alive || reviewActorRef.current !== user.id) return;
        const flushReviews = (client, accountId, options) => flushActorReviews(client, accountId, {
          ...options, getAccountId: () => alive ? reviewActorRef.current : null,
        });
        const r = await flushReviews(supabase, user.id, { persist: persistVocabGrade });
        if (reviewActorRef.current !== user.id) return;
        if (!alive || r.sent === 0) return;
        toast(`복습 ${r.sent}개를 저장했어요.`, 'success');
        // 대기 수를 띄우는 화면(단어장)이 다시 세게 한다 — 폴링 대신 신호.
        window.dispatchEvent(new CustomEvent('manabi:outbox-flushed'));
      } catch { /* 큐를 못 써도 학습은 계속된다 */ }
    };
    sync();
    window.addEventListener('online', sync);
    return () => { alive = false; window.removeEventListener('online', sync); };
  }, [user?.id, toast]);

  // 복습 알림 스케줄러
  useEffect(() => {
    if (!user) return;
    const check = () => {
      const hour = localStorage.getItem('as_reminder_hour');
      if (!hour) return;
      const now = new Date();
      const currentHour = now.getHours();
      const todayKey = now.toISOString().slice(0, 10);
      const lastSent = localStorage.getItem('as_reminder_last_sent');
      if (parseInt(hour) === currentHour && lastSent !== todayKey) {
        // 안드로이드 크롬은 페이지 생성자 알림을 거부한다 — 서비스 워커 showNotification 우선(localReminder.js).
        showLocalReminder('복습할 시간이에요', {
          body: '오늘의 단어를 복습하고 연속 기록을 이어 가 보세요.',
          tag: 'as-review-reminder',
        }).then((shown) => {
          if (shown) { try { localStorage.setItem('as_reminder_last_sent', todayKey); } catch {} }
        });
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [user]);

  async function handleAuthClick() {
    if (user) {
      await signOut();
      router.push('/auth');
      router.refresh(); // 로그인 상태로 미리 받아 둔 배움 대기 화면을 버린다(B1) — 이동 뒤 차례로
    } else {
      router.push(authEntryHref(window.location.pathname + window.location.search + window.location.hash));
    }
  }

  // 핵심 네비게이션만 노출 — 부가 기능(가이드·통계)은 프로필 안쪽으로
  // 학습 월드(/world)는 개발 동결(2026-07 피벗)로 내비에서 내렸다 — 라우트는 유지, 직행 URL로만.
  const navLinks = MAIN_NAV;
  const mobileNavLinks = MAIN_NAV;

  return (
    <div className={`manabi-app${focusedReading ? ' manabi-app--reading' : ''}`}>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <header className="gnb" role="banner">
        <Link href="/home" prefetch={false} className="gnb__logo" aria-label="manabi 배움">
          <span>manabi<span className="manabi-brand-dot" aria-hidden="true" /></span>
        </Link>

        <Link href="/home" prefetch={false} className="classroom-app-home" aria-label="웹앱 홈" title="웹앱 홈" data-icon-action><ActionIcon name="home"/></Link>
        <nav className="gnb__nav" aria-label="메인 내비게이션">
          {navLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={l.prefetch}
              {...intentPrefetchProps(router, l, isNavActive(l.href))}
              className={`gnb__link gnb__link--text ${isNavActive(l.href) ? 'active' : ''}`}
              aria-current={isNavActive(l.href) ? 'page' : undefined}
            >
              {l.label}
              <NavPendingMark />
            </Link>
          ))}
        </nav>

        {/* 수업 팀 허브(v2-AB R1) — 오너(관리자)만. 학생은 팀 링크로 들어온다. */}
        {isAdmin && (
          <Link
            href="/class"
            prefetch={false}
            className={`gnb__link ${pathname.startsWith('/class') ? 'active' : ''}`}
            aria-label="수업" title="수업" data-icon-action
          >
            <ActionIcon name="users"/>
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className={`gnb__link ${pathname.startsWith('/admin') ? 'active' : ''}`}
            style={{ color: 'var(--admin-accent)' }}
            aria-label="관리" title="관리" data-icon-action
          >
            <ActionIcon name="settings"/>
          </Link>
        )}

        {/* 배포 버전 배지(v2-J) — 관리자·?v=1일 때만 DOM에 나타난다(그 밖엔 null) */}
        <VersionBadge />

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-pressed={theme === 'dark'}
          data-icon-action
        >
          <ActionIcon name={theme==='dark'?'sun':'moon'}/>
        </button>

        {focusedReading && <ReaderSiteMenu isAdmin={isAdmin} />}
        <Link href={librarySearchHref(user)} prefetch={false} className="manabi-search-link" aria-label="자료 검색" title="자료 검색" data-icon-action><ActionIcon name="search"/></Link>
        <div className="gnb__actions">
          {user ? (
            <div className="gnb__user-area">
              <button
                className="gnb__profile-btn"
                onClick={() => router.push('/profile')}
                title={profile?.display_name || user.email}
                aria-label="내 계정"
                data-icon-action
              >
                <ActionIcon name="user"/>
              </button>
            </div>
          ) : (
            <button
              className="gnb__profile-btn"
              onClick={handleAuthClick}
              title="로그인"
              style={{ background: 'var(--bg-elevated)', fontSize: '0.75rem' }}
            >
              로그인
            </button>
          )}
        </div>
      </header>

      {/* 오프라인 배너 */}
      {isOffline && (
        <div className="offline-banner" role="alert" aria-live="assertive">
          인터넷 연결을 확인해 주세요. 저장해 둔 자료·단어장은 그대로 볼 수 있어요.
        </div>
      )}

      {/* 이메일 미검증 안내 */}
      {needsEmailConfirm && (
        <div
          role="status"
          style={{
            background: 'var(--notice-bg)',
            color: 'var(--notice-text)',
            borderBottom: '1px solid var(--notice-border)',
            padding: '10px 16px',
            fontSize: '0.85rem',
            textAlign: 'center',
          }}
        >
          이메일 인증이 필요해요 — <strong>{user.email}</strong> 받은편지함을 확인해 주세요.{' '}
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resendingConfirm}
            style={{
              background: 'transparent', border: 'none',
              color: 'inherit', textDecoration: 'underline',
              cursor: resendingConfirm ? 'default' : 'pointer',
              fontWeight: 600, marginLeft: 4,
            }}
          >
            {resendingConfirm ? '발송 중…' : '인증 메일 다시 보내기'}
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" aria-label="모바일 내비게이션">
        {mobileNavLinks.map(l => (
          <Link
            key={l.href}
            href={l.href}
            prefetch={l.prefetch}
            {...intentPrefetchProps(router, l, isNavActive(l.href))}
            className={`mobile-nav__link ${isNavActive(l.href) ? 'active' : ''}`}
            aria-current={isNavActive(l.href) ? 'page' : undefined}
          >
            <ActionIcon name={l.icon}/>
            <span>{l.label}</span>
            <NavPendingMark />
          </Link>
        ))}
      </nav>

      <main className="app-layout" role="main" id="main-content" tabIndex={-1}>
        {children}
      </main>

      {shouldShowOnboarding(profile, pathname) && <OnboardingModal />}
    </div>
  );
}
