import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import config, { CITY_GEO_MODULE } from '../../../vitest.config.js';

// 도시 geo 데이터 모듈은 Vite 변환 없이 Node가 직접 읽는다(vitest.config.js ③, 2026-10-17 KST).
// 도시 전체 적재 49.7s 중 39.4s가 변환이었고, 끈 뒤 26도시 payload 해시가 변환본과 전부 같았다.
// 이 계약은 그 전제가 깨지지 않게 묶는다: 패턴이 geo 파일 전부 · 그것만 잡고, geo 파일은 Node가 그대로
// 풀 수 있는 import만 쓰며, 외부화된 모듈은 vi.mock이 닿지 않으므로 어떤 테스트도 그것을 mock하지 않는다.
const ROOT = process.cwd();
const CITY_DIR = path.join(ROOT, 'src/components/world/cities');
const cityFiles = fs.readdirSync(CITY_DIR).filter((file) => file.endsWith('.js'));
const geoFiles = cityFiles.filter((file) => file.endsWith('.geo.js'));
const importsOf = (source) => [...source.matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)].map((m) => m[1] ?? m[2]);

function testFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) testFiles(full, out);
    else if (/\.test\.[cm]?[jt]sx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('vitest — 도시 geo 모듈 외부화 계약', () => {
  it('설정이 geo 패턴을 server.deps.external로 건다', () => {
    expect(config.test.server.deps.external).toContain(CITY_GEO_MODULE);
  });

  it('패턴은 cities/*.geo.js 전부를 잡고, 그 밖의 도시 파일(로직 · 매니페스트)은 잡지 않는다', () => {
    expect(geoFiles.length).toBeGreaterThanOrEqual(26);
    for (const file of cityFiles) {
      expect(CITY_GEO_MODULE.test(path.join(CITY_DIR, file).split(path.sep).join('/')), file).toBe(file.endsWith('.geo.js'));
    }
  });

  it('geo 파일은 확장자까지 적은 cityGeoLoader.js만 import하고, cityGeoLoader.js는 import가 없다(Node 직접 해석)', () => {
    for (const file of geoFiles) {
      const imports = importsOf(fs.readFileSync(path.join(CITY_DIR, file), 'utf8'));
      expect(imports.filter((spec) => spec !== './cityGeoLoader.js'), file).toEqual([]);
    }
    expect(importsOf(fs.readFileSync(path.join(CITY_DIR, 'cityGeoLoader.js'), 'utf8'))).toEqual([]);
  });

  it('외부화된 geo · cityGeoLoader 모듈을 vi.mock하는 테스트가 없다(mock이 조용히 무시된다)', () => {
    const offenders = [];
    for (const file of [...testFiles(path.join(ROOT, 'src')), ...testFiles(path.join(ROOT, 'scripts'))]) {
      const source = fs.readFileSync(file, 'utf8');
      for (const m of source.matchAll(/vi\.(?:do)?[mM]ock\(\s*['"]([^'"]+)['"]/g)) {
        if (/\.geo(?:\.js)?$|cityGeoLoader/.test(m[1])) offenders.push(`${path.relative(ROOT, file)} → ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
