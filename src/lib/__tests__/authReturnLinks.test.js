import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 로그인 뒤 제자리 복귀 (UX 점검 2026-10-16 KST 제안 3).
 *
 * 맨 `/auth`로 보내면 AuthPage가 `from` 없이 기본값 `/home`으로 돌려보낸다(`AuthPage.jsx`의 `from` 기본값).
 * 뷰어 게스트 배너 「로그인하면 단어장에 저장하고 복습할 수 있어요」가 그랬다 — 자료 읽기 순환의
 * 뷰어 → 단어 저장 이음새가 로그인 한 번에 끊겼다. 화면의 로그인 링크는 정본 `authEntryHref`(src/lib/authRedirect.js)로
 * 현재 위치를 `from`에 담는다. 대상 검증(외부 · 루프 차단)은 그 함수의 규칙이 맡는다(authEntryHref.test.js).
 *
 * 금지: 화면 코드(src/views · src/components · src/app)에서 href로 맨 `/auth`를 쓰는 것.
 * `/auth?from=…`처럼 돌아올 곳을 담은 링크와 href가 아닌 이동(로그아웃 뒤 router.push, 서버 redirect)은 대상이 아니다.
 */

const ROOTS = ['src/views', 'src/components', 'src/app'];
const SOURCE = /\.(?:jsx?|tsx?)$/;
const TEST = /\.test\.[jt]sx?$/;
// 허용 예외 — 꼭 필요할 때만, 파일 경로 → 이유. 지금은 없다.
const ALLOW = Object.freeze({});

// href="/auth" · href='/auth' · href={'/auth'} · href={x ? '/auth' : y} 등 — 따옴표로 닫힌 맨 '/auth' 문자열.
const BARE_ATTR = /href=(["'])\/auth\1/g;
const BARE_EXPR = /href=\{[^}]*?(["'`])\/auth\1[^}]*\}/g;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE.test(name) && !TEST.test(name)) out.push(p);
  }
  return out;
}

function bareAuthLinks(source) {
  return [...source.matchAll(BARE_ATTR), ...source.matchAll(BARE_EXPR)].map(m => m[0]);
}

describe('로그인 링크 — 로그인 뒤 원래 자리로', () => {
  const files = ROOTS.flatMap(root => walk(path.resolve(root), []));

  it('스캔 대상이 실제로 있다(공허 통과 방지)', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(f => f.endsWith(path.join('views', 'ViewerPage.jsx')))).toBe(true);
  });

  it('검출기가 맨 /auth 형태를 잡고, 돌아올 곳을 담은 링크는 통과시킨다', () => {
    expect(bareAuthLinks('<Link href="/auth">로그인</Link>')).toHaveLength(1);
    expect(bareAuthLinks("<Link href='/auth'>로그인</Link>")).toHaveLength(1);
    expect(bareAuthLinks("<Link href={signedOut ? '/auth' : '/lessons'}>")).toHaveLength(1);
    expect(bareAuthLinks('<Link href={`/auth`}>')).toHaveLength(1);
    expect(bareAuthLinks('<Link href={signInHref}>')).toHaveLength(0);
    expect(bareAuthLinks('<Link href="/auth?from=/conversation/new">')).toHaveLength(0);
    expect(bareAuthLinks("<Link href={authEntryHref('/home')}>")).toHaveLength(0);
    expect(bareAuthLinks("router.push('/auth')")).toHaveLength(0);
  });

  it('화면 코드에 맨 /auth 링크가 없다 — authEntryHref로 현재 위치를 담는다', () => {
    const offenders = files
      .filter(f => !ALLOW[path.relative(process.cwd(), f)])
      .flatMap(f => bareAuthLinks(fs.readFileSync(f, 'utf8')).map(hit => `${path.relative(process.cwd(), f)}: ${hit}`));
    expect(offenders, '로그인 링크는 authEntryHref(현재 경로)를 쓴다').toEqual([]);
  });

  it('허용 예외는 이유가 있고 실제로 존재하는 파일이다', () => {
    for (const [file, reason] of Object.entries(ALLOW)) {
      expect(fs.existsSync(file), file).toBe(true);
      expect(String(reason).length, file).toBeGreaterThan(10);
    }
  });
});
