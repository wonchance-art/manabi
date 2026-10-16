import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadKnownWords } from '../knownWords';
import { fetchTodaySuggestions, TODAY_SUGGESTIONS_KEY } from '../suggestionReading';

// 계약: 브라우저 조회 감사(작고 안전한 4건) — 화면은 그대로, 같은 데이터를 덜 받는다.
// ① 자료실 분석 중 폴링은 상태 한 칸만(목록 통짜 재조회 금지), 내 소유 행만.
// ② 오늘의 추천은 키·조회 함수 하나(홈·자료실 공용 캐시).
// ③ 아는 단어는 60초 캐시 + 1000행 페이지 — 표시·해제가 setQueryData·무효화로 반영되기 때문.
// ④ 서재 「읽던 곳」은 30초 캐시 — 열람·서재 작업이 무효화하기 때문. 무효화 경로가 없는 쿼리는 0 유지.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

afterEach(() => { vi.unstubAllGlobals(); });

describe('① 자료실 분석 중 폴링', () => {
  const page = read('src/views/MaterialsPage.jsx');

  it('목록 쿼리 자체는 주기 재조회하지 않는다', () => {
    const list = page.match(/queryKey: \['materials', tab,[\s\S]*?\n {2}\}\);/)?.[0];
    expect(list, '자료실 목록 쿼리를 못 찾았다').toBeTruthy();
    expect(list).not.toContain('refetchInterval');
  });

  it('상태 폴링은 분석 중 id만, 상태 한 칸만 받는다 — processed_json 통짜 없음', () => {
    const poll = page.match(/queryKey: \['materials-analyzing-status'[\s\S]*?\n {2}\}\);/)?.[0];
    expect(poll, '상태 폴링 쿼리를 못 찾았다').toBeTruthy();
    expect(poll).toContain(".select('id, status:processed_json->>status')");
    expect(poll).toContain(".in('id', analyzingIds)");
    expect(poll).toContain('refetchInterval: 5000');
    expect(poll).toContain('enabled: analyzingIds.length > 0');
    // 선택 문자열에 경로 없는 processed_json(통짜)이 끼면 감사 전과 같은 무게가 된다.
    const selects = [...poll.matchAll(/\.select\('([^']*)'\)/g)].map((m) => m[1]);
    expect(selects).toHaveLength(1);
    expect(selects[0]).not.toMatch(/processed_json(?!->)/);
  });

  it('폴링 대상은 내 소유의 분석 중 행뿐이다(공개 화면의 남의 자료 제외)', () => {
    expect(page).toMatch(/m\.processed_json\?\.status === 'analyzing' && m\.owner_id === user\.id/);
  });

  it('상태가 바뀐 행이 있을 때만 목록을 무효화한다', () => {
    expect(page).toMatch(/analyzingIds\.some\(id => statusById\.get\(String\(id\)\) !== 'analyzing'\)\) \{\s*queryClient\.invalidateQueries\(\{ queryKey: \['materials'\] \}\)/);
  });
});

describe('② 오늘의 추천 — 키·조회 하나', () => {
  it('추천 키와 /api/suggestions/today 조회는 suggestionReading.js 한 곳에서만 정의된다', () => {
    const files = fs.readdirSync('src', { recursive: true }).map((f) => path.join('src', String(f)).split(path.sep).join('/'))
      .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes('__tests__') && !f.startsWith('src/app/api/'));
    const keyOwners = files.filter((f) => /['"](today-suggestions|suggestions-today)['"]/.test(read(f)));
    const fetchOwners = files.filter((f) => /fetch\(\s*['"`]\/api\/suggestions\/today/.test(read(f)));
    expect(keyOwners).toEqual(['src/lib/suggestionReading.js']);
    expect(fetchOwners).toEqual(['src/lib/suggestionReading.js']);
  });

  it('홈과 자료실이 같은 키·같은 함수를 쓴다', () => {
    for (const f of ['src/views/HomePage.jsx', 'src/views/MaterialsPage.jsx']) {
      const src = read(f);
      expect(src, f).toMatch(/queryKey: TODAY_SUGGESTIONS_KEY,/);
      expect(src, f).toContain('queryFn: fetchTodaySuggestions');
    }
    expect(TODAY_SUGGESTIONS_KEY).toEqual(['today-suggestions']);
  });

  it('실패는 던지고(빈 목록을 캐시하지 않음) 배열이 아닌 응답은 빈 목록', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(fetchTodaySuggestions()).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ error: 'x' }) })));
    await expect(fetchTodaySuggestions()).resolves.toEqual([]);
    const rows = [{ id: 'a', title: 't' }];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => rows })));
    await expect(fetchTodaySuggestions()).resolves.toEqual(rows);
  });
});

describe('③ 아는 단어 — 60초 캐시 · 1000행 페이지', () => {
  const hook = read('src/lib/useKnownWords.js');

  it('staleTime은 60초다(0 아님)', () => {
    expect(hook).toContain('staleTime: 60 * 1000');
    expect(hook).not.toMatch(/staleTime:\s*0\b/);
  });

  it('표시·해제 성공 시 두 캐시를 직접 고치고 무효화한다', () => {
    const onSuccess = hook.match(/onSuccess: \(_, body\) => \{[\s\S]*?\n {4}\},/)?.[0];
    expect(onSuccess, 'onSuccess를 못 찾았다').toBeTruthy();
    expect(onSuccess).toContain("client.setQueryData(['known-words', body.accountId, body.lang]");
    expect(onSuccess).toContain("client.setQueryData(['known-words-all', body.accountId]");
    expect(onSuccess).toMatch(/\['known-words', 'known-words-all',[\s\S]*?client\.invalidateQueries\(\{ queryKey: \[prefix, body\.accountId\] \}\)/);
  });

  it('1000행씩 순차로 읽는다', async () => {
    const all = Array.from({ length: 1500 }, (_, i) => ({ word_text: String(i), lang: 'en' }));
    const ranges = [];
    const client = { from: () => {
      const q = { select: () => q, eq: () => q, order: () => q,
        range: async (start, end) => { ranges.push([start, end]); return { data: all.slice(start, end + 1) }; } };
      return q;
    } };
    expect(await loadKnownWords(client, 'owner')).toHaveLength(1500);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  });
});

describe('④ 서재 — 무효화 경로가 있는 쿼리만 30초', () => {
  const shelf = read('src/components/library/LibraryShelf.jsx');

  it('읽던 곳(library-recent)은 30초 캐시', () => {
    expect(shelf).toContain("queryKey:['library-recent',user.id],staleTime:30000,");
  });

  it('무효화 경로가 없는 personal-library·library-pinned는 0 유지', () => {
    // 자료 추가(MaterialAddPage)는 personal-library를, 받아두기(offlineCache)는 library-pinned를 무효화하지 않는다.
    // 경로가 생기기 전에 캐시를 늘리면 방금 더한 자료가 서재에 늦게 뜬다.
    expect(shelf).toMatch(/queryKey:\['library-pinned',user\.id\][^\n]*staleTime:0\}/);
    expect(shelf).toMatch(/queryKey:\['personal-library',user\.id,[\s\S]{0,400}?staleTime:0\}\);/);
  });

  it('열람 기록과 서재 작업이 library-recent를 무효화한다', () => {
    const activity = read('src/components/library/useLibraryActivity.js');
    expect(activity).toMatch(/recordLibraryOpen\([\s\S]*?\.then\(\(\)=>\{[\s\S]*?cache\.invalidateQueries\(\{queryKey:\['library-recent',user\.id\]\}\)/);
    const ops = read('src/lib/libraryOperations.js');
    expect(ops).toMatch(/export async function invalidateLibrary\(cache,owner\)\{\s*await Promise\.all\(\[[^\]]*'library-recent'/);
  });

  it('뷰어·PDF·교재·원본 열람이 모두 열람 기록 훅을 탄다', () => {
    for (const f of ['src/views/ViewerPage.jsx', 'src/views/PdfViewerPage.jsx', 'src/components/books/BookReader.jsx',
      'src/components/materials/OriginalMaterialReader.jsx', 'src/components/materials/OriginalFileReader.jsx']) {
      expect(read(f), f).toMatch(/\n\s*useLibraryActivity\(/);
    }
  });
});
