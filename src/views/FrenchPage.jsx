import Link from 'next/link';
import { FR_LEVEL_META, ALL_CHAPTERS, getGrammarChapters, countVocab } from '../content/french';
import { CALLOUT_KINDS, LevelDot } from './frenchShared';

/**
 * 프랑스어 중추 레퍼런스 — 개요 페이지
 * 문법(A0→C2 학습 순서)과 어휘를 레벨별로 한눈에.
 */
export default function FrenchPage() {
  const totalChapters = ALL_CHAPTERS.length;
  const totalWords = FR_LEVEL_META.reduce((sum, m) => sum + countVocab(m.key), 0);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      {/* ── Hero ── */}
      <div className="guide-hero">
        <div className="guide-hero__icon">🇫🇷</div>
        <h1 className="guide-hero__title">
          프랑스어 레퍼런스
        </h1>
        <p className="guide-hero__sub">
          기초 상식(A0)부터 마스터(C2)까지 학습 순서대로 —
          문법 {totalChapters}챕터 · 어휘 {totalWords.toLocaleString()}단어
        </p>
      </div>

      {/* ── 이 레퍼런스의 약속 ── */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>
          🧭 한국어 화자를 위해 설계했어요
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          영어 어휘의 절반 가까이는 프랑스어·라틴어에서 온 말이에요.
          영어를 어느 정도 아는 분이라면 프랑스어 단어의 상당수를 이미 알고 시작하는 셈이죠.
          이 레퍼런스는 그 연결고리를 적극적으로 짚어주고,
          한국어에는 없는 개념(명사의 성, 관사…)은 한국인의 눈높이에서 풀어 설명해요.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(CALLOUT_KINDS).map(([key, k]) => (
            <span
              key={key}
              style={{
                fontSize: '0.78rem', color: 'var(--text-secondary)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)', padding: '4px 10px',
              }}
            >
              {k.icon} {k.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── 레벨별 섹션 ── */}
      {FR_LEVEL_META.map(meta => {
        const chapters = getGrammarChapters(meta.key);
        const wordCount = countVocab(meta.key);
        return (
          <section key={meta.key} className="card fr-level" style={{ borderTop: `3px solid ${meta.color}` }}>
            <div className="fr-level__head">
              <LevelDot meta={meta} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 className="fr-level__title">{meta.label}</h2>
                  <span
                    className="fr-level__focus"
                    style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.line}` }}
                  >
                    {meta.focus}
                  </span>
                </div>
                <p className="fr-level__desc">{meta.desc}</p>
              </div>
            </div>

            {/* 문법 챕터 목록 — 학습 순서 */}
            <ol className="fr-chapter-list">
              {chapters.map(ch => (
                <li key={ch.slug}>
                  <Link href={`/french/grammar/${ch.slug}`} className="fr-chapter-link">
                    <span className="fr-chapter-link__num" style={{ color: meta.color }}>
                      {String(ch.order).padStart(2, '0')}
                    </span>
                    <span className="fr-chapter-link__body">
                      <span className="fr-chapter-link__title">{ch.title}</span>
                      {ch.summary && <span className="fr-chapter-link__summary">{ch.summary}</span>}
                    </span>
                    {ch.duration && <span className="fr-chapter-link__meta">⏱ {ch.duration}</span>}
                  </Link>
                </li>
              ))}
            </ol>

            {wordCount > 0 && (
              <Link
                href={`/french/vocab/${meta.key.toLowerCase()}`}
                className="fr-vocab-link"
                style={{ color: meta.color }}
              >
                📖 {meta.label} 어휘 {wordCount}개 보기 →
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
