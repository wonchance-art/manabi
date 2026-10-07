import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_CREDIT_IDS, DATA_CREDIT_SECTIONS } from '../dataCredits';

/**
 * 계약: 자료 출처 화면이 동봉 원천을 빠짐없이 싣는다 (오너 승인 2026-10-07, PR #1350).
 *
 * 왜 필요한가: 감사 시점에 CC-CEDICT(CC BY-SA)·FLELex(CC BY-NC-SA)·OSM(ODbL)의 고지가
 * 생성기 주석에만 있었고 사용자 화면에는 0건이었다. 주석은 원천을 들일 때 자연히 쓰이지만
 * 화면 목록은 따로 고쳐야 해서 잊힌다. 그래서 **코드에 원천 표지가 보이면 목록에도 있어야
 * 한다**를 계약으로 둔다. 표지가 코드에서 사라지면(원천 제거) 이 표의 줄도 지우라고 실패한다.
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CODE_FILE = /\.(js|jsx|mjs)$/;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    if (name === 'node_modules' || name === '__tests__') continue;
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (CODE_FILE.test(name) && !/\.test\./.test(name) && rel !== path.join('src', 'lib', 'dataCredits.js')) out.push(rel);
  }
  return out;
}

// 원천 표지 → 자료 출처 id. 표지는 생성기·콘텐츠 헤더가 실제로 쓰는 문자열이다.
// JMdict는 AE-R3부터 동봉 파생 표(src/lib/data/jaWords.json, CC BY-SA 4.0)로 화면에 닿는다 — 표지·항목을
// 함께 둔다(설계서 docs/manabi-viewer-v2-ae-r3.md §6·§7.2, 오너 승인 범위 결정 #1337 2026-10-07).
const MARKERS = [
  { re: /CC-CEDICT/, id: 'cc-cedict' },
  { re: /ivankra\/hsk30/, id: 'hsk30' },
  { re: /drkameleon\/complete-hsk-vocabulary/, id: 'complete-hsk-vocabulary' },
  { re: /kuromoji/, id: 'kuromoji-ipadic' },
  { re: /open-anki-jlpt-decks/, id: 'open-anki-jlpt-decks' },
  { re: /JMdict/, id: 'jmdict' },
  { re: /Unihan/, id: 'unihan' },
  { re: /BabelStone/, id: 'babelstone-ids' },
  { re: /opencc-data/, id: 'opencc' },
  { re: /libhangul/, id: 'libhangul-hanja' },
  { re: /npm `hanja`/, id: 'npm-hanja' },
  { re: /FLELex/, id: 'flelex' },
  { re: /provider: ["']tatoeba["']/, id: 'tatoeba' },
  { re: /ODbL/, id: 'openstreetmap' },
  { re: /Natural Earth/, id: 'natural-earth' },
  { re: /ETOPO/, id: 'etopo-2022' },
];

describe('자료 출처 — 코드의 원천 표지와 화면 목록이 갈리지 않는다', () => {
  const files = [...walk('src'), ...walk('scripts')];
  const hits = new Map(MARKERS.map((m) => [m.id, null]));
  for (const f of files) {
    const text = read(f);
    for (const m of MARKERS) if (!hits.get(m.id) && m.re.test(text)) hits.set(m.id, f);
  }

  it.each(MARKERS.map((m) => [m.id, m]))('%s: 표지가 코드에 있고 목록에도 있다', (id) => {
    expect(hits.get(id), `${id} 표지가 코드에서 사라졌다 — 원천을 뺐다면 목록·표지 표에서도 지운다`).toBeTruthy();
    expect(DATA_CREDIT_IDS, `${hits.get(id)}가 ${id}를 쓰는데 자료 출처에 없다`).toContain(id);
  });

  it('목록의 모든 항목이 표지 표에 묶여 있다 — 근거 없는 줄을 남기지 않는다', () => {
    const bound = new Set(MARKERS.map((m) => m.id));
    expect(DATA_CREDIT_IDS.filter((id) => !bound.has(id))).toEqual([]);
  });
});

describe('자료 출처 — 항목 형식', () => {
  const items = DATA_CREDIT_SECTIONS.flatMap((s) => s.items);

  it('id가 겹치지 않는다(화면 앵커로도 쓴다)', () => {
    expect(new Set(DATA_CREDIT_IDS).size).toBe(DATA_CREDIT_IDS.length);
  });

  it('모든 항목에 이름·쓰임·라이선스와 https 링크 둘이 있다', () => {
    for (const item of items) {
      expect(item.name && item.use && item.license, item.id).toBeTruthy();
      expect(item.licenseUrl, item.id).toMatch(/^https:\/\//);
      expect(item.sourceUrl, item.id).toMatch(/^https:\/\//);
    }
  });

  it('동일조건(SA) 라이선스는 변경 고지를 싣는다 — CC BY-SA/NC-SA §3(a)(1)(B)', () => {
    for (const item of items.filter((i) => /-SA\b/.test(i.license))) {
      expect(item.changes, item.id).toBeTruthy();
    }
  });
});

describe('자료 출처 — 사용자가 닿는 경로', () => {
  it('화면이 정본 목록을 그린다(복사본 금지)', () => {
    expect(read('src/app/credits/page.jsx')).toContain("from '@/lib/dataCredits'");
  });

  it('설정·도움말에서 /credits로 간다', () => {
    expect(read('src/views/MyPage.jsx')).toContain('href="/credits"');
    expect(read('src/app/help/page.jsx')).toContain('href="/credits"');
  });

  it('월드 화면이 지도 곁에 OSM 표기를 둔다 — ODbL은 지도 곁 표기를 요구한다', () => {
    const world = read('src/views/WorldPage.jsx');
    expect(world).toContain('© OpenStreetMap 기여자');
    expect(world).toContain('/credits#openstreetmap');
  });
});

describe('생성 데이터 옆 라이선스 표기', () => {
  for (const dir of ['src/lib/data', 'src/lib/server/data']) {
    it(`${dir}/README.md가 디렉터리의 모든 JSON을 싣는다`, () => {
      const readme = read(path.join(dir, 'README.md'));
      const jsons = fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.json'));
      expect(jsons.length).toBeGreaterThan(0);
      expect(jsons.filter((n) => !readme.includes(`\`${n}\``))).toEqual([]);
    });
  }

  it('README가 가리키는 고지 원문이 실제로 있다', () => {
    const readme = read('src/lib/data/README.md');
    for (const [, file] of readme.matchAll(/`LICENSES\/([^`]+)`/g)) {
      expect(fs.existsSync(path.join(ROOT, 'src/lib/data/LICENSES', file)), file).toBe(true);
    }
  });
});
