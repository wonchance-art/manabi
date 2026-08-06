'use client';

import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';

/**
 * 진입 화면 — 사설 학습 도구의 현관.
 * 공개 서비스가 아니므로 홍보 문구·기능 소개·전환 유도(CTA 반복)는 두지 않는다.
 * 여기서 하는 일은 하나: "어느 트랙으로 갈지" 고르게 하고, 저장이 필요한 기능은 로그인을 권한다.
 */
const TRACKS = [
  { lang: 'French', native: 'Français', name: '프랑스어', level: 'A1 – C2' },
  { lang: 'Japanese', native: '日本語', name: '일본어', level: 'N5 – N1' },
  { lang: 'English', native: 'English', name: '영어', level: 'A1 – C2' },
  { lang: 'Chinese', native: '中文', name: '중국어', level: 'HSK 1 – 6' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing landing--minimal">
      <header className="landing-nav">
        <div className="landing-nav__logo">
          <span>Anatomy Studio</span>
        </div>
        <div className="landing-nav__actions">
          <Link href="/lessons" className="landing-nav__link">교재</Link>
          <Link href="/vocab" className="landing-nav__link">복습</Link>
          <Link href="/materials" className="landing-nav__link landing-nav__link--desktop">자료</Link>
          {user
            ? <Link href="/home" className="btn btn--primary btn--sm">홈 →</Link>
            : <Link href="/auth" className="btn btn--ghost btn--sm">로그인</Link>
          }
        </div>
      </header>

      <main className="landing-minimal">
        <h1 className="landing-minimal__title">무엇부터 볼까요?</h1>

        <div className="track-grid">
          {TRACKS.map((t) => (
            <Link key={t.lang} href={`/lessons?lang=${t.lang}`} className="track-card">
              <span className="track-card__native">{t.native}</span>
              <span className="track-card__name">{t.name}</span>
              <span className="track-card__stat">{t.level}</span>
              <span className="track-card__cta">교재 열기 →</span>
            </Link>
          ))}
        </div>

        {/* 저장이 필요한 기능만 로그인을 권한다 — 읽기·드릴·써 보기는 로그인 없이 그대로 쓴다. */}
        {!user && (
          <p className="landing-minimal__note">
            교재·드릴·써 보기는 로그인 없이 바로 쓸 수 있어요.{' '}
            <Link href="/auth">로그인</Link>하면 단어장과 진도가 기기 간에 이어집니다.
          </p>
        )}
      </main>

      <footer className="landing-footer landing-footer--minimal">
        <div className="landing-footer__links">
          <Link href="/guide" className="landing-footer__link">사용 가이드</Link>
          <Link href="/terms" className="landing-footer__link">이용약관</Link>
          <Link href="/privacy" className="landing-footer__link">개인정보</Link>
        </div>
      </footer>
    </div>
  );
}
