// /api/analyze(중국어) 라우트를 네트워크·DB 없이 끝까지 돌리는 시험 장치 — AD-R4 PR②.
// 상수 꺼짐 = 현행 스냅숏 계약(zhSenseReviewRoute.test.js)과 켜짐 경로 계약(zhSenseReviewRouteOn.test.js)이
// 같은 입력·같은 가짜 모델 응답을 쓰도록 한곳에 둔다. 시험 파일은 vi.mock 팩토리에서 이 모듈을 동적 import한다.
//
// 기록하는 것: 모델 호출(경로 이름·티어·프롬프트·옵션) · DB 연산(테이블·연산·필터·페이로드) · 응답 JSON.

export const state = { calls: [], ops: [], rows: [] };

const m = (meaning, pos, extra = {}) => ({ meaning, pos, ja: null, ...extra });
const row = (base_form, pos, meanings, source = 'gemini') => ({ base_form, pos, reading: null, source, meanings });

// 요청 문장(jieba 실측: 打·电话·妈妈·工作·计划·去·篮球·吃醋가 각각 한 토큰).
export const ZH_LINES = ['我给妈妈打了一个电话。', '我在工作，他们计划去北京。', '他打篮球。', '他吃醋了。'];

// 사전 행 — 妈妈는 미싱(뜻 조회 대상), 篮球는 ja 미판정이라 재조회 대상, 计划는 user_verified.
export const ZH_ROWS = [
  row('我', '대명사', [m('나', '대명사')]),
  row('给', '전치사·동사', [m('~에게', '전치사'), m('주다', '동사')]),
  row('打', '동사', [m('때리다, 치다', '동사'), m('(전화를) 걸다', '동사'), m('(운동을) 하다', '동사')]),
  row('了', '조사', [m('완료', '조사')]),
  row('一', '수사', [m('하나', '수사')]),
  row('个', '양사', [m('개', '양사')]),
  row('电话', '명사', [m('전화', '명사')]),
  row('在', '전치사·동사·부사', [m('~에서', '전치사'), m('있다', '동사'), m('~하고 있다', '부사')]),
  row('工作', '동사·명사', [m('일하다', '동사'), m('일, 직업', '명사')]),
  row('他们', '대명사', [m('그들', '대명사')]),
  row('计划', '명사·동사', [m('계획', '명사'), m('계획하다', '동사')], 'user_verified'),
  row('去', '동사', [m('가다', '동사')]),
  row('北京', '지명', [m('베이징', '지명')]),
  row('他', '대명사', [m('그', '대명사')]),
  row('篮球', '명사', [{ meaning: '농구', pos: '명사' }, { meaning: '농구공', pos: '명사' }]),
  row('吃醋', '동사', [m('식초를 먹다', '동사'), m('시샘하다', '동사')]),
];

// 가짜 판별 응답 — (단어, 문장) → 항목. 꺼짐에서도 모델이 sense·ctx를 섞어 보내는 상황을 일부러 만든다
// (현행 응답 처리가 모르는 키를 무시하는지까지 스냅숏으로 고정).
const ZH_PICKS = {
  '妈妈@我给妈妈打了一个电话。': { all: ['명사'], pos: '명사' },
  '打@我给妈妈打了一个电话。': { all: ['동사', '명사'], pos: '동사', sense: 2 },
  '电话@我给妈妈打了一个电话。': { all: ['명사'], pos: '명사', sense: 1 },
  '工作@我在工作，他们计划去北京。': { all: ['동사', '명사'], pos: '명사', sense: 1 },
  '计划@我在工作，他们计划去北京。': { all: ['동사', '명사'], pos: '동사', sense: 1 },
  '去@我在工作，他们计划去北京。': { all: ['동사'], pos: '동사' },
  '打@他打篮球。': { all: ['동사'], pos: '동사', sense: '3' },
  '篮球@他打篮球。': { all: ['명사'], pos: '명사', sense: 2 },
  '吃醋@他吃醋了。': { all: ['동사'], pos: '동사', sense: 0, ctx: '질투하다' },
};

function zhPosResponse(prompt) {
  const sentences = new Map();
  const words = [];
  let section = '';
  for (const line of prompt.split('\n')) {
    if (line.startsWith('## ')) { section = line; continue; }
    if (section === '## 문장') {
      const hit = line.match(/^(\d+)\. (.+)$/);
      if (hit) sentences.set(hit[1], hit[2]);
    } else if (section === '## 단어') {
      const hit = line.match(/^\d+\. "(.+?)" \(문장 (\d+)\)/);
      if (hit) words.push(`${hit[1]}@${sentences.get(hit[2])}`);
    }
  }
  return JSON.stringify(words.map((k) => ZH_PICKS[k] ?? { all: ['명사'], pos: '명사' }));
}

function meaningResponse(prompt) {
  const words = [...prompt.matchAll(/^\d+\. "(.+?)"/gm)].map((hit) => hit[1]);
  return JSON.stringify(words.map((w) => ({
    pos: '명사', reading: null, meanings: [{ meaning: `${w}의 뜻`, pos: '명사' }], ja: null,
  })));
}

export async function callLLM(tier, prompt, opts = {}) {
  state.calls.push({ tier, route: opts.route, prompt, opts: { ...opts } });
  if (opts.route === 'disambiguateZhPos') return { text: zhPosResponse(prompt) };
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
        data = state.rows.filter((r) => forms.includes(r.base_form)).map((r) => JSON.parse(JSON.stringify(r)));
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

export function reset(rows = ZH_ROWS) {
  state.calls = [];
  state.ops = [];
  state.rows = rows;
}

export const request = (lines = ZH_LINES, language = 'Chinese') => new Request('https://test/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
  body: JSON.stringify({ lines, language }),
});

/** 라우트 한 번을 돌려 비교 가능한 기록으로 만든다(호출 순서는 경로 이름으로 정렬해 병렬 순서를 지운다). */
export async function runRoute(POST, lines = ZH_LINES, language = 'Chinese') {
  const res = await POST(request(lines, language));
  const body = await res.json();
  await new Promise((r) => setTimeout(r, 0)); // fire-and-forget 쓰기까지 기록
  const calls = [...state.calls]
    .map(({ tier, route, prompt, opts }) => ({ tier, route, prompt, opts }))
    .sort((a, b) => String(a.route).localeCompare(String(b.route)) || a.prompt.localeCompare(b.prompt));
  return { status: res.status, calls, ops: state.ops, body };
}
