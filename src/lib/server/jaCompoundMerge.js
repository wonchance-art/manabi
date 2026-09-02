// 서버 전용 — 일본어 복합명사 재병합 (분석기 라운드 10, 2026-09-02 오너 「추천대로 ㄱㄱ」·「바로 진행」).
//
// ── 왜
// kuromoji(IPADIC)는 복합명사를 형태소로 잘게 낸다: 映画館 → 映画|館, 誕生日 → 誕生|日, お皿 → お|皿, 天気予報 → 天気|予報.
// 학습자에겐 映画館이 한 단어이고 교재 표제어도 그렇다. 어휘 정답지 대조(표제어 7,299의 자기 예문 토큰화) 실측:
// 표제어 미생존 528(7.2%) 중 복합명사 부류 ≈95종 — 名詞+接尾(映画館·郵便局·血液型 40)·サ変+接尾(誕生日·駐車場·会議室 11)·
// 接頭詞+名詞(お皿·お兄さん·お風呂 14)·名詞+名詞(晩御飯·天気予報·高等学校 ≈30). 읽기도 틀린다: 誕生|日의 日을 ヒ로,
// リア|充을 リアタカシ로 — 결합 읽기 ≠ 정본 106/289.
//
// ── 무엇으로 — 정본 읽기 색인(jaYomiIndex.json)의 역색인
// 라운드 4가 가나 분절에 쓴 그 색인(표제어마다 있는 yomi)을 거꾸로(표면 → yomi) 걸어, 인접 명사류 창(2~3 토큰)의
// 표면 결합이 **표제어이고 yomi가 하나**면 한 토큰으로 합치고 읽기는 색인 값을 쓴다. 실측: 예문 전수의 병합 자리 289,
// 역색인 유일 287·다독 0·없음 2(〜時間目·〜丁目 — 〜표기 표제어라 색인 밖).
//
// ── 무엇을 안 하나 (정밀도)
// · 수사(名詞/数)가 든 창은 안 합친다 — 三時|十|分의 十分은 じゅっぷん(10분)인데 표제어 十分은 じゅうぶん(충분히)이다.
//   수사+조수사(二人→ふたり·五日→いつか)는 라운드 3(jaReadingFix)의 몫.
// · 조사가 낀 창(男|の|人)은 구(句)라 안 합친다 — 창은 名詞·接頭詞로만 이루어진다.
// · 표제어가 아니면 무개입(今日|中은 今日中이 표제어가 아니라 그대로), 역색인이 다독이면 무개입(지금은 0건 — 색인이
//   자라며 생길 수 있는 자리라 가드를 둔다).
// 적용 순서: kuromoji → 읽기 수리(라운드 3) → 가나 분절(라운드 4) → **이 층**. 실패 시 현행 수렴(합칠 게 없으면 그대로).

import JA_YOMI_INDEX from '../data/jaYomiIndex.json';

/** 표면 → yomi (유일할 때만). 색인은 yomi → [[표면, 급수, 품사]]라 거꾸로 건다. */
const SURFACE_YOMI = (() => {
  const acc = new Map();
  for (const [yomi, arr] of Object.entries(JA_YOMI_INDEX)) {
    for (const [surface] of arr) {
      if (!acc.has(surface)) acc.set(surface, new Set());
      acc.get(surface).add(yomi);
    }
  }
  const out = new Map();
  for (const [surface, ys] of acc) if (ys.size === 1) out.set(surface, [...ys][0]);
  return out;
})();

const isNounish = (t) => t.pos === '名詞' || t.pos === '接頭詞';
const isNumeral = (t) => t.pos_detail_1 === '数';
const MAX_WINDOW = 3;

/** 창이 재병합 대상인가 — 명사류만, 수사 없이, 결합이 유일 yomi 표제어. */
export function compoundYomi(window) {
  if (window.length < 2 || window.length > MAX_WINDOW) return null;
  if (!window.every((t) => isNounish(t) && !isNumeral(t))) return null;
  const surface = window.map((t) => t.surface_form).join('');
  return SURFACE_YOMI.get(surface) ?? null;
}

/**
 * kuromoji 토큰 배열 → 복합명사를 합친 배열(원 토큰 객체는 손대지 않는다). 긴 창 우선·왼쪽부터.
 * 합친 토큰은 名詞/一般, basic_form = 표면, reading = 색인 yomi(히라가나 그대로 — tokenizeJa가 후리가나로 쓴다).
 */
export function mergeJaCompounds(tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    let merged = null;
    for (let w = MAX_WINDOW; w >= 2 && i + w <= tokens.length; w--) {
      const win = tokens.slice(i, i + w);
      const yomi = compoundYomi(win);
      if (yomi == null) continue;
      const surface = win.map((t) => t.surface_form).join('');
      merged = {
        ...win[win.length - 1],
        word_id: win[0].word_id,
        word_position: win[0].word_position,
        surface_form: surface,
        basic_form: surface,
        reading: yomi,
        pronunciation: yomi,
        pos: '名詞',
        pos_detail_1: '一般',
        pos_detail_2: '*',
        pos_detail_3: '*',
        conjugated_type: '*',
        conjugated_form: '*',
        compound: true,
      };
      i += w;
      break;
    }
    if (merged) out.push(merged);
    else { out.push(tokens[i]); i++; }
  }
  return out;
}
