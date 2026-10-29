// 과 본문 기억 · 다음 과 미리 받기 · 받는 동안 골격 · 표지 담기 자리(BOOKS-FLOW-001 · 002, 2026-10-18 KST).
// ① 다녀온 과는 다시 받지 않는다(기억, 최근 8과) ② 과 끝 줄이 보이면 다음 과를 미리 받는다 — 「다음 과」를 누르면 기억에서 바로,
//    받는 중이면 그 요청을 함께 써서 **요청 수는 늘지 않는다** ③ 처음 여는 과는 빈 본문 · 상태 줄 대신 기존 본문 골격
// ④ 로그인 확인 중 표지의 담기 버튼 자리(44px)를 서버 첫 그림부터 잡고, 손님으로 확정되면 접는다(CLS).
// 공개 판본 본문은 판본 id + 과가 정하는 고정 출력물이고 사용자 값이 없다(bookReadingCache.test.js). 미리보기(미발행)는 기억 · 미리 받기 0.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { forgetUnits, loadUnit, prefetchUnit, rememberUnit, rememberedUnit } from '../../components/books/unitMemory';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const reader = read('src/components/books/BookReader.jsx');
const home = read('src/components/books/BookHome.jsx');
const sections = [{ id: 'u02-start', unit: 'u02', html: '<p>b</p>' }];
const ok = () => vi.fn(async () => ({ ok: true, json: async () => ({ sections }) }));

describe('기억 규칙 — 최근 과 8개', () => {
  beforeEach(() => forgetUnits());
  it('같은 키면 같은 본문, 없으면 null', () => {
    rememberUnit('japanese-n5:e1:u01', sections);
    expect(rememberedUnit('japanese-n5:e1:u01')).toBe(sections);
    expect(rememberedUnit('japanese-n5:e2:u01')).toBeNull(); // 다른 판본
    expect(rememberedUnit('japanese-n4:e1:u01')).toBeNull(); // 다른 교재
  });
  it('9번째부터 가장 오래 쓰지 않은 과를 버린다 — 꺼내 쓴 과는 최근으로', () => {
    for (let i = 1; i <= 8; i++) rememberUnit(`b:e:u0${i}`, [i]);
    expect(rememberedUnit('b:e:u01')).toEqual([1]);
    rememberUnit('b:e:u09', [9]);
    expect(rememberedUnit('b:e:u02')).toBeNull();
    expect(rememberedUnit('b:e:u01')).toEqual([1]);
  });
});

describe('미리 받기 — 요청 수는 늘지 않는다', () => {
  beforeEach(() => forgetUnits());
  it('미리 받은 과를 열면 요청이 더 나가지 않는다(완료 뒤)', async () => {
    const fetchImpl = ok();
    expect(prefetchUnit('b:e:u02', '/r?unit=u02', fetchImpl)).toBe(true);
    await vi.waitFor(() => expect(rememberedUnit('b:e:u02')).toBe(sections));
    expect(await loadUnit('b:e:u02', '/r?unit=u02', fetchImpl)).toBe(sections);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('미리 받는 중에 열면 그 요청을 함께 쓴다 · 여러 번 보여도 한 번만 미리 받는다', async () => {
    const fetchImpl = ok();
    prefetchUnit('b:e:u02', '/r?unit=u02', fetchImpl);
    expect(prefetchUnit('b:e:u02', '/r?unit=u02', fetchImpl)).toBe(false);
    expect(await loadUnit('b:e:u02', '/r?unit=u02', fetchImpl)).toBe(sections);
    expect(prefetchUnit('b:e:u02', '/r?unit=u02', fetchImpl)).toBe(false); // 이미 기억
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('미리 받기가 실패하면 기억하지 않고, 열 때 다시 받는다', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'x' }) }));
    prefetchUnit('b:e:u03', '/r?unit=u03', fetchImpl);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rememberedUnit('b:e:u03')).toBeNull();
    await expect(loadUnit('b:e:u03', '/r?unit=u03', fetchImpl)).rejects.toThrow('x');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('배선 — BookReader 본문 받기 · 미리 받기 · 골격', () => {
  const load = sliceBetween(reader, 'const controller = new AbortController();', '}, [bookId, book.edition, unit, preview]);');
  it('기억한 과는 받지 않고 바로 그린다(빈 본문을 거치지 않는다) — 미리보기는 기억을 쓰지 않는다', () => {
    expect(load).toContain("const memoryKey = `${bookId}:${book.edition}:${unit}`, remembered = preview ? null : rememberedUnit(memoryKey);");
    expect(load).toContain('if (remembered) { setSections(remembered); setLoading(false); return () => controller.abort(); }');
    expect(load.indexOf('if (remembered)')).toBeLessThan(load.indexOf('setSections([]); setLoading(true);'));
  });
  it('공개 판본은 loadUnit(미리 받기와 같은 요청) — 미리보기만 따로 받는다', () => {
    expect(load).toContain(': loadUnit(memoryKey, url);');
    expect(load).toMatch(/const request = preview\s*\? fetch\(url, \{ signal: controller\.signal \}\)/);
    expect(load).toContain('return () => { stale = true; controller.abort(); };');
  });
  it('표지로 가면 본문을 비운다(지난 과가 남지 않게)', () => {
    expect(load).toContain("if (!unit || unit === 'cover') { setSections([]); setLoading(false); return () => controller.abort(); }");
  });
  it('과 끝 줄이 보이면 다음 과를 한 번 미리 받는다 — 발행 판본 · 다음 과가 있을 때만', () => {
    const pre = sliceBetween(reader, 'const finishRef = useRef(null), nextUnit = next?.id;', '}, [bookId, book.edition, nextUnit, preview, sections]);');
    expect(pre).toContain("if (preview || !nextUnit || !node || typeof IntersectionObserver === 'undefined') return undefined;");
    expect(pre).toContain('observer.disconnect();');
    expect(pre).toContain('prefetchUnit(`${bookId}:${book.edition}:${nextUnit}`, `/api/books/${bookId}/${book.edition}/reading?unit=${nextUnit}`);');
    expect(reader).toContain('<section ref={finishRef} className="manabi-chapter-finish"');
  });
  it('과를 받는 동안은 기존 본문 골격(BookReaderSkeleton)이 본문 화면 자리를 대신한다 — 상태 줄 없음', () => {
    expect(reader).toContain(': loading ? <BookReaderSkeleton announce lesson={lessonPage(pageId)} level={level} /> : <div className="manabi-reader-page">');
    expect(reader).not.toContain('본문을 펼치고 있어요');
    expect(reader).toContain('}, [unit, measureToolbar, loading]);'); // 다 받으면 새 도구 줄을 다시 잰다
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/books/BookReaderSkeleton.jsx'))).toBe(true);
  });
});

describe('표지 담기 버튼 자리 — 로그인 확인 중 미리 잡기', () => {
  it('서버가 본 세션 쿠키(이름만)를 교재 화면이 넘긴다 — N5 · N4', () => {
    for (const page of ['src/app/(app)/books/japanese-n5/page.jsx', 'src/app/(app)/books/japanese-n4/page.jsx']) {
      const src = read(page);
      expect(src, page).toContain('const sessionHint = hasSupabaseSessionInJar(await cookies());');
      expect(src, page).toContain('sessionHint={sessionHint}');
    }
    expect(reader).toContain('sessionHint={sessionHint} returnTo={returnTo} />');
    // 쿼리 없는 첫 화면 판(ISR — GUEST-STATIC-001 4단계)은 middleware가 같은 판정으로 고른 판(member)을 넘긴다 — 쿠키는 읽지 않는다.
    expect(read('src/components/books/BookCoverStatic.jsx')).toContain('sessionHint={member}');
    for (const book of ['n5', 'n4', 'n3']) expect(read(`src/app/(app)/books/japanese-${book}/cover/[hint]/page.jsx`)).toContain("member={hint === 'member'}");
  });
  it('쿠키가 있으면 확인 중(loading)에 자리를 잡고, 끝나면 버튼(또는 손님이면 접힘) — 쿠키 없는 손님은 자리 자체가 없다', () => {
    expect(home).toContain("sessionHint ? <div className=\"book-library-slot\" data-pending={authLoading ? '' : undefined}><LibrarySaveButton");
    expect(home).toContain(': <LibrarySaveButton edition={book.edition}');
    expect(read('src/components/books/reading-shell.css')).toContain('.manabi-book-home .book-library-slot[data-pending]{min-height:44px}');
    expect(read('src/components/library/library.css')).toContain('.library-save-control button{font:inherit;cursor:pointer;min-height:44px'); // 잡는 높이 = 버튼 줄 높이
  });
});
