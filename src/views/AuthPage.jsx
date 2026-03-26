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

  // 이메일 인증 실패 파라미터 처리
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
      setError(toKoreanError(err.message));
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
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - var(--gnb-height))' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🧬</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            {isForgot ? '비밀번호 찾기' : isLogin ? '다시 오셨군요!' : '함께 성장해요'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isForgot ? '가입한 이메일로 재설정 링크를 보내드려요' : isLogin ? '계정에 로그인하세요' : '새 계정을 만들어보세요'}
          </p>
        </div>

        {/* Google Login */}
        {!isForgot && <button
          onClick={handleGoogle}
          style={{
            width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
            background: 'white', border: '1px solid #ddd',
            color: '#444', fontSize: '0.95rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            cursor: 'pointer', transition: 'all 0.2s', marginBottom: '24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Google로 계속하기
        </button>}

        {/* Divider */}
        {!isForgot && <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>또는</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {!isLogin && !isForgot && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>닉네임</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="학습 닉네임"
                required
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                  transition: 'border 0.2s'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hello@example.com"
              required
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
              }}
            />
          </div>

          {!isForgot && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>비밀번호</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setIsForgot(true); setError(''); setSuccess(''); }}
                    style={{ fontSize: '0.75rem', color: 'var(--primary-light)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    비밀번호 찾기
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                minLength={6}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px',
              background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)',
              color: '#FF6B6B', fontSize: '0.85rem'
            }}>
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px',
              background: 'rgba(6, 214, 160, 0.1)', border: '1px solid rgba(6, 214, 160, 0.3)',
              color: 'var(--accent)', fontSize: '0.85rem'
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
              background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: 'white', fontSize: '0.95rem', fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer', border: 'none',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(124, 92, 252, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '처리 중...' : isForgot ? '재설정 링크 보내기' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        {/* Toggle */}
        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isForgot ? (
            <>
              기억나셨나요?{' '}
              <button
                onClick={() => { setIsForgot(false); setError(''); setSuccess(''); }}
                style={{ color: 'var(--primary-light)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                로그인으로 돌아가기
              </button>
            </>
          ) : (
            <>
              {isLogin ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                style={{ color: 'var(--primary-light)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
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
