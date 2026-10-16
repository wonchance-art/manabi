// 비시각 접근성 점검(A11Y-SWEEP-001, 2026-10-17 KST) — 화면 모양은 그대로, 화면 낭독 · 키보드 동작만.
// ① 결과 알림 영역은 늘 그려 두고 내용만 넣는다(내용과 함께 생기는 role=status는 화면 낭독기가 놓칠 수 있다 — 1eaed980 선례).
// ② 글자 없는 아이콘 버튼에는 이름이 있다. ③ 가벼운 팝업(div role=dialog)은 열면 안으로 · Esc · 닫으면 연 자리로.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const full = path.join(dir, d.name);
  if (d.isDirectory()) return d.name === '__tests__' || d.name === 'node_modules' ? [] : walk(full);
  return /\.jsx$/.test(d.name) ? [full] : [];
});

describe('① 결과 알림 영역 — 늘 있고 내용만 바뀐다 · 보이는 줄은 한 번만 읽힌다', () => {
  it('문맥 담기 결과(SaveContextButton)', () => {
    const src = read('src/components/learning/SaveContextButton.jsx');
    expect(src).toContain('<span className="sr-only" role="status">{message}</span>');
    expect(src).toContain('{message && <p aria-hidden="true">{message}</p>}');
    expect(src).not.toMatch(/message && <p role="status"/);
  });
  it('뷰어 읽기 위치 저장 실패 — 「다시 저장」이 이유를 가리킨다', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toContain('<span className="sr-only" role="status" id="viewer-position-notice">{positionError ? vt("읽기 위치를 저장하지 못했어요.") : \'\'}</span>');
    const banner = sliceBetween(src, '{positionError && <div className="error-banner">', '</div>}');
    expect(banner).not.toContain('role="status"');
    expect(banner).toContain('<span aria-hidden="true">{vt("읽기 위치를 저장하지 못했어요.")}</span>');
    expect(banner).toContain('aria-describedby="viewer-position-notice"');
  });
  it('교재 참고 자료 검색 결과 수(BookReader)', () => {
    const src = read('src/components/books/BookReader.jsx');
    expect(src).toMatch(/<span className="sr-only" role="status">\{unit === 'reference' && query\.trim\(\) \? \(searchCount \?/);
    expect(src).toMatch(/\{unit === 'reference' && query\.trim\(\) && <p className="manabi-status" aria-hidden="true">/);
    expect(src).not.toMatch(/query\.trim\(\) && <p className="manabi-status" role="status"/);
  });
});

describe('①b 결과 알림 영역 2차 — 서재 · 노트 · 뷰어 더 알아보기', () => {
  it('서재 정리 결과 · 미확인(LibraryShelf) — 영역 하나에 두 줄, 다시 시도 · 실패 다시 선택 · 되돌리기가 가리킨다', () => {
    const src = read('src/components/library/LibraryShelf.jsx');
    expect(src).toContain('<span className="sr-only" role="status" id="shelf-organize-notice">{[pendingLine,resultLine].filter(Boolean).join(\' \')}</span>');
    expect(src).toContain('{pendingLine&&<div className="shelf-notice"><span aria-hidden="true">{pendingLine} </span><button aria-describedby="shelf-organize-notice"');
    expect(src).toContain('{result&&<div className="shelf-notice"><span aria-hidden="true">{resultLine}</span>');
    expect((src.match(/aria-describedby="shelf-organize-notice"/g) || []).length).toBe(3);
    expect(src).not.toMatch(/className="shelf-notice" role="status"/);
  });
  it('폴더 변경 「저장됨」(LibraryCollections)', () => {
    const src = read('src/components/library/LibraryCollections.jsx');
    expect(src).toContain('<span className="sr-only" role="status" id="collections-undo-notice">{undo?\'저장됨\':\'\'}</span>');
    expect(src).toContain('{undo&&<div className="shelf-notice"><span aria-hidden="true">저장됨 </span><button aria-describedby="collections-undo-notice"');
  });
  it('노트 표현 담기 — 줄마다 · 바닥 줄(NoteVocabulary)', () => {
    const src = read('src/components/notes/NoteVocabulary.jsx');
    expect(src).toContain("<span className=\"sr-only\" role=\"status\" id={`note-outcome-${row.id}`}>{outcome?.error||(outcome?.ok?outcome.text:'')}</span>");
    expect(src).toContain('<div className="note-row-error"><p aria-hidden="true">{outcome.error}</p>');
    expect(src).toContain('aria-describedby={`note-outcome-${row.id}`}');
    expect(src).toContain('{outcome?.ok&&<p className="note-saved" aria-hidden="true">{outcome.text}</p>}');
    expect(src).toContain('<footer><span className="sr-only" role="status">{notice||message||\'\'}</span>{(notice||message)&&<p aria-hidden="true">{notice||message}</p>}');
  });
  it('뷰어 비슷한 말 실패 — 영역은 조건 밖, 「✦ 비슷한 말 찾기」가 가리킨다', () => {
    const src = read('src/views/ViewerPage.jsx');
    const live = '<span className="sr-only" role="status" id="viewer-synant-notice">{synAntEligible(selectedToken,materialLang) && !synAnt?.loading && synAnt?.error ? vt("불러오지 못했어요.") : \'\'}</span>';
    expect(src).toContain(live);
    expect(sliceBetween(src, live, '{wordDetail?.loading')).toContain('{synAnt?.error && <p aria-hidden="true">{vt("불러오지 못했어요.")}</p>}<button type="button" className="btn btn--ghost btn--sm reader-card-learn__ask" aria-describedby="viewer-synant-notice"');
  });
  it('일본어로는 대응어 실패(ViewerJapaneseMore) — 찾는 중 · 결과 두 갈래의 같은 자리에 같은 영역', () => {
    const src = read('src/components/viewer/ViewerJapaneseMore.jsx');
    expect(src).toContain("const notice=<span className=\"sr-only\" role=\"status\" id={noticeId}>{!query.isFetching&&query.isError?vt('대응어를 불러오지 못했어요.'):''}</span>;");
    expect(src).toContain("if(query.isFetching)return <>{warnLine}{notice}<p role=\"status\">");
    expect(src).toMatch(/return <>\s*\{warnLine\}\s*\{notice\}\s*\{query\.isError&&<p aria-hidden="true">/);
    expect(src).toContain('aria-describedby={noticeId}');
  });
});

describe('② 글자 없는 아이콘 버튼에는 이름이 있다', () => {
  it('✕ · × 만 든 버튼은 aria-label이 있다(화면 코드 전체)', () => {
    const offenders = [];
    for (const file of walk(path.join(ROOT, 'src'))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/<button\b([^>]*)>\s*(?:<span aria-hidden="true">)?\s*[×✕✖]\s*(?:<\/span>)?\s*<\/button>/g)) {
        if (!/aria-label(ledby)?=/.test(m[1])) offenders.push(`${path.relative(ROOT, file)}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it('읽기 확인 닫기(✕)', () => {
    expect(read('src/components/ReadingTest.jsx')).toContain('<button type="button" aria-label="닫기" onClick={onClose}');
  });
});

describe('③ 가벼운 팝업 — 열면 안으로 · Esc로 닫기 · 닫으면 연 자리로(useDialogReturn)', () => {
  const hook = read('src/lib/useDialogReturn.js');
  it('훅: Esc · 첫 조작 요소로 포커스 · 연 요소가 살아 있고 포커스가 body일 때만 돌려준다 · onClose는 ref', () => {
    expect(hook).toContain("if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close.current?.(); }");
    expect(hook).toContain("document.addEventListener('keydown', onKey);");
    expect(hook).toContain("document.removeEventListener('keydown', onKey);");
    expect(hook).toContain('if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });');
    expect(hook).toContain('(first || box).focus({ preventScroll: true });');
    expect(hook).toMatch(/useEffect\(\(\) => \{[\s\S]*\}, \[\]\);/);
  });
  it('현황 타일 창(TileModal) · 문형 카드(PatternCard)가 훅을 쓰고 aria-modal을 단다', () => {
    const tile = sliceBetween(read('src/views/ProfileStats.jsx'), 'function TileModal(', '\n}\n');
    expect(tile).toContain('const dialogRef = useDialogReturn(onClose);');
    expect(tile).toContain('role="dialog" aria-modal="true" aria-label={title} ref={dialogRef} tabIndex={-1}');
    const card = sliceBetween(read('src/views/ReadingTextView.jsx'), 'function PatternCardDialog(', '\n}\n');
    expect(card).toContain('const dialogRef = useDialogReturn(onClose);');
    expect(card).toMatch(/ref=\{dialogRef\}\s+tabIndex=\{-1\}\s+role="dialog"\s+aria-modal="true"/);
  });
});
