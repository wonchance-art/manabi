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
