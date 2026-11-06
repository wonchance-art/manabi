import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

// 발매 점검 — 처음 온 사람의 첫 화면(오너 승인 목업 Ez2VCekG8Nub5dTT5wBamA ①, 2026-11-06 KST).
const read = (p) => readFileSync(p, 'utf8');

describe('#1 손님 첫 화면 소개 띠', () => {
  const home = read('src/views/HomePage.jsx');
  const guest = sliceBetween(home, 'if (guestLayout) {', '<div className="learn-top">');
  it('손님 배치에만, 「배움」 제목 줄 위에 — 무료 · 대상 · 무엇을 하는 앱 + 가입 · 둘러보기', () => {
    expect(guest).toContain('<section className="learn-intro" aria-labelledby="learn-intro-title">');
    expect(guest).toContain('무료 · 한국인 학습자를 위한 일본어 · 중국어');
    expect(guest).toContain('읽으면서 배우는 일본어 · 중국어');
    expect(guest).toContain('href="/auth?mode=signup&from=%2Fhome"');
    expect(guest).toContain('로그인 없이 교재 둘러보기 →');
    expect(home.match(/className="learn-intro"/g)).toHaveLength(1);
  });
  it('홈 설명(메타)도 같은 한 줄', () => {
    // 문장은 사이트 소개 한 곳(lib/seo SITE_DESCRIPTION — 루트 기본 설명 · JSON-LD와 같은 값, LAUNCH-META-004)에 있고 홈이 그것을 쓴다.
    expect(read('src/lib/seo.js')).toContain("export const SITE_DESCRIPTION = '읽으면서 배우는 일본어 · 중국어 — 한국인 학습자를 위한 무료 학습장");
    expect(read('src/components/learn/HomeVariant.jsx')).toContain("publicMetadata('/home', { title: '배움', description: SITE_DESCRIPTION })");
  });
  it('주 단추는 셸 토큰 · 3px · 44px', () => {
    const css = read('src/components/learn/learn.css');
    expect(css).toMatch(/\.learn-page \.learn-intro__start\{[^}]*min-height:44px[^}]*border-radius:3px;background:var\(--ja\);color:var\(--on-fill\)/);
    // .manabi-page a(0,1,1)가 색 · 밑줄을 덮지 않게 두 클래스로 건다(실제 빌드에서 글자가 먹색으로 나왔던 것).
    expect(css).toMatch(/\.learn-page \.learn-intro__browse\{[^}]*text-decoration:underline/);
  });
});

describe('#12 로그인 주 단추 — 셸 평면 단추', () => {
  it('그라데이션 · 빛 번짐 없이 로즈 한 색 · 3px', () => {
    const rule = sliceBetween(read('src/index.css'), '.auth-submit {', '}');
    expect(rule).toContain('border-radius: 3px;');
    expect(rule).toContain('background: var(--primary);');
    expect(rule).not.toMatch(/gradient|box-shadow/);
  });
});

describe('#8 · #10 · #13 홈 · 내 정보 (발매 점검, 오너 승인 2026-11-06 KST)', () => {
  it('오늘 목표 — 받기 전만 「–」, 0이면 0%', () => {
    expect(read('src/components/learn/LearnTiles.jsx')).toContain("const value = pct == null ? '–' : `${pct}%`;");
  });
  it('내 데이터 내보내기 — 「파일로 받기」', () => {
    const src = read('src/components/AccountSettings.jsx');
    expect(src).toContain("value={exportMsg || '파일로 받기'}");
    expect(src).not.toContain("'JSON 파일'");
  });
});

