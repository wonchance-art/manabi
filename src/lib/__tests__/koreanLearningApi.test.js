import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), resolve: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: mocks.auth }));
vi.mock('@/lib/server/learningContext', async () => ({
  ...(await vi.importActual('@/lib/server/learningContext')), resolveSave: mocks.resolve,
}));
import { GET as capabilities } from '@/app/api/learning/capabilities/route';
import { POST as save } from '@/app/api/learning/vocabulary/route';
import { POST as exclude } from '@/app/api/learning/exclusions/route';

const owner = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';
const contract = { version: 1, languages: { Korean: { save: true, review: true, known: true, exclude: true } } };
const card = { id, user_id: owner, language: 'Korean', word_text: '가다', meaning: '去了', interval: 13, ease_factor: 4, repetitions: 7 };
let client, ready, row, saveError, material;
const request = body => new Request('https://fixture.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const payload = (extra = {}) => ({ word: { user_id: owner, language: 'Korean', word_text: '가다', meaning: '去了' }, source: { kind: 'reading', materialId: '1' }, ...extra });
beforeEach(() => {
  ready = contract; row = { ...card }; saveError = null;
  material = { id: 1, owner_id: owner, direction: 'read', raw_text: '갔어요.\r\n', processed_json: { metadata: { language: 'Korean' }, sequence: ['a'], dictionary: { a: { text: '갔어요', base_form: '가다', sourceSpan: { start: 0, end: 3, unit: 'utf16' } } } } };
  client = {
    rpc: vi.fn(async name => name === 'learning_language_capabilities' ? { data: ready, error: null }
      : name === 'set_vocabulary_exclusion' ? { data: { excluded: true, entry: { id } }, error: null }
        : { data: { vocabularyId: id, created: true, contextAdded: true }, error: saveError }),
    from: vi.fn(table => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'reading_materials' ? material : row, error: null }) };
      return q;
    }),
  };
  mocks.auth.mockResolvedValue({ user: { id: owner }, supabase: client });
  mocks.resolve.mockImplementation(async (_db, _owner, body) => ({ word: { word_text: '가다', meaning: body.word.meaning, language: 'Korean' }, source: body.source }));
});
describe('인증된 한국어 학습 저장 API', () => {
  it('익명 capability 조회와 저장은 원격 호출 전에 거부한다', async () => {
    mocks.auth.mockResolvedValue({ error: 'login', status: 401 });
    expect((await capabilities()).status).toBe(401);
    expect((await save(request(payload()))).status).toBe(401);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('capability는 private/no-store이며 불완전·오류 계약을 열지 않는다', async () => {
    const response = await capabilities();
    expect(await response.json()).toEqual(contract);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    ready = { version: 1, languages: { Korean: { save: true } } };
    expect(await (await capabilities()).json()).toEqual({ version: 1, languages: {} });
    client.rpc.mockRejectedValueOnce(new Error('missing RPC'));
    expect(await (await capabilities()).json()).toEqual({ version: 1, languages: {} });
  });
  it('배포 전이나 회귀한 계약에는 단어/문맥 쓰기를 하지 않는다', async () => {
    ready = null;
    const response = await save(request(payload()));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('learning_storage_unavailable');
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual(['learning_language_capabilities']);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it('계정 변경은 capability와 쓰기 전에 거부한다', async () => {
    for (const body of [payload({ accountId: 'other' }), { ...payload(), word: { ...payload().word, user_id: 'other' } }, { ...payload(), word: { language: 'Korean' } }]) {
      expect((await save(request(body))).status).toBe(409);
    }
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([0, 5, 1.5, '3', null])('잘못된 초기 평가 %j는 저장하지 않는다', async grade => {
    expect((await save(request(payload({ initialGrade: grade })))).status).toBe(400);
    expect(client.rpc.mock.calls.some(([name]) => name === 'save_vocabulary_context')).toBe(false);
  });
  it('초기 평가를 서버에서 계산하고 소유한 실제 저장 카드를 반환한다', async () => {
    const body = payload({ initialGrade: 3 }); body.word.interval = 99999; body.word.last_reviewed_at = 'forged';
    const response = await save(request(body));
    expect(response.status).toBe(200);
    expect((await response.json()).vocabulary).toEqual(card);
    const saved = client.rpc.mock.calls.find(([name]) => name === 'save_vocabulary_context')[1];
    expect(saved.p_word.interval).toBeGreaterThan(0);
    expect(saved.p_word.interval).toBeLessThan(99999);
    expect(saved.p_word).not.toHaveProperty('last_reviewed_at');
    expect(saved.p_word.meaning).toBe('去了');
    expect(client.rpc.mock.calls.some(([name]) => /review/.test(name))).toBe(false);
  });
  it('다른 뜻은 기존 뜻과 함께 확인 응답으로 유지한다', async () => {
    saveError = { message: 'vocabulary_meaning_conflict', details: id };
    const response = await save(request(payload()));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'meaning_conflict', existing: { id, meaning: card.meaning }, incomingMeaning: '去了' });
  });
  it('타인 카드 snapshot을 저장 성공으로 반환하지 않는다', async () => {
    row.user_id = 'other';
    expect((await save(request(payload()))).status).toBe(503);
  });
  it('미저장 한국어 제외는 실제 원문 토큰에서 기본형을 얻는다', async () => {
    const response = await exclude(request({ accountId: owner, excluded: true, materialId: 1, tokenId: 'a', language: 'English', word: 'forged' }));
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith('set_vocabulary_exclusion', expect.objectContaining({ p_language: 'Korean', p_word: '가다' }));
  });
  it('한국어 제외도 미적용 계약·쓰기 노트·틀린 원문 위치를 거부한다', async () => {
    const body = { accountId: owner, excluded: true, materialId: 1, tokenId: 'a' };
    ready = null; expect((await exclude(request(body))).status).toBe(503);
    ready = contract; material.direction = 'write'; expect((await exclude(request(body))).status).toBe(400);
    material.direction = 'read'; material.processed_json.dictionary.a.sourceSpan.end = 2;
    expect((await exclude(request(body))).status).toBe(400);
    expect(client.rpc.mock.calls.some(([name]) => name === 'set_vocabulary_exclusion')).toBe(false);
  });
  it('저장된 한국어 카드·제외 ID에도 미적용 계약을 열지 않는다', async () => {
    ready = null;
    for (const extra of [{ vocabularyId: id, excluded: true }, { exclusionId: id, excluded: false }]) {
      expect((await exclude(request({ accountId: owner, ...extra }))).status).toBe(503);
    }
    expect(client.rpc.mock.calls.some(([name]) => name === 'set_vocabulary_exclusion')).toBe(false);
  });
});
