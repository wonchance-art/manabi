/**
 * 중국어 성조 변조 표기 규칙 — 一·不 변조와 个 경성 (오너 확정 2026-09-02 「추천대로」).
 *
 * 왜 게이트인가: 정답지(zh·pinyin 쌍)는 카드 예문 병음으로 학습자에게 그대로 보인다. 같은 단어가
 * 파일마다 yī/yí로 갈리면 교재의 신뢰가 깨진다. 전수 교정(457건)을 한 번 하고 끝내면 다음 저작에서
 * 다시 갈리므로, 규칙을 여기 두고 `lint-curriculum (h)`가 CI에서 지킨다.
 *
 * 규칙
 *   一  뒤 4성·경성 → yí · 뒤 1·2·3성 → yì · 끝자리 → yī
 *       예외(yī 유지): 一가 **끝음절인 어휘**(第一·周一·之一·万一·统一·唯一·初一·同一·如一·十一),
 *       숫자 나열(一九九八), 관용구 数一数二. 이 목록은 콘텐츠 표제어 전수에서 뽑았다.
 *   不  뒤 4성 → bú · 그 밖 → bù · A不A(앞뒤 음절이 성조까지 같음)와 가능보어는 경성 유지
 *   个  수사·지시사 뒤(양사 자리) → 경성 ge · 그 밖 → gè
 *       예외(gè 유지): 个子·个体·个性·个别·整个·各个·个人(양사 자리가 아닐 때)
 *
 * 손대지 않는 것: 이미 경성으로 적힌 一·不(V一V·가능보어), 음절 정렬이 안 되는 줄(儿화 등).
 */
const HAN = /[一-鿿]/;
const V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const TONE = { ā:1,á:2,ǎ:3,à:4, ē:1,é:2,ě:3,è:4, ī:1,í:2,ǐ:3,ì:4, ō:1,ó:2,ǒ:3,ò:4, ū:1,ú:2,ǔ:3,ù:4, ǖ:1,ǘ:2,ǚ:3,ǜ:4 };
const BARE = {ā:'a',á:'a',ǎ:'a',à:'a',ē:'e',é:'e',ě:'e',è:'e',ī:'i',í:'i',ǐ:'i',ì:'i',ō:'o',ó:'o',ǒ:'o',ò:'o',ū:'u',ú:'u',ǔ:'u',ù:'u',ǖ:'ü',ǘ:'ü',ǚ:'ü',ǜ:'ü'};
const toneOf = (s) => { for (const c of s) if (TONE[c]) return TONE[c]; return 0; };
const bare = (s) => [...s].map((c) => BARE[c] ?? c).join('').toLowerCase();

export function syllabify(w) {
  const out = []; let i = 0; const n = w.length;
  while (i < n) {
    let j = i; while (j < n && !V.includes(w[j])) j++;
    let k = j; while (k < n && V.includes(w[k])) k++;
    let c = k;
    if (c < n && w[c] === 'n') {
      if (c + 1 < n && w[c + 1] === 'g' && (c + 2 >= n || !V.includes(w[c + 2]))) c += 2;
      else if (c + 1 >= n || !V.includes(w[c + 1])) c += 1;
    } else if (c < n && w[c] === 'r' && (c + 1 >= n || !V.includes(w[c + 1]))) c += 1;
    if (k === j) break;
    out.push(w.slice(i, c)); i = c;
  }
  return out;
}

const FORM = { yi: { 1:'yī', 2:'yí', 4:'yì' }, bu: { 0:'bu', 2:'bú', 4:'bù' }, ge: { 0:'ge', 4:'gè' } };
const DIGIT = new Set([...'零一二三四五六七八九']);
const CLS_PREV = new Set([...'一二三四五六七八九十两几半百千万零每这那哪某多']);
const GE_WORD_NEXT = new Set(['子', '体', '性', '别']);
const GE_WORD_PREV = new Set(['整', '各']);
const YI_KEEP_PREV = new Set(['第', '周', '之', '万', '统', '十', '唯', '单', '专', '归', '初', '同', '如']);
const YI_SANDHI_CTX = new Set(['周一片', '之一切']);   // 앞 글자가 다른 단어인 자리(四周|一片·总之|一切)
const YI_KEEP_CTX = new Set(['数一数']);              // 数一数二

/** i번째 글자의 규범 표기. null이면 규칙 밖(손대지 않는다). */
export function sandhiTarget(chars, syls, i) {
  const c = chars[i], cur = syls[i], prev = chars[i - 1] ?? null, next = chars[i + 1] ?? null;
  const nt = syls[i + 1] != null ? toneOf(syls[i + 1]) : null;
  const b = bare(cur);
  const cap = (t) => (cur[0] === cur[0].toUpperCase() && cur[0] !== cur[0].toLowerCase()) ? t[0].toUpperCase() + t.slice(1) : t;
  if (c === '个' && b === 'ge') {
    const classifier = prev != null && CLS_PREV.has(prev);
    if (!classifier && next && GE_WORD_NEXT.has(next)) return cap(FORM.ge[4]);
    if (prev && GE_WORD_PREV.has(prev)) return cap(FORM.ge[4]);
    if (!classifier && next === '人') return cap(FORM.ge[4]);
    return cap(FORM.ge[0]);
  }
  if (c === '不' && b === 'bu') {
    if (toneOf(cur) === 0) return null;
    if (prev && next && prev === next && syls[i - 1] === syls[i + 1]) return cap(FORM.bu[0]);
    if (nt === null) return cap(FORM.bu[4]);
    return cap(nt === 4 ? FORM.bu[2] : FORM.bu[4]);
  }
  if (c === '一' && b === 'yi') {
    if (toneOf(cur) === 0) return null;
    const ctx = `${prev ?? ''}一${next ?? ''}`;
    if (YI_KEEP_CTX.has(ctx)) return cap(FORM.yi[1]);
    if (prev && YI_KEEP_PREV.has(prev) && !YI_SANDHI_CTX.has(ctx)) return cap(FORM.yi[1]);
    if (prev === '月' && (next === '号' || next === '日')) return cap(FORM.yi[1]);
    if (next && DIGIT.has(next)) return cap(FORM.yi[1]);
    if (nt === null) return cap(FORM.yi[1]);
    return cap(nt === 4 || nt === 0 ? FORM.yi[2] : FORM.yi[4]);
  }
  return null;
}

const PUNCT_L = /^[^A-Za-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*/i;
const PUNCT_R = /[^A-Za-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*$/i;

/**
 * 한 쌍의 위반 목록. 정렬 불가(儿화·라틴 혼용 등)면 빈 배열 — 음절 수 검사는 (h) 게이트의 몫이다.
 */
export function sandhiViolations(zh, py) {
  if (/[A-Za-z]/.test(zh)) return [];
  const chars = [...zh].filter((c) => HAN.test(c));
  const syls = [];
  for (const part of py.split(/\s+/)) {
    if (!part) continue;
    const lead = part.match(PUNCT_L)[0];
    const tail = part.slice(lead.length).match(PUNCT_R)[0];
    const core = part.slice(lead.length, part.length - tail.length);
    const sy = syllabify(core);
    if (sy.join('') !== core) return [];
    syls.push(...sy);
  }
  if (syls.length !== chars.length) return [];
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const t = sandhiTarget(chars, syls, i);
    if (t != null && t !== syls[i]) out.push({ i, char: chars[i], from: syls[i], to: t });
  }
  return out;
}
