// 뷰어 첫 쪽 먼저 그리기(VIEWER-WARM-001 — 오너 「권장대로」 2026-11-03 KST, 측정 B안).
// 브라우저가 본문을 그리는 첫 그림만 앞 줄 몇 개(약 160칸) → 첫 쪽이 안 차면 칠하기 전에 전부 · 차면 칠한 뒤 나머지.
// 서버가 본문을 그린 문서(손님 공개 자료)와 본문 귀환 주소는 처음부터 전부, 읽던 곳 되돌리기는 다 그린 뒤.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { WARM_FIRST_TOKENS, warmLineEnd } from '../readerSections';

const read = f => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const lines = counts => counts.map((n, i) => ({ rawIdx: i, tokenIds: Array.from({ length: n }, (_, k) => `id_${i}_${k}`) }));

describe('warmLineEnd — 앞 줄 몇 개', () => {
  it('낱말 칸이 budget에 닿는 줄까지(줄은 쪼개지 않는다)', () => {
    expect(WARM_FIRST_TOKENS).toBe(160);
    expect(warmLineEnd(lines([50, 50, 50, 50, 50]), 0, 5)).toBe(4); // 50·100·150·200 → 넷째 줄에서 닿음
    expect(warmLineEnd(lines([200, 10]), 0, 2)).toBe(1); // 한 줄이 넘쳐도 그 줄은 통째로
    expect(warmLineEnd(lines([10, 10, 10]), 0, 3)).toBe(3); // 다 그려도 못 닿으면 끝까지(= 앞 줄만 그리지 않음)
  });
  it('구간 안에서만 센다 — [from, to)', () => {
    const g = lines([100, 100, 100, 100, 100, 100]);
    expect(warmLineEnd(g, 2, 6)).toBe(4);
    expect(warmLineEnd(g, 5, 6)).toBe(6);
    expect(warmLineEnd(g, 0, 6, 1)).toBe(1);
    expect(warmLineEnd([], 0, 0)).toBe(0);
  });
});

describe('뷰어 배선', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  it('서버가 본문을 그린 문서는 처음부터 전부 — 하이드레이션 · 검색 본문 그대로', () => {
    expect(viewer).toContain('const [warmDoneId, setWarmDoneId] = useState(() => (ssrRow ? id : null));');
    expect(viewer).toContain("const WARM_SOURCE_PARAMS = ['sourceToken', 'sourceText', 'sourceContext', 'sourceEntry', 'sourceQuote'];");
    expect(viewer).toContain('const bodyWarm = warmDoneId !== id && !WARM_SOURCE_PARAMS.some(k => originalParams.has(k));');
  });
  it('본문 줄 그림만 자른다 — 구간 끝은 그대로 두고 앞 줄 끝까지', () => {
    const body = sliceBetween(viewer, '// 분석 완료 후: 줄 단위로 그룹핑', 'return lineGroups.slice(from, to)');
    expect(body).toContain('const to = bodyWarm ? warmLineEnd(lineGroups, from, sectionEnd) : sectionEnd;');
    expect(body).toContain('warmSliced.current = to < sectionEnd;');
  });
  it('마무리 — 안 잘렸으면 끝, 첫 쪽이 안 차면 칠하기 전에 전부, 차면 다음 프레임 뒤 작업에서', () => {
    const effect = sliceBetween(viewer, 'useLayoutEffect(() => {\n    if (!bodyWarm || !material) return;', '// 지나온 구간의 쪽 수');
    expect(effect).toContain('if (!warmSliced.current) { setWarmDoneId(id); return; }');
    // 쪽 상자는 DOM에서 — 본문과 같은 커밋에 처음 붙으면 pagesEl(상태)이 아직 null이라 쪽 넘김에서 앞 줄 그림이 칠하기 전에 버려졌다(실측 0 → 586칸).
    expect(effect).toContain("pagesNode = pagesEl || reader?.closest?.('[data-reader-pages]')");
    expect(effect).toContain('pagesNode.scrollWidth > pagesNode.clientWidth + 1');
    expect(effect).toContain('reader.getBoundingClientRect().bottom > window.innerHeight');
    expect(effect).toContain('if (!filled) { setWarmDoneId(id); return; }');
    expect(effect).toMatch(/requestAnimationFrame\(\(\) => \{ const t = setTimeout\(done, 0\)/);
  });
  it('앞 줄만 그린 동안 진도는 0(그룹 같이 읽기 최대값에 남지 않게) · 끝나는 커밋에서 바로 다시 잰다(옛 쪽 수 한 프레임 0)', () => {
    expect(viewer).toContain('const readProgress = bodyWarm && material ? 0 : pagedActive');
    expect(viewer).toContain('useLayoutEffect(() => { if (warmWas.current && !bodyWarm) pager.controller?.()?.relayout(); warmWas.current = bodyWarm && !!material; });');
  });
  it('쪽 막대는 앞 줄만 그린 동안 틀린 쪽 수 대신 자리만', () => {
    expect(viewer).toContain("if (bodyWarm && material) return { ...pager, labelText: '\\u00a0' };");
  });
  it('읽던 곳 되돌리기는 다 그린 뒤(ready) — 앞 줄에 없는 낱말을 못 찾고 포기하지 않게', () => {
    expect(viewer).toContain('useScrollRestore({ user, materialId: id, material, readingProgress, readerRef, ready: !bodyWarm })');
    const restore = read('src/lib/useScrollRestore.js');
    expect(restore).toContain('readerRef, ready = true })');
    expect(restore).toContain('if (!ready || !Number.isInteger(lastIdx) || lastIdx < 0 || restoredKey.current === key) return;');
    expect(restore).toContain('}, [readingProgress, material, key, ready]);');
  });
});
