#!/usr/bin/env node
/**
 * 독해 트랙 결정적 검증기 — 기획 docs/plan-reading-track-pilot.md §6(P3) 항목을 코드로 고정한다.
 * 대상: src/content/japanese/reading/n5_tokyo.js — 콘텐츠 입고 완료가 전제.
 *       부재 시 "생략 exit 0"이 아니라 오류 exit 1 — 파일이 사라진 채 빌드가 통과하는 구멍을 막는다(P1-3).
 *
 * 실행:
 *   node scripts/check-reading.mjs             트랙 파일 검증(없으면 오류)
 *   node scripts/check-reading.mjs --self-test 내장 픽스처 36종 자가 검출 테스트
 *
 * 검사 항목(코드):
 *   G1  전 글 newPatterns ∪ 전 드릴 patterns = bunkei N5 pattern 125 전수·중복 0·부재 0
 *   UNI patternUniverse가 정확히 125개(표 2 전제) — 어긋나면 전수 검사 자체가 무의미(P2-11)
 *   CAP 여행 코어(n5_travel_core) 단어 수 ≤40 하드 캡(P2-11)
 *   ORD 글 order 오름차순·중복 없음(i+1 도입 순서)
 *   G4  신규 문형이 그 글 본문에 형태소(토큰 시퀀스) 매칭(P1-1·P1-2·P1-3): 플레이스홀더(A·B·한글)를
 *       슬롯 치환 후 리터럴 조각을 본문 kuromoji 토큰 런에 정렬 매칭(면제 0). 조각은 표면형 정확 일치를
 *       요구하되 양끝 토큰 경계를 존중(まだ의 だ·そして의 そし류 중간 매칭 소멸), 마지막 토큰이 활용어면
 *       기본형 완화(します↔しました), 가나 별칭(何↔なん)은 max. alt 내 전 조각 AND(たり×2·から·まで 각각),
 *       alt 간(これ/それ/あれ)은 합산. 〜だ는 POS로 계수(助動詞·종지형 だ ≥2 — まだ·だろ·だっ 제외).
 *       'い형용사+명사'는 리터럴 부재 → 형태소 인접(形容詞자립·い활용 + 名詞) ≥2회로 검사.
 *   G5  본문 내용어(명사·동사·형용사·부사) 기본형이 어휘 풀 ∪ 지명에 존재
 *   G6  본문 yomi 정렬(check-furigana spawn) + 지명 요미 대조(P2-10: ja·yomi 동시 마스킹·출현 횟수 대응)
 *       + 금지 요미(과거 실제 오독) 블랙리스트 대조(보조)
 *   YLOCK 문장 단위 요미 락(yomi-lock.json) 대조 — 주 게이트(P1-1·P1-2·P2-5). 전 body 문장을 같은
 *       정규화(normLock)로 락과 대조: 락 미등재/수정 = 오류(재생성+검수 강제)·ja 같은데 yomi 불일치 = 오류·
 *       락에 있는데 사라진 문장 = 오류(P3-7 승격: 삭제도 락 재생성+검수 강제)·KO_MIXED(한글 섞임) = 오류.
 *       문장 전체를 박으므로 가나-온리 무검사·
 *       오쿠리가나 오독(来ます→くます)·정렬 아티팩트 오염(建物→たても)이 한 번에 소멸한다.
 *   G7  기대 독음 사전(yomi-map.json) 대조 — 보조 진단(강등). YLOCK이 주 게이트이므로 G7 불일치는
 *       경고. 신규 문장 초안 작성 시 한자별 허용 독음 참고용으로만 유지한다(완전 삭제 금지).
 *   ID  전 문항·드릴 item의 id 존재 + 트랙 전체 유일 + 형식 검사(P3-11). 누락·중복·형식 위반 = 오류. 신유형(order·fill·produce)도 대상.
 *   Q   문항 스키마(신유형 order/fill/produce 포함, P4). pattern: 정답 유효·choices 4개·choices 내 중복 = 오류(P2-10,
 *       type:'pattern'에만 적용). content: 정답 유효(choices 개수·중복 검사는 면제). order: tiles 비어있지 않음·
 *       tiles/answer 각 원소가 비어있지 않은 문자열(비문자열·빈 문자열 = 오류, P2-4)·answer가 tiles의 순열(멀티셋)·
 *       answer.join이 자연 문장(공백 제거 시 일본어)·pattern이 그 글 newPatterns에 존재·ko/why 존재. fill: ja에
 *       ［　］ 정확히 1개·answer 비어있지 않음·accept는 배열(있으면)이고 각 원소도 answer와 동일 규칙(비문자열·
 *       빈 값 = 오류, P2-4)으로 유효·치환 후 문장이 일본어·pattern이 그 글 newPatterns에 존재. produce: prompt·
 *       model(≥1)·guide 존재(비게이트).
 *       Q-cover: 게이트 문항(pattern|order|fill) ≥1로 신규 문형 전수 커버 — produce·content는 커버 불인정.
 *       Q-style(오너 지시, P3-7 확장): 게이트 문항 q에 회상형 지시("본문에서/을/을 보고/에 나온/의 문장" 등,
 *       공백·줄바꿈 변형 포함 정규식 매칭) = 오류(정해진 글 회상형 발문 금지, content는 예외). "본문" 단어
 *       자체가 아니라 이 회상 지시 패턴만 차단한다.
 *   FR  〜ました 도입 order 이전 글에 frame:'narration' 금지
 *   DR  drills[].patterns = 표 2 D군 13개 일치·style·afterOrder가 실존 글 order·items ≥1
 *       ·각 item의 q/choices(4)/answer 유효 ·drills[].patterns 전 문형이 items[].pattern으로 ≥1 커버(P1-5)
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { getTokenizer } = require('./reading/derive-yomi.cjs');
const { extractReadings, normLock } = require('./reading/align-furigana.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TRACK_REL = 'src/content/japanese/reading/n5_tokyo.js';
const TRACK_ABS = path.join(ROOT, TRACK_REL);
const BUNKEI_REL = '../src/content/japanese/bunkei/n5.js';

// ── 표 2 D군 13문형(드릴 필요) — bunkei pattern 문자열 정확 일치 ──
const DGROUP = [
  '〜は', '〜を', '〜に', '〜へ',           // 조사 발음·최소쌍 4
  '〜ね', '〜よ', '〜でしょう',             // 문말 뉘앙스 3
  '〜つ', '〜人(にん)', '〜枚(まい)', '〜本(ほん)', '〜匹(ひき)', '〜冊(さつ)', // 조수사 6
];

// ── 표 1-P 지명 요미 정답 사전(14) — kuromoji 오독 방어용 이중 고정 ──
const PLACE_YOMI = {
  '羽田空港': 'はねだくうこう', '東京': 'とうきょう', '東京駅': 'とうきょうえき',
  '渋谷': 'しぶや', '浅草': 'あさくさ', '浅草寺': 'せんそうじ', '雷門': 'かみなりもん',
  '仲見世': 'なかみせ', '上野': 'うえの', '上野公園': 'うえのこうえん', '原宿': 'はらじゅく',
  '新宿': 'しんじゅく', '山手線': 'やまのてせん', '日本': 'にほん',
};

// ── 금지 요미 블랙리스트(P1-5 재발 방지) — 전부 "실제로 냈거나 낼 뻔한" kuromoji류 오독의 고정 목록 ──
// yomi 파생이 형태소를 잘못 쪼개면 훈독·음독이 뒤섞인 가짜 독음이 나온다. 한 번 검출된 사고 유형은
// 블랙리스트로 박제해 같은 오독이 어느 글에서든 다시 통과하지 못하게 한다(본문 yomi 전수 대조).
const BANNED_YOMI = [
  'ときあいだ', // 時間 오독(정: じかん) — 時+間 분해 훈독 연결, 실제 5곳 유출 전력
  'なにつき',   // 何月 오독(정: なんがつ)
  'じゅうにち', // 十日 오독(정: とおか) — 날짜 문맥 음독 직결
  'きゅうじ',   // 九時 오독(정: くじ)
  'さんひゃく', // 三百 오독(정: さんびゃく — 연탁 누락)
  'さんせん',   // 三千 오독(정: さんぜん — 연탁 누락)
  'つぎのにち', // 次の日 오독(정: つぎのひ)
];

const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '副詞']);

// ── 유틸 ──
function kataToHira(s) {
  return String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
/** 표제어 정규화 — 접미 마커·공백·괄호 제거, 복수 표기 첫 형태(index.js _normJa와 동종) */
function normJa(ja) {
  let s = String(ja || '').trim().split(/[;；／、]/)[0].trim();
  return s.replace(/[（(][^）)]*[）)]/g, '').replace(/[～〜~]/g, '').replace(/\s+/g, '');
}
/** 최상위 대안 분리 — /／・、 로 자르되 괄호 안(何(なん/なに)의 /)은 자르지 않는다. */
function splitTopLevel(s) {
  const out = [];
  let cur = '', depth = 0;
  for (const ch of s) {
    if (ch === '（' || ch === '(') { depth++; cur += ch; }
    else if (ch === '）' || ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (depth === 0 && /[/／・、]/.test(ch)) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

// ── G4 v3: 형태소(토큰) 시퀀스 매칭 헬퍼(P1-1·P1-2·P1-3) ──
// 문형 조각은 kuromoji로 안정적으로 단독 토큰화되지 않는다(문맥 의존: 'では'가 단독으로는 접속사,
// 'いつ'가 'い+つ'로 쪼개짐). 그래서 조각을 토큰화하지 않고 조각 문자열을 본문 토큰 런에 정렬 매칭한다:
// 표면형 연결이 조각과 정확히 일치(양끝 토큰 경계 정렬)하거나, 마지막 토큰이 활용어(動詞·形容詞·助動詞)
// 면 기본형으로 완화(します↔しました)하거나, 요미(가나) 연결이 일치(何↔なん 별칭)하면 1회로 센다.
// 좌·우 모두 토큰 경계를 존중하므로 だ(まだ의 토큰 중간 시작)·そし(そして의 토큰 중간 종료)류
// 오계상이 원리적으로 소멸한다. 글자 whitelist(CONJ_END slice) 폐기.
const G4_CONJ_POS = new Set(['動詞', '形容詞', '助動詞']);
const placeholderSub = (p) => String(p).replace(/[A-Za-z]+/g, '〜').replace(/[가-힣]+/g, '〜');

/**
 * 문형 alt → 필수 조각 배열(AND). 각 조각 {surface, readings[]}.
 *   - 슬롯(〜)·공백·+ 를 경계로 리터럴 조각 분해. 같은 조각이 n회면 배열에 n개(たり×2) → 본문 ≥n회 요구.
 *   - 괄호 독음(何(なん/なに), 上(うえ))은 직전 조각의 별칭 → 카운트 max(이중 계상 차단).
 */
function parseAlt(alt) {
  const frags = [];
  let pending = [];
  const units = alt.match(/（[^）]*）|\([^)]*\)|[^（(]+/g) || [];
  for (const u of units) {
    if (/^[（(]/.test(u)) {
      const inner = u.slice(1, -1);
      const rs = inner.split(/[/／・]/).map((s) => s.replace(/[\s　〜～~＋+]/g, ''))
        .filter((s) => s && /[぀-ヿ一-龯]/.test(s) && !/[가-힣A-Za-z]/.test(s));
      if (frags.length) frags[frags.length - 1].readings.push(...rs); else pending.push(...rs);
    } else {
      const parts = u.split(/[～〜~＋+\s　]/).map((s) => s.trim())
        .filter((s) => s && /[぀-ヿ一-龯]/.test(s) && !/[가-힣A-Za-z]/.test(s));
      for (const p of parts) { const f = { surface: p, readings: [] }; if (pending.length) { f.readings.push(...pending); pending = []; } frags.push(f); }
    }
  }
  if (pending.length && frags.length) frags[0].readings.push(...pending);
  // 구어 별칭 — 오너 정책 "현지 쓰는 말 최우선": 문형 표제는 표준 인용형(では)을 유지하되
  // 본문은 회화체(じゃ)로 쓴다. では 조각은 じゃ 출현도 같은 조각으로 인정(그룹 내 별칭·max).
  for (const f of frags) if (f.surface === 'では') f.readings.push('じゃ');
  return frags;
}

/** 문형 pattern → alt별 필수 조각 배열. splitTopLevel(/／・、)로 나눈 대안은 그룹 간 합산. */
function patternAlts(pattern) {
  return splitTopLevel(placeholderSub(pattern)).map(parseAlt).filter((a) => a.length);
}

/** 본문 토큰 정규화 — 공백 토큰 제거, 표면형·기본형·품사·요미(히라) 보존. */
function toBodyTokens(tokenizer, ja) {
  return tokenizer.tokenize(ja).filter((t) => t.pos_detail_1 !== '空白').map((t) => ({
    surface: t.surface_form,
    base: t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form,
    pos: t.pos,
    read: t.reading && t.reading !== '*' ? kataToHira(t.reading) : t.surface_form,
  }));
}

/**
 * い형용사 활용 어미(古い→古く, 広い→広かっ) 노출 — kuromoji가 어간+어미를 한 형용사 토큰으로 융합하므로
 * 〜くて·〜かったです 조각이 토큰 경계에서 시작하지 못한다. 어미 꼬리를 드러내 활용 경계에 정렬시킨다.
 */
function adjInfl(t) {
  if (t.pos !== '形容詞' || !/い$/.test(t.base) || t.surface === t.base) return '';
  const stem = t.base.slice(0, -1);
  if (stem && t.surface.startsWith(stem) && t.surface.length > stem.length) return t.surface.slice(stem.length);
  return '';
}

/** 조각 문자열을 본문 토큰(bts) i부터 정렬 매칭. 소비한 토큰 수 반환(0=불일치). useInfl: 형용사 어미 경계 시작 허용. */
function matchFragAt(bts, i, frag, useInfl) {
  let surf = '', read = '';
  for (let j = i; j < bts.length; j++) {
    const t = bts[j];
    let s = t.surface, r = t.read;
    if (useInfl && j === i) { const inf = adjInfl(t); if (!inf) return 0; s = inf; r = inf; }
    surf += s; read += r;
    if (surf === frag) return j - i + 1;                                  // 표면형 정확 일치(양끝 경계)
    if (read === frag) return j - i + 1;                                  // 요미(가나) 별칭 일치
    if (G4_CONJ_POS.has(t.pos)) {                                         // 마지막 토큰 활용어 → 기본형 완화
      const prefix = surf.slice(0, surf.length - s.length);
      if (prefix + t.base === frag) return j - i + 1;
    }
    if (!frag.startsWith(surf) && !frag.startsWith(read)) return 0;       // 더 이상 접두가 아니면 중단
  }
  return 0;
}

/** 한 문장 토큰에서 조각 비중첩 출현 횟수. */
function countFrag(bts, frag) {
  let c = 0, i = 0;
  while (i < bts.length) {
    const used = matchFragAt(bts, i, frag, false) || matchFragAt(bts, i, frag, true);
    if (used > 0) { c++; i += used; } else i++;
  }
  return c;
}
/** 전 문장에서 조각(별칭 포함) 출현 횟수 — 별칭은 max(그룹 내 이중 계상 차단). */
function aliasCount(sentToks, aliases) {
  let best = 0;
  for (const a of aliases) { let c = 0; for (const bts of sentToks) c += countFrag(bts, a); if (c > best) best = c; }
  return best;
}

/** 'い형용사 + 명사' 류 — 리터럴 부재로 형태소 인접 검사가 필요한 문형(P1-2). */
function isIAdjNounPattern(p) {
  const s = String(p).trim();
  return /형용사/.test(s) && /명사/.test(s) && /^い/.test(s) && !/です/.test(s);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
function simRatio(a, b) {
  const L = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / L;
}

// ── 신유형(order/fill/produce) 검증 헬퍼(P4 확장) ──
/** 배열 두 개가 멀티셋으로 동일한지(순서 무관, 중복 개수 일치) — order 문항 answer가 tiles의 순열인지 검증. */
function isMultisetEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const count = new Map();
  for (const x of a) count.set(x, (count.get(x) || 0) + 1);
  for (const x of b) {
    const c = count.get(x) || 0;
    if (c <= 0) return false;
    count.set(x, c - 1);
  }
  return true;
}
/** 공백 제거 후 순 일본어 문자열인지(한글 섞임 없이 가나·한자 포함) — order/fill 신유형 자연문 간이 검사. */
function isJaText(s) {
  const stripped = String(s || '').replace(/[\s　]/g, '');
  if (!stripped) return false;
  if (/[가-힣]/.test(stripped)) return false;
  return /[぀-ヿ一-龯]/.test(stripped);
}
/** order|fill 게이트 문항 공용: pattern이 그 글 newPatterns에 존재(P4). */
function patternInText(t, p) {
  return !!p && (t.newPatterns || []).includes(p);
}

/**
 * 트랙 객체 결정적 검사. errors/warns를 코드와 함께 반환.
 * @param {object} track   트랙 데이터(texts[], drills[], places?[])
 * @param {object} ctx     { patternUniverse:Set, dgroup:string[], vocabPool:Set, placeYomi:object, tokenizer, skipFurigana }
 */
function runChecks(track, ctx) {
  const errors = [];
  const warns = [];
  const E = (code, msg) => errors.push({ code, msg });
  const W = (code, msg) => warns.push({ code, msg });

  const texts = Array.isArray(track?.texts) ? track.texts : [];
  const drills = Array.isArray(track?.drills) ? track.drills : [];

  // ── G1: 전수·중복·부재 ──
  const introduced = new Map(); // pattern → 도입처 목록(글/드릴)
  const addIntro = (p, where) => { if (!introduced.has(p)) introduced.set(p, []); introduced.get(p).push(where); };
  for (const t of texts) for (const p of (t.newPatterns || [])) addIntro(p, `글${t.order}`);
  for (let i = 0; i < drills.length; i++) for (const p of (drills[i].patterns || [])) addIntro(p, `드릴${i + 1}`);

  const union = new Set(introduced.keys());
  for (const [p, wheres] of introduced) {
    if (!ctx.patternUniverse.has(p)) E('G1-phantom', `bunkei 부재 문형 도입: ${p} (${wheres.join(',')})`);
    if (wheres.length > 1) E('G1-dup', `중복 도입: ${p} @ ${wheres.join(', ')}`);
  }
  const missing = [...ctx.patternUniverse].filter((p) => !union.has(p));
  if (missing.length) E('G1-missing', `미커버 문형 ${missing.length}개: ${missing.join(', ')}`);
  if (union.size !== ctx.patternUniverse.size)
    W('G1-count', `union ${union.size} ≠ universe ${ctx.patternUniverse.size}`);

  // ── ORD: order 오름차순·유일 ──
  const orders = texts.map((t) => t.order);
  for (let i = 1; i < orders.length; i++)
    if (!(orders[i] > orders[i - 1])) E('ORD', `order 비오름차순: ${orders[i - 1]} → ${orders[i]}`);
  if (new Set(orders).size !== orders.length) E('ORD', 'order 중복');

  // ── G4 v3: 신규 문형 본문 형태소 실재(토큰 시퀀스 매칭, P1-1·P1-2·P1-3) ──
  // 규칙(patternAlts/matchFragAt 참조):
  //   · 조각(surface)은 본문 토큰 런에 정렬 매칭 — 양끝 토큰 경계 존중, 활용어 꼬리는 기본형 완화, 가나 별칭 max.
  //   · alt 내 전 조각 AND: 패턴에 같은 조각 n회면 본문 ≥n회(たり×2). 〜から〜まで는 から·まで 각각 필수.
  //   · alt 간(これ/それ/あれ, 〜ても・〜なくても)은 합산 — 적어도 한 alt가 전 조각 충족(대표 조각 ≥1)이면 통과.
  //   · 〜だ: 문자열이 아니라 POS로 계수 — 助動詞·기본형 だ·표면형 だ(종지형) ≥2회. まだ(부사)·だろ·だっ 원리적 제외.
  //   · 'い형용사 + 명사': 리터럴 부재 → 形容詞(自立·い) + 直後 名詞 인접 ≥2회.
  if (ctx.tokenizer) for (const t of texts) {
    const sentToks = (t.body || []).filter((b) => b.ja).map((b) => toBodyTokens(ctx.tokenizer, b.ja));
    // alt(필수 조각 배열) 평가 → { allPresent, repCount, fails }
    const evalAlt = (frags) => {
      const byKey = new Map();  // surface → {reps, aliases:Set}
      for (const f of frags) {
        const e = byKey.get(f.surface) || { reps: 0, aliases: new Set([f.surface]) };
        e.reps++; for (const r of f.readings) e.aliases.add(r); byKey.set(f.surface, e);
      }
      let longestKey = null;
      for (const k of byKey.keys()) if (!longestKey || k.length > longestKey.length) longestKey = k;
      let allPresent = true, repCount = 0; const fails = [];
      for (const [k, e] of byKey) {
        const bc = aliasCount(sentToks, e.aliases);
        if (bc < e.reps) { allPresent = false; fails.push(`${k}=${bc}<${e.reps}`); }
        if (k === longestKey) repCount = bc;
      }
      return { allPresent, repCount, fails };
    };
    for (const p of (t.newPatterns || [])) {
      // 〜だ: copula를 POS로 계수(왼쪽 형태소 경계 무시하던 まだ 오계상 차단, P1-3)
      if (p === '〜だ') {
        let c = 0;
        for (const bts of sentToks) for (const tk of bts) if (tk.pos === '助動詞' && tk.base === 'だ' && tk.surface === 'だ') c++;
        if (c < 2) E('G4', `글${t.order} copula 〜だ ${c}회(<2): 종지형 だ 부족`);
        continue;
      }
      // 'い형용사 + 명사' — 형태소 인접(形容詞 자립·い활용 + 直後 名詞)
      if (isIAdjNounPattern(p)) {
        let adj = 0;
        for (const b of (t.body || [])) {
          if (!b.ja) continue;
          const toks = ctx.tokenizer.tokenize(b.ja).filter((tk) => tk.pos_detail_1 !== '空白');
          for (let i = 0; i < toks.length - 1; i++) {
            const a = toks[i], n = toks[i + 1];
            if (a.pos === '形容詞' && a.pos_detail_1 === '自立' && /い$/.test(a.surface_form) && n.pos === '名詞') adj++;
          }
        }
        if (adj < 2) E('G4', `글${t.order} 형용사(い)+명사 인접 ${adj}회(<2): ${p}`);
        continue;
      }
      const alts = patternAlts(p);
      if (!alts.length) { E('G4', `글${t.order} 검증 불가 문형(리터럴 부재): ${p}`); continue; } // 하드 게이트
      if (alts.length === 1) {
        const r = evalAlt(alts[0]);
        if (!r.allPresent) E('G4', `글${t.order} 신규 문형 본문 미실재: ${p} (${r.fails.join(' ')})`);
      } else {
        // 합산 대안 — 적어도 한 alt가 전 조각 충족
        let total = 0; const allFails = [];
        for (const alt of alts) { const r = evalAlt(alt); if (r.allPresent) total += r.repCount; else allFails.push(`[${r.fails.join(' ')}]`); }
        if (total < 1) E('G4', `글${t.order} 신규 문형 본문 미실재(대안 합산): ${p} (${allFails.join(' ')})`);
      }
    }
  }

  // ── G5: 내용어 커버리지(kuromoji) ──
  const placeJaSet = new Set(Object.keys(ctx.placeYomi));
  // setPhrases(선언된 통문장 예외 — いらっしゃいませ 등)가 데려오는 단어 면제
  const setPhraseText = texts.flatMap((t) => t.setPhrases || []).join('');
  // 문형 공급어 면제 — 문형 문자열(〜とき, ぜんぜん 〜ない 등)이 스스로 데려오는 단어는
  // 어휘 카드가 없어도 커버된 것으로 본다(도입 검증은 G1/G4가 담당).
  const patternWordSet = new Set();
  for (const p of ctx.patternUniverse) {
    for (const frag of String(p).replace(/[〜()（）・+]/g, ' ').split(/\s+/)) {
      const f = frag.trim();
      if (f && /[぀-ヿ一-龯]/.test(f)) patternWordSet.add(f);
    }
  }
  if (ctx.tokenizer) {
    const missWords = new Set();
    for (const t of texts) {
      for (const b of (t.body || [])) {
        if (!b.ja) continue;
        const toks = ctx.tokenizer.tokenize(b.ja);
        for (let i = 0; i < toks.length; i++) {
          const tok = toks[i];
          if (!CONTENT_POS.has(tok.pos)) continue;
          if (tok.pos_detail_1 === '数') continue; // 수사 면제
          const base = tok.basic_form && tok.basic_form !== '*' ? tok.basic_form : tok.surface_form;
          const surf = tok.surface_form;
          // 비 CJK 토큰(기호·숫자 파편) 면제
          if (!/[぀-ヿ一-龯]/.test(base) && !/[぀-ヿ一-龯]/.test(surf)) continue;
          // 고유명사(지명 등재분)·주인공 인명(kuromoji가 ミン+ジュン으로 쪼갬) 면제
          if (tok.pos_detail_1 === '固有名詞' && (placeJaSet.has(base) || placeJaSet.has(surf))) continue;
          if (surf === 'ミンジュン' || surf === 'ミン' || surf === 'ジュン') continue;
          // 수·조수사 복합(七月·四時半·三人 등) — 숫자+카운터 결합은 조수사·시간 문형이 공급
          if (/^[0-90-9一二三四五六七八九十百千]*[月日時分歳円人枚本匹冊回番]半?$/.test(surf)) continue;
          if ([...placeJaSet].some((pj) => pj.includes(surf) || surf.includes(pj))) {
            if (placeJaSet.has(base) || placeJaSet.has(surf)) continue;
          }
          const cand = [base, surf, normJa(base), normJa(surf)];
          if (cand.some((c) => ctx.vocabPool.has(c) || placeJaSet.has(c))) continue;
          // 문형 공급어 면제 — 한자 표기 토큰은 독음(reading)을 가나로 내려 대조(後で→あとで)
          if (patternWordSet.has(base) || patternWordSet.has(surf)) continue;
          const hira = tok.reading ? tok.reading.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)) : '';
          if (hira && (patternWordSet.has(hira) || ctx.vocabPool.has(hira))) continue;
          if ([...patternWordSet].some((w) => w.length >= 2 && (w.startsWith(surf) || w.startsWith(base) || (hira && w.startsWith(hira))))) continue;
          // 분리 토큰 결합 매칭 — kuromoji가 관용구·お접두를 쪼갠 경우(おねがい+し+ます,
          // お+土産)를 인접 표층형 결합으로 복원해 풀과 대조한다.
          const prev = i > 0 ? toks[i - 1].surface_form : '';
          const n1 = i + 1 < toks.length ? toks[i + 1].surface_form : '';
          const n2 = i + 2 < toks.length ? toks[i + 2].surface_form : '';
          const joins = [prev + surf, surf + n1, surf + n1 + n2, prev + surf + n1];
          if (joins.some((j) => j && (ctx.vocabPool.has(j) || ctx.vocabPool.has(normJa(j)) || placeJaSet.has(j)))) continue;
          // 미화 접두(お寺·ご飯) — 접두를 벗긴 형태가 풀에 있으면 커버
          if (/^[おご]./.test(surf) && (ctx.vocabPool.has(surf.slice(1)) || ctx.vocabPool.has(base.slice(1)))) continue;
          // 선언된 통문장 표현(setPhrases)의 구성어 면제
          if (surf.length >= 2 && setPhraseText.includes(surf)) continue;
          missWords.add(base);
        }
      }
    }
    if (missWords.size) E('G5', `풀 밖 내용어 ${missWords.size}개: ${[...missWords].join(', ')}`);
  }

  // ── G6(금지 요미): 과거 오독 블랙리스트가 본문 yomi에 재등장하면 즉시 오류(P1-5) ──
  // 공백 제거 후 대조 — 오독이 어절 경계에 걸쳐 표기될 수 있다(실사례: 次の日 → 'つぎの にち').
  for (const t of texts) {
    for (const b of (t.body || [])) {
      if (!b.yomi) continue;
      const yFlat = kataToHira(b.yomi).replace(/[\s　]/g, '');
      for (const bad of BANNED_YOMI)
        if (yFlat.includes(bad))
          E('G6-banned', `글${t.order} 금지 요미(오독) 검출: '${bad}' (yomi: ${b.yomi})`);
    }
  }

  // ── G6(지명 요미 대조, P2-10): 출현 횟수 대응 ──
  // 긴 지명부터 ja·yomi를 동시에 마스킹하며 소비한다. ja에 지명이 n회면 yomi에도 대응 요미가 n회
  // 독립적으로 있어야 한다. 東京駅から 東京へ에서 두 번째 東京의 오독이 東京駅의 とうきょうえき에
  // 가려지는 문제를 막는다(긴 지명이 자기 요미를 먼저 소비).
  const countOcc = (s, sub) => (sub ? s.split(sub).length - 1 : 0);
  for (const t of texts) {
    for (const b of (t.body || [])) {
      if (!b.ja) continue;
      const names = Object.keys(ctx.placeYomi).sort((a, c) => c.length - a.length);
      let jaR = b.ja;
      let yoR = kataToHira((b.yomi || '').replace(/[\s\u3000]/g, ''));
      for (const pja of names) {
        const n = countOcc(jaR, pja);
        if (!n) continue;
        jaR = jaR.split(pja).join('\uFFFF');
        const pyomi = kataToHira(ctx.placeYomi[pja]);
        let consumed = 0;
        for (let k = 0; k < n; k++) {
          const idx = yoR.indexOf(pyomi);
          if (idx === -1) break;
          yoR = yoR.slice(0, idx) + ' '.repeat(pyomi.length) + yoR.slice(idx + pyomi.length);
          consumed++;
        }
        if (consumed < n)
          E('G6-place', `글${t.order} 지명 요미 부족: ${pja} ja ${n}회·yomi ${consumed}회(정답 '${ctx.placeYomi[pja]}') (yomi: ${b.yomi || '(없음)'})`);
      }
    }
  }

  // ── YLOCK(문장 단위 요미 락, P1-1·P1-2·P2-5): 주 게이트 ──
  // 락은 신뢰본에서 같은 정규화로 생성(build-yomi-lock.mjs). 키 = 글 id + body 인덱스.
  // 전 body 문장(가나-온리 포함)을 락과 대조해 표면형 맵(G7)의 구조적 구멍 3종을 한 번에 막는다.
  //   ① 락 미등재/수정 문장 = 오류(신규·수정 문장은 락 재생성+검수 강제)
  //   ② ja는 같은데 yomi 불일치 = 오류(来ます→くます류 오쿠리가나 오독을 문장 단위로 포착)
  //   ③ 락에 있는데 콘텐츠에서 사라진 문장 = 경고
  //   · KO_MIXED(요미에 한글 섞임) = 오류(이 트랙에서 요미는 순 일본어 가나)
  if (ctx.yomiLock) {
    const seen = new Set();
    for (const t of texts) {
      const body = t.body || [];
      for (let i = 0; i < body.length; i++) {
        const b = body[i];
        if (!b.ja || !b.yomi) continue;
        const jaN = normLock(b.ja), yomiN = normLock(b.yomi);
        if (/[가-힣]/.test(jaN) || /[가-힣]/.test(yomiN)) {
          E('YLOCK-komixed', `글${t.order} KO_MIXED(요미에 한글 섞임): ${b.ja} / ${b.yomi}`);
          continue;
        }
        const key = `${t.id}#${i}`;
        seen.add(key);
        const lock = ctx.yomiLock[key];
        if (!lock || lock.ja !== jaN)
          E('YLOCK-missing', `글${t.order} 락 미등재/수정 문장(${key}) — 락 재생성+검수 필요: ${b.ja}`);
        else if (lock.yomi !== yomiN)
          E('YLOCK-yomi', `글${t.order} 요미 불일치(${key}): 락 '${lock.yomi}' ≠ 현재 '${yomiN}' (문장: ${b.ja})`);
      }
    }
    // P3-7: 락에 있는데 콘텐츠에서 사라진 문장 = 오류로 승격. 전수 고정 보장 — 문장 삭제도
    // 락 재생성+검수를 강제한다(사라진 문장이 조용히 통과하는 구멍 차단).
    for (const key of Object.keys(ctx.yomiLock))
      if (!seen.has(key)) E('YLOCK-gone', `락 문장이 콘텐츠에서 사라짐(재생성+검수 필요): ${key} (락 ja: ${ctx.yomiLock[key].ja})`);
  }

  // ── G7(기대 독음 사전) — 보조 진단(강등): YLOCK이 주 게이트이므로 불일치는 경고 ──
  // 맵은 신뢰본에서 같은 정렬로 생성(build-yomi-map.mjs). 신규 문장 초안 작성 시 한자별 허용
  // 독음 참고용으로만 유지한다(완전 삭제 금지). 실제 게이트는 위 YLOCK이 담당한다.
  if (ctx.yomiMap) {
    for (const t of texts) {
      for (const b of (t.body || [])) {
        if (!b.ja || !b.yomi) continue;
        const { ok, readings } = extractReadings(b.ja, b.yomi);
        if (!ok) continue;
        for (const { surface, reading } of readings) {
          const allowed = ctx.yomiMap[surface];
          if (!allowed)
            W('G7-map', `글${t.order} 맵 미등재 표면형(보조 진단): ${surface}(${reading}) (문장: ${b.ja})`);
          else if (!allowed.includes(reading))
            W('G7-map', `글${t.order} 요미 불일치(보조 진단): ${surface}→${reading} ∉ [${allowed.join(',')}] (문장: ${b.ja})`);
        }
      }
    }
  }
  // 트랙 places 사전 vs 하드코딩 이중 고정
  for (const p of (track?.places || [])) {
    if (p.ja && PLACE_YOMI[p.ja] && p.yomi && kataToHira(p.yomi) !== kataToHira(PLACE_YOMI[p.ja]))
      E('G6-place', `places 사전 요미 불일치: ${p.ja} ${p.yomi} ≠ 정답 ${PLACE_YOMI[p.ja]}`);
  }

  // ── ID: 문항·드릴 item id 존재·유일·형식(P3-11) ──
  // 방금 콘텐츠에 전 문항 id 부여됨(글 문항 <text_id>-qK · 드릴 <track>-drill-N-qK).
  // id가 없거나 중복이면 진도·SRS 추적이 뒤섞인다 → 누락·중복·형식 위반 = 오류.
  const idSeen = new Map(); // id → 최초 등장처
  const checkId = (id, where, re) => {
    if (!id) { E('ID-missing', `${where} id 누락`); return; }
    if (!re.test(id)) E('ID-format', `${where} id 형식 위반: ${id}`);
    if (idSeen.has(id)) E('ID-dup', `id 중복: ${id} @ ${idSeen.get(id)} · ${where}`);
    else idSeen.set(id, where);
  };
  const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const t of texts) {
    const qRe = new RegExp(`^${escapeRe(t.id)}-q\\d+$`);
    (t.questions || []).forEach((q, j) => checkId(q.id, `글${t.order} 문항${j + 1}`, qRe));
  }
  const drillRe = new RegExp(`^${escapeRe(track?.track || '')}-drill-\\d+-q\\d+$`);
  for (let i = 0; i < drills.length; i++)
    (drills[i].items || []).forEach((it, j) => checkId(it.id, `드릴${i + 1} 문항${j + 1}`, drillRe));

  // ── Q: 문항(신유형 order/fill/produce 포함, P4) ──
  // 게이트 문항(Q-cover 커버 인정) = pattern|order|fill. produce·content는 비게이트(연습·이해 문항).
  const GATE_TYPES = new Set(['pattern', 'order', 'fill']);
  const QUESTION_TYPES = new Set(['pattern', 'content', 'order', 'fill', 'produce']);
  for (const t of texts) {
    const patternQ = [];
    for (const q of (t.questions || [])) {
      if (!QUESTION_TYPES.has(q.type)) { E('Q-type', `글${t.order} 문항 type 위반: ${q.type}`); continue; }

      // 발문 스타일 린트(오너 지시): 게이트 문항의 q에 정해진 글 회상형 지시("본문에서/을/을 보고/
      // 에 나온/의 문장" 등) 금지. "본문에서" 문자열 정확 일치만 막으면 "본문을 보고"·"본문에 나온"
      // 류 동의 회상형 변형이 우회한다(P3-7) — 회상 지시 문구 자체를 정규식으로 커버하되 공백·줄바꿈
      // 변형(\s*)까지 허용 매칭한다. "본문" 단어 자체가 아니라 이 회상 지시 패턴만 차단하므로
      // content 예외(위 GATE_TYPES 필터)는 그대로 유지되고, GATE_TYPES 밖의 순수 "본문" 언급은
      // 애초에 이 분기에 들어오지 않는다.
      const Q_STYLE_RECALL_RE = /본문\s*(을\s*보고|을|에서|에\s*나온|의\s*문장)/;
      if (GATE_TYPES.has(q.type) && typeof q.q === 'string' && Q_STYLE_RECALL_RE.test(q.q))
        E('Q-style', `글${t.order} 발문에 회상형 지시(본문 참조) 금지(정해진 글 회상형 발문): ${q.q}`);

      if (q.type === 'pattern' || q.type === 'content') {
        // 기존 선다 검사(choices 4개·중복·최소쌍 경고)는 type:'pattern'에만 적용(오너 지시, P4-7).
        const ch = q.choices || [];
        if (q.type === 'pattern' && ch.length !== 4) E('Q-choices', `글${t.order} choices ${ch.length}개(≠4)`);
        if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < ch.length))
          E('Q-answer', `글${t.order} 정답 인덱스 무효: ${q.answer}`);
        else {
          const ans = ch[q.answer];
          if (ch.filter((c) => c === ans).length > 1) E('Q-distract', `글${t.order} distractor=정답 중복: ${ans}`);
        }
        // distractor끼리의 중복도 오류로 승격(P2-10) — 같은 선택지 2개는 4지선다를 사실상 3지로 만든다.
        if (q.type === 'pattern' && new Set(ch).size !== ch.length)
          E('Q-dup', `글${t.order} choices 내 중복 선택지: ${JSON.stringify(ch)}`);
        if (q.type === 'pattern') {
          patternQ.push(q.pattern);
          // 최소쌍 형식 휴리스틱: choices 간 편집 유사도(공통 접두/접미 공유)
          if (ch.length === 4) {
            let sum = 0, cnt = 0;
            for (let i = 0; i < ch.length; i++)
              for (let j = i + 1; j < ch.length; j++) { sum += simRatio(ch[i], ch[j]); cnt++; }
            if (cnt && sum / cnt < 0.34)
              W('Q-minpair', `글${t.order} pattern 문항 최소쌍 의심(choices 편집 유사도 낮음): ${JSON.stringify(ch)}`);
          }
        }
      } else if (q.type === 'order') {
        // order: tiles 비어있지 않음·answer가 tiles의 순열(멀티셋 일치)·answer.join이 자연 문장(공백 제거
        // 시 일본어)·pattern이 그 글 newPatterns에 존재·ko/why 존재.
        const tiles = Array.isArray(q.tiles) ? q.tiles : [];
        if (!tiles.length) E('Q-order', `글${t.order} order 문항 tiles 비어있음: ${q.id || '(id 없음)'}`);
        const answer = Array.isArray(q.answer) ? q.answer : [];
        // P2-4: tiles/answer 각 원소가 비어있지 않은 문자열인지 개별 검사(비문자열·빈 문자열·
        // 동일 객체가 양쪽에 중복 등장하는 경우 포함). isMultisetEqual은 값 동치만 보므로
        // 같은(비문자열) 원소가 tiles·answer 양쪽에 그대로 들어가면 순열 검사를 통과해버려
        // 타입 위반이 조용히 새어나간다 — 별도 원소 검사로 막는다.
        const badTile = tiles.some((x) => typeof x !== 'string' || !x.trim());
        const badAns = answer.some((x) => typeof x !== 'string' || !x.trim());
        if (badTile) E('Q-order', `글${t.order} order 문항 tiles에 비문자열/빈 문자열 원소: ${q.id || '(id 없음)'}`);
        if (badAns) E('Q-order', `글${t.order} order 문항 answer에 비문자열/빈 문자열 원소: ${q.id || '(id 없음)'}`);
        if (!tiles.length || !answer.length || !isMultisetEqual(tiles, answer))
          E('Q-order', `글${t.order} order 문항 answer가 tiles의 순열 아님: ${q.id || '(id 없음)'}`);
        else if (!badTile && !badAns && !isJaText(answer.join('')))
          E('Q-order', `글${t.order} order 문항 answer가 자연 문장 아님(공백 제거 시 일본어 아님): ${answer.join('')}`);
        if (!patternInText(t, q.pattern))
          E('Q-order', `글${t.order} order 문항 pattern이 그 글 newPatterns에 없음: ${q.pattern}`);
        if (!q.ko) E('Q-order', `글${t.order} order 문항 ko 누락: ${q.id || '(id 없음)'}`);
        if (!q.why) E('Q-order', `글${t.order} order 문항 why 누락: ${q.id || '(id 없음)'}`);
        if (q.pattern) patternQ.push(q.pattern);
      } else if (q.type === 'fill') {
        // fill: ja에 ［　］ 정확히 1개·answer 비어있지 않음·accept는 배열(있으면)·answer를 ［　］에
        // 넣은 문장이 성립(간이 검사: 치환 후 일본어 문자열)·pattern이 그 글 newPatterns에 존재.
        const ja = String(q.ja || '');
        const blanks = (ja.match(/［　］/g) || []).length;
        if (blanks !== 1) E('Q-fill', `글${t.order} fill 문항 ［　］ ${blanks}개(≠1): ${q.id || '(id 없음)'}`);
        const answer = typeof q.answer === 'string' ? q.answer.trim() : '';
        if (!answer) E('Q-fill', `글${t.order} fill 문항 answer 비어있음: ${q.id || '(id 없음)'}`);
        if (q.accept !== undefined && !Array.isArray(q.accept))
          E('Q-fill', `글${t.order} fill 문항 accept가 배열 아님: ${q.id || '(id 없음)'}`);
        // P2-4: accept 배열 각 원소도 answer와 동일 정규화 규칙(비어있지 않은 문자열)으로 유효해야
        // 한다 — 빈 값·비문자열이 하나라도 섞이면 채점 시 조용히 무시되거나 오탐을 낸다.
        if (Array.isArray(q.accept) && q.accept.some((x) => typeof x !== 'string' || !x.trim()))
          E('Q-fill', `글${t.order} fill 문항 accept에 비문자열/빈 값 원소: ${q.id || '(id 없음)'}`);
        if (blanks === 1 && answer) {
          const filled = ja.replace('［　］', answer);
          if (!isJaText(filled)) E('Q-fill', `글${t.order} fill 문항 치환 후 문장이 일본어 아님: ${filled}`);
        }
        if (!patternInText(t, q.pattern))
          E('Q-fill', `글${t.order} fill 문항 pattern이 그 글 newPatterns에 없음: ${q.pattern}`);
        if (q.pattern) patternQ.push(q.pattern);
      } else if (q.type === 'produce') {
        // produce: prompt·model(≥1)·guide 존재. 비게이트 — patternQ에 미포함(Q-cover 커버로 인정 안 함).
        if (!q.prompt) E('Q-produce', `글${t.order} produce 문항 prompt 누락: ${q.id || '(id 없음)'}`);
        if (!Array.isArray(q.model) || q.model.length < 1)
          E('Q-produce', `글${t.order} produce 문항 model 비어있음(≥1 필요): ${q.id || '(id 없음)'}`);
        if (!q.guide) E('Q-produce', `글${t.order} produce 문항 guide 누락: ${q.id || '(id 없음)'}`);
      }
    }
    const covered = new Set(patternQ);
    for (const p of (t.newPatterns || []))
      if (!covered.has(p)) E('Q-cover', `글${t.order} 게이트 문항(pattern/order/fill) 미커버 신규 문형: ${p}`);
  }

  // ── FR: 〜ました 도입 이전 글 narration 금지 ──
  let mashitaOrder = Infinity;
  for (const t of texts) if ((t.newPatterns || []).includes('〜ました')) mashitaOrder = Math.min(mashitaOrder, t.order);
  for (const t of texts)
    if (t.frame === 'narration' && t.order < mashitaOrder)
      E('FR', `글${t.order} frame:narration이 〜ました 도입(order ${mashitaOrder === Infinity ? '없음' : mashitaOrder}) 이전`);

  // ── DR: 드릴 D군 일치·스키마 ──
  const drillPatterns = new Set(drills.flatMap((d) => d.patterns || []));
  const dset = new Set(ctx.dgroup);
  const drMissing = [...dset].filter((p) => !drillPatterns.has(p));
  const drExtra = [...drillPatterns].filter((p) => !dset.has(p));
  if (drMissing.length) E('DR', `드릴 D군 누락: ${drMissing.join(', ')}`);
  if (drExtra.length) E('DR', `드릴 D군 외 문형: ${drExtra.join(', ')}`);
  // 드릴 배치·문항 스키마(P1-4) — afterOrder가 유령 order를 가리키면 UI에서 드릴이 영원히 안 뜨고,
  // items가 비면 "드릴이 있다"는 커버리지 주장(G1/DR)만 남고 실제 연습은 0문항이 된다.
  const orderSet = new Set(texts.map((t) => t.order));
  for (let i = 0; i < drills.length; i++) {
    const d = drills[i];
    if (!d.style) E('DR', `드릴${i + 1} style 누락`);
    if (!orderSet.has(d.afterOrder))
      E('DR-after', `드릴${i + 1} afterOrder ${d.afterOrder} — 실존 글 order 집합에 없음`);
    if (!Array.isArray(d.items) || d.items.length < 1) {
      E('DR-items', `드릴${i + 1} items 비어 있음(≥1 필요)`);
    } else {
      for (let j = 0; j < d.items.length; j++) {
        const it = d.items[j];
        const ch = Array.isArray(it.choices) ? it.choices : [];
        if (!it.q) E('DR-item', `드릴${i + 1} 문항${j + 1} q 누락`);
        if (ch.length !== 4) E('DR-item', `드릴${i + 1} 문항${j + 1} choices ${ch.length}개(≠4)`);
        if (!(Number.isInteger(it.answer) && it.answer >= 0 && it.answer < ch.length))
          E('DR-item', `드릴${i + 1} 문항${j + 1} answer 인덱스 무효: ${it.answer}`);
        // 드릴도 4지선다 — 문항(Q-dup)과 같은 이유로 중복 선택지는 오류
        if (new Set(ch).size !== ch.length)
          E('DR-item', `드릴${i + 1} 문항${j + 1} choices 내 중복 선택지: ${JSON.stringify(ch)}`);
      }
      // ── P1-5: 드릴 문형-문항 연결 ──
      // drills[].patterns의 모든 문형이 items[].pattern으로 ≥1 커버돼야 하고(미커버 = 오류),
      // items[].pattern이 선언(patterns) 밖이면 오류. "드릴이 문형을 가르친다"는 주장을
      // 문항 단위 태깅으로 강제해, 선언만 있고 실제 연습 문항이 없는 구멍을 막는다.
      const declared = new Set(d.patterns || []);
      const itemPats = d.items.map((it) => it.pattern).filter(Boolean);
      const itemPatSet = new Set(itemPats);
      for (const p of declared)
        if (!itemPatSet.has(p)) E('DR-pattern', `드릴${i + 1} 선언 문형 미커버(items[].pattern 부재): ${p}`);
      for (const p of itemPats)
        if (!declared.has(p)) E('DR-pattern', `드릴${i + 1} items[].pattern이 선언(patterns) 밖: ${p}`);
    }
  }

  // ── G6(furigana 정렬): 기존 check-furigana.mjs를 spawn ──
  if (!ctx.skipFurigana) {
    const items = texts.flatMap((t) => (t.body || []).filter((b) => b.ja).map((b) => ({ ex: { ja: b.ja, yomi: b.yomi } })));
    const tmpDir = process.env.CLAUDE_SCRATCH || path.join(ROOT, 'scripts', 'reading');
    const tmp = path.join(tmpDir, `.reading-furigana-tmp.mjs`);
    writeFileSync(tmp, `export default { themes: [{ name: 'reading-body', items: ${JSON.stringify(items)} }] };\n`);
    const rel = path.relative(ROOT, tmp);
    const r = spawnSync('node', ['scripts/check-furigana.mjs', rel], { cwd: ROOT, encoding: 'utf8' });
    try { require('node:fs').unlinkSync(tmp); } catch {}
    if (r.status !== 0) E('G6-furigana', `본문 요미 정렬 실패:\n${(r.stdout || '').trim()}`);
  }

  return { errors, warns };
}

// ── 실 트랙 검증에 필요한 컨텍스트 구성 ──
async function buildRealContext() {
  const bunkei = (await import(new URL(BUNKEI_REL, import.meta.url))).default;
  const patternUniverse = new Set(bunkei.themes.flatMap((t) => t.items.map((i) => i.pattern)));

  // 어휘 풀: N5 4파일 + n5_travel_core
  const vocabFiles = ['n5', 'n5_jlpt_a', 'n5_jlpt_b', 'n5_jlpt_c', 'n5_travel_core'];
  const vocabPool = new Set();
  let travelCoreCount = 0; // 여행 코어 40캡 검사용(P2-11) — 읽기만, 파일은 콘텐츠 소유
  for (const f of vocabFiles) {
    const m = (await import(new URL(`../src/content/japanese/vocab/${f}.js`, import.meta.url))).default;
    if (f === 'n5_travel_core')
      travelCoreCount = (m.themes || []).reduce((n, t) => n + (t.words || []).length, 0);
    for (const t of (m.themes || [])) for (const w of (t.words || [])) {
      for (const part of String(w.ja).split(/[;；／、]/)) {
        vocabPool.add(part.trim()); vocabPool.add(normJa(part));
        // 괄호 병기 확장 — '寺 (お寺)' 표제어는 '寺'와 'お寺' 둘 다 풀에 넣는다
        const paren = part.match(/[（(]([^）)]+)[）)]/);
        if (paren) { vocabPool.add(paren[1].trim()); vocabPool.add(part.replace(/[（(][^）)]*[）)]/g, '').trim()); }
      }
      if (w.yomi) { vocabPool.add(w.yomi); vocabPool.add(normJa(w.yomi)); }
    }
  }
  const tokenizer = await getTokenizer();
  // 기대 독음 사전(P1-4) — build-yomi-map.mjs 산출물. 부재 시 G7은 침묵하지 않고 하드 실패:
  // 맵이 사라지면 사람 게이트가 통째로 무력화되므로 "생략 통과"를 허용하지 않는다.
  const mapPath = path.join(ROOT, 'scripts', 'reading', 'yomi-map.json');
  if (!existsSync(mapPath)) {
    console.error('✗ [G7] 기대 독음 사전 없음: scripts/reading/yomi-map.json — node scripts/reading/build-yomi-map.mjs 로 생성 필요');
    process.exit(1);
  }
  const yomiMap = JSON.parse(readFileSync(mapPath, 'utf8'));
  // 문장 단위 요미 락(P1-1) — 주 게이트. 부재 시 침묵 통과를 허용하지 않고 하드 실패:
  // 락이 사라지면 표면형 맵의 구조적 구멍(가나-온리·오쿠리가나·아티팩트)이 다시 열린다.
  const lockPath = path.join(ROOT, 'scripts', 'reading', 'yomi-lock.json');
  if (!existsSync(lockPath)) {
    console.error('✗ [YLOCK] 문장 단위 요미 락 없음: scripts/reading/yomi-lock.json — node scripts/reading/build-yomi-lock.mjs 로 생성 필요');
    process.exit(1);
  }
  const yomiLock = JSON.parse(readFileSync(lockPath, 'utf8'));
  return { patternUniverse, dgroup: DGROUP, vocabPool, placeYomi: PLACE_YOMI, tokenizer, yomiMap, yomiLock, skipFurigana: false, travelCoreCount };
}

// ── 자가 테스트: 정상 베이스라인 + 결함 주입 36종(기존 26 + 신유형 order/fill/produce 5, P4
//    + order/fill 원소 스키마·Q-style 회상형 우회 변형 5, P2-4·P3-7) ──
async function selfTest() {
  const tokenizer = await getTokenizer();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // 소형 유니버스(R∪D). 베이스라인은 전 검사 통과.
  const universe = new Set([
    '〜です', '〜ます', '〜ました', '〜は',
    'AはBより〜', 'AとBと どちらが', 'い형용사 + 명사', '何(なん/なに)', '〜だ',
    '〜たり 〜たり します', 'そして',
    // 신유형(order/fill/produce, P4) 검증용 — st-05가 이 둘을 도입.
    '〜ませんか', '〜てください',
  ]);
  const dgroup = ['〜は'];

  const baseline = {
    track: 'st', title: '자가테스트', level: 'N5',
    places: [],
    texts: [
      {
        id: 'st-01',
        order: 1, place: { name: '역', ja: '駅', landmark: 'station' }, frame: 'dialogue',
        newPatterns: ['〜です', '〜ます'],
        body: [
          { ja: '私は学生です。ここは駅です。', yomi: 'わたしはがくせいです。ここはえきです。', ko: '' },
          { ja: '本を読みます。水を飲みます。', yomi: 'ほんをよみます。みずをのみます。', ko: '' },
          // 오쿠리가나 오독(来ます→くます) 포착용 — 표면형 맵은 来:[き,く]로 くます를 통과시키나 YLOCK은 잡는다.
          { ja: '父が 来ます。', yomi: 'ちちが きます。', ko: '' },
          // 가나-온리 문장 — 표면형 맵은 한자 부재로 무검사, YLOCK만 문장 락으로 검사한다.
          { ja: 'これは ぺんです。', yomi: 'これは ぺんです。', ko: '' },
        ],
        questions: [
          { id: 'st-01-q1', type: 'pattern', pattern: '〜です', q: 'Q', choices: ['です', 'ます', 'でした', 'ません'], answer: 0, why: 'w' },
          { id: 'st-01-q2', type: 'pattern', pattern: '〜ます', q: 'Q', choices: ['ます', 'です', 'ました', 'ません'], answer: 0, why: 'w' },
          { id: 'st-01-q3', type: 'content', q: 'Q', choices: ['学生', '先生', '医者', '駅員'], answer: 0 },
        ],
      },
      {
        id: 'st-02',
        order: 2, place: { name: '역', ja: '駅', landmark: 'station' }, frame: 'dialogue',
        newPatterns: ['〜ました'],
        body: [
          { ja: '駅に行きました。バスに乗りました。', yomi: 'えきにいきました。ばすにのりました。', ko: '' },
        ],
        questions: [
          { id: 'st-02-q1', type: 'pattern', pattern: '〜ました', q: 'Q', choices: ['ました', 'ます', 'です', 'ません'], answer: 0, why: 'w' },
        ],
      },
      {
        // P1-2·P1-3·P2-10 검사용: 비교·형용사+명사·何·〜だ + 중첩 지명(東京駅/東京)을 한 글에 담는다.
        id: 'st-03',
        order: 3, place: { name: '도쿄역', ja: '東京駅', landmark: 'station' }, frame: 'dialogue',
        newPatterns: ['AはBより〜', 'AとBと どちらが', 'い형용사 + 명사', '何(なん/なに)', '〜だ'],
        body: [
          { ja: '赤い 洋服は 青い 洋服より 高いです。赤い 洋服は 青い 洋服より 安いです。', yomi: 'あかい ようふくは あおい ようふくより たかいです。あかい ようふくは あおい ようふくより やすいです。', ko: '' },
          { ja: '赤い 洋服と 青い 洋服と、どちらが いいですか。青い 洋服と 赤い 洋服と、どちらが 安いですか。', yomi: 'あかい ようふくと あおい ようふくと、どちらが いいですか。あおい ようふくと あかい ようふくと、どちらが やすいですか。', ko: '' },
          { ja: 'これは 何ですか。何の 洋服ですか。', yomi: 'これは なんですか。なんの ようふくですか。', ko: '' },
          { ja: 'これは 洋服だ。あれも 洋服だ。', yomi: 'これは ようふくだ。あれも ようふくだ。', ko: '' },
          { ja: '東京駅から 東京へ 行きます。', yomi: 'とうきょうえきから とうきょうへ いきます。', ko: '' },
        ],
        questions: [
          { id: 'st-03-q1', type: 'pattern', pattern: 'AはBより〜', q: 'Q', choices: ['より', 'でも', 'だけ', 'ぐらい'], answer: 0, why: 'w' },
          { id: 'st-03-q2', type: 'pattern', pattern: 'AとBと どちらが', q: 'Q', choices: ['どちらが', 'どちらも', 'どちらの', 'どちらを'], answer: 0, why: 'w' },
          { id: 'st-03-q3', type: 'pattern', pattern: 'い형용사 + 명사', q: 'Q', choices: ['赤い 洋服', '赤の 洋服', '赤く 洋服', '赤 洋服'], answer: 0, why: 'w' },
          { id: 'st-03-q4', type: 'pattern', pattern: '何(なん/なに)', q: 'Q', choices: ['何', 'どこ', 'だれ', 'いつ'], answer: 0, why: 'w' },
          { id: 'st-03-q5', type: 'pattern', pattern: '〜だ', q: 'Q', choices: ['だ', 'です', 'でした', 'だった'], answer: 0, why: 'w' },
          { id: 'st-03-q6', type: 'content', q: 'Q', choices: ['赤', '青', '白', '黒'], answer: 1 },
        ],
      },
      {
        // G4 v3 검사용(Codex 결함 ②③): 〜たり 〜たり します(필수 조각 AND·たり×2)·そして(접속사 정확 일치).
        id: 'st-04',
        order: 4, place: { name: '浅草', ja: '浅草', landmark: 'temple' }, frame: 'narration',
        newPatterns: ['〜たり 〜たり します', 'そして'],
        body: [
          { ja: '店を 見たり、写真を 撮ったり しました。', yomi: 'みせを みたり、しゃしんを とったり しました。', ko: '' },
          { ja: 'パンを 食べたり、水を 飲んだり しました。', yomi: 'ぱんを たべたり、みずを のんだり しました。', ko: '' },
          { ja: 'そして、ホテルへ 帰りました。', yomi: 'そして、ほてるへ かえりました。', ko: '' },
          { ja: 'そして、写真を 見ました。', yomi: 'そして、しゃしんを みました。', ko: '' },
        ],
        questions: [
          { id: 'st-04-q1', type: 'pattern', pattern: '〜たり 〜たり します', q: 'Q', choices: ['たり', 'だり', 'たら', 'ても'], answer: 0, why: 'w' },
          { id: 'st-04-q2', type: 'pattern', pattern: 'そして', q: 'Q', choices: ['そして', 'そしたら', 'それで', 'しかし'], answer: 0, why: 'w' },
        ],
      },
      {
        // 신유형(order/fill/produce, P4) 정상 표본 — Q-order/Q-fill/Q-produce·Q-cover(게이트 커버)·
        // Q-style(발문 린트) 베이스라인이 오류 0으로 통과함을 보증.
        id: 'st-05',
        order: 5, place: { name: '公園', ja: '公園', landmark: 'park' }, frame: 'dialogue',
        newPatterns: ['〜ませんか', '〜てください'],
        body: [
          { ja: '公園へ 行きませんか。', yomi: 'こうえんへ いきませんか。', ko: '' },
          { ja: 'ここに 座ってください。', yomi: 'ここに すわってください。', ko: '' },
        ],
        questions: [
          {
            id: 'st-05-q1', type: 'order', pattern: '〜ませんか', q: '타일을 배열해 문장을 만드세요.',
            tiles: ['公園', 'へ', '行き', 'ませんか'], answer: ['公園', 'へ', '行き', 'ませんか'],
            ko: '공원에 가지 않을래요?', why: '권유 표현 〜ませんか는 동사 ます형 뒤에 붙는다.',
          },
          {
            id: 'st-05-q2', type: 'fill', pattern: '〜てください', q: '빈칸에 알맞은 말을 넣으세요.',
            ja: 'ここに ［　］。', answer: '座ってください', accept: ['すわってください'],
            why: '〜てください는 요청을 나타낸다.',
          },
          {
            id: 'st-05-q3', type: 'produce', prompt: '오늘 공원에서 한 일을 일본어로 두 문장 이상 써 보세요.',
            model: ['公園へ 行きました。', '写真を 撮りました。'], guide: '〜ました를 사용해 과거 행동을 표현하세요.',
          },
        ],
      },
    ],
    drills: [
      // afterOrder는 실존 글 order여야 하고(DR-after), item에는 pattern 태그·id가 있어야 한다(P1-5·P3-11).
      { afterOrder: 1, patterns: ['〜は'], style: 'form-choice', items: [{ id: 'st-drill-1-q1', q: 'Q', ja: 'これ___です。', pattern: '〜は', choices: ['は', 'が', 'を', 'に'], answer: 0 }] },
    ],
  };

  // 풀은 베이스라인 본문 내용어로 구성 → 베이스라인 G5 통과
  const vocabPool = new Set();
  for (const t of baseline.texts) for (const b of t.body)
    for (const tok of tokenizer.tokenize(b.ja))
      if (CONTENT_POS.has(tok.pos)) {
        const base = tok.basic_form !== '*' ? tok.basic_form : tok.surface_form;
        vocabPool.add(base); vocabPool.add(tok.surface_form);
      }

  // 테스트용 기대 독음 사전 — 트랙 본문에서 실 생성 로직과 같은 정렬로 구성.
  const buildMap = (track) => {
    const m = {};
    for (const t of track.texts) for (const b of (t.body || [])) {
      if (!b.ja || !b.yomi) continue;
      const { ok, readings } = extractReadings(b.ja, b.yomi);
      if (!ok) continue;
      for (const { surface, reading } of readings) {
        (m[surface] ||= []);
        if (!m[surface].includes(reading)) m[surface].push(reading);
      }
    }
    return m;
  };
  // 문장 단위 요미 락 — 트랙 본문에서 실 생성 로직(build-yomi-lock)과 같은 정규화로 구성.
  const buildLock = (track) => {
    const L = {};
    for (const t of track.texts) {
      const body = t.body || [];
      for (let i = 0; i < body.length; i++) {
        const b = body[i];
        if (!b.ja || !b.yomi) continue;
        L[`${t.id}#${i}`] = { ja: normLock(b.ja), yomi: normLock(b.yomi) };
      }
    }
    return L;
  };
  const yomiMap = buildMap(baseline);   // 베이스라인은 G7·YLOCK 통과, 결함 주입 시에만 뜬다
  const yomiLock = buildLock(baseline);

  const ctx = { patternUniverse: universe, dgroup, vocabPool, placeYomi: PLACE_YOMI, tokenizer, yomiMap, yomiLock, skipFurigana: true };

  // 베이스라인은 오류 0이어야 자가테스트가 유효
  const baseRes = runChecks(clone(baseline), ctx);
  if (baseRes.errors.length) {
    console.error('✗ 자가테스트 베이스라인이 오류를 냄(테스트 무효):');
    baseRes.errors.forEach((e) => console.error(`   [${e.code}] ${e.msg}`));
    process.exit(1);
  }

  // 결함 주입 — [이름, 기대 코드, 변형 함수, 검사대상('error' 기본 | 'warn'), regenLock?].
  // 기존 22종(G1·G4·G5·G6·Q·DR·YLOCK·ID) + G4 v3·YLOCK-gone 4종 = 26종 + 신유형(order/fill/produce,
  // P4) 5종(order 순열 불일치·fill 빈칸 0개·produce 단독 커버 Q-cover 실패·"본문에서" 발문 Q-style·
  // 신유형 id 누락) = 31종 + order/fill 원소 스키마·Q-style 회상형 우회 5종(P2-4·P3-7) = 36종.
  const fixtures = [
    ['전수 누락', 'G1-missing', (t) => { t.texts[1].newPatterns = []; }],
    ['중복 도입', 'G1-dup', (t) => { t.texts[1].newPatterns.push('〜です'); }],
    ['풀 밖 어휘', 'G5', (t) => { t.texts[0].body.push({ ja: '猫が公園を走ります。', yomi: 'ねこがこうえんをはしります。', ko: '' }); }],
    ['지명 요미 불일치', 'G6-place', (t) => { t.texts[1].body.push({ ja: 'ここは渋谷です。', yomi: 'ここはとうきょうです。', ko: '' }); }],
    ['pattern 문항 커버 누락', 'Q-cover', (t) => { t.texts[0].questions = t.texts[0].questions.filter((q) => q.pattern !== '〜ます'); }],
    ['미실재 신규 문형', 'G4', (t) => { t.texts[0].body = []; }],
    ['빈 드릴 items', 'DR-items', (t) => { t.drills[0].items = []; }],
    ['드릴 afterOrder 유령', 'DR-after', (t) => { t.drills[0].afterOrder = 99; }],
    ['금지 요미', 'G6-banned', (t) => { t.texts[0].body.push({ ja: '駅です。', yomi: 'ときあいだです。', ko: '' }); }],
    // Q-dup은 type:'pattern'에만 적용(P4-7) — pattern 문항의 choices에 중복 주입.
    ['중복 distractor', 'Q-dup', (t) => { t.texts[0].questions[0].choices = ['です', 'ます', 'ます', 'ません']; }],
    // ── 강화(P1-2·P1-3·P1-5·P2-10) ──
    // P1-2: 플레이스홀더 문형의 리터럴이 하드 게이트로 복귀 — より/どちらが/형용사+명사가 본문에서 사라지면 오류.
    ['より 제거(P1-2)', 'G4', (t) => { const b = t.texts[2].body[0]; b.ja = b.ja.replaceAll('より', 'だけ'); b.yomi = b.yomi.replaceAll('より', 'だけ'); }],
    ['どちらが 제거(P1-2)', 'G4', (t) => { const b = t.texts[2].body[1]; b.ja = b.ja.replaceAll('どちらが', 'これが'); b.yomi = b.yomi.replaceAll('どちらが', 'これが'); }],
    ['い형용사+명사 제거(P1-2)', 'G4', (t) => {
      for (const i of [0, 1]) { const b = t.texts[2].body[i]; b.ja = b.ja.replaceAll('赤い', 'あの').replaceAll('青い', 'この'); b.yomi = b.yomi.replaceAll('あかい', 'あの').replaceAll('あおい', 'この'); }
    }],
    // P1-3: まだです의 だ는 경계(문말) 요구로 〜だ에 오계상되지 않는다 → 실제 〜だ가 없으면 오류.
    ['まだです だ 경계(P1-3)', 'G4', (t) => { const b = t.texts[2].body[3]; b.ja = 'まだです。まだです。'; b.yomi = 'まだです。まだです。'; }],
    // P1-5: 드릴 item의 pattern 태그가 없으면 선언 문형 미커버.
    ['드릴 문형 미커버(P1-5)', 'DR-pattern', (t) => { delete t.drills[0].items[0].pattern; }],
    // P2-10: 중첩 지명에서 두 번째 東京 오독이 東京駅의 요미에 가려지지 않고 잡힌다.
    ['중첩 지명 오독(P2-10)', 'G6-place', (t) => { t.texts[2].body[4].yomi = 'とうきょうえきから ぎんざへ いきます。'; }],
    // ── 신규 5종(YLOCK 주 게이트·G4 조사 정확일치·문항 id, P1-1·P1-2·P2-5·P1-3·P3-11) ──
    // 강등된 G7(표면형 맵)은 이제 보조 진단(경고) — 맵 미등재는 warns에서 검출됨을 확인한다.
    ['맵 미등재→보조 진단 강등(G7 warn)', 'G7-map', (t) => { t.texts[0].body.push({ ja: '空港へ行きます。', yomi: 'くうこうへいきます。', ko: '' }); }, 'warn'],
    // P2-5: 가나-온리 문장은 표면형 맵이 무검사 → YLOCK만 요미 오염을 잡는다(ja 동일·yomi 변조).
    ['가나-온리 yomi 오염(P2-5)', 'YLOCK-yomi', (t) => { t.texts[0].body[3].yomi = 'これは ぴんです。'; }],
    // P1-2: 오쿠리가나 오독 来ます→くます — 맵은 来:[き,く]로 통과시키나 YLOCK은 문장 요미로 잡는다.
    ['오쿠리가나 오독 くます(P1-2)', 'YLOCK-yomi', (t) => { t.texts[0].body[2].yomi = 'ちちが くます。'; }],
    // P1-1: 락 미등재 문장 — 신규 문장은 락에 없어 재생성+검수를 강제한다.
    ['락 미등재 문장(P1-1)', 'YLOCK-missing', (t) => { t.texts[0].body.push({ ja: '母も 来ます。', yomi: 'ははも きます。', ko: '' }); }],
    // P1-3: 고정 조사 종결(どちらも)은 활용 어미가 아니므로 완화 없이 정확 일치 → どちらが 문형 미실재.
    ['고정 조사 치환 どちらも(P1-3)', 'G4', (t) => { const b = t.texts[2].body[1]; b.ja = b.ja.replaceAll('どちらが', 'どちらも'); b.yomi = b.yomi.replaceAll('どちらが', 'どちらも'); }],
    // P3-11: 문항 id 중복.
    ['문항 id 중복(P3-11)', 'ID-dup', (t) => { t.texts[0].questions[1].id = t.texts[0].questions[0].id; }],
    // ── G4 v3 신규 4종(Codex v4 변형 재현, P1-1·P1-2·P1-3·P3-7) ──
    // 5번째 인자 regenLock=true: 변형 본문에 맞춰 락·맵을 재생성해 YLOCK을 침묵시킨다 →
    // G4(형태소)가 단독으로 결함을 잡아야 진짜 검출임을 증명한다(Codex 재현 절차와 동일).
    // ① 종지형 だ 문장을 まだ。로 치환 — 왼쪽 형태소 경계를 무시하던 だ 오계상이 POS 계수로 소멸(copula 0<2).
    ['① だ→まだ。 copula 오계상(P1-3)', 'G4', (t) => { const b = t.texts[2].body[3]; b.ja = 'まだ。まだ。'; b.yomi = 'まだ。まだ。'; }, 'error', true],
    // ② 〜たり 〜たり します 조각 유실 — たり 문장 제거 시 최장 조각 します만 보던 결함이 AND(たり×2)로 검출.
    ['② たり 문장 제거(필수 조각 AND)', 'G4', (t) => { t.texts[3].body = t.texts[3].body.filter((b) => !b.ja.includes('たり')); }, 'error', true],
    // ③ そして→そしたら — 활용 어미 whitelist로 そし만 보던 결함이 접속사 정확 일치로 검출.
    ['③ そして→そしたら(접속사 정확 일치)', 'G4', (t) => { for (const b of t.texts[3].body) { b.ja = b.ja.replaceAll('そして', 'そしたら'); b.yomi = b.yomi.replaceAll('そして', 'そしたら'); } }, 'error', true],
    // ④ 락 문장 삭제 — 락에 있는데 사라진 문장은 경고→오류 승격(P3-7). 락은 원본 그대로(재생성 X)여야 잡힌다.
    ['④ 락 문장 삭제(YLOCK-gone 승격)', 'YLOCK-gone', (t) => { t.texts[3].body.splice(2, 1); }],
    // ── 신유형(order/fill/produce, P4) 결함 주입 5종 ──
    // order: answer 길이·구성이 tiles의 멀티셋과 불일치(ませんか 타일 누락) → 순열 아님.
    ['order 순열 불일치(P4)', 'Q-order', (t) => { t.texts[4].questions[0].answer = ['公園', 'へ', '行き']; }],
    // fill: ja에서 ［　］를 제거 → 빈칸 0개.
    ['fill ［　］ 0개(P4)', 'Q-fill', (t) => { t.texts[4].questions[1].ja = 'ここに 座ってください。'; }],
    // Q-cover: 신규 문형(〜ました)의 유일한 문항을 produce로 교체 — produce는 비게이트라 커버 인정 안 됨.
    ['produce 단독 커버(Q-cover 실패, P4)', 'Q-cover', (t) => {
      t.texts[1].questions = [{ id: 'st-02-q1', type: 'produce', prompt: 'P', model: ['M'], guide: 'G' }];
    }],
    // Q-style: 게이트 문항 발문에 "본문에서" 등장 — 정해진 글 회상형 발문 금지(오너 지시).
    ['"본문에서" 발문(Q-style, P4)', 'Q-style', (t) => { t.texts[0].questions[0].q = '본문에서 알맞은 것을 고르세요.'; }],
    // ID: 신유형(order) 문항의 id 누락 — ID 검사가 신유형에도 적용됨을 확인.
    ['신유형 id 누락(ID-missing, P4)', 'ID-missing', (t) => { delete t.texts[4].questions[0].id; }],
    // ── P2-4 신규 3종: order tiles/answer 원소 검사·fill accept 원소 검사 ──
    // 빈 문자열 타일 — tiles·answer 양쪽에 같은 빈 문자열을 넣어 멀티셋 검사는 통과하지만
    // 원소 자체가 빈 문자열이라 오류다(런타임 []/[] 자동 통과 봉쇄와 짝을 이루는 빌드 게이트).
    ['order 빈 문자열 타일(P2-4)', 'Q-order', (t) => {
      t.texts[4].questions[0].tiles = ['公園', '', '行き', 'ませんか'];
      t.texts[4].questions[0].answer = ['公園', '', '行き', 'ませんか'];
    }],
    // 동일 객체 양배열 — 비문자열(객체) 원소를 같은 참조로 tiles·answer 양쪽에 넣으면 값 동치
    // 기반 멀티셋 검사(isMultisetEqual)는 통과해버린다 — 원소 타입 검사가 독립적으로 잡아야 한다.
    ['order 비문자열 동일 객체 양배열(P2-4)', 'Q-order', (t) => {
      const bad = {};
      t.texts[4].questions[0].tiles = ['公園', bad, '行き', 'ませんか'];
      t.texts[4].questions[0].answer = ['公園', bad, '行き', 'ませんか'];
    }],
    // fill accept 불량 — 빈 문자열·비문자열이 섞이면 answer와 같은 정규화 규칙 위반.
    ['fill accept 불량(P2-4)', 'Q-fill', (t) => { t.texts[4].questions[1].accept = ['', 42]; }],
    // ── P3-7 신규 2종: Q-style 정규식 확장(우회 변형·공백/줄바꿈 변형) ──
    // "본문에서" 정확 일치만 막던 기존 검사를 우회하는 동의 회상형 표현("본문을 보고").
    ['Q-style 우회 "본문을 보고"(P3-7)', 'Q-style', (t) => { t.texts[0].questions[0].q = '본문을 보고 알맞은 것을 고르세요.'; }],
    // 회상 지시 문구 사이 공백/줄바꿈 변형(정규식 \s* 매칭 확인) — "본문" 과 "에서" 사이 줄바꿈.
    ['Q-style 줄바꿈 변형(P3-7)', 'Q-style', (t) => { t.texts[0].questions[0].q = '본문\n에서 알맞은 것을 고르세요.'; }],
  ];

  let detected = 0;
  for (const [name, code, mutate, where, regenLock] of fixtures) {
    const t = clone(baseline);
    mutate(t);
    // regenLock: 변형 본문 기준으로 락·맵 재생성 → YLOCK/G7 침묵, 대상 게이트(G4)만 판정.
    const fctx = regenLock ? { ...ctx, yomiLock: buildLock(t), yomiMap: buildMap(t) } : ctx;
    const { errors, warns } = runChecks(t, fctx);
    const pool = where === 'warn' ? warns : errors;
    const hit = pool.some((e) => e.code === code);
    console.log(`  ${hit ? '✓' : '✗'} ${name} — 기대코드 ${code}${where === 'warn' ? '(warn)' : ''} ${hit ? '검출' : '미검출'}`);
    if (hit) detected++;
    else { errors.forEach((e) => console.log(`       (실제 err: [${e.code}] ${e.msg})`)); warns.forEach((e) => console.log(`       (실제 warn: [${e.code}] ${e.msg})`)); }
  }
  console.log(`\n자가테스트: ${detected}/${fixtures.length} 검출`);
  process.exit(detected === fixtures.length ? 0 : 1);
}

// ── 진입점 ──
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  // 콘텐츠 입고 이후에는 파일 부재 = 사고다. "생략 exit 0"이면 파일이 지워져도
  // prebuild가 초록불을 내는 침묵 구멍이 생긴다 — 부재를 명시적 실패로 승격(P1-3).
  if (!existsSync(TRACK_ABS)) {
    console.error(`✗ [TRACK] 트랙 파일 없음: ${TRACK_REL} — 입고 완료가 전제이므로 부재는 오류다`);
    process.exit(1);
  }
  const track = (await import(new URL('../' + TRACK_REL, import.meta.url))).default;
  const ctx = await buildRealContext();
  const { errors, warns } = runChecks(track, ctx);
  // ── P2-11: 전제 자체를 고정 — 유니버스 125·여행 코어 40캡 ──
  // runChecks 밖에서 검사한다: 자가 테스트는 소형 유니버스를 쓰므로 실 데이터 전용 전제다.
  if (ctx.patternUniverse.size !== 125)
    errors.push({ code: 'UNI', msg: `bunkei N5 patternUniverse ${ctx.patternUniverse.size}개 ≠ 125 — 표 2 전수 커버 전제 붕괴` });
  if (ctx.travelCoreCount > 40)
    errors.push({ code: 'CAP', msg: `여행 코어 ${ctx.travelCoreCount}어 > 40캡 — 표 1-W 하드 킬 게이트 위반` });
  // ── SC1: 월드 씬 사본(n5_tokyo_scene1) ⊂ 트랙 원본 — 드리프트 검출(Codex v2 P1-1) ──
  // 씬 모듈은 클라이언트 번들 격리를 위한 글 1의 수동 사본이다. 원본 글 1이 바뀌면 재복사해야 한다.
  try {
    const scene1 = (await import(new URL('../src/content/japanese/reading/n5_tokyo_scene1.js', import.meta.url))).default;
    const orig = (track.texts || []).find((t) => t.order === 1);
    if (!scene1 || JSON.stringify(scene1) !== JSON.stringify(orig))
      errors.push({ code: 'SC1', msg: 'n5_tokyo_scene1이 트랙 글 1과 불일치 — 원본 수정 후 사본 재복사 필요' });
  } catch {
    errors.push({ code: 'SC1', msg: 'n5_tokyo_scene1.js 로드 실패 — 월드 씬 모듈 부재' });
  }
  for (const w of warns) console.warn('⚠', `[${w.code}] ${w.msg}`);
  for (const e of errors) console.error('✗', `[${e.code}] ${e.msg}`);
  console.log(`\n독해 트랙 검증 — 오류 ${errors.length} · 경고 ${warns.length}`);
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
