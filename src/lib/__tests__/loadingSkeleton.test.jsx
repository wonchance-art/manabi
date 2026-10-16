import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: null, loading: true }) }));

import DiscoverLoading from '../../app/(app)/discover/loading';
import HomeLoading from '../../app/(app)/home/loading';
import ResumeTile from '../../components/learn/ResumeTile';
import ParagraphTile from '../../components/learn/ParagraphTile';
import { ReviewTile } from '../../components/learn/LearnTiles';

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

describe('② 배움 — home/loading.jsx와 화면 안 골격이 같은 칸', () => {
  it('home/loading.jsx: 배움 칸 배치 그대로(이어 읽기 · 목표 · 오늘 목표 · 연속 · 단어 복습 · 오늘 문단)', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/(app)/home/loading.jsx'))).toBe(true);
    const html = render(createElement(HomeLoading));
    region(html, '배움 화면');
    for (const cls of ['learn-grid', 'learn-resume', 'learn-quad', 'learn-goal', 'learn-stat', 'learn-review', 'learn-paragraph']) expect(html).toContain(cls);
    expect(html).not.toContain('아직 수집한 단어가 없어요');
    expect(html).not.toContain('시작하면 오늘 문단을 만들어요');
  });
  it('이어 읽기 받는 중: 「읽던 위치 불러오는 중…」은 화면 읽기용 한 줄, 칸은 골격', () => {
    const html = render(createElement(ResumeTile, { pending: true }));
    region(html, '읽던 위치');
    expect(html).toContain('skeleton-line');
    expect(html).not.toContain('class="learn-resume__sub">읽던 위치 불러오는 중…');
  });
  it('단어 복습 · 오늘 문단 받는 중에는 거짓 빈 상태를 보이지 않는다', () => {
    const review = render(createElement(ReviewTile, { pending: true }));
    region(review, '단어 복습');
    expect(review).not.toContain('아직 수집한 단어가 없어요');
    expect(review).not.toContain('href='); // 갈 곳을 아직 모른다
    const paragraph = render(createElement(ParagraphTile, { state: { kind: 'empty' }, href: '/study', pending: true }));
    region(paragraph, '오늘 문단');
    expect(paragraph).not.toContain('시작하면 오늘 문단을 만들어요');
    expect(render(createElement(ParagraphTile, { state: { kind: 'empty' }, href: '/study' }))).toContain('시작하면 오늘 문단을 만들어요');
  });
  it('HomePage가 처음 받는 중일 때 골격을 켠다', () => {
    const home = read('src/views/HomePage.jsx');
    expect(home).toContain('pending={!data && (authLoading || isLoading)} />');
    expect(home).toContain('pending={paragraph.isPending} href={`/study?lang=${lang}`}');
    expect(read('src/components/learn/GoalTrackTile.jsx')).toContain("if (status === 'loading') return <GoalTrackSkeleton className={className} />;");
  });
});

describe('부품 · 토큰 · 모션 축소', () => {
  it('골격 부품은 Skeleton.jsx 한 곳(재사용) — 새 화면은 거기서 가져온다', () => {
    for (const file of ['src/app/(app)/discover/loading.jsx', 'src/components/learn/ResumeTile.jsx',
      'src/components/learn/ParagraphTile.jsx', 'src/components/learn/LearnTiles.jsx', 'src/components/learn/GoalTrackTile.jsx']) {
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
    expect(read('src/components/learn/learn.css')).toContain('.learn-review__cycle--skeleton{animation:none}');
  });
});
