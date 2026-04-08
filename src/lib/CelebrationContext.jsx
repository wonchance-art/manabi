'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { getXPLevel } from './xp';

const CelebrationContext = createContext(null);

/**
 * Celebration types:
 * - { type: 'levelup', level, xp }
 * - { type: 'achievement', icon, name, desc }
 * - { type: 'milestone', icon, title, subtitle }
 */

export function CelebrationProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const current = queue[0] || null;

  const celebrate = useCallback((items) => {
    const arr = Array.isArray(items) ? items : [items];
    setQueue(prev => [...prev, ...arr]);
  }, []);

  /** 레벨업 자동 감지: prevXP → newXP 비교 */
  const checkLevelUp = useCallback((prevXP, newXP) => {
    if (prevXP == null || newXP == null) return;
    const prevLevel = getXPLevel(prevXP);
    const newLevel = getXPLevel(newXP);
    if (newLevel > prevLevel) {
      setQueue(prev => [...prev, { type: 'levelup', level: newLevel, xp: newXP }]);
    }
  }, []);

  const dismiss = useCallback(() => {
    setQueue(prev => prev.slice(1));
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate, checkLevelUp, current, dismiss }}>
      {children}
      {current && <CelebrationModal item={current} onDismiss={dismiss} />}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be within CelebrationProvider');
  return ctx;
}

/* ─────────── Modal Component ─────────── */

const LEVEL_TITLES = [
  '', '입문자', '탐험가', '수집가', '학습자', '도전자',
  '연구자', '해부학자', '마스터', '전문가', '전설',
];

function CelebrationModal({ item, onDismiss }) {
  return (
    <div className="celebration-overlay" onClick={onDismiss}>
      <div className="celebration-modal" onClick={e => e.stopPropagation()}>
        {/* Particles */}
        <div className="celebration-particles" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className="celebration-particle"
              style={{
                '--x': `${Math.random() * 100}%`,
                '--delay': `${Math.random() * 0.6}s`,
                '--drift': `${(Math.random() - 0.5) * 120}px`,
                '--color': ['#7C5CFC', '#4A8A5C', '#FCC419', '#FF6B6B', '#00D2FF'][i % 5],
              }}
            />
          ))}
        </div>

        {item.type === 'levelup' && (
          <>
            <div className="celebration-icon celebration-icon--levelup">
              <span className="celebration-icon__glow">⚡</span>
            </div>
            <h2 className="celebration-title">레벨 업!</h2>
            <div className="celebration-level">Lv.{item.level}</div>
            <p className="celebration-subtitle">
              {LEVEL_TITLES[item.level] || '전설'} 등급에 도달했어요
            </p>
            <p className="celebration-xp">총 {(item.xp ?? 0).toLocaleString('ko-KR')} XP</p>
          </>
        )}

        {item.type === 'achievement' && (
          <>
            <div className="celebration-icon celebration-icon--badge">
              <span className="celebration-icon__glow">{item.icon}</span>
            </div>
            <h2 className="celebration-title">업적 달성!</h2>
            <div className="celebration-badge-name">{item.name}</div>
            <p className="celebration-subtitle">{item.desc}</p>
          </>
        )}

        {item.type === 'milestone' && (
          <>
            <div className="celebration-icon celebration-icon--milestone">
              <span className="celebration-icon__glow">{item.icon}</span>
            </div>
            <h2 className="celebration-title">{item.title}</h2>
            <p className="celebration-subtitle">{item.subtitle}</p>
          </>
        )}

        <button className="celebration-dismiss" onClick={onDismiss}>
          계속하기
        </button>
      </div>
    </div>
  );
}
