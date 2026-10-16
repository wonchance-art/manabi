import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));

import DiscoverLoading from '../../app/(app)/discover/loading';

// 로딩 스켈레톤(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST): 대기 화면을 스피너 · 대기 문구 대신 실제 화면의 칸 모양으로.
// 실측 우선순위 ① 산책 /discover(탭 전환 스피너 0.25~0.4초) ② 배움 /home(라우트 0.15초 · 「읽던 위치 불러오는 중…」)
// ③ 서재(「서재를 열고 있어요…」 · 「읽던 곳을 확인하고 있어요…」 · 「자료 목록 불러오는 중…」).
// 계약 = 배선 · 문구 · 접근성 · 토큰 · 모션 축소. 높이(CLS)는 실제 빌드 프레임 측정이 본다(ui-conventions §5).
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const render = (el) => renderToStaticMarkup(el);
/** 골격 영역 = aria-busy + 화면 읽기용 「〔무엇〕 불러오는 중…」 한 줄(문구 표준). */
const region = (html, what) => {
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain(`<span class="skeleton-sr" role="status">${what} 불러오는 중…</span>`);
};

describe('① 발견 대기 화면 — src/app/(app)/discover/loading.jsx', () => {
  const html = render(createElement(DiscoverLoading));
  it('파일이 있고, 전역 스피너가 아니라 골격이다', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/(app)/discover/loading.jsx'))).toBe(true);
    expect(read('src/app/(app)/discover/loading.jsx')).not.toContain('Spinner');
    region(html, '발견 화면');
  });
  it('실제 화면의 칸: h1 「발견」 · 서가 머리 · 소식 4칸 · 문화 3칸(같은 클래스)', () => {
    expect(html).toContain('<header class="manabi-page-heading"><h1>발견</h1></header>');
    expect(html).toContain('<h2>서가</h2>');
    expect(sliceBetween(html, '<ul class="discover-shelf__items">', '</ul>').match(/<li>/g)).toHaveLength(4);
    expect(sliceBetween(html, '<div class="discover-cultures">', '</section>').match(/<a>/g)).toHaveLength(3);
    expect(html).not.toMatch(/<a [^>]*href=/); // 자리표 칸은 이동 · 초점이 없다
  });
});

describe('부품 · 토큰 · 모션 축소', () => {
  it('골격 부품은 Skeleton.jsx 한 곳(재사용) — 새 화면은 거기서 가져온다', () => {
    for (const file of ['src/app/(app)/discover/loading.jsx']) {
      expect(read(file)).toMatch(/import \{ SkeletonLine(?:, SkeletonRegion)? \} from '@\/components\/Skeleton';/);
    }
    const skeleton = read('src/components/Skeleton.jsx');
    expect(skeleton).toContain('export function SkeletonRegion(');
    expect(skeleton).toContain('export function SkeletonLine(');
    expect(skeleton).toContain('<span className="skeleton-sr" role="status">{label} 불러오는 중…</span>');
    expect(sliceBetween(skeleton, 'export function SkeletonLine(', '\n}')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|background|color/i);
  });
  it('셸 골격 색은 토큰 파생(색 리터럴 0)', () => {
    const shell = read('src/components/web/web-shell.css');
    expect(shell).toContain('.manabi-app .skeleton,.manabi-app .skeleton-line{background:color-mix(in srgb,var(--text-muted) 14%,transparent)}');
  });
  it('반짝임은 전용 모션 축소 블록에서 정지 회색 칸', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.skeleton, \.skeleton-line \{ animation: none; \}\s*\}/);
  });
});
