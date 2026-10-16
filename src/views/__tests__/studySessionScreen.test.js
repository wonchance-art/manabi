import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

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

describe('로그아웃 · 계정 바뀜 감지', () => {
  const studyRoute = read('src/app/(app)/study/page.jsx');

  it('세션 계정은 서버가 확인한 사용자로 시작할 때 고정한다', () => {
    expect(studyRoute).toContain('sessionUserId={user.id}');
    expect(session).toContain('const sessionUserRef = useRef(sessionUserId || null);');
    expect(session).toContain('const authLost = !!sessionUserRef.current && !authLoading && user?.id !== sessionUserRef.current;');
    expect(session).toContain('recorderRef.current = authLost ? null : sessionUserRef.current;');
  });

  it('기록하는 곳은 세션 계정(recorder)만 쓴다 — 로그아웃이면 아무것도 쓰지 않는다(기기 로컬로 새지 않게)', () => {
    const settle = session.match(/function recordSettle\(ok, it, result = null, response = null\) \{[\s\S]*?\n {2}\}/)?.[0];
    expect(settle).toMatch(/const recorder = recorderRef\.current;\s*if \(!recorder\) return;/);
    expect(settle).toContain('recordStudyReviewCompleted(recorder, {');
    expect(settle).not.toMatch(/user\?\.id|user\.id/);
    const fire = session.match(/function fireEffects\(\) \{[\s\S]*?\n {2}\}/)?.[0];
    expect(fire).toMatch(/const recorder = recorderRef\.current;\s*if \(effectsFired\.current \|\| !recorder\) return;/);
    expect(fire).not.toMatch(/user\?\.id|user\.id/);
    expect(session).toMatch(/function getBatcher\(\) \{\s*const recorder = recorderRef\.current;\s*if \(!recorder\) return null;/);
    // 기록 경로(담기 · 산출 · 문법 재시도 · 스트릭)에 user.id가 남지 않는다 — 읽기 전용 효과(예고 · 주간 회고 · 푸시)만 남는다.
    for (const head of ['async function saveEncounterWord', 'async function saveUserNext', 'function retryPendingGrammar', 'function onPageHide']) {
      expect(sliceBetween(session, head, '\n  }'), head).not.toMatch(/user\?\.id|user\.id/);
    }
  });

  it('상단 안내는 copy-standard 「로그인이 필요해요」 + 「로그인」 버튼(authEntryHref) — 진행 · 결과 화면 둘 다', () => {
    expect(session).toMatch(/const authBanner = authLost && \(\s*<div className="study-auth-lost" role="alert">\s*<span>로그인이 필요해요<\/span>\s*<Link href=\{signInHref\} className="btn btn--primary btn--sm">로그인<\/Link>/);
    expect(session).toContain('const signInHref = authEntryHref(usePathname());');
    expect(session.match(/\{authBanner\}/g)).toHaveLength(2);
  });

  it('큐에도 못 담은 문항에만 인라인 한 줄', () => {
    expect(session).toContain('if (saved?.lost) setLostRecordUid(orig);');
    expect(session).toMatch(/phase === 'feedback' && lostRecordUid === baseUid\(item\.uid\) && \(\s*<p className="study-record-lost" role="status">이 문항 기록을 저장하지 못했어요\. 세션은 계속할 수 있어요\.<\/p>/);
  });
});
