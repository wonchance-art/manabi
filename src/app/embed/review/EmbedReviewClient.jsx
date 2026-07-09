'use client';

// 🔌 임베드 복습 위젯(클라이언트) — 외부 iframe(게더타운 오브젝트 등) 안에서 단독으로 도는
// 로그인 + due 어휘 복습. 채점·SRS는 QuestReview를 그대로 재사용하므로 규약은 자동 충족된다.
//
// ── 세션 처리 방침(설계 근거) ──
// AuthProvider는 루트 providers.jsx에 있어 /embed 를 포함한 "모든" 라우트를 감싼다(루트 layout).
// 즉 여기서도 AuthContext의 세션 구독(onAuthStateChange)이 이미 살아 있다. 그래서
// supabase.auth.getSession()/onAuthStateChange 를 새로 구독하지 않고 useAuth()를 그대로 쓴다:
//   · 구독 중복(두 개의 리스너)을 피하고,
//   · 로그아웃 시 AuthContext.signOut()의 "명시적 로그아웃" 가드를 물려받아
//     앱 본편의 세션-만료 → /auth 리다이렉트(임베드 이탈)를 억제한다.
// 다만 로그인 "실행"만은 명세대로 supabase.auth.signInWithPassword 를 직접 호출한다
// (이메일/비밀번호 전용 — OAuth는 iframe 리다이렉트/팝업 차단 이슈로 제외). 로그인 성공은
// AuthContext의 onAuthStateChange가 받아 user를 갱신하므로 화면은 자동 전환된다.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/AuthContext';
import QuestReview, { GBC, gbcPanel, gbcButton, gbcButtonPrimary } from '../../../components/world/QuestReview';
import bus from '../../../components/world/bus';

// 게더 오브젝트는 좁다 — 패널을 작게 잡고 100dvh 다크 배경(GBC 화면 베젤 느낌) 위에 센터링.
const SCREEN = {
  width: '100%', height: '100dvh',
  background: GBC.ink,
  fontFamily: GBC.font,
};
const CENTER = {
  width: '100%', height: '100dvh',
  display: 'grid', placeItems: 'center', padding: 12, boxSizing: 'border-box',
};
const PANEL = { ...gbcPanel, width: 'min(94%, 320px)', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 };

export default function EmbedReviewClient() {
  const { user, loading, signOut } = useAuth();

  // (a) 스토리지 격리 감지 — Safari 등 서드파티 iframe의 파티셔닝/차단 대응.
  // 세션 저장은 쿠키가 1차지만, localStorage 쓰기가 막히면 파티셔닝된 컨텍스트라는 강한 신호다
  // (테마 초기화 스크립트도 localStorage에 의존). null=검사 전 · true=가능 · false=차단.
  const [storageOk, setStorageOk] = useState(null);
  useEffect(() => {
    try {
      localStorage.setItem('__embed_probe__', '1');
      localStorage.removeItem('__embed_probe__');
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, []);

  // 로그인 이후 화면: 'review'(복습 진행) | 'waiting'(닫음/완료 대기).
  const [view, setView] = useState('review');
  const [reviewKey, setReviewKey] = useState(0); // 리마운트로 재시작(다시 복습).
  const [lastDone, setLastDone] = useState(null); // {right,total} 이면 완주, null 이면 그냥 닫음.

  // QuestReview의 'quest:done'을 선택적으로 청취 — 대기 화면에서 "완료 vs 닫음"을 구분하기 위한
  // 순수 부가 용도다(QuestReview는 손대지 않는다). 'quest:scored'는 리스너가 없어 무해한 no-op.
  const doneRef = useRef(null);
  useEffect(() => {
    const onDone = (d) => { doneRef.current = d; };
    bus.on('quest:done', onDone);
    return () => bus.off('quest:done', onDone);
  }, []);

  const openInNewTab = () => window.open(window.location.href, '_blank', 'noopener');

  const handleClose = () => {
    setLastDone(doneRef.current); // 이번 판에서 완주 신호가 왔으면 요약, 아니면 null.
    setView('waiting');
  };
  const startReview = () => {
    doneRef.current = null;
    setLastDone(null);
    setReviewKey((k) => k + 1);
    setView('review');
  };

  // ── (a) 스토리지 차단: 새 탭 탈출구만 제공 ──
  if (storageOk === false) {
    return (
      <div style={SCREEN}>
        <div style={CENTER}>
          <div style={{ ...PANEL, textAlign: 'center' }}>
            <span style={{ fontSize: '1.4rem' }}>🔒</span>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, lineHeight: 1.5 }}>
              이 환경에서는 로그인 상태를 저장할 수 없어요
            </p>
            <p style={{ fontSize: '0.74rem', color: GBC.inkSoft, margin: 0, lineHeight: 1.5 }}>
              브라우저가 이 창의 저장소를 막고 있어요. 새 탭에서 열면 정상적으로 복습할 수 있어요.
            </p>
            <button type="button" onClick={openInNewTab} style={{ ...gbcButtonPrimary, alignSelf: 'center', marginTop: 4 }}>
              새 탭에서 열기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 스토리지 검사 전 or 세션 확인 중 — 아주 짧은 로딩.
  if (storageOk === null || loading) {
    return (
      <div style={SCREEN}>
        <div style={CENTER}>
          <div style={{ ...PANEL, textAlign: 'center' }}>
            <p style={{ margin: 0, color: GBC.inkSoft, fontSize: '0.86rem' }}>불러오는 중…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── (c) 비로그인: 컴팩트 로그인 폼 ──
  if (!user) {
    return (
      <div style={SCREEN}>
        <div style={CENTER}>
          <LoginPanel onNewTab={openInNewTab} />
        </div>
      </div>
    );
  }

  // ── (d) 로그인됨: QuestReview 오버레이 ──
  // QuestReview는 position:absolute inset:0 이므로, 화면을 꽉 채우는 relative 컨테이너로 감싼다.
  if (view === 'review') {
    return (
      <div style={SCREEN}>
        <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
          <QuestReview key={reviewKey} userId={user.id} onClose={handleClose} />
        </div>
      </div>
    );
  }

  // ── (e) 대기/완료 화면 ──
  const completed = lastDone && typeof lastDone.total === 'number';
  return (
    <div style={SCREEN}>
      <div style={CENTER}>
        <div style={{ ...PANEL, textAlign: 'center' }}>
          <span style={{ fontSize: '1.5rem' }}>{completed ? '🎉' : '🌱'}</span>
          <p style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0 }}>
            {completed ? `복습 완료 · ${lastDone.right} / ${lastDone.total}` : '닫았어요'}
          </p>
          <p style={{ fontSize: '0.74rem', color: GBC.inkSoft, margin: 0, lineHeight: 1.5 }}>
            due가 남았으면 이어서, 없으면 "복습할 게 없어요"가 떠요.
          </p>
          <button type="button" onClick={startReview} style={{ ...gbcButtonPrimary, alignSelf: 'center', marginTop: 4 }}>
            다시 복습
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            style={{ ...gbcButton, alignSelf: 'center', padding: '5px 10px', fontSize: '0.72rem', boxShadow: 'none', background: GBC.cream }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 컴팩트 로그인 폼 ──
// 로그인 실행은 supabase.auth.signInWithPassword 직접 호출(이메일/비밀번호 전용).
// OAuth(구글)는 iframe 리다이렉트/팝업 차단으로 임베드에서 신뢰할 수 없어 의도적으로 제외한다.
function LoginPanel({ onNewTab }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr('');
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr('이메일 또는 비밀번호를 확인해 주세요.');
      // 성공 시 AuthContext의 onAuthStateChange가 user를 갱신 → 상위에서 자동 전환.
    } catch {
      setErr('로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    fontFamily: GBC.font, fontSize: '0.86rem', color: GBC.ink,
    background: GBC.creamHi, border: `2px solid ${GBC.creamShade}`, borderRadius: 2,
    padding: '9px 10px', width: '100%', boxSizing: 'border-box',
  };

  return (
    <form onSubmit={submit} style={PANEL}>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.02em' }}>🪧 즉석 복습</span>
      <p style={{ fontSize: '0.74rem', color: GBC.inkSoft, margin: 0, lineHeight: 1.5 }}>
        로그인하면 오늘 복습할 단어가 바로 떠요.
      </p>
      <input
        type="email" inputMode="email" autoComplete="email" placeholder="이메일"
        value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle}
      />
      <input
        type="password" autoComplete="current-password" placeholder="비밀번호"
        value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle}
      />
      {err && (
        <p style={{ fontSize: '0.74rem', color: GBC.red, margin: 0, lineHeight: 1.4 }}>{err}</p>
      )}
      <button type="submit" disabled={submitting} style={{ ...gbcButtonPrimary, width: '100%', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? '로그인 중…' : '로그인'}
      </button>
      {/* 격리가 아니어도 항상 노출하는 탈출구 — 게더 안에서 너무 작게 보일 때 새 탭에서 크게. */}
      <button
        type="button" onClick={onNewTab}
        style={{ ...gbcButton, width: '100%', boxShadow: 'none', background: GBC.cream, fontSize: '0.74rem', padding: '6px 10px' }}
      >
        새 탭에서 열기
      </button>
    </form>
  );
}
