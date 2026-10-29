import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 손님 AI 기능 → 로그인 안내(목업 viewer-audit §1 · 오너 「결정사안은 권장대로」 2026-10-17 KST).
// 손님에게 AI는 서버가 401로 막는다(/api/gemini 「로그인이 필요해요」). 화면은 실패처럼 보였고 「다시 시도」는 영원히 실패했다.
// 번역 칸의 SENTENCE_TX_LOGIN_REQUIRED 방식대로: 손님 = 요청 0 + 제자리 복귀 로그인 링크, 회원 = 기존 동작 그대로.

const auth = { user: null, loading: false };
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
const callGemini = vi.fn();
vi.mock('../../lib/gemini', () => ({ callGemini }));

const { default: ReadingTest, READING_TEST_GUEST_LABEL } = await import('../../components/ReadingTest.jsx');
const { t } = await import('../../lib/viewerMessages.js');

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const readingTest = read('src/components/ReadingTest.jsx');

const WORD_COPY = '로그인하면 비슷한 말과 자세한 설명을 볼 수 있어요 →';
const TEST_COPY = '로그인하면 문제를 만들어 드려요 →';
const HREF = '/auth?from=%2Fviewer%2Fm1%3Fp%3D3';

const render = (props = {}) => renderToStaticMarkup(createElement(ReadingTest, {
  rawText: '本文です。', language: 'Japanese', materialId: 'm1', onClose: () => {}, inline: true, ...props,
}));

describe('읽기 확인 · 리딩 테스트 — 손님은 문제를 만들지 않고 로그인 안내', () => {
  beforeEach(() => { auth.user = null; auth.loading = false; callGemini.mockClear(); });

  it('손님: 로그인 링크(넘겨받은 제자리 복귀 주소 · 화면 문구) — 「시작하기」 「다시 시도」 버튼 0, 요청 0', () => {
    const html = render({ signInHref: HREF, signInLabel: TEST_COPY });
    expect(html).toContain(`<a class="reading-test__login" href="${HREF.replace(/&/g, '&amp;')}">${TEST_COPY}</a>`);
    expect(html).not.toMatch(/<button\b/);
    expect(html).not.toContain('시작하기');
    expect(html).not.toContain('다시 시도');
    expect(html).toContain('방금 읽은 글의 내용을 다섯 문제로 확인해요.');
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('손님 기본값: 문구는 목업 그대로, 주소는 authEntryHref(제자리 복귀)', () => {
    expect(READING_TEST_GUEST_LABEL).toBe(TEST_COPY);
    const html = render();
    expect(html).toContain(TEST_COPY);
    expect(html).toMatch(/class="reading-test__login" href="\/auth\?from=/);
  });

  it('로그인 확인 중(loading): 버튼도 안내도 두지 않는다 — 손님 요청이 새지 않고, 회원에게 안내가 번쩍이지 않는다', () => {
    auth.loading = true;
    const html = render({ signInHref: HREF, signInLabel: TEST_COPY });
    expect(html).not.toContain(TEST_COPY);
    expect(html).not.toMatch(/<button\b/);
  });

  it('회원: 지금 그대로 「시작하기」 버튼, 로그인 안내 0', () => {
    auth.user = { id: 'u1' };
    const html = render({ signInHref: HREF, signInLabel: TEST_COPY });
    expect(html).toMatch(/<button\b[^>]*>시작하기<\/button>/);
    expect(html).not.toContain(TEST_COPY);
    expect(html).not.toContain('reading-test__login');
  });

  it('요청 경로 셋(창 열 때 자동 시작 · 버튼 · 다시 풀기) 모두 손님에게 닫힌다 — generateTest 맨 앞 가드', () => {
    expect(readingTest).toMatch(/const signedIn = !!user\?\.id;/);
    expect(readingTest).toContain('if (inline && signedIn) generationStartRef.current();');
    expect(readingTest).toMatch(/async function generateTest\(\) \{\n    if \(!signedIn\) return;\n/);
    // resetTest(다시 풀기)는 generateTest를 거친다 — 가드 우회 경로가 없다.
    expect(readingTest).toMatch(/function resetTest\(\)[\s\S]*?if \(inline\) generateTest\(\);/);
    expect(readingTest.match(/callGemini\(/g)).toHaveLength(1);
  });

  it('뷰어는 제자리 복귀 주소와 화면 문구(vt)를 넘긴다', () => {
    const usage = viewer.match(/<ReadingTest\b[\s\S]*?\/>/)?.[0];
    expect(usage).toContain('signInHref={signInHref}');
    expect(usage).toContain(`signInLabel={vt('${TEST_COPY}')}`);
    expect(viewer).toContain('const signInHref = authEntryHref(viewerQuery ? `${viewerPath}?${viewerQuery}` : viewerPath);');
  });
});

describe('더 알아보기(비슷한 말 · 자세한 설명) — 손님은 버튼 대신 로그인 안내', () => {
  const learn = viewer.match(/<section ref=\{learnRef\} className="reader-card-learn"[\s\S]*?<\/section>\}/)?.[0];

  it('안내 링크: 손님 · 확인 끝 · 아직 안 보이는 것이 있을 때만, 주소는 signInHref, 문구는 목업 그대로', () => {
    expect(learn).toBeTruthy();
    expect(learn).toContain(`<Link href={signInHref} className="reader-card-learn__login">{vt('${WORD_COPY}')}</Link>`);
    expect(learn).toContain("{!user && !authLoading && ((synAntEligible(selectedToken,materialLang) && !(synAnt && !synAnt.loading && !synAnt.error)) || !wordDetail?.detail)");
    expect(viewer).toContain('const { user, profile, refreshProfileAfterActivity, isAdmin, loading: authLoading } = useAuth();');
  });

  it('버튼 둘은 손님에게 숨김 — 캐시 내용(synAnt · wordDetail.detail) 분기는 그대로 앞에 둔다', () => {
    expect(learn).toMatch(/: synAnt && !synAnt\.error \? <div className="syn-ant">[\s\S]*?: !user \? null : <>\{synAnt\?\.error[\s\S]*?\{vt\("✦ 비슷한 말 찾기"\)\}<\/button><\/>\)\}/);
    expect(learn).toMatch(/: wordDetail\?\.detail \? <div className="reader-card-learn__detail">[\s\S]*?: user && <button type="button" onClick=\{\(\) => fetchWordDetail\(selectedToken\)\}/);
  });

  it('요청 경로도 닫는다 — 비슷한 말 효과는 손님이면 캐시만(peekSynAnt), 자세한 설명은 맨 앞 가드', () => {
    const effect = viewer.match(/\/\/ ⑤ 유의어·반의어[\s\S]*?\}, \[selectedToken, isSheetOpen, materialLang, synAntRequest, user\?\.id\]\);/)?.[0];
    expect(effect).toBeTruthy();
    const peekAt = effect.indexOf('if (!synAntRequest || !user?.id) {');
    expect(peekAt).toBeGreaterThan(-1);
    expect(effect.indexOf('peekSynAnt(')).toBeGreaterThan(peekAt);
    expect(effect.indexOf('fetchSynAnt(')).toBeGreaterThan(effect.indexOf('return () => { alive = false; };', peekAt));
    expect(viewer).toMatch(/async function fetchWordDetail\(token\) \{\n    if \(!user\) return;/);
  });

  it('회원 경로는 그대로 — 요청 버튼 · 조회 호출이 남아 있다', () => {
    expect(learn).toContain('onClick={() => setSynAntRequest(n => n + 1)}');
    expect(learn).toContain('aria-describedby="viewer-synant-notice"');
    expect(viewer).toContain('fetchSynAnt(selectedToken, materialLang)');
    expect(viewer).toContain('detail = await fetchWordDetailText(token, materialLang);');
  });
});

describe('문구 · 모양', () => {
  it('두 줄 모두 뷰어 문구 3개 언어(ko · zh-CN · zh-TW)에 있다', () => {
    for (const key of [WORD_COPY, TEST_COPY]) {
      expect(t('ko', key)).toBe(key);
      expect(t('zh-CN', key)).toMatch(/登录后.*→$/);
      expect(t('zh-TW', key)).toMatch(/登入後.*→$/);
    }
  });

  it('번역 칸 안내와 같은 모양(밑줄 링크 · 44px 터치)', () => {
    const css = read('src/components/viewer/reader-controls.css');
    expect(css).toMatch(/\.reader-sentence__login,\.reader-card-learn__login,\.reading-test__login \{[^}]*min-height:44px/);
  });
});
