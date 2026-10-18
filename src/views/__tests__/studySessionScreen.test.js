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
    const open = session.indexOf('<div key={item.uid} ref={itemRef} className="study-item">'); // ref = 새 문항 첫 답 컨트롤로 초점(STUDY-FOCUS-001)
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
    const settle = sliceBetween(session, 'function recordSettle(ok, it, result = null, response = null) {', '\n  }\n');
    expect(settle).toMatch(/const recorder = recorderRef\.current;\s*if \(!recorder\) \{ heldSettlesRef\.current\.push\(entry\); return; \}\s*writeSettle\(recorder, entry\);/);
    const write = sliceBetween(session, 'function writeSettle(recorder,', '\n  }\n');
    expect(write).toContain('recordStudyReviewCompleted(recorder, {');
    for (const body of [settle, write, sliceBetween(session, 'function tallyGrammar(ok, it) {', '\n  }\n')]) {
      expect(body).not.toMatch(/user\?\.id|user\.id/);
    }
    const fire = sliceBetween(session, 'function fireEffects() {', '\n  }\n');
    expect(fire).toMatch(/const recorder = recorderRef\.current;\s*if \(effectsFired\.current\) return;[\s\S]*?if \(!recorder\) \{ effectsHeldRef\.current = true; return; \}\s*effectsFired\.current = true;/);
    expect(fire).not.toMatch(/user\?\.id|user\.id/);
    expect(session).toMatch(/function getBatcher\(\) \{\s*const recorder = recorderRef\.current;[^\n]*\n[^\n]*\n\s*if \(!recorder\) return sessionUserRef\.current \? heldEventsBox : null;/);
    // 기록 경로(담기 · 산출 · 문법 재시도 · keepalive · 스트릭)에 user.id가 남지 않는다 — 읽기 전용 효과(예고 · 주간 회고 · 푸시)만 남는다.
    for (const head of ['async function saveEncounterWord', 'async function saveUserNext', 'function retryPendingGrammar',
      'function rememberGrammarToken', 'function beaconPendingGrammar', 'function onPageHide']) {
      expect(sliceBetween(session, head, '\n  }'), head).not.toMatch(/user\?\.id|user\.id/);
    }
  });

  it('로그인이 풀린 동안 확정한 문항도 문법 챕터 누적은 먼저 센다(기록 확인보다 앞)', () => {
    const settle = sliceBetween(session, 'function recordSettle(ok, it, result = null, response = null) {', '\n  }\n');
    expect(settle).toContain('chapter: tallyGrammar(ok, it)');
    expect(settle.indexOf('tallyGrammar(ok, it)')).toBeLessThan(settle.indexOf('if (!recorder)'));
    const tally = sliceBetween(session, 'function tallyGrammar(ok, it) {', '\n  }\n');
    expect(tally).toContain('agg.total++; if (ok) agg.right++;');
    expect(tally).not.toContain('recorder');
  });

  it('같은 세션 계정이 돌아오면 멈춰 둔 기록 · 이벤트 · 종료 이펙트를 그 계정에 보낸다(다른 계정은 recorder가 null이라 오지 않는다)', () => {
    const back = sliceBetween(session, '// ── 로그인이 풀렸다가 같은 세션 계정이 돌아왔다', '}, [authLost]);');
    expect(back).toMatch(/const recorder = recorderRef\.current;\s*if \(authLost \|\| !recorder\) return;/);
    expect(back).toContain('for (const entry of heldSettlesRef.current.splice(0)) writeSettle(recorder, entry);');
    expect(back).toContain('const events = heldEventsRef.current.splice(0);');
    expect(back).toContain('if (effectsHeldRef.current) { effectsHeldRef.current = false; fireEffects(); }');
    // 순서: 문항 기록(문법 보류함 제출 포함) → 종료 이펙트(문법 재시도 · flush)
    expect(back.indexOf('writeSettle(recorder, entry)')).toBeLessThan(back.indexOf('fireEffects()'));
    expect(back).not.toMatch(/user\?\.id|user\.id/);
    // recorder는 세션 계정이 아니면 null — 다른 계정의 id가 기록 주체가 될 길이 없다.
    expect(session).toContain('recorderRef.current = authLost ? null : sessionUserRef.current;');
  });

  it('pagehide는 세션 계정일 때만 flush한다 — 계정이 바뀐 뒤 A의 이벤트를 B의 토큰으로 보내지 않는다', () => {
    const hide = sliceBetween(session, 'function onPageHide() {', "window.addEventListener('pagehide', onPageHide);");
    expect(hide).toMatch(/const recorder = recorderRef\.current;\s*if \(!recorder\) return;\s*batcherRef\.current\?\.flush\(\);/);
  });

  it('SDK를 못 받아 user가 빈 것은 로그아웃으로 굳히지 않는다 — 연결이 돌아오거나 잠시 뒤 세션을 다시 복원한다', () => {
    const auth = read('src/lib/AuthContext.jsx');
    const restore = sliceBetween(auth, 'const restore = () => {', 'return () => {');
    // 다시 해 볼 차례가 남았으면 loading을 내리지 않는다(확인 중) — 차례를 다 쓴 뒤에만 확정(병합 전 교차 리뷰 S1).
    expect(restore).toMatch(/\.catch\(\(\) => \{\s*if \(cancelled\) return;(?:\s*\/\/[^\n]*)*\s*if \(!restored && retries < AUTH_RESTORE_RETRY_MS\.length\) \{ retryTimer = setTimeout\(restore, AUTH_RESTORE_RETRY_MS\[retries\+\+\]\); return; \}\s*setLoading\(false\);/);
    expect(restore).toContain("window.addEventListener('online', restore);");
    expect(restore).toContain("window.removeEventListener('online', restore);");
    expect(auth).toContain('const AUTH_RESTORE_RETRY_MS = [2000, 8000, 30000];');
  });

  it('상단 안내는 copy-standard 「로그인이 필요해요」 + 「로그인」 버튼(authEntryHref) — 진행 · 결과 화면 둘 다', () => {
    expect(session).toMatch(/const authBanner = authLost && \(\s*<div className="study-auth-lost" role="alert">\s*<span>로그인이 필요해요<\/span>\s*<Link href=\{signInHref\} className="btn btn--primary btn--sm">로그인<\/Link>/);
    expect(session).toContain('const signInHref = authEntryHref(usePathname());');
    expect(session.match(/\{authBanner\}/g)).toHaveLength(2);
  });

  it('큐에도 못 담은 문항에만 인라인 한 줄 — 첫 시도 uid로(재출제 -r에는 다시 띄우지 않는다), 알림 영역은 먼저 그려 둔다', () => {
    expect(session).toContain('if (saved?.lost) setLostRecordUid(it.uid);');
    expect(session).toMatch(/<div role="status" aria-live="polite">\s*\{phase === 'feedback' && lostRecordUid === item\.uid && \(\s*<p className="study-record-lost">이 문항 기록을 저장하지 못했어요\. 세션은 계속할 수 있어요\.<\/p>\s*\)\}\s*<\/div>/);
    expect(session).not.toContain('lostRecordUid === baseUid(');
    expect(session).not.toContain('<p className="study-record-lost" role="status">');
  });

  it('게스트는 기록 경로를 지나지 않는다 — 옛 주석(「게스트도 같은 호출」)을 남기지 않는다', () => {
    expect(session).not.toContain('게스트도 같은 호출');
  });
});
