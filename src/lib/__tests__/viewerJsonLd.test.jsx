import { beforeEach, describe, expect, it, vi } from 'vitest';
import { materialJsonLd } from '../materialSeo';

// VIEWER-SEO-001 — 뷰어 쪽이 구조화 데이터(LearningResource)를 붙이는 조건: 서버가 본문을 그리는 손님 판(viewerSsrRow) 중 검색에 싣는 자료
// (isIndexableMaterial — 우리 공개 · 분석된 자료)만. 쪽 함수를 직접 불러 돌려준 요소 트리를 본다(본문 · 글꼴 부품은 빈 것으로 바꾼다).
const state = vi.hoisted(() => ({ seed: null, ssr: null, ids: null }));
vi.mock('@/lib/server/viewerSeed', () => ({ readViewerSeed: async () => state.seed, viewerSeedWithin: async () => state.seed }));
vi.mock('@/lib/viewerSsr', () => ({ viewerSsrRow: () => state.ssr, viewerSsrGuardScript: () => '' }));
vi.mock('@/lib/server/curatedMaterials', async (orig) => ({ ...(await orig()), curatorIds: async () => state.ids }));
vi.mock('@/lib/supabaseServer', () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock('@/views/ViewerPage', () => ({ default: () => null }));
vi.mock('@/components/viewer/ViewerLoading', () => ({ default: () => null }));
vi.mock('@/components/fonts/ScFontLink', () => ({ ScFontLink: () => null }));
vi.mock('@/components/fonts/DeferredZhFontSheets', () => ({ default: () => null }));

const row = { id: 45, title: '[N5 문법 #1] ~は~です (기본 단정문)', visibility: 'public', owner_id: 'admin-1', raw_text: 'わたしは がくせいです。',
  processed_json: { status: 'completed', sequence: ['t'], metadata: { language: 'Japanese', level: 'N5 기초' } } };

function scripts(node, out = []) {
  if (Array.isArray(node)) { for (const n of node) scripts(n, out); return out; }
  if (!node || typeof node !== 'object') return out;
  if (node.type === 'script' && node.props?.type === 'application/ld+json') out.push(JSON.parse(node.props.dangerouslySetInnerHTML.__html));
  scripts(node.props?.children, out);
  return out;
}

async function render(id = '45') {
  const { default: Page } = await import('@/app/(app)/viewer/[id]/page');
  const suspense = Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
  const seeded = suspense.props.children;
  return scripts(await seeded.type(seeded.props));
}

describe('뷰어 쪽 구조화 데이터(VIEWER-SEO-001)', () => {
  beforeEach(() => { state.seed = { id: '45', row, account: null, servedAt: 0 }; state.ssr = row; state.ids = new Set(['admin-1']); });

  it('손님 서버 본문 · 우리 공개 자료 = LearningResource 하나', async () => {
    expect(await render()).toEqual([materialJsonLd('45', row)]);
  });

  it('서버 본문이 아니면(로그인 · 질의 · 분석 전 — viewerSsrRow null) 붙이지 않는다', async () => {
    state.ssr = null;
    expect(await render()).toEqual([]);
  });

  it('다른 계정이 공개로 돌린 자료(검색에서 빠지는 자료)에는 붙이지 않는다', async () => {
    state.ssr = { ...row, owner_id: 'someone' };
    expect(await render()).toEqual([]);
  });

  it('관리자 목록을 모르면(키 없음 · 조회 실패) 빼지 않는다 — 메타 색인 판정과 같다', async () => {
    state.ids = null;
    expect(await render()).toHaveLength(1);
  });
});
