import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JP_MAP_PINS } from '../../content/studies/japanMapPins';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('일본학 지도 딥링크 ?pin=<id>', () => {
  const view = read('src/views/JapanStudiesMapPage.jsx');
  const page = read('src/app/(app)/studies/japan/map/page.jsx');
  const child = sliceBetween(view, 'function PinFromQuery({ onPin }) {', '\n}\n');

  it('쿼리는 작은 자식(PinFromQuery)만 읽고, JP_MAP_PINS id로 검증한다', () => {
    expect(child).toMatch(/useSearchParams\(\)\.get\('pin'\)/);
    expect(child).toMatch(/JP_MAP_PINS\.some\(\(p\) => p\.id === pinParam\)/);
    // 페이지 본체는 쿼리를 읽지 않는다 — 읽으면 가장 가까운 경계까지 통째로 클라이언트 렌더가 된다.
    expect(view.match(/useSearchParams\(\)/g)).toHaveLength(1);
  });

  it('쿼리 값이 바뀌면 다시 고른다(effect 의존 = 쿼리 값)', () => {
    expect(child).toContain('useEffect(() => {');
    expect(child).toContain('}, [pinParam, onPin]);');
  });

  it('Suspense는 핀 선택 자식만 감싼다 — 페이지 전체(제목·지도·목록)는 정적으로 그린다', () => {
    expect(view).toMatch(/<Suspense fallback=\{null\}>\s*<PinFromQuery onPin=\{selectPin\} \/>\s*<\/Suspense>/);
    expect(view.match(/<Suspense\b/g)).toHaveLength(1);
    expect(page).not.toMatch(/<Suspense|from 'react'/);
    expect(page).toContain('return <JapanStudiesMapPage />;');
  });

  it('핀 id가 존재한다', () => {
    expect(JP_MAP_PINS.length).toBeGreaterThan(0);
  });
});
