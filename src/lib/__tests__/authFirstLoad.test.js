import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as chips from '../learnLangChips.js';
import * as dashboard from '../learnDashboard.js';
import * as profileRead from '../profileReadOnly.js';
import * as activity from '../learningActivity.js';

// 계약(FIRSTLOAD-AUTH-001, 2026-11-01 KST): 루트 레이아웃 첫 JS(모든 화면)에서 AuthContext가 끌고 오던 무거운 모듈을 뺀다.
// 예전 AuthContext → scFontHint → learnDashboard → growthStats · goalPace · learningActivity → fsrsScheduler → ts-fsrs,
// AuthContext → refProgress → readingProgress → grammarSrs가 손님 화면(발견 · 서재 · 배움 손님)에도 실렸다(로컬 운영 빌드 실측
// 공유 조각 71809 · 35989 · 96004 — 원본 약 80 KB). 그것들은 로그인한 뒤 · 활동 뒤에만 쓰므로 import()로 받는다.
// 이 검사는 정적 import 닫힘(동적 import() 제외)을 직접 따라간다 — 손으로 고른 목록 비교가 아니라 실제 그래프다.

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const EXTS = ['', '.js', '.jsx', '.mjs', '.json', '/index.js', '/index.jsx'];

function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return `pkg:${spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/')}`;
  for (const e of EXTS) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  throw new Error(`풀 수 없는 import ${spec} (${path.relative(root, from)})`);
}

// 주석을 지운 뒤 `import … from '…'` · `import '…'` · `export … from '…'`만 센다. import('…')는 지연이라 닫힘에 넣지 않는다.
function staticClosure(entries) {
  const seen = new Map();
  const walk = (file, via) => {
    if (seen.has(file)) return;
    seen.set(file, via);
    if (!/\.(m?js|jsx)$/.test(file)) return;
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'"()]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) {
      const next = resolve(file, m[1]);
      if (next.startsWith('pkg:')) { if (!seen.has(next)) seen.set(next, path.relative(root, file)); continue; }
      walk(next, path.relative(root, file));
    }
  };
  for (const e of entries) walk(path.join(root, e), null);
  return new Map([...seen].map(([k, v]) => [k.startsWith('pkg:') ? k : path.relative(root, k), v]));
}

const ROOT_ENTRIES = ['src/app/layout.jsx', 'src/app/providers.jsx', 'src/app/(app)/layout.jsx'];
// 첫 그림 · 세션 판정에 필요 없는 모듈 — 로그인 뒤 · 활동 뒤 · 쿼리할 때 받는다.
const HEAVY = [
  'pkg:ts-fsrs', 'pkg:@supabase/supabase-js', 'pkg:@supabase/ssr',
  'src/lib/supabaseClient.js', 'src/lib/fsrsScheduler.js', 'src/lib/learningActivity.js', 'src/lib/learnDashboard.js',
  'src/lib/growthStats.js', 'src/lib/goalPace.js', 'src/lib/studyPlan.js', 'src/lib/vocabularyLearningRead.js',
  'src/lib/refProgress.js', 'src/lib/readingProgress.js', 'src/lib/grammarSrs.js', 'src/lib/drillSrs.js',
];

describe('루트 레이아웃 첫 JS — AuthContext는 가벼운 모듈만 정적으로 부른다', () => {
  const closure = staticClosure(ROOT_ENTRIES);

  it('그래프를 실제로 따라갔다(AuthContext · 세션 쿠키 판정 · 프로필 읽기 모듈이 닫힘 안에 있다)', () => {
    for (const f of ['src/lib/AuthContext.jsx', 'src/lib/authCookie.js', 'src/lib/profileReadOnly.js', 'src/lib/scFontHint.js', 'src/lib/supabase.js'])
      expect(closure.has(f), f).toBe(true);
  });

  it('무거운 모듈은 닫힘 밖이다', () => {
    const leaked = HEAVY.filter((f) => closure.has(f)).map((f) => `${f} ← ${closure.get(f)}`);
    expect(leaked).toEqual([]);
  });

  it('로그인 뒤 동기화 · 활동일 판정 · 명시적 로그인 기록은 import()로 받는다(부르는 자리 그대로)', () => {
    const auth = read('src/lib/AuthContext.jsx');
    expect(auth).toContain("import('./refProgress').then((ref) => ref.pullProgress(user.id, REF_READ_KEYS, { force: true }))");
    expect(auth).toContain("return import('./learningActivity')");
    expect(auth).toContain("import { createProfileReadOnlyRefresh } from './profileReadOnly';");
    expect(auth).toContain("const { recordExplicitProfileLogin } = await import('./learningActivity');");
  });
});

describe('옮긴 함수는 예전 경로에서도 같은 것이다(정본 하나 — 다시 내보내기)', () => {
  it('learnDashboard의 learnLanguages · LEARN_LANGS = learnLangChips의 것', () => {
    expect(dashboard.learnLanguages).toBe(chips.learnLanguages);
    expect(dashboard.LEARN_LANGS).toBe(chips.LEARN_LANGS);
    expect(chips.learnLanguages(null)).toEqual(['Japanese']);
    expect(chips.learnLanguages({ learning_language: ['Chinese', 'Korean', 'Chinese'] })).toEqual(['Chinese']);
    expect(chips.learnLanguages({}, { French: 2, English: 5, Korean: 9 })).toEqual(['English', 'French']);
  });

  it('learningActivity의 createProfileReadOnlyRefresh = profileReadOnly의 것 · profiles 쓰기는 learningActivity에 남는다', () => {
    expect(activity.createProfileReadOnlyRefresh).toBe(profileRead.createProfileReadOnlyRefresh);
    expect(typeof activity.recordExplicitProfileLogin).toBe('function');
    expect(read('src/lib/profileReadOnly.js')).not.toMatch(/\.(update|upsert|insert)\(/);
  });

  it('가벼운 두 모듈은 무거운 모듈을 부르지 않는다', () => {
    for (const f of ['src/lib/learnLangChips.js', 'src/lib/profileReadOnly.js']) {
      const closure = staticClosure([f]);
      expect(HEAVY.filter((h) => closure.has(h)), f).toEqual([]);
    }
  });
});
