import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), service: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: mocks.authenticate, requireUserForRead: mocks.authenticate }));
vi.mock('@/lib/server/fsrsLearning', async original => ({ ...(await original()), fsrsServiceClient: mocks.service }));
import { readVocabularyLearningSnapshotCards, validateVocabularyLearningSnapshot, VOCABULARY_CARDS_MAX } from '../server/fsrsVocabulary.js';
import { fetchVocabularyLearningCards, projectVocabularyLearningRows, VOCABULARY_LEARNING_CARDS_MAX } from '../vocabularyLearningRows.js';
import { defaultRegistryEntry } from '../vocabularySnapshotLight.js';
import { introduceFsrsCard } from '../fsrsScheduler.js';
import { GET } from '../../app/api/learning/vocabulary/route.js';

// SNAPSHOT-CARDS-001(오너 「A안 적용」 2026-10-26 KST) — 저장 · 채점 뒤 색인을 전체 snapshot 대신 그 카드만으로 고친다. 계약:
// ⑴ 판정은 하나 — cards 본문 = 최신 snapshot 정의에서 요청 검사 두 줄 · x의 id 조건만 다르다(주석 빼고 바이트 그대로 — snapshot이 바뀌면 여기서 깨진다)
// ⑵ 서버 읽기 — 정확한 인자 · 같은 검사 · 요청한 id의 행만 · 함수 없음(PGRST202)일 때만 전체 snapshot을 그 id로 걸러 물러섬(다른 오류는 그대로)
// ⑶ 경로 — GET view=learning&ids=…(소문자 UUID 1~50개)만, 다른 칸과 섞으면 400 · 브라우저 읽기는 요청하지 않은 행을 받지 않는다
// SQL 함수 = snapshot을 그 id로 거른 것은 supabase/tests/vocabulary-snapshot-cards.mjs(PGlite)가 모든 학습자 · 여러 묶음으로 증명한다.
// 색인 패치 = 전체로 다시 만든 색인은 vocabWordsCardsPatch.test.js.
const ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const md5 = text => createHash('md5').update(text).digest('hex');

function latestDefinition(signature) {
  const pattern = new RegExp(`CREATE OR REPLACE FUNCTION ${signature.replace(/[.()[\]]/g, '\\$&')}[\\s\\S]*? AS \\$fn\\$([\\s\\S]*?)\\$fn\\$;`);
  let found = null;
  for (const file of fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    const match = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').match(pattern);
    if (match) found = { file, body: match[1] };
  }
  if (!found) throw new Error(`${signature} 정의가 없다`);
  return found;
}
const between = (text, start, end) => {
  const i = text.indexOf(start);
  const j = text.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error(`조각을 찾지 못했다: ${start.slice(0, 40)}`);
  return text.slice(i, j + end.length);
};
const REQUEST_CHECK = " IF (CASE WHEN p_ids IS NULL OR array_ndims(p_ids) IS DISTINCT FROM 1 OR cardinality(p_ids) NOT BETWEEN 1 AND 50 THEN true ELSE array_position(p_ids, NULL) IS NOT NULL END)\n THEN RAISE EXCEPTION 'invalid_fsrs_request' USING ERRCODE='22023'; END IF;\n";
const CARDS_WHERE = '  WHERE v.user_id=p_actor AND v.id=ANY(p_ids))\n';
const SNAP_WHERE = '  WHERE v.user_id=p_actor)\n';
const code = body => body.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');

describe('⑴ 판정은 하나 — cards 본문 = 최신 snapshot 정의(요청 검사 · id 조건만 다르다)', () => {
  const snap = latestDefinition('public.fsrs_vocabulary_snapshot(p_actor uuid)');
  const cards = latestDefinition('public.fsrs_vocabulary_snapshot_cards(p_actor uuid, p_ids uuid[])');
  const cardsFile = fs.readFileSync(path.join(MIGRATIONS, cards.file), 'utf8');

  it('cards 마이그레이션이 검사하는 snapshot 본문 md5 = 저장소의 최신 snapshot 정의(그 뒤에 snapshot을 바꾸면 cards도 함께 바꿔야 한다)', () => {
    expect(cards.file > snap.file).toBe(true);
    expect(cardsFile).toContain(`IS DISTINCT FROM '${md5(snap.body)}'`);
    expect(cardsFile.split(md5(cards.body)).length - 1).toBe(2); // 사전 · 사후 검사가 자기 본문 md5를 고정
  });
  it('주석을 빼면 snapshot 본문 그대로 — 요청 검사 한 문장과 x의 id 조건만 더했다', () => {
    expect(cards.body).toContain(REQUEST_CHECK);
    expect(cards.body).toContain(CARDS_WHERE);
    expect(snap.body).toContain(SNAP_WHERE);
    expect(code(cards.body).replace(REQUEST_CHECK, '').replace(CARDS_WHERE, SNAP_WHERE)).toBe(code(snap.body));
  });
  it('계정 검사(무결성 · 행위자 42501 · 55000 둘) · WITH 판정 · 머리 · rows · registry 조각이 같다(좁히지 않는다)', () => {
    const guard = body => between(body, ' PERFORM fsrs_private.require_admission_integrity();', ' SELECT * INTO STRICT s FROM fsrs_private.settings;');
    expect(guard(cards.body)).toBe(guard(snap.body));
    const foreign = body => between(body, ' IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v', "USING ERRCODE='55000'; END IF;");
    expect(foreign(cards.body)).toBe(foreign(snap.body));
    const judged = body => between(body, ' WITH kw AS (', '  WHERE v.user_id=p_actor');
    expect(judged(cards.body)).toBe(judged(snap.body));
    const output = body => between(body, " SELECT jsonb_build_object('version',1,", ' RETURN result;');
    expect(output(cards.body)).toBe(output(snap.body));
    // 요청 검사는 계정 검사보다 먼저(남의 계정 여부를 묻기 전에 모양부터 거절)
    expect(cards.body.indexOf(REQUEST_CHECK)).toBeLessThan(cards.body.indexOf('PERFORM fsrs_private.require_admission_integrity()'));
  });
  it('권한은 snapshot과 같은 모양 — service_role만 EXECUTE · 같은 속성 줄 · 상한 50이 서버 · 브라우저와 같다', () => {
    expect(cardsFile).toMatch(/REVOKE ALL ON FUNCTION public\.fsrs_vocabulary_snapshot_cards\(uuid,uuid\[\]\) FROM PUBLIC, anon, authenticated, service_role;\nGRANT EXECUTE ON FUNCTION public\.fsrs_vocabulary_snapshot_cards\(uuid,uuid\[\]\) TO service_role;/);
    expect(cardsFile).toMatch(/fsrs_vocabulary_snapshot_cards\(p_actor uuid, p_ids uuid\[\]\)\n RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''/);
    expect([VOCABULARY_CARDS_MAX, VOCABULARY_LEARNING_CARDS_MAX]).toEqual([50, 50]);
  });
  it('복원 SQL이 같은 본문만 지우고 core를 재게시한다', () => {
    const restore = fs.readFileSync(path.join(ROOT, 'docs/sql/vocabulary-snapshot-cards-rollback.sql'), 'utf8');
    expect(restore).toContain(`IS DISTINCT FROM '${md5(cards.body)}'`);
    expect(restore).toContain('DROP FUNCTION IF EXISTS public.fsrs_vocabulary_snapshot_cards(uuid,uuid[]);');
    expect(restore).toContain('UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash()');
  });
});

const ACTOR = '10000000-0000-4000-8000-0000000000aa';
const NOW = '2026-10-26T03:00:00.000Z';
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function snapshot() {
  const rows = [], registry = [];
  for (let n = 1; n <= 6; n++) {
    const row = { id: id(n), user_id: ACTOR, word_text: `w${n}`, base_form: `w${n}`, meaning: `뜻 ${n}`, language: n % 2 ? 'Japanese' : 'Chinese',
      created_at: NOW, interval: 1, ease_factor: 2.5, repetitions: 1, last_reviewed_at: NOW, next_review_at: NOW, source_material_id: null, source_ref: null, furigana: '' };
    rows.push(row);
    registry.push(defaultRegistryEntry(row.id, ACTOR));
  }
  const card = introduceFsrsCard(Date.parse(NOW) - 3600000, { policyVersion: 'anki-v2' });
  Object.assign(registry[2], { enrolled: true, card, nextQuestionAt: card.due });
  Object.assign(registry[3], { known: true, excluded: true, eligible: false });
  return { version: 1, learningAdmissionVersion: 1, actorId: ACTOR, enabled: true, registryAvailable: true, complete: true, now: NOW, rows, registry };
}
const pick = (full, ids) => ({ ...full, rows: full.rows.filter(r => ids.includes(r.id)), registry: full.registry.filter(e => ids.includes(e.cardId)) });

describe('⑵ 서버 읽기 — 정확한 인자 · 요청한 id만 · 함수 없음일 때만 물러섬', () => {
  const client = handler => ({ rpc: vi.fn(handler) });
  it('카드 RPC 하나를 정확한 인자로 부르고, 결과는 전체 snapshot을 그 id로 거른 것과 같다(같은 검사)', async () => {
    const full = snapshot(), ids = [id(3), id(4)];
    const service = client(() => ({ data: pick(full, ids), error: null }));
    const got = await readVocabularyLearningSnapshotCards({ serviceClient: service, userId: ACTOR, ids });
    expect(service.rpc.mock.calls).toEqual([['fsrs_vocabulary_snapshot_cards', { p_actor: ACTOR, p_ids: ids }]]);
    expect(got).toEqual(validateVocabularyLearningSnapshot(pick(full, ids), ACTOR));
    expect(got.rows.map(r => r.id)).toEqual(ids);
  });
  it('요청하지 않은 행이 오면(전체 snapshot을 잘못 받은 것 등) snapshot을 못 읽은 것과 같은 오류', async () => {
    const service = client(() => ({ data: snapshot(), error: null }));
    await expect(readVocabularyLearningSnapshotCards({ serviceClient: service, userId: ACTOR, ids: [id(1)] })).rejects.toMatchObject({ code: 'fsrs_snapshot_unavailable' });
  });
  it('운영에 함수가 아직 없으면(PGRST202 + 그 이름) 전체 snapshot 한 번을 그 id로 걸러 같은 값', async () => {
    const full = snapshot(), ids = [id(2), id(5)];
    const missing = { code: 'PGRST202', message: 'Could not find the function public.fsrs_vocabulary_snapshot_cards(p_actor, p_ids) in the schema cache' };
    const service = client(name => (name === 'fsrs_vocabulary_snapshot_cards' ? { data: null, error: missing } : { data: full, error: null }));
    const got = await readVocabularyLearningSnapshotCards({ serviceClient: service, userId: ACTOR, ids });
    expect(service.rpc.mock.calls.map(c => c[0])).toEqual(['fsrs_vocabulary_snapshot_cards', 'fsrs_vocabulary_snapshot']);
    expect(got).toEqual(validateVocabularyLearningSnapshot(pick(full, ids), ACTOR));
  });
  it('다른 오류(시간 초과 · 다른 함수 없음 · 계정)는 물러서지 않고 그대로 — 과부하 때 읽기를 두 배로 하지 않는다', async () => {
    for (const error of [{ code: '57014', message: 'canceling statement due to statement timeout' },
      { code: 'PGRST202', message: 'Could not find the function public.fsrs_vocabulary_snapshot_light in the schema cache' },
      { code: '42501', message: 'invalid_fsrs_actor' }]) {
      const service = client(() => ({ data: null, error }));
      await expect(readVocabularyLearningSnapshotCards({ serviceClient: service, userId: ACTOR, ids: [id(1)] })).rejects.toThrow();
      expect(service.rpc).toHaveBeenCalledTimes(1);
    }
  });
  it.each([
    ['비었음', []], ['51개', Array.from({ length: 51 }, (_, n) => id(n + 1))], ['중복', [id(1), id(1)]], ['대문자', ['AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA']],
    ['UUID 아님', ['nope']], ['배열 아님', id(1)],
  ])('id 목록이 %s이면 부르기 전에 400', async (_name, ids) => {
    const service = client(() => ({ data: null, error: null }));
    await expect(readVocabularyLearningSnapshotCards({ serviceClient: service, userId: ACTOR, ids })).rejects.toMatchObject({ status: 400 });
    expect(service.rpc).not.toHaveBeenCalled();
  });
  it('계정 없음은 401', async () => {
    await expect(readVocabularyLearningSnapshotCards({ serviceClient: client(() => ({})), userId: null, ids: [id(1)] })).rejects.toMatchObject({ status: 401 });
  });
});

describe('⑶ 경로 GET view=learning&ids=… · 브라우저 읽기', () => {
  let service;
  beforeEach(() => {
    vi.clearAllMocks();
    service = { rpc: vi.fn(async (name, args) => (name === 'fsrs_vocabulary_snapshot_cards' ? { data: pick(snapshot(), args.p_ids) } : { data: snapshot() })) };
    mocks.authenticate.mockResolvedValue({ user: { id: ACTOR }, supabase: {} });
    mocks.service.mockReturnValue(service);
  });
  const get = query => GET(new Request(`https://fixture.test/api/learning/vocabulary?${query}`));

  it('카드 몇 장만 — 카드 RPC 하나, 전체 snapshot RPC는 부르지 않는다', async () => {
    const response = await get(`view=learning&ids=${id(3)},${id(1)}`);
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await response.json();
    expect(body.rows.map(r => r.id)).toEqual([id(1), id(3)]);
    expect(service.rpc).toHaveBeenCalledExactlyOnceWith('fsrs_vocabulary_snapshot_cards', { p_actor: ACTOR, p_ids: [id(3), id(1)] });
  });
  it.each([
    ['요약과 섞음', `view=learning&fields=summary&ids=${id(1)}`],
    ['다른 칸과 섞음', `view=learning&ids=${id(1)}&id=${id(1)}`],
    ['빈 값', 'view=learning&ids='],
    ['대문자', 'view=learning&ids=AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'],
    ['UUID 아님', 'view=learning&ids=1,2'],
    ['51개', `view=learning&ids=${Array.from({ length: 51 }, (_, n) => id(n + 1)).join(',')}`],
    ['중복', `view=learning&ids=${id(1)},${id(1)}`],
  ])('%s → 400, DB를 부르지 않는다', async (_name, query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: 'fsrs_invalid_request' });
    expect(service.rpc).not.toHaveBeenCalled();
  });
  it('기존 전체 · 요약 읽기는 그대로', async () => {
    expect((await get('view=learning')).status).toBe(200);
    expect(service.rpc).toHaveBeenLastCalledWith('fsrs_vocabulary_snapshot', { p_actor: ACTOR });
  });

  it('브라우저 읽기: 같은 경로에 그 id만 묻고, 받은 것을 같은 투영으로 · 요청하지 않은 행 · 다른 계정은 받지 않는다', async () => {
    const full = snapshot(), ids = [id(3)];
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => pick(full, ids) }));
    const got = await fetchVocabularyLearningCards(ACTOR, ids, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(`/api/learning/vocabulary?view=learning&ids=${id(3)}`, expect.objectContaining({ method: 'GET', cache: 'no-store' }));
    expect(got).toEqual(projectVocabularyLearningRows(pick(full, ids), { actorId: ACTOR }));
    await expect(fetchVocabularyLearningCards(ACTOR, ids, { fetchImpl: async () => ({ ok: true, json: async () => full }) })).rejects.toMatchObject({ code: 'vocabulary_learning_invalid_rows' });
    await expect(fetchVocabularyLearningCards(ACTOR, ids, { fetchImpl: async () => ({ ok: true, json: async () => ({ ...pick(full, ids), actorId: id(99) }) }) }))
      .rejects.toMatchObject({ code: 'vocabulary_learning_owner_mismatch' });
    await expect(fetchVocabularyLearningCards(ACTOR, ids, { fetchImpl, getActorId: () => id(99) })).rejects.toMatchObject({ code: 'vocabulary_learning_owner_mismatch' });
    await expect(fetchVocabularyLearningCards(ACTOR, [], { fetchImpl })).rejects.toMatchObject({ code: 'vocabulary_learning_invalid_ids' });
  });
});
