import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

// 계약: 즉시 뒤로가기(bfcache)를 막는 떠날 때 코드 (bfcache 감사 2026-10-17 KST, Chromium 141 CDP 실측).
// ⑴ pagehide 안의 history.replaceState는 그 페이지를 bfcache에서 내쫓는다(IgnoreEventAndEvict) — persisted면 쓰지 않는다.
// ⑵ 늘 붙어 있는 beforeunload는 Firefox에서 bfcache를 막는다 — 지킬 것이 있을 때만 붙인다.
const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '__tests__', 'world'].includes(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(path.relative(ROOT, p).replaceAll('\\', '/'));
  }
  return out;
};
const FILES = walk(path.join(ROOT, 'src'));

// pagehide에서 기록(history)을 쓰는 곳 — 각각 persisted 가드를 둔다.
const PAGEHIDE_WRITERS = {
  'src/views/LevelListPage.jsx': ["const hide = (event) => { if (!event.persisted) remember(); };", "window.addEventListener('pagehide', hide);"],
  'src/components/books/BookReader.jsx': ['const release = event => { if (!event?.persisted) rememberPosition(); window.history.scrollRestoration = restoration; };', "window.addEventListener('pagehide', release);"],
};
// beforeunload — 지킬 것이 있을 때만 붙인다. 예외는 이유와 함께.
const BEFOREUNLOAD = {
  'src/components/admin/TextbookEditor.jsx': /useEffect\(\(\) => \{\s*if \(!dirty\) return;\s*const warn = /,
  'src/components/books/BookEditor.jsx': /useEffect\(\(\)=>\{if\(!dirty\)return;const guard=/,
  'src/components/materials/MaterialComposer.jsx': /useEffect\(\(\) => \{\s*if \(!leaveGuard\) return undefined;\s*const protect = /,
};
const BEFOREUNLOAD_EXCEPTIONS = {
  'src/lib/useStudyNote.js': '학습 노트 동기화의 dirty가 화면 상태가 아닌 세션 ref(run.dirty)라, 붙였다 떼려면 동기화 상태 발행을 바꿔야 한다 — 기계적 변경이 아니라 보류',
};

describe('bfcache를 막는 떠날 때 코드', () => {
  it('pagehide에서 history를 쓰는 파일은 목록에 있고, persisted면 쓰지 않는다', () => {
    const writers = FILES.filter((f) => { const s = read(f); return s.includes("addEventListener('pagehide'") && s.includes('replaceState'); });
    expect(writers.sort()).toEqual(Object.keys(PAGEHIDE_WRITERS).sort());
    for (const [file, needles] of Object.entries(PAGEHIDE_WRITERS)) for (const needle of needles) expect(read(file), file).toContain(needle);
  });

  it('BookReader의 다른 자리 남기기(굴리기 · 이동 · 첫 쪽 맞춤)는 그대로다', () => {
    const src = read('src/components/books/BookReader.jsx');
    expect(sliceBetween(src, 'const track = () => {', 'window.addEventListener(\'scroll\', track')).toContain('rememberPosition(current)');
    expect(sliceBetween(src, 'const go = useCallback((id, originAnchor) => {', 'const navigationState')).toContain('rememberPosition();');
    expect(src).toContain("window.history.replaceState({ ...window.history.state, manabiBookPosition: position }, '', window.location.href);");
  });

  it('beforeunload는 지킬 것이 있을 때만 붙인다 — 예외는 이유 목록', () => {
    const users = FILES.filter((f) => /addEventListener\(\s*['"]beforeunload['"]/.test(read(f)));
    expect(users.sort()).toEqual([...Object.keys(BEFOREUNLOAD), ...Object.keys(BEFOREUNLOAD_EXCEPTIONS)].sort());
    for (const [file, guard] of Object.entries(BEFOREUNLOAD)) expect(read(file), file).toMatch(guard);
    for (const reason of Object.values(BEFOREUNLOAD_EXCEPTIONS)) expect(reason.length).toBeGreaterThan(20);
  });

  it('자료 추가 화면: 붙어 있는 동안의 판정은 최신 초안으로, 붙일지는 같은 판정의 화면 상태로', () => {
    const src = read('src/components/materials/MaterialComposer.jsx');
    expect(src).toContain('const unsaved = value => !!(value && !value.savedId && (!editing || value.dirty || value.frozen) && (value.body || value.title || value.files.length || value.links.length));');
    expect(src).toContain('const leaveGuard = unsaved(draft);');
    expect(sliceBetween(src, 'if (!leaveGuard) return undefined;', '}, [leaveGuard, editing]);')).toContain('if (unsaved(draftRef.current)) { event.preventDefault(); event.returnValue = \'\'; }');
  });
});
