import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../../lib/__tests__/helpers/sliceBetween.js';

// 산책 화면 배선(SHELF-001 — 오너 「발견에 공개」·「지역학 치워버려 지우진 말고」 2026-10-16 KST → 큰 칸 셋 DISCOVER-CLASSICS-001 2026-10-22 KST).
// 칸 그림 자체는 src/lib/__tests__/classicsShelf.test.jsx(DiscoverTiles · ClassicsShelf)가 본다.
const ROOT = path.resolve(__dirname, '../../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
describe('산책 화면 배선', () => {
  const page = () => read('src/app/(app)/discover/page.jsx');
  it('큰 칸 셋을 그리고, 오늘 화제는 /api/suggestions/today와 같은 todaySuggestions를, 고전 명작은 발행 기록 서가를 쓴다', () => {
    expect(page()).toContain('<DiscoverTiles suggestions={suggestions} classics={classics} date={kstDateString()} />');
    expect(page()).toContain('releasedClassicsOf(client).then(({ items }) => items)');
    expect(page()).toContain('<h1>산책</h1>');
    expect(page()).not.toMatch(/publishedReading|discover-cultures|문화 읽기<\/h2>/); // N5 문화 읽기는 산책에서 내렸다(교재 화면에 있다)
    expect(fs.existsSync(path.join(ROOT, 'src/components/web/DiscoverShelf.jsx'))).toBe(false);
    expect(page()).toContain('todaySuggestions(client)');
    expect(read('src/app/api/suggestions/today/route.js')).toContain('todaySuggestions(');
  });
  it('지역학은 발견에서 내렸지만 지우지 않았다 — /studies 경로와 콘텐츠가 남아 있다', () => {
    expect(page()).not.toMatch(/STUDY_COUNTRIES|DiscoveryExplorer/);
    expect(fs.existsSync(path.join(ROOT, 'src/app/(app)/studies/page.jsx'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/content/studies'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/components/web/DiscoveryExplorer.jsx'))).toBe(true);
  });
  it('공개 글 수는 책 장도 센다 — 비로그인은 책 장 행을 못 읽으니 public_book_catalog로 더한다', () => {
    expect(page()).toContain("client.rpc('public_book_catalog', {}, { count: 'exact', head: true }).not('title', 'ilike', SERIES_TITLE_ILIKE)");
    expect(page()).not.toMatch(/rpc\('public_book_catalog'\)\.then/);
    expect(page()).toContain('const publicCount = looseCount + bookChapterCount;');
    expect(page()).toContain('{publicCount > 0 && <p className="discover-more">'); // 공개 글이 없으면 줄을 두지 않는다
  });
  it('자료 목록 화면은 그 화면에서만 받는다 — 산책 · 서재 기본 화면 JS에 싣지 않는다(운영 약 119KB, 2026-10-17 KST)', () => {
    for (const file of ['src/app/(app)/discover/page.jsx', 'src/components/web/LibraryPage.jsx']) {
      expect(read(file)).not.toMatch(/import\s+\w+\s+from\s+'@\/views\/MaterialsPage'/);
      expect(read(file)).toContain('<LazyMaterialsPage libraryView=');
    }
    expect(read('src/components/web/LazyMaterialsPage.jsx')).toContain("dynamic(() => import('@/views/MaterialsPage')");
  });
  it('「함께 읽는 글」 목록의 추천 카드는 그 목록으로 돌아간다(서재 목록은 서재로 — READER-RETURN-001)', () => {
    expect(read('src/views/MaterialsPage.jsx')).toContain("from={libraryView === 'public' ? 'reading' : 'materials'}");
    expect(read('src/views/MaterialsPage.jsx')).toContain('router.push(suggestionHref(s, from))');
  });
  it('「함께 읽는 글」은 세션 쿠키(이름만)를 넘겨 로그인 고르기 줄을 서버부터 그린다(DISCOVER-CHIP-CLS-001)', () => {
    // 서버 그림은 늘 로그인 확인 전 — 힌트가 없으면 확인 뒤 「안 읽은 것만」 칩이 끼며 390폭에서 줄이 접혀 목록을 밀었다.
    expect(page()).toContain("import { hasSupabaseSessionInJar } from '@/lib/authCookie';");
    expect(page()).toContain('<LazyMaterialsPage libraryView="public" sessionHint={hasSupabaseSessionInJar(await cookies())}/>');
    expect(read('src/views/MaterialsPage.jsx')).toContain("export default function MaterialsPage({ libraryView = null, sessionHint = false })");
  });
  it('서재 도구(?tools=1 · ?sort=fit)도 같은 세션 쿠키 힌트를 넘긴다 — 손님(쿠키 없음)은 false 그대로', () => {
    expect(read('src/components/web/LibraryPage.jsx')).toContain('<LazyMaterialsPage libraryView="allOwned" sessionHint={sessionHint===true}/>');
    expect(read('src/app/(app)/materials/page.jsx')).toContain('<LibraryPage sessionHint={hasSupabaseSessionInJar(await cookies())} />');
  });
  it('확인 중인 로그인 사람에게는 손님 빈 상태 대신 기존 목록 골격 — 추천 칸도 목록이 정해진 뒤에만', () => {
    const src = read('src/views/MaterialsPage.jsx');
    expect(src).toContain('const signInPending = authLoading && sessionHint === true;');
    // 목록 골격 · 추천 칸의 조건(!tab || isLoading — LIBRARY-GUEST-CLS-001 계약)이 확인 중도 「아직 정해지지 않음」으로 본다.
    expect(src).toContain('const isLoading = materialsLoading || signInPending;');
    expect(src).toMatch(/isLoading: materialsLoading, isFetched: materialsFetched/);
    // 서재 도구: 확인 뒤 PDF 조회 줄이 골격 위에 끼지 않게 확인 중에도 같은 줄을 미리 둔다.
    expect(src).toContain('{showPdfs && (pdfsLoading || signInPending) && <p aria-busy="true">PDF 목록 확인 중…</p>}');
  });
  it('비로그인 서재는 산책으로 안내한다', () => {
    expect(read('src/components/web/LibraryPage.jsx')).toContain('href="/discover">산책에서 읽어 보기</Link>');
  });
});

// 소식 「전체 보기」는 「함께 읽는 글」 아래 「오늘의 소식」 칸(#today-news) — 산책 「오늘 화제」 칸이 그리로 간다(B2 A안 · DISCOVER-CLASSICS-001).
describe('오늘 화제 → 오늘의 소식 칸', () => {
  it('「함께 읽는 글」 화면의 칸 — id · 제목 「오늘의 소식」 · 목록과 소식이 둘 다 온 뒤 한 번 내려가 초점(#library-search와 같은 해시 처리)', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(read('src/lib/suggestionReading.js')).toContain("export const TODAY_NEWS_ID = 'today-news';");
    expect(page).toContain('<h2 className="suggestions-section__title" id={TODAY_NEWS_ID} tabIndex={-1}>오늘의 소식</h2>');
    expect(page).not.toContain('오늘의 추천 자료');
    expect(page).toContain('const newsReady = materialsFetched && suggestionsFetched;');
    const effect = sliceBetween(page, 'const newsFocusDone = useRef(false);', '}, [newsReady]);');
    expect(effect).toContain("window.location.hash !== `#${TODAY_NEWS_ID}` || newsFocusDone.current || !newsReady");
    expect(effect).toContain("heading.scrollIntoView({ block: 'start' });");
    expect(effect).toContain('heading.focus({ preventScroll: true });');
    expect(effect).toContain("window.addEventListener('hashchange', again);");
  });
});
