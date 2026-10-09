// 한자 창(팝오버) 모델 — 뷰어 v2 AE-R4 PR ① 순수 함수(VIEWER-V2-ROUNDS-001 §9 · 설계서
// docs/manabi-viewer-v2-ae-r4.md §3). 렌더·팝오버·미리 받기 배선은 PR ②에서 한다 — 이 파일은
// 「무엇을 보일지」만 정한다(화면 변화 0).
//
// 세 덩어리:
//   ⑴ 머리 hanjaPanelModel().head — 누른 글자(간체) + 이 단어 속 병음 → 正 꼴(AE-R3 zhengForm) ·
//      훈음(R0+ hanjaReadingsOf). 형성자 역할이 확인된 글자만 훈 = 뜻 색, 음 = 소리 색.
//   ⑵ 구성 hanjaPanelModel().parts — 뜻 조각 + 소리 조각(역할 확인) 또는 1단 성분(역할 미상).
//      조회는 정체 꼴(R0+ s2t)로 한다 — 간체 줄임 기호(观의 又)가 아니라 觀 = 見 + 雚으로 보인다.
//   ⑶ 같은 한자어 타일 selectSameHanjaTiles() — 누른 글자를 같은 병음으로 읽는 단어 3개 이하.
//   그리고 소리 조각 드릴다운 soundPieceDrill().
//
// 데이터: src/lib/data/hanjaPanel.json(scripts/generate-hanja-panel.mjs — Unihan kPhonetic·kMandarin ·
// hanjaEtym 1단 분해 · 수기 판정). 병음은 런타임에 pinyin-pro를 싣지 않는다(설계서 §0.6) — 음절 나누기는
// 아래 splitPinyinSyllables(음절 목록 정규식 대신 목록 + 분할 수 일치)로 한다.
import { applyDueum, hanjaHunEum, hanjaReadingsOf, toTraditional, toTraditionalTW, zhengForm } from './hanjaKo.js';

const HAN = /\p{Script=Han}/u;
const HANGUL = /[가-힣]/;
const chars = (s) => [...String(s || '')];

// ── 지연 로드(T1 — 중국어 자료를 열 때 유휴 시간에 미리 받는다, 배선 = ViewerPage, PR ②) ──────────
let panelPromise = null;
/** hanjaPanel.json 지연 로드 — 한 번만 받고, 실패하면 다음 호출에서 다시 받는다. */
export function loadHanjaPanelTable() {
  panelPromise ||= import('./data/hanjaPanel.json')
    .then((m) => m.default || m)
    .catch((err) => {
      panelPromise = null;
      throw err;
    });
  return panelPromise;
}

/**
 * 유휴 시간에 한 번 run을 부른다(requestIdleCallback, 없으면 setTimeout 0). 반환값 = 예약 취소 함수.
 * @param {() => void} run
 * @param {{timeout?: number, scheduler?: {idle?: Function, cancelIdle?: Function}}} [opts]
 */
export function onIdle(run, { timeout = 2000, scheduler } = {}) {
  const idle = scheduler?.idle ?? (typeof requestIdleCallback === 'function' ? requestIdleCallback : null);
  const cancelIdle = scheduler?.cancelIdle ?? (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : null);
  let done = false;
  const once = () => { if (!done) { done = true; run(); } };
  if (idle) {
    const id = idle(once, { timeout });
    return () => { done = true; if (cancelIdle) cancelIdle(id); };
  }
  const id = setTimeout(once, 0);
  return () => { done = true; clearTimeout(id); };
}

/**
 * 한자 창 표 미리 받기(T1 — PR ② 배선): 중국어 자료를 열면 유휴 시간에 hanjaPanel.json을 받아 둔다(AE-R3 정체 표와 같은 시점).
 * 실패는 조용히 넘긴다(창은 머리만 그린다). onLoad(table)은 받았을 때 한 번, 취소한 뒤에는 부르지 않는다.
 */
export function prefetchHanjaPanel({ onLoad, ...opts } = {}) {
  let cancelled = false;
  const cancel = onIdle(() => {
    loadHanjaPanelTable().then((t) => { if (!cancelled) onLoad?.(t); }).catch(() => {});
  }, opts);
  return () => { cancelled = true; cancel(); };
}

// ── 병음 음절 ──────────────────────────────────────────────────────
// 성조 없는 표준 병음 음절(Unihan kMandarin에 나오는 음절 중 단독 비음 m·n·ng 등 감탄사를 뺀 것).
const SYLLABLES = new Set(('a ai an ang ao ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu ca cai can '
  + 'cang cao ce cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun '
  + 'chuo ci cong cou cu cuan cui cun cuo da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du '
  + 'duan dui dun duo e ei en eng er fa fan fang fei fen feng fo fou fu ga gai gan gang gao ge gei gen geng gong gou gu '
  + 'gua guai guan guang gui gun guo ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo ji '
  + 'jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun ka kai kan kang kao ke kei ken keng kong kou ku kua kuai '
  + 'kuan kuang kui kun kuo la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan '
  + 'lun luo lv lve ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu na nai nan nang nao ne '
  + 'nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nun nuo nv nve o ou pa pai pan pang pao pei pen '
  + 'peng pi pian piao pie pin ping po pou pu qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun ran rang rao '
  + 're ren reng ri rong rou ru rua ruan rui run ruo sa sai san sang sao se sen seng sha shai shan shang shao she shei '
  + 'shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo ta tai tan tang tao '
  + 'te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo wa wai wan wang wei wen weng wo wu xi xia xian xiang '
  + 'xiao xie xin xing xiong xiu xu xuan xue xun ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun za zai zan '
  + 'zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui '
  + 'zhun zhuo zi zong zou zu zuan zui zun zuo').split(' '));
const MAX_SYL = 6; // zhuang
const TONE_MARKS = /[̀́̄̌]/g;
const BREAK = /[\s'’‘\-·]/u;

/** 글자 하나 → 성조 없는 소문자 바탕 글자(ü = v). 라틴 글자가 아니면 ''. */
function baseLetter(c) {
  const d = c.normalize('NFD');
  const b = d.replace(TONE_MARKS, '').replace(/ü/gi, 'v').toLowerCase();
  return /^[a-z]$/.test(b) ? b : '';
}
const toneCount = (s) => (s.normalize('NFD').match(TONE_MARKS) || []).length;

/** 병음 한 음절의 표시·비교 꼴 — NFC 소문자, v 표기는 ü로. toneless면 성조 부호를 뺀다. */
export function normalizePinyin(syl, { toneless = false } = {}) {
  let s = String(syl || '').trim().normalize('NFD').toLowerCase().replace(/v/g, 'ü');
  if (toneless) s = s.replace(TONE_MARKS, '');
  return s.normalize('NFC');
}

/**
 * 병음 문자열 → 글자 수 n개 음절. 공백·격음 부호(')로 나뉜 조각 안은 표준 음절 목록으로 나누고,
 * 음절마다 성조 부호는 하나 이하이고, 표준 표기 규칙대로 격음 부호 없이 a·o·e로 시작하는 음절은 조각
 * 머리에만 오는 분할을 먼저 고른다(西安 = Xī'ān · 方案 = fāng'àn — fāngàn은 fān·gàn). 그런 분할이 없으면
 * (격음 부호를 빠뜨린 反而 fǎnér) 나머지 분할을 보되, 어느 쪽이든 나누는 길이 둘 이상이면 null.
 * 儿화(yīhuìr — 3글자 一会儿)는 erhua(단어가 儿로 끝남)일 때만 끝 r을 한 음절로 뗀다.
 * 나눌 수 없으면 null(그 후보를 뺀다 — 설계서 §3.3).
 * @param {string} py - 'cānguān' · 'cān guān' · "Xī'ān"
 * @param {number} n - 글자 수
 * @param {{erhua?: boolean}} [opts] - 단어가 儿로 끝나는가
 * @returns {string[]|null} NFC 소문자 음절(성조 부호 유지)
 */
export function splitPinyinSyllables(py, n, { erhua = false } = {}) {
  const want = Math.floor(Number(n));
  const src = String(py || '').normalize('NFC').trim();
  if (!src || !(want >= 1)) return null;
  const got = splitExact(src, want);
  if (got) return got;
  // 儿화 — 끝 r을 떼어 n−1개로 나뉘면 [..., 'r']
  const cs = [...src];
  if (erhua && want >= 2 && cs.length > 1 && baseLetter(cs[cs.length - 1]) === 'r') {
    const head = splitExact(cs.slice(0, -1).join(''), want - 1);
    if (head) return [...head, 'r'];
  }
  return null;
}

function splitExact(src, want) {
  // 조각(공백·격음 부호로 나뉜 덩어리) → 바탕 글자열
  const pieces = [];
  let cur = [];
  for (const c of src) {
    if (BREAK.test(c)) {
      if (cur.length) pieces.push(cur);
      cur = [];
      continue;
    }
    if (!baseLetter(c)) return null;
    cur.push(c);
  }
  if (cur.length) pieces.push(cur);
  if (!pieces.length) return null;
  const sols = [];
  const walk = (pi, at, acc, orth) => {
    if (sols.length > 8 || acc.length > want) return;
    if (pi === pieces.length) {
      if (acc.length === want) sols.push({ acc: [...acc], orth });
      return;
    }
    const piece = pieces[pi];
    if (at === piece.length) {
      walk(pi + 1, 0, acc, orth);
      return;
    }
    for (let len = Math.min(MAX_SYL, piece.length - at); len >= 1; len--) {
      const raw = piece.slice(at, at + len).join('');
      const base = piece.slice(at, at + len).map(baseLetter).join('');
      if (!SYLLABLES.has(base) || toneCount(raw) > 1) continue;
      acc.push(raw);
      walk(pi, at + len, acc, orth && !(at > 0 && /^[aoe]/.test(base)));
      acc.pop();
    }
  };
  walk(0, 0, [], true);
  if (!sols.length) return null;
  const orth = sols.filter((s) => s.orth);
  const pick = orth.length ? orth : sols; // 사전이 격음 부호를 빠뜨린 표기(fǎnér) — 나누는 길이 하나일 때만 받는다
  const keys = new Set(pick.map((s) => s.acc.join(' ')));
  if (keys.size !== 1) return null;
  return pick[0].acc.map((s) => normalizePinyin(s));
}

// 一·不은 변조(yī → yí/yì, bù → bú)를 사전이 적기도 하고 안 적기도 한다 — 본래 성조 기준으로 같은
// 병음으로 본다(성조 무시 비교, 설계서 Q6).
const SANDHI = new Set(['一', '不']);
/** 누른 글자 ch를 같은 병음으로 읽는가 — 성조 포함 완전 일치(一·不만 성조 무시). */
export function samePinyin(a, b, ch) {
  const toneless = SANDHI.has(ch);
  const x = normalizePinyin(a, { toneless });
  return !!x && x === normalizePinyin(b, { toneless });
}

// ── 한국 한자음 · 같은 한자어 판정 ─────────────────────────────────────
/**
 * 단어의 한국 한자음 — R0+ 정체 꼴(hanjaReadingsOf)의 글자별 음, 어두 두음법칙(readHanjaKo 관례).
 * 음 미등재 글자가 하나라도 있으면 null.
 * @returns {{eum: string, sylls: string[]}|null} sylls[i] = i번째 글자의 음(첫 글자는 두음 적용)
 */
export function koEumOf(word, { koTable, hunTable, tradTable } = {}) {
  const cs = chars(word);
  if (!cs.length || !koTable) return null;
  const sylls = hanjaReadingsOf(cs.join(''), { koTable, hunTable, tradTable }).map((r) => r.eum);
  if (sylls.some((e) => !e)) return null;
  sylls[0] = applyDueum(sylls[0]);
  return { eum: sylls.join(''), sylls };
}

// 경계 규칙(설계서 §3.3): 한자음 앞 글자는 한글이 아니고, 뒤 글자는 한글이 아니거나 허용 조사·접미.
// 설계서 목록에 개발 세션 표본 재확인분(하다 활용 한·할·함·해·했, 조사 으(로)·까(지), 있다·없다)을 더했다.
// 护士 「호사」 ⊂ 간호사 · 学员 「학원」 ⊂ 학원생 · 广泛 「광범」 ⊂ 광범위 · 大学 「대학」 ⊂ 대학교는 막는다.
export const KO_BOUNDARY_NEXT = Object.freeze(new Set([...'하히적이스되시성감화롭로을를은는에의도과와만한할함해했으까있없']));

/**
 * 같은 한자어 판정 — 한국 한자음(koEumOf)이 한국어 뜻 meaning에 경계 규칙대로 들어 있으면 그 음.
 * 사전 hanja 표기(终于 「종어(終於)」 같은 읽기 설명)는 기준으로 쓰지 않는다(설계서 Q1 — 비단어 차단).
 * @returns {{eum: string, sylls: string[]}|null}
 */
export function sameHanjaWord(word, meaning, tables = {}) {
  const ko = koEumOf(word, tables);
  const text = String(meaning || '');
  if (!ko || !text || chars(word).length < 2) return null;
  for (let at = text.indexOf(ko.eum); at !== -1; at = text.indexOf(ko.eum, at + 1)) {
    const prev = text[at - 1] || '';
    const next = text[at + ko.eum.length] || '';
    if (HANGUL.test(prev)) continue;
    if (HANGUL.test(next) && !KO_BOUNDARY_NEXT.has(next)) continue;
    return ko;
  }
  return null;
}

/** 짧은 뜻 — 뜻의 첫 조각(쉼표·세미콜론·슬래시 앞, 괄호 설명 제거), 6자 상한(설계서 §11.2). */
export function shortMeaning(meaning, max = 6) {
  const first = String(meaning || '').split(/[,;，；/·\n]/)[0].replace(/\([^)]*\)|（[^）]*）/g, '').trim();
  if (!first) return null;
  const cs = [...first];
  return cs.length > max ? `${cs.slice(0, max).join('')}…` : first;
}

// ── refVocab 글자 색인 ────────────────────────────────────────────────
const LEVEL_RANK = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };
const cpCmp = (a, b) => {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0) - y[i].codePointAt(0);
    if (d) return d;
  }
  return x.length - y.length;
};
const charIndexCache = new WeakMap();
/** refVocab 인덱스(Map zh → {level, word}) → 글자 → 표제어 목록(HSK 급 낮은 순 → 코드포인트). 인덱스마다 1회. */
function refWordsByChar(refIndex) {
  let byChar = charIndexCache.get(refIndex);
  if (byChar) return byChar;
  byChar = new Map();
  for (const [zh, entry] of refIndex) {
    for (const c of new Set(chars(zh))) {
      if (!HAN.test(c)) continue;
      if (!byChar.has(c)) byChar.set(c, []);
      byChar.get(c).push({ zh, entry });
    }
  }
  const rank = (e) => LEVEL_RANK[e.entry.level] || 9;
  for (const list of byChar.values()) list.sort((a, b) => rank(a) - rank(b) || cpCmp(a.zh, b.zh));
  charIndexCache.set(refIndex, byChar);
  return byChar;
}

// ── 같은 한자어 타일 ──────────────────────────────────────────────────
/**
 * 같은 한자어 타일 — 누른 글자 ch를 그 자리 병음 reading과 같은 병음으로 읽는 단어, 지금 단어 제외,
 * 내 단어 → 이 자료 → 우리 사전(HSK 급 낮은 순) 순서, 최대 cap개(설계서 §3.3).
 * 판정(sameHanjaWord) 통과분을 먼저 채우고, 모자라면 판정 실패 후보에 짧은 뜻(흐림)을 단다.
 * 병음을 확인할 수 없는 후보(읽기 없음·음절 나누기 실패)는 뺀다.
 *
 * @param {object} p
 * @param {string} p.ch - 누른 글자(간체 — 단어에 쓰인 꼴)
 * @param {string|null} p.reading - 그 자리 병음(토큰 글자별). 없으면 지금 단어의 사전 병음 그 자리로 메운다
 * @param {string} p.headText - 지금 단어(제외)
 * @param {number} [p.index] - 지금 단어 속 ch 자리(reading을 사전 병음으로 메울 때)
 * @param {Iterable<object>} [p.savedRows] - 내 단어 행(user_vocabulary — word_text·meaning·language)
 * @param {object} [p.material] - processed_json({sequence, dictionary} — 토큰 text·reading·meaning)
 * @param {Map} [p.refIndex] - refVocabIndex(zh → {level, word:{zh, pinyin, ko}})
 * @param {object} p.tables - {koTable, hunTable, tradTable}
 * @param {number} [p.cap=3]
 * @returns {{word:string, syllables:string[], at:number, ko:string|null, koSylls:string[]|null,
 *   short:string|null, dim:boolean, mine:boolean, source:'mine'|'material'|'ref'}[]}
 */
export function selectSameHanjaTiles({ ch, reading, headText, index, savedRows, material, refIndex, tables = {}, cap = 3 } = {}) {
  if (!ch || !HAN.test(ch) || [...ch].length !== 1) return [];
  let want = String(reading || '').trim();
  if (!want && headText && refIndex?.get) {
    const hs = chars(headText);
    const i = Number.isInteger(index) && hs[index] === ch ? index : hs.indexOf(ch);
    const own = i >= 0 ? splitPinyinSyllables(refIndex.get(headText)?.word?.pinyin, hs.length, { erhua: hs[hs.length - 1] === '儿' }) : null;
    want = own?.[i] || '';
  }
  if (!want) return [];

  const refOf = (w) => (refIndex?.get ? refIndex.get(w) : null);
  const tokenOf = new Map();
  for (const id of material?.sequence || []) {
    const t = material?.dictionary?.[id];
    if (!t || t.failed || t.pos === '개행' || !t.text || tokenOf.has(t.text)) continue;
    tokenOf.set(t.text, t);
  }
  const seen = new Set([String(headText || '')]);
  const passed = [];
  const failed = [];
  const consider = (word, source, { pinyin, meaning }) => {
    const w = String(word || '');
    const cs = chars(w);
    if (cs.length < 2 || !cs.includes(ch) || seen.has(w)) return;
    seen.add(w);
    const syllables = splitPinyinSyllables(pinyin, cs.length, { erhua: cs[cs.length - 1] === '儿' });
    if (!syllables) return;
    const at = cs.findIndex((c, i) => c === ch && samePinyin(syllables[i], want, ch));
    if (at < 0) return;
    const tile = { word: w, syllables, at, source, mine: source === 'mine' };
    const ko = sameHanjaWord(w, meaning, tables);
    if (ko) passed.push({ ...tile, ko: ko.eum, koSylls: ko.sylls, short: null, dim: false });
    else {
      const short = shortMeaning(meaning);
      if (short) failed.push({ ...tile, ko: null, koSylls: null, short, dim: true });
    }
  };
  for (const row of savedRows || []) {
    if (row?.language && row.language !== 'Chinese') continue;
    const w = row?.word_text;
    const ref = refOf(w);
    consider(w, 'mine', { pinyin: ref?.word?.pinyin || tokenOf.get(w)?.reading, meaning: ref?.word?.ko || row?.meaning });
  }
  for (const [w, t] of tokenOf) {
    const ref = refOf(w);
    consider(w, 'material', { pinyin: t.reading || ref?.word?.pinyin, meaning: ref?.word?.ko || t.meaning });
  }
  if (refIndex) {
    for (const { zh, entry } of refWordsByChar(refIndex).get(ch) || []) {
      if (passed.length >= cap) break;
      consider(zh, 'ref', { pinyin: entry.word?.pinyin, meaning: entry.word?.ko });
    }
  }
  return [...passed, ...failed].slice(0, Math.max(0, cap));
}

// ── 머리 · 구성 ──────────────────────────────────────────────────────
function splitLabel(label) {
  const s = String(label || '').trim();
  if (!s) return { hun: null, eum: null, label: null };
  const i = s.lastIndexOf(' ');
  return i > 0 ? { hun: s.slice(0, i), eum: s.slice(i + 1), label: s } : { hun: null, eum: s, label: s };
}

/** 조각 라벨 — 보정 표(lab) → 부수 본자의 보정·훈음 → 그 글자 훈음 → 음만. */
export function pieceLabel(c, { panel, koTable, hunTable } = {}, base = '') {
  const fromLab = panel?.lab?.[c] || (base && panel?.lab?.[base]);
  if (fromLab) return splitLabel(fromLab);
  const hunEum = (base && hanjaHunEum(base, koTable, hunTable)) || hanjaHunEum(c, koTable, hunTable);
  if (hunEum) return splitLabel(hunEum);
  const eum = koTable?.[base] || koTable?.[c];
  return eum ? { hun: null, eum, label: eum } : { hun: null, eum: null, label: null };
}

/** 패널 표의 역할 — {sem, ph, base} 또는 null. */
export function panelRole(c, panel) {
  const v = panel?.roles?.[c];
  if (!v) return null;
  const [sem, ph, base = ''] = [...v];
  return { sem, ph, base };
}

/**
 * 한자 창 머리 + 구성.
 * - 단어 문맥(word·index)이 있으면: 正 꼴 = zhengForm(word)의 그 자리(간체와 같거나 모호하면 null),
 *   훈음 = hanjaReadingsOf(word, R0+)의 그 자리, 역할·구성 조회 꼴 = toTraditional(word)의 그 자리.
 * - 문맥이 없으면(뜻 조각을 눌러 연 창): 글자 자신이 정체 — 正 없음, 병음 = kMandarin(panel.py),
 *   훈음 = 조각 라벨(pieceLabel — 金 '쇠 금').
 * 단어 문맥이 있는데 정체 표(tradTable)가 아직 없으면 null(로딩 중 — 간체 동형 글자 훈음을 보이지 않는다).
 * 색: 역할이 확인된 글자만 {hun:'meaning', eum:'sound'}. 「볼」 = 見 훈 같은 문자열 대조는 하지 않는다.
 * 구성: 역할 → [뜻 조각, 소리 조각], 역할 미상 → 1단 성분 2~3개(role null), 자료 없음·4성분 이상 → null.
 *
 * @param {object} p
 * @param {string} p.ch - 누른 글자
 * @param {number} [p.index] - 단어 속 자리
 * @param {string|null} [p.reading] - 그 자리 병음(토큰 글자별). 없으면 null(사전 대표 읽기로 메우지 않는다)
 * @param {string} [p.word] - 지금 단어(표제어)
 * @param {object} p.tables - {koTable, hunTable, tradTable, panel}
 */
export function hanjaPanelModel({ ch, index, reading = null, word = '', tables = {} } = {}) {
  if (!ch || [...ch].length !== 1 || !HAN.test(ch)) return null;
  const { koTable, hunTable, tradTable, panel } = tables;
  const ws = chars(word);
  const i = ws.length ? (Number.isInteger(index) && ws[index] === ch ? index : ws.indexOf(ch)) : -1;
  let zheng = null;
  let lookup = ch;
  let read;
  let py = reading ? String(reading).trim() : null;
  // 정체 표가 아직 없으면 그리지 않는다 — 간체 동형 글자의 엉뚱한 훈음(术 '삽주뿌리 출')을 잠깐이라도
  // 보이지 않게(charDetail과 같은 로딩 중 안전)
  if (i >= 0 && !tradTable) return null;
  if (i >= 0) {
    const zf = zhengForm(word, tradTable);
    if (zf?.diff[i]) zheng = [...zf.form][i];
    const t = chars(toTraditional(word, tradTable));
    const tw = chars(toTraditionalTW(word, tradTable));
    const cands = [t.length === ws.length ? t[i] : null, tw.length === ws.length ? tw[i] : null, ch];
    lookup = cands.find((c) => c && (panel?.roles?.[c] || panel?.comps?.[c])) || cands.find(Boolean);
    const r = hanjaReadingsOf(word, { koTable, hunTable, tradTable })[i];
    read = r?.label ? splitLabel(r.label) : { hun: null, eum: r?.eum || null, label: r?.eum || null };
  } else {
    read = pieceLabel(ch, { panel, koTable, hunTable });
    py = py || panel?.py?.[ch] || null;
  }
  const role = panelRole(lookup, panel);
  const head = {
    ch,
    reading: py || null,
    zheng,
    hun: read.hun,
    eum: read.eum,
    label: read.label,
    tone: { hun: role && read.hun ? 'meaning' : null, eum: role && read.eum ? 'sound' : null },
  };
  let parts = null;
  if (role) {
    parts = {
      known: true,
      pieces: [
        { ch: role.sem, role: 'meaning', target: role.base || role.sem, ...pieceLabel(role.sem, { panel, koTable, hunTable }, role.base) },
        { ch: role.ph, role: 'sound', drill: !!panel?.drill?.[role.ph], ...pieceLabel(role.ph, { panel, koTable, hunTable }) },
      ],
    };
  } else if (panel?.comps?.[lookup]) {
    parts = {
      known: false,
      pieces: [...panel.comps[lookup]].map((c) => ({ ch: c, role: null, ...pieceLabel(c, { panel, koTable, hunTable }) })),
    };
  }
  return { head, lookup, parts };
}

/**
 * 뜻 조각 창에서 단어를 찾을 꼴 — 정체 → 간체(見 → 见, panel.simp). 표에 없으면 글자 그대로.
 */
export function panelSearchChar(c, panel) {
  return panel?.simp?.[c] || c;
}

// ── 소리 조각 드릴다운 ────────────────────────────────────────────────
/**
 * 소리 조각 → 같은 소리 조각을 가진 글자(빈도순 5 — 생성 때 순위) + 대표 읽기 요약.
 * 요약 = 그 글자들의 한국 음을 많은 순으로 중복 없이 최대 3 + 같은 순서의 성조 없는 병음.
 * @returns {{piece:string, reading:string|null, hun:string|null, eum:string|null, label:string|null,
 *   items:{ch:string, py:string|null, eum:string|null}[], summary:{eums:string[], pys:string[]}}|null}
 */
export function soundPieceDrill(piece, { panel, koTable, hunTable } = {}) {
  const list = panel?.drill?.[piece];
  if (!list) return null;
  const items = [...list].map((c) => ({ ch: c, py: panel?.py?.[c] || null, eum: koTable?.[c] || null }));
  const rankBy = (vals) => {
    const count = new Map();
    vals.forEach((v) => v && count.set(v, (count.get(v) || 0) + 1));
    return [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || vals.indexOf(a) - vals.indexOf(b)).slice(0, 3);
  };
  return {
    piece,
    reading: panel?.py?.[piece] || null,
    ...pieceLabel(piece, { panel, koTable, hunTable }),
    items,
    summary: {
      eums: rankBy(items.map((x) => x.eum)),
      pys: rankBy(items.map((x) => (x.py ? normalizePinyin(x.py, { toneless: true }) : null))),
    },
  };
}

/** 받침 있는 음절이면 '이', 없으면 '가'. */
function subjectParticle(eum) {
  const code = String(eum || '').charCodeAt(String(eum || '').length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return '이';
  return (code - 0xac00) % 28 ? '이' : '가';
}

/**
 * 드릴다운 요약 한 줄 — 「雚이 들면 대개 관·권·환 (guan·quan·huan)」(정본 시안의 유일한 문장 틀).
 * 조사(이/가)는 조각의 한국 음 받침으로 정한다.
 */
export function formatDrillSummary(drill) {
  if (!drill?.summary?.eums?.length) return '';
  const { eums, pys } = drill.summary;
  const tail = pys.length ? ` (${pys.join('·')})` : '';
  return `${drill.piece}${subjectParticle(drill.eum)} 들면 대개 ${eums.join('·')}${tail}`;
}
