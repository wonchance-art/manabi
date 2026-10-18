import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SC_HINT_COOKIE, scHintDecision, scHintFromJar, syncScHintCookie, wantsScFont } from '@/lib/scFontHint';

/**
 * 계약: 간체 중국어를 그리는 잎이 독립 스타일시트를 직접 건다 (SC-LINK-001 2단계, 2026-10-17 KST).
 * ① ScFontLink는 주소가 있고 ScFontScope 밖일 때만 <link rel="stylesheet" precedence="font-sc">를 그린다
 * ② ZhSlot은 lang zh*일 때만 잎 가까이 Suspense 경계를 두고, 아니면 자식을 그대로 돌려준다(일본어 · 영어 학습자는 무변경)
 * ③ 학습 언어 힌트 쿠키는 값 '1' 하나만 쓰고, 상태가 같으면 쓰지 않는다
 */
const HREF = '/_fonts/noto-sans-sc/noto-sans-sc.0123456789abcdef.css';
async function load(href) {
  vi.resetModules();
  vi.stubEnv('MANABI_SC_STYLESHEET', href);
  return import('../fonts/ScFontLink');
}
afterEach(() => { vi.unstubAllEnvs(); });

describe('ScFontLink · ZhSlot', () => {
  it('isZhLang은 zh · zh-CN · zh-Hant만 참이다', async () => {
    const { isZhLang } = await load(HREF);
    expect(['zh', 'zh-CN', 'zh-Hant', 'ZH-tw'].map(isZhLang)).toEqual([true, true, true, true]);
    expect(['ja', 'en', 'zhx', '', null, undefined, 'Chinese'].map(isZhLang)).toEqual([false, false, false, false, false, false, false]);
  });

  it('① 주소가 있으면 precedence 링크를 그리고, 범위 안 · 주소 없음이면 그리지 않는다', async () => {
    const { ScFontLink, ScFontScopeMarker } = await load(HREF);
    const html = renderToStaticMarkup(<ScFontLink />);
    expect(html).toContain(`href="${HREF}"`);
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain('data-precedence="font-sc"');
    expect(renderToStaticMarkup(<ScFontScopeMarker><ScFontLink /></ScFontScopeMarker>)).toBe('');
    const empty = await load('');
    expect(renderToStaticMarkup(<empty.ScFontLink />)).toBe('');
  });

  it('② ZhSlot — zh면 스타일시트와 함께, 아니면 자식 그대로', async () => {
    const { ZhSlot, ScFontScopeMarker } = await load(HREF);
    const zh = renderToStaticMarkup(<ZhSlot lang="zh"><span lang="zh">你好</span></ZhSlot>);
    expect(zh).toContain(HREF);
    expect(zh).toContain('<span lang="zh">你好</span>');
    for (const lang of ['ja', 'en', undefined]) {
      expect(renderToStaticMarkup(<ZhSlot lang={lang}><span>こんにちは</span></ZhSlot>), String(lang)).toBe('<span>こんにちは</span>');
    }
    expect(renderToStaticMarkup(<ScFontScopeMarker><ZhSlot lang="zh"><span>你好</span></ZhSlot></ScFontScopeMarker>)).toBe('<span>你好</span>');
    const empty = await load('');
    expect(renderToStaticMarkup(<empty.ZhSlot lang="zh"><span>你好</span></empty.ZhSlot>)).toBe('<span>你好</span>');
  });

  it('② 기다리는 동안의 대체는 같은 요소를 visibility: hidden으로 그린다(자리 이동 0 · 대체 글꼴로 먼저 그리지 않음)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/fonts/ScFontLink.jsx'), 'utf8');
    expect(src).toContain("cloneElement(only, { style: { ...(only.props.style || {}), visibility: 'hidden' }, 'aria-hidden': true })");
    expect(src).toContain('<Suspense fallback={hidden}>');
    expect(src).toContain('<link rel="stylesheet" href={SC_STYLESHEET_HREF} precedence="font-sc" />');
  });
});

describe('학습 언어 힌트 쿠키', () => {
  it('③ 중국어가 학습 언어에 있을 때만 켠다', () => {
    expect(wantsScFont(['Japanese', 'Chinese'])).toBe(true);
    expect(wantsScFont(['Japanese'])).toBe(false);
    expect(wantsScFont(null)).toBe(false);
  });

  it('③ 서버는 값이 정확히 1일 때만 힌트로 읽는다', () => {
    const jar = (v) => ({ get: (n) => (n === SC_HINT_COOKIE && v !== undefined ? { value: v } : undefined) });
    expect(scHintFromJar(jar('1'))).toBe(true);
    expect(scHintFromJar(jar('0'))).toBe(false);
    expect(scHintFromJar(jar(undefined))).toBe(false);
    expect(scHintFromJar(null)).toBe(false);
    expect(scHintFromJar({ get() { throw new Error('x'); } })).toBe(false);
  });

  it('③ 클라이언트는 상태가 다를 때만 쓰고, 끌 때는 지운다', () => {
    const writes = [];
    const doc = { _c: 'sb-x-auth-token=a', get cookie() { return this._c; }, set cookie(v) { writes.push(v); this._c = v.startsWith(`${SC_HINT_COOKIE}=1`) ? `sb-x-auth-token=a; ${SC_HINT_COOKIE}=1` : 'sb-x-auth-token=a'; } };
    expect(syncScHintCookie(false, doc)).toBe(false);
    expect(syncScHintCookie(true, doc)).toBe(true);
    expect(writes[0]).toBe(`${SC_HINT_COOKIE}=1; Path=/; Max-Age=15552000; SameSite=Lax`);
    expect(syncScHintCookie(true, doc)).toBe(false);
    expect(syncScHintCookie(false, doc)).toBe(true);
    expect(writes[1]).toBe(`${SC_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
    expect(writes).toHaveLength(2);
    expect(syncScHintCookie(true, null)).toBe(false);
  });

  it('③ 학습 언어가 실제 데이터로 정해진 뒤에만 정한다 — 손님 · 담은 표현 수가 오기 전의 기본값은 null(건드리지 않음, 리뷰 N2-d)', () => {
    expect(scHintDecision(null, { Chinese: 3 })).toBeNull(); // 손님 · 프로필 받는 중
    expect(scHintDecision({ learning_language: ['Chinese', 'Japanese'] }, null)).toBe(true); // 프로필이 정본
    expect(scHintDecision({ learning_language: 'Japanese' }, { Chinese: 9 })).toBe(false);
    expect(scHintDecision({ learning_language: null }, null)).toBeNull(); // 담은 표현 수가 오기 전 — 기본값(일본어)으로 지우지 않는다
    expect(scHintDecision({ learning_language: [] }, {})).toBeNull();
    expect(scHintDecision({ learning_language: null }, { Chinese: 5, Japanese: 2 })).toBe(true); // 담은 표현 수로 정해짐
    expect(scHintDecision({ learning_language: null }, { Japanese: 2 })).toBe(false);
    expect(scHintDecision({ learning_language: ['Klingon'] }, null)).toBeNull(); // 목록 밖 값은 정해진 것으로 치지 않는다
  });

  it('③ 학습 언어 훅은 그 판정이 정해졌을 때만 쿠키를 맞추고, 계정을 떠날 때 지우는 곳은 AuthContext 한 곳이다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/learn/useLearnLanguage.js'), 'utf8');
    expect(src).toContain('const scHint = scHintDecision(profile, vocabCounts);');
    expect(src).toContain('useEffect(() => { if (scHint !== null) syncScHintCookie(scHint); }, [scHint]);');
    const writers = ['src/components', 'src/lib', 'src/views', 'src/app'].flatMap(function walk(dir) {
      return fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((d) => {
        const rel = path.join(dir, d.name);
        if (d.isDirectory()) return d.name === '__tests__' ? [] : walk(rel);
        return /\.(js|jsx)$/.test(d.name) && fs.readFileSync(path.join(process.cwd(), rel), 'utf8').includes('syncScHintCookie(') ? [rel] : [];
      });
    }).sort();
    expect(writers).toEqual(['src/components/learn/useLearnLanguage.js', 'src/lib/AuthContext.jsx', 'src/lib/scFontHint.js']);
  });
});
