/**
 * 챕터 → 패턴 체크 퀴즈 빌더 (의미 매칭 → 적용 → 생산)
 * ReferenceChapterPage(챕터 끝 관문)와 문법 SRS 복습 세션이 공유한다.
 * 순수 함수 — 셔플은 렌더 시점(클라이언트)에 하므로 여기서는 결정적이다.
 */
import { refMain, refPron } from '../views/refShared';

const isCJK = s => /[぀-ヿ一-鿿]/.test(String(s || ''));

// 문법·수사 메타용어(시제·품사·수사법 라벨) — 정답·보기 어디에도 쓰지 않는다. 학습 대상 '형태'가 아니라 '설명 라벨'이라서.
const META_TERMS = new Set([
  // 프랑스어 문법 라벨
  'imparfait', 'conditionnel', 'subjonctif', 'indicatif', 'infinitif', 'participe', 'présent', 'passé', 'composé', 'simple', 'futur', 'plus-que-parfait', 'masculin', 'féminin', 'singulier', 'pluriel', 'thèse', 'antithèse', 'synthèse', 'problématique', 'bags',
  // 영어 수사·담화 라벨
  'tricolon', 'alliteration', 'assonance', 'consonance', 'anaphora', 'antithesis', 'understatement', 'overstatement', 'hyperbole', 'litotes', 'irony', 'sarcasm', 'deadpan', 'euphemism', 'simile', 'metonymy', 'oxymoron', 'onomatopoeia', 'parallelism', 'chiasmus', 'end-focus', 'end-weight', 'nominalization',
]);

// 보기·정답으로 부적합한 조각 — 메타용어 / 선두 아포스트로피('agit) / 숫자·범위(70·20~69) / 2자+ 연속 대문자 표기(SVO·KJV·ARGUMENT IS WAR)
const isJunk = t => META_TERMS.has(String(t).toLowerCase()) || /^['’]/.test(t) || /[\d~]/.test(t) || /[A-Z]{2,}/.test(t);

// 빈칸 후보 추출 — 슬롯 라벨(N/V/S/O·A/B/C…)은 '대문자'만 제거(불어 소문자 n/v/a/s/o가 단어를 깨뜨리지 않도록 /i 제거)
const clozeSegs = pat => String(pat || '')
  .split(/[〜～()/・+→…,、。]|\s+|\b(?:N|V|A|B|C|S|O|Adj|inf|p\.p\.)\b/)
  .map(t => t.trim())
  .filter(t => t && !/[가-힣]/.test(t) && !isJunk(t) && (isCJK(t) || t.length >= 2));

// 보기 유효성 — 정답과 같은 문자종의 진짜 형태만 (한글·화살표·구두점 조각 제거)
const validDistractor = (cand, answer) => {
  const c = String(cand || '').trim();
  if (!c) return false;
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(c)) return false;          // 한국어 슬롯·문법용어·한글 자모 제거
  if (/[→…:;()/,、。\[\].?!．？！]/.test(c)) return false;  // 화살표·구두점·발음기호·약어 조각 제거
  if (/^[-–]|[-–]$/.test(c)) return false;                // 접사 표기(-ing·-é) 제거
  if (/[a-z][A-Z]/.test(c)) return false;                 // 카멜표기 니모닉(CaReFuL) 제거
  if (isJunk(c)) return false;                            // 문법 메타용어·숫자·깨진 조각 제거
  if (isCJK(c) !== isCJK(answer)) return false;           // 정답과 같은 문자종만
  if (c.toLowerCase() === String(answer).toLowerCase()) return false;
  return true;
};

// seg 위치 찾기 — 라틴은 단어 경계로(부분문자열 오매칭 방지: these 속 the), CJK는 부분문자열
const findSeg = (low, g) => {
  if (isCJK(g)) return low.indexOf(g.toLowerCase());
  const esc = g.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = low.match(new RegExp('(^|[^a-z])' + esc + '([^a-z]|$)'));
  return m ? m.index + m[1].length : -1;
};

// ② 적용 — 자연문이 아닌 예문 제외: 변형표시(→)·대안형( / )·대화 대시(—)·성수 표기((f.)/(m.)/(pl.))는 어순 배열에 부적합.
const isOrderable = s => !/→|\s\/\s|—| - |\([fmp][^)]*\.\)/.test(s);

// 중국어는 띄어쓰기가 없어 병음 단어 기준으로 어절 분리 — 병음 음절수와 한자수가 맞을 때만(儿化 등 불일치는 안전 스킵)
const VOWEL_RUN = /[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/gi;
const isQPunct = c => /[。，、？！；：「」『』（）()…—·,.?!]/.test(c);
const segByPinyin = (zh, pinyin) => {
  if (!pinyin) return null;
  const chars = [...String(zh)].filter(c => !/\s/.test(c));
  const counts = String(pinyin).trim().split(/\s+/)
    .map(w => (w.replace(/['’.,。，、？！?!;:：；]/g, '').match(VOWEL_RUN) || []).length)
    .filter(n => n > 0);
  if (counts.reduce((a, b) => a + b, 0) !== chars.filter(c => !isQPunct(c)).length) return null;
  const tokens = []; let ci = 0;
  for (const s of counts) {
    let tok = '', taken = 0;
    while (ci < chars.length && taken < s) { tok += chars[ci]; if (!isQPunct(chars[ci])) taken++; ci++; }
    while (ci < chars.length && isQPunct(chars[ci])) { tok += chars[ci]; ci++; }
    tokens.push(tok);
  }
  while (ci < chars.length) { tokens[tokens.length - 1] += chars[ci]; ci++; }
  return tokens;
};

/**
 * 패턴 체크 3단계 퀴즈 생성.
 * @param {Object} chapter - 레지스트리의 챕터 객체
 * @param {Object} ref - getRefLang(...) 레지스트리 (getGrammarChapters 사용)
 * @param {Object} [opts] - { maxMeaning=4, maxApply=4, maxProduce=3 } 문항 수 상한
 * @returns {{meaning: Array, apply: Array, produce: Array}}
 */
export function buildChapterQuiz(chapter, ref, opts = {}) {
  const { maxMeaning = 4, maxApply = 4, maxProduce = 3 } = opts;

  const exAll = chapter.sections
    .flatMap(sec => sec.examples || [])
    .filter(ex => ex && ex.ko && refMain(ex));

  // ① 빈칸 채우기 — 실제 예문에서 패턴 자리를 비우고, 문맥에 맞는 형태를 고른다.
  //    보기(오답)는 정답과 같은 종류(실제 단어형)만 — 한국어 슬롯·문법용어·구두점 조각은 배제.
  const ownPatterns = chapter.sections.filter(s => s.pattern);
  // 교차 챕터 풀 — 다른 챕터의 긴 CJK 구절·성어(说得很好·守株待兔)가 단일 조사 보기로 새지 않게 4자+ CJK 제외.
  // (같은 챕터의 보기·성어 챕터의 4자 성어는 ownPatterns/sec.distractors로 들어오므로 영향 없음)
  const levelForms = [...new Set(
    ref.getGrammarChapters(chapter.level)
      .filter(c => c.slug !== chapter.slug)
      .flatMap(c => c.sections || [])
      .flatMap(s => [...clozeSegs(s.pattern), ...(s.distractors || [])])
  )].filter(f => !(isCJK(f) && f.length >= 4));

  const meaning = [];
  const usedCloze = new Set();
  const ansCount = {};                            // 정답 형태별 등장 횟수 — 같은 답 3회+ 반복 차단(찍기 방지)
  for (const sec of ownPatterns) {
    if (meaning.length >= maxMeaning) break;
    const segs = clozeSegs(sec.pattern).sort((a, b) => b.length - a.length);
    for (const ex of (sec.examples || [])) {
      if (meaning.length >= maxMeaning) break;
      const main = refMain(ex);
      if (!ex || !ex.ko || !main || usedCloze.has(main)) continue;
      const low = main.toLowerCase();
      let seg = null, at = -1;
      for (const g of segs) { const i = findSeg(low, g); if (i >= 0) { seg = g; at = i; break; } }
      if (!seg) continue;
      const actual = main.slice(at, at + seg.length);
      if ((ansCount[actual] || 0) >= 2) continue;  // 같은 정답은 최대 2회 — 형태 다양성 확보
      // 보기 풀: 저작 distractors 우선 → 같은 챕터 다른 패턴 → 레벨 형태 (모두 정제)
      const pool = [
        ...(sec.distractors || []),
        ...ownPatterns.filter(o => o !== sec).flatMap(o => clozeSegs(o.pattern)),
        ...levelForms,
      ];
      const distractors = [...new Set(pool)]
        .filter(d => validDistractor(d, actual) && !low.includes(String(d).toLowerCase()))
        .slice(0, 3);
      if (distractors.length < 2) continue;
      meaning.push({
        sentence: main.slice(0, at) + '＿＿＿' + main.slice(at + seg.length),
        full: main,
        ko: ex.ko,
        correct: actual,
        distractors,
        pron: refPron(ex),
      });
      ansCount[actual] = (ansCount[actual] || 0) + 1;
      usedCloze.add(main);
    }
  }

  // ② 적용 — 어순 배열만 (공백 토큰 3~10). '번역 고르기'(의미 찍기)는 가치가 없어 폐기.
  const apply = [];
  const usedApply = new Set(usedCloze);
  for (const ex of exAll) {
    if (apply.length >= maxApply) break;
    const main = refMain(ex);
    if (usedApply.has(main) || !isOrderable(main)) continue;
    let tokens = main.split(/[\s　]+/).filter(Boolean);
    if (tokens.length < 3 && ex.pinyin) {            // 중국어: 병음으로 어절 분리
      const seg = segByPinyin(main, ex.pinyin);
      if (seg) tokens = seg;
    }
    if (tokens.length >= 3 && tokens.length <= 10) {
      apply.push({ type: 'order', tokens, answer: main, ko: ex.ko, pron: refPron(ex) });
      usedApply.add(main);
    }
  }

  // ③ 생산 — 적용에서 안 쓴 예문 우선, 부족하면 재사용 (생산은 다른 능력)
  const producePool = [
    ...exAll.filter(ex => !usedApply.has(refMain(ex))),
    ...exAll.filter(ex => usedApply.has(refMain(ex))),
  ];
  const produce = producePool.slice(0, maxProduce).map(ex => ({
    ko: ex.ko, main: refMain(ex), pron: refPron(ex),
  }));

  return { meaning, apply, produce };
}

/** 복습 세션용 축소 퀴즈 — 챕터당 ~4문항 (빈칸 2 · 어순 1 · 생산 1) */
export function buildReviewQuiz(chapter, ref) {
  return buildChapterQuiz(chapter, ref, { maxMeaning: 2, maxApply: 1, maxProduce: 1 });
}
