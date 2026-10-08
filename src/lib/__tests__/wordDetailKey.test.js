import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 뷰어 v2 AE-R2 §5.3 — 이합사 O 조각(道了歉의 歉: base_form '歉', sep_link '道歉')은 조회·저장·만남이
// 이미 VO(sep_link ?? base_form)를 어휘 키로 쓴다. 상세 설명(wordDetail)·문맥 설명(ctxExplain)만
// base_form으로 찾아 「歉」 설명을 만들고 공유 detail_text를 歉 행에 붙였다 — 같은 키 규칙으로 맞춘다.
// 그 밖의 언어(ja 활용형 등)는 키·프롬프트 무변경(회귀 0).

const gemini = vi.hoisted(() => ({ prompts: [] }));
vi.mock('../gemini', () => ({
  callGemini: vi.fn(async (prompt) => { gemini.prompts.push(prompt); return '**뜻**\n1. 사과하다'; }),
}));
vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

const { fetchWordDetailText } = await import('../wordDetail.js');
const { fetchCtxExplain } = await import('../ctxExplain.js');

const qian = { text: '歉', base_form: '歉', sep_link: '道歉', pos: '명사' };
const dao = { text: '道', base_form: '道歉', pos: '동사' };

let store, calls;
beforeEach(() => {
  store = new Map();
  calls = [];
  gemini.prompts.length = 0;
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
  });
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('/api/word-detail')) return { ok: true, json: async () => ({ detail: null }) };
    return { ok: true, json: async () => ({ explanation: '이 문장에서 사과했다는 뜻' }) };
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchWordDetailText — 이합사 O 조각은 VO(sep_link)로 찾는다', () => {
  it('歉(sep_link 道歉) → DB 조회·저장·localStorage 키가 모두 道歉', async () => {
    await fetchWordDetailText(qian, 'Chinese');
    const get = calls.find((c) => c.url.startsWith('/api/word-detail?'));
    expect(new URL(get.url, 'http://x').searchParams.get('base_form')).toBe('道歉');
    const post = calls.find((c) => c.url === '/api/word-detail' && c.init.method === 'POST');
    expect(JSON.parse(post.init.body).base_form).toBe('道歉');
    expect(store.has('pdf_cache:detail:Chinese:道歉')).toBe(true);
    expect(store.has('pdf_cache:detail:Chinese:歉')).toBe(false);
  });

  it('프롬프트 표제도 VO — 「歉」 낱글자 설명을 만들지 않는다', async () => {
    await fetchWordDetailText(qian, 'Chinese');
    expect(gemini.prompts[0].startsWith('"道歉" (명사)')).toBe(true);
  });

  it('V 조각(道, base_form 道歉)도 저장 키와 같은 표제로 묻는다', async () => {
    await fetchWordDetailText(dao, 'Chinese');
    expect(new URL(calls[0].url, 'http://x').searchParams.get('base_form')).toBe('道歉');
    expect(gemini.prompts[0].startsWith('"道歉" (동사)')).toBe(true);
  });

  it('VO 키로 저장된 설명이 있으면 네트워크 없이 그것을 쓴다(O·V 조각 공유)', async () => {
    store.set('pdf_cache:detail:Chinese:道歉', JSON.stringify('**뜻**\n1. 사과하다(캐시)'));
    const detail = await fetchWordDetailText(qian, 'Chinese');
    expect(detail).toContain('사과하다(캐시)');
    expect(calls).toHaveLength(0);
  });

  it('회귀 0 — 일본어 활용형은 키=base_form, 표제=표면 그대로', async () => {
    await fetchWordDetailText({ text: '食べた', base_form: '食べる', pos: '동사' }, 'Japanese');
    expect(new URL(calls[0].url, 'http://x').searchParams.get('base_form')).toBe('食べる');
    expect(store.has('pdf_cache:detail:Japanese:食べる')).toBe(true);
    expect(gemini.prompts[0].startsWith('"食べた" (동사)')).toBe(true);
  });

  it('회귀 0 — 이합사가 아닌 중국어 단어는 키·표제가 표면과 같다', async () => {
    await fetchWordDetailText({ text: '公园', base_form: '公园', pos: '명사' }, 'Chinese');
    expect(new URL(calls[0].url, 'http://x').searchParams.get('base_form')).toBe('公园');
    expect(gemini.prompts[0].startsWith('"公园" (명사)')).toBe(true);
  });
});

describe('fetchCtxExplain — 문맥 설명 요청의 기본형도 VO', () => {
  const sentence = '他向我道了歉。';

  it('歉 → 본문 base 道歉(단어·문장은 표면 그대로)', async () => {
    await fetchCtxExplain({ language: 'Chinese', sentence, token: qian, materialId: '1', tokenKey: 'id_0_4' });
    const body = JSON.parse(calls[0].init.body);
    expect(body.token).toEqual({ sentence, word: '歉', base: '道歉', pos: '명사' });
  });

  it('base 歉으로 만든 옛 캐시는 읽지 않는다 — 새 키로 다시 묻는다', async () => {
    store.set(`ctx_explain:Chinese:歉:${sentence}`, JSON.stringify('옛 설명(기본형 歉)'));
    const text = await fetchCtxExplain({ language: 'Chinese', sentence, token: qian });
    expect(text).toBe('이 문장에서 사과했다는 뜻');
    expect(calls).toHaveLength(1);
    expect(store.get(`ctx_explain:Chinese:歉:${sentence}`)).toBe(JSON.stringify('옛 설명(기본형 歉)')); // 지우지 않는다
  });

  it('회귀 0 — 이합사가 아닌 토큰은 캐시 키·base가 그대로', async () => {
    const tok = { text: '公园', base_form: '公园', pos: '명사' };
    store.set('ctx_explain:Chinese:公园:我们明天去公园。', JSON.stringify('캐시된 설명'));
    expect(await fetchCtxExplain({ language: 'Chinese', sentence: '我们明天去公园。', token: tok })).toBe('캐시된 설명');
    expect(calls).toHaveLength(0);
    store.clear();
    await fetchCtxExplain({ language: 'Chinese', sentence: '我们明天去公园。', token: tok });
    expect(JSON.parse(calls[0].init.body).token.base).toBe('公园');
  });
});
