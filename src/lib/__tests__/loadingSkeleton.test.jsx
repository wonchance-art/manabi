import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
const h = vi.hoisted(() => ({ auth: { user: null, loading: true }, q: {} }));
vi.mock('../AuthContext', () => ({ useAuth: () => h.auth }));
// 목표 칸(useGoalTrack)의 조회 대역 — queryKey 첫 칸으로 상태를 고른다(goal-catalog · goal-progress).
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }) => ({ data: undefined, isError: false, isPending: true, refetch: () => {}, ...h.q[queryKey[0]] }),
}));

import DiscoverLoading from '../../app/(app)/discover/loading';
import HomeLoading from '../../app/(app)/home/loading';
import ResumeTile from '../../components/learn/ResumeTile';
import ParagraphTile from '../../components/learn/ParagraphTile';
import { ReviewTile } from '../../components/learn/LearnTiles';
import GoalTrackTile from '../../components/learn/GoalTrackTile';
import { LibraryShelfSkeleton, RecentReadsSkeleton, ShelfRowsSkeleton } from '../../components/library/LibrarySkeleton';

// 로딩 스켈레톤(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST): 대기 화면을 스피너 · 대기 문구 대신 실제 화면의 칸 모양으로.
// 실측 우선순위 ① 산책 /discover(탭 전환 스피너 0.25~0.4초) ② 배움 /home(라우트 0.15초 · 「읽던 위치 불러오는 중…」)
// ③ 서재(「서재를 열고 있어요…」 · 「읽던 곳을 확인하고 있어요…」 · 「자료 목록 불러오는 중…」).
// 계약 = 배선 · 문구 · 접근성 · 토큰 · 모션 축소. 높이(CLS)는 실제 빌드 프레임 측정이 본다(ui-conventions §5).
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const render = (el) => renderToStaticMarkup(el);
const statuses = (html) => html.match(/role="status"/g) || [];
/** 칸 단위 골격 = aria-busy + 읽을 수 있는(live 아님) 「〔무엇〕 불러오는 중…」 한 줄 — 칸마다 status를 달지 않는다. */
const region = (html, what) => {
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain(`<span class="skeleton-sr">${what} 불러오는 중…</span>`);
  expect(statuses(html)).toHaveLength(0);
};
/** 묶음(라우트 대기 화면 · 목록 하나) 골격 = status 한 줄이 aria-busy **밖**, 앞에 하나뿐 — busy 안 변화는 화면 읽기가 미룬다. */
const announced = (html, what) => {
  expect(statuses(html)).toHaveLength(1);
  expect(html.startsWith(`<span class="skeleton-sr" role="status">${what} 불러오는 중…</span><`)).toBe(true);
  expect(sliceBetween(html, '<span class="skeleton-sr" role="status">', '</span>')).not.toContain('aria-busy');
  expect(html.indexOf('role="status"')).toBeLessThan(html.indexOf('aria-busy="true"'));
};

describe('① 발견 대기 화면 — src/app/(app)/discover/loading.jsx', () => {
  const html = render(createElement(DiscoverLoading));
  it('파일이 있고, 전역 스피너가 아니라 골격이다', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/(app)/discover/loading.jsx'))).toBe(true);
    expect(read('src/app/(app)/discover/loading.jsx')).not.toContain('Spinner');
    announced(html, '발견 화면');
  });
  it('실제 화면의 칸: h1 「발견」 · 서가 머리 · 소식 4칸 · 문화 3칸(같은 클래스)', () => {
    // 제목은 대기 중 화면 읽기에 숨긴다 — 실제 화면이 들어오며 다시 그리므로 두 번 읽히지 않게(배움 · 서재 대기와 같다).
    expect(html).toContain('<header class="manabi-page-heading" aria-hidden="true"><h1>발견</h1></header>');
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
    announced(html, '배움 화면');
    expect(html).toContain('<div class="learn-top" aria-hidden="true"><div class="learn-top__title"><h1>배움</h1>');
    expect(html).not.toContain('href='); // 대기 화면의 칸은 초점 · 이동이 없다(aria-hidden 안에 링크 0)
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
    expect(paragraph).not.toContain('href='); // 받는 중 칸은 링크가 아니다(단어 복습 칸과 같다)
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

describe('③ 서재 — 대기 문구 세 줄이 골격으로', () => {
  it('로그인 확인 · 읽던 곳 · 자료 목록 골격', () => {
    announced(render(createElement(LibraryShelfSkeleton)), '서재'); // 안쪽 읽던 곳 · 목록 골격은 status를 더하지 않는다
    region(render(createElement(RecentReadsSkeleton)), '읽던 곳');
    const rows = render(createElement(ShelfRowsSkeleton));
    announced(rows, '자료 목록'); // 서재 안에서는 목록이 알림 하나를 맡는다
    expect(rows.match(/<li class="shelf-row-skeleton">/g)).toHaveLength(4);
    expect(rows).toContain('shelf-cover shelf-cover--skeleton skeleton');
  });
  it('골격은 실제 자료 줄 · 읽던 곳 카드 클래스를 쓰지 않는다 — 줄을 세는 곳(e2e · 선택 · 키보드)이 골격을 자료로 세지 않게', () => {
    const all = render(createElement(LibraryShelfSkeleton));
    expect(all).not.toMatch(/class="shelf-row"|class="shelf-row /);
    expect(all).not.toMatch(/class="shelf-recent-card[" ]/);
    // 치수는 같은 규칙에서 받는다(자리 높이 = 실측 CLS 0.032 근거).
    const css = read('src/components/library/library.css');
    expect(css).toContain('.shelf-row,.shelf-row-skeleton{');
    expect(css).toContain(':is(.shelf-recent-card,.shelf-recent-skeleton){display:flex');
  });
  it('화면이 그 골격을 실제로 쓰고, 옛 대기 문구는 남지 않는다', () => {
    const page = read('src/components/web/LibraryPage.jsx');
    const shelf = read('src/components/library/LibraryShelf.jsx');
    // 서버가 계정을 확인해 미리 받아 왔으면(serverUserId) 골격 없이 바로 서재 — 아니면 지금처럼 골격(LIBRARY-PREFETCH-001).
    expect(page).toContain('{loading&&!shelfUser?<LibraryShelfSkeleton/>:shelfUser?');
    expect(shelf).toContain('(recent.isPending||(recent.data?.items?.length>0))&&<RecentReadsSkeleton/>');
    expect(shelf).toContain('{(list.isPending||(stale&&!items.length))&&<ShelfRowsSkeleton/>}');
    for (const old of ['서재를 열고 있어요…', '읽던 곳을 확인하고 있어요…', '자료 목록 불러오는 중…</p>']) expect(page + shelf).not.toContain(old);
  });
});

describe('부품 · 토큰 · 모션 축소', () => {
  it('골격 부품은 Skeleton.jsx 한 곳(재사용) — 새 화면은 거기서 가져온다', () => {
    for (const file of ['src/app/(app)/discover/loading.jsx', 'src/components/library/LibrarySkeleton.jsx', 'src/components/learn/ResumeTile.jsx',
      'src/components/learn/ParagraphTile.jsx', 'src/components/learn/LearnTiles.jsx', 'src/components/learn/GoalTrackTile.jsx']) {
      expect(read(file)).toMatch(/import \{ SkeletonLine(?:, SkeletonRegion)? \} from '@\/components\/Skeleton';/);
    }
    const skeleton = read('src/components/Skeleton.jsx');
    expect(skeleton).toContain('export function SkeletonRegion(');
    expect(skeleton).toContain('export function SkeletonLine(');
    const part = sliceBetween(skeleton, 'export function SkeletonRegion(', '\n}');
    expect(part).toContain('{!announce && <span className="skeleton-sr">{line}</span>}');
    expect(part).toContain('return <><span className="skeleton-sr" role="status">{line}</span>{region}</>;');
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

describe('④ 목표 칸 — 받는 중 · 없음 · 실패를 가른다', () => {
  const catalog = { Japanese: { base: '/japanese', levels: [{ key: 'N5', chapters: [{ slug: 'n5-1', order: 1, title: '첫 과' }] }] } };
  const goal = { goal_lang: 'Japanese', goal_level: 'N5', dday_date: '2027-01-01' };
  const tile = (auth, q = {}) => { h.auth = auth; h.q = q; return render(createElement(GoalTrackTile)); };
  const user = { id: 'u1' };
  const busy = (html) => html.includes('aria-busy="true"');

  it('로그인 확인 중 · 프로필 받는 중에는 골격 — 「목표를 정하면」(거짓 빈 상태)이 아니다', () => {
    for (const auth of [{ user: null, loading: true }, { user, profile: null, loading: false, profileLoading: true }]) {
      const html = tile(auth);
      expect(busy(html)).toBe(true);
      expect(html).not.toContain('목표를 정하면');
    }
  });
  it('프로필을 받았는데 목표가 없으면 빈 상태(골격 아님)', () => {
    const html = tile({ user, profile: {}, loading: false, profileLoading: false });
    expect(html).toContain('목표를 정하면');
    expect(busy(html)).toBe(false);
  });
  it('목표 언어가 과정 목록에 없으면(셀 수 없음) 빈 상태 — 영원히 「불러오는 중」이 아니다', () => {
    const html = tile({ user, profile: { ...goal, goal_lang: 'Korean' }, loading: false, profileLoading: false },
      { 'goal-catalog': { data: catalog, isPending: false } });
    expect(busy(html)).toBe(false);
    expect(html).toContain('목표를 정하면');
  });
  it('진도를 받는 중이면 골격, 받지 못했으면 「…불러오지 못했어요.」 + 「다시 시도」(링크 아닌 칸)', () => {
    const auth = { user, profile: goal, loading: false, profileLoading: false };
    expect(busy(tile(auth, { 'goal-catalog': { data: catalog, isPending: false } }))).toBe(true);
    const failed = tile(auth, { 'goal-catalog': { data: catalog, isPending: false }, 'goal-progress': { isError: true, isPending: false } });
    expect(busy(failed)).toBe(false);
    expect(failed).toContain('목표 진도를 불러오지 못했어요.');
    expect(failed).toContain('<button type="button" class="learn-button-s">다시 시도</button>');
    expect(failed).not.toContain('href=');
  });
});
