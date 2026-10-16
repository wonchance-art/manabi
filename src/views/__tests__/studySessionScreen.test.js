import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// 계약: /study 진행 화면 — 문항 전환 효과와 진행 막대(STUDY-SESSION 점검 2026-10-17).
const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const session = read('src/views/StudySessionPage.jsx');
const css = read('src/index.css');
const rule = (selector) => css.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] || '';

describe('문항 전환', () => {
  it('문항 래퍼는 uid마다 새로 그려진다(key) — 문항 블록 전부와 계속 버튼을 감싼다', () => {
    const open = session.indexOf('<div key={item.uid} className="study-item">');
    expect(open).toBeGreaterThan(0);
    const body = session.slice(open);
    // 첫 블록(다시 도전)부터 계속 버튼까지 래퍼 안, 언어 전환은 밖.
    expect(body.indexOf('{isRetry && (')).toBeLessThan(body.indexOf("{idx + 1 >= queue.length ? '결과 보기 →' : '계속 →'}"));
    const close = body.indexOf('      </div>\n\n      {/* 언어 전환');
    expect(close).toBeGreaterThan(body.indexOf("'계속 →'"));
  });

  it('0.16초 · opacity + translateY(4px) · --ease-settle, 모션 축소 블록에서 끈다', () => {
    expect(rule('.study-item')).toContain('animation: settleIn 0.16s var(--ease-settle) both;');
    const keyframes = css.match(/@keyframes settleIn \{([\s\S]*?)\n\}/)?.[1] || '';
    expect(keyframes).toContain('opacity: 0; transform: translateY(4px);');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.study-progress__fill \{ transition: none; \}\s*\.study-item \{ animation: none; \}\s*\}/);
  });
});

describe('진행 막대', () => {
  it('인라인 style 대신 클래스 — 폭만 값으로 넘긴다', () => {
    expect(session).toContain('<div className="study-progress__fill" style={{ width: `${progressPct}%` }} />');
    expect(session).not.toContain("background: 'var(--accent)',\n            width: `${progressPct}%`");
    expect(rule('.study-progress')).toContain('background: var(--bg-secondary);');
    expect(rule('.study-progress__fill')).toContain('background: var(--accent);');
  });

  it('progressbar 역할과 aria-valuemin · max · now(+ 문항 수 읽기)', () => {
    expect(session).toMatch(/className="study-progress" role="progressbar" aria-label="세션 진행" aria-valuemin=\{0\} aria-valuemax=\{100\} aria-valuenow=\{progressPct\}\s*aria-valuetext=\{`\$\{progressDone\}\/\$\{progressTotal\}`\}/);
  });
});
