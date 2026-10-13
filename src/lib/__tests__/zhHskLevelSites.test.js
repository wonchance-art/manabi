import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

// 계약: 화면의 HSK 급수는 한 조회(HSK 2026 표)로, 분절 방벽은 2021 표 그대로 (ZH-LEVEL-2026-001 ②③ —
// 오너 결정 2026-10-13 KST).
// ⑴ 급수를 보이는 자리(뷰어 단어창 메타 줄 · 단어장 행 뱃지·급수 필터, 앞으로 레벨 화면 AJ · 한자 탭 AL)는
//    전부 src/lib/zhHskLevel.js의 zhHskLevelOf · zhHskLevelLabel을 쓴다. 우리 사전 세트 파일 위치
//    (refVocab.level — 옛 급수)를 급수로 보이면 2026 표와 갈린다.
// ⑵ 분절 방벽(server/zhTokenFix.js isZhRealWord)은 2021 표(zhHskLevel.json)를 쓰고, 서버 분절 모듈은
//    2026 표를 들이지 않는다 — 표를 바꾸면 분절이 달라진다(기존 분절 계약 테스트가 2021 표 기준).

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CODE_FILE = /\.(js|jsx|mjs|ts|tsx)$/;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    if (name === 'node_modules' || name === '__tests__') continue;
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (CODE_FILE.test(name) && !/\.test\./.test(name)) out.push(rel);
  }
  return out;
}

const SRC_FILES = walk('src');
const CANON = path.join('src', 'lib', 'zhHskLevel.js');
const IMPORTS_CANON = /from ['"][^'"]*\/zhHskLevel(\.js)?['"]/;

// 급수 뱃지를 그리는 자리 — 새 자리를 만들면 여기 더하고 아래처럼 정본 조회를 쓴다(AJ · AL 포함).
const BADGE_CLASS = /className="(word-detail-card__level|vocab-row__level)"/;
const BADGE_SITES = [path.join('src', 'views', 'ViewerPage.jsx'), path.join('src', 'views', 'VocabList.jsx')];

describe('⑴ 화면 급수 표시 = HSK 2026 조회 하나', () => {
  it('2026 표 파일은 정본 모듈만 읽는다(자리마다 표를 따로 읽지 않는다)', () => {
    const readers = SRC_FILES.filter((f) => read(f).includes('zhHsk2026Level'));
    expect(readers).toEqual([CANON]);
    expect(read(CANON)).toContain("import('./data/zhHsk2026Level.json')");
  });

  it('정본 모듈이 2021 표를 읽지 않는다', () => {
    expect(read(CANON)).not.toMatch(/(import|from)[^\n;]*zhHskLevel\.json/);
  });

  it('급수 뱃지를 그리는 파일이 등록된 자리뿐이고, 모두 정본 모듈을 쓴다', () => {
    const badgeFiles = SRC_FILES.filter((f) => BADGE_CLASS.test(read(f)));
    expect(badgeFiles.sort()).toEqual([...BADGE_SITES].sort());
    for (const f of BADGE_SITES) expect(read(f), f).toMatch(IMPORTS_CANON);
  });

  it('뷰어 단어창 메타 줄 — 급수는 zhHskLevelLabel(zhHskLevelOf(…)), 세트 파일 위치(refVocab.level)가 아니다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("const zhHskLevels = useZhHskLevels(materialLang === 'Chinese');");
    expect(viewer).toContain('const hskLevelLabel = zhHskLevelLabel(zhHskLevelOf(selectedLexKey || selectedToken?.text, zhHskLevels));');
    const meta = sliceBetween(viewer, '<div className="word-detail-card__meta">', '</div>');
    expect(meta).toContain('{hskLevelLabel && <span className="word-detail-card__level">{hskLevelLabel}</span>}');
    expect(meta).not.toMatch(/refVocab/);
  });

  it('단어장 — 행 뱃지·급수 필터 선택지·필터 판정이 같은 조회를 쓴다', () => {
    const page = read('src/views/VocabPage.jsx');
    const refLevelOf = sliceBetween(page, 'const refLevelOf = useCallback(', '), [');
    expect(refLevelOf).toContain('zhHskLevelOf(v.word_text, zhHskLevels)');
    const filter = sliceBetween(page, "if (levelFilter !== 'all' && zhHskLevels) {", 'if (q) {');
    expect(filter).toContain('refLevelOf(x._item)');
    const list = read('src/views/VocabList.jsx');
    expect(list).toContain('const refLevel = zhHskLevelLabel(refLevelOf?.(v));');
    expect(sliceBetween(list, 'const LEVEL_OPTIONS = [', '];')).toContain('label: zhHskLevelLabel(level)');
  });

  it('세트 파일 위치를 급수로 보이는 길이 없다 — refLevelLabel 폐기, refVocab.level 표시 0', () => {
    for (const f of SRC_FILES) {
      const text = read(f);
      expect(text, f).not.toMatch(/\brefLevelLabel\b/);
      if (/^src[\\/](views|components|app)[\\/]/.test(f)) expect(text, f).not.toMatch(/refVocab\??\.level\b/);
    }
  });

  it('「HSK 7–9」 라벨은 정본 모듈만 만든다', () => {
    const makers = SRC_FILES.filter((f) => !f.startsWith(path.join('src', 'content')) && read(f).includes('HSK 7–9'));
    expect(makers).toEqual([CANON]);
  });
});

describe('⑵ 분절 방벽 = 2021 표 그대로', () => {
  const tokenFix = read('src/lib/server/zhTokenFix.js');

  it('isZhRealWord는 2021 표(zhHskLevel.json)로 판정한다', () => {
    expect(tokenFix).toContain("import ZH_HSK_LEVEL from '../data/zhHskLevel.json';");
    const realWord = sliceBetween(tokenFix, 'export function isZhRealWord(', '\n}');
    expect(realWord).toContain('!!ZH_HSK_LEVEL[word]');
  });

  it('서버 모듈(분절 · 방벽 · 등재 정의)은 2026 표도, 화면 급수 정본 모듈도 들이지 않는다', () => {
    const server = SRC_FILES.filter((f) => f.startsWith(path.join('src', 'lib', 'server')));
    for (const f of ['zhTokenFix.js', 'zhRegistered.js', 'zhKeepMerged.js', 'tokenizeZh.js']) {
      expect(server).toContain(path.join('src', 'lib', 'server', f));
    }
    for (const f of server) {
      const text = read(f);
      expect(text, f).not.toContain('zhHsk2026Level');
      expect(text, f).not.toMatch(IMPORTS_CANON);
    }
  });
});
