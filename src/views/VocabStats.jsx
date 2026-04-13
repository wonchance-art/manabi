const LEVEL_MILESTONES = {
  Japanese: { 'N5 기초': 800, 'N4 기본': 1500, 'N3 중급': 3750, 'N2 상급': 6000, 'N1 심화': 10000 },
  English:  { 'A1 기초': 500, 'A2 초급': 1000, 'B1 중급': 2000, 'B2 상급': 4000, 'C1 고급': 7000, 'C2 마스터': 10000 },
};

import { detectLang } from '../lib/constants';

export default function VocabStats({ vocab, profile }) {
  return (
    <div className="stats-grid">
      {/* 레벨 진행도 */}
      {(() => {
        const langs = profile?.learning_language || [];
        const cards = [];

        if (langs.includes('Japanese') || vocab.some(v => (v.language === 'Japanese') || detectLang(v.word_text) === 'Japanese')) {
          const jpVocab = vocab.filter(v => (v.language === 'Japanese') || (!v.language && detectLang(v.word_text) === 'Japanese'));
          const targetLevel = profile?.learning_level_japanese || 'N3 중급';
          const target = LEVEL_MILESTONES.Japanese[targetLevel] || 3750;
          const pct = Math.min(100, Math.round((jpVocab.length / target) * 100));
          cards.push(
            <div key="jp" className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem' }}>🇯🇵 일본어 레벨 진행도 — {targetLevel}</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{jpVocab.length} / {target.toLocaleString('ko-KR')}개</span>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary-light)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>{pct}% 달성</span>
                <span>목표까지 {Math.max(0, target - jpVocab.length).toLocaleString('ko-KR')}개 남음</span>
              </div>
            </div>
          );
        }

        // JLPT 급수별 계단식 진행도 (일본어)
        if (langs.includes('Japanese') || vocab.some(v => (v.language === 'Japanese') || detectLang(v.word_text) === 'Japanese')) {
          const jpVocab = vocab.filter(v => (v.language === 'Japanese') || (!v.language && detectLang(v.word_text) === 'Japanese'));
          const totalJp = jpVocab.length;
          const masteredJp = jpVocab.filter(v => (v.interval ?? 0) >= 14).length;
          const levels = Object.entries(LEVEL_MILESTONES.Japanese);
          cards.push(
            <div key="jp-stairs" className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem' }}>🇯🇵 JLPT 급수 커버리지</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  수집 {totalJp}개 · 숙련 {masteredJp}개
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120, padding: '8px 0' }}>
                {levels.map(([label, target], i) => {
                  const pct = Math.min(100, (totalJp / target) * 100);
                  const masteredPct = Math.min(100, (masteredJp / target) * 100);
                  const reached = totalJp >= target;
                  const grad = `linear-gradient(180deg, var(--primary-light) 0%, var(--primary) 100%)`;
                  return (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        color: reached ? 'var(--accent)' : 'var(--text-muted)'
                      }}>{reached ? '✓' : `${Math.round(pct)}%`}</span>
                      <div style={{
                        width: '100%', height: 70,
                        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, bottom: 0,
                          height: `${pct}%`, background: grad, transition: 'height 0.6s ease',
                        }} />
                        <div style={{
                          position: 'absolute', left: 0, right: 0, bottom: 0,
                          height: `${masteredPct}%`, background: 'var(--accent)',
                          opacity: 0.7, transition: 'height 0.6s ease',
                        }} title={`숙련 ${masteredJp}/${target}`} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {label.split(' ')[0]}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {target.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 12 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary)', borderRadius: 2, marginRight: 4 }} />수집</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent)', borderRadius: 2, marginRight: 4 }} />숙련 (안정도 14일+)</span>
              </div>
            </div>
          );
        }

        // CEFR 급수별 계단식 진행도 (영어)
        if (langs.includes('English') || vocab.some(v => (v.language === 'English') || (!v.language && detectLang(v.word_text) === 'English'))) {
          const enVocab = vocab.filter(v => (v.language === 'English') || (!v.language && detectLang(v.word_text) === 'English'));
          const totalEn = enVocab.length;
          const masteredEn = enVocab.filter(v => (v.interval ?? 0) >= 14).length;
          const levels = Object.entries(LEVEL_MILESTONES.English);
          cards.push(
            <div key="en-stairs" className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem' }}>🇬🇧 CEFR 급수 커버리지</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  수집 {totalEn}개 · 숙련 {masteredEn}개
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120, padding: '8px 0' }}>
                {levels.map(([label, target]) => {
                  const pct = Math.min(100, (totalEn / target) * 100);
                  const masteredPct = Math.min(100, (masteredEn / target) * 100);
                  const reached = totalEn >= target;
                  return (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: reached ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {reached ? '✓' : `${Math.round(pct)}%`}
                      </span>
                      <div style={{ width: '100%', height: 70, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, bottom: 0,
                          height: `${pct}%`,
                          background: 'linear-gradient(180deg, var(--accent) 0%, var(--primary) 100%)',
                          transition: 'height 0.6s ease',
                        }} />
                        <div style={{
                          position: 'absolute', left: 0, right: 0, bottom: 0,
                          height: `${masteredPct}%`, background: 'var(--accent)',
                          opacity: 0.8, transition: 'height 0.6s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{label.split(' ')[0]}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {target.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        if (langs.includes('English') || vocab.some(v => (v.language === 'English') || (!v.language && detectLang(v.word_text) === 'English'))) {
          const enVocab = vocab.filter(v => (v.language === 'English') || (!v.language && detectLang(v.word_text) === 'English'));
          const targetLevel = profile?.learning_level_english || 'B1 중급';
          const target = LEVEL_MILESTONES.English[targetLevel] || 2000;
          const pct = Math.min(100, Math.round((enVocab.length / target) * 100));
          cards.push(
            <div key="en" className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem' }}>🇬🇧 영어 레벨 진행도 — {targetLevel}</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{enVocab.length} / {target.toLocaleString('ko-KR')}개</span>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>{pct}% 달성</span>
                <span>목표까지 {Math.max(0, target - enVocab.length).toLocaleString('ko-KR')}개 남음</span>
              </div>
            </div>
          );
        }

        return cards.length > 0 ? cards : null;
      })()}

      <div className="stat-card">
        <div className="stat-card__label">전체 어휘 수</div>
        <div className="stat-card__value stat-card__value--primary">{vocab.length}</div>
        <div className="stat-card__sub">꾸준히 늘려가고 있어요!</div>
      </div>
      <div className="stat-card">
        <div className="stat-card__label">마스터한 어휘</div>
        <div className="stat-card__value stat-card__value--accent">{vocab.filter(v => v.interval > 14).length}</div>
        <div className="stat-card__sub">안정도(S)가 14일 이상인 단어</div>
      </div>
      <div className="stat-card">
        <div className="stat-card__label">기억 건강도</div>
        <div className="stat-card__value stat-card__value--green">
          {vocab.length > 0 ? (vocab.reduce((acc, curr) => acc + (curr.interval ?? 0), 0) / vocab.length).toFixed(1) : 0}d
        </div>
        <div className="stat-card__sub">평균 기억 안정도</div>
      </div>
      <div className="stat-card">
        <div className="stat-card__label">총 실수 횟수</div>
        <div className="stat-card__value" style={{ color: 'var(--danger)' }}>
          {vocab.reduce((acc, curr) => acc + (curr.repetitions || 0), 0)}
        </div>
        <div className="stat-card__sub">Again 누적 횟수</div>
      </div>
      <div className="stat-card">
        <div className="stat-card__label">어려운 단어</div>
        <div className="stat-card__value" style={{ color: 'var(--warning, #f59e0b)' }}>
          {vocab.filter(v => (v.repetitions || 0) > 2).length}
        </div>
        <div className="stat-card__sub">3번 이상 틀린 단어</div>
      </div>

      {/* Hard Words List */}
      {vocab.filter(v => (v.repetitions || 0) > 2).length > 0 && (
        <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>🔥 요주의 단어 TOP 5</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...vocab]
              .filter(v => (v.repetitions || 0) > 0)
              .sort((a, b) => (b.repetitions || 0) - (a.repetitions || 0) || (a.interval ?? 0) - (b.interval ?? 0))
              .slice(0, 5)
              .map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: '80px' }}>{v.word_text}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>{v.meaning}</span>
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600,
                    color: (v.repetitions || 0) > 4 ? 'var(--danger)' : 'var(--warning, #f59e0b)',
                    background: 'var(--bg-secondary)', borderRadius: '99px', padding: '2px 10px'
                  }}>
                    Again {v.repetitions ?? 0}회
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>안정도 {(v.interval ?? 0).toFixed(1)}d</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Difficulty Distribution */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>📊 난이도 분포</h3>
        {(() => {
          const easy = vocab.filter(v => (v.ease_factor || 0) < 4).length;
          const medium = vocab.filter(v => (v.ease_factor || 0) >= 4 && (v.ease_factor || 0) <= 7).length;
          const hard = vocab.filter(v => (v.ease_factor || 0) > 7).length;
          const total = vocab.length || 1;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: '쉬움', count: easy, color: 'var(--primary)' },
                { label: '보통', count: medium, color: 'var(--accent)' },
                { label: '어려움', count: hard, color: 'var(--danger)' },
              ].map(({ label, count, color }) => (
                <div key={label} className="pos-row">
                  <div className="pos-row__label">{label}</div>
                  <div className="pos-row__bar-wrap">
                    <div className="pos-row__bar" style={{ width: `${(count / total) * 100}%`, background: color }} />
                  </div>
                  <div className="pos-row__pct">{count}개</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 망각 곡선 시뮬레이션 */}
      {vocab.length > 0 && (() => {
        const now = Date.now();
        const W = 500, H = 140, PAD = 40;
        const DAYS = 30;

        // 각 단어의 현재 기억 유지율 추정 (FSRS 기반)
        // R(t) = e^(-t / (S * 9))  where S = interval (stability), t = days since last review
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

        // Forgetting curve: average retention over next 30 days if no review
        const avgStability = vocab.reduce((a, v) => a + Math.max(v.interval ?? 0.5, 0.5), 0) / vocab.length;
        const curvePoints = Array.from({ length: DAYS + 1 }, (_, i) => {
          const r = Math.exp(-i / (avgStability * 9)) * 100;
          return {
            x: PAD + (i / DAYS) * (W - PAD * 2),
            y: PAD + ((100 - r) / 100) * (H - PAD * 2),
            day: i,
            r: Math.round(r),
          };
        });
        const curveLine = curvePoints.map(p => `${p.x},${p.y}`).join(' ');

        return (
          <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>🧠 기억 건강 리포트</h3>
              <span style={{ fontSize: '0.82rem', color: avgRetention >= 80 ? 'var(--accent)' : avgRetention >= 50 ? 'var(--warning)' : 'var(--danger)', fontWeight: 700 }}>
                평균 기억 유지율 {avgRetention}%
              </span>
            </div>

            {/* Retention buckets */}
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

            {/* Forgetting curve SVG */}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              복습하지 않으면? (평균 망각 곡선)
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
              {/* Grid lines */}
              {[90, 70, 50, 30].map(r => {
                const y = PAD + ((100 - r) / 100) * (H - PAD * 2);
                return (
                  <g key={r}>
                    <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                    <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{r}%</text>
                  </g>
                );
              })}
              {/* Danger zone fill */}
              <rect x={PAD} y={PAD + ((100 - 50) / 100) * (H - PAD * 2)} width={W - PAD * 2} height={(50 / 100) * (H - PAD * 2)} fill="rgba(255,107,107,0.05)" rx="4" />
              {/* Curve fill */}
              <polygon
                points={`${curvePoints[0].x},${H - PAD} ${curveLine} ${curvePoints[curvePoints.length-1].x},${H - PAD}`}
                fill="url(#forgetGrad)"
              />
              <defs>
                <linearGradient id="forgetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              {/* Curve line */}
              <polyline points={curveLine} fill="none" stroke="var(--primary-light)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {/* Key points */}
              {curvePoints.filter((_, i) => i === 0 || i === 7 || i === 14 || i === 30).map(p => (
                <g key={p.day}>
                  <circle cx={p.x} cy={p.y} r="4" fill={p.r >= 70 ? 'var(--accent)' : p.r >= 40 ? 'var(--warning)' : 'var(--danger)'} />
                  <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="700"
                    fill={p.r >= 70 ? 'var(--accent)' : p.r >= 40 ? 'var(--warning)' : 'var(--danger)'}
                  >{p.r}%</text>
                  <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                    {p.day === 0 ? '오늘' : `${p.day}일 후`}
                  </text>
                </g>
              ))}
            </svg>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.5 }}>
              평균 안정도 {avgStability.toFixed(1)}일 기준. 꾸준한 복습이 기억 유지의 핵심이에요.
            </p>
          </div>
        );
      })()}

      {/* 주간 학습 리포트 */}
      {vocab.length > 0 && (() => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartISO = weekStart.toISOString();

        const weekNew = vocab.filter(v => v.created_at >= weekStartISO).length;
        const weekReviewed = vocab.filter(v => v.last_reviewed_at && v.last_reviewed_at >= weekStartISO).length;
        const weekMastered = vocab.filter(v => v.interval >= 30 && v.last_reviewed_at >= weekStartISO).length;
        const avgInterval = vocab.length > 0 ? vocab.reduce((a, v) => a + (v.interval ?? 0), 0) / vocab.length : 0;

        // 지난 주 대비 (대략적)
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        const prevWeekISO = prevWeekStart.toISOString();
        const prevWeekNew = vocab.filter(v => v.created_at >= prevWeekISO && v.created_at < weekStartISO).length;
        const newDiff = weekNew - prevWeekNew;

        return (
          <div className="card weekly-report" style={{ padding: '24px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>📋 이번 주 리포트</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                최근 7일
              </span>
            </div>
            <div className="weekly-report__grid">
              <div className="weekly-report__item">
                <span className="weekly-report__icon">⭐</span>
                <span className="weekly-report__value">{weekNew}</span>
                <span className="weekly-report__label">새 단어</span>
                {newDiff !== 0 && (
                  <span className={`weekly-report__diff ${newDiff > 0 ? 'weekly-report__diff--up' : 'weekly-report__diff--down'}`}>
                    {newDiff > 0 ? `+${newDiff}` : newDiff} vs 지난주
                  </span>
                )}
              </div>
              <div className="weekly-report__item">
                <span className="weekly-report__icon">🧠</span>
                <span className="weekly-report__value">{weekReviewed}</span>
                <span className="weekly-report__label">복습 완료</span>
              </div>
              <div className="weekly-report__item">
                <span className="weekly-report__icon">🏅</span>
                <span className="weekly-report__value">{weekMastered}</span>
                <span className="weekly-report__label">새로 숙련</span>
              </div>
              <div className="weekly-report__item">
                <span className="weekly-report__icon">📊</span>
                <span className="weekly-report__value">{avgInterval.toFixed(1)}d</span>
                <span className="weekly-report__label">평균 안정도</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 어휘 성장 그래프 */}
      {vocab.length > 0 && (() => {
        const WEEKS = 8;
        const now = new Date();
        const weekData = Array.from({ length: WEEKS }, (_, i) => {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (WEEKS - 1 - i) * 7 - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);
          const count = vocab.filter(v => {
            const d = new Date(v.created_at);
            return d >= weekStart && d < weekEnd;
          }).length;
          const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
          return { label, count };
        });

        const maxVal = Math.max(...weekData.map(w => w.count), 1);
        const W = 500, H = 120, PAD = 32;
        const stepX = (W - PAD * 2) / (WEEKS - 1);
        const points = weekData.map((w, i) => ({
          x: PAD + i * stepX,
          y: PAD + (1 - w.count / maxVal) * (H - PAD * 2),
          ...w,
        }));
        const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
        const totalNew = weekData.reduce((s, w) => s + w.count, 0);

        return (
          <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>📈 어휘 성장 추이</h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>최근 8주 +{totalNew}개</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
              {[0.25, 0.5, 0.75, 1].map(r => (
                <line key={r}
                  x1={PAD} y1={PAD + (1 - r) * (H - PAD * 2)}
                  x2={W - PAD} y2={PAD + (1 - r) * (H - PAD * 2)}
                  stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4"
                />
              ))}
              <polygon
                points={`${points[0].x},${H - PAD} ${polyline} ${points[points.length-1].x},${H - PAD}`}
                fill="var(--primary-glow)"
              />
              <polyline points={polyline} fill="none" stroke="var(--primary-light)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4" fill="var(--primary-light)" />
                  {p.count > 0 && (
                    <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="var(--primary-light)" fontWeight="700">{p.count}</text>
                  )}
                  <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{p.label}</text>
                </g>
              ))}
            </svg>
          </div>
        );
      })()}

      {/* Forecast Chart */}
      <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>향후 7일 복습 스케줄</h3>
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
                <div
                  className="forecast-bar"
                  style={{
                    height: `${(count / maxCount) * 100}%`,
                    minHeight: count > 0 ? '4px' : '0',
                    background: i === 0 ? 'var(--accent)' : 'var(--primary-light)',
                  }}
                />
                <div className="forecast-label">{i === 0 ? '오늘' : `${date.getMonth()+1}/${date.getDate()}`}</div>
                {count > 0 && <div className="forecast-count">{count}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* POS Distribution */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>🏷️ 어휘 구성</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(
            vocab.reduce((acc, curr) => { acc[curr.pos] = (acc[curr.pos] || 0) + 1; return acc; }, {})
          ).map(([pos, count]) => (
            <div key={pos} className="pos-row">
              <div className="pos-row__label">{pos || '기타'}</div>
              <div className="pos-row__bar-wrap">
                <div className="pos-row__bar" style={{ width: `${(count / vocab.length) * 100}%` }} />
              </div>
              <div className="pos-row__pct">{((count / vocab.length) * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Goal */}
      <div className="card stat-card stat-card--goal">
        <h3 style={{ fontSize: '1.1rem', alignSelf: 'flex-start' }}>🎯 오늘의 목표</h3>
        <div className="goal-ring-wrap">
          <svg width="120" height="120" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-secondary)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="10"
              strokeDasharray={`${Math.min(100, (vocab.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString()).length / 5) * 100) * 2.82} 282`}
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div className="goal-ring-label">
            <div className="goal-ring-label__count">
              {vocab.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString()).length}
            </div>
            <div className="goal-ring-label__sub">목표 5개</div>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          오늘 수집한 새로운 단어
        </p>
      </div>
    </div>
  );
}
