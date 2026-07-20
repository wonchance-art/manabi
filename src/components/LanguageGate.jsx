'use client';

import { useAuth } from '../lib/AuthContext';

// 모드 = 학습 언어. 현재 en(영어·IELTS) 중심, jp는 기존 Anatomy 보존, ko는 향후.
export const LANGS = [
  { code: 'en', label: '영어', desc: 'IELTS·영어 학습', emoji: '🇬🇧' },
  { code: 'jp', label: '일본어', desc: '형태소 해부 읽기', emoji: '🇯🇵' },
  // { code: 'ko', label: '한국어', desc: '(향후)', emoji: '🇰🇷' },
];

/**
 * 로그인했지만 active_lang이 없으면 언어 선택 화면을 띄운다.
 * 선택 후엔 그 언어 모드로 진입. 이후엔 마지막 선택이 기억되어 통과.
 */
export default function LanguageGate({ children }) {
  const { user, activeLang, setLang, loading } = useAuth();

  if (loading || !user) return children; // 인증 전/로딩은 통과(상위에서 처리)
  if (activeLang) return children;        // 이미 선택됨 → 통과

  return (
    <div className="lang-gate">
      <h1>학습할 언어를 선택하세요</h1>
      <p className="lang-gate-sub">선택한 언어의 콘텐츠·복습·진도가 따로 관리됩니다. 언제든 상단에서 전환할 수 있어요.</p>
      <div className="lang-gate-grid">
        {LANGS.map((l) => (
          <button key={l.code} className="lang-gate-card" onClick={() => setLang(l.code)}>
            <span className="lang-gate-emoji">{l.emoji}</span>
            <b>{l.label}</b>
            <small>{l.desc}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
