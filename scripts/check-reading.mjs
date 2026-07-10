#!/usr/bin/env node
/**
 * 독해 트랙 결정적 검증기 — 기획 docs/plan-reading-track-pilot.md §6(P3) 항목을 코드로 고정한다.
 * 대상: src/content/japanese/reading/n5_tokyo.js — 콘텐츠 입고 완료가 전제.
 *       부재 시 "생략 exit 0"이 아니라 오류 exit 1 — 파일이 사라진 채 빌드가 통과하는 구멍을 막는다(P1-3).
 *
 * 실행:
 *   node scripts/check-reading.mjs             트랙 파일 검증(없으면 오류)
 *   node scripts/check-reading.mjs --self-test 내장 픽스처 22종 자가 검출 테스트
 *
 * 검사 항목(코드):
 *   G1  전 글 newPatterns ∪ 전 드릴 patterns = bunkei N5 pattern 125 전수·중복 0·부재 0
 *   UNI patternUniverse가 정확히 125개(표 2 전제) — 어긋나면 전수 검사 자체가 무의미(P2-11)
 *   CAP 여행 코어(n5_travel_core) 단어 수 ≤40 하드 캡(P2-11)
 *   ORD 글 order 오름차순·중복 없음(i+1 도입 순서)
 *   G4  신규 문형이 그 글 본문에 어간 매칭(P1-2·P1-3): 플레이스홀더(A·B·한글)를 슬롯으로 치환 후
 *       리터럴 조각 추출 → 전 문형 실재 검사(면제 0). alt 그룹 구조로 何(なん/なに)류 이중 계상 차단,
 *       1~2자 가나 어간은 경계(구두점·공백·문말) 요구로 부분 문자열 오계상 차단.
 *       마지막 글자 완화(slice)는 활용 어미(るすたていうくぐむぶぬ)로 끝나는 조각에만 적용 —
 *       どちらが 등 조사 종결은 정확 일치를 요구해 どちらも류 치환을 잡는다(P1-3).
 *       'い형용사+명사'는 리터럴 부재 → kuromoji 형태소 인접(形容詞자립·い활용 + 名詞) ≥2회로 검사.
 *   G5  본문 내용어(명사·동사·형용사·부사) 기본형이 어휘 풀 ∪ 지명에 존재
 *   G6  본문 yomi 정렬(check-furigana spawn) + 지명 요미 대조(P2-10: ja·yomi 동시 마스킹·출현 횟수 대응)
 *       + 금지 요미(과거 실제 오독) 블랙리스트 대조(보조)
 *   YLOCK 문장 단위 요미 락(yomi-lock.json) 대조 — 주 게이트(P1-1·P1-2·P2-5). 전 body 문장을 같은
 *       정규화(normLock)로 락과 대조: 락 미등재/수정 = 오류(재생성+검수 강제)·ja 같은데 yomi 불일치 = 오류·
 *       락에 있는데 사라진 문장 = 경고·KO_MIXED(한글 섞임) = 오류. 문장 전체를 박으므로 가나-온리 무검사·
 *       오쿠리가나 오독(来ます→くます)·정렬 아티팩트 오염(建物→たても)이 한 번에 소멸한다.
 *   G7  기대 독음 사전(yomi-map.json) 대조 — 보조 진단(강등). YLOCK이 주 게이트이므로 G7 불일치는
 *       경고. 신규 문장 초안 작성 시 한자별 허용 독음 참고용으로만 유지한다(완전 삭제 금지).
 *   ID  전 문항·드릴 item의 id 존재 + 트랙 전체 유일 + 형식 검사(P3-11). 누락·중복·형식 위반 = 오류.
 *   Q   문항 스키마·정답 유효·choices 4개·choices 내 중복 = 오류(P2-10)·pattern 문항 newPatterns 전수 커버
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

/**
 * 문형 pattern → alt 그룹 배열(P1-2·P1-3). 각 그룹은 "같은 출현"을 뜻하는 별칭 배열이다.
 *   - 라틴 대문자·한글 단어(플레이스홀더)는 슬롯(〜)으로 치환 후 리터럴만 남긴다 → 면제 없이 전 문형 검사.
 *   - 그룹 내 별칭(何·なん·なに)은 같은 토큰의 이표기/요미 → 카운트는 max(이중 계상 차단).
 *   - 그룹 간(これ/それ/あれ, あります/います)은 서로 다른 출현 → 합산.
 * 리터럴이 하나도 없으면 빈 배열(호출부에서 형태소 검사 또는 하드 오류로 처리).
 */
function patternGroups(pattern) {
  // 플레이스홀더(라틴·한글 런) → 슬롯. です·のまえに 등 일본어 리터럴은 그대로 남는다.
  const p = String(pattern).replace(/[A-Za-z]+/g, '〜').replace(/[가-힣]+/g, '〜');
  const groups = [];
  for (const alt of splitTopLevel(p)) {
    // 괄호 독음(같은 토큰의 이표기/요미) → 이 그룹의 별칭
    const readings = [];
    for (const m of alt.matchAll(/[（(]([^）)]+)[）)]/g))
      for (const inner of m[1].split(/[/／・]/)) {
        const s = inner.replace(/[\s　〜～~＋+]/g, '');
        if (s && /[぀-ヿ一-龯]/.test(s) && !/[가-힣A-Za-z]/.test(s)) readings.push(s);
      }
    const noParen = alt.replace(/[（(][^）)]*[）)]/g, '');
    // 슬롯·공백·+ 를 경계로 리터럴 조각 분해. 공백도 경계다 —
    // 'AとBと どちらが'의 と와 どちらが를 붙이면 본문에 없는 'とどちらが'가 된다.
    const frags = noParen.split(/[～〜~＋+\s　]/)
      .map((s) => s.trim())
      .filter((s) => s && /[぀-ヿ一-龯]/.test(s) && !/[가-힣A-Za-z]/.test(s));
    if (frags.length) {
      frags.sort((a, b) => b.length - a.length);       // 가장 긴 리터럴 = 대표(조사보다 내용어)
      groups.push([...new Set([frags[0], ...readings])]);
    } else if (readings.length) {
      groups.push([...new Set(readings)]);
    }
  }
  return groups;
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
  const bodyJa = (t) => (t.body || []).map((b) => b.ja || '').join('');

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

  // ── G4: 신규 문형 본문 실재(어간 매칭, P1-2·P1-3) ──
  // 카운트 규칙:
  //   · 어간 길이 ≥3 이고 마지막 글자가 활용 어미(CONJ_END)일 때만 → 1글자 유연화(slice) 후 부분 문자열.
  //     활용 종결(食べる·行きます류)은 본문에서 활용해 어미가 바뀌므로 완화가 필요하다.
  //     하지만 どちらが·どちらも처럼 조사·의문사 종결(が·も·の)은 완화하면 どちら만 남아 どちらも가
  //     どちらが 문형에 오통과된다(P1-3) → 활용 어미가 아닌 종결은 완화 없이 정확 일치를 요구한다.
  //   · 그 외 → 부분 문자열. 조사·접미(は·を·たい·かた)는 문절 중간에 정당히 붙으므로 경계를 강제하지 않는다.
  //   · 예외 〜だ: 절말 종지사라 まだ·まだです의 だ에 오계상되기 쉽다 → "절말 경계(뒤가 종지 구두점·문말)"를
  //     요구해 실제 종지형 〜だ만 센다(P1-3의 まだです 차단). 공백은 절말 경계에서 제외(だ 뒤에 조사가 붙지 않음).
  //   · 그룹 내 별칭(何·なん·なに)은 max(같은 출현의 이표기 이중 계상 차단), 그룹 간은 합산.
  const CLAUSE_END = /[。、！？!?」』]/;
  const CONJ_END = new Set([...'るすたていうくぐむぶぬ']); // 활용 어미(형용사 ね 제외 — 신중히)
  const countIn = (hay, key) => { let c = 0, i = 0; while ((i = hay.indexOf(key, i)) !== -1) { c++; i += key.length; } return c; };
  const countClauseFinal = (text, key) => {
    let c = 0, i = 0;
    while ((i = text.indexOf(key, i)) !== -1) { const a = text[i + key.length]; if (a === undefined || CLAUSE_END.test(a)) c++; i += key.length; }
    return c;
  };
  for (const t of texts) {
    const flat = bodyJa(t).replace(/[\s　]/g, '');
    const flatYomi = (t.body || []).map((b) => b.yomi || '').join('').replace(/[\s　]/g, '');
    const spacedJa = (t.body || []).map((b) => b.ja || '').join('\n');   // 절말 경계 검사용(공백·문말 보존)
    const spacedYomi = (t.body || []).map((b) => b.yomi || '').join('\n');
    const aliasCount = (a, clauseFinal) => {
      if (clauseFinal) return Math.max(countClauseFinal(spacedJa, a), countClauseFinal(spacedYomi, a));
      if (a.length >= 3 && CONJ_END.has(a[a.length - 1])) { const key = a.slice(0, -1); return Math.max(countIn(flat, key), countIn(flatYomi, key)); }
      return Math.max(countIn(flat, a), countIn(flatYomi, a));
    };
    for (const p of (t.newPatterns || [])) {
      const clauseFinal = p === '〜だ';                  // 절말 경계 요구 대상(현재 유일)
      // 'い형용사 + 명사' — 리터럴이 없으므로 형태소 인접(形容詞 자립·い활용 + 直後 名詞)을 kuromoji로 센다.
      if (isIAdjNounPattern(p)) {
        if (!ctx.tokenizer) continue;
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
      const groups = patternGroups(p);
      if (!groups.length) { E('G4', `글${t.order} 검증 불가 문형(리터럴 부재): ${p}`); continue; } // 하드 게이트(면제 없음)
      let total = 0, minRep = Infinity;
      for (const g of groups) {
        minRep = Math.min(minRep, g[0].length);           // 대표(첫 별칭) 길이 — need 판정용
        total += Math.max(...g.map((a) => aliasCount(a, clauseFinal)));  // 그룹 내 max
      }
      // 1자 어간(は·を 등 편재 조사)만 ≥1. 〜だ는 정중체 본문에서 저절로 늘지 않으므로 예외 없이 ≥2.
      const need = (minRep <= 1 && p !== '〜だ') ? 1 : 2;
      if (total < need) E('G4', `글${t.order} 신규 문형 본문 미실재: ${p} (출현 ${total}<${need})`);
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
    for (const key of Object.keys(ctx.yomiLock))
      if (!seen.has(key)) W('YLOCK-gone', `락 문장이 콘텐츠에서 사라짐: ${key} (락 ja: ${ctx.yomiLock[key].ja})`);
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

  // ── Q: 문항 ──
  for (const t of texts) {
    const patternQ = [];
    for (const q of (t.questions || [])) {
      if (!['pattern', 'content'].includes(q.type)) E('Q-type', `글${t.order} 문항 type 위반: ${q.type}`);
      const ch = q.choices || [];
      if (ch.length !== 4) E('Q-choices', `글${t.order} choices ${ch.length}개(≠4)`);
      if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < ch.length))
        E('Q-answer', `글${t.order} 정답 인덱스 무효: ${q.answer}`);
      else {
        const ans = ch[q.answer];
        if (ch.filter((c) => c === ans).length > 1) E('Q-distract', `글${t.order} distractor=정답 중복: ${ans}`);
      }
      // distractor끼리의 중복도 오류로 승격(P2-10) — 같은 선택지 2개는 4지선다를 사실상 3지로 만든다.
      if (new Set(ch).size !== ch.length)
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
    }
    const covered = new Set(patternQ);
    for (const p of (t.newPatterns || []))
      if (!covered.has(p)) E('Q-cover', `글${t.order} pattern 문항 미커버 신규 문형: ${p}`);
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

// ── 자가 테스트: 정상 베이스라인 + 결함 주입(기존 10종 + 강화 7종) ──
async function selfTest() {
  const tokenizer = await getTokenizer();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // 소형 유니버스(R∪D). 베이스라인은 전 검사 통과.
  const universe = new Set([
    '〜です', '〜ます', '〜ました', '〜は',
    'AはBより〜', 'AとBと どちらが', 'い형용사 + 명사', '何(なん/なに)', '〜だ',
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

  // 테스트용 기대 독음 사전 — 베이스라인 본문에서 실 생성 로직과 같은 정렬로 구성 →
  // 베이스라인은 G7 통과, 신규 표면형 주입 시에만 G7-map이 뜬다(맵 미등재 픽스처 유효).
  const yomiMap = {};
  for (const t of baseline.texts) for (const b of t.body) {
    if (!b.ja || !b.yomi) continue;
    const { ok, readings } = extractReadings(b.ja, b.yomi);
    if (!ok) continue;
    for (const { surface, reading } of readings) {
      (yomiMap[surface] ||= []);
      if (!yomiMap[surface].includes(reading)) yomiMap[surface].push(reading);
    }
  }

  // 문장 단위 요미 락 — 베이스라인 본문에서 실 생성 로직(build-yomi-lock)과 같은 정규화로 구성 →
  // 베이스라인은 YLOCK 통과, 신규·수정·오독 주입 시에만 YLOCK-*가 뜬다.
  const yomiLock = {};
  for (const t of baseline.texts) {
    const body = t.body || [];
    for (let i = 0; i < body.length; i++) {
      const b = body[i];
      if (!b.ja || !b.yomi) continue;
      yomiLock[`${t.id}#${i}`] = { ja: normLock(b.ja), yomi: normLock(b.yomi) };
    }
  }

  const ctx = { patternUniverse: universe, dgroup, vocabPool, placeYomi: PLACE_YOMI, tokenizer, yomiMap, yomiLock, skipFurigana: true };

  // 베이스라인은 오류 0이어야 자가테스트가 유효
  const baseRes = runChecks(clone(baseline), ctx);
  if (baseRes.errors.length) {
    console.error('✗ 자가테스트 베이스라인이 오류를 냄(테스트 무효):');
    baseRes.errors.forEach((e) => console.error(`   [${e.code}] ${e.msg}`));
    process.exit(1);
  }

  // 결함 주입 — [이름, 기대 코드, 변형 함수, 검사대상('error' 기본 | 'warn')].
  // 기존 17종(G1·G4·G5·G6·Q·DR + 강화) + 신규 5종(YLOCK 3·G4 조사 정확일치·문항 id) = 22종.
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
    ['중복 distractor', 'Q-dup', (t) => { t.texts[0].questions[2].choices = ['学生', '先生', '先生', '駅員']; }],
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
  ];

  let detected = 0;
  for (const [name, code, mutate, where] of fixtures) {
    const t = clone(baseline);
    mutate(t);
    const { errors, warns } = runChecks(t, ctx);
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
