'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { toKoreanError } from '../lib/authErrors';

function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [isForgot, setIsForgot] = useState(false);

  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/materials';

  useEffect(() => {
    if (searchParams.get('error') === 'email_confirm_failed') {
      setError('이메일 인증에 실패했습니다. 다시 회원가입을 시도해주세요.');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgot) {
        await resetPassword(email);
        setSuccess('📧 비밀번호 재설정 링크를 이메일로 보냈습니다. 확인해주세요!');
      } else if (isLogin) {
        await signIn(email, password);
        router.push(from);
      } else {
        await signUp(email, password, displayName);
        setSuccess('🎉 인증 이메일을 발송했습니다! 이메일을 확인해주세요.');
      }
    } catch (err) {
      const msg = toKoreanError(err?.message || String(err));
      if (msg === 'ALREADY_REGISTERED') {
        setError('ALREADY_REGISTERED');
      } else {
        setError(msg || '로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(toKoreanError(err.message));
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-header__icon">🧬</div>
          <h1 className="auth-header__title">
            {isForgot ? '비밀번호 찾기' : isLogin ? '다시 오셨군요!' : '함께 성장해요'}
          </h1>
          <p className="auth-header__sub">
            {isForgot ? '가입한 이메일로 재설정 링크를 보내드려요' : isLogin ? '계정에 로그인하세요' : '새 계정을 만들어보세요'}
          </p>
        </div>

        {/* Google Login */}
        {!isForgot && (
          <button onClick={handleGoogle} className="auth-google-btn">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Google로 계속하기
          </button>
        )}

        {/* Divider */}
        {!isForgot && (
          <div className="auth-divider">
            <div className="auth-divider__line" />
            <span className="auth-divider__text">또는</span>
            <div className="auth-divider__line" />
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {!isLogin && !isForgot && (
            <div className="auth-field">
              <label className="auth-label">닉네임</label>
              <input
                type="text"
                className="auth-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="학습 닉네임"
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">이메일</label>
            <input
              type="email"
              className="auth-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hello@example.com"
              required
            />
          </div>

          {!isForgot && (
            <div className="auth-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="auth-label" style={{ marginBottom: 0 }}>비밀번호</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setIsForgot(true); setError(''); setSuccess(''); }}
                    className="auth-link-btn"
                  >
                    비밀번호 찾기
                  </button>
                )}
              </div>
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                minLength={6}
              />
            </div>
          )}

          {error && error === 'ALREADY_REGISTERED' ? (
            <div className="auth-alert auth-alert--error">
              ⚠️ 이미 가입된 이메일입니다.{' '}
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                className="auth-alert__link"
              >
                로그인하러 가기 →
              </button>
            </div>
          ) : error ? (
            <div className="auth-alert auth-alert--error">⚠️ {error}</div>
          ) : null}

          {success && (
            <div className="auth-alert auth-alert--success">{success}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`auth-submit ${loading ? 'auth-submit--loading' : ''}`}
          >
            {loading ? '처리 중...' : isForgot ? '재설정 링크 보내기' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        {/* Toggle */}
        <p className="auth-toggle">
          {isForgot ? (
            <>
              기억나셨나요?{' '}
              <button
                onClick={() => { setIsForgot(false); setError(''); setSuccess(''); }}
                className="auth-link-btn"
              >
                로그인으로 돌아가기
              </button>
            </>
          ) : (
            <>
              {isLogin ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                className="auth-link-btn"
              >
                {isLogin ? '회원가입' : '로그인'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
