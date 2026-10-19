// 글자 칸(HSK 단어 페이지 개편 · 문서 「단어 설명 형식 · 글자 칸」) — 모든 단어 설명에 자동으로 붙는다.
// 자료는 앱 한자 창(hanjaPanelModel)을 그대로 쓴다: 훈음 = 단어 조회(정체 꼴 · 한국 다음자 예외 포함),
// 구성 조각 = 형성자 역할(뜻 + 소리) 또는 1단 성분. 새 표 · 새 판정을 만들지 않는다.
//
// 칸 하나 = { ch, zheng(정체가 다를 때만), label(훈음), pieces:[{ ch, label }] }.
// 표가 아직 없으면 null — 화면은 칸 자리만 잡지 않고 그리지 않는다(훈음 없는 칸이 먼저 보였다 바뀌지 않게).
import { hanjaPanelModel, loadHanjaPanelTable } from './viewerHanjaPanel.js';
import { loadZhengTable } from './glyphTables.js';

const HAN = /\p{Script=Han}/u;

export function levelCharTiles(word, tables) {
  if (!word || !tables?.koTable || !tables.hunTable || !tables.tradTable || !tables.panel) return null;
  const chars = [...String(word)];
  const tiles = [];
  chars.forEach((ch, index) => {
    if (!HAN.test(ch)) return;
    const model = hanjaPanelModel({ ch, index, word, tables });
    if (!model) return;
    tiles.push({
      ch,
      zheng: model.head.zheng || null,
      label: model.head.label || model.head.eum || '',
      pieces: (model.parts?.pieces || []).map((p) => ({ ch: p.ch, label: p.label || '' })),
    });
  });
  return tiles;
}

let tablesPromise = null;
/** 글자 칸 표 네 벌(훈 · 음 · 정체 · 한자 창) — 한 번만 받고, 실패하면 다음에 다시 받는다. */
export function loadLevelCharTables() {
  tablesPromise ||= Promise.all([
    import('./data/hanjaKo.json'), import('./data/hanjaHun.json'), loadZhengTable(), loadHanjaPanelTable(),
  ]).then(([ko, hun, trad, panel]) => ({ koTable: ko.default || ko, hunTable: hun.default || hun, tradTable: trad?.default || trad, panel }))
    .catch((error) => { tablesPromise = null; throw error; });
  return tablesPromise;
}
