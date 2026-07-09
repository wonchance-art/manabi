#!/usr/bin/env node
/**
 * 독해 트랙 결정적 검증기 — 기획 docs/plan-reading-track-pilot.md §6(P3) 항목을 코드로 고정한다.
 * 대상: src/content/japanese/reading/n5_tokyo.js (M2 시점엔 아직 없음 → 부재 시 검사 생략 후 exit 0).
 *
 * 실행:
 *   node scripts/check-reading.mjs             트랙 파일 검증(없으면 생략)
 *   node scripts/check-reading.mjs --self-test 내장 픽스처 6종 자가 검출 테스트
 *
 * 검사 항목(코드):
 *   G1  전 글 newPatterns ∪ 전 드릴 patterns = bunkei N5 pattern 125 전수·중복 0·부재 0
 *   ORD 글 order 오름차순·중복 없음(i+1 도입 순서)
 *   G4  신규 문형이 그 글 본문에 어간 매칭 ≥2회(조사 1글자 문형은 ≥1회)
 *   G5  본문 내용어(명사·동사·형용사·부사) 기본형이 어휘 풀 ∪ 지명에 존재
 *   G6  본문 yomi 정렬(check-furigana spawn) + 지명 요미 대조(하드코딩 사전 이중 고정)
 *   Q   문항 스키마·정답 유효·distractor≠정답·choices 4개·pattern 문항 newPatterns 전수 커버
 *   FR  〜ました 도입 order 이전 글에 frame:'narration' 금지
 *   DR  drills[].patterns = 표 2 D군 13개 일치·style·items 스키마 존재
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { getTokenizer } = require('./reading/derive-yomi.cjs');

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
/** 문형 pattern → 본문 실재 검사용 어간 후보 배열(한국어/라틴 플레이스홀더 포함 문형은 검증 불가로 제외) */
function patternStems(pattern) {
  const stems = [];
  let p = String(pattern);
  // 괄호 병기 독음(何(なん/なに), 〜くらい(ぐらい))을 "분리보다 먼저" 대안으로 추출·제거 —
  // 괄호 안의 /를 대안 경계로 자르면 何(なん·なに) 같은 깨진 어간이 생긴다.
  for (const m of p.matchAll(/[（(]([^）)]+)[）)]/g))
    for (const inner of m[1].split(/[/／・]/))
      if (inner && !/[가-힣A-Za-z]/.test(inner)) stems.push(inner.replace(/[\s　]/g, ''));
  p = p.replace(/[（(][^）)]*[）)]/g, '');
  // 대안 분리: ・、 외에 /·／(これ/それ/あれ, あります/います)도 경계다.
  const alts = p.split(/[・、/／]/);
  for (let alt of alts) {
    // 〜(슬롯)·+ 를 경계로 리터럴 조각을 나누고 가장 긴 "일본어" 조각을 어간으로 —
    // 다중 슬롯 문형(〜は 〜に あります)에서 조각을 이어붙이면 본문에 절대 없는 문자열이 되고,
    // 한글 플레이스홀더(あの + 명사)를 alt째 버리면 딸린 일본어 조각(あの)까지 잃는다.
    const segs = alt.split(/[～〜~＋+]/)
      .map((s) => s.replace(/[\s　]/g, ''))
      .filter((s) => s && !/[가-힣A-Za-z]/.test(s));
    if (!segs.length) continue;
    segs.sort((a, b) => b.length - a.length);
    stems.push(segs[0]);
    // 조사+용언 조각(がでけます 류)은 부사 삽입(が 少し できます)으로 연속이 깨진다 — 용언부도 대안으로
    const m2 = segs[0].match(/^[がをにはでとへも]([぀-ヿ一-龯]{3,})$/);
    if (m2) stems.push(m2[1]);
  }
  return stems;
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

  // ── G4: 신규 문형 본문 실재(어간 매칭) ──
  // 본문은 공백 제거(flat) — 하우스 스타일(단어 사이 띄어쓰기)과 무관하게 매칭.
  // 대안 문형(これ/それ/あれ 등)은 "합산" 출현으로 판정 — 어느 하나만 여러 번 나와도 정상 사용이다.
  for (const t of texts) {
    const flat = bodyJa(t).replace(/[\s　]/g, '');
    // 요미(히라가나) 본문도 대조 — 본문이 한자 표기(少し·後で)여도 가나 어간(すこし·あとで)이 잡힌다.
    const flatYomi = (t.body || []).map((b) => b.yomi || '').join('').replace(/[\s　]/g, '');
    const countIn = (hay, key) => { let c = 0, i = 0; while ((i = hay.indexOf(key, i)) !== -1) { c++; i += key.length; } return c; };
    for (const p of (t.newPatterns || [])) {
      const stems = patternStems(p);
      if (!stems.length) continue; // 플레이스홀더 문형은 실재 검사 면제
      let total = 0, minLen = Infinity;
      for (const stem of stems) {
        minLen = Math.min(minLen, stem.length);
        const key = stem.length >= 3 ? stem.slice(0, -1) : stem; // 활용 어미 1글자 유연화(최소 2자)
        total += Math.max(countIn(flat, key), countIn(flatYomi, key)); // 표기·요미 중 큰 쪽(이중 계상 방지)
      }
      if (total < (minLen <= 1 ? 1 : 2)) E('G4', `글${t.order} 신규 문형 본문 미실재: ${p}`);
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

  // ── G6(지명 요미 대조): 본문에 지명이 등장하면 해당 요미가 정답과 일치 ──
  for (const t of texts) {
    for (const b of (t.body || [])) {
      if (!b.ja) continue;
      // 긴 지명 우선 — 浅草寺 안의 浅草처럼 더 긴 지명의 부분 문자열이면 짧은 쪽 검사를 건너뛴다.
      const names = Object.keys(ctx.placeYomi).sort((a, c) => c.length - a.length);
      let masked = b.ja;
      for (const pja of names) {
        if (!masked.includes(pja)) continue;
        masked = masked.split(pja).join(' '.repeat(pja.length));
        const pyomi = ctx.placeYomi[pja];
        const y = kataToHira((b.yomi || '').replace(/\s+/g, ''));
        if (!y.includes(kataToHira(pyomi)))
          E('G6-place', `글${t.order} 지명 요미 불일치: ${pja} → 요미에 '${pyomi}' 없음 (yomi: ${b.yomi || '(없음)'})`);
      }
    }
  }
  // 트랙 places 사전 vs 하드코딩 이중 고정
  for (const p of (track?.places || [])) {
    if (p.ja && PLACE_YOMI[p.ja] && p.yomi && kataToHira(p.yomi) !== kataToHira(PLACE_YOMI[p.ja]))
      E('G6-place', `places 사전 요미 불일치: ${p.ja} ${p.yomi} ≠ 정답 ${PLACE_YOMI[p.ja]}`);
  }

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
  for (let i = 0; i < drills.length; i++) {
    const d = drills[i];
    if (!d.style) E('DR', `드릴${i + 1} style 누락`);
    if (!Array.isArray(d.items)) E('DR', `드릴${i + 1} items 누락`);
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
  for (const f of vocabFiles) {
    const m = (await import(new URL(`../src/content/japanese/vocab/${f}.js`, import.meta.url))).default;
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
  return { patternUniverse, dgroup: DGROUP, vocabPool, placeYomi: PLACE_YOMI, tokenizer, skipFurigana: false };
}

// ── 자가 테스트: 정상 베이스라인 + 6종 결함 주입 ──
async function selfTest() {
  const tokenizer = await getTokenizer();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // 소형 유니버스(R∪D). 베이스라인은 전 검사 통과.
  const universe = new Set(['〜です', '〜ます', '〜ました', '〜は']);
  const dgroup = ['〜は'];

  const baseline = {
    track: 'st', title: '자가테스트', level: 'N5',
    places: [],
    texts: [
      {
        order: 1, place: { name: '역', ja: '駅', landmark: 'station' }, frame: 'dialogue',
        newPatterns: ['〜です', '〜ます'],
        body: [
          { ja: '私は学生です。ここは駅です。', yomi: '', ko: '' },
          { ja: '本を読みます。水を飲みます。', yomi: '', ko: '' },
        ],
        questions: [
          { type: 'pattern', pattern: '〜です', q: 'Q', choices: ['です', 'ます', 'でした', 'ません'], answer: 0, why: 'w' },
          { type: 'pattern', pattern: '〜ます', q: 'Q', choices: ['ます', 'です', 'ました', 'ません'], answer: 0, why: 'w' },
          { type: 'content', q: 'Q', choices: ['学生', '先生', '医者', '駅員'], answer: 0 },
        ],
      },
      {
        order: 2, place: { name: '역', ja: '駅', landmark: 'station' }, frame: 'dialogue',
        newPatterns: ['〜ました'],
        body: [
          { ja: '駅に行きました。バスに乗りました。', yomi: '', ko: '' },
        ],
        questions: [
          { type: 'pattern', pattern: '〜ました', q: 'Q', choices: ['ました', 'ます', 'です', 'ません'], answer: 0, why: 'w' },
        ],
      },
    ],
    drills: [
      { patterns: ['〜は'], style: 'particle-choice', items: [{ q: 'Q', choices: ['は', 'が', 'を', 'に'], answer: 0 }] },
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

  const ctx = { patternUniverse: universe, dgroup, vocabPool, placeYomi: PLACE_YOMI, tokenizer, skipFurigana: true };

  // 베이스라인은 오류 0이어야 자가테스트가 유효
  const baseRes = runChecks(clone(baseline), ctx);
  if (baseRes.errors.length) {
    console.error('✗ 자가테스트 베이스라인이 오류를 냄(테스트 무효):');
    baseRes.errors.forEach((e) => console.error(`   [${e.code}] ${e.msg}`));
    process.exit(1);
  }

  // 6종 결함 주입 — [이름, 기대 코드, 변형 함수]
  const fixtures = [
    ['전수 누락', 'G1-missing', (t) => { t.texts[1].newPatterns = []; }],
    ['중복 도입', 'G1-dup', (t) => { t.texts[1].newPatterns.push('〜です'); }],
    ['풀 밖 어휘', 'G5', (t) => { t.texts[0].body.push({ ja: '猫が公園を走ります。', yomi: '', ko: '' }); }],
    ['지명 요미 불일치', 'G6-place', (t) => { t.texts[1].body.push({ ja: 'ここは渋谷です。', yomi: 'ここはとうきょうです。', ko: '' }); }],
    ['pattern 문항 커버 누락', 'Q-cover', (t) => { t.texts[0].questions = t.texts[0].questions.filter((q) => q.pattern !== '〜ます'); }],
    ['미실재 신규 문형', 'G4', (t) => { t.texts[0].body = []; }],
  ];

  let detected = 0;
  for (const [name, code, mutate] of fixtures) {
    const t = clone(baseline);
    mutate(t);
    const { errors } = runChecks(t, ctx);
    const hit = errors.some((e) => e.code === code);
    console.log(`  ${hit ? '✓' : '✗'} ${name} — 기대코드 ${code} ${hit ? '검출' : '미검출'}`);
    if (hit) detected++;
    else errors.forEach((e) => console.log(`       (실제: [${e.code}] ${e.msg})`));
  }
  console.log(`\n자가테스트: ${detected}/6 검출`);
  process.exit(detected === fixtures.length ? 0 : 1);
}

// ── 진입점 ──
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  if (!existsSync(TRACK_ABS)) {
    console.log(`트랙 파일 없음(${TRACK_REL}), 검사 생략`);
    process.exit(0);
  }
  const track = (await import(new URL('../' + TRACK_REL, import.meta.url))).default;
  const ctx = await buildRealContext();
  const { errors, warns } = runChecks(track, ctx);
  for (const w of warns) console.warn('⚠', `[${w.code}] ${w.msg}`);
  for (const e of errors) console.error('✗', `[${e.code}] ${e.msg}`);
  console.log(`\n독해 트랙 검증 — 오류 ${errors.length} · 경고 ${warns.length}`);
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
