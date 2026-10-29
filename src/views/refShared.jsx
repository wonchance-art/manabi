/**
 * 언어 레퍼런스 공용 렌더링 헬퍼 (프랑스어·일본어·영어)
 * 콘텐츠 본문은 **굵게** 마크업만 지원 (각 언어 SCHEMA.md 참고)
 */
import { Fragment } from 'react';
import { alignFurigana, kataToHira } from '../lib/jaFurigana';

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

/* 일본어 요미가나(루비) 정렬은 src/lib/jaFurigana.js(순수 함수 — 서버 조립도 같이 쓴다). */
export { alignFurigana };

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
          ? <ruby key={i}>{s.text}<span className="rt-an">{s.rt}</span></ruby>
          : <span key={i}>{s.text}</span>
      )}
    </span>
  );
}

/** 섹션 콜아웃 — 렌더 순서 고정. 상자는 이름 글자로 구분한다(국기 아이콘 없음 — D-X6, 2026-10-12). */
export const CALLOUT_ORDER = ['pitfall', 'vsKo', 'vsEn', 'hanja', 'etym', 'tip'];

export const CALLOUT_KINDS = {
  pitfall: { label: '한국인이 헷갈리는 포인트', cls: 'fr-callout--pitfall' },
  vsKo:    { label: '한국어와 비교', cls: 'fr-callout--vsen' },
  vsEn:    { label: '영어와 비교', cls: 'fr-callout--vsen' },
  hanja:   { label: '한자어 연결', cls: 'fr-callout--etym' },
  etym:    { label: '어원 연결', cls: 'fr-callout--etym' },
  tip:     { label: '팁', cls: 'fr-callout--tip' },
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
 * 영어 ↔ 프랑스어 나란히 비교 블록 — 영어와 문법 구조가 평행한 지점을 시각적으로 대조.
 * data: { rows: [{ en, fr, ko? }], note? }  — en/fr 안의 **굵게**로 평행 부분 강조.
 */
export function RefParallel({ data }) {
  if (!data || !Array.isArray(data.rows) || data.rows.length === 0) return null;
  return (
    <div className="fr-parallel">
      <span className="fr-parallel__label">영어와 나란히</span>
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

// 레벨 색은 콘텐츠 데이터(각 언어의 content index)에 박혀 있고 수백 곳에서 쓰인다.
// 그 값을 바꾸는 대신, 글자로 쓸 때만 같은 색상을 밝혀 대비를 확보한다(링·테두리는 원본 유지).
// 예: #4C6EF5(3.17) → #638FFF(4.50). 이미 밝은 색은 255로 클램프돼 그대로 남는다.
export function lightenForText(color, factor = 1.3) {
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  const ch = [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor)));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 레벨 동그라미 배지 */
export function LevelDot({ meta, size = 'md' }) {
  if (!meta) return null;
  return (
    <span
      className={`fr-level-dot ${size === 'sm' ? 'fr-level-dot--sm' : ''}`}
      style={{ background: meta.bg, border: `2px solid ${meta.color}`, color: lightenForText(meta.color) }}
    >
      {meta.short || meta.key}
    </span>
  );
}
