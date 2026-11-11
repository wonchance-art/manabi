// 교재 N5(8a8c) 1단계 문자열 표 생성기 — 본문 틀 8필드(WEB stage1Eligibility) · 오케스트레이터 판정 11/11 KST(1~4차) · 오너 승인 2026-11-11 KST. 읽기 전용.
// 실행(리포 루트): node scripts/textbooks/ja-n5-stage1-generate.mjs <repo> <raw.json> scripts/textbooks/n5-notation/n5-8a8c-stage1-blocked.txt
//   이어서 ja-n5-stage1-check.mjs → ja-n5-stage1-assemble.mjs(정본 표 · 패치). 분석기(tokenizeJa)를 그대로 부르므로 제품 import 훅을 먼저 등록한다.
import '../eval/productImportHooks.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const root = process.argv[2];
const { tokenizeJaLine } = await import(root + '/src/lib/server/tokenizeJa.js');
const { loadSpec, stems } = await import(root + '/scripts/ja-kanji-a2.mjs');
const spec = loadSpec();
const JOYO = JSON.parse(readFileSync(root + '/src/lib/data/jaJoyo.json', 'utf8')).r;
const b = JSON.parse(readFileSync(root + '/src/content/textbookEditions/8a8c1c1fd452773810abaf8c/bundle.json', 'utf8'));
const M = b.manuscript;
const k2h = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanaOnly = (s) => /^[ぁ-ゟァ-ヿー〜～]+$/.test(s);
const hasKanji = (s) => /[一-鿿々]/.test(s);
// 付表(숙자훈) — 상용한자표 부표 중 N5 · N4 범위
const FUHYO = new Set(['今日', '明日', '昨日', '今年', '今朝', '大人', '一人', '二人', '時計', '部屋', '眼鏡', '上手', '下手', '一日', '二日', '果物', '景色', '博士', '真面目', '父さん', 'お父さん', '母さん', 'お母さん', '兄さん', 'お兄さん', '姉さん', 'お姉さん', '友達', '七夕', '八百屋', '二十歳', '二十日', '迷子', '眼鏡', '下手', '上手', '風邪', '今年']);
const variants = (r) => {
  const out = new Set([r]);
  const dak = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
  const han = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
  const f = r[0];
  if (dak[f]) out.add(dak[f] + r.slice(1));
  if (han[f]) out.add(han[f] + r.slice(1));
  for (const x of [...out]) if (/[つちくき]$/.test(x) && x.length > 1) out.add(x.slice(0, -1) + 'っ');
  if (f === 'じ') out.add('ぢ' + r.slice(1));
  return out;
};
const readingsOf = (c) => {
  const raw = JOYO[c]; if (!raw) return null;
  const s = new Set();
  const RENYO = { く: 'き', る: 'り', す: 'し', つ: 'ち', う: 'い', む: 'み', ぶ: 'び', ぬ: 'に', ぐ: 'ぎ' };
  for (const x of raw.split(',')) {
    const [stem0, oku = ''] = x.replace(/\*/g, '').split('.');
    const stem = k2h(stem0); if (!stem) continue;
    const forms = [stem];
    if (oku) { forms.push(stem + oku.slice(0, -1)); const last = oku.slice(-1); if (RENYO[last]) forms.push(stem + oku.slice(0, -1) + RENYO[last]); }
    for (const f of forms) for (const v of variants(f)) { s.add(v); s.add(v + 'っ'); }
  }
  return s;
};
/** 철자의 읽기가 상용한자 음훈으로 설명되나(오쿠리가나 · 가나 글자는 그대로). */
function joyoReadable(spelling, kana) {
  if (FUHYO.has(spelling)) return true;
  const chars = [...spelling];
  if (chars.some((c) => hasKanji(c) && !JOYO[c] && c !== '々')) return false;
  const memo = new Map();
  const go = (i, j) => {
    const key = i + ',' + j; if (memo.has(key)) return memo.get(key);
    let ok = false;
    if (i === chars.length) ok = j === kana.length;
    else if (!hasKanji(chars[i])) ok = kana[j] === k2h(chars[i]) && go(i + 1, j + 1);
    else {
      const rs = chars[i] === '々' ? readingsOf(chars[i - 1]) : readingsOf(chars[i]);
      for (const r of rs || []) if (kana.startsWith(r, j) && go(i + 1, j + r.length)) { ok = true; break; }
    }
    memo.set(key, ok); return ok;
  };
  return go(0, 0);
}
// 공개 자료 고정표: 가나 읽기 → 결정
const pubByKana = new Map();
for (const [base, [text, kana]] of Object.entries(spec.a2.write)) pubByKana.set(kana, { decision: 'kanji', spelling: text, base });
for (const k of spec.a2.keepKanaA2) if (!hasKanji(k)) pubByKana.set(k, { decision: 'kana' });
const KANA_NATURAL = new Set(['きれい', 'にぎやか', 'ちょうど', 'もちろん', 'たくさん', 'いろいろ', 'ちょっと', 'とても', 'ぜひ', 'やっぱり', 'すぐ', 'まだ', 'もう', 'よく', 'ほんとうに', 'いっぱい', 'だんだん', 'ゆっくり', 'しっかり', 'そろそろ', 'たまに', 'なかなか', 'ほとんど', 'ずっと', 'きっと', 'たぶん', 'ください', 'おいしい', 'すし', 'おなか', 'うち', 'こと', 'もの', 'とき', 'ところ', 'ため', 'はず', 'つもり', 'わけ', 'ほう', 'あと', 'ごろ', 'ぐらい', 'くらい', 'など', 'ほか', 'いい', 'よい', 'できる', 'ある', 'いる', 'する', 'なる', 'くる', 'いく', 'みる', 'おく', 'しまう', 'あげる', 'くれる', 'もらう', 'いただく', 'くださる', 'すみません', 'ありがとう', 'おはよう', 'こんにちは', 'こんばんは', 'さようなら', 'すごい', 'かっこいい', 'かわいい', 'うれしい', 'だめ', 'いや', 'ほか']);
const AMBIG = new Set(['ほんとう', 'ほんと', 'あとで', 'いちばん', 'みんな', 'たち', 'ふたり', 'ひとり', 'わかる', 'あう', 'ある', 'いう', 'おもう', 'みせる', 'つける', 'かける', 'とる', 'でる', 'いれる', 'あく', 'しめる', 'ちかく', 'まえ', 'うしろ', 'あいだ', 'ほか', 'じぶん', 'たのしみ', 'だいじょうぶ', 'ざんねん', 'しんぱい', 'ひさしぶり']);
const lex = M.lexicon;
const ORTHO_SAME = new Set(['子ども|子供', '朝御飯|朝ご飯', '御飯|ご飯', '昼御飯|昼ご飯', '友だち|友達', '晩御飯|晩ご飯']);
const spellsByKana = new Map();
for (const e of lex) { const sp = (e.spellings || []).find(hasKanji); if (!sp || !isKanaOnly(e.ja)) continue; if (!spellsByKana.has(e.ja)) spellsByKana.set(e.ja, new Set()); spellsByKana.get(e.ja).add(sp); }
const homonym = (ja, pubSp) => {
  const set = new Set(spellsByKana.get(ja) || []);
  if (set.size > 1) return true;
  const one = [...set][0];
  return Boolean(pubSp && one && one !== pubSp && !ORTHO_SAME.has(one + '|' + pubSp));
};
const decisions = [];
for (const e of lex) {
  const ja = e.ja.replace(/^[〜～]/, ''); const sp0 = (e.spellings || []).flatMap((x) => String(x).split(/[;；]\s*/)).find(hasKanji); const sp = sp0 ? sp0.replace(/^[〜～]/, '') : sp0;
  let d; let why;
  if (!isKanaOnly(ja)) { d = 'already'; why = '원고 표제어가 이미 한자'; }
  else if (homonym(ja, pubByKana.get(ja)?.spelling)) { d = 'homonym'; why = '같은 가나 · 다른 낱말 — 문맥 판정'; }
  else if (pubByKana.has(ja)) { const p = pubByKana.get(ja); d = p.decision; why = '공개 자료 고정표와 같음'; if (d === 'kanji') e._sp = p.spelling; }
  else if (!sp) { d = 'kana'; why = '한자 철자 없음'; }
  else if (KANA_NATURAL.has(ja)) { d = 'kana'; why = '보통 가나로 쓰는 말'; }
  else if (!joyoReadable(sp, ja)) { d = 'kana'; why = '상용한자표 밖 읽기 · 아테지'; }
  else if (AMBIG.has(ja)) { d = 'ambiguous'; why = '판단 필요'; }
  else { d = 'kanji'; why = '상용 읽기'; }
  decisions.push({ id: e.id, unit: e.unit, ja, spelling: d === 'kanji' ? (e._sp || sp) : null, cand: sp || null, pos: e.pos, decision: d, why });
}
// 적용: 10–42과 일본어 문자열을 토큰으로 나눠 표제어가 kanji 판정인 가나 토큰을 바꾼다
const byKana = new Map(decisions.filter((x) => x.decision === 'kanji').map((x) => [x.ja, x]));
const HOMO = new Set(decisions.filter((x) => x.decision === 'homonym').map((x) => x.ja));
for (const [kana, p] of pubByKana) if (p.decision === 'kanji' && !byKana.has(kana) && !HOMO.has(kana)) byKana.set(kana, { ja: kana, spelling: p.spelling, pos: null, decision: 'kanji' });
const lexPos = (p) => { const s = String(p || ''); if (/동사/.test(s) && !/감동사/.test(s)) return ['동사']; if (/い형용사/.test(s)) return ['형용사']; if (/な형용사/.test(s)) return ['형용동사', '명사', '부사']; if (/부사/.test(s)) return ['부사', '명사']; if (/명사|대명사|의문사|조수사|접미/.test(s)) return ['명사']; return null; };
const posOk = (dec, t) => { if (!dec.pos) return true; const ok = lexPos(dec.pos); return ok ? ok.includes(t.pos) : false; };
const CONTENT = new Set(['명사', '동사', '형용사', '형용동사', '부사']);
// ───────── 1단계(본문 틀 4필드) 문자열 표 — WEB 정의(n5-derive-notation 94a30ddd)와 오케스트레이터 판정 11/11 ─────────
const RULING = { ひとり: '一人', ふたり: '二人', でる: '出る', あく: '開く' }; // わかる: 교재 전체 가나(오케스트레이터 11/11 2차)
for (const d of decisions) if (d.decision === 'ambiguous') {
  if (RULING[d.ja]) { d.decision = 'kanji'; d.spelling = RULING[d.ja]; d.why = '판단 → 한자(오케스트레이터 11/11)'; } else { d.decision = 'kana'; d.why = '판단 → 가나(오케스트레이터 11/11)'; }
}
for (const d of decisions) if (d.ja === 'おく' && d.decision === 'kana') { d.decision = 'kanji'; d.spelling = '置く'; d.why = '본동사 置く · ～ておく는 가나(오케스트레이터 11/11)'; }
const OKURI = { 終る: '終わる' };
for (const d of decisions) if (d.spelling && OKURI[d.spelling]) { d.spelling = OKURI[d.spelling]; d.why += ' · 送り仮名 본則'; }
const kanjiDec = new Map(); const bySp = new Map();
for (const d of decisions) if (d.decision === 'kanji' && d.spelling) { if (!kanjiDec.has(d.ja)) kanjiDec.set(d.ja, d); bySp.set(d.spelling, d); }
for (const [kana, p] of pubByKana) if (p.decision === 'kanji' && !kanjiDec.has(kana) && !HOMO.has(kana)) { const d = { ja: kana, spelling: p.spelling, pos: null, decision: 'kanji' }; kanjiDec.set(kana, d); bySp.set(p.spelling, d); }
// 어휘 목록 밖 낱말 판정(오케스트레이터 11/11 2차)
const OUTSIDE_KANJI = { あつまり: '集まり', つかう: '使う', べんり: '便利', じゅんび: '準備', ふべん: '不便', だいがくせい: '大学生', うんてん: '運転', きらい: '嫌い', にもつ: '荷物', なんども: '何度も', らいねん: '来年', つかれる: '疲れる', しゅみ: '趣味', おしえる: '教える', だいじょうぶ: '大丈夫', ぜんぜん: '全然', ねんれい: '年齢', いっしゅうかん: '一週間', ことし: '今年', つまる: '詰まる', しらべる: '調べる', あじ: '味', にがい: '苦い', はしる: '走る', くち: '口', しかた: '仕方', かんたん: '簡単' };
// 분석기가 가나 문장을 잘못 나누는 낱말 — 공개 고정표 · 원고 어휘 판정 그대로 표기(오케스트레이터 11/11 2차 「넓힌 검사」)
const FORCE = {
  いっしゅうかん: ['一週間', 'いっしゅうかん', /^[にでの]|^$/], しかた: ['仕方', 'しかた', /^$|^[をがは]/], かんたん: ['簡単', 'かんたん', /^[なにで]/], ねんれい: ['年齢', 'ねんれい', /^[：:のは]|^$/],
  あるいて: ['歩く', 'あるく', /^$/], ゆうめい: ['有名', 'ゆうめい', /^な/], おねがい: ['お願い', 'おねがい', /^し/],
  ちかく: ['近く', 'ちかく', /^[のにでは]/], おなじ: ['同じ', 'おなじ', /^$/], いきたい: ['行く', 'いく', /^[でか]/], なんようび: ['何曜日', 'なんようび', /^[にでか]/], おおきな: ['大きな', 'おおきな', /^$/], ちいさな: ['小さな', 'ちいさな', /^$/],
};
const OUTSIDE_KANA = ['いちばん', 'みかん', 'けいたい', 'あたたかい'];
for (const [ja, sp] of Object.entries(OUTSIDE_KANJI)) { if (!kanjiDec.has(ja)) { const d = { ja, spelling: sp, pos: null, decision: 'kanji', why: '어휘 목록 밖 · 오케스트레이터 승인' }; kanjiDec.set(ja, d); bySp.set(sp, d); } }
for (const d of decisions) if (d.ja === 'わかる') { d.decision = 'kana'; d.spelling = null; d.why = '교재 전체 가나(分=ふん 지도 과 · 오케스트레이터 11/11 2차)'; }
kanjiDec.delete('わかる');
const kanaDecided = new Set([...decisions.filter((d) => d.decision === 'kana').map((d) => d.ja), ...OUTSIDE_KANA]);
// 동음이의: 가나 → 원고 어휘 항목들(뜻 · 단원)
const homoEntries = new Map();
for (const e of lex) { const ja = e.ja.replace(/^[〜～]/, ''); if (!HOMO.has(ja)) continue; const sp = (e.spellings || []).flatMap((x) => String(x).split(/[;；]\s*/)).find(hasKanji); if (!sp) continue; if (!homoEntries.has(ja)) homoEntries.set(ja, []); homoEntries.get(ja).push({ sp: sp.replace(/^[〜～]/, ''), ko: e.ko, unit: e.unit, pos: e.pos }); }
const koKeys = (ko) => String(ko || '').split(/[;,·／/()（）\s]+/).map((x) => x.replace(/[~〜～]/g, '').trim()).filter((x) => x.length >= 1 && !/[ぁ-ヿ一-鿿]/.test(x) && !/과$|읽기표$|그룹$/.test(x)).flatMap((x) => { const st = x.replace(/다$/, ''); return x.endsWith('다') ? [st, ...(st.length >= 2 ? [st.slice(0, -1)] : [])] : [x]; }).filter(Boolean);
// 1글자 명사 후보: 가나 1글자 → 한자 철자 어휘
const oneChar = new Map();
for (const e of lex) { if ([...e.ja].length !== 1 || !/명사/.test(e.pos)) continue; const sp = (e.spellings || []).find(hasKanji); if (sp) oneChar.set(e.ja, { sp, ko: e.ko }); }
for (const x of ['ご', 'し', 'に']) oneChar.delete(x); // 숫자 — N5 본문은 아라비아 숫자
for (const [k, sp, ko] of [['て', '手', '손'], ['め', '目', '눈'], ['き', '木', '나무'], ['は', '歯', '이'], ['え', '絵', '그림'], ['ひ', '日', '날 · 해'], ['け', '毛', '털']]) if (!oneChar.has(k)) oneChar.set(k, { sp, ko, outsideLexicon: true });
// 음편 대안: 가나 활용형에서 가능한 기본형들
const ONBIN = { ん: ['ぶ', 'む', 'ぬ'], っ: ['う', 'つ', 'る'], い: ['く', 'ぐ'] };
const lexKana = new Set(lex.map((e) => e.ja));
function altBases(t, next) {
  if (t.pos !== '동사' || !next || !/^[てでただ]/.test(next.text)) return [];
  const tx = t.text; const last = tx.slice(-1);
  if (!ONBIN[last] || tx.length < 2) return [];
  return ONBIN[last].map((x) => tx.slice(0, -1) + x).filter((b) => lexKana.has(b));
}
// 어휘 목록 밖 동음어(N5 범위) — 번역 단서로만 고른다
// 문맥 규칙(오케스트레이터 11/11 2차): 앞의 목적어 · 주어로 동음이의를 가른다
const OBJ_HOMO = {
  ひく: [[/ドア|とびら/, '引く'], [/ピアノ|ギター/, '弾く']],
  あつい: [[/きのう|昨日|てんき|天気|なつ|夏|へや|部屋/, '暑い'], [/ほん|本|じしょ|辞書/, '厚い'], [/おちゃ|お茶|ちゃ|コーヒー|スープ|みず|おゆ|ラーメン|りょうり|料理/, '熱い']],
  しめる: [[/ドア|まど|窓/, '閉める'], [/ベルト|ネクタイ/, '締める']],
  とる: [[/しゃしん|写真/, '撮る'], [/ペン|かばん|ノート|もの|物/, '取る']],
};
const EXTRA_HOMO = {
  とる: [{ sp: '取る', keys: ['집', '챙기', '잡', '가지러'] }, { sp: '撮る', keys: ['찍', '촬영'] }],
  つく: [{ sp: '点く', keys: ['켜'] }, { sp: '付く', keys: ['붙'] }],
  きる: [{ sp: '切る', keys: ['자르', '잘라', '끊'] }],
  かぜ: [{ sp: '風邪', keys: ['감기'] }],
  あつい: [{ sp: '暑い', keys: ['덥', '더워', '더운', '더웠'] }, { sp: '熱い', keys: ['뜨거', '뜨겁', '뜨거웠'] }, { sp: '厚い', keys: ['두꺼', '두껍'] }],
  はやい: [{ sp: '速い', keys: ['빠르', '빨라', '빠른', '빠르게'] }, { sp: '早い', keys: ['이르', '이른', '일찍'] }],
  あける: [{ sp: '明ける', keys: ['밝아'] }],
  かえる: [{ sp: '変える', keys: ['바꾸', '바꿔'] }],
  とまる: [{ sp: '泊まる', keys: ['묵', '숙박'] }, { sp: '止まる', keys: ['멈', '서요'] }],
};
const lexByKana = new Map(); for (const e of lex) { if (!lexByKana.has(e.ja)) lexByKana.set(e.ja, []); lexByKana.get(e.ja).push(e); }
const I2U = { い: 'う', き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る' };
const A2U = { わ: 'う', か: 'く', が: 'ぐ', さ: 'す', た: 'つ', な: 'ぬ', ば: 'ぶ', ま: 'む', ら: 'る' };
/** 가나 동사 활용형 → 가능한 기본형(원고 어휘에 있는 것만): 1단(+る) · 5단 연용 · 미연. */
function verbBases(t) {
  if (t.pos !== '동사') return [];
  const tx = t.text; const last = tx.slice(-1); const out = new Set();
  if (lexKana.has(tx + 'る')) out.add(tx + 'る');
  if (I2U[last] && lexKana.has(tx.slice(0, -1) + I2U[last])) out.add(tx.slice(0, -1) + I2U[last]);
  if (A2U[last] && lexKana.has(tx.slice(0, -1) + A2U[last])) out.add(tx.slice(0, -1) + A2U[last]);
  return [...out];
}
const isKana = (c) => /[ぁ-ゟァ-ヿー]/.test(c);
// 바탕 낱말(ks) · 읽기(rs) → 한자 덩어리별 읽기 [[run, reading]|[kana]]
function runs(ks, rs) {
  const parts = ks.match(/[一-鿿々0-9０-９]+|[^一-鿿々0-9０-９]+/g) || [];
  const re = new RegExp('^' + parts.map((p) => (hasKanji(p) ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
  const m = rs.match(re); if (!m) return null;
  let g = 1; return parts.map((p) => (hasKanji(p) ? [p, m[g++]] : [p]));
}
/** 낱말 하나 → 표기(과 지도 키는 같은 읽기일 때 맨글, 아니면 인라인). 실패면 null. */
function renderWord(map, spelling, ja, tx) {
  let ks; let rs;
  if (ja === 'くる' && spelling === '来る' && /^[きこく]/.test(tx)) { ks = '来'; rs = tx[0]; } else [ks, rs] = stems(spelling, ja);
  if (!tx.startsWith(rs)) return null;
  const rr = runs(ks, rs); if (!rr) return null;
  let out = '';
  for (const r of rr) {
    if (r.length === 1) { out += r[0]; continue; }
    const [run, rd] = r;
    if (Object.prototype.hasOwnProperty.call(map, run)) { if (map[run] === rd) out += run; else return null; } else out += `{${run}|${rd}}`;
  }
  return out + tx.slice(rs.length);
}

// 후처리(오케스트레이터 11/11 3차 「검사 보강」): 분석기 분할에 기대지 않고 남은 가나(인라인 밖)를 어간 + 어미 정규식으로 훑어 채운다.
const B = '(?<=^|[\\s、。「（/])';
const NUMK = { いち: '一', に: '二', さん: '三', よん: '四', ご: '五', ろっ: '六', なな: '七', はっ: '八', きゅう: '九', じゅっ: '十', なん: '何' };
const ROWS = { う: 'わいうえお', く: 'かきくけこ', ぐ: 'がぎぐげご', す: 'さしすせそ', つ: 'たちつてと', ぬ: 'なにぬねの', ぶ: 'ばびぶべぼ', む: 'まみむめも', る: 'らりるれろ' };
const ONB = { う: 'っ', つ: 'っ', る: 'っ', く: 'い', ぐ: 'い', む: 'ん', ぶ: 'ん', ぬ: 'ん' };
const END_TAIL = '(?=[\\s、。」）]|こと|とき|前|まえ|の|まで|から|か|よ|ね|$)';
const fillRules = [];
{
  const verbs = [];
  for (const d of kanjiDec.values()) {
    if (HOMO.has(d.ja) || EXTRA_HOMO[d.ja] || kanaDecided.has(d.ja) || d.ja === 'くる' || d.ja === 'する' || !d.spelling) continue;
    const ent = lex.find((e) => e.ja === d.ja && /동사\((1|2)\)|い형용사|형용사/.test(e.pos || ''));
    const pos = ent ? ent.pos : (spec.a2.write[d.spelling] ? null : null);
    if (!pos) continue;
    verbs.push({ ...d, pos });
  }
  for (const v of verbs) {
    const L = v.ja.slice(-1); const stem = v.ja.slice(0, -1);
    let alt;
    if (/동사\(2\)/.test(v.pos)) alt = `(?:ます|ません|ましょう|ました|ませんでした|たい|たく|ない|なかった|ないで|なくて|て|た|ながら|られ|${L}${END_TAIL})`;
    else if (/동사\(1\)/.test(v.pos) && ROWS[L]) { const r = ROWS[L]; alt = `(?:${r[1]}(?:ます|ません|ましょう|ました|ませんでした|たい|たく|ながら|に(?=\\s?[行い来き帰か]))|${r[0]}(?:ない|なかった|ないで|なくて)|${ONB[L] || r[1]}(?:て|た|で|だ)|${L}${END_TAIL})`; if (v.ja === 'いく') alt = `(?:き(?:ます|ません|ましょう|ました|ませんでした|たい|たく|ながら)|か(?:ない|なかった)|っ(?:て|た)|く${END_TAIL})`; }
    else if (/형용사/.test(v.pos) && L === 'い') alt = `(?:い(?![ぁ-ゟ])|い(?=です|の|と|。)|く(?:ない|なかった|て|なります|なりました|ありません)|かった)`;
    if (!alt || [...stem].length < 1) continue;
    if ([...stem].length === 1 && /동사\(1\)/.test(v.pos) === false && /형용사/.test(v.pos)) continue;
    fillRules.push({ re: new RegExp(`${B}${stem}${alt}`, 'g'), spelling: v.spelling, ja: v.ja, kind: '용언 활용형' });
  }
}
function fillPlain(str, map, n, path, before) {
  const parts = str.split(/(\{[^{}|]+\|[^{}|]+\})/);
  for (let i = 0; i < parts.length; i += 2) {
    if (!parts[i]) continue;
    let p = (i > 0 ? '}' : '') + parts[i]; // 인라인 바로 뒤는 낱말 경계가 아니다(「{飲|の}みます」의 みます)
    const rep2 = (re, fn, kind) => { p = p.replace(re, (m, ...g) => { if (/^(すみません|いけません|いただきます)/.test(m) || /^(すみません|いけません)/.test(p.slice(g[g.length - 2]))) return m; const w = fn(m, ...g); if (w && w !== m) { review.regexFill.push({ lesson: n, path, before, from: m, to: w, kind }); return w; } return m; }); };
    rep2(/友だち/g, () => renderWord(map, '友達', 'ともだち', 'ともだち'), '友だち → 友達 통일');
    rep2(/(?<=[のるた]\s?)まえ(?=[にでのは])/g, () => renderWord(map, '前', 'まえ', 'まえ'), '시간 · 위치 まえ → 前');
    rep2(/(?<=[たの]\s?)あと(?=[でにの])/g, () => renderWord(map, '後', 'あと', 'あと'), '시간 あと → 後');
    rep2(new RegExp(`${B}(いち|に|さん|よん|ご|ろっ|なな|はっ|きゅう|じゅっ|なん)かい(?=[にはもの、。\\s]|$)`, 'g'), (m, a) => { const k = NUMK[a] + '回'; return Object.prototype.hasOwnProperty.call(map, k) ? (map[k] === m ? k : null) : `{${k}|${m}}`; }, '숫자 + 回');
    rep2(new RegExp(`${B}いちにち(?=[にはもの])`, 'g'), () => (Object.prototype.hasOwnProperty.call(map, '一日') ? (map['一日'] === 'いちにち' ? '一日' : null) : '{一日|いちにち}'), '一日(いちにち)');
    for (const r of fillRules) rep2(r.re, (m) => renderWord(map, r.spelling, r.ja, m), r.kind);
    parts[i] = i > 0 ? p.slice(1) : p;
  }
  return parts.join('');
}
const kanaForm = (s, map) => {
  let x = s.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, b, r) => '\u0000' + r + '\u0001');
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  let out = ''; let uncovered = 0; let inInline = false;
  for (let i = 0; i < x.length;) {
    if (x[i] === '\u0000') { inInline = true; i++; continue; }
    if (x[i] === '\u0001') { inInline = false; i++; continue; }
    if (!inInline) { const k = keys.find((kk) => x.startsWith(kk, i)); if (k) { out += map[k]; i += k.length; continue; } if (hasKanji(x[i])) uncovered++; }
    out += x[i]; i++;
  }
  return { out, uncovered };
};
const FIELD = /^lessons\.(\d+)\.(dialog\.\d+\.ja|patterns\.\d+\.examples\.\d+\.ja|words\.\d+\.ja|writing_sample\.ja|study_pages\.\d+\.rows\.\d+\.ja|study_pages\.\d+\.examples\.\d+\.ja|extra_patterns\.\d+\.examples\.\d+\.ja|reading)$/;
const BLOCKED = new Set(readFileSync(process.argv[4], 'utf8').split('\n').map((x) => x.trim()).filter(Boolean));
const readingRows = []; const verbRows = new Set(); const conjRows = []; const outside = new Map(); const convs = []; const rows = []; const review = { homonym: [], oneChar: [], uncertain: [], jukuji: [], shortNoun: [], regexFill: [] }; const patch = {};
const perL = new Map(); const sameStr = new Map(); let blockedSkipped = 0; let considered = 0;
for (let i = 9; i < M.lessons.length; i++) {
  const L = M.lessons[i]; const map = L.kanji || {}; const n = L.number;
  const items = [];
  (L.dialog || []).forEach((d, j) => items.push([`lessons.${i}.dialog.${j}.ja`, d.ja, d.ko]));
  (L.patterns || []).forEach((p, k) => (p.examples || []).forEach((e, m) => items.push([`lessons.${i}.patterns.${k}.examples.${m}.ja`, e.ja, e.ko])));
  (L.words || []).forEach((w, j) => items.push([`lessons.${i}.words.${j}.ja`, w.ja, w.ko]));
  if (L.writing_sample?.ja) items.push([`lessons.${i}.writing_sample.ja`, L.writing_sample.ja, L.writing_sample.ko]);
  (L.study_pages || []).forEach((sp, k) => { (sp.rows || []).forEach((r, j) => { if (typeof r.ja === 'string' && isKanaOnly((r.label || '').replace(/[ 　/]/g, '')) && /(ます|る|う|く|ぐ|す|つ|ぬ|ぶ|む|て|で|ない|た|だ|い)$/.test(r.label)) verbRows.add(`lessons.${i}.study_pages.${k}.rows.${j}.ja`); if (typeof r.ja === 'string' && /[0-9０-９一-鿿]/.test(r.label || '')) { readingRows.push({ lesson: L.number, path: `lessons.${i}.study_pages.${k}.rows.${j}.ja`, label: r.label, ja: r.ja }); return; } if (typeof r.ja === 'string') items.push([`lessons.${i}.study_pages.${k}.rows.${j}.ja`, r.ja, [r.ko, /[가-힣]/.test(r.label || '') ? r.label : ''].filter(Boolean).join(' · ')]); }); (sp.examples || []).forEach((e, m) => items.push([`lessons.${i}.study_pages.${k}.examples.${m}.ja`, e.ja, e.ko])); });
  (L.extra_patterns || []).forEach((p, k) => (p.examples || []).forEach((e, m) => items.push([`lessons.${i}.extra_patterns.${k}.examples.${m}.ja`, e.ja, e.ko])));
  if (typeof L.reading === 'string') items.push([`lessons.${i}.reading`, L.reading, '']);
  for (const [path, s, ko] of items) {
    if (!FIELD.test(path) || typeof s !== 'string') continue;
    considered++;
    if (BLOCKED.has(path)) { blockedSkipped++; continue; }
    if (verbRows.has(path)) { conjRows.push({ lesson: n, path, label: (L.study_pages || []).flatMap((sp) => sp.rows || []).find((r) => r.ja === s)?.label, ja: s }); continue; }
    const cacheKey = n + '\u0000' + s;
    // 같은 과 같은 원문은 뒤에서 한 표기로 맞춘다(갈리면 가나 유지)
    const nounKana = [...kanjiDec.values(), ...[...HOMO].map((h) => ({ ja: h, pos: '명사' }))].filter((d) => [...d.ja].length >= 2 && (!d.pos || /명사|대명사/.test(d.pos))).map((d) => d.ja).sort((a, b) => b.length - a.length);
    const pieces0 = s.split(/( |\n|、|。|[0-9０-９]+[^\s、。ぁ-ゟ]*)/).filter((x) => x !== '');
    const pieces = []; const toks = [];
    for (const pc of pieces0) {
      const fk = Object.keys(FORCE).sort((a, b) => b.length - a.length).find((k) => pc === k || (pc.startsWith(k) && FORCE[k][2].test(pc.slice(k.length))));
      if (fk) { pieces.push({ forced: fk }); if (pc.length > fk.length) pieces.push(pc.slice(fk.length)); continue; }
      const hn = nounKana.find((k) => pc.startsWith(k) && pc.length > k.length && /^[のがをはにでともへやかな]/.test(pc.slice(k.length))); if (hn) pieces.push(hn, pc.slice(hn.length)); else pieces.push(pc);
    }
    for (const piece of pieces.length ? pieces : s.split(/( |、|。|[0-9０-９]+[^\s、。ぁ-ゟ]*)/).filter((x) => x !== '')) toks.push(...(typeof piece === 'object' ? [{ text: piece.forced, base_form: FORCE[piece.forced][1], pos: '명사', forced: FORCE[piece.forced] }] : piece === '\n' ? [{ text: '\n', base_form: '\n', pos: '기호' }] : nounKana.includes(piece) ? [{ text: piece, base_form: piece, pos: '명사' }] : piece.trim() ? await tokenizeJaLine(piece) : [{ text: piece, base_form: piece, pos: '기호' }]));
    if (toks.map((t) => t.text).join('') !== s) throw new Error('token join ≠ ' + s);
    if (isKanaOnly(s) && (kanjiDec.has(s) || HOMO.has(s)) && toks.length > 1) { toks.length = 0; toks.push({ text: s, base_form: s, pos: '명사' }); }
    const segs = []; const notes = []; let flagged = false;
    for (let ti = 0; ti < toks.length; ti++) {
      const t = toks[ti]; const tx = t.text; const base = t.base_form || tx;
      const plain = () => segs.push(tx);
      if (tx === 'き' && t.pos === '동사' && /^(くる|来る)$/.test(base) && /입/.test(String(ko || ''))) { const w = renderWord(map, '着る', 'きる', tx); if (w) { segs.push(w); review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: 'くる', alternatives: ['来る', '着る'], chosen: '着る', kind: '분석기 来る → 번역 「입」으로 着る' }); convs.push({ path, kana: 'きる', spelling: '着る' }); continue; } }
      if (/^[きこ]$/.test(tx) && t.pos === '동사' && /^(くる|来る)$/.test(base)) { const w = renderWord(map, '来る', 'くる', tx); if (w) { segs.push(w); convs.push({ path, kana: 'くる', spelling: '来る' }); continue; } review.uncertain.push({ lesson: n, path, before: s, token: tx, alternatives: ['来る'], kind: '来る — 과 지도 키 来의 읽기와 달라 가나' }); plain(); continue; }
      if ([...tx].length === 1 && oneChar.has(tx) && isKanaOnly(tx)) {
        let p = ti - 1; const start = p < 0 || /^[ 、。「]$/.test(toks[p].text);
        const nx = toks[ti + 1]; const partNext = nx && nx.pos === '조사' && /^[をがはにのもでへと]$/.test(nx.text);
        if (start && (partNext || toks.length === 1 || !nx || /^[ 、。/]$/.test(nx.text.trim() || ' '))) {
          const w = renderWord(map, oneChar.get(tx).sp, tx, tx);
          review.oneChar.push({ lesson: n, path, before: s, word: tx, cand: oneChar.get(tx).sp, ko: oneChar.get(tx).ko, line_ko: ko, applied: Boolean(w), after: w });
          if (w) { segs.push(w); convs.push({ path, kana: tx, spelling: oneChar.get(tx).sp }); continue; }
        }
        plain(); continue;
      }
      if (t.forced) { const w = renderWord(map, t.forced[0], t.forced[1], tx); if (w) { segs.push(w); convs.push({ path, kana: t.forced[1], spelling: t.forced[0] }); continue; } review.uncertain.push({ lesson: n, path, before: s, token: tx, alternatives: [t.forced[0]], kind: '분석기 오분할 보정 표기 실패(지도 키 충돌)' }); plain(); continue; }
      if (!isKanaOnly(tx) || !CONTENT.has(t.pos)) { plain(); continue; }
      if (tx === 'とっても' && t.pos === '부사') { let p = ti - 1; while (p >= 0 && !toks[p].text.trim()) p--;
        if (p >= 1 && toks[p].text === 'を') { let q = p - 1; while (q >= 0 && !toks[q].text.trim()) q--; const obj = q >= 0 ? toks[q].text : ''; const sp = /しゃしん|写真/.test(obj) ? '撮る' : '取る'; const w = renderWord(map, sp, 'とる', 'とっ');
          if (w) { segs.push(w + 'ても'); review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: '부사 とっても', alternatives: ['撮っても', '取っても'], chosen: sp, kind: `「を とっても」 — 목적어 ${obj}로 ${sp} (오케스트레이터 11/11 2차)` }); convs.push({ path, kana: 'とる', spelling: sp, extraHomo: true }); continue; } } }
      if (tx === 'とっても' && t.pos === '부사') { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: '부사 とっても', alternatives: ['撮っても', '取っても', 'とっても(매우)'], kind: '부사로 분석 — 동사 て형 + も일 수 있음' }); plain(); continue; }
      { let q = ti + 1; const nx1 = toks[q]; let mv = null; for (let q2 = q + 1; q2 < toks.length && !/^[、。]$/.test(toks[q2].text); q2++) if (/^(行く|いく|来る|くる|帰る|かえる)$/.test(toks[q2].base_form || '')) { mv = toks[q2]; break; }
        const vb = I2U[tx.slice(-1)] ? tx.slice(0, -1) + I2U[tx.slice(-1)] : null;
        if (t.pos === '명사' && nx1 && nx1.text === 'に' && (mv || verbRows.has(path)) && vb && lexKana.has(vb)) {
          const vsp = vb === 'とる' ? '取る' : kanjiDec.get(vb)?.spelling; const w = vsp ? renderWord(map, vsp, vb, tx) : null;
          if (w) { segs.push(w); review.uncertain.push({ lesson: n, path, before: s, token: tx + 'に', analyzer: `명사 ${tx}`, alternatives: [vsp], chosen: vsp, kind: '「동사 연용형 + に + 오다/가다」(목적) → 동사로 표기 (오케스트레이터 11/11 2차)' }); convs.push({ path, kana: vb, spelling: vsp, extraHomo: vb === 'とる' }); continue; }
        }
        if (t.pos === '명사' && nx1 && nx1.text === 'に' && mv && /^(行く|いく|来る|くる|帰る|かえる)$/.test(mv.base_form || '') && vb && lexKana.has(vb)) { review.uncertain.push({ lesson: n, path, before: s, token: tx + 'に', analyzer: `명사 ${tx}`, alternatives: [...(lexByKana.get(vb) || []).flatMap((e) => (e.spellings || []).filter(hasKanji)), (oneChar.get(tx) || {}).sp].filter(Boolean), kind: '「동사 연용형 + に + 오다/가다」(목적)일 수 있음 — 변환 안 함' }); plain(); continue; } }
      if (verbRows.has(path) && t.pos === '명사' && toks.filter((x) => x.text.trim()).length <= 2) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: `명사 ${base}`, alternatives: [], kind: '동사 카드 줄인데 명사로 분석 — 변환 안 함' }); plain(); continue; }
      if ([...tx].length === 1) { plain(); continue; }
      const baseK = isKanaOnly(base) ? base : (bySp.get(base)?.ja || null);
      let dec = null; let homo = null;
      const key = baseK || tx;
      if (key === 'いる') { let p = ti - 1; while (p >= 0 && !toks[p].text.trim()) p--; const aux = p >= 0 && /^[てで]$/.test(toks[p].text); if (aux || !/필요/.test(String(ko || ''))) { plain(); continue; } }
      if (HOMO.has(key) || HOMO.has(tx)) {
        const hk = HOMO.has(key) ? key : tx; const exh = EXTRA_HOMO[hk] || []; const ents = [...(homoEntries.get(hk) || []), ...exh.filter((x) => !(homoEntries.get(hk) || []).some((e) => e.sp === x.sp)).map((x) => ({ sp: x.sp, ko: x.keys.join(', '), unit: 0, pos: null, keys: x.keys }))];
        const keysOf = (e) => e.keys || exh.find((x) => x.sp === e.sp)?.keys || koKeys(e.ko);
        const before = toks.slice(0, ti).map((x) => x.text).join('').split(/[。]/).pop();
        const ctxRules = (OBJ_HOMO[hk] || []).filter(([re]) => re.test(before));
        const ctxPick = hk === 'いる' && /필요/.test(String(ko || '')) ? '要る' : new Set(ctxRules.map((r) => r[1])).size === 1 ? ctxRules[0][1] : null;
        const hits0 = ents.filter((e) => keysOf(e).some((w) => String(ko || '').includes(w)));
        const hits = ctxPick ? [{ ...(ents.find((e) => e.sp === ctxPick) || { sp: ctxPick, ko: '', unit: 0, pos: null }), ctx: true }] : hits0;
        const upto = ents.filter((e) => e.unit <= n).sort((a, b) => b.unit - a.unit);
        const same = ents.filter((e) => e.unit === n);
        const pick = hits.length && new Set(hits.map((h) => h.sp)).size === 1 ? { ...hits[0], how: hits[0].ctx ? 'ctx' : 'ko' } : (!hits.length && !String(ko || '').trim() && new Set(same.map((h) => h.sp)).size === 1 ? { ...same[0], how: 'unit' } : null);
        homo = { word: hk, spellings: [...new Set(ents.map((e) => e.sp))], pick: pick?.sp || null, confidence: pick?.how === 'ctx' ? '문맥(목적어 · 주어)' : pick?.how === 'ko' ? '번역 단서' : pick ? '이 과 어휘 항목' : '보류', basis: pick?.how === 'ko' ? `번역 「${ko}」에 뜻 「${pick.ko}」` : pick ? `이 과(${n}) 어휘 항목 ${pick.sp} 「${pick.ko}」 · 번역 「${ko}」` : `판정 보류(번역 「${ko}」에 뜻 단서 ${hits.length ? '둘 이상' : '없음'} · 앞 단원 ${upto[0]?.sp || '-'})` };
        if (pick && !joyoReadable(pick.sp, hk)) { homo.basis += ` → ${pick.sp}는 상용한자표 밖 → 가나`; homo.pick = null; homo.kanaByJoyo = pick.sp; }
        else if (pick) dec = { ja: hk, spelling: pick.sp, pos: pick.pos, decision: 'kanji' };
      } else dec = kanjiDec.get(key) || kanjiDec.get(tx) || null;
      if (!dec && !homo && !kanaDecided.has(key) && !kanaDecided.has(tx) && !lexKana.has(key) && !pubByKana.has(key) && [...tx].length >= 2) { const o = outside.get(key) || { word: key, pos: t.pos, analyzerBase: base, n: 0, lessons: new Set(), ex: s }; o.n++; o.lessons.add(n); outside.set(key, o); }
      if (t.pos === '동사' && !homo) {
        const cands = [...new Set([...(baseK && lexKana.has(baseK) ? [baseK] : []), ...verbBases(t), ...altBases(t, toks[ti + 1])])];
        if (cands.length > 1) {
          const hits1 = cands.filter((c) => (lexByKana.get(c) || []).some((e) => koKeys(e.ko).some((w) => String(ko || '').includes(w))));
          const byUnit = cands.filter((c) => (lexByKana.get(c) || []).some((e) => e.unit <= n));
          const hits = hits1.length ? hits1 : byUnit.length === 1 ? byUnit : hits1;
          if (hits.length === 1) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: cands, chosen: hits[0], kind: '활용형 기본형 후보 둘 이상 → 번역으로 결정' }); dec = kanjiDec.get(hits[0]) || null; }
          else { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: cands, kind: '활용형 기본형 후보 둘 이상 — 변환 안 함' }); plain(); continue; }
        }
      }
      const nx = toks[ti + 1];
      if (t.pos === '동사' && nx && /^(れる|られる)$/.test(nx.base_form || '') && OUTSIDE_KANJI[tx + nx.text.slice(0, 1) + 'る']) { const wj = tx + nx.text.slice(0, 1) + 'る'; const w = renderWord(map, OUTSIDE_KANJI[wj], wj, tx);
        if (w) { segs.push(w); review.uncertain.push({ lesson: n, path, before: s, token: tx + nx.text, analyzer: `${baseK}+${nx.base_form}`, alternatives: [OUTSIDE_KANJI[wj]], chosen: OUTSIDE_KANJI[wj], kind: '분석기 수동형 → 승인된 어휘 목록 밖 동사로 표기' }); convs.push({ path, kana: wj, spelling: OUTSIDE_KANJI[wj] }); continue; } }
      if (dec && t.pos === '동사' && nx && /^(れる|られる|せる|させる)$/.test(nx.base_form || '')) { review.uncertain.push({ lesson: n, path, before: s, token: tx + nx.text, analyzer: `${baseK}+${nx.base_form}`, alternatives: [dec.spelling, tx + nx.text.slice(0, 1) + 'る'], kind: '수동 · 사역 조동사가 붙은 활용 — 다른 동사일 수 있어 변환 안 함' }); plain(); continue; }
      if (dec && t.pos === '동사' && [...tx].length > [...dec.ja].length) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: [dec.spelling], kind: '동사 토큰이 기본형보다 김(조동사 붙음) — 변환 안 함' }); plain(); continue; }
      if (dec && dec.ja === 'おく') { let p = ti - 1; while (p >= 0 && toks[p].pos === '기호' && !toks[p].text.trim()) p--; if (p >= 0 && /^[てで]$/.test(toks[p].text)) dec = null; }
      const whole = s.trim() === tx;
      if (dec && !whole && tx !== dec.ja && !posOk(dec, t)) { if (kanjiDec.has(key)) review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: `${baseK}/${t.pos}`, alternatives: [dec.spelling], kind: '품사 불일치로 변환 안 함' }); dec = null; }
      if (!dec) { if (homo) review.homonym.push({ lesson: n, path, before: s, ...homo, applied: false }); plain(); continue; }
      if (/^[一二三四五六七八九十百千万]+$/.test(dec.spelling)) { plain(); continue; }
      const ent = lex.find((e) => e.ja.replace(/^[〜～]/, '') === dec.ja && (e.spellings || []).some((x) => String(x).split(/[;；]\s*/).map((y) => y.replace(/^[〜～]/, '')).includes(dec.spelling))) || lex.find((e) => e.ja === dec.ja);
      const ex = EXTRA_HOMO[dec.ja];
      if (ex && !homo) {
        const own = ex.find((x) => x.sp === dec.spelling);
        const cand = [{ sp: dec.spelling, keys: own ? own.keys : (ent ? koKeys(ent.ko) : []) }, ...ex.filter((x) => x.sp !== dec.spelling)];
        const afterTx = toks.slice(ti + 1).map((x) => x.text).join('').slice(0, 6);
        const hits0 = dec.ja === 'はやい' && /日本語|にほんご|話|はな/.test(afterTx) ? cand.filter((c) => c.sp === '速い') : String(ko || '').trim() ? cand.filter((c) => c.keys.some((w) => String(ko).includes(w))) : [];
        const hits = hits0.length === 0 && !own ? [cand[0]] : hits0;
        if (hits.length !== 1) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: cand.map((c) => c.sp), line_ko: ko, kind: '어휘 목록 밖 동음어가 있음 · 번역 단서 ' + (hits.length ? '둘 이상' : '없음') + ' — 변환 안 함' }); plain(); continue; }
        if (hits[0].sp !== dec.spelling) {
          const alt = hits[0];
          if (!joyoReadable(alt.sp, dec.ja)) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: cand.map((c) => c.sp), chosen: alt.sp, line_ko: ko, kind: `번역으로 ${alt.sp} — 상용한자표 밖이라 가나` }); plain(); continue; }
          review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: cand.map((c) => c.sp), chosen: alt.sp, line_ko: ko, kind: `번역으로 어휘 목록 밖 동음어 ${alt.sp} 선택` });
          dec = { ...dec, spelling: alt.sp, extraHomo: true };
        }
      }
      if (ent && !dec.extraHomo && t.pos === '동사' && /동사\((1|2)\)/.test(ent.pos || '') && tx !== dec.ja && dec.ja !== 'くる') {
        const g = /동사\(2\)/.test(ent.pos) ? 2 : 1; const stem = dec.ja.slice(0, -1); const last = dec.ja.slice(-1);
        const ROW = { う: 'わいうえお', く: 'かきくけこ', ぐ: 'がぎぐげご', す: 'さしすせそ', つ: 'たちつてと', ぬ: 'なにぬねの', ぶ: 'ばびぶべぼ', む: 'まみむめも', る: 'らりるれろ' };
        const OB = { う: 'っ', つ: 'っ', る: 'っ', く: 'い', ぐ: 'い', む: 'ん', ぶ: 'ん', ぬ: 'ん' };
        const okForm = g === 2 ? [stem, stem + 'れ', stem + 'ろ', stem + 'よ'].includes(tx) : tx.length === dec.ja.length && tx.startsWith(stem) && ((ROW[last] || '') + (OB[last] || '')).includes(tx.slice(-1));
        if (!okForm && !(dec.ja === 'いく' && tx === 'いっ')) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: [dec.spelling], kind: `${g}그룹 ${dec.ja}의 활용형이 아님 — 다른 동사일 수 있어 변환 안 함` }); plain(); continue; }
      }
      const nounDec = !/동사|형용사/.test(String((ent && ent.pos) || dec.pos || '')) && !/[るうくぐすつぬぶむい]$/.test(dec.spelling) || /명사/.test(String((ent && ent.pos) || ''));
      if (nounDec && (t.pos === '동사' || t.pos === '형용사')) { review.shortNoun.push({ lesson: n, path, before: s, word: dec.spelling, kana: tx, status: 'held', why: `분석기가 ${t.pos}(${base})로 본 자리 — 명사 ${dec.spelling}로 바꾸지 않음` }); plain(); continue; }
      if (nounDec && t.pos !== '동사' && t.pos !== '형용사') {
        const nxt = toks[ti + 1]; const prv = toks[ti - 1];
        const badNext = nxt && ((nxt.pos === '조동사' && !/^(です|でし|でしょ|だ|だっ|じゃ|では|な|ね|よ)/.test(nxt.text)) || (nxt.pos === '동사' && /^[ぁ-ゟ]/.test(nxt.text) && !/^(する|できる)$/.test(nxt.base_form || '')));
        const badPrev = prv && /^[ぁ-ゟ]+$/.test(prv.text) && prv.pos !== '조사' && !/^[おご]$/.test(prv.text);
        if (badNext || badPrev) { review.shortNoun.push({ lesson: n, path, before: s, word: dec.spelling, kana: tx, status: 'held', why: badNext ? `뒤가 활용 어미(${nxt.text})` : `앞 가나(${prv.text})에 붙음` }); plain(); continue; }
        if ([...dec.ja].length <= 2) review.shortNoun.push({ lesson: n, path, before: s, word: dec.spelling, kana: tx, status: 'converted' });
      }
      const [ks, rs] = dec.ja === 'くる' && dec.spelling === '来る' && /^[きこく]/.test(tx) ? ['来', tx[0]] : stems(dec.spelling, dec.ja);
      if (!tx.startsWith(rs)) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: [dec.spelling], kind: '어간 불일치로 변환 안 함' }); plain(); continue; }
      const rr = runs(ks, rs);
      if (!rr) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: [dec.spelling], kind: '한자 덩어리 읽기 정렬 실패' }); plain(); continue; }
      let txt = ''; let bad = false;
      for (const r of rr) {
        if (r.length === 1) { txt += r[0]; continue; }
        const [run, rd] = r;
        if (Object.prototype.hasOwnProperty.call(map, run)) { if (map[run] === rd) txt += run; else { bad = true; break; } }
        else txt += `{${run}|${rd}}`;
        if (FUHYO.has(run) || FUHYO.has(dec.spelling)) review.jukuji.push({ lesson: n, path, word: run, reading: rd, kind: '숙자훈' });
      }
      if (bad) { review.uncertain.push({ lesson: n, path, before: s, token: tx, analyzer: baseK, alternatives: [dec.spelling], kind: '과 지도 키와 같은 바탕 · 다른 읽기 — 인라인 불가' }); plain(); continue; }
      segs.push(txt + tx.slice(rs.length));
      if (homo) review.homonym.push({ lesson: n, path, before: s, ...homo, applied: true });
      notes.push(dec.spelling); convs.push({ path, kana: dec.ja, spelling: dec.spelling, extraHomo: Boolean(dec.extraHomo) });
    }
    const after = fillPlain(segs.join(''), map, n, path, s);
    if (segs.join('').replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1').length === 0) continue;
    const kf0 = kanaForm(s, map); const kf1 = kanaForm(after, map);
    const row = { lesson: n, path, before: s, after, inline: [...after.matchAll(/\{([^{}|]+)\|([^{}|]+)\}/g)].map((m) => `${m[1]}=${m[2]}`), bareKeys: [], ok: kf0.out === kf1.out && kf1.uncovered === 0 };
    if (after !== s && !row.ok) { review.uncertain.push({ lesson: n, path, before: s, after, kind: `가나형 불일치(${kf1.out} ≠ ${kf0.out}, 덮이지 않은 한자 ${kf1.uncovered})` }); sameStr.set(cacheKey, (sameStr.get(cacheKey) || []).concat([{ ...row, after: s }])); continue; }
    sameStr.set(cacheKey, (sameStr.get(cacheKey) || []).concat([{ ...row, after }]));
    if (after !== s) { patch[path] = after; rows.push(row); const pl = perL.get(n) || { strings: 0, inline: new Set() }; pl.strings++; row.inline.forEach((x) => pl.inline.add(x)); perL.set(n, pl); }
  }
}
for (const [, grp] of sameStr) {
  const outs = new Set(grp.map((g) => g.after));
  if (outs.size < 2) continue;
  review.uncertain.push({ lesson: grp[0].lesson, path: grp.map((g) => g.path).join(' · '), before: grp[0].before, alternatives: [...outs], kind: '같은 과 같은 원문인데 뜻이 갈림 — 한 표기로 맞춰야 해서 가나 유지' });
  for (const g of grp) { delete patch[g.path]; const ix = rows.findIndex((r) => r.path === g.path); if (ix >= 0) rows.splice(ix, 1); }
}
perL.clear(); for (const r of rows) { const pl = perL.get(r.lesson) || { strings: 0, inline: new Set() }; pl.strings++; r.inline.forEach((x) => pl.inline.add(x)); perL.set(r.lesson, pl); }
// 같은 과 안 읽기 갈림(새 인라인 vs 과 지도 · 다른 인라인)
const split = [];
for (const [n, pl] of perL) {
  const L = M.lessons[n - 1]; const per = new Map();
  const add = (w, r, src) => { const al = FUHYO.has(w) ? null : align(w, r); for (const [c, rd] of al || [...w].filter(hasKanji).map((c) => [c, '숙자훈 ' + w + '=' + r])) { if (!per.has(c)) per.set(c, new Map()); const m = per.get(c); if (!m.has(rd)) m.set(rd, new Set()); m.get(rd).add(src + w); } };
  for (const [w, r] of Object.entries(L.kanji || {})) add(w, r, '');
  for (const x of pl.inline) { const [w, r] = x.split('='); add(w, r, '+'); }
  for (const [c, m] of per) if (m.size > 1 && [...m.values()].some((ws) => [...ws].some((w) => w.startsWith('+')))) split.push({ lesson: n, char: c, readings: Object.fromEntries([...m].map(([rd, ws]) => [rd, [...ws]])) });
}
// 계약: 공개 자료 표와 판정 어긋남 0
const mism = [];
const okPaths = new Set(rows.map((r) => r.path));
const homophoneSplit = convs.filter((c) => okPaths.has(c.path) && c.extraHomo);
for (const c of convs) { if (!okPaths.has(c.path) || HOMO.has(c.kana) || c.extraHomo) continue; const p = pubByKana.get(c.kana); if (p && p.decision === 'kana') mism.push({ ...c, pub: 'kana' }); if (p && p.decision === 'kanji' && p.spelling !== c.spelling && !ORTHO_SAME.has(c.spelling + '|' + p.spelling)) mism.push({ ...c, pub: p.spelling }); }
for (const d of kanjiDec.values()) { const p = pubByKana.get(d.ja); if (p && p.decision === 'kanji' && p.spelling !== d.spelling && !ORTHO_SAME.has(d.spelling + '|' + p.spelling)) mism.push({ word: d.ja, ours: d.spelling, pub: p.spelling }); }
for (const k of kanaDecided) { const p = pubByKana.get(k); if (p && p.decision === 'kanji') mism.push({ word: k, ours: 'kana', pub: p.spelling }); }
// ⑸ 과마다 무작위 3줄(고정 시드)
let seed = 20261111; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const flaggedPaths = new Set([...review.homonym, ...review.oneChar, ...review.uncertain, ...review.jukuji].map((x) => x.path));
const sample = [];
for (const n of [...new Set(rows.map((r) => r.lesson))]) { const pool = rows.filter((r) => r.lesson === n && !flaggedPaths.has(r.path)); for (let k = 0; k < 3 && pool.length; k++) sample.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); }
const summary = { considered, blockedSkipped, changed: rows.length, unchanged: considered - blockedSkipped - rows.length, allKanaFormOk: rows.every((r) => r.ok), publicMismatch: mism.length, lessons: perL.size, inlineDistinct: new Set(rows.flatMap((r) => r.inline)).size, review: { homonym: review.homonym.length, homonymApplied: review.homonym.filter((h) => h.applied).length, oneChar: review.oneChar.length, uncertain: review.uncertain.length, jukuji: review.jukuji.length, split: split.length, sample: sample.length } };
const outsideList = [...outside.values()].map((o) => ({ ...o, lessons: [...o.lessons] })).sort((a, b) => b.n - a.n);
summary.outsideLexicon = outsideList.length; summary.conjugationRowsKept = conjRows.length; summary.readingRowsKept = readingRows.length;
summary.homophoneSplit = homophoneSplit.length;
writeFileSync(process.argv[3], JSON.stringify({ summary, conjugationRows: conjRows, kanjiTable: [...kanjiDec.values()].map((d) => ({ ja: d.ja, spelling: d.spelling, pos: d.pos })), homophoneSplit, readingRows, outsideLexicon: outsideList, rulings: { RULING, oku: '본동사 置く · ～ておく 가나', kakeru: '가나', prose: '한국어 설명문 · 공식은 1단계 범위 밖' }, patch, rows, review: { ...review, split, sample }, mismatches: mism }, null, 1));
console.log(JSON.stringify(summary));
function align(word, reading) {
  const chars = [...word.replace(/[0-9０-９]+/g, '#')]; const out = [];
  const go = (i, j) => {
    if (i === chars.length) return j === reading.length;
    const c = chars[i];
    if (c === '#') { for (let k = j + 1; k <= reading.length; k++) { out.push(['#', reading.slice(j, k)]); if (go(i + 1, k)) return true; out.pop(); } return false; }
    if (!hasKanji(c)) return reading[j] === k2h(c) && go(i + 1, j + 1);
    const rs = c === '々' ? readingsOf(chars[i - 1]) : readingsOf(c);
    for (const r of [...(rs || [])].sort((x, y) => y.length - x.length)) if (reading.startsWith(r, j)) { out.push([c, r]); if (go(i + 1, j + r.length)) return true; out.pop(); }
    return false;
  };
  return go(0, 0) ? out.filter(([c]) => c !== '#') : null;
}
