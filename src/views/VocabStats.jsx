'use client';

import { useState } from 'react';
import { detectLang } from '../lib/constants';

const LEVEL_MILESTONES = {
  Japanese: { 'N5 기초': 800, 'N4 기본': 1500, 'N3 중급': 3750, 'N2 상급': 6000, 'N1 심화': 10000 },
  English:  { 'A1 기초': 500, 'A2 초급': 1000, 'B1 중급': 2000, 'B2 상급': 4000, 'C1 고급': 7000, 'C2 마스터': 10000 },
};

const LANG_META = {
  Japanese: { flag: '🇯🇵', label: '일본어', coverageTitle: 'JLPT 급수 커버리지', defaultTarget: 'N3 중급' },
  English:  { flag: '🇬🇧', label: '영어',   coverageTitle: 'CEFR 급수 커버리지', defaultTarget: 'B1 중급' },
};

function getLangVocab(vocab, lang) {
  return vocab.filter(v => (v.language === lang) || (!v.language && detectLang(v.word_text) === lang));
}

function LangTabs({ activeLangs, current, onChange }) {
  if (activeLangs.length < 2) return null;
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)' }}>
      {activeLangs.map(lang => {
        const meta = LANG_META[lang];
        const active = current === lang;
        return (
          <button key={lang} type="button"
            onClick={() => onChange(lang)}
            style={{
              padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600,
              border: 'none', borderRadius: 'var(--radius-full)',
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {meta.flag} {meta.label}
          </button>
        );
      })}
    </div>
  );
}

// section prop: undefined = 전체, 'levels' = 진행도+커버리지, 'memory' = 기억건강+스케줄, 'hardwords' = 요주의
export default function VocabStats({ vocab, profile, section }) {
  const profileLangs = profile?.learning_language || [];
  const activeLangs = ['Japanese', 'English'].filter(l =>
    profileLangs.includes(l) || vocab.some(v => (v.language === l) || (!v.language && detectLang(v.word_text) === l))
  );

  const [levelLang, setLevelLang] = useState(activeLangs[0] || 'Japanese');
  const effLevelLang = activeLangs.includes(levelLang) ? levelLang : activeLangs[0];

  const showAll = !section;
  const showLevels = showAll || section === 'levels';
  const showMemory = showAll || section === 'memory';
  const showHard = showAll || section === 'hardwords';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 레벨 진행도 + 급수 커버리지 통합 */}
      {showLevels && activeLangs.length > 0 && effLevelLang && (() => {
        const meta = LANG_META[effLevelLang];
        const langVocab = getLangVocab(vocab, effLevelLang);
        const total = langVocab.length;
        const mastered = langVocab.filter(v => (v.interval ?? 0) >= 14).length;
        const targetLevel = (effLevelLang === 'Japanese' ? profile?.learning_level_japanese : profile?.learning_level_english) || meta.defaultTarget;
        const targetCount = LEVEL_MILESTONES[effLevelLang][targetLevel] || Object.values(LEVEL_MILESTONES[effLevelLang])[0];
        const pct = Math.min(100, Math.round((total / targetCount) * 100));
        const barColor = effLevelLang === 'Japanese' ? 'var(--primary-light)' : 'var(--accent)';
        const levels = Object.entries(LEVEL_MILESTONES[effLevelLang]);
        const fillGrad = effLevelLang === 'Japanese'
          ? 'linear-gradient(180deg, var(--primary-light) 0%, var(--primary) 100%)'
          : 'linear-gradient(180deg, var(--accent) 0%, var(--primary) 100%)';
        return (
          <div className="card" >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>📈 어휘 레벨</h3>
              <LangTabs activeLangs={activeLangs} current={effLevelLang} onChange={setLevelLang} />
            </div>

            {/* 진행도 바 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>{meta.flag} {targetLevel} — {total.toLocaleString('ko-KR')} / {targetCount.toLocaleString('ko-KR')}개</span>
              <span>{pct}%</span>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: 10, overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
            </div>

            {/* 커버리지 차트 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>🎯 {meta.coverageTitle}</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>수집 {total} · 숙련 {mastered}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 100, padding: '4px 0' }}>
              {levels.map(([label, t]) => {
                const p = Math.min(100, (total / t) * 100);
                const mp = Math.min(100, (mastered / t) * 100);
                const reached = total >= t;
                return (
                  <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: reached ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {reached ? '✓' : `${Math.round(p)}%`}
                    </span>
                    <div style={{ width: '100%', height: 56, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${p}%`, background: fillGrad, transition: 'height 0.6s ease' }} />
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${mp}%`, background: 'var(--accent)', opacity: 0.7, transition: 'height 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{label.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 12 }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--primary)', borderRadius: 2, marginRight: 3 }} />수집</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--accent)', borderRadius: 2, marginRight: 3 }} />숙련</span>
            </div>
          </div>
        );
      })()}

      {/* 요주의 단어 TOP 5 */}
      {showHard && vocab.filter(v => (v.repetitions || 0) > 2).length > 0 && (
        <div className="card" >
          <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>🔥 요주의 단어 TOP 5</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...vocab]
              .filter(v => (v.repetitions || 0) > 0)
              .sort((a, b) => (b.repetitions || 0) - (a.repetitions || 0) || (a.interval ?? 0) - (b.interval ?? 0))
              .slice(0, 5)
              .map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: 70 }}>{v.word_text}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.meaning}</span>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: (v.repetitions || 0) > 4 ? 'var(--danger)' : 'var(--warning, #f59e0b)',
                    background: 'var(--bg-secondary)', borderRadius: 99, padding: '2px 8px', flexShrink: 0,
                  }}>
                    Again {v.repetitions ?? 0}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 기억 건강 리포트 */}
      {showMemory && vocab.length > 0 && (() => {
        const now = Date.now();
        const W = 500, H = 140, PAD = 40;
        const DAYS = 30;
        const retentionBuckets = { high: 0, mid: 0, low: 0, forgotten: 0 };
        let totalRetention = 0;
        vocab.forEach(v => {
          const lastReview = v.last_reviewed_at || v.created_at;
          const daysSince = (now - new Date(lastReview).getTime()) / (1000 * 60 * 60 * 24);
          const stability = Math.max(v.interval ?? 0.5, 0.5);
          const retention = Math.exp(-daysSince / (stability * 9));
          totalRetention += retention;
          if (retention >= 0.9) retentionBuckets.high++;
          else if (retention >= 0.7) retentionBuckets.mid++;
          else if (retention >= 0.4) retentionBuckets.low++;
          else retentionBuckets.forgotten++;
        });
        const avgRetention = Math.round((totalRetention / vocab.length) * 100);
        const avgStability = vocab.reduce((a, v) => a + Math.max(v.interval ?? 0.5, 0.5), 0) / vocab.length;
        const curvePoints = Array.from({ length: DAYS + 1 }, (_, i) => {
          const r = Math.exp(-i / (avgStability * 9)) * 100;
          return { x: PAD + (i / DAYS) * (W - PAD * 2), y: PAD + ((100 - r) / 100) * (H - PAD * 2), day: i, r: Math.round(r) };
        });
        const curveLine = curvePoints.map(p => `${p.x},${p.y}`).join(' ');
        return (
          <div className="card" >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem' }}>🧠 기억 건강</h3>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: avgRetention >= 80 ? 'var(--accent)' : avgRetention >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                유지율 {avgRetention}%
              </span>
            </div>
            <div className="retention-buckets">
              {[
                { label: '선명', count: retentionBuckets.high, color: 'var(--accent)', emoji: '🟢' },
                { label: '양호', count: retentionBuckets.mid, color: 'var(--primary-light)', emoji: '🔵' },
                { label: '흐릿', count: retentionBuckets.low, color: 'var(--warning)', emoji: '🟡' },
                { label: '위험', count: retentionBuckets.forgotten, color: 'var(--danger)', emoji: '🔴' },
              ].map(b => (
                <div key={b.label} className="retention-bucket">
                  <span style={{ fontSize: '0.75rem' }}>{b.emoji}</span>
                  <span className="retention-bucket__count" style={{ color: b.color }}>{b.count}</span>
                  <span className="retention-bucket__label">{b.label}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '14px 0 6px' }}>
              복습 안 하면? (망각 곡선 · 안정도 {avgStability.toFixed(1)}d 기준)
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
              {[90, 70, 50].map(r => {
                const y = PAD + ((100 - r) / 100) * (H - PAD * 2);
                return (
                  <g key={r}>
                    <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                    <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{r}%</text>
                  </g>
                );
              })}
              <polygon points={`${curvePoints[0].x},${H - PAD} ${curveLine} ${curvePoints[curvePoints.length-1].x},${H - PAD}`} fill="url(#forgetGrad)" />
              <defs>
                <linearGradient id="forgetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <polyline points={curveLine} fill="none" stroke="var(--primary-light)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {curvePoints.filter((_, i) => i === 0 || i === 7 || i === 14 || i === 30).map(p => (
                <g key={p.day}>
                  <circle cx={p.x} cy={p.y} r="4" fill={p.r >= 70 ? 'var(--accent)' : p.r >= 40 ? 'var(--warning)' : 'var(--danger)'} />
                  <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={p.r >= 70 ? 'var(--accent)' : p.r >= 40 ? 'var(--warning)' : 'var(--danger)'}>{p.r}%</text>
                  <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{p.day === 0 ? '오늘' : `${p.day}일 후`}</text>
                </g>
              ))}
            </svg>
          </div>
        );
      })()}

      {/* 향후 7일 복습 스케줄 */}
      {showMemory && <div className="card" >
        <h3 style={{ fontSize: '0.95rem', marginBottom: 16 }}>📅 복습 스케줄 (7일)</h3>
        <div className="forecast-chart">
          {[...Array(7)].map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const count = vocab.filter(v => new Date(v.next_review_at).toDateString() === date.toDateString()).length;
            const maxCount = Math.max(...[...Array(7)].map((_, k) => {
              const d = new Date(); d.setDate(d.getDate() + k);
              return vocab.filter(v => new Date(v.next_review_at).toDateString() === d.toDateString()).length;
            }), 1);
            return (
              <div key={i} className="forecast-col">
                <div className="forecast-bar" style={{
                  height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '0',
                  background: i === 0 ? 'var(--accent)' : 'var(--primary-light)',
                }} />
                <div className="forecast-label">{i === 0 ? '오늘' : `${date.getMonth()+1}/${date.getDate()}`}</div>
                {count > 0 && <div className="forecast-count">{count}</div>}
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
