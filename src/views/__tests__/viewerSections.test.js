import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

// VIEWER-SECTIONS-001 — 긴 글의 쪽 넘김은 지금 구간의 줄만 그린다(설계 · 쪽 막대 목업 오너 승인 2026-10-29 KST). 순수 계산은 readerSections.test,
// 구간 끝 넘김(onEdge)은 pagedReader.test. 여기는 뷰어 배선 — 빠지면 다른 구간으로 가는 이동(본문 귀환 · 읽던 곳 · 듣기 · 문장 이동)이 길을 잃는다.
const viewer = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8');
const css = fs.readFileSync('src/components/viewer/paged-reader.css', 'utf8');
const bar = fs.readFileSync('src/components/viewer/PageBar.jsx', 'utf8');

describe('VIEWER-SECTIONS-001 — 구간 그리기 배선', () => {
  it('쪽 넘김 · 긴 글에서만 구간 — 스크롤 보기 · 수업(pagedActive 아님)은 전부 그린다', () => {
    expect(viewer).toContain('const readerSections = pagedActive ? allSections : null;');
    expect(viewer).toContain('return lineGroups.slice(from, to).map((group, li) => {\n            const gi = from + li;');
    // 줄 바꿈 표시는 글 전체 기준 — 구간 마지막 줄 뒤에도 그대로(다음 구간과 붙여 읽혀도 줄이 같다).
    expect(viewer).toContain('{gi < lineGroups.length - 1 && <div className="line-break" />}');
  });
  it('구간 끝 넘김은 다음 구간 첫 쪽 · 앞 구간 마지막 쪽 — 사람이 넘긴 것이라 그 쪽을 읽던 곳으로 남긴다', () => {
    const edge = sliceBetween(viewer, 'onEdge: dir => {', 'return true;');
    expect(edge).toContain("sectionAnchor.current = { anchor: dir > 0 ? { kind: 'start' } : { kind: 'tail', fromEnd: 0 }, save: true };");
    expect(edge).toContain('sectionMoved.current = true;');
    // 바꿔 끼운 같은 틱에 다시 잰다(다음 프레임이면 옛 쪽 위치에 새 구간이 한 번 그려진다).
    const swap = sliceBetween(viewer, 'useLayoutEffect(() => {\n    const controller = pager.controller?.();\n    const pending = sectionAnchor.current;', '}, [section]);');
    expect(swap).toContain('controller.relayout();');
    expect(swap).toContain('if (pending?.save) controller.goTo(controller.state.page, { user: true });');
    expect(viewer).toMatch(/layoutKey: `[^`]*\|\$\{section\}`/);
  });
  it('다른 구간의 낱말로 가는 이동은 그 구간을 그린 뒤 — 본문 귀환 · 듣기 따라가기 · [지금 문장으로] · 문장 이동 · 보기 전환', () => {
    expect(viewer).toContain('resolveToken={sectionTokenElement}');
    const listen = sliceBetween(viewer, 'const handleListenSentence = useCallback((index) => {', '}, [listenRanges');
    // 자동 이동은 사람에게 진다 — 시트 · 범위 지정 · 키 차단 · 누르는 중이면 구간도 바꾸지 않는다.
    expect(listen).toContain('if (g.sheetOpen || g.dragging || g.blocked || pager.controller?.()?.pressed) return;');
    expect(listen).toContain('p.reveal(next, { auto: true })');
    expect(sliceBetween(viewer, 'const resumeListenFollow = () => {', '\n  };')).toContain('sectionTokenElement(ids[0]).then(el => {');
    expect(sliceBetween(viewer, 'const moveSentence = (dir) => {', '\n  };')).toContain('sectionTokenElement(target.firstTokenId).then(next =>');
    expect(sliceBetween(viewer, 'const changeReaderView = next => {', 'settings.setReaderView(next);')).toContain('setSectionIdx(anchorSection);');
    // 다른 구간으로 간 뒤 지워진 낱말 요소를 붙잡고 있지 않는다(분리된 요소의 좌표 0이 「보이는 문장」을 속인다).
    expect(viewer).toContain('ref={el => { if (el) tokenRefs.current[tokenId] = el; else delete tokenRefs.current[tokenId]; }}');
  });
  it('첫 구간 — 본문 귀환 토큰 · 읽던 곳이 든 구간(사람이 구간을 옮기기 전까지)', () => {
    const initial = sliceBetween(viewer, '// 첫 구간 고르기', '}, [allSections');
    expect(initial).toContain("new URLSearchParams(window.location.search).get('sourceToken')");
    expect(initial).toContain('readingProgress?.last_token_idx');
    expect(initial).toContain('sectionMoved.current');
  });
  it('머리(제목 · 출처 · 작품 카드)는 첫 구간에만, 꼬리(다 읽었다면 · 다음 · 토론)는 마지막 구간에만 — 끝 표식은 늘 남는다', () => {
    expect(viewer).toContain("data-section-head={readerSections && section > 0 ? 'off' : undefined} data-section-tail={readerSections && section < readerSections.length - 1 ? 'off' : undefined}");
    expect(css).toContain('.viewer-layout [data-reader-pages="paged"][data-section-head="off"] > :is(.page-header, .viewer-attribution, .viewer-art-card) { display: none; }');
    expect(css).toContain('.viewer-layout [data-reader-pages="paged"][data-section-tail="off"] > .reader-area ~ :not([data-page-end]) { display: none; }');
  });
  it('쪽 막대(목업 승인) — 구간이 있으면 문구 · 넘김 가능을 뷰어가 준다, 없으면 지금 그대로', () => {
    expect(viewer).toContain('<PageBar pager={pageBarPager}');
    expect(viewer).toContain('<PageStrips pager={pageBarPager}');
    expect(viewer).toContain("labelText: pos.count ? vt('{page} / {count}쪽 · {percent}%', pos) : pos.page ? vt('{page}쪽 · {percent}%', pos) : `${pos.percent}%` };");
    expect(bar).toContain('const label = (tr, pager) => pager.labelText ?? (tr ?');
    expect(bar).toContain('const canPrev = pager => pager.ready && (pager.hasPrev ?? pager.page > 0);');
    expect(bar).toContain('const canNext = pager => pager.ready && (pager.hasNext ?? pager.page < pager.count - 1);');
    expect(bar.match(/disabled=\{!canPrev\(pager\)\}/g)).toHaveLength(2);
    expect(bar.match(/disabled=\{!canNext\(pager\)\}/g)).toHaveLength(2);
  });
});
