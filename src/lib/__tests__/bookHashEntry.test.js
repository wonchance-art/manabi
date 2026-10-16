// 본문 위치로 바로 열기(BOOK-HASH-ENTRY-001): /books/japanese-n5#u01-start로 들어오면 첫 쪽이 계정 확인(sync)까지 'cover'라
// 표지(BookHome)가 비쳤다(390폭 ~34ms, 빌드 실측 2026-10-17 KST). 계약 = ① 하드 로드 감춤 한 줄(HASH_GATE)의 판정
// ② 붙은 뒤 그리기 전 hash로 첫 쪽 ③ 앵커 이동 · 진도 기록은 sync 뒤. 실제 표지 0프레임은 빌드 Playwright가 본다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const ROOT = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(ROOT, 'src/components/books/BookReader.jsx'), 'utf8');
// 모듈을 불러오지 않고(브라우저 전용 의존성) 정본 문자열을 그대로 꺼내 평가한다.
const constant = (name) => {
  const line = sliceBetween(source, `const ${name} = `, ';\n');
  return vm.runInNewContext(line.replace(/^const \w+ = /, ''), { HASH_GATE_ID: 'book-hash-gate', HASH_GATE_CSS: '.book-reader>.manabi-book-home{visibility:hidden}' });
};
const gateFor = (hash, state = null, href = `https://manabi.test/books/japanese-n5${hash}`) => {
  const ids = constant('HASH_GATE_ID'), css = constant('HASH_GATE_CSS');
  const script = sliceBetween(source, 'export const HASH_GATE = `', '`;').replace('export const HASH_GATE = `', '')
    .replace('${HASH_GATE_ID}', ids).replace('${HASH_GATE_CSS}', css);
  const appended = [];
  const document = { createElement: () => ({}), head: { appendChild: (node) => appended.push(node) } };
  vm.runInNewContext(script, { location: { hash, href }, history: { state }, document });
  return appended;
};

describe('하드 로드 감춤 한 줄 — HASH_GATE', () => {
  it('본문 위치 hash면 표지를 감추는 style 하나를 head에 넣는다', () => {
    for (const hash of ['#u01-start', '#u29-patterns', '#reference-start', '#web-u02-start', '#%75%30%31-start']) {
      const nodes = gateFor(hash);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toEqual({ id: 'book-hash-gate', textContent: '.book-reader>.manabi-book-home{visibility:hidden}' });
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
  it('서버 · 하이드레이션 첫 그림은 표지 + 그 한 줄(불일치 0), 첫 쪽이 정해지면 뗀다', () => {
    expect(source).toContain("{unit === 'cover' && !entryDecided && <script dangerouslySetInnerHTML={{ __html: HASH_GATE }} />}");
    expect(source).toContain("const [pageId, setPageId] = useState('cover')");
    expect(source).toContain("const HASH_GATE_CSS = '.book-reader>.manabi-book-home{visibility:hidden}';");
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
