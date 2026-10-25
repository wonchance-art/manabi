// PERF P7(2026-10-26 KST) — /class · /class/[team]의 학생 · 손님 화면은 오너(교사)만 쓰는 묶음을 받지 않는다.
// 허브: 수업 만들기 · 공유 암호(해시) · 팀 목록 · 확인 창(ClassHubPage)은 관리자에게만 next/dynamic으로.
// 팀 페이지: 수업 설정(교재 연결 · 코스 · 입장 암호) · 교재 설명 관리는 오너 뷰에서만 next/dynamic으로(마운트 즉시 미리 받기).
// 화면 보존: 학생 화면 마크업은 그대로(같은 구성 요소), 관리자는 로그인 확인과 같은 「수업을 불러오고 있어요.」를 이어 본다.
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 정적 import만 따라간다(import() · next/dynamic은 따로 묶이는 경계라 따라가지 않는다).
function resolve(from, spec) {
  const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}
function staticClosure(entry) {
  const seen = new Set(), stack = [path.join(ROOT, entry)];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !/\.(m?js|jsx)$/.test(file)) continue;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const [, spec] of src.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s+['"]([^'"]+)['"]/gm)) {
      const next = resolve(file, spec);
      if (next) stack.push(next);
    }
  }
  return new Set([...seen].map((f) => path.relative(ROOT, f)));
}

const HUB_OWNER_ONLY = ['src/views/ClassHubPage.jsx', 'src/lib/classPassword.js', 'src/lib/bookAppend.js', 'src/components/ConfirmModal.jsx'];
// 수업 기록 목록(ClassStudyHistory)은 학생 화면(ClassRemoteHistory)도 쓰므로 여기 없다.
const TEAM_OWNER_ONLY = ['src/components/classroom/ClassTeamSettings.jsx', 'src/components/classroom/ClassTextbookNotes.jsx',
  'src/lib/classPassword.js', 'src/lib/bookAppend.js', 'src/lib/textbookAnnotationSync.js', 'src/lib/useTextbookAnnotations.js'];

describe('/class 허브 — 학생 · 손님은 오너 묶음을 받지 않는다', () => {
  it('경로는 ClassHub를 그리고, 그 정적 의존에 오너 전용 모듈이 없다', () => {
    expect(read('src/app/(app)/class/page.jsx')).toContain("import ClassHub from '@/views/ClassHub';");
    const closure = staticClosure('src/app/(app)/class/page.jsx');
    expect(closure.has('src/components/classroom/ClassroomJoin.jsx')).toBe(true);
    for (const file of HUB_OWNER_ONLY) expect(closure.has(file), file).toBe(false);
  });
  it('관리자에게만 next/dynamic으로, 받는 동안은 로그인 확인과 같은 화면', () => {
    const hub = read('src/views/ClassHub.jsx');
    expect(hub).toContain("const ClassHubPage = dynamic(() => import('./ClassHubPage'), { loading: Loading });");
    expect(hub).toContain('const Loading = () => <ClassroomState title="수업을 불러오고 있어요."/>;');
    const body = sliceBetween(hub, 'export default function ClassHub() {', '\n}');
    expect(body.indexOf('if (loading) return <Loading/>;')).toBeLessThan(body.indexOf('if (!isAdmin) return <ClassHubLearner/>;'));
    expect(body.indexOf('if (!isAdmin) return <ClassHubLearner/>;')).toBeLessThan(body.indexOf('return <ClassHubPage/>;'));
    expect(read('src/views/ClassHubPage.jsx')).toContain('if (loading) return <ClassroomState title="수업을 불러오고 있어요."/>;');
  });
});

describe('/class/[team] — 학생 · 잠김 화면은 오너 뷰 부품을 받지 않는다', () => {
  const page = read('src/views/ClassTeamPage.jsx');
  it('팀 페이지의 정적 의존에 수업 설정 · 교재 설명 관리(와 그 전용 모듈)가 없다', () => {
    const closure = staticClosure('src/app/(app)/class/[team]/page.jsx');
    expect(closure.has('src/views/ClassTeamPage.jsx')).toBe(true);
    for (const file of TEAM_OWNER_ONLY) expect(closure.has(file), file).toBe(false);
  });
  it('next/dynamic + 같은 import 함수로 미리 받기 — 오너 뷰 마운트 즉시, ?settings=1이면 계정 확인과 나란히', () => {
    expect(page).toContain("const ClassTeamSettings=dynamic(loadTeamSettings,{loading:()=>null});");
    expect(page).toContain("const ClassTextbookNotes=dynamic(loadTextbookNotes,{loading:()=>null});");
    for (const mod of ['ClassTeamSettings', 'ClassTextbookNotes']) {
      expect(page.match(new RegExp(`import\\('\\.\\./components/classroom/${mod}'\\)`, 'g'))).toHaveLength(1);
    }
    const owner = sliceBetween(page, 'function OwnerView(', '\nfunction NotesList(');
    expect(owner.indexOf('useEffect(()=>{preloadOwnerParts();},[]);')).toBeGreaterThan(-1);
    expect(owner.indexOf('useEffect(()=>{preloadOwnerParts();},[]);')).toBeLessThan(owner.indexOf('useQuery('));
    const entry = sliceBetween(page, 'export default function ClassTeamPage() {', '\n}');
    expect(entry).toContain("useEffect(() => { if (settingsEntry) preloadOwnerParts(); }, [settingsEntry]);");
    expect(entry.indexOf('preloadOwnerParts')).toBeLessThan(entry.indexOf('if (loading ||'));
    for (const view of [sliceBetween(page, 'function StudentView(', '\nexport default function ClassTeamPage('), sliceBetween(page, 'function LockedView(', '\n}\n')]) {
      for (const mod of ['ClassTeamSettings', 'ClassTextbookNotes', 'preloadOwnerParts']) expect(view).not.toContain(mod);
    }
  });
});

// 학생 화면 마크업이 진입 경로와 무관하게 같다(같은 구성 요소 하나) — 로그인 확인 중 화면도 같다.
const auth = vi.hoisted(() => ({ value: { user: null, isAdmin: false, loading: false } }));
vi.mock('../AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('../ToastContext', () => ({ useToast: () => () => {} }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {} }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isLoading: false }), useQueryClient: () => ({}) }));

describe('화면 보존', () => {
  it('학생 · 손님: ClassHub와 ClassHubPage의 학생 분기가 같은 마크업 — 참여 화면 문구 그대로', async () => {
    const { default: ClassHub } = await import('../../views/ClassHub.jsx');
    const { default: ClassHubPage } = await import('../../views/ClassHubPage.jsx');
    auth.value = { user: null, isAdmin: false, loading: false };
    const html = renderToStaticMarkup(createElement(ClassHub));
    expect(html).toBe(renderToStaticMarkup(createElement(ClassHubPage)));
    // 분리 전 ClassHubPage 학생 분기의 마크업 그대로(머리글 · 참여 화면)
    const { ClassroomShell } = await import('../../components/classroom/ClassroomUI.jsx');
    const { default: ClassroomJoin } = await import('../../components/classroom/ClassroomJoin.jsx');
    const h = createElement;
    expect(html).toBe(renderToStaticMarkup(h(ClassroomShell, null,
      h('header', { className: 'classroom-header' }, h('div', null, h('span', { className: 'classroom-eyebrow' }, 'MANABI / CLASS'),
        h('h1', null, '함께 배우고,', h('br'), '나의 언어로.'), h('p', null, '수업에서 만난 표현을 다시 읽고, 오래 기억하세요.'))),
      h(ClassroomJoin))));
    expect(html).toContain('함께 배우고,<br/>나의 언어로.');
    expect(html).toContain('수업에서 만난 표현을 다시 읽고, 오래 기억하세요.');
    auth.value = { user: null, isAdmin: false, loading: true };
    expect(renderToStaticMarkup(createElement(ClassHub))).toBe(renderToStaticMarkup(createElement(ClassHubPage)));
    expect(renderToStaticMarkup(createElement(ClassHub))).toContain('수업을 불러오고 있어요.');
  });
});
