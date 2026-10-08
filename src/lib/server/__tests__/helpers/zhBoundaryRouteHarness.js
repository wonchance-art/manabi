// /api/analyze(중국어) 경계 검수(AD-R4 PR④ — 「묶을까요」·등재 자동 묶기)를 네트워크·DB 없이 끝까지 돌리는 시험 장치.
// DB·속도 제한 흉내는 PR② 장치(zhAnalyzeRouteHarness.js)를 그대로 쓰고, 모델 응답만 이 파일의 표(D 범주 문장)로 바꾼다.
// 상수 꺼짐 = 기준 스냅숏(zhBoundaryReviewRoute.test.js)과 켜짐 계약(zhBoundaryReviewRouteOn.test.js)이 같은 입력·같은 가짜 응답을 쓴다.
import { state, supabaseModule, rateLimitModule } from './zhAnalyzeRouteHarness.js';

export { state, supabaseModule, rateLimitModule };

const m = (meaning, pos) => ({ meaning, pos, ja: null });
const row = (base_form, pos, meanings, source = 'gemini') => ({ base_form, pos, reading: null, source, meanings });

// 측정 세트 D 범주(docs/verification/zh-sense-holdout-20261008.json)의 문장 + 미등재 묶음 후보(身体素质 — 설계서 §6.4 목업).
// jieba 실측: 一|个|人 · 不|客气 · 身体|素质 · 得|了 · 这个|人才(현행 오병합 — 묻지 않는다).
export const ZB_LINES = ['他一个人去旅行。', '不客气。', '运动员的身体素质非常好。', '得了，别再说了。', '这个人才来了三天。'];

// 사전 행 — 이은 꼴: 个人(등재·행 있음) · 得了(등재·gemini 행) · 身体素质(미등재 — gemini 행만) · 不客气(등재·행 없음 → 같은 병렬 뜻 조회).
export const ZB_ROWS = [
  row('他', '대명사', [m('그', '대명사')]),
  row('一', '수사', [m('하나', '수사')]),
  row('个', '양사', [m('개', '양사')]),
  row('人', '명사', [m('사람', '명사')]),
  row('去', '동사', [m('가다', '동사')]),
  row('旅行', '동사·명사', [m('여행하다', '동사'), m('여행', '명사')]),
  row('个人', '명사', [m('개인', '명사')]),
  row('不', '부사', [m('아니다', '부사')]),
  row('客气', '형용사', [m('예의 바르다', '형용사')]),
  row('运动员', '명사', [m('운동선수', '명사')]),
  row('的', '조사', [m('~의', '조사')]),
  row('身体', '명사', [m('몸', '명사')]),
  row('素质', '명사', [m('자질', '명사')]),
  row('身体素质', '명사', [m('신체 조건', '명사')]),
  row('非常', '부사', [m('매우', '부사')]),
  row('好', '형용사', [m('좋다', '형용사')]),
  row('得', '조사·동사', [m('~하게', '조사'), m('얻다', '동사')]),
  row('了', '조사', [m('완료', '조사')]),
  row('得了', '동사', [m('됐어, 그만해', '동사')]),
  row('别', '부사', [m('~하지 마라', '부사')]),
  row('再说', '접속사', [m('게다가', '접속사')]),
  row('说', '동사', [m('말하다', '동사')]),
  row('这个', '대명사', [m('이것', '대명사')]),
  row('人才', '명사', [m('인재', '명사')]),
  row('来', '동사', [m('오다', '동사')]),
  row('三天', '수사', [m('사흘', '수사')]),
];

// 가짜 판별 응답 — (단어, 문장) → 항목. join은 [묶음 판정]이 실린 항목에만 의미가 있다. 꺼짐에서도 모델이 join 키를
// 섞어 보내는 상황(身体)을 일부러 넣어 현행 응답 처리가 모르는 키를 무시하는지까지 스냅숏으로 고정한다.
export const ZB_PICKS = {
  '个@他一个人去旅行。': { all: ['양사'], pos: '양사', join: false },
  '旅行@他一个人去旅行。': { all: ['동사', '명사'], pos: '동사' },
  '不@不客气。': { all: ['부사'], pos: '부사', join: true },
  '客气@不客气。': { all: ['형용사'], pos: '형용사' },
  '身体@运动员的身体素质非常好。': { all: ['명사'], pos: '명사', join: true },
  '得@得了，别再说了。': { all: ['조사', '동사'], pos: '동사', join: true },
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
  return JSON.stringify(words.map((k) => state.picks?.[k] ?? { all: ['명사'], pos: '명사' }));
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

export function reset(rows = ZB_ROWS, picks = ZB_PICKS) {
  state.calls = [];
  state.ops = [];
  state.rows = rows;
  state.picks = picks;
}

const request = (body) => new Request('https://test/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
  body: JSON.stringify(body),
});

/** 라우트 한 번 — extra는 요청 본문에 더할 필드(boundaries 등). 호출 순서는 경로 이름으로 정렬해 병렬 순서를 지운다. */
export async function runRoute(POST, { lines = ZB_LINES, language = 'Chinese', extra = {} } = {}) {
  const res = await POST(request({ lines, language, ...extra }));
  const body = await res.json();
  await new Promise((r) => setTimeout(r, 0)); // fire-and-forget 쓰기까지 기록
  const calls = [...state.calls]
    .map(({ tier, route, prompt, opts }) => ({ tier, route, prompt, opts }))
    .sort((a, b) => String(a.route).localeCompare(String(b.route)) || a.prompt.localeCompare(b.prompt));
  return { status: res.status, calls, ops: state.ops, body };
}

/** 클라이언트 분석(analyzeText → fetch('/api/analyze'))을 라우트로 곧장 잇는 fetch 대역 — 재분석 계약용. */
export function routeFetch(POST, bodies = []) {
  return async (url, init = {}) => {
    bodies.push({ url: String(url), body: init.body });
    const res = await POST(new Request('https://test/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' }, body: init.body,
    }));
    const json = await res.json();
    return { ok: res.ok, status: res.status, json: async () => json };
  };
}

// 사용자 경계 기록(AD-R3) — 不客气·身体素质를 이 자료에서 「나뉜 채」로 정한 기록(분석기 칼선과 같다 = redundant → 표식)과,
// 원문이 바뀌어 적용하지 못한(pending) 个人 자리 기록. 기록이 있는 구간에는 자동 묶기·후보가 0이어야 한다.
export const ZB_USER_BOUNDARIES = [
  { id: 'b_1_0_3', line: 1, start: 0, end: 3, text: '不客气', cuts: [1] },
  { id: 'b_2_4_8', line: 2, start: 4, end: 8, text: '身体素质', cuts: [6] },
  { id: 'b_0_2_4', line: 0, start: 2, end: 4, text: '个大', cuts: [3] },
];
