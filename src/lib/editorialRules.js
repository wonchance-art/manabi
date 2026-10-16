// EDIT-STD-001 · EDIT-STD-002 — 매거진 『となり』 기사 본문의 문체 규칙 정본.
// 근거: docs/japanology/magazine/report-editorial-craft.md §3.1(규칙 10·11·12·13·16·17·18 S1·23·26), §3.4.
// /magazine-edit 퇴고 단계와 계약 테스트(src/lib/__tests__/editorialStandard.test.js)가 이 파일 하나만 본다.
// 목록을 다른 곳에 다시 적지 않는다(이중 진실 방지).
//
// 범위 밖(후속 계약): 규칙 15('의' 연쇄)·21(구어 군말)·18 S2(빈도 임계)·19·20(EDIT-STD-003)·25(원어 병기 첫 1회).
// 임계값 70자·쉼표 2개는 보고서의 제안치다 — 첫 2개 호 원고 분포를 잰 뒤 확정한다.
// 규칙은 화면 문구(copy-standard.md)가 아니라 기사 본문에만 쓴다.

const freezeRules = (rules) => Object.freeze(rules.map(r => Object.freeze(r)));

// 본문 문장 길이 상한(규칙 12)과 한 문장의 쉼표 상한(규칙 13).
export const MAX_SENTENCE_CHARS = 70;
export const MAX_COMMAS = 2;

// 꼭지별 문체 선언(§3.1.1). 지금은 값 검증만 한다 — 종결 사전은 두 문체의 합집합으로 본다.
// 해요체 글에 섞여 든 「해야 한다」도 설교이기 때문이다. 종결어미 일치(규칙 19)는 EDIT-STD-003 몫.
export const REGISTERS = Object.freeze(['haera', 'haeyo']);

// 규칙 10 — 리드 상투형. 리드 위치를 따로 알 수 없으므로 본문 전체에서 금지한다.
export const BANNED_LEAD_PATTERNS = freezeRules([
  { form: '~에 대해 알아보자', re: /에\s?대해(서)?\s?알아보/ },
  { form: '여러분은 ~을 아시나요?', re: /여러분.*아시나요/ },
  { form: '~라는 말이 있다', re: /라는\s?말이\s?있/ },
]);

// 규칙 11 — 상투구·과장어.
export const CLICHES = freezeRules([
  { form: '그야말로', re: /그야말로/ },
  { form: '말 그대로', re: /말\s?그대로/ },
  { form: '힐링', re: /힐링/ },
  { form: '최고의', re: /최고의/ },
  { form: '완벽한', re: /완벽한/ },
  { form: '반드시', re: /반드시/ },
  { form: '모든 일본인이', re: /모든\s?일본(인|\s?사람)/ },
]);

// 규칙 16 — 약한 표현. 인용 발화 안은 lintEditorial이 가린다.
export const WEAK_PHRASES = freezeRules([
  { form: '~것 같다', re: /것\s?같(다|아|습니다|네)/ },
  { form: '~라고 할 수 있다', re: /라고\s?할\s?수\s?있/ },
  { form: '~지 않을까', re: /지\s?않을까/ },
  { form: '아마도', re: /아마도/ },
]);

// 규칙 17 — 장황 표현·번역투. 「~에 대해」「~을 통해」는 보고서 18 S2에도 있지만 여기서는 1회도 쓰지 않는다.
export const REDUNDANT_PHRASES = freezeRules([
  { form: '~에 대해', re: /에\s?대(해|하여)/ },
  { form: '~을 통해', re: /을\s?통(해|하여)/ },
  { form: '~를 통해', re: /를\s?통(해|하여)/ },
  { form: '~에 있어서', re: /에\s?있어서/ },
  { form: '~하는 것이 가능하다', re: /는\s?것이\s?가능(하|해|합)/ },
  { form: '~을 진행하다', re: /[을를]\s?진행(하|해|했|합)/ },
  { form: '~적인 부분', re: /적인\s?부분/ },
]);

// 규칙 18 S1 — 어휘로 잡히는 AI 구조 신호(1회라도 제거). 결산 피벗·의인화 주어·볼드 라벨 목록·문장 중간 콜론은 사람 검수.
// end: true는 문장 끝(종결)에서만 본다.
export const AI_SIGNALS_S1 = freezeRules([
  { form: '시사하는 바가 크다', re: /시사하는\s?바가\s?크/ },
  { form: '~할 때다', re: /\s때(다|이다|예요|이에요|입니다)$/, end: true },
  { form: '새 지평', re: /새\s?지평/ },
  { form: '이정표', re: /이정표/ },
  { form: '전문가들은', re: /전문가들은/ },
]);

// 규칙 23 — 설교·설득 종결. 문장 끝에서만 본다(「해야 한다는 생각」 같은 문장 중간은 통과).
// 「~하자」는 명사(남자·의자·글자)와 겹치므로 청유형 어간을 적어 둔 것만 잡는다.
// 「~ㅂ시다」는 받침 ㅂ 음절 + 시다(합시다·떠납시다·읽읍시다). 해요체 청유 「~해요」는 평서와 같은 꼴이라 사람 검수.
const FINAL_BIEUP = Array.from({ length: 399 }, (_, i) => String.fromCharCode(0xac00 + i * 28 + 17)).join('');
export const PREACHY_ENDINGS = freezeRules([
  { form: '~해야 한다', re: /야\s?(한다|합니다|해요)$/, end: true },
  { form: '~하자', re: /(하|보|가|말|두|읽|듣|쓰|살|먹|걷|찾|떠나|만나|나누|지키)자$/, end: true },
  { form: '~합시다', re: new RegExp(`[${FINAL_BIEUP}]시다$`), end: true },
]);

// 규칙 26 — 일본어 고유명사의 한글 표기(prh 사전 형식). 장음 미표기 · 쟈·죠 계열 금지 · 된소리 금지 · つ→쓰.
// specs는 사전 자체의 자기 검증용이다: from이 patterns 중 하나에 걸리고, 바꾸면 to가 된다.
export const SPELLING_DICTIONARY = Object.freeze([
  { expected: '부카쓰', patterns: [/부카츠/], specs: [{ from: '부카츠(部活)', to: '부카쓰(部活)' }] },
  { expected: '조나이카이', patterns: [/초나이카이/], specs: [{ from: '초나이카이에 가입한다', to: '조나이카이에 가입한다' }] },
  { expected: '게이고', patterns: [/케이고/], specs: [{ from: '케이고(敬語)', to: '게이고(敬語)' }] },
  { expected: '도쿄', patterns: [/토쿄/, /도오쿄/], specs: [{ from: '토쿄의 아침', to: '도쿄의 아침' }, { from: '도오쿄역', to: '도쿄역' }] },
  { expected: '교토', patterns: [/쿄토/], specs: [{ from: '쿄토 사람', to: '교토 사람' }] },
  { expected: '홋카이도', patterns: [/홋까이도/, /훗카이도/], specs: [{ from: '홋까이도의 겨울', to: '홋카이도의 겨울' }, { from: '훗카이도', to: '홋카이도' }] },
  { expected: '오사카', patterns: [/오오사카/], specs: [{ from: '오오사카 사투리', to: '오사카 사투리' }] },
  { expected: '마쓰리', patterns: [/마츠리/], specs: [{ from: '여름 마츠리', to: '여름 마쓰리' }] },
  { expected: '쓰나미', patterns: [/츠나미/], specs: [{ from: '츠나미 경보', to: '쓰나미 경보' }] },
  { expected: '규슈', patterns: [/큐슈/, /규우슈/], specs: [{ from: '큐슈 여행', to: '규슈 여행' }, { from: '규우슈', to: '규슈' }] },
  { expected: '신주쿠', patterns: [/신쥬쿠/], specs: [{ from: '신쥬쿠역', to: '신주쿠역' }] },
].map(entry => Object.freeze({ ...entry, patterns: Object.freeze(entry.patterns), specs: freezeRules(entry.specs) })));

// 규칙 26 — 사전에 없는 이름도 잡는 일반 검사: ㅈ·ㅉ·ㅊ + ㅑ·ㅠ, ㅉ·ㅊ + ㅛ 음절(쟈·쥬·챠·츄·쵸 계열).
// ㅈ + ㅛ(죠)는 해요체 축약 「그렇죠」「하죠」(지요)와 겹쳐 뺀다. 예외(오너 결정 2026-10-14): ちゃん → 쨩, さん → 상.
export const PALATAL_EXCEPTIONS = Object.freeze(['쨩']);
const HANGUL_BASE = 0xac00;
const isBannedPalatal = (ch) => {
  const code = ch.codePointAt(0) - HANGUL_BASE;
  if (code < 0 || code > 11171 || PALATAL_EXCEPTIONS.includes(ch)) return false;
  const initial = Math.floor(code / 588);       // ㅈ 12 · ㅉ 13 · ㅊ 14
  const vowel = Math.floor((code % 588) / 28);  // ㅑ 2 · ㅛ 12 · ㅠ 17
  if (initial < 12 || initial > 14) return false;
  return vowel === 2 || vowel === 17 || (vowel === 12 && initial !== 12);
};

// 「」·『』·""·“” 안은 인용이므로 검사하지 않는다. 내용을 같은 길이의 ○로 가려 위치를 보존한다(개행은 유지).
const QUOTE_SPANS = [/「[^「」]*」/g, /『[^『』]*』/g, /"[^"]*"/g, /“[^“”]*”/g];
export function maskQuotes(text) {
  return QUOTE_SPANS.reduce((acc, re) => acc.replace(re, (m) => m[0] + m.slice(1, -1).replace(/[^\n]/g, '○') + m[m.length - 1]), text);
}

// 마크다운 판면 기호를 걷어 낸 본문 줄. 제목·표·구분선·코드 블록 줄은 빈 줄로 바꾼다(줄 수 유지).
function cleanMarkdown(text) {
  let fenced = false;
  return text.split('\n').map((line) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return ''; }
    if (fenced) return '';
    if (/^\s*#{1,6}\s/.test(line) || /^\s*\|/.test(line) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return '';
    return line
      .replace(/^\s*(>\s?)+/, '')
      .replace(/^\s*(\d+\.|[-*+])\s+/, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__|\*|`/g, '');
  }).join('\n');
}

// 문장 경계: 마침표(숫자 사이 소수점 제외)·물음표·느낌표·일본어 구두점·개행. 인용을 가린 뒤에 자르므로 인용 안의 ?는 경계가 아니다.
const BOUNDARY = /(?<!\d)\.(?!\d)|[?!。？！\n]/g;
const TRAILING = /[\s)\]」』"”'’○]+$/;

export function splitSentences(text) {
  const plain = cleanMarkdown(text);
  const masked = maskQuotes(plain);
  const out = [];
  let start = 0;
  const push = (end) => {
    const original = plain.slice(start, end).trim();
    if (/[\p{L}\p{N}]/u.test(original)) out.push({ original, masked: masked.slice(start, end).trim() });
  };
  for (const m of masked.matchAll(BOUNDARY)) { push(m.index); start = m.index + m[0].length; }
  push(masked.length);
  return out;
}

const EXCERPT_CHARS = 80;
const excerptOf = (s) => (Array.from(s).length > EXCERPT_CHARS ? Array.from(s).slice(0, EXCERPT_CHARS).join('') + '…' : s);

const LEXICON = [
  ['R10', BANNED_LEAD_PATTERNS],
  ['R11', CLICHES],
  ['R16', WEAK_PHRASES],
  ['R17', REDUNDANT_PHRASES],
  ['R18-S1', AI_SIGNALS_S1],
  ['R23', PREACHY_ENDINGS],
];

/**
 * 기사 본문(마크다운 허용)의 문체 위반 목록. 순수 함수 — 파일·네트워크를 읽지 않는다.
 * @param {string} text
 * @param {{ register?: 'haera'|'haeyo' }} [options]
 * @returns {{ rule: string, form: string, excerpt: string }[]}
 */
export function lintEditorial(text, { register } = {}) {
  if (register !== undefined && !REGISTERS.includes(register)) throw new Error(`알 수 없는 문체: ${register}`);
  const found = [];
  const add = (rule, form, sentence) => found.push({ rule, form, excerpt: excerptOf(sentence.original) });
  for (const sentence of splitSentences(String(text ?? ''))) {
    const { original, masked } = sentence;
    const length = Array.from(original).length;
    if (length > MAX_SENTENCE_CHARS) add('R12', `${length}자 > ${MAX_SENTENCE_CHARS}자`, sentence);
    // 숫자 자릿점(2,847)은 쉼표가 아니다 — 숫자 사이의 쉼표는 세지 않는다.
    const commas = (masked.match(/(?<!\d),|,(?!\d)|[，、]/g) || []).length;
    if (commas > MAX_COMMAS) add('R13', `쉼표 ${commas}개 > ${MAX_COMMAS}개`, sentence);
    const ending = masked.replace(TRAILING, '');
    for (const [rule, list] of LEXICON) {
      for (const { form, re, end } of list) if (re.test(end ? ending : masked)) add(rule, form, sentence);
    }
    for (const { expected, patterns } of SPELLING_DICTIONARY) {
      for (const re of patterns) { const m = masked.match(re); if (m) add('R26', `${m[0]}→${expected}`, sentence); }
    }
    const palatal = Array.from(masked).filter(isBannedPalatal);
    if (palatal.length) add('R26', `${[...new Set(palatal)].join('·')} 계열 표기`, sentence);
  }
  return found;
}
