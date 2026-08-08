/**
 * 언어 레퍼런스 공용 렌더링 헬퍼 (프랑스어·일본어·영어)
 * 콘텐츠 본문은 **굵게** 마크업만 지원 (각 언어 SCHEMA.md 참고)
 */
import { Fragment } from 'react';

/** "**굵게**" 마크업을 <strong>으로 변환 */
export function refInline(text) {
  if (!text) return null;
  return String(text)
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/** 예문·단어의 원문/발음 필드 — 언어별 키를 흡수 */
export function refMain(item) {
  return item.fr ?? item.ja ?? item.en ?? item.zh ?? '';
}
export function refPron(item) {
  return item.ipa ?? item.yomi ?? item.pinyin ?? null;
}

/* ── 일본어 요미가나(루비) 정렬 ──
 * ja(한자 혼용)와 yomi(전체 히라가나)를 정렬해 한자 구간에만 후리가나를 단다.
 * 정렬 실패(한글 병기·특수 표기 등) 시 null → 호출부가 기존 표기로 폴백.
 */
const isKanjiLike = ch => /[一-鿿々〆ヶ0-9０-９]/.test(ch);
const kataToHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const PUNCT = '。、・！？!?,. 　「」『』();（）:〜';

// 한자 독음(rt) 후보 제약 — 독음은 가나로만 구성되고, 음절 경계상 올 수 없는 글자로 시작하지 않는다.
const isKanaCh = c => (c >= 'ぁ' && c <= 'ゖ') || c === 'ー';
const RT_BAD_START = 'んっーゃゅょぁぃぅぇぉゎ';
const UO_VOWEL = 'うくすつぬふむゆるぐずづぶぷぅゅょおこそとのほもよろをごぞどぼぽぉ'; // う단·お단 — 뒤따르는 「う」는 장음
const SMALL_KANA = 'ぁぃぅぇぉゃゅょゎっー';
const moraLen = rt => rt.reduce((n, c) => n + (SMALL_KANA.includes(c) ? 0 : 1), 0); // 한자당 독음 길이 추정용

// 같은 (ja,yomi) 쌍은 목록 렌더·재렌더에서 반복 호출됨 — 결과 캐시
const FURI_CACHE = new Map();

export function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return null;          // 한글 병기(OT) — 정렬 대상 아님
  if (![...ja].some(isKanjiLike)) return null;       // 한자 없음 — 루비 불필요

  const cacheKey = ja + '\u0000' + yomiRaw;
  if (FURI_CACHE.has(cacheKey)) return FURI_CACHE.get(cacheKey);

  const yomi = [...kataToHira(yomiRaw.replace(/[\s　]+/g, ''))];
  // ja → [한자 구간 | 가나·기호 구간] 세그먼트
  const segs = [];
  for (const ch of ja) {
    const t = isKanjiLike(ch) ? 'k' : 'p';
    if (segs.length && segs[segs.length - 1].t === t) segs[segs.length - 1].s += ch;
    else segs.push({ t, s: ch });
  }

  // 백트래킹 정렬: 한자 구간마다 가능한 독음 길이를 모두 시도하고,
  // 비용 Σ(독음길이−한자길이)² 가 최소인 전역 정렬을 채택한다(동점이면 앞 구간이 긴 쪽).
  const N = yomi.length;
  const memo = new Map();
  // afterRt: 직전에 소비한 yomi 글자가 한자 독음(rt)이었는지 — 한자↔한자 경계에서만 장음 규칙 적용
  function solve(si, yi, afterRt) {
    if (si === segs.length) {
      let j = yi;
      while (j < N && PUNCT.includes(yomi[j])) j++;    // 꼬리 구두점 허용
      return j === N ? { cost: 0, parts: [] } : null;
    }
    const key = (si * 4096 + yi) * 2 + (afterRt ? 1 : 0);
    if (memo.has(key)) return memo.get(key);
    const seg = segs[si];
    let best = null;
    if (seg.t === 'p') {
      const norm = kataToHira(seg.s.replace(/[\s　]+/g, ''));
      let j = yi, ok = true;
      for (const c of norm) {
        while (j < N && yomi[j] !== c && PUNCT.includes(yomi[j])) j++; // yomi 쪽 구두점 건너뜀
        if (j < N && yomi[j] === c) j++;
        else if (PUNCT.includes(c)) continue;          // yomi 쪽에 구두점이 없는 경우 허용
        else { ok = false; break; }
      }
      if (ok) {
        const rest = solve(si + 1, j, j === yi ? afterRt : false);
        if (rest) best = { cost: rest.cost, parts: [{ text: seg.s }, ...rest.parts] };
      }
    } else {
      // 다음 가나 구간의 첫 글자 — 독음이 뒤따르는 조사·오쿠리가나를 삼키는 동점 해소용
      let nextFirst = null;
      if (segs[si + 1]) {
        const nn = kataToHira(segs[si + 1].s.replace(/[\s　]+/g, ''));
        nextFirst = [...nn].find(c => !PUNCT.includes(c)) || null;
      }
      for (let end = N; end > yi; end--) {
        const rt = yomi.slice(yi, end);
        if (!rt.every(isKanaCh)) continue;
        if (RT_BAD_START.includes(rt[0])) continue;
        if (rt[0] === 'う' && afterRt && yi > 0 && UO_VOWEL.includes(yomi[yi - 1])) continue;
        const rest = solve(si + 1, end, true);
        if (!rest) continue;
        const d = moraLen(rt) - seg.s.length;
        const cost = rest.cost + 8 * d * d + (nextFirst && rt.includes(nextFirst) ? 1 : 0);
        if (!best || cost < best.cost)
          best = { cost, parts: [{ text: seg.s, rt: rt.join('') }, ...rest.parts] };
      }
    }
    memo.set(key, best);
    return best;
  }
  const r = solve(0, 0, false);
  const result = r ? r.parts : null;                   // null = 정렬 불가 — 정렬 신뢰 불가
  if (FURI_CACHE.size > 4000) FURI_CACHE.clear();
  FURI_CACHE.set(cacheKey, result);
  return result;
}

/** 일본어 텍스트 — 한자 위 요미가나 루비, 실패 시 기존(원문+독음) 폴백 */
const normJa = s => kataToHira(String(s || '').replace(/[\s　]+/g, '')).replace(/[。、・！？!?,.「」『』]/g, '');

export function JaText({ ja, yomi, fallbackPron = true }) {
  const segs = alignFurigana(ja, yomi);
  if (!segs) {
    // 가나 전용 문장은 독음이 원문과 같으므로 중복 표시하지 않음
    const showPron = fallbackPron && yomi && normJa(yomi) !== normJa(ja);
    return (
      <>
        <span lang="ja">{ja}</span>
        {showPron && <span className="fr-example__ipa">{yomi}</span>}
      </>
    );
  }
  return (
    <span lang="ja" className="ja-ruby">
      {segs.map((s, i) =>
        s.rt
          ? <ruby key={i}>{s.text}<rt>{s.rt}</rt></ruby>
          : <span key={i}>{s.text}</span>
      )}
    </span>
  );
}

/** 섹션 콜아웃 — 렌더 순서 고정 */
export const CALLOUT_ORDER = ['pitfall', 'vsKo', 'vsEn', 'hanja', 'etym', 'tip'];

export const CALLOUT_KINDS = {
  pitfall: { icon: '🚨', label: '한국인이 헷갈리는 포인트', cls: 'fr-callout--pitfall' },
  vsKo:    { icon: '🇰🇷', label: '한국어와 비교', cls: 'fr-callout--vsen' },
  vsEn:    { icon: '🇬🇧', label: '영어와 비교', cls: 'fr-callout--vsen' },
  hanja:   { icon: '🈶', label: '한자어 연결', cls: 'fr-callout--etym' },
  etym:    { icon: '🌱', label: '어원 연결', cls: 'fr-callout--etym' },
  tip:     { icon: '💡', label: '팁', cls: 'fr-callout--tip' },
};

export function Callout({ kind, text }) {
  const k = CALLOUT_KINDS[kind];
  if (!k || !text) return null;
  return (
    <div className={`fr-callout ${k.cls}`}>
      <span className="fr-callout__label">{k.label}</span>
      <p className="fr-callout__body">{refInline(text)}</p>
    </div>
  );
}

/**
 * 🇬🇧↔🇫🇷 나란히 비교 블록 — 영어와 문법 구조가 평행한 지점을 시각적으로 대조.
 * data: { rows: [{ en, fr, ko? }], note? }  — en/fr 안의 **굵게**로 평행 부분 강조.
 */
export function RefParallel({ data }) {
  if (!data || !Array.isArray(data.rows) || data.rows.length === 0) return null;
  return (
    <div className="fr-parallel">
      <span className="fr-parallel__label">🇬🇧 ↔ 🇫🇷 영어와 나란히</span>
      <div className="fr-parallel__rows">
        {data.rows.map((r, i) => (
          <div key={i} className="fr-parallel__row">
            <div className="fr-parallel__line fr-parallel__line--en">
              <span className="fr-parallel__tag">EN</span>
              <span className="fr-parallel__txt" lang="en">{refInline(r.en)}</span>
            </div>
            <div className="fr-parallel__line fr-parallel__line--fr">
              <span className="fr-parallel__tag">FR</span>
              <span className="fr-parallel__txt" lang="fr">{refInline(r.fr)}</span>
            </div>
            {r.ko && <div className="fr-parallel__ko">{r.ko}</div>}
          </div>
        ))}
      </div>
      {data.note && <p className="fr-parallel__note">{refInline(data.note)}</p>}
    </div>
  );
}

/**
 * 🀄 한자 다리 — 중국어 간체가 낯설 때 번체·일본 한자로 풀어준다.
 * data: { rows: [{ zh, trad, ja, read?, ko? }], note? }
 *   zh=간체(학습 대상) · trad=번체(한국 한자에 가까움) · ja=일본 한자 · read=일본어 읽기(가나) · ko=한국 한자음·뜻
 */
// 가나 → 로마자(헵번식). 중국어 학습자용 — 일본 한자 읽기를 히라가나 대신 로마자로.
const HANJA_ROMA = {
  きゃ:'kya',きゅ:'kyu',きょ:'kyo',しゃ:'sha',しゅ:'shu',しょ:'sho',ちゃ:'cha',ちゅ:'chu',ちょ:'cho',
  にゃ:'nya',にゅ:'nyu',にょ:'nyo',ひゃ:'hya',ひゅ:'hyu',ひょ:'hyo',みゃ:'mya',みゅ:'myu',みょ:'myo',
  りゃ:'rya',りゅ:'ryu',りょ:'ryo',ぎゃ:'gya',ぎゅ:'gyu',ぎょ:'gyo',じゃ:'ja',じゅ:'ju',じょ:'jo',
  びゃ:'bya',びゅ:'byu',びょ:'byo',ぴゃ:'pya',ぴゅ:'pyu',ぴょ:'pyo',
  あ:'a',い:'i',う:'u',え:'e',お:'o',
  か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',
  さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',
  た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',
  な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',
  ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',
  ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',や:'ya',ゆ:'yu',よ:'yo',
  ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',わ:'wa',を:'o',ん:'n',ゔ:'vu',
};
export function kanaToRomaji(s) {
  const h = kataToHira(String(s || '').replace(/[\s　]+/g, ''));
  let out = '', i = 0, dbl = false;
  while (i < h.length) {
    if (h[i] === 'っ') { dbl = true; i++; continue; }
    if (h[i] === 'ー') { out += out.slice(-1) || ''; i++; continue; }
    let r;
    const two = h.substr(i, 2);
    if (HANJA_ROMA[two]) { r = HANJA_ROMA[two]; i += 2; }
    else if (HANJA_ROMA[h[i]]) { r = HANJA_ROMA[h[i]]; i += 1; }
    else { out += h[i]; i++; continue; }
    if (dbl) { r = r[0] + r; dbl = false; }
    out += r;
  }
  return out;
}

export function RefHanjaBridge({ data }) {
  if (!data || !Array.isArray(data.rows) || data.rows.length === 0) return null;
  return (
    <div className="hanja-bridge">
      <span className="hanja-bridge__label">🀄 한자 다리 — 간체가 낯설 땐 번체·일본 한자로</span>
      {/* 좁은 화면에서 한 행이 뷰포트를 넘으면 페이지 전체가 밀리므로 표만 가로 스크롤시킨다 */}
      <div className="hanja-bridge__scroll">
      <table className="hanja-bridge__table">
        <tbody>
          {data.rows.map((r, i) => (
            <Fragment key={i}>
              <tr>
                <td className="hanja-bridge__c hanja-bridge__c--zh"><b>简</b><span lang="zh-Hans">{r.zh}</span></td>
                <td className="hanja-bridge__a">→</td>
                <td className="hanja-bridge__c"><b>繁</b><span lang="zh-Hant">{r.trad}</span></td>
                <td className="hanja-bridge__a">→</td>
                <td className="hanja-bridge__c hanja-bridge__c--ja"><b>日</b><span lang="ja">{r.ja}</span>{r.read && <span className="hanja-bridge__read">{kanaToRomaji(r.read)}</span>}</td>
              </tr>
              {r.ko && <tr><td className="hanja-bridge__ko" colSpan={5}>{refInline(r.ko)}</td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
      {data.note && <p className="hanja-bridge__note">{refInline(data.note)}</p>}
    </div>
  );
}

/** 레벨 동그라미 배지 */
export function LevelDot({ meta, size = 'md' }) {
  if (!meta) return null;
  return (
    <span
      className={`fr-level-dot ${size === 'sm' ? 'fr-level-dot--sm' : ''}`}
      style={{ background: meta.bg, border: `2px solid ${meta.color}`, color: meta.color }}
    >
      {meta.short || meta.key}
    </span>
  );
}
