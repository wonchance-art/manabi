// 본문 위치로 바로 열기(BOOK-HASH-ENTRY-001): /books/japanese-n5#u01-start로 들어오면 첫 쪽이 계정 확인(sync)까지 'cover'라
// 표지(BookHome)가 비쳤다(390폭 ~34ms, 빌드 실측 2026-10-17 KST). 계약 = ① 하드 로드 감춤 한 줄(HASH_GATE)의 판정
// ② 붙은 뒤 그리기 전 hash로 첫 쪽 ③ 앵커 이동 · 진도 기록은 sync 뒤. 실제 표지 0프레임은 빌드 Playwright가 본다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { HASH_GATE, HASH_GATE_CSS, HASH_GATE_ID, HASH_GATE_PLAIN_CSS, coverPage, lessonPage, pageFromHash } from '../../components/books/bookEntryGate';

const ROOT = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(ROOT, 'src/components/books/BookReader.jsx'), 'utf8');
// 감춤 한 줄은 정본 문자열(bookEntryGate.HASH_GATE)을 그대로 vm에서 실행해 판정을 본다.
const gateFor = (hash, state = null, href = `https://manabi.test/books/japanese-n5${hash}`, existing = false) => {
  const appended = [];
  const document = { getElementById: () => (existing ? {} : null), createElement: () => ({}), head: { appendChild: (node) => appended.push(node) } };
  vm.runInNewContext(HASH_GATE, { location: { hash, href }, history: { state }, document });
  return appended;
};

describe('하드 로드 감춤 한 줄 — HASH_GATE', () => {
  it('본문 위치 hash면 표지를 감추는 style 하나를 head에 넣는다', () => {
    for (const hash of ['#u01-start', '#u29-patterns', '#reference-start', '#web-u02-start', '#%75%30%31-start']) {
      const nodes = gateFor(hash);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(HASH_GATE_ID);
      expect(nodes[0].textContent.startsWith(HASH_GATE_CSS)).toBe(true); // 과가 아닌 쪽은 아래에서 본다(+ HASH_GATE_PLAIN_CSS)
    }
  });
  it('표지 · 목차 · hash 없음 · 깨진 hash는 그대로(표지가 첫 화면)', () => {
    for (const hash of ['', '#', '#cover', '#toc', '#toc-part2', '#%E0%A4%A']) expect(gateFor(hash)).toHaveLength(0);
  });
  it('hash가 없어도 이 기록에 읽던 자리가 있으면 감춘다(계정 대조는 sync가 한다)', () => {
    const href = 'https://manabi.test/books/japanese-n5?edition=x';
    expect(gateFor('', { manabiBookPosition: { href } }, href)).toHaveLength(1);
    expect(gateFor('', { manabiBookPosition: { href: href + '&other' } }, href)).toHaveLength(0);
  });
  it('과가 아닌 쪽이면 과 머리 칸(부제 · 목표 · 과 번호)도 끈다 — 과 · 읽던 자리(hash 없음)는 그대로', () => {
    for (const hash of ['#reference-start', '#guide-start', '#culture-1']) expect(gateFor(hash)[0].textContent).toBe(HASH_GATE_CSS + HASH_GATE_PLAIN_CSS);
    for (const hash of ['#u01-start', '#u29-patterns', '#web-u02-start']) expect(gateFor(hash)[0].textContent).toBe(HASH_GATE_CSS);
    const href = 'https://manabi.test/books/japanese-n5';
    expect(gateFor('', { manabiBookPosition: { href } }, href)[0].textContent).toBe(HASH_GATE_CSS);
    expect(HASH_GATE_PLAIN_CSS).toBe(':root .book-entry-skeleton .book-entry-lesson{display:none}');
    for (const [id, lesson] of [['u01-start', true], ['u42-review', true], ['reference-start', false], ['guide-start', false], ['culture-1', false], ['cover', true]]) expect(lessonPage(id)).toBe(lesson);
  });
  it('이미 넣었으면 다시 넣지 않는다(교재 대기 골격과 BookReader가 둘 다 보낸다)', () => {
    expect(gateFor('#u01-start', null, undefined, true)).toHaveLength(0);
  });
  it('JS 판정(pageFromHash · coverPage)과 같은 규칙', () => {
    for (const [hash, page] of [['#u01-start', 'u01-start'], ['#web-u02-start', 'u02-start'], ['', 'cover'], ['#%E0%A4%A', 'cover'], ['#toc-part2', 'toc-part2']]) expect(pageFromHash(hash)).toBe(page);
    for (const hash of ['#u01-start', '#u29-patterns', '#reference-start', '#cover', '#toc', '', '#%E0%A4%A']) expect(gateFor(hash).length === 1).toBe(!coverPage(pageFromHash(hash)));
  });
  it('감춤 style = 표지(BookHome · 교재 대기 골격) 끄기 + 본문 골격 켜기, 평소 본문 골격은 꺼짐', () => {
    expect(HASH_GATE_CSS).toBe(':root .book-reader>.manabi-book-home,:root .manabi-book-home[aria-busy]{display:none}:root .book-entry-skeleton{display:block}');
    expect(fs.readFileSync(path.join(ROOT, 'src/components/books/reading-shell.css'), 'utf8')).toContain('\n.book-entry-skeleton{display:none}\n');
  });
  it('서버 · 하이드레이션 첫 그림은 표지 + 그 한 줄 + 꺼진 본문 골격(불일치 0), 첫 쪽이 정해지면 뗀다', () => {
    expect(source).toContain("{unit === 'cover' && !entryDecided && <><script dangerouslySetInnerHTML={{ __html: HASH_GATE }} /><BookReaderSkeleton gated /></>}");
    expect(source).toContain("const [pageId, setPageId] = useState('cover')");
    expect(source).toContain("import { HASH_GATE, coverPage, hashGate, pageFromHash } from './bookEntryGate';");
  });
});

describe('붙은 뒤 그리기 전 — 첫 쪽 정하기', () => {
  const first = sliceBetween(source, '// 첫 쪽(BOOK-HASH-ENTRY-001)', 'const rememberPosition = useCallback(');
  it('layout effect에서 hash로 첫 쪽 · 앵커 대기를 정하고, 읽던 자리가 있으면 sync까지 감춘다', () => {
    expect(first).toContain('useLayoutEffect(() => {\n    const id = pageFromHash(window.location.hash);');
    expect(first).toContain('if (!coverPage(id)) { pendingAnchor.current = id; setPageId(id); setActive(id); }');
    expect(first).toContain('if (window.history.state?.manabiBookPosition?.href === window.location.href) hashGate(true);');
    expect(first).toContain('else setEntryDecided(true);');
    expect(first).toContain('useLayoutEffect(() => { if (entryDecided) hashGate(false); }, [entryDecided]);');
    expect(first).toContain('useLayoutEffect(() => () => hashGate(false), []);'); // 떠날 때 감춤을 남기지 않는다
  });
  it('sync도 같은 hash 해석(pageFromHash)을 쓰고, 끝나면 감춤을 푼다', () => {
    const sync = sliceBetween(source, 'const sync = restorePosition => {', '\n    };');
    expect(sync).toContain('let id = pageFromHash(window.location.hash);');
    expect(sync).toContain('setEntryDecided(true);');
    expect(sync).not.toContain('decodeURIComponent'); // 해석은 pageFromHash 한 곳(HASH_GATE는 같은 규칙의 하드 로드판)
  });
  it('앵커 이동(과 그 뒤 진도 기록)은 계정 확인 뒤 — 첫 쪽을 먼저 정해도 읽던 자리 대조를 앞지르지 않는다', () => {
    const anchor = sliceBetween(source, '// 계정 확인(sync) 전에는 옮기지 않는다', 'let frame, cancelled = false;');
    expect(anchor).toContain('if (authLoading || !ready ||');
    expect(source).toContain('}, [authLoading, pageId, anchorRequest, sections, examples, unit, update, ready, measureToolbar, reference, rememberPosition]);');
  });
});
