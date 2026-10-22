// 글자 칸(HSK 단어 페이지 개편 · 문서 「단어 설명 형식 · 글자 칸」) — 모든 단어 설명에 자동으로 붙는다.
// 자료는 앱 한자 창(hanjaPanelModel)을 그대로 쓴다: 훈음 = 단어 조회(정체 꼴 · 한국 다음자 예외 포함),
// 구성 조각 = 형성자 역할(뜻 + 소리) 또는 1단 성분. 새 표 · 새 판정을 만들지 않는다.
//
// 칸 하나 = { ch, zheng(정체가 다를 때만), label(훈음), pieces:[{ ch, label }], kana(일본어 — 이 단어 속 그 글자 읽기) }.
// 일본어(JLPT 단어 페이지)는 lookup = 한국 정자 꼴 단어(経験 → 經驗)로 찾고 그 꼴을 아래 회색 글자로 보인다. 간체 변환을 거치지 않게
// 빈 정체 표(JA_TRAD)를 넘긴다(일본 글자 叶를 간체로 보고 葉로 바꾸지 않게).
// 표가 아직 없으면 null — 화면은 칸 자리만 잡지 않고 그리지 않는다(훈음 없는 칸이 먼저 보였다 바뀌지 않게).
import { hanjaPanelModel, loadHanjaPanelTable } from './viewerHanjaPanel.js';
import { loadZhengTable } from './glyphTables.js';

const HAN = /\p{Script=Han}/u;

export const JA_TRAD = Object.freeze({ chars: {}, phrases: {} });

/** lookup = 찾을 꼴(같은 글자 수 — 일본어 정자 단어), readings = 글자별 읽기(같은 글자 수). 々는 칸을 만들지 않는다. */
export function levelCharTiles(word, tables, { lookup = null, readings = null } = {}) {
  if (!word || !tables?.koTable || !tables.hunTable || !tables.tradTable || !tables.panel) return null;
  const chars = [...String(word)];
  const form = lookup && [...lookup].length === chars.length ? [...lookup] : null;
  const tiles = [];
  chars.forEach((ch, index) => {
    if (!HAN.test(ch) || ch === '々') return;
    const f = form ? form[index] : ch;
    const model = hanjaPanelModel({ ch: f, index, word: form ? form.join('') : word, tables });
    if (!model) return;
    tiles.push({
      ch,
      zheng: (form ? (f !== ch ? f : null) : model.head.zheng) || null,
      label: model.head.label || model.head.eum || '',
      pieces: (model.parts?.pieces || []).map((p) => ({ ch: p.ch, label: p.label || '' })),
      ...(readings?.[index] ? { kana: readings[index] } : {}),
    });
  });
  return tiles;
}

/** 일본어 글자 칸 — 표제어를 한국 정자 꼴로 바꿔 찾고(jeongja = jaJeongja.json의 j), kr(「けい,けん」)을 글자마다 붙인다. */
export function jaCharTiles(word, kr, tables) {
  if (!tables?.jeongja) return null;
  const chars = [...String(word || '')];
  const lookup = chars.map((c) => tables.jeongja[c] || c).join('');
  const readings = kr ? String(kr).split(',') : null;
  return levelCharTiles(word, { ...tables, tradTable: JA_TRAD }, { lookup, readings: readings?.length === chars.length ? readings : null });
}

let tablesPromise = null;
let jaPromise = null;
/** 일본어 글자 칸 표 — 훈 · 음 · 한자 창 + 신자체 → 한국 정자(jaJeongja.json). 정체 표(간체용)는 받지 않는다. */
export function loadJaCharTables() {
  jaPromise ||= Promise.all([
    import('./data/hanjaKo.json'), import('./data/hanjaHun.json'), import('./data/jaJeongja.json'), loadHanjaPanelTable(),
  ]).then(([ko, hun, jz, panel]) => ({ koTable: ko.default || ko, hunTable: hun.default || hun, jeongja: (jz.default || jz).j, tradTable: JA_TRAD, panel }))
    .catch((error) => { jaPromise = null; throw error; });
  return jaPromise;
}

/** 글자 칸 표 네 벌(훈 · 음 · 정체 · 한자 창) — 한 번만 받고, 실패하면 다음에 다시 받는다. */
export function loadLevelCharTables() {
  tablesPromise ||= Promise.all([
    import('./data/hanjaKo.json'), import('./data/hanjaHun.json'), loadZhengTable(), loadHanjaPanelTable(),
  ]).then(([ko, hun, trad, panel]) => ({ koTable: ko.default || ko, hunTable: hun.default || hun, tradTable: trad?.default || trad, panel }))
    .catch((error) => { tablesPromise = null; throw error; });
  return tablesPromise;
}

/**
 * 레벨 글자 칸 묶음(서버 · 빌드 때) — 그 레벨 단어의 칸만 미리 계산해 { t: 칸들(같은 칸은 하나), w: { 표제어: [칸 번호] } }로.
 * 화면은 이것만 먼저 받는다(H1 8KB · N3 38KB · H7 113KB gz — 표 네 벌은 약 200KB). 묶음에 없는 단어(찾기 · 예문 단어 창)만 표 네 벌을 받아 계산한다.
 * 일본어 칸의 읽기(kana)는 단어마다 다르므로 빼고 싣는다 — 화면이 kr로 다시 붙인다(levelPackTiles).
 */
export function levelTilePack(words, tilesOfWord) {
  const ids = new Map(), t = [], w = {};
  for (const word of words) {
    if (!word || word in w) continue;
    const tiles = tilesOfWord(word);
    if (!Array.isArray(tiles)) continue; // 칸이 없는 단어(가나만)도 빈 칸으로 싣는다 — 빠지면 화면이 표 네 벌을 받는다.
    w[word] = tiles.map(({ kana: _kana, ...tile }) => {
      const k = JSON.stringify(tile);
      if (!ids.has(k)) { ids.set(k, t.length); t.push(tile); }
      return ids.get(k);
    });
  }
  return { t, w };
}

/** 묶음에서 한 단어의 칸 — 없으면 undefined(표로 계산할 단어). kr(「けい,けん」)이 글자 수와 맞으면 칸마다 그 글자 읽기를 붙인다. */
export function levelPackTiles(pack, word, kr = null) {
  const ids = pack?.w?.[word];
  if (!ids) return undefined;
  const chars = [...String(word)];
  const readings = kr ? String(kr).split(',') : null;
  if (readings?.length !== chars.length) return ids.map((i) => pack.t[i]);
  let at = 0;
  return ids.map((i) => {
    const tile = pack.t[i];
    while (at < chars.length && chars[at] !== tile.ch) at++;
    const kana = readings[at++];
    return kana ? { ...tile, kana } : tile;
  });
}
