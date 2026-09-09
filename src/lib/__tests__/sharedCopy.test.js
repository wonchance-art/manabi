import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { copyRowFromPayload, planClaim, claimSharedCopies } from '../sharedCopy.js';
import { isCopyExpired, copyDaysLeft, SHARED_TTL_MS } from '../sharedStore.js';
import { copyIsStale, PENDING_TTL_MS } from '../classClient.js';
import { isLocalId, parseLocalId, localViewerHref, teamOpenHref, chaptersForLocalNav } from '../classBoard.js';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

/**
 * 계약: v2-AB R2 사본·복제·local: 뷰어 (#1077 5603827169 §7 R2 · 상세 5604199672 §4).
 * - `local:` 자료는 네트워크를 호출하지 않고 사본만 연다; 사본 없으면 안내
 * - 사본은 자동 캐시 축출(상한 3) 대상이 아니고 TTL 7일에만 사라진다 — offlineCache 기존 계약 무변경
 * - 복제본의 raw_text·processed_json·metadata가 사본과 동일, metadata.source_ref 원본, 재분석 0, 중복 복제 0
 * - 담기는 복제 완료 뒤(복제본 id로)
 * - local: 뷰어에서 소유자 액션이 렌더되지 않고, 담기는 CTA 시트로 간다
 */

const payload = {
  id: 12, title: '교재 — 12과', language: 'Japanese', raw_text: '私は学生です。', visibility: 'private', owner_id: 'teacher',
  updatedAt: '2026-09-09T00:00:00Z',
  processed_json: {
    sequence: ['id_0_0_1'], dictionary: { id_0_0_1: { text: '私は学生です。', pos: '명사' } }, status: 'completed', failed_indices: [],
    metadata: { language: 'Japanese', book: { key: 'bk_1', title: '교재', order: 12 }, translations: { '私は学生です。': '나는 학생입니다.' }, passageRun: { until: 'x' }, viewerRevision: 'r1' },
  },
};

describe('복제본 행', () => {
  it('원문·분석·book·translations 그대로 + metadata.source_ref(컬럼 아님) · 비공개 · 내 소유 · 임대 흔적은 뺀다', () => {
    const row = copyRowFromPayload(payload, 'student');
    expect(Object.keys(row).sort()).toEqual(['owner_id', 'processed_json', 'raw_text', 'title', 'visibility']);
    expect(row.raw_text).toBe(payload.raw_text);
    expect(row.processed_json.sequence).toEqual(payload.processed_json.sequence);
    expect(row.processed_json.dictionary).toEqual(payload.processed_json.dictionary);
    expect(row.processed_json.metadata.book).toEqual(payload.processed_json.metadata.book);
    expect(row.processed_json.metadata.translations).toEqual(payload.processed_json.metadata.translations);
    expect(row.processed_json.metadata.source_ref).toBe('12');
    expect(row.processed_json.metadata.passageRun).toBeUndefined();
    expect(row.processed_json.metadata.viewerRevision).toBeUndefined();
    expect(row.visibility).toBe('private');
    expect(row.owner_id).toBe('student');
    expect(row).not.toHaveProperty('source_ref'); // 컬럼은 vocab_words에만 있다(정정 ②)
  });

  it('같은 원본은 한 번만 — 이미 있으면 그 id로(중복 0)', () => {
    const { toInsert, byId } = planClaim([payload, { ...payload }, { id: 13, title: 'x' }], new Map([['12', 900]]));
    expect(toInsert.map((m) => m.id)).toEqual([13]);
    expect(byId.get('12')).toBe(900);
  });
});

/** 체이닝 되는 가짜 supabase — from().select().eq().not() / insert().select().single() / upsert() */
function fakeClient({ existing = [], insertIds = [1001, 1002] } = {}) {
  const calls = [];
  let n = 0;
  const q = (table) => {
    const state = { table, op: null, row: null };
    const chain = {
      select() { return chain; },
      eq() { return chain; },
      not() { return chain; },
      insert(row) { state.op = 'insert'; state.row = row; return chain; },
      upsert(row, opts) { calls.push({ table, op: 'upsert', row, opts }); return Promise.resolve({ error: null }); },
      single() {
        if (state.op === 'insert') { calls.push({ table, op: 'insert', row: state.row }); return Promise.resolve({ data: { id: insertIds[n++] }, error: null }); }
        return Promise.resolve({ data: null, error: null });
      },
      then(res) { return Promise.resolve({ data: existing, error: null }).then(res); },
    };
    return chain;
  };
  return { from: q, calls };
}

describe('복제 + 대기 담기', () => {
  it('없는 것만 넣고(재분석 0), 담기는 복제 **뒤** 복제본 id로', async () => {
    const client = fakeClient({ existing: [{ id: 900, source_ref: '13' }] });
    const pending = { materialId: 12, word: { text: '学生', base: '学生', meaning: '학생', pos: '명사', reading: 'がくせい', language: 'Japanese', sourceSentence: '私は学生です。' } };
    const r = await claimSharedCopies(client, 'student', { materials: [payload, { ...payload, id: 13 }], pending });
    expect(r.copied).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.byId.get('12')).toBe(1001);
    expect(r.byId.get('13')).toBe(900);
    expect(r.saved).toBe(true);
    expect(r.savedWord).toBe('学生');
    const ops = client.calls.map((c) => c.op);
    expect(ops).toEqual(['insert', 'upsert']); // 순서 계약 — 복제가 먼저
    const upsert = client.calls.find((c) => c.op === 'upsert');
    expect(upsert.table).toBe('user_vocabulary');
    expect(upsert.row).toMatchObject({ user_id: 'student', word_text: '学生', source_material_id: 1001, source_sentence: '私は学生です。' });
    expect(upsert.opts).toEqual({ onConflict: 'user_id,word_text', ignoreDuplicates: true });
    // 복제 행에 분석 호출 흔적이 없다 — 파이프라인 import 0
    expect(read('src/lib/sharedCopy.js')).not.toContain('analyzeText');
  });

  it('대기 단어의 원본이 이번 복제에 없으면 담지 않는다(다음 방문에서)', async () => {
    const client = fakeClient();
    const r = await claimSharedCopies(client, 'student', { materials: [payload], pending: { materialId: 77, word: { text: 'x' } } });
    expect(r.saved).toBe(false);
    expect(client.calls.map((c) => c.op)).toEqual(['insert']);
  });
});

describe('사본 저장소 — 별도 DB · TTL 7일 · 상한·핀 없음', () => {
  it('만료 판정·남은 일수 · 원본이 더 새것이면 낡은 사본', () => {
    const now = Date.UTC(2026, 8, 9);
    expect(isCopyExpired({ savedAt: now - SHARED_TTL_MS - 1 }, now)).toBe(true);
    expect(isCopyExpired({ savedAt: now - 1000 }, now)).toBe(false);
    expect(isCopyExpired(null, now)).toBe(true);
    expect(copyDaysLeft({ savedAt: now - 2 * 86_400_000 }, now)).toBe(5);
    expect(SHARED_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(PENDING_TTL_MS).toBe(SHARED_TTL_MS);
    expect(copyIsStale(null, { updatedAt: 'x' })).toBe(true);
    expect(copyIsStale({ updatedAt: '2026-09-01' }, { updatedAt: '2026-09-09' })).toBe(true);
    expect(copyIsStale({ updatedAt: '2026-09-09' }, { updatedAt: '2026-09-09' })).toBe(false);
    expect(copyIsStale({ updatedAt: null }, { updatedAt: '2026-09-09' })).toBe(false);
  });

  it('offlineCache의 materials 저장소·DB_VERSION은 손대지 않는다(기존 계약 무변경) — 사본은 자기 DB', () => {
    const cache = read('src/lib/offlineCache.js');
    expect(cache).toContain('const DB_VERSION = 2;');
    expect(cache).not.toContain('shared');
    const store = read('src/lib/sharedStore.js');
    expect(store).toContain("const DB_NAME = 'anatomy-class-shared';");
    expect(store).not.toContain('pinned');
    expect(store).not.toContain('MAX_');
  });
});

describe('local: 뷰어 — 네트워크 0', () => {
  it('id 규약 — local:<숫자>만, 링크는 팀 페이지를 거친다', () => {
    expect(isLocalId('local:12')).toBe(true);
    expect(isLocalId('12')).toBe(false);
    expect(parseLocalId('local:12')).toBe(12);
    expect(parseLocalId('local:x')).toBeNull();
    expect(localViewerHref(12, 'a')).toBe('/viewer/local:12?team=a');
    expect(teamOpenHref('a', 13)).toBe('/class/a?open=13');
    expect(chaptersForLocalNav({ chapters: [{ id: 2, title: 'b', order: 2 }, { id: 1, title: 'a', order: 1 }] }, 'a'))
      .toEqual([{ id: 1, title: 'a', order: 1, href: '/class/a?open=1' }, { id: 2, title: 'b', order: 2, href: '/class/a?open=2' }]);
    expect(chaptersForLocalNav(null, 'a')).toEqual([]);
  });

  it('뷰어 fetchMaterial은 local:이면 사본만 보고(서버 조회·캐시 폴백 없음) 없으면 LOCAL_MISSING', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    const fn = sliceBetween(viewer, 'async function fetchMaterial(id) {', '\n}\n');
    const local = fn.indexOf('if (isLocalId(id)) {');
    const shared = fn.indexOf('getSharedCopy(parseLocalId(id))');
    const network = fn.indexOf(".from('reading_materials')");
    expect(local).toBeGreaterThan(-1);
    expect(shared).toBeGreaterThan(local);
    expect(shared).toBeLessThan(network);
    expect(fn).toContain("err.code = 'LOCAL_MISSING';");
    expect(fn).toContain("return { ...copy.material, __local: true, __team: copy.team };");
    expect(viewer).toContain("if (error?.code === 'LOCAL_MISSING') {");
  });

  it('비공개 게이트가 사본을 막지 않고, 형제 과 링크는 팀 페이지(?open=)를 거치며, 소유자 액션은 owner_id 게이트 그대로', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("if (material?.visibility === 'private' && material?.owner_id !== user?.id && !material?.__local) {");
    expect(viewer).toContain("enabled: !!bookMeta?.key && !material?.__local,");
    expect(viewer).toContain('chaptersForLocalNav(readIndexCache(material.__team)?.index, material.__team)');
    expect(viewer).toContain('href={siblingNav.next.href || `/viewer/${siblingNav.next.id}`}');
    // 「다음 과 적기」는 owner_id 게이트 그대로 — 사본의 소유자는 선생님이라 학생·익명에겐 안 뜬다(bookAppend 계약 불변)
    expect(viewer).toContain("canAppend: !!user?.id && material?.owner_id === user.id,");
    // 편집·재분석·제목·삭제·교정은 전부 owner_id 게이트 — 사본의 owner_id는 선생님이라 학생에겐 안 뜬다
    expect(viewer).toContain('const canEditToken = !!user?.id && user.id === material?.owner_id;');
  });

  it('담기는 CTA 시트로 — 「로그인이 필요합니다」 토스트를 타지 않고 대기 담기를 기기에 적는다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    const add = sliceBetween(viewer, 'const addToVocab = async (grade) => {', '\n  };\n');
    expect(add).toContain("if (material?.__local) { rememberGuestSave(selectedToken);");
    expect(viewer).toContain('{!user && material?.__local && (');
    expect(viewer).toContain('className="save-grade__guest"');
    expect(viewer).toContain('onClick={() => rememberGuestSave(selectedToken)}');
    expect(viewer).toContain('href={`/auth?from=${encodeURIComponent(`/class/${material.__team}`)}`}');
    expect(read('src/index.css')).toContain('.save-grade__guest');
  });

  it('로그인 직후 복제는 Layout 효과 하나(어디서 로그인하든) — 복제 뒤 사본 삭제·대기 담기 정리', () => {
    const layout = read('src/components/Layout.jsx');
    const fx = sliceBetween(layout, '// 팀 사본 복제(v2-AB R2)', '// 복습 알림 스케줄러');
    const claim = fx.indexOf('claimSharedCopies(supabase, user.id, { materials: copies.map((c) => c.material), pending })');
    const del = fx.indexOf('deleteSharedCopy(c.id)');
    expect(claim).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(claim);
    expect(fx).toContain('if (r.saved) clearPendingSave();');
    expect(fx).toContain("window.dispatchEvent(new CustomEvent('manabi:shared-claimed'));");
  });

  it('팀 페이지 — 받기는 여기서만(ensureSharedCopy → local: 뷰어), 오너 뷰는 API 라우트 0, 로그인 학생은 즉시 복제', () => {
    const page = read('src/views/ClassTeamPage.jsx');
    expect(page).toContain('await ensureSharedCopy(teamKey, unlock.token, entry);');
    expect(page).toContain('router.push(localViewerHref(id, teamKey));');
    expect(page).toContain("const wanted = search.get('open');");
    const owner = sliceBetween(page, 'function OwnerView(', '\nfunction NotesList(');
    expect(owner).not.toContain('fetch(');
    expect(owner).not.toContain('unlock');
    expect(page).toContain('const r = await claimSharedCopies(supabase, user.id, { materials: [payload] });');
    // 401 = 잠김으로(암호 변경·30일)
    expect(page).toContain('if (err?.status === 401) relock(RELOCK_MSG);');
    // 뷰어 메타는 local:이면 서버를 묻지 않는다
    expect(read('src/app/(app)/viewer/[id]/page.jsx')).toContain("if (String(id).startsWith('local:')) return { title: '팀 자료 사본'");
  });
});
