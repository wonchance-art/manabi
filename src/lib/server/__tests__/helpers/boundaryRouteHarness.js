// /api/analyze(중·일·영)를 네트워크·DB 없이 끝까지 돌리는 시험 장치 — 뷰어 v2 AD-R3 PR②.
// 「기록 0 = 바이트 단위 동일」 스냅숏(analyzeRouteNoBoundary.test.js · boundaryReanalysisSnapshot.test.js)과
// 경계 적용 계약(analyzeBoundaries.test.js · reanalysisBoundaries.test.js)이 같은 가짜 모델·가짜 사전을 쓰도록 한곳에 둔다.
// 시험 파일은 vi.mock 팩토리에서 이 모듈을 동적 import한다(토크나이저 jieba·kuromoji·lemmatizer는 실물).
//
// 기록하는 것: 모델 호출(경로 이름·티어·프롬프트·옵션) · DB 연산(테이블·연산·필터·페이로드) · 응답 JSON.

export const state = { calls: [], ops: [], rows: [] };

const row = (language, base_form, pos, meanings, extra = {}) => ({
  language, base_form, pos, reading: null, source: 'gemini', meanings, ...extra,
});
const m = (meaning, pos) => ({ meaning, pos });

// 가짜 공유 사전 — 일부만 있다(나머지는 미싱 → 가짜 뜻 조회 → upsert).
export const ROWS = [
  row('Chinese', '运动员', '명사', [m('운동선수', '명사')]),
  row('Chinese', '的', '조사', [m('~의', '조사')]),
  row('Chinese', '身体', '명사', [m('신체, 몸', '명사')]),
  row('Chinese', '素质', '명사', [m('자질, 소양', '명사')]),
  row('Chinese', '非常', '부사', [m('매우', '부사')]),
  row('Chinese', '好', '형용사', [m('좋다', '형용사')]),
  row('Chinese', '他', '대명사', [m('그', '대명사')]),
  row('Chinese', '是', '동사', [m('~이다', '동사')]),
  row('Chinese', '朋友', '명사', [m('친구', '명사')]),
  row('Japanese', '明日', '명사', [m('내일')], { reading: 'あした' }),
  row('Japanese', '映画館', '명사', [m('영화관')], { reading: 'えいがかん' }),
  row('Japanese', '映画', '명사', [m('영화')], { reading: 'えいが' }),
  row('Japanese', '申し込む', '동사', [m('신청하다')], { reading: 'もうしこむ' }),
  row('English', 'pick', '동사', [{ meaning: '고르다', pos: '동사', en_pos_v: 1 }]),
  row('English', 'up', '부사', [{ meaning: '위로', pos: '부사', en_pos_v: 1 }]),
  row('English', 'the', '관사', [{ meaning: '그', pos: '관사', en_pos_v: 1 }]),
];

export const LINES = {
  Chinese: ['运动员的身体素质非常好。', '他是我的社恐朋友。'],
  Japanese: ['明日は申し込んだ映画館に行きます。', '天気予報を見た。'],
  English: ['I picked up the book.', 'She looked after them.'],
};

function section(prompt, title) {
  const out = [];
  let on = false;
  for (const line of prompt.split('\n')) {
    if (line.startsWith('## ')) { on = line === title; continue; }
    if (on && line.trim()) out.push(line);
  }
  return out;
}

// 중국어 판별: 단어성 판정 항목은 글자마다 가르는 split을, 나머지는 명사로 답한다.
function zhPosResponse(prompt) {
  return JSON.stringify(section(prompt, '## 단어').map((line) => {
    const hit = line.match(/^\d+\. "(.+?)" \(문장 \d+\)( \[단어성 판정\])?/);
    if (hit?.[2]) return { all: [], pos: null, split: [...hit[1]].map((t) => ({ t, pos: '명사' })) };
    return { all: ['명사', '동사'], pos: '명사' };
  }));
}

// 영어 판별: 제시된 첫 lemma 후보를 고른다.
function enPosResponse(prompt) {
  return JSON.stringify(section(prompt, '## occurrence').map((line) => {
    const options = line.match(/lemma: (.+)\)$/)?.[1] || '';
    const [poses, lemma] = options.split(', ')[0].split('=');
    const pos = poses.split('/')[0];
    return { all: [pos], pos, base_form: lemma };
  }));
}

function meaningResponse(prompt) {
  const words = [...prompt.matchAll(/^\d+\. "(.+?)"/gm)].map((hit) => hit[1]);
  return JSON.stringify(words.map((w) => ({
    pos: '명사', reading: null, ipa: null, meanings: [{ meaning: `${w}의 뜻`, pos: '명사' }], ja: null,
  })));
}

export async function callLLM(tier, prompt, opts = {}) {
  state.calls.push({ tier, route: opts.route, prompt, opts: { ...opts } });
  if (opts.route === 'disambiguateZhPos') return { text: zhPosResponse(prompt) };
  if (opts.route === 'disambiguateEnPos') return { text: enPosResponse(prompt) };
  if (opts.route === 'fetchMeanings') return { text: meaningResponse(prompt) };
  return { text: '[]' };
}

function query(table) {
  const q = { table, op: 'select', filters: [] };
  const chain = {
    select(cols) { q.cols = cols; return chain; },
    eq(k, v) { q.filters.push(['eq', k, v]); return chain; },
    neq(k, v) { q.filters.push(['neq', k, v]); return chain; },
    in(k, v) { q.filters.push(['in', k, [...v]]); return chain; },
    update(patch) { q.op = 'update'; q.payload = patch; return chain; },
    upsert(rows, opts) { q.op = 'upsert'; q.payload = rows; q.opts = opts; return chain; },
    then(resolve, reject) {
      state.ops.push(JSON.parse(JSON.stringify(q)));
      let data = null;
      if (q.op === 'select') {
        const forms = q.filters.find(([op, k]) => op === 'in' && k === 'base_form')?.[2] ?? [];
        const language = q.filters.find(([op, k]) => op === 'eq' && k === 'language')?.[2];
        data = state.rows.filter((r) => r.language === language && forms.includes(r.base_form))
          .map(({ language: _l, ...r }) => JSON.parse(JSON.stringify(r)));
      }
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return chain;
}

export const supabaseModule = {
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'reader' } }, error: null }) },
    from: (table) => query(table),
    rpc: (name, args) => ({
      then(resolve, reject) {
        state.ops.push({ rpc: name, args: JSON.parse(JSON.stringify(args)) });
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    }),
  }),
};

export const rateLimitModule = { rateLimit: () => ({ ok: true }), getClientKey: (_r, id) => `u:${id}` };

export function reset(rows = ROWS) {
  state.calls = [];
  state.ops = [];
  state.rows = rows;
}

export const request = (body) => new Request('https://test/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

/** 라우트 한 번을 돌려 비교 가능한 기록으로 만든다(호출 순서는 경로 이름·프롬프트로 정렬해 병렬 순서를 지운다). */
export async function runRoute(POST, body) {
  const res = await POST(request(body));
  const json = await res.json();
  await new Promise((r) => setTimeout(r, 0)); // fire-and-forget 쓰기까지 기록
  const calls = [...state.calls]
    .map(({ tier, route, prompt, opts }) => ({ tier, route, prompt, opts }))
    .sort((a, b) => String(a.route).localeCompare(String(b.route)) || a.prompt.localeCompare(b.prompt));
  const ops = [...state.ops].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { status: res.status, calls, ops, body: json };
}

/** 브라우저 fetch('/api/analyze')를 라우트 POST로 잇는다(analyzeHybrid 시험용). 요청 본문 원문을 남긴다. */
export function routeFetch(POST, bodies) {
  return async (url, init = {}) => {
    bodies.push({ url: String(url), body: init.body });
    const res = await POST(request(init.body));
    const json = await res.json();
    return { ok: res.ok, status: res.status, json: async () => json };
  };
}
