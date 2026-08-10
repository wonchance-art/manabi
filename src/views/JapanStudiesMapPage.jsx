'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { JAPAN_PATH, JP_VIEW, projectJp } from '../components/japanMapPaths';
import { JP_MAP_PINS, JP_MAP_THEMES } from '../content/studies/japanMapPins';

const THEME_BY_ID = Object.fromEntries(JP_MAP_THEMES.map((t) => [t.id, t]));

/**
 * 일본학 지도 — 심층 5문서의 장소를 테마 핀으로 탐색한다.
 * 지도(SVG)와 아래 목록은 같은 필터를 공유한다 — 목록은 지도 없이도 전부 접근
 * 가능한 대체 수단(키보드·스크린리더)이자 훑어보기 뷰다.
 */
export default function JapanStudiesMapPage() {
  const [theme, setTheme] = useState('all');
  const [activeId, setActiveId] = useState(null);

  const pins = useMemo(
    () => (theme === 'all' ? JP_MAP_PINS : JP_MAP_PINS.filter((p) => p.themes.includes(theme))),
    [theme]
  );
  const active = activeId ? JP_MAP_PINS.find((p) => p.id === activeId) : null;
  // 필터로 활성 핀이 사라지면 카드도 닫는다
  const activeVisible = active && pins.some((p) => p.id === active.id) ? active : null;

  const pinColor = (p) => THEME_BY_ID[theme === 'all' ? p.themes[0] : theme].color;

  return (
    <div className="page-container" style={{ maxWidth: 880 }}>
      <nav style={{ fontSize: '0.82rem', marginBottom: 12, opacity: 0.8 }}>
        <Link href="/studies">지역학</Link>{' / '}
        <Link href="/studies/japan">일본학</Link>{' / '}<span>지도</span>
      </nav>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: '0 0 6px' }}>일본학 지도</h1>
        <p style={{ margin: 0, opacity: 0.85, fontSize: '0.92rem', lineHeight: 1.6 }}>
          심층 문서 다섯 편의 장소들을 한 장에 — 테마를 고르고 핀을 눌러 보세요. 각 핀은 근거 문서로 이어져요.
        </p>
      </header>

      {/* 테마 필터 */}
      <div className="chip-group" role="group" aria-label="테마 필터" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip ${theme === 'all' ? 'chip--active' : ''}`}
          aria-pressed={theme === 'all'} onClick={() => setTheme('all')}>
          전체 {JP_MAP_PINS.length}
        </button>
        {JP_MAP_THEMES.map((t) => (
          <button key={t.id} type="button" className={`chip ${theme === t.id ? 'chip--active' : ''}`}
            aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: t.color, marginRight: 6 }} />
            {t.label} {JP_MAP_PINS.filter((p) => p.themes.includes(t.id)).length}
          </button>
        ))}
      </div>

      {/* 지도 + 선택 카드 */}
      <div className="jpmap-layout">
        <div className="card" style={{ padding: 10 }}>
          <svg viewBox={`0 0 ${JP_VIEW.w} ${JP_VIEW.h}`} role="img" aria-label="일본 지도 — 테마별 장소 핀"
            style={{ width: '100%', height: 'auto', display: 'block' }}>
            <path d={JAPAN_PATH} fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth="1.2" />
            {pins.map((p) => {
              const [x, y] = projectJp(p.lng, p.lat);
              const isActive = activeVisible?.id === p.id;
              return (
                <g key={p.id} transform={`translate(${x}, ${y})`}>
                  {isActive && <circle r="13" fill="none" stroke={pinColor(p)} strokeWidth="2" opacity="0.55" />}
                  <circle
                    r="8"
                    fill={pinColor(p)}
                    stroke="var(--bg-card)"
                    strokeWidth="1.5"
                    role="button"
                    tabIndex={0}
                    aria-label={`${p.name} — ${p.themes.map((t) => THEME_BY_ID[t].label).join('·')}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveId(isActive ? null : p.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setActiveId(isActive ? null : p.id))}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="card" style={{ padding: '14px 16px', alignSelf: 'start' }} aria-live="polite">
          {activeVisible ? (
            <>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{activeVisible.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 10px' }}>
                {activeVisible.themes.map((t) => (
                  <span key={t} className="chip" style={{ fontSize: '0.72rem', padding: '2px 10px' }}>
                    <span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: THEME_BY_ID[t].color, marginRight: 5 }} />
                    {THEME_BY_ID[t].label}
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                {activeVisible.desc}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {activeVisible.themes.map((t) => (
                  <Link key={t} href={`/studies/japan/${THEME_BY_ID[t].doc}`} prefetch={false}
                    style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-text)', display: 'inline-flex', alignItems: 'center', minHeight: 26 }}>
                    {THEME_BY_ID[t].label} 문서에서 읽기 →
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              핀을 누르면 장소 설명과 근거 문서가 여기에 떠요.
            </p>
          )}
        </aside>
      </div>

      {/* 목록 뷰 — 지도와 같은 필터, 전 항목 접근 가능한 대체 수단 */}
      <section className="fr-section" style={{ marginTop: 18 }} aria-label="장소 목록">
        <h2 className="fr-section__heading">목록으로 보기 ({pins.length})</h2>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pins.map((p) => (
            <li key={p.id} className="card" style={{ padding: '10px 14px' }}>
              <button type="button" onClick={() => setActiveId(p.id)} aria-pressed={activeVisible?.id === p.id}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%', color: 'inherit' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {p.themes.map((t) => (
                    <span key={t} aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: THEME_BY_ID[t].color, marginRight: 4 }} />
                  ))}
                  {' '}{p.name}
                </span>
                <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.55 }}>{p.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
