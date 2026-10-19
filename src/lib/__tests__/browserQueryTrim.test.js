import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadKnownWords } from '../knownWords';
import { fetchTodaySuggestions, TODAY_SUGGESTIONS_KEY } from '../suggestionReading';
import { sliceBetween } from './helpers/sliceBetween';

// 계약: 브라우저 조회 감사(작고 안전한 4건) — 화면은 그대로, 같은 데이터를 덜 받는다.
// ① 자료실 분석 중 폴링은 상태 한 칸만(목록 통짜 재조회 금지), 내 소유 행만.
// ② 오늘의 추천은 키·조회 함수 하나(홈·자료실 공용 캐시).
// ③ 아는 단어는 60초 캐시 + 1000행 페이지 — 표시·해제가 setQueryData·무효화로 반영되기 때문.
// ④ 서재 쿼리(읽던 곳·목록·받아두기 목록)는 30초 캐시 — 열람·읽은 위치·서재 작업·자료 추가·공개 범위·받아두기가
//    모두 무효화하기 때문. 쓰기 지점이 늘면 아래 전수 단언이 무효화 누락을 잡는다.

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
    // 무효화 목록은 한 곳(KNOWN_CONSUMERS) — 레벨 초기화 되돌리기(restoreMany)도 같은 목록을 쓴다(LEVEL-ROUND-001 ②).
    // 재조회는 기다리지 않는다 — 기다리면 그 단어가 재조회 내내 「진행 중」으로 잠긴다(단어 목록 O · X 지연).
    expect(onSuccess).toContain('refreshKnownConsumers(client, body.accountId).catch(');
    expect(onSuccess).not.toMatch(/(return|await) refreshKnownConsumers/);
    expect(hook).toMatch(/const KNOWN_CONSUMERS = \['known-words', 'known-words-all',[\s\S]*?client\.invalidateQueries\(\{ queryKey: \[prefix, accountId\] \}\)/);
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

describe('④ 서재 — 쓰기 지점이 무효화하므로 30초 캐시', () => {
  const shelf = read('src/components/library/LibraryShelf.jsx');
  const clientFiles = fs.readdirSync('src', { recursive: true }).map((f) => path.join('src', String(f)).split(path.sep).join('/'))
    .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes('__tests__') && !f.startsWith('src/app/api/') && !f.startsWith('src/lib/server/'));

  it('읽던 곳·목록·받아두기 목록은 30초 캐시', () => {
    // 읽던 곳 · 목록 · 대화 · 폴더의 키와 캐시 시간은 서버 미리 받기와 함께 쓰는 정본(libraryShelfQueries)에 있다.
    const queries = read('src/lib/libraryShelfQueries.js');
    expect(queries).toContain('export const LIBRARY_SHELF_STALE_MS = 30000;');
    for (const key of ["['library-recent', ownerId]", "['library-conversations', ownerId]", "['library-collections', ownerId]", "['personal-library', ownerId, keyFilters, pinnedIds]"]) {
      expect(queries).toContain(`queryKey: ${key}, staleTime: LIBRARY_SHELF_STALE_MS`);
    }
    expect(shelf).toContain('const recent=useQuery(libraryRecentQuery(supabase,user.id));');
    expect(shelf).toMatch(/queryKey:\['library-pinned',user\.id\][^\n]*staleTime:30000\}/);
    expect(shelf).not.toMatch(/staleTime:0\b/);
  });

  it('invalidateLibrary가 서재 목록·읽던 곳을 함께 무효화한다', () => {
    const ops = read('src/lib/libraryOperations.js');
    const keys = ops.match(/export async function invalidateLibrary\(cache,owner\)\{\s*await Promise\.all\(\[([^\]]*)\]/)?.[1] || '';
    expect(keys).toContain("'personal-library'");
    expect(keys).toContain("'library-recent'");
  });

  it('화면의 자료·PDF 쓰기 지점(insert/update/delete)은 모두 서재를 무효화한다', () => {
    // src/lib의 저장 도우미는 캐시를 모른다 — 무효화는 그것을 부르는 화면이 맡는다(아래 개별 단언).
    const writers = clientFiles.filter((f) => !f.startsWith('src/lib/'))
      .filter((f) => /from\('(reading_materials|uploaded_pdfs)'\)\s*\.(insert|update|delete|upsert)\(/.test(read(f)));
    expect(writers.length).toBeGreaterThan(0);
    for (const f of writers) expect(read(f), f).toMatch(/invalidateLibrary\(|queryKey: ?\['personal-library'/);
  });

  it('자료 추가 — 본문 저장·분석 종료·책 챕터 일괄 등록·PDF 업로드가 invalidateLibrary를 탄다', () => {
    const add = read('src/views/MaterialAddPage.jsx');
    expect(add).toContain('const refreshLibrary = () => { if (user?.id) invalidateLibrary(queryClient, user.id); };');
    // 책: insert/RPC 직후, 본문: 저장 직후(화면을 떠났어도), 분석 종료: finally에서 무조건.
    expect(add).toMatch(/inserted = data;\n {6}\}\n {6}refreshLibrary\(\);/);
    expect(add).toMatch(/await saveImportOnce\([^)]*\);\n(?:\s*\/\/[^\n]*\n)?\s*refreshLibrary\(\);\n\s*if \(!aliveRef\.current\) return;/);
    expect(add).toMatch(/if \(aliveRef\.current\) setIsProcessing\(false\);\n\s*refreshLibrary\(\);/);
    const pdf = read('src/views/MaterialAddPdfSection.jsx');
    expect(pdf).toMatch(/if \(insertErr\) throw insertErr;[\s\S]{0,120}invalidateLibrary\(queryClient, user\.id\);/);
  });

  it('자료실 공개 범위 토글이 invalidateLibrary를 탄다', () => {
    const page = read('src/views/MaterialsPage.jsx');
    const toggle = page.match(/const toggleVisibilityMutation = useMutation\(\{[\s\S]*?\n {2}\}\);/)?.[0];
    expect(toggle, '공개 범위 토글을 못 찾았다').toBeTruthy();
    expect(toggle).toMatch(/onSuccess:[\s\S]*invalidateLibrary\(queryClient, user\.id\)/);
  });

  it('받아두기·해제 호출마다 library-pinned를 무효화한다', () => {
    const callers = clientFiles.filter((f) => f !== 'src/lib/offlineCache.js' && /\.(pinMaterial|unpinMaterial)\(/.test(read(f)));
    expect(callers).toEqual(['src/views/MaterialsPage.jsx']);
    for (const f of callers) {
      const calls = [...read(f).matchAll(/await cache\.(?:pin|unpin)Material\([^)]*\);\n\s*([^\n]*)/g)];
      expect(calls).toHaveLength(2);
      for (const [, next] of calls) expect(next, f).toBe("queryClient.invalidateQueries({ queryKey: ['library-pinned', user?.id] });");
    }
  });

  it('읽은 위치 저장이 서재 목록·읽던 곳을 무효화하고, 정의 없는 옛 키는 남지 않았다', () => {
    const scroll = read('src/lib/useScrollRestore.js');
    expect(scroll).toContain("queryClient.invalidateQueries({ queryKey: ['library-recent', owner] });");
    expect(scroll).toContain("queryClient.invalidateQueries({ queryKey: ['personal-library', owner] });");
    expect(clientFiles.filter((f) => read(f).includes('library-reading-v2'))).toEqual([]);
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

describe('⑤ 단어장 1000행 상한 — 브라우저 조회가 조용히 잘리지 않는다', () => {
  const clientFiles = fs.readdirSync('src', { recursive: true }).map((f) => path.join('src', String(f)).split(path.sep).join('/'))
    .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes('__tests__') && !f.startsWith('src/app/api/') && !f.startsWith('src/lib/server/'));

  it('user_vocabulary·vocabulary_with_exclusions 읽기는 모두 범위가 있거나 정본 완전 조회를 탄다', () => {
    // 실측 최대 1,232행 — PostgREST 기본 상한(1000) 아래로 범위를 두지 않은 select는 뒤쪽 행을 말없이 버린다.
    const unbounded = [];
    for (const f of clientFiles) {
      const src = read(f);
      for (const m of src.matchAll(/\.from\(\s*'(user_vocabulary|vocabulary_with_exclusions)'\s*\)/g)) {
        let end = src.indexOf(';', m.index);
        if (end < 0 || end - m.index > 700) end = m.index + 700;
        const chain = src.slice(m.index, end);
        const head = chain.split('.select(')[0];
        if (!chain.includes('.select(') || /\.(insert|update|upsert|delete)\(/.test(head)) continue;
        const complete = /readCompleteLegacyRows\(\(\) =>\s*(?:client|supabase)?\s*$/.test(src.slice(Math.max(0, m.index - 80), m.index));
        // .limit(n)은 n ≤ 1000일 때만 경계다 — 더 크면 서버가 1000에서 말없이 자른다(⑥과 같은 판정, REVIEW-ROWS-CAP-001).
        const limits = [...chain.matchAll(/\.limit\(\s*(\d+)\s*\)/g)].map(([, n]) => Number(n));
        const bounded = /\.range\(|\.single\(|\.maybeSingle\(|head:\s*true|\.in\(|\.eq\(\s*'id'/.test(chain)
          || (limits.length > 0 && limits.every((n) => n <= 1000));
        if (!complete && !bounded) unbounded.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(unbounded).toEqual([]);
  });

  it('맞춤도 담김 인덱스·PDF 담김 표시·단어장 본체·주간 리포트·내보내기가 정본 완전 조회를 쓴다', () => {
    expect(read('src/views/MaterialsPage.jsx')).toMatch(/readCompleteLegacyRows\(\(\) => supabase\s*\.from\('user_vocabulary'\)\s*\.select\('id, word_text, base_form', \{ count: 'exact' \}\)/);
    expect(read('src/views/PdfViewerPage.jsx')).toMatch(/readCompleteLegacyRows\(\(\) => supabase\.from\('user_vocabulary'\)\s*\.select\('id, word_text, base_form', \{ count: 'exact' \}\)/);
    expect(read('src/lib/vocabIO.js')).toMatch(/readCompleteLegacyRows\(\(\) => supabase\s*\.from\('vocabulary_with_exclusions'\)\s*\.select\('\*', \{ count: 'exact' \}\)/);
    expect(read('src/lib/weeklyReportRows.js')).toMatch(/readCompleteLegacyRows\(\(\) => supabase\.from\('user_vocabulary'\)\.select\('id, created_at', \{ count: 'exact' \}\)/);
    const account = read('src/components/AccountSettings.jsx');
    for (const table of ['user_vocabulary', 'reading_materials', 'reading_progress', 'grammar_notes', 'writing_practice', 'uploaded_pdfs']) {
      expect(account, table).toMatch(new RegExp(`exportRows\\('${table}', '(user_id|owner_id)', user\\.id`));
    }
    expect(account).not.toMatch(/supabase\.from\('(user_vocabulary|reading_materials|reading_progress|grammar_notes|writing_practice|uploaded_pdfs)'\)\.select\('\*'\)/);
  });

  it('정본 완전 조회는 1000행을 넘는 단어장을 끝까지 읽는다', async () => {
    const { readCompleteLegacyRows } = await import('../legacyReviewSync');
    const all = Array.from({ length: 1232 }, (_, i) => ({ id: `v${String(i).padStart(4, '0')}`, word_text: `w${i}`, base_form: null }));
    const ranges = [];
    // 서버처럼 한 응답은 1000행에서 잘린다.
    const query = () => {
      const q = { order: () => q, range: async (from, to) => { ranges.push([from, to]); return { data: all.slice(from, Math.min(to, from + 999) + 1), count: all.length }; } };
      return q;
    };
    expect(await readCompleteLegacyRows(query)).toHaveLength(1232);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  });
});

describe('API로 만드는 서재 항목도 30초 캐시를 무효화한다(리뷰 2026-10-17 KST)', () => {
  it('새 노트 · 초안 복제(POST /api/notes) 직후 invalidateLibrary', () => {
    const note = fs.readFileSync('src/components/notes/StudyNotePage.jsx', 'utf8');
    const posts = note.match(/requestNote\('\/api\/notes',\{method:'POST'[^;]*\}\);[^;]*;/g) || [];
    expect(posts).toHaveLength(2);
    for (const call of posts) expect(call).toContain('void invalidateLibrary(queryClient,owner)');
  });
});

// ⑥ · ⑦ 공용 판정 — 한 읽기 체인이 1000행 상한에 잘리지 않는 형태인가.
const PAGE_CAP = 1000; // PostgREST max-rows — 이보다 큰 .limit은 말없이 이 값에서 잘린다(⑤의 「.limit(이 있으면 통과」 빈틈)

/** 한 읽기 체인의 판정 — 완전 조회 · head:true · .range( · .limit(n ≤ 1000) 중 하나. n이 이름이면 같은 파일의 기본값(name = N). */
function verdict(src, index) {
  let end = src.indexOf(';', index);
  if (end < 0 || end - index > 700) end = index + 700;
  const chain = src.slice(index, end);
  const head = chain.split('.select(')[0];
  if (!chain.includes('.select(') || /\.(insert|update|upsert|delete)\(/.test(head)) return 'write';
  if (/(?:readCompleteLegacyRows|completeRows)\(\(\) =>\s*(?:client|supabase)?\s*$/.test(src.slice(Math.max(0, index - 80), index))) return 'complete';
  if (/head:\s*true/.test(chain)) return 'head';
  if (/\.range\(/.test(chain)) return 'range';
  const limits = [...chain.matchAll(/\.limit\(\s*([\w.]+)\s*\)/g)].map(([, arg]) => {
    if (/^\d+$/.test(arg)) return Number(arg);
    const fallback = new RegExp(`\\b${arg}\\s*=\\s*(\\d+)\\b`).exec(src);
    return fallback ? Number(fallback[1]) : Infinity;
  });
  if (limits.length && limits.every((n) => n <= PAGE_CAP)) return 'limit';
  return 'unbounded';
}


describe('⑥ review_events 1000행 상한 — 브라우저 조회가 조용히 잘리지 않는다(REVIEW-ROWS-CAP-001)', () => {
  const clientFiles = fs.readdirSync('src', { recursive: true }).map((f) => path.join('src', String(f)).split(path.sep).join('/'))
    .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes('__tests__') && !f.startsWith('src/app/api/') && !f.startsWith('src/lib/server/'));
  it('클라이언트의 모든 review_events 읽기는 완전 조회 · head:true · .range( · .limit(n≤1000) 중 하나다', () => {
    const reads = [], unbounded = [];
    for (const f of clientFiles) {
      const src = read(f);
      for (const m of src.matchAll(/\.from\(\s*'review_events'\s*\)/g)) {
        const v = verdict(src, m.index);
        if (v === 'write') continue;
        reads.push(v);
        if (v === 'unbounded') unbounded.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(reads.length, '스캔 대상이 실제로 있다(공허 통과 방지)').toBeGreaterThanOrEqual(10);
    expect(unbounded).toEqual([]);
  });

  it('판정기 — .limit(2000) · .limit(5000) · 범위 없는 select는 잡고, 정본 경로는 통과시킨다', () => {
    const v = (code) => verdict(code, code.indexOf(".from('review_events')"));
    expect(v("supabase.from('review_events').select('a').eq('u', 1).limit(2000);")).toBe('unbounded');
    expect(v("supabase.from('review_events').select('a').limit(5000).then(f);")).toBe('unbounded');
    expect(v("supabase.from('review_events').select('a').eq('u', 1);")).toBe('unbounded');
    expect(v("const x = 200; function f({ limit = 600 }) { q.from('review_events').select('a').limit(limit); }")).toBe('limit');
    expect(v("supabase.from('review_events').select('a').limit(400);")).toBe('limit');
    expect(v("readCompleteLegacyRows(() => supabase.from('review_events').select('a', { count: 'exact' }));")).toBe('complete');
    expect(v("q.from('review_events').select('id', { count: 'exact', head: true }).in('item_key', ids);")).toBe('head');
    expect(v("client.from('review_events').select('a').range(0, 999);")).toBe('range');
    expect(v("supabase.from('review_events').insert(rows);")).toBe('write');
  });

  it('잘리던 세 곳 — 주간 리포트 완전 조회 · 한자 표시 묶음 페이지 · 드릴 건수', () => {
    expect(read('src/lib/weeklyReportRows.js')).toMatch(/readCompleteLegacyRows\(\(\) => supabase\.from\('review_events'\)\s*\.select\('id, source, item_key, correct, created_at', \{ count: 'exact' \}\)/);
    expect(read('src/components/levels/HanziBoard.jsx')).toContain('fetchLastHanziMarks(supabase, userId, allChars)');
    expect(read('src/lib/hanziSession.js')).toContain('.range(from, from + page - 1)');
    expect(read('src/components/ChapterDrills.jsx')).toContain(".select('id', { count: 'exact', head: true })");
  });
});

describe('⑦ 늘어나는 개인 표 — 만남(user_vocab_encounters) 읽기도 잘리지 않는다(ROW-CAP-SWEEP-001)', () => {
  const clientFiles = fs.readdirSync('src', { recursive: true }).map((f) => path.join('src', String(f)).split(path.sep).join('/'))
    .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !f.includes('__tests__') && !f.startsWith('src/app/api/') && !f.startsWith('src/lib/server/'));
  // 예외 — 실측과 이유. 2주 창이라 1000을 넘기기 어렵다(2026-10-17 KST 운영 읽기: 14일 첫 만남 사용자 최대 72).
  const ALLOW = Object.freeze({ 'src/lib/weeklyReportRows.js': '주간 리포트 — first_met_at 2주 창, 실측 최대 72행' });

  it('클라이언트의 만남 읽기는 완전 조회 · head · range · limit(≤1000) · .in(묶음) 중 하나다(예외는 이유 목록)', () => {
    const reads = [], unbounded = [];
    for (const f of clientFiles) {
      const src = read(f);
      for (const m of src.matchAll(/\.from\(\s*'user_vocab_encounters'\s*\)/g)) {
        const v = verdict(src, m.index);
        if (v === 'write') continue;
        const end = src.indexOf(';', m.index);
        const chunked = /\.in\(/.test(src.slice(m.index, end < 0 ? m.index + 700 : end));
        reads.push(`${f}:${v}`);
        if (v === 'unbounded' && !chunked && !ALLOW[f]) unbounded.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(reads.length, '스캔 대상이 실제로 있다').toBeGreaterThanOrEqual(3);
    expect(unbounded).toEqual([]);
  });

  it('새 기기로 끌어오기(vocabEncounterSync)는 word_text 정렬 range 페이지 루프다 — 1000개를 넘는 만남도 빠지지 않는다', () => {
    const pull = sliceBetween(read('src/components/world/vocabEncounterSync.js'), 'const remote = new Set();', 'const before = loadVocabEncounters(lang, storage);');
    expect(pull).toContain(".order('word_text', { ascending: true })");
    expect(pull).toContain('.range(from, from + ENCOUNTER_PULL_PAGE - 1)');
    expect(pull).toContain('if ((data || []).length < ENCOUNTER_PULL_PAGE) break;');
    expect(pull).toContain('if (error) return false;');
  });
});
