// VIEWER-MEMBER-SSR-001 — 로그인 계정이 남의 공개 자료를 처음 열 때도 본문을 서버가 그리고, 계정 줄은 ㉠ 「처음부터 자리 잡기」
// (오너 「㉠ 권장대로」 2026-11-04 KST). 계약:
// ① 누구에게 그리나 — 손님은 그대로 · 로그인은 남의 공개 자료 + 읽던 곳 없음(서버가 그 계정 토큰으로 본 값)만 · 내 자료 · 읽던 곳 있음/모름 ·
//    수업에서 연 글은 지금처럼(B). ② 서버가 읽던 곳을 그 계정 권한으로 나란히 읽고, 손님 seed 모양은 그대로다.
// ③ 닫아 둔 단어 현황 줄은 첫 그림 전 기기 값으로 자리를 만들지 않는다(정본 문자열을 그대로 돌린다).
// ④ 계정 확인 전 누름은 기다렸다가 같은 계정으로 확인되면 한 번 한다(버리지도 · 반대로 하지도 않는다).
// ⑤ 배선 — 한 줄 자리 · 채운 줄이 같은 높이(본문이 밀리지 않는다), 넘치면 「…」, 손님 띠는 확인 전에 그리지 않는다.
// 실제 밀림 0 · 시각은 빌드 측정(Playwright CPU×4)이 본다.
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => { throw new Error('network not used in this test'); } } }));
vi.mock('../supabase', () => ({ supabase: { from: () => { throw new Error('network not used in this test'); } } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ getAll: () => [], get: () => undefined }) }));
vi.mock('@/lib/supabaseServer', () => ({ requireUserClaims: async () => ({ error: 'x' }), createSupabasePublicClient: () => null }));

const { viewerSsrRow, viewerBadgesKey, viewerBadgesPreRead, viewerBadgesPreReadScript, viewerSeedAccount, releaseViewerBadgesPreRead } = await import('../viewerSsr');
const { loadViewerSeed } = await import('../server/viewerSeed');
const { libraryToggleOp, queuedPressStep } = await import('../pendingPress');
const { default: LibrarySaveButton } = await import('@/components/library/LibrarySaveButton');
const { default: ReportMaterialButton } = await import('@/components/ReportMaterialButton');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ROW = { id: 45, owner_id: 'OWNER', visibility: 'public', title: '자료', raw_text: '本', processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence: ['id_0_0'], dictionary: {} } };
const seed = (over = {}) => ({ id: '45', row: ROW, account: null, servedAt: 1_000_000, ...over });
const member = (over = {}) => seed({ account: 'ME', resume: false, ...over });

describe('① 누구에게 서버 그림을 주나', () => {
  it('손님은 그대로 — 계정 없음 · 공개 · 분석 끝남이면 그린다(수업 주소여도 지금과 같다)', () => {
    expect(viewerSsrRow(seed(), '45')).toBe(ROW);
    expect(viewerSsrRow(seed(), '45', new URLSearchParams('returnTo=%2Fclass%2Fteam-a'))).toBe(ROW);
    expect(viewerSsrRow(seed({ resume: true }), '45')).toBe(ROW); // 손님 seed에는 resume이 없지만, 있어도 손님 판정은 바뀌지 않는다
  });
  it('로그인 — 남의 공개 자료 · 읽던 곳 없음이면 손님과 같은 서버 그림', () => {
    expect(viewerSsrRow(member(), '45')).toBe(ROW);
    expect(viewerSsrRow(member(), '45', new URLSearchParams('returnTo=%2Fmaterials'))).toBe(ROW);
    expect(viewerSsrRow(member(), '45', { returnTo: '/discover' })).toBe(ROW);
  });
  it.each([
    ['내 자료(소유자 도구 · 제목 편집이 붙는다)', member({ row: { ...ROW, owner_id: 'ME' } })],
    ['읽던 곳 있음(뷰어가 그 쪽으로 넘긴다)', member({ resume: true })],
    ['읽던 곳 모름(조회 실패 · 시간 초과)', member({ resume: undefined })],
    ['계정은 있는데 resume 칸이 없다(옛 모양)', seed({ account: 'ME' })],
    ['빈 계정', member({ account: '' })],
    ['계정 모름', seed({ account: undefined })],
    ['비공개', member({ row: { ...ROW, visibility: 'private' } })],
    ['중국어', member({ row: { ...ROW, processed_json: { ...ROW.processed_json, metadata: { language: 'Chinese' } } } })],
  ])('%s → 지금처럼(B — 브라우저가 그린다)', (_, s) => { expect(viewerSsrRow(s, '45')).toBeNull(); });
  it('수업에서 연 글(returnTo /class/ — 본문 위에 수업 사본 안내가 붙는다) · 다른 질의는 로그인에게 그리지 않는다', () => {
    expect(viewerSsrRow(member(), '45', new URLSearchParams('returnTo=%2Fclass%2Fteam-a'))).toBeNull();
    expect(viewerSsrRow(member(), '45', { returnTo: '/class/team-a?view=history' })).toBeNull();
    for (const q of ['sourceEntry=1', 'study=1', 'returnTo=%2Fa&sourceQuote=b']) expect(viewerSsrRow(member(), '45', new URLSearchParams(q))).toBeNull();
  });
  it('seed 계정 판정은 하나 — 서버 · 하이드레이션이 같은 값', () => {
    expect(viewerSeedAccount(member())).toBe('ME');
    for (const s of [seed(), seed({ account: '' }), seed({ account: undefined }), null, undefined]) expect(viewerSeedAccount(s)).toBeNull();
  });
});

function client(results, calls) {
  const chain = (table) => {
    const c = {
      select: (s) => { calls.push(['select', table, s]); return c; },
      eq: (col, v) => { calls.push(['eq', table, col, v]); return c; },
      abortSignal: () => c,
      maybeSingle: async () => { const r = results[table]; if (r instanceof Error) throw r; return r; },
    };
    return c;
  };
  return { from: (t) => { calls.push(['from', t]); return chain(t); } };
}
const PUBLIC = { ...ROW, visibility: 'public' };

describe('② 서버 — 읽던 곳을 그 계정 권한으로 나란히', () => {
  const run = (progress, extra = {}) => {
    const calls = [];
    return loadViewerSeed('45', { sessionCookie: true, now: () => 5, publicClient: () => { throw new Error('anon not used'); },
      auth: async () => ({ supabase: client({ reading_materials: { data: PUBLIC, error: null }, reading_progress: progress }, calls), user: { id: 'ME' } }), ...extra })
      .then((s) => ({ s, calls }));
  };
  it('읽던 곳 > 0이면 resume true · 행 없음/0이면 false · 오류/던짐이면 모름(undefined)', async () => {
    expect((await run({ data: { last_token_idx: 812 }, error: null })).s.resume).toBe(true);
    expect((await run({ data: null, error: null })).s.resume).toBe(false);
    expect((await run({ data: { last_token_idx: 0 }, error: null })).s.resume).toBe(false);
    expect((await run({ data: { last_token_idx: null }, error: null })).s.resume).toBe(false);
    expect((await run({ data: null, error: { message: 'x' } })).s.resume).toBeUndefined();
    const thrown = await run(new Error('timeout'));
    expect(thrown.s.resume).toBeUndefined();
    expect(thrown.s.row).toBe(PUBLIC); // 읽던 곳을 못 봐도 본문 seed는 지금처럼 싣는다(B 길)
  });
  it('자기 행만 본다 — user_id = 그 계정 · material_id = 이 자료(서비스 키 없음, 같은 토큰 클라이언트)', async () => {
    const { calls } = await run({ data: null, error: null });
    expect(calls).toContainEqual(['eq', 'reading_progress', 'user_id', 'ME']);
    expect(calls).toContainEqual(['eq', 'reading_progress', 'material_id', '45']);
    expect(read('src/lib/server/viewerSeed.js')).not.toMatch(/service_role|SERVICE_ROLE|createSupabaseAdmin/);
  });
  it('손님은 읽던 곳을 묻지 않고 seed 모양도 그대로(resume 칸 없음 — 손님 첫 HTML 바이트 그대로)', async () => {
    const calls = [];
    const s = await loadViewerSeed('45', { publicClient: () => client({ reading_materials: { data: PUBLIC, error: null } }, calls), now: () => 5 });
    expect(s).toEqual({ id: '45', row: PUBLIC, account: null, servedAt: 5 });
    expect(Object.keys(s)).toEqual(['id', 'row', 'account', 'servedAt']);
    expect(calls.some(([, t]) => t === 'reading_progress')).toBe(false);
  });
});

describe('③ 닫아 둔 단어 현황 줄은 첫 그림 전에 읽는다', () => {
  const fake = (items, { throws = false } = {}) => {
    const attrs = {};
    const w = { localStorage: { getItem: (k) => { if (throws) throw new Error('blocked'); return k in items ? items[k] : null; } },
      document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } } } };
    return { w, attrs };
  };
  it('키는 뷰어와 같다 — 계정 · 자료마다 따로', () => {
    expect(viewerBadgesKey('ME', '45')).toBe('viewer-badges-dismissed:ME:45');
    expect(viewerBadgesKey(null, '45')).toBe('viewer-badges-dismissed:guest:45');
  });
  it('닫은 값이 있으면(0 포함) 표지를 붙이고, 없거나 저장소를 못 읽으면 붙이지 않는다', () => {
    for (const value of ['0', '3']) {
      const f = fake({ 'viewer-badges-dismissed:ME:45': value });
      viewerBadgesPreRead(f.w, { key: viewerBadgesKey('ME', '45') });
      expect(f.attrs['data-viewer-badges-dismissed']).toBe('');
    }
    for (const f of [fake({}), fake({ 'viewer-badges-dismissed:OTHER:45': '0' }), fake({ 'viewer-badges-dismissed:ME:46': '0' }), fake({}, { throws: true })]) {
      viewerBadgesPreRead(f.w, { key: viewerBadgesKey('ME', '45') });
      expect(f.attrs['data-viewer-badges-dismissed']).toBeUndefined();
    }
  });
  it('정본 문자열을 그대로 돌린다 — 바깥 이름 없이 · </script> 조각 없음', () => {
    const script = viewerBadgesPreReadScript({ account: 'ME', id: '45' });
    expect(script).not.toMatch(/<\/script/i);
    const f = fake({ 'viewer-badges-dismissed:ME:45': '0' });
    new Function('window', script)(f.w);
    expect(f.attrs['data-viewer-badges-dismissed']).toBe('');
    expect(viewerBadgesPreReadScript({ account: '</script><b>', id: '45' })).not.toMatch(/<\/script/i);
    // 뷰어가 상태로 옮긴 뒤 뗀다
    releaseViewerBadgesPreRead(f.w.document);
    expect(f.attrs['data-viewer-badges-dismissed']).toBeUndefined();
  });
});

describe('④ 계정 확인 전 누름 — 기다렸다가 같은 계정이면 한 번', () => {
  it('기다림 판정', () => {
    expect(queuedPressStep({ queued: null, account: 'ME' })).toBe('none');
    expect(queuedPressStep({ queued: 'ME', account: null })).toBe('wait');
    expect(queuedPressStep({ queued: 'ME', account: 'ME', ready: false })).toBe('wait'); // 담김 상태를 아직 모른다
    expect(queuedPressStep({ queued: 'ME', account: 'ME', ready: true, busy: true })).toBe('wait');
    expect(queuedPressStep({ queued: 'ME', account: 'ME', ready: true })).toBe('run');
    expect(queuedPressStep({ queued: 'ME', account: 'OTHER', ready: true })).toBe('drop'); // 남의 누름을 대신하지 않는다
  });
  it('확인 전에 누른 「서재에 담기」는 담기 — 이미 담겼으면 아무것도 안 한다(빼지 않는다) · 휴지통이면 복원', () => {
    expect(libraryToggleOp({ saved: false, state: null }, 'save')).toBe('save');
    expect(libraryToggleOp({ saved: true, state: 'active' }, 'save')).toBeNull();
    expect(libraryToggleOp({ saved: false, state: 'trashed' }, 'save')).toBe('restore');
    // 확인된 뒤의 누름은 지금 그대로(토글)
    expect(libraryToggleOp({ saved: true, state: 'active' })).toBe('trash');
    expect(libraryToggleOp({ saved: false, state: null })).toBe('save');
    expect(libraryToggleOp(null)).toBeNull();
  });
  const render = (el) => renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, el));
  it('서버 그림(계정 확인 전) — 담기 버튼은 흐리게 제자리(disabled 아님 — 누름을 받는다), 신고도 제자리', () => {
    auth.user = null;
    const html = render(createElement(LibrarySaveButton, { material: PUBLIC, pendingAccount: 'ME' }));
    expect(html).toContain('class="library-save-control"');
    expect(html).toMatch(/<button data-pending="" aria-pressed="false">서재에 담기<\/button>/);
    expect(html).not.toContain('disabled');
    expect(render(createElement(ReportMaterialButton, { materialId: 45, userId: undefined, pendingAccount: 'ME' }))).toContain('>신고</button>');
  });
  it('손님 · 내 자료에는 그리지 않는다(지금 그대로)', () => {
    auth.user = null;
    expect(render(createElement(LibrarySaveButton, { material: PUBLIC }))).toBe('');
    expect(render(createElement(LibrarySaveButton, { material: { ...PUBLIC, owner_id: 'ME' }, pendingAccount: 'ME' }))).toBe('');
    expect(render(createElement(ReportMaterialButton, { materialId: 45, userId: undefined }))).toBe('');
  });
  it('확인됐지만 담김 상태를 아직 모를 때도 흐린 채 누름을 받는다(예전엔 disabled라 누름이 사라졌다)', () => {
    auth.user = { id: 'ME' };
    expect(render(createElement(LibrarySaveButton, { material: PUBLIC }))).toMatch(/<button data-pending="" aria-pressed="false">서재에 담기<\/button>/);
    auth.user = null;
  });
  it('버튼이 기다림 판정을 쓴다', () => {
    const save = read('src/components/library/LibrarySaveButton.jsx');
    expect(save).toContain("const step=queuedPressStep({queued,account:user?.id,ready,busy});");
    expect(save).toContain("else if(step==='run'){setQueued(null);toggle('save');}");
    expect(save).toContain('const press=()=>{if(ready)toggle();else if(!busy&&!bookmark.isError)setQueued(account);};');
    const report = read('src/components/ReportMaterialButton.jsx');
    expect(report).toContain("if (step === 'run') { setQueued(null); setOpen(true); } else if (step === 'drop') setQueued(null);");
    expect(report).toContain('onClick={() => (userId ? setOpen(true) : setQueued(pendingAccount))}');
  });
});

describe('⑤ 배선 — 한 줄 자리 · 밀림 0 · 손님 그대로', () => {
  const viewer = () => read('src/views/ViewerPage.jsx');
  const header = () => sliceBetween(viewer(), '<header className="page-header viewer-header">', '</header>');
  it('쪽 — 세션 쿠키 계정이면 본문(과 서버 그림 판정) 앞에서 닫은 줄을 읽는다', () => {
    const body = sliceBetween(read('src/app/(app)/viewer/[id]/page.jsx'), 'async function SeededViewerPage', '\n}\n');
    expect(body).toContain('const account = viewerSeedAccount(seed);');
    // 한 요소 · 닫은 줄 읽기가 먼저 — 손님은 지금과 같은 요소 · 같은 글(화면 조각 바이트 그대로, 빌드 실측 대조)
    expect(body).toContain("{(account || ssr) && <script dangerouslySetInnerHTML={{ __html: (account ? viewerBadgesPreReadScript({ account, id: seed.id }) : '')");
    expect(body).toContain("+ (ssr ? viewerSsrGuardScript({ language: ssr.processed_json?.metadata?.language || 'Japanese', servedAt: seed.servedAt }) : '') }} />}");
    expect(body.indexOf('viewerBadgesPreReadScript(')).toBeLessThan(body.indexOf('viewerSsrGuardScript('));
    expect(body.indexOf('viewerSsrGuardScript(')).toBeLessThan(body.indexOf('<ViewerPage seed={seed ?? undefined} />'));
  });
  it('뷰어 — 확인 전 계정 = 서버가 읽은 계정, 그동안 손님 띠 없음', () => {
    expect(viewer()).toContain('const memberPending = !user && authLoading && !!viewerSeedAccount(seed);');
    expect(viewer()).toContain('const memberAccount = user?.id ?? (memberPending ? viewerSeedAccount(seed) : null);');
    expect(viewer()).toContain('{!user && !memberPending && <ViewerGuestBanner');
  });
  it('계정 줄 ① — 서재에 담기 · 신고가 한 줄, 확인 전에는 기다림 모드', () => {
    const row = sliceBetween(header(), '<div className="viewer-member-actions">', '</div>');
    expect(row).toContain('<LibrarySaveButton material={material} pendingAccount={memberPending ? memberAccount : null}/>');
    expect(row).toContain('<ReportMaterialButton materialId={material.id} userId={user?.id} pendingAccount={memberPending ? memberAccount : null} toast={toast} />');
    expect(header()).toContain("{memberAccount && material?.visibility === 'public' && material?.owner_id !== memberAccount && (");
  });
  it('계정 줄 ② — 빈 막대는 같은 자리(채운 줄 바로 뒤 형제) · 줄이 반드시 서는 자료만 · 닫았으면 없음 · 채워지면 사라짐', () => {
    const h = header();
    const filled = h.indexOf('<div className="viewer-badges">'), pending = h.indexOf('<div className="viewer-badges viewer-badges--pending" aria-hidden="true">');
    expect(filled).toBeGreaterThan(-1);
    expect(pending).toBeGreaterThan(filled);
    expect(h).toContain('{memberAccount && badgesExpected && !badgeDataSettled && !badgesDismissed && (');
    // 자리를 잡은 줄은 다 온 뒤 한 번에 — 빈 막대와 채운 줄이 동시에 서지 않고, 부분(복습 · 수집만)이 먼저 나오지 않는다
    expect(h).toContain('{!badgesDismissed && (badgeDataSettled || !badgesExpected) && ((user && dueInMaterial > 0) || coverage || collectedInMaterial > 0) && (');
    // 줄이 반드시 서는가는 자료만으로 정해진다(계정 무관 표본) — 커버리지 배지와 같은 하한
    expect(viewer()).toContain('const badgesExpected = useMemo(() => !!material?.processed_json && materialFit(material.processed_json, null).total >= FIT_MIN_TYPES, [material?.processed_json]);');
    // 계정 단어 자료가 다 온 뒤에만 센다(빈 목록의 「아는 말 0%」를 먼저 보이지 않는다)
    expect(viewer()).toContain('if (!badgeDataSettled) return null;');
    // 닫은 값은 그리기 전에 읽고(layout effect) 첫 그림 전 표지를 뗀다
    expect(sliceBetween(viewer(), 'const badgesKey = viewerBadgesKey(memberAccount, id);', '[badgesKey]);')).toContain('useLayoutEffect(() => {');
    expect(viewer()).toContain('if (memberAccount) releaseViewerBadgesPreRead();');
  });
  it('계정 줄 ② — 한 줄 문구(목업): 복습 가능 · 아는 말 · 새 단어 · 수집, ✕는 줄 끝', () => {
    const line = sliceBetween(header(), '<span className="viewer-badges__line">', '<button type="button" className="viewer-badges__close"');
    const order = ["vt('{count}개 복습 가능'", "' · '", "vt('아는 말 {percent}% · 새 단어 {count}'", "vt('{count}개 수집 · 이 자료 표현 복습'"].map((s) => line.indexOf(s));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('CSS — 빈 막대와 채운 줄이 같은 높이(같은 규칙), 한 줄 · 넘치면 「…」, 닫은 자료는 막대 없음, 색은 토큰', () => {
    const css = read('src/components/viewer/reader-controls.css');
    const rule = sliceBetween(css, '.manabi-app .viewer-layout .viewer-badges {', '}');
    expect(rule).toContain('min-height:28px');
    expect(rule).toContain('flex-wrap:nowrap');
    const line = sliceBetween(css, '.manabi-app .viewer-layout .viewer-badges__line {', '}');
    for (const d of ['white-space:nowrap', 'text-overflow:ellipsis', 'overflow:hidden', 'min-width:0']) expect(line).toContain(d);
    expect(css).toContain('html[data-viewer-badges-dismissed] .viewer-badges--pending {display:none;}');
    expect(sliceBetween(css, '.manabi-app .viewer-layout .viewer-badges__skeleton {', '}')).toContain('background:color-mix(in srgb,var(--reader-ink) 9%,transparent)');
    expect(sliceBetween(css, '.manabi-app .viewer-layout .viewer-member-actions {', '}')).toContain('min-height:44px');
    expect(css).toContain('.manabi-app .viewer-layout .library-save-control>button[data-pending] {opacity:.5;}');
  });
});
