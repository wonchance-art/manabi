'use client';

import { useState } from 'react';
import { LEVELS, detectLang, langNameKo, profileLevel } from '../lib/constants';

/**
 * 급수별 누적 어휘 목표. 값은 우리가 정하는 게 아니라 **각 시험의 공표 수치**를 따른다
 * (JLPT·CEFR의 통용 어휘량, HSK는 공식 대강). 우리 콘텐츠 크기가 아니다 — 실측상
 * 영어 레지스트리는 1,382어인데 C2 목표는 10,000이다. 「알아야 할 양」이지 「우리가 가진 양」이 아니다.
 *
 * 중국어(2026-09-01 신설): **HSK 3.0 2026년 7월 시행본**의 누적 어휘 수다.
 * 2021년 초안(500·1,272·2,245·3,245·4,316·5,456)은 그 시행본으로 **대체됐으므로 쓰지 않는다.**
 * H6(5,400)이 우리 중국어 콘텐츠 누적(6,850어)보다 작은 것은 오류가 아니라 사실이다 —
 * HSK 6은 CEFR C2가 아니라 B2~C1 언저리라 사다리가 짧다.
 *
 * ⚠ **입문 급수(`OT 입문`·`A0 입문`)는 여기에 칸이 없다.** 그 구간의 목표는 「첫 급수 도달」
 * 이고, 별도 수를 지어내면 옆 칸과 같은 퍼센트를 그리는 빈 막대가 하나 는다.
 * 아래 `targetOf`가 라벨과 수를 **함께** 첫 급수로 넘긴다(예전에는 라벨만 「A0 입문」이고
 * 수는 A1의 500이라 어긋났다 — 프랑스어에서 실제로 그러고 있었다).
 * 급수가 늘거나 언어가 늘면 `vocabStatsLevels.test.js`가 먼저 걸린다.
 */
const LEVEL_MILESTONES = {
  Japanese: { 'N5 기초': 800, 'N4 기본': 1500, 'N3 중급': 3750, 'N2 상급': 6000, 'N1 심화': 10000 },
  English:  { 'A1 기초': 500, 'A2 초급': 1000, 'B1 중급': 2000, 'B2 상급': 4000, 'C1 고급': 7000, 'C2 마스터': 10000 },
  French:   { 'A1 기초': 500, 'A2 초급': 1000, 'B1 중급': 2000, 'B2 상급': 4000, 'C1 고급': 7000, 'C2 마스터': 10000 },
  Chinese:  { 'H1 기초': 300, 'H2 초급': 500, 'H3 중급': 1000, 'H4 상급': 2000, 'H5 고급': 3600, 'H6 마스터': 5400 },
};

/** 어휘 사다리에 칸이 없는 급수 — 값에 **왜 없는지**를 적는다(비워 두는 것이 기본값이다). */
const LADDER_EXEMPT = {
  'OT 입문': '오리엔테이션 — 어휘가 0개인 문법 구간이라 어휘 목표가 성립하지 않는다',
  'A0 입문': 'CEFR에 없는 우리 자체 입문 구간 — 공표 수치가 없다',
};

/** 목표 급수·수를 함께 고른다. 사다리에 없는 급수(입문)는 **첫 급수**로 넘긴다. */
function targetOf(lang, wanted) {
  const ladder = LEVEL_MILESTONES[lang] || {};
  const level = wanted && wanted in ladder ? wanted : Object.keys(ladder)[0];
  return { level, count: ladder[level] };
}

const LANG_META = {
  Japanese: { coverageTitle: 'JLPT 급수 커버리지', defaultTarget: 'N3 중급' },
  English:  { coverageTitle: 'CEFR 급수 커버리지', defaultTarget: 'B1 중급' },
  French:   { coverageTitle: 'CEFR 급수 커버리지', defaultTarget: 'B1 중급' },
  Chinese:  { coverageTitle: 'HSK 급수 커버리지',  defaultTarget: 'H3 중급' },
};

/** 언어별 막대 색. 삼항으로 두면 **다음 언어가 조용히 한쪽 가지로 떨어진다**(이 파일의 선례). */
const LANG_BAR = {
  Japanese: { solid: 'var(--primary-light)', grad: 'linear-gradient(180deg, var(--primary-light) 0%, var(--primary) 100%)' },
};
const DEFAULT_BAR = { solid: 'var(--accent)', grad: 'linear-gradient(180deg, var(--accent) 0%, var(--primary) 100%)' };

function getLangVocab(vocab, lang) {
  return vocab.filter(v => (v.language === lang) || (!v.language && detectLang(v.word_text) === lang));
}

function LangTabs({ activeLangs, current, onChange }) {
  if (activeLangs.length < 2) return null;
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)' }}>
      {activeLangs.map(lang => {
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
            {langNameKo(lang)}
          </button>
        );
      })}
    </div>
  );
}

// section prop: undefined = 전체, 'levels' = 진행도+커버리지, 'memory' = 기억건강+스케줄, 'hardwords' = 요주의
export default function VocabStats({ vocab, profile, section }) {
  const profileLangs = profile?.learning_language || [];
  // 언어 목록은 정본(`LEVELS`)에서 나온다 — 지역 목록을 또 만들면 언어가 늘 때마다 갈린다
  // (실측: 중국어가 이 하드코딩 하나 때문에 급수 진도를 못 보고 있었다).
  const activeLangs = Object.keys(LEVELS).filter(l =>
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
        const mastered = langVocab.filter(v => (v.interval ?? 0) >= 30).length;
        // 컬럼 선택은 정본으로 — 삼항 체인은 언어가 늘 때마다 마지막 가지가 오답이 된다.
        const { level: targetLevel, count: targetCount } =
          targetOf(effLevelLang, profileLevel(profile, effLevelLang) || meta.defaultTarget);
        const pct = Math.min(100, Math.round((total / targetCount) * 100));
        const bar = LANG_BAR[effLevelLang] || DEFAULT_BAR;
        const barColor = bar.solid;
        const levels = Object.entries(LEVEL_MILESTONES[effLevelLang]);
        const fillGrad = bar.grad;
        return (
          <div className="card" >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>어휘 레벨</h3>
              <LangTabs activeLangs={activeLangs} current={effLevelLang} onChange={setLevelLang} />
            </div>

            {/* 진행도 바 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>{targetLevel} — {total.toLocaleString('ko-KR')} / {targetCount.toLocaleString('ko-KR')}개</span>
              <span>{pct}%</span>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: 10, overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
            </div>

            {/* 커버리지 차트 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>{meta.coverageTitle}</h3>
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
      {showHard && vocab.filter(v => (v.repetitions || 0) >= 2).length > 0 && (
        <div className="card" >
          <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>요주의 단어 TOP 5</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...vocab]
              .filter(v => (v.repetitions || 0) >= 2)
              .sort((a, b) => (b.repetitions || 0) - (a.repetitions || 0) || (a.interval ?? 0) - (b.interval ?? 0))
              .slice(0, 5)
              .map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: 70 }}>{v.word_text}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.meaning}</span>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: (v.repetitions || 0) > 4 ? 'var(--danger)' : 'var(--warning)',
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
        return (
          <div className="card" >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem' }}>기억 건강</h3>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: avgRetention >= 80 ? 'var(--accent)' : avgRetention >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                유지율 {avgRetention}%
              </span>
            </div>
            <div className="retention-buckets">
              {[
                { label: '선명', count: retentionBuckets.high, color: 'var(--accent-text)', emoji: '●' },
                { label: '양호', count: retentionBuckets.mid, color: 'var(--primary-light)', emoji: '●' },
                { label: '흐릿', count: retentionBuckets.low, color: 'var(--warning)', emoji: '●' },
                { label: '위험', count: retentionBuckets.forgotten, color: 'var(--danger)', emoji: '●' },
              ].map(b => (
                <div key={b.label} className="retention-bucket">
                  <span style={{ fontSize: '0.75rem', color: b.color }}>{b.emoji}</span>
                  <span className="retention-bucket__count" style={{ color: b.color }}>{b.count}</span>
                  <span className="retention-bucket__label">{b.label}</span>
                </div>
              ))}
            </div>
            {(() => {
              return (
                <>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '16px 0 6px' }}>복습 스케줄</p>
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
                          <div className="forecast-count">{count > 0 ? count : '\u00A0'}</div>
                          <div className="forecast-bar-area">
                            <div className="forecast-bar" style={{
                              height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '2px',
                              background: count === 0 ? 'var(--border)' : i === 0 ? 'var(--accent)' : 'var(--primary-light)',
                            }} />
                          </div>
                          <div className="forecast-label">{i === 0 ? '오늘' : `${date.getMonth()+1}/${date.getDate()}`}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        );
      })()}

    </div>
  );
}
