import { beforeEach, describe, expect, it, vi } from 'vitest';

// STUDY-PARA-OBSERVE-001 — /api/study-paragraph가 문단을 못 만든 서버 경로마다 사유 코드 한 줄을 기록한다(응답 모양 · 상태는 그대로).
const note = vi.hoisted(() => vi.fn());
const llm = vi.hoisted(() => ({ hasKey: true, call: vi.fn(), validate: vi.fn(() => null), assemble: vi.fn() }));

vi.mock('@/lib/server/studyParagraphObserve', () => ({ noteParagraphError: note }));
vi.mock('@/lib/server/llmKeys', () => ({ hasPrimaryLLMKey: () => llm.hasKey }));
vi.mock('@/lib/server/llm', () => ({ callLLM: llm.call }));
vi.mock('@/lib/server/dailyQuota', () => ({ dailyQuotaGate: async () => null, quotaSubject: () => 'u' }));
vi.mock('@/lib/studyParagraph', () => ({ buildParagraphPrompt: () => 'prompt', validateParagraph: (...a) => llm.validate(...a), verifyParagraph: (p) => p, PARAGRAPH_SCHEMA: {} }));
vi.mock('@/lib/studyMaterials', () => ({ assembleStudyMaterials: (...a) => llm.assemble(...a), deriveArc: () => null }));
vi.mock('@supabase/supabase-js', () => {
  const chain = () => { const c = new Proxy({}, { get: (t, k) => (k === 'then' ? (ok) => Promise.resolve({ data: [] }).then(ok) : () => c) }); return c; };
  return { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) }, from: () => chain() }) };
});

const { POST } = await import('./route.js');
const request = (body) => new Request('https://manabi.test/api/study-paragraph', {
  method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const withCookies = (req) => Object.assign(req, { cookies: { get: () => undefined } });
const LIVE = { language: 'Japanese', level: 'N4', newWords: [{ word: '食べる', meaning: '먹다' }] };

beforeEach(() => {
  note.mockReset(); llm.hasKey = true; llm.call.mockReset(); llm.call.mockResolvedValue({ text: '{}' });
  llm.validate.mockReset(); llm.validate.mockReturnValue(null); llm.assemble.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/study-paragraph 실패 경로 기록', () => {
  it('AI 키 없음 → 500 · no_llm_key', async () => {
    llm.hasKey = false;
    const res = await POST(withCookies(request(LIVE)));
    expect(res.status).toBe(500);
    expect(note.mock.calls).toEqual([['no_llm_key']]);
  });
  it('재시도 뒤에도 쓸 수 없는 출력 → 502 · unusable_output:live (사유에 계정 · 재료 없음)', async () => {
    const res = await POST(withCookies(request(LIVE)));
    expect(res.status).toBe(502);
    expect(llm.call).toHaveBeenCalledTimes(2);
    expect(note.mock.calls).toEqual([['unusable_output:live']]);
    expect(JSON.stringify(note.mock.calls)).not.toMatch(/user-1|食べる/);
  });
  it('프리페치의 쓸 수 없는 출력 → 200 ok:false · unusable_output:prefetch', async () => {
    llm.assemble.mockResolvedValue({ canGenerate: true, paragraphMaterials: LIVE });
    const res = await POST(withCookies(request({ prefetch: true, language: 'Japanese' })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false });
    expect(note.mock.calls).toEqual([['unusable_output:prefetch']]);
  });
  it('프리페치 재료 조립 예외 → 200 ok:false · assemble_error:prefetch', async () => {
    llm.assemble.mockRejectedValue(new Error('db down'));
    const res = await POST(withCookies(request({ prefetch: true, language: 'Japanese' })));
    expect(await res.json()).toEqual({ ok: false });
    expect(note.mock.calls).toEqual([['assemble_error:prefetch']]);
  });
  it('생성 중 예외 → 500 · exception:live', async () => {
    llm.validate.mockImplementation(() => { throw new Error('boom 食べる'); });
    const res = await POST(withCookies(request(LIVE)));
    expect(res.status).toBe(500);
    expect(note.mock.calls).toEqual([['exception:live']]);
  });
  it('성공 · 프리페치 재료 없음 · 로그인 없음은 기록하지 않는다', async () => {
    llm.validate.mockReturnValue({ sentences: [], translation: 'ok' });
    expect((await POST(withCookies(request(LIVE)))).status).toBe(200);
    llm.assemble.mockResolvedValue({ canGenerate: false });
    expect(await (await POST(withCookies(request({ prefetch: true, language: 'Japanese' })))).json()).toEqual({ ok: false });
    const anonymous = withCookies(new Request('https://manabi.test/api/study-paragraph', { method: 'POST', body: '{}' }));
    expect((await POST(anonymous)).status).toBe(401);
    expect(note).not.toHaveBeenCalled();
  });
});
