// 한국 한자음 앵커 — 옵트인 '한자 대조'(중국어 뷰어) 1단계(오너 승인 설계).
// 뜻이 아니라 발음 고리다: 老师의 뜻 자리는 '선생님'이 지키고, 이 모듈은 '노사'(老 로→어두
// 두음 노 + 师 사)를 만들어 lǎoshī를 소리로 걸고 같은 글자를 다른 단어에서 재인식하게 한다.
// 테이블(src/lib/data/hanjaKo.json)은 scripts/generate-hanja-ko.mjs가 생성 — 렌더 쪽은
// 토글이 켜질 때만 dynamic import로 지연 로드한다.

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHO_N = 2; // ㄴ
const CHO_R = 5; // ㄹ
const CHO_NG = 11; // ㅇ
// 두음법칙에서 ㄹ·ㄴ이 ㅇ으로 가는 이중·전설 계열 모음(ㅑㅒㅕㅖㅛㅠㅣ)의 중성 인덱스
const Y_VOWELS = new Set([2, 3, 6, 7, 12, 17, 20]);

/** 어두 1음절 두음법칙 — 로→노·료→요·려→여·리→이·녀→여(한국어 읽기 관례, 오너 확정). */
export function applyDueum(syllable) {
  const code = syllable?.charCodeAt?.(0);
  if (code == null || code < HANGUL_BASE || code > HANGUL_END) return syllable;
  const offset = code - HANGUL_BASE;
  const cho = Math.floor(offset / 588);
  const jung = Math.floor((offset % 588) / 28);
  const jong = offset % 28;
  let next = null;
  if (cho === CHO_R) next = Y_VOWELS.has(jung) ? CHO_NG : CHO_N; // 려→여, 로→노
  else if (cho === CHO_N && Y_VOWELS.has(jung)) next = CHO_NG; // 녀→여
  if (next == null) return syllable;
  return String.fromCharCode(HANGUL_BASE + (next * 21 + jung) * 28 + jong) + syllable.slice(1);
}

/**
 * 단어의 한국 한자음 — 글자별 음을 이어붙이고 어두에만 두음법칙을 적용한다.
 * 미등재 글자가 하나라도 있으면 null(어중간한 표기는 앵커로서 해롭다 — 표시 생략).
 * 뷰어의 '한자음' 단독 줄은 폐지됐고(2026-08-23 오너 확정 — 훈음 나열이 대체) 이 함수는
 * 생성 테이블의 데이터 계약 검증·후속 소비(검색 등)용으로 유지한다.
 * @param {string} word - 중국어 표기(간체·정체 모두 테이블에 수록)
 * @param {Record<string, string>} table - hanjaKo.json
 */
export function readHanjaKo(word, table) {
  const chars = [...String(word || '')];
  if (chars.length === 0 || !table) return null;
  const readings = chars.map((ch) => table[ch]);
  if (readings.some((r) => !r)) return null;
  readings[0] = applyDueum(readings[0]);
  return readings.join('');
}

/**
 * 글자 하나의 훈음 라벨(①) — 한국 옥편 표제 관례: '늙을 로(노)'(두음 변형이 있으면
 * 괄호 병기), 변형 없으면 '스승 사'. 훈 또는 음 미등재면 null.
 * @param {string} ch - 한자 1글자
 * @param {Record<string, string>} koTable - hanjaKo.json(자→음)
 * @param {Record<string, string>} hunTable - hanjaHun.json(자→훈)
 */
export function hanjaHunEum(ch, koTable, hunTable) {
  const eum = koTable?.[ch];
  const hun = hunTable?.[ch];
  if (!eum || !hun) return null;
  const dueum = applyDueum(eum);
  return dueum !== eum ? `${hun} ${eum}(${dueum})` : `${hun} ${eum}`;
}

/** 음만 있는 글자의 라벨 — 훈음과 같은 두음 병기 관례('로(노)'·'사'). 음 미등재면 null. */
function eumOnlyLabel(ch, koTable) {
  const eum = koTable?.[ch];
  if (!eum) return null;
  const dueum = applyDueum(eum);
  return dueum !== eum ? `${eum}(${dueum})` : eum;
}

// ── 正 꼴 조회(R0+, VIEWER-V2-ROUNDS-001 §1) ─────────────────────────────
// 간체 글자 그대로 훈음을 찾으면 간체와 모양이 같은 옛 글자의 훈음이 나온다(技术 →
// '삽주뿌리 출', 价格 → '착할 개'). 그래서 중국어 단어는 OpenCC s2t로 바꾼 정체 꼴의
// 글자로 찾는다. 단어 단위로 바꾸므로 다음자가 풀린다(干净 → 乾淨, 干部 → 幹部).
// 표(src/lib/data/hanjaTrad.json)는 scripts/generate-hanja-trad.mjs가 만든다 — 글자 첫
// 후보 + HSK·우리 사전 표제어 중 구절 변환이 글자 변환과 다른 단어만 담는다(구절 사전
// 전체는 싣지 않는다). 렌더 쪽은 hanjaKo.json과 같은 조건에서 지연 로드한다.

const maxPhraseLen = new WeakMap();
function phraseLimit(table) {
  let n = maxPhraseLen.get(table);
  if (n == null) {
    n = 0;
    for (const k of Object.keys(table.phrases || {})) n = Math.max(n, [...k].length);
    maxPhraseLen.set(table, n);
  }
  return n;
}

/**
 * 중국어 문자열 → 정체 꼴(OpenCC s2t: 구절 최장 일치 → 글자 첫 후보). 대만 어휘 변환은
 * 하지 않는다(글자 꼴만). 표 미로드면 원문 그대로. 단어 표에 있으면 OpenCC 전체 사전
 * 결과와 같고, 표 밖 단어는 표 안 구절의 최장 일치 + 글자 첫 후보다.
 * AE-R3(正 줄)·AE-R4(한자 창 머리)가 이 결과를 그대로 쓴다.
 * @param {string} text - 간체(또는 혼합) 중국어
 * @param {{chars: Record<string,string>, phrases: Record<string,string>}} tradTable - hanjaTrad.json
 */
export function toTraditional(text, tradTable) {
  const s = String(text || '');
  if (!s || !tradTable) return s;
  const phrases = tradTable.phrases || {};
  if (phrases[s]) return phrases[s];
  return s2tSegments(s, tradTable).map((g) => g.out).join('');
}

/**
 * s2t 런타임 분절 — [{len, out, phrase}]. phrase = 표 안 구절 최장 일치로 바뀐 조각.
 * toTraditional과 「모호하면 숨김」 판정(zhengSure)이 같은 분절을 쓴다(판정과 변환이 갈리지 않게).
 */
function s2tSegments(s, tradTable) {
  const phrases = tradTable.phrases || {};
  const chars = tradTable.chars || {};
  const cs = [...s];
  const limit = phraseLimit(tradTable);
  const segs = [];
  for (let i = 0; i < cs.length;) {
    let hit = 0;
    for (let len = Math.min(limit, cs.length - i); len >= 2 && !hit; len--) {
      const seg = cs.slice(i, i + len).join('');
      if (phrases[seg]) { segs.push({ len, out: phrases[seg], phrase: true }); hit = len; }
    }
    if (hit) { i += hit; continue; }
    segs.push({ len: 1, out: chars[cs[i]] || cs[i], phrase: false });
    i++;
  }
  return segs;
}

// ── 正 줄 — 대만 표준 자형(OpenCC s2tw, AE-R3 · VIEWER-V2-ROUNDS-001 §6) ──────
// s2tw = s2t 다음에 [TWVariantsPhrases → TWVariants]를 한 번 더 건다(OpenCC 공식 s2tw.json).
// 吃饭: s2t 喫飯 → s2tw 吃飯 · 群众: 羣衆 → 群眾 · 着急: 着急 → 著急. 어휘 변환(s2twp —
// 出租车 → 計程車)은 하지 않는다(글자 꼴만). 표는 hanjaTrad.json의 tw·twPhrases·amb·ok
// (scripts/generate-hanja-trad.mjs). 훈음 조회 꼴(koLookupForms — 한국 정자 기준)과는 별개다.

const twCache = new WeakMap();
function twParts(table) {
  let p = twCache.get(table);
  if (!p) {
    let limit = 0;
    for (const k of Object.keys(table.twPhrases || {})) limit = Math.max(limit, [...k].length);
    let okLimit = 0;
    for (const w of table.ok || []) okLimit = Math.max(okLimit, [...w].length);
    p = { limit, okLimit, amb: new Set([...String(table.amb || '')]), ok: new Set(table.ok || []) };
    twCache.set(table, p);
  }
  return p;
}

/** s2t 결과에 대만 이체 단계만 — 구절(TWVariantsPhrases) 최장 일치 → 글자(TWVariants). */
function applyTwVariants(s, table) {
  const phrases = table.twPhrases || {};
  const chars = table.tw || {};
  const { limit } = twParts(table);
  const cs = [...s];
  let out = '';
  for (let i = 0; i < cs.length;) {
    let hit = 0;
    for (let len = Math.min(limit, cs.length - i); len >= 2 && !hit; len--) {
      const seg = cs.slice(i, i + len).join('');
      if (phrases[seg]) { out += phrases[seg]; hit = len; }
    }
    if (hit) { i += hit; continue; }
    out += chars[cs[i]] || cs[i];
    i++;
  }
  return out;
}

/**
 * 중국어 문자열 → 대만 표준 자형(OpenCC s2tw). 표 미로드면 원문 그대로.
 * 표제어(HSK·우리 사전)에서는 OpenCC 전체 s2tw와 같다(생성 때 전수 검증).
 * @param {string} text
 * @param {object} tradTable - hanjaTrad.json(tw·twPhrases 포함)
 */
export function toTraditionalTW(text, tradTable) {
  const t = toTraditional(text, tradTable);
  if (!t || !tradTable) return t;
  return applyTwVariants(t, tradTable);
}

/**
 * 「모호하면 숨김」 — 정체 꼴을 확신할 수 있는가.
 * 모호 글자(amb: 정체 후보가 둘 이상이고 대만 꼴도 갈리는 글자 — 干 幹/乾 · 发 發/髮)가 없으면
 * 확신. 1자 단어의 모호 글자는 문맥이 없어 항상 불확실. 그 밖에는 모든 모호 글자 자리가 표 안
 * 구절 일치로 바뀌었거나, 단어가 검증 표제어 목록(ok — 모호 글자를 첫 후보로 맞힌 표제어)에
 * 있어야 확신한다. 표 밖 토큰의 모호 글자를 글자 첫 후보로 채운 경우는 불확실(숨김).
 */
export function zhengSure(word, tradTable) {
  const s = String(word || '');
  if (!s || !tradTable) return false;
  const { amb, ok } = twParts(tradTable);
  const cs = [...s];
  if (!cs.some((c) => amb.has(c))) return true;
  if (cs.length === 1) return false;
  if (ok.has(s)) return true;
  const covered = [];
  for (const g of s2tSegments(s, tradTable)) for (let k = 0; k < g.len; k++) covered.push(g.phrase);
  if (cs.every((c, i) => !amb.has(c) || covered[i])) return true;
  // 검증 표제어를 품은 표 밖 토큰(发展中 ⊃ 发展): 그 조각의 변환이 표제어 단독 변환과 같을 때만 덮인다
  // (경계를 넘는 구절이 조각의 꼴을 바꿨다면 검증이 성립하지 않는다).
  const { okLimit } = twParts(tradTable);
  const tw = [...toTraditionalTW(s, tradTable)];
  for (let i = 0; i < cs.length; i++) {
    for (let len = Math.min(okLimit, cs.length - i); len >= 2; len--) {
      const sub = cs.slice(i, i + len).join('');
      if (!ok.has(sub) || tw.slice(i, i + len).join('') !== toTraditionalTW(sub, tradTable)) continue;
      for (let k = i; k < i + len; k++) covered[k] = true;
    }
  }
  return cs.every((c, i) => !amb.has(c) || covered[i]);
}

/**
 * 正 줄 판정 — 보일 때만 {form, diff}, 아니면 null.
 * null: 표 미로드 · 한자 없음 · 간체와 꼴이 같음(眼前) · 모호(zhengSure 거짓) · 글자 수가 어긋남.
 * diff[i] = i번째 글자가 간체와 다름(초록 칠 자리).
 */
export function zhengForm(word, tradTable) {
  const s = String(word || '').trim();
  if (!s || !tradTable || !/\p{Script=Han}/u.test(s)) return null;
  const form = toTraditionalTW(s, tradTable);
  if (form === s) return null;
  const cs = [...s];
  const fs = [...form];
  if (fs.length !== cs.length) return null;
  if (!zhengSure(s, tradTable)) return null;
  return { form, diff: cs.map((c, i) => fs[i] !== c) };
}

/**
 * 한국 한자음 조회용 글자 배열 — 정체 꼴에 한국 다음자 예외(koForms)를 겹친다.
 * 예외는 한국 한자어가 간체 쪽 글자를 쓰는 경우다(音乐 樂 악 · 抽烟 煙 연 · 老板 板 판).
 * 예외 단어가 더 긴 단어 속에 있어도(老板娘) 그 자리만 겹친다. 길이가 어긋나는 변환은
 * 쓰지 않고 원 글자로 둔다(글자 정렬이 깨지면 엉뚱한 글자 훈음이 붙는다).
 */
export function koLookupForms(word, tradTable) {
  const cs = [...String(word || '')];
  if (!tradTable) return cs;
  const conv = [...toTraditional(cs.join(''), tradTable)];
  const forms = conv.length === cs.length ? conv : cs.map((c) => toTraditional(c, tradTable));
  const s = cs.join('');
  for (const [key, value] of Object.entries(tradTable.koForms || {})) {
    const kc = [...key];
    const vc = [...value];
    if (vc.length !== kc.length) continue;
    for (let at = s.indexOf(key); at !== -1; at = s.indexOf(key, at + 1)) {
      const pos = [...s.slice(0, at)].length;
      vc.forEach((c, j) => { forms[pos + j] = c; });
    }
  }
  return forms;
}

/** 같은 음 계열인가 — 두음 변형까지 같은 음으로 본다(뇨·료, 낙·락). */
function sameEumFamily(a, b) {
  return !!a && !!b && (a === b || applyDueum(a) === applyDueum(b));
}

/**
 * 한 글자의 훈음 해석 — 조회 꼴(form) → 한국 정자 이체 → 원 글자 순.
 * 화면 악화 0 원칙: 바꾼 글자의 음이 원 글자의 지금 음과 같은 계열이면 지금 라벨(원 글자의
 * 훈음)을 그대로 쓴다. 정체 꼴이 바꾸는 것은 음부터 틀렸던 글자(术 출→術 술)뿐이고, 같은 음에서
 * 훈만 바꾸는 것은 검수한 허용 쌍(hunUpgrade — 后→後 「뒤」 등)만이다.
 */
function resolveReading(ch, form, { koTable, hunTable, tradTable }) {
  const kr = tradTable?.krVariants?.[form];
  const cands = [...new Set([form, kr].filter(Boolean))];
  const pick = (c) => ({ from: c, eum: koTable?.[c] || null, hun: (koTable?.[c] && hunTable?.[c]) || null });
  // ① 바꾼 글자(또는 그 한국 정자)에 훈·음이 함께 있으면 그것, 없으면 음만이라도
  let hit = cands.map(pick).find((r) => r.eum && r.hun) || cands.map(pick).find((r) => r.eum);
  if (hit && hit.from !== ch) {
    // ② 음이 지금과 같은 계열이면 지금 라벨 유지 — 허용 쌍만 정체 훈으로
    const own = pick(ch);
    const upgrade = hit.hun && (tradTable?.hunUpgrade || []).includes(ch + hit.from);
    if (own.eum && sameEumFamily(own.eum, hit.eum) && !upgrade) hit = own;
  }
  // ③ 바꾼 글자에 아무것도 없으면 지금처럼 원 글자
  if (!hit) hit = pick(ch);
  if (!hit.eum) return { ch, form, from: null, hun: null, eum: null, label: null };
  const label = hit.hun ? hanjaHunEum(hit.from, koTable, hunTable) : eumOnlyLabel(hit.from, koTable);
  return { ch, form, from: hit.from, hun: hit.hun, eum: hit.eum, label };
}

/**
 * 단어의 글자별 한국 훈·음 — 세 경로(단어창 훈음 listHanjaHunEum · 글자 카드 charDetail ·
 * 교실 판서 teachingWordLayout)가 함께 쓰는 단일 조회 함수.
 * tradTable을 넘기면(중국어) 정체 꼴로 찾고, 없으면(일본어·표 미로드) 글자 그대로 찾는다.
 * @returns {{ch:string, form:string, from:string|null, hun:string|null, eum:string|null, label:string|null}[]}
 *   글자 수와 같은 길이. form = 조회 꼴, from = 실제로 훈음을 가져온 글자.
 */
export function hanjaReadingsOf(word, { koTable, hunTable, tradTable } = {}) {
  const cs = [...String(word || '')];
  const forms = tradTable ? koLookupForms(cs.join(''), tradTable) : cs;
  return cs.map((ch, i) => resolveReading(ch, forms[i] || ch, { koTable, hunTable, tradTable }));
}

/**
 * 단어의 글자별 훈음 나열 — [{ch, label}]. 훈이 있는 글자는 '스승 사', 훈이 없는 글자는
 * 음만이라도('사') 편입한다 — 한자음 단독 줄 폐지(2026-08-23 오너 확정: "그 자리에
 * 한자 뜻·음 함께 넣으면서 대체")로 이 나열이 단어의 유일한 음 앵커가 됐기 때문.
 * 음까지 미등재인 글자만 조용히 생략하고, 전무하면 null.
 * tradTable(hanjaTrad.json)을 넘기면 중국어 단어를 정체 꼴로 찾는다(R0+).
 */
export function listHanjaHunEum(word, koTable, hunTable, tradTable = null) {
  const items = hanjaReadingsOf(word, { koTable, hunTable, tradTable })
    .filter((x) => x.label)
    .map(({ ch, label }) => ({ ch, label }));
  return items.length ? items : null;
}

/**
 * 단어(또는 글자)를 일본식 자형으로 — 간체보다 일본식이 익숙하다는 오너 확정에 따라
 * 훈음 줄 글자를 일본식 단독으로 표기한다(본문 간체가 바로 위 헤더에 있어 병기 불요).
 * 테이블은 자형 상이분만 수록(hanjaJa.json) — 미등재는 그대로.
 */
export function toJaForm(word, jaTable) {
  const s = String(word || '');
  if (!jaTable) return s;
  return [...s].map((ch) => jaTable[ch] || ch).join('');
}
