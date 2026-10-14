// 「한자」 탭 답 카드 모델(HANZI-TAB-AL-001 · 인계 #1337 6146776723 §2) — 무엇을 보일지만 정한다(순수).
// 단어 · 뜻 · 병음은 우리 사전(refVocabIndex)에서, 正 · 훈음 · 구성은 한자 창 모델(hanjaPanelModel · AE-R4)에서 그대로 가져온다.
import { hanjaReadingsOf } from './hanjaKo.js';
import { hanjaPanelModel, sameHanjaWord, splitPinyinSyllables } from './viewerHanjaPanel.js';
import { shortMeaning } from './levelList.js';

/**
 * 단어 칩 — 병음 음절(누른 글자 자리 at) · 한국어 짧은 뜻(같은 한자어면 그 음절 자리 koAt).
 * @param {string} zh
 * @param {string} ch - 누른 글자
 * @param {{pinyin?: string, ko?: string}|null} entry - 사전 항목
 */
export function hanziChipModel(zh, ch, entry, tables = {}) {
  const cs = [...zh];
  const syl = entry?.pinyin ? splitPinyinSyllables(entry.pinyin, cs.length, { erhua: cs.at(-1) === '儿' }) : null;
  const at = cs.flatMap((c, i) => (c === ch ? [i] : []));
  const ko = shortMeaning(entry?.ko || '');
  const same = tables.koTable && ko ? sameHanjaWord(zh, ko, tables) : null;
  const eum = same && at.length ? same.sylls[at[0]] : null;
  const koAt = eum ? ko.indexOf(eum) : -1;
  return { zh, chars: cs, syl, at, ko, koHi: koAt >= 0 ? { from: koAt, to: koAt + eum.length } : null };
}

/** 한 글자 훈음 라벨(「배울 학」) — 없으면 null. */
function hunOf(ch, tables) {
  if (!tables.koTable) return null;
  const r = hanjaReadingsOf(ch, tables)[0];
  return r?.label || r?.eum || null;
}

/**
 * 답 카드.
 * @param {string} ch
 * @param {object} entry - zhHanzi 표의 글자 항목({rd, other?, watch?})
 * @param {{dict?: Map<string, {word: object}>, tables?: object}} ctx
 *   dict = loadRefVocabIndex('Chinese') 결과(표제어 → {level, word}), tables = {koTable, hunTable, tradTable, panel}
 */
export function hanziCardModel(ch, entry, { dict = null, tables = {} } = {}) {
  if (!entry) return null;
  const word = (zh) => dict?.get(zh)?.word || null;
  const chip = (zh) => hanziChipModel(zh, ch, word(zh), tables);
  // 소리마다 정체가 갈리면(只 zhǐ 只 · zhī 隻) 소리 줄마다 正 · 훈음, 소리가 하나면 머리에.
  const rds = entry.rd || [];
  const perReading = rds.length > 1 && rds.some((r) => r.zheng);
  const oneZheng = !perReading && rds[0]?.zheng && rds[0].zheng !== ch ? rds[0].zheng : null;
  const panel = tables.tradTable ? hanjaPanelModel({ ch, word: ch, index: 0, tables }) : hanjaPanelModel({ ch, tables });
  const head = {
    ch,
    readings: rds.map((r) => r.py),
    zheng: perReading ? null : oneZheng || panel?.head?.zheng || null,
    hun: perReading ? null : (oneZheng && hunOf(oneZheng, tables)) || panel?.head?.label || null,
    perReading,
    parts: panel?.parts?.pieces?.map((p) => p.ch) || null,
  };
  const watch = (entry.watch || []).map((x) => {
    const w = word(x.w);
    return { zh: x.w, py: w?.pinyin || '', ko: shortMeaning(w?.ko || ''), note: x.note || '' };
  });
  const rd = rds.map((r) => ({
    py: r.py,
    n: r.n,
    zheng: perReading ? r.zheng || null : null,
    hun: perReading && r.zheng ? hunOf(r.zheng, tables) : null,
    hear: r.hear || null,
    senses: (r.s || []).map((s) => (s.fn
      ? { g: s.g, fn: s.fn, phr: s.phr || [] }
      : { g: s.g, chips: (s.w || []).map(chip) })),
  }));
  return { head, watch, rd, other: entry.other || [] };
}

/**
 * 「방금」 줄 · 끝 목록 한 줄 — 소리 전부 · 첫 뜻(첫 소리의 첫 갈래).
 * @returns {{readings: string, gloss: string}}
 */
export function hanziBrief(entry) {
  const readings = [...(entry?.rd || []).map((r) => r.py), ...(entry?.other || []).map((o) => o.py)];
  const glosses = (entry?.rd || []).map((r) => r.s?.[0]?.g).filter(Boolean);
  return { readings: readings.join(' · '), gloss: glosses.join(' / ') };
}

