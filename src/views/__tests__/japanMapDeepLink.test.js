import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JP_MAP_PINS } from '../../content/studies/japanMapPins';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('일본학 지도 딥링크 ?pin=<id>', () => {
  const view = read('src/views/JapanStudiesMapPage.jsx');
  it('pin 쿼리를 읽고 JP_MAP_PINS id로 검증한다', () => {
    expect(view).toMatch(/useSearchParams\(\)\.get\('pin'\)/);
    expect(view).toMatch(/JP_MAP_PINS\.some\(\(p\) => p\.id === pinParam\)/);
  });
  it('페이지가 Suspense로 감싼다', () => {
    expect(read('src/app/(app)/studies/japan/map/page.jsx')).toMatch(/<Suspense/);
  });
  it('핀 id가 존재한다', () => {
    expect(JP_MAP_PINS.length).toBeGreaterThan(0);
  });
});
