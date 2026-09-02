// 서버 전용 — kuromoji 독음 수리 층 (분석기 리뷰 라운드 3, 오너 「순위대로 ㄱㄱ」 2026-09-02).
//
// ── 왜 필요한가
// 리뷰(#1077 5501779373): 콘텐츠 9,203문장을 사람이 적은 `yomi`와 전수 대조하니 한자 문장 6.5%에
// 오독이 있었다. 범인 1위 日本→**にっぽん** ×66, 이어 二人→ににん ×40·一人→いちにん ×19·何→なに(何です)
// ×21·間→ま ×21·九時→きゅうじ·七時→ななじ·十分→じゅうぶん. 독해 게이트(scripts/check-reading.mjs)는
// `PLACE_YOMI`·`BANNED_YOMI`로 이걸 이미 막고 있었는데 **스크립트 층**이라 뷰어·카드는 몰랐다.
// 그 수리를 분석기 층으로 올린다 — zh의 `ZH_NEUTRAL_TONE`·`zhPinyinContext`가 있는 자리.
//
// ── 세 가지 모양 (전부 코퍼스 실측으로 확정 — 각 규칙에 수치)
// ① 토큰 정확 일치: 日本→にほん처럼 단독 토큰이 늘 틀리는 것.
// ② 이웃 조건: 何+です→なん(12/12) · 명사+不足→ぶそく(7/7) · が+開く→あく · 今日+中→じゅう.
//    태그만으론 못 가르고 앞뒤 토큰이 가른다 — zh 문맥 층과 같은 모양.
// ③ 수사+조수사 병합: kuromoji는 二人을 二/に + 人/にん으로 쪼갠다. 조수사 읽기는 닫힌 표(음편 규칙 +
//    불규칙)라 표로 간다 — 두 토큰을 **한 토큰으로 합친다**(二人은 학습자에게 한 단어다). 독해 게이트의
//    BANNED_YOMI(時間→ときあいだ·九時→きゅうじ·三百→さんひゃく)가 잡던 부류가 전부 여기다.
//
// ── 무엇을 안 하나
// 양쪽 다 맞는 이독(家 いえ/うち · 昨夜 さくや/ゆうべ · 市場 しじょう/いちば)은 손대지 않는다 — 틀릴 수 있는 건
// 안 싣는다(경성 사전 기준 ②). 市場는 いちば 규칙을 넣었다가 4건 얻고 8건 잃어 뺐다(실측). 등재 밖은 무개입.

/** ① 단독 토큰이 늘 틀리는 것 — 표면 → 히라가나 독음. 코퍼스 정답 일치 100%인 것만. */
export const JA_TOKEN_READING = {
  日本: 'にほん',      // ×66 — にっぽん은 공식 병존 독음이지만 학습 교재·정답지는 전부 にほん
  夜中: 'よなか',      // ×6
  大勢: 'おおぜい',    // ×4
  山道: 'やまみち',    // ×4
  間: 'あいだ',        // ×21 — 단독 間(〜の間に). 居間·間に合う는 별개 토큰
  物: 'もの',          // ×5 — 단독 物. 動物·食べ物은 별개 토큰
  皆: 'みんな',        // ×5 — みな도 맞지만 회화 교재·정답지는 みんな
  角: 'かど',          // ×4 — 단독 角(모퉁이). 三角·角度는 별개 토큰
  味: 'あじ',          // ×3
  道: 'みち',          // ×3
  得る: 'うる',        // ×4 — 〜得る(N2 문형)은 うる
  堪え: 'たえ',        // ×3 — 堪える(たえる). こたえる가 아니다
  堪える: 'たえる',
  預け: 'あずけ',      // ×3 — kuromoji의 구가나 あづけ
  預ける: 'あずける',
  描く: 'かく',        // ×3 — 絵を描く
  来ら: 'こら',        // ×4 — 来られる(수동·가능). kuromoji는 来たる 어간으로 읽는다
  仮名: 'かな',        // ×3 — 단독 仮名. kuromoji는 かめい(가명). 平仮名·片仮名는 한 토큰이라 무관
};

const DEMONSTRATIVE = new Set(['この', 'その', 'あの', 'どの']);
const DIRECTION = new Set(['こちら', 'そちら', 'あちら', 'どちら']);
const THROUGHOUT = new Set(['今日', '一日', '一年', '世界', '今年', '今月', '今週', '明日', '一晩']);
const SUBJECT = new Set(['が', 'は']);
const VERB_ENDINGS = new Set(['ます', 'まし', 'ましょ', 'ません', 'たい', 'たく']);

/** ② 이웃 조건 — (tokens, i) → 독음 또는 null. 각 규칙의 수치는 코퍼스 실측(리뷰 §2). */
function contextReading(tokens, i) {
  const t = tokens[i], prev = tokens[i - 1], next = tokens[i + 1];
  const s = t.surface_form;
  switch (s) {
    case '何':   // です/で/だ/の 앞은 なん(12/12·何の). も/か/を/が/に 앞은 なに(코퍼스 16/16 — kuromoji가 문두 何も를
                 // なん으로 읽는 자리까지 못 박는다). 조수사 앞(何人·何月·何名)은 ③이 받는다.
      if (next && ['です', 'で', 'だ', 'でしょ', 'の', 'でも'].includes(next.surface_form)) return 'なん';
      if (next && ['も', 'か', 'を', 'が', 'に'].includes(next.surface_form)) return 'なに';
      return null;
    case '不足': // 명사 바로 뒤(運動不足·睡眠不足)는 연탁 ぶそく(7/7). 「が不足し」는 ふそく(5/5).
      return prev && prev.pos === '名詞' && !/^(助詞|記号)/.test(prev.pos) ? 'ぶそく' : null;
    case '開く': case '開い': case '開き': case '開け': // が/は/で 뒤 = 자동사 あく(ドアが開く·自動で開く). を 뒤 = ひらく(店を開く)
      return prev && (SUBJECT.has(prev.surface_form) || prev.surface_form === 'で') ? s.replace('開', 'あ') : null;
    case '降り': // 雨が降り(ふり). を 뒤·お降り는 おり
      if (prev && SUBJECT.has(prev.surface_form)) return 'ふり';
      if (prev && prev.surface_form === 'お') return 'おり';
      return null;
    case '行っ': // kuromoji가 行う(おこなっ)로 읽은 것 — を 뒤가 아니면 行く(いっ). を 뒤는 おこなっ(16/16)
      return prev && prev.surface_form !== 'を' && t.reading === 'オコナッ' ? 'いっ' : null;
    case '方':   // この/その/あの 뒤·あちらの 뒤 = 사람(かた). 駅の方(ほう)·〜方(かた 방법)은 kuromoji가 맞게 낸다
      if (prev && DEMONSTRATIVE.has(prev.surface_form)) return 'かた';
      if (prev && prev.surface_form === 'の' && tokens[i - 2] && DIRECTION.has(tokens[i - 2].surface_form)) return 'かた';
      return null;
    case '今':   // 今 = いま(×4 + 今話題に). 접두 こん은 닫힌 복합(今学期·今シーズン·今大会·今世紀·今年度)뿐 — 「뒤가
                 // 명사면 こん」으로 넣었다가 今話題(いま)가 깨졌다(실측). 今朝는 병합표.
      return next && ['学期', 'シーズン', '大会', '世紀', '年度', '期'].includes(next.surface_form) ? null : 'いま';
    case '後':   // 명사 바로 뒤(十年後·卒業後)는 접미 ご, 단독(その後·食事の後)은 あと(×4). 토큰 일치로 넣었다가 접미가 깨졌다.
      return prev && prev.pos === '名詞' && prev.surface_form !== 'の' ? 'ご' : 'あと';
    case '夜':   // 夜が明ける = よ(6/6). 그 밖의 夜는 よる
      return next && next.surface_form === 'が' && tokens[i + 2] && /^明/.test(tokens[i + 2].surface_form) ? 'よ' : null;
    case '十分': // 뒤가 な·に·ある이면 형용동사 じゅうぶん(5/5), 아니면 시간 じゅっぷん(6/6)
      return next && ['な', 'に', 'ある', 'じゃ', 'では'].includes(next.surface_form) ? null : 'じゅっぷん';
    case '中':   // 今日中·一日中·世界中 = じゅう(4/4). 授業中(ちゅう)·〜の中(なか)는 그대로
      return prev && THROUGHOUT.has(prev.surface_form) ? 'じゅう' : null;
    case '行き': // 地名+行き(です) = ゆき(渋谷行き). 行きます·行きたい는 いき 그대로
      return prev && prev.pos === '名詞' && next && !VERB_ENDINGS.has(next.surface_form) && t.reading === 'イキ' ? 'ゆき' : null;
    case '者':   // 명사 뒤(研究者·参加者)는 しゃ — kuromoji가 맞다. 〜たる者·ともあろう者·する者만 もの(3/3).
                 // 토큰 정확 일치로 넣었다가 코퍼스에서 者 오독이 3→40으로 튀었다(실측) — 문맥으로 좁힌다.
      return prev && (['たる', 'あろう'].includes(prev.surface_form) || /^(動詞|助動詞)/.test(prev.pos)) ? 'もの' : null;
    case '辛い': // 物·もの·料理 앞 = からい(매운). つらい는 그대로
      return next && ['物', 'もの', '料理', '食べ物'].includes(next.surface_form) ? 'からい' : null;
    default: return null;
  }
}

// ── ③ 수사·조수사 ───────────────────────────────────────────────────────────
const NUM_READ = { 一: 'いち', 二: 'に', 三: 'さん', 四: 'よん', 五: 'ご', 六: 'ろく', 七: 'なな', 八: 'はち', 九: 'きゅう', 十: 'じゅう', 何: 'なん', 幾: 'いく' };
const DIGIT_KANJI = { 0: '', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
const KANJI_NUM = /^[一二三四五六七八九十百千何幾]+$/;
const DIGITS = /^[0-9０-９]+$/;

/** 한자 수사 → 히라가나 (三百→さんびゃく·三千→さんぜん 음편 포함). 千 이하. */
export function readNumeral(kanji) {
  if (!KANJI_NUM.test(kanji)) return null;
  let out = '';
  const chars = [...kanji];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i], prevC = chars[i - 1];
    if (c === '十') { out += (prevC && NUM_READ[prevC] && !/[十百千]/.test(prevC)) ? 'じゅう' : (i === 0 ? 'じゅう' : 'じゅう'); continue; }
    if (c === '百') { out = out.replace(/(さん|ろく|はち)$/, (m) => ({ さん: 'さん', ろく: 'ろっ', はち: 'はっ' }[m])); out += { さん: 'びゃく', ろっ: 'ぴゃく', はっ: 'ぴゃく' }[out.slice(-2)] ?? (out.endsWith('ろっ') || out.endsWith('はっ') ? 'ぴゃく' : 'ひゃく'); continue; }
    if (c === '千') { out = out.replace(/(はち)$/, 'はっ'); out += out.endsWith('さん') ? 'ぜん' : out.endsWith('はっ') ? 'せん' : 'せん'; continue; }
    out += NUM_READ[c] ?? '';
  }
  return out;
}

/** 아라비아 숫자 → 한자 수사 (0~9999). kuromoji는 숫자에 독음을 안 준다. */
export function digitsToKanji(str) {
  const n = Number(str.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)));
  if (!Number.isInteger(n) || n < 0 || n > 9999) return null;
  if (n === 0) return '零';
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), te = Math.floor((n % 100) / 10), u = n % 10;
  return (th ? (th === 1 ? '' : DIGIT_KANJI[th]) + '千' : '') + (h ? (h === 1 ? '' : DIGIT_KANJI[h]) + '百' : '')
    + (te ? (te === 1 ? '' : DIGIT_KANJI[te]) + '十' : '') + (u ? DIGIT_KANJI[u] : '');
}

/**
 * 조수사 표 — base = 기본 읽기, special = 「수사열 전체」 또는 「마지막 수사」 → 읽기.
 * 전체 키(一人·二十歳·十四日)가 먼저, 다음 마지막 글자 키(음편: 一→いっ·六→ろっ·八→はっ·十→じゅっ).
 */
export const JA_COUNTERS = {
  人: { base: 'にん', special: { 一: 'ひとり', 二: 'ふたり', 四: 'よにん', 七: 'しちにん', 九: 'きゅうにん' } },
  分: { base: 'ふん', special: { 一: 'いっぷん', 三: 'さんぷん', 四: 'よんぷん', 六: 'ろっぷん', 八: 'はっぷん', 十: 'じゅっぷん', 何: 'なんぷん' } },
  日: { base: 'にち', special: { 二: 'ふつか', 三: 'みっか', 四: 'よっか', 五: 'いつか', 六: 'むいか', 七: 'なのか', 八: 'ようか', 九: 'ここのか', 十: 'とおか', 十四: 'じゅうよっか', 二十: 'はつか', 二十四: 'にじゅうよっか' } },
  時: { base: 'じ', special: { 四: 'よじ', 七: 'しちじ', 九: 'くじ' } },
  月: { base: 'がつ', special: { 四: 'しがつ', 七: 'しちがつ', 九: 'くがつ' } },
  本: { base: 'ほん', special: { 一: 'いっぽん', 三: 'さんぼん', 六: 'ろっぽん', 八: 'はっぽん', 十: 'じゅっぽん', 何: 'なんぼん' } },
  杯: { base: 'はい', special: { 一: 'いっぱい', 三: 'さんばい', 六: 'ろっぱい', 八: 'はっぱい', 十: 'じゅっぱい', 何: 'なんばい' } },
  匹: { base: 'ひき', special: { 一: 'いっぴき', 三: 'さんびき', 六: 'ろっぴき', 八: 'はっぴき', 十: 'じゅっぴき', 何: 'なんびき' } },
  冊: { base: 'さつ', special: { 一: 'いっさつ', 八: 'はっさつ', 十: 'じゅっさつ' } },
  歳: { base: 'さい', special: { 一: 'いっさい', 八: 'はっさい', 十: 'じゅっさい', 二十: 'はたち' } },
  回: { base: 'かい', special: { 一: 'いっかい', 六: 'ろっかい', 八: 'はっかい', 十: 'じゅっかい' } },
  階: { base: 'かい', special: { 一: 'いっかい', 三: 'さんがい', 六: 'ろっかい', 八: 'はっかい', 十: 'じゅっかい', 何: 'なんがい' } },
  個: { base: 'こ', special: { 一: 'いっこ', 六: 'ろっこ', 八: 'はっこ', 十: 'じゅっこ' } },
  軒: { base: 'けん', special: { 一: 'いっけん', 三: 'さんげん', 六: 'ろっけん', 八: 'はっけん', 十: 'じゅっけん' } },
  足: { base: 'そく', special: { 一: 'いっそく', 三: 'さんぞく', 八: 'はっそく', 十: 'じゅっそく' } },
  点: { base: 'てん', special: { 一: 'いってん', 八: 'はってん', 十: 'じゅってん' } },
  票: { base: 'ひょう', special: { 一: 'いっぴょう', 三: 'さんびょう', 六: 'ろっぴょう', 八: 'はっぴょう', 十: 'じゅっぴょう' } },
  択: { base: 'たく', special: { 一: 'いったく' } },
  週間: { base: 'しゅうかん', special: { 一: 'いっしゅうかん', 八: 'はっしゅうかん', 十: 'じゅっしゅうかん' } },
  名: { base: 'めい', special: {} },
  曜日: { base: 'ようび', special: {} },   // 何曜日 → なんようび (月曜日 등은 한 토큰)
  さい: { base: 'さい', special: { 一: 'いっさい', 八: 'はっさい', 十: 'じゅっさい', 二十: 'はたち' } }, // 가나 표기 歳(교재 초급)
  分間: { base: 'ふんかん', special: { 一: 'いっぷんかん', 三: 'さんぷんかん', 四: 'よんぷんかん', 六: 'ろっぷんかん', 八: 'はっぷんかん', 十: 'じゅっぷんかん', 何: 'なんぷんかん' } },
  年: { base: 'ねん', special: { 四: 'よねん', 九: 'くねん' } },
  円: { base: 'えん', special: { 四: 'よえん' } },
  秒: { base: 'びょう', special: {} },
  枚: { base: 'まい', special: {} },
  台: { base: 'だい', special: {} },
  番: { base: 'ばん', special: {} },
  通: { base: 'つう', special: { 一: 'いっつう', 八: 'はっつう', 十: 'じゅっつう' } },
  度: { base: 'ど', special: {} },
};

/** 수사열 + 조수사 → 읽기. 전체 키 → 마지막 글자 키(수사 앞부분 읽기 + 음편) → 기본. */
export function readCounted(numKanji, counter) {
  const c = JA_COUNTERS[counter];
  if (!c) return null;
  if (c.special[numKanji]) return c.special[numKanji];
  const chars = [...numKanji];
  const last = chars[chars.length - 1];
  if (c.special[last] && chars.length > 1) {
    const head = readNumeral(chars.slice(0, -1).join(''));
    // 앞부분이 十으로 끝나면(二十) 마지막 글자 특수형이 앞부분과 겹치지 않는다 — 그대로 잇는다
    return head == null ? null : head + c.special[last];
  }
  const num = readNumeral(numKanji);
  return num == null ? null : num + c.base;
}

/** 두 토큰을 하나로 — 표면 잇기, 독음 지정, 품사는 명사. */
function merged(a, b, reading, extra = {}) {
  return { ...a, surface_form: a.surface_form + b.surface_form, basic_form: a.surface_form + b.surface_form, reading, pos: '名詞', pos_detail_1: '数', ...extra };
}

/** 고정 병합 — 지명 등 두 토큰으로 쪼개지는 고유명사. 독해 게이트 PLACE_YOMI에서 kuromoji가 실제로 틀리는 것만. */
const JA_MERGE = { '山手|線': 'やまのてせん', '今|朝': 'けさ' };

const isNumToken = (t) => !!t && t.pos === '名詞' && (KANJI_NUM.test(t.surface_form) || DIGITS.test(t.surface_form));

/**
 * kuromoji 토큰 배열 → 수리된 토큰 배열. reading은 카타카나(kuromoji 관례) 또는 히라가나 — 호출측이
 * 히라가나로 정규화한다. 등재 밖은 그대로 통과.
 */
export function fixJaTokens(raw) {
  // 연속 수사(三/百·二/十/五)를 먼저 한 토큰으로 — kuromoji는 三百을 三/百으로 쪼개 음편(さんびゃく)을 잃는다
  const tokens = [];
  for (const t of raw) {
    const last = tokens[tokens.length - 1];
    if (last && isNumToken(last) && isNumToken(t) && KANJI_NUM.test(last.surface_form) && KANJI_NUM.test(t.surface_form)) {
      tokens[tokens.length - 1] = { ...last, surface_form: last.surface_form + t.surface_form, basic_form: last.surface_form + t.surface_form, reading: (last.reading || '') + (t.reading || '') };
      continue;
    }
    tokens.push(t);
  }
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    // ③ 수사 + 조수사 → 한 토큰
    if (isNumToken(t) && next && JA_COUNTERS[next.surface_form]) {
      const kanji = DIGITS.test(t.surface_form) ? digitsToKanji(t.surface_form) : t.surface_form;
      // 一日: 月 바로 뒤(四月一日)만 날짜 ついたち. 그 밖은 하루 いちにち — 표에 一을 넣었다가 16건이 깨졌다(실측).
      const prevM = tokens[i - 1]?.surface_form ?? '';
      const reading = kanji === '一' && next.surface_form === '日'
        ? (/月$/.test(prevM) ? 'ついたち' : 'いちにち')
        : kanji && readCounted(kanji, next.surface_form);
      if (reading) { out.push(merged(t, next, reading)); i++; continue; }
    }
    // 고정 병합(山手+線)
    if (next && JA_MERGE[`${t.surface_form}|${next.surface_form}`]) {
      out.push(merged(t, next, JA_MERGE[`${t.surface_form}|${next.surface_form}`], { pos_detail_1: '固有名詞' })); i++; continue;
    }
    // 수사 단독 — 한자 수사의 음편(三百→さんびゃく)·아라비아 숫자(３→さん). 단독 何·幾는 수사가 아니다
    // (何も=なにも·何を=なにを — kuromoji가 맞게 내는 것을 なん으로 덮어썼다, 실측) — ②가 받는다.
    if (isNumToken(t) && !/^[何幾]$/.test(t.surface_form)) {
      const kanji = DIGITS.test(t.surface_form) ? digitsToKanji(t.surface_form) : t.surface_form;
      const reading = kanji && readNumeral(kanji);
      if (reading) { out.push({ ...t, reading }); continue; }
    }
    // ① 토큰 정확 일치 · ② 이웃 조건
    const fixed = JA_TOKEN_READING[t.surface_form] ?? contextReading(tokens, i);
    out.push(fixed ? { ...t, reading: fixed } : t);
  }
  return out;
}
