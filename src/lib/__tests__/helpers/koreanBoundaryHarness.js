// 뷰어 v2 AD-R3 §7.5 한국어 나누기 시험용 — 실제 한국어 분석 서버 조립(analyzeKoreanLines → renderTokens 어절 검증)을
// 가짜 모델 출력으로 돌린다. 모델 출력은 어절 표면 → {lemma, pos, meaning, morphology} 표에서 만든다(형태 분석 결과는
// #1346 C 범주처럼 축약·불규칙을 그대로 담는다). 네트워크·키 없음.
import { analyzeKoreanLines, koreanSourceUnits } from '../../server/koreanAnalysis.js';

const m = (form, fn) => ({ form, function: fn });
export const KO_WORDS = {
  저는: { lemma: '저', pos: '대명사', meaning: '저(나)', morphology: [m('저', '말하는 이를 낮춘 1인칭 대명사'), m('는', '주제를 나타내는 조사')] },
  도서관에서: { lemma: '도서관', pos: '명사', meaning: '도서관에서', morphology: [m('도서관', '명사. 책을 모아 두고 읽는 곳'), m('에서', '장소를 나타내는 조사')] },
  공부했어요: { lemma: '공부하다', pos: '동사', meaning: '공부했다', morphology: [m('공부', '명사. 배우고 익힘'), m('하-', '동사 하다의 어간'), m('-였-', '과거 시제 어미'), m('-어요', '해요체 종결 어미')] },
  밥을: { lemma: '밥', pos: '명사', meaning: '밥을', morphology: [m('밥', '명사. 끼니로 먹는 음식'), m('을', '목적어를 나타내는 조사')] },
  먹었어요: { lemma: '먹다', pos: '동사', meaning: '먹었다', morphology: [m('먹-', '동사 먹다의 어간'), m('-었-', '과거 시제 어미'), m('-어요', '해요체 종결 어미')] },
  했어요: { lemma: '하다', pos: '동사', meaning: '했다', morphology: [m('하-', '동사 하다의 어간'), m('-였-', '과거 시제 어미'), m('-어요', '해요체 종결 어미')] },
  친구를: { lemma: '친구', pos: '명사', meaning: '친구를', morphology: [m('친구', '명사. 가깝게 사귄 사람'), m('를', '목적어를 나타내는 조사')] },
  도와요: { lemma: '돕다', pos: '동사', meaning: '돕는다', morphology: [m('돕-', 'ㅂ 불규칙 동사 돕다의 어간'), m('-아요', '해요체 종결 어미')] },
  집을: { lemma: '집', pos: '명사', meaning: '집을', morphology: [m('집', '명사. 사람이 사는 건물'), m('을', '목적어를 나타내는 조사')] },
  지으셨어요: { lemma: '짓다', pos: '동사', meaning: '지으셨다', morphology: [m('짓-', 'ㅅ 불규칙 동사 짓다의 어간'), m('-으시-', '주체 높임 어미'), m('-었-', '과거 시제 어미'), m('-어요', '해요체 종결 어미')] },
  하얘요: { lemma: '하얗다', pos: '형용사', meaning: '하얗다', morphology: [m('하얗-', 'ㅎ 불규칙 형용사 하얗다의 어간'), m('-아요', '해요체 종결 어미')] },
  노래를: { lemma: '노래', pos: '명사', meaning: '노래를', morphology: [m('노래', '명사. 가락에 맞춰 부르는 소리'), m('를', '목적어를 나타내는 조사')] },
  불렀어요: { lemma: '부르다', pos: '동사', meaning: '불렀다', morphology: [m('부르-', '르 불규칙 동사 부르다의 어간'), m('-었-', '과거 시제 어미'), m('-어요', '해요체 종결 어미')] },
  더워서: { lemma: '덥다', pos: '형용사', meaning: '더워서', morphology: [m('덥-', 'ㅂ 불규칙 형용사 덥다의 어간'), m('-어서', '이유를 나타내는 연결 어미')] },
  쉬었어요: { lemma: '쉬다', pos: '동사', meaning: '쉬었다', morphology: [m('쉬-', '동사 쉬다의 어간'), m('-었-', '과거 시제 어미'), m('-어요', '해요체 종결 어미')] },
  오늘: { lemma: '오늘', pos: '명사', meaning: '오늘' },
};

/** 한 줄의 모델 출력(어절 틀 그대로). words = 표(기본 KO_WORDS). 표에 없는 어절은 형태 분석 없이 뜻만. */
export function koreanModelLine(line, words = KO_WORDS) {
  return { tokens: koreanSourceUnits([line])[0].map(({ start, end, surface, kind }) => (kind === 'lexical'
    ? { start, end, surface, lemma: words[surface]?.lemma ?? surface, pos: words[surface]?.pos ?? '명사', meaning: words[surface]?.meaning ?? surface,
      ...(words[surface]?.morphology ? { morphology: words[surface].morphology } : {}) }
    : { start, end, surface, lemma: '', pos: '기호', meaning: '' })) };
}

/** fetch 대역: /api/analyze/korean → 실제 analyzeKoreanLines(가짜 모델). bodies에 요청 본문을 쌓는다. words는 호출마다 바꿀 수 있다. */
export function koreanFetch(bodies, wordsRef = { current: KO_WORDS }) {
  return async (url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    bodies.push({ url: String(url), body });
    if (!String(url).endsWith('/api/analyze/korean')) return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
    const llm = async (_tier, _prompt) => ({ text: JSON.stringify({ lines: body.lines.map(line => koreanModelLine(line, wordsRef.current)) }) });
    const data = await analyzeKoreanLines(body, { llm });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
