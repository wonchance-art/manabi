// 책장 「단어 · 문형」 레벨 타일(LEVEL-LIST-AJ-001 · 목업 #v5-shelf · #z-shelf) — 레벨 + 「단어 N / 문형 N」 두 줄
// (중국어 HSK 1 · 2는 「한자 N」 한 줄 더 — HANZI-TAB-AL-001 §1, H7(7–9 통합 밴드)은 문형 없이 「단어 N」 한 줄).
// 영어 · 프랑스어 A1(SHELF-REDESIGN-001)은 「단어 N」 한 줄 — 단어 페이지(/english|french/words/a1)로 간다.
// 숫자는 서버가 목록과 같은 조립에서 센 값(levelTileCounts)이다. 설명 열 · 「→」 없음.
// 「단어」는 누르는 순간 단어 묶음을 받기 시작하는 링크(LevelWordsLink — LEVEL-LIST-RSC-001), 화면 · 미리 받기는 Link와 같다.
// 줄은 책 표지 줄과 같은 격자(.shelf-grid — 열 수 shelfGridClass)라 PC에서 N5 표지가 N5 타일 바로 위에 선다.
import Link from 'next/link';
import LevelWordsLink from './LevelWordsLink';
import { LEVEL_LIST_LANGS, levelLabel, levelListHref } from '@/lib/levelList';
import { LATIN_WORD_LEVELS, latinWordsHref } from '@/lib/latinLevelWords';
import './level-list.css';

const slugOf = language => Object.keys(LEVEL_LIST_LANGS).find(k => LEVEL_LIST_LANGS[k].language === language)
  || Object.keys(LATIN_WORD_LEVELS).find(k => k === String(language).toLowerCase());
const n = value => value.toLocaleString('en-US');

/** 책장 줄 격자 — 표지 줄과 타일 줄이 같은 열 수를 쓴다(타일이 6 · 7개인 언어만 열을 늘린다, 기본 5열). */
export const shelfGridClass = count => count > 5 ? `shelf-grid shelf-grid--${count}` : 'shelf-grid';
/** 칸 이름 — 타일이 가진 줄 그대로: 「단어 · 문형 · 한자」 / 「단어 · 문형」 / 「단어」. */
export function levelTilesHeading(tiles) {
  return ['단어', tiles.some(t => t.bunkei != null) && '문형', tiles.some(t => t.hanzi > 0) && '한자'].filter(Boolean).join(' · ');
}

export default function LevelTiles({ language, tiles: given }) {
  const lang = slugOf(language);
  if (!lang) return null;
  const latin = !LEVEL_LIST_LANGS[lang];
  const tiles = latin ? given.map(({ levelKey, vocab }) => ({ levelKey, vocab })) : given; // 라틴 언어는 단어 줄만 연다
  const vocabHref = levelKey => latin ? latinWordsHref(lang, levelKey) : levelListHref(lang, 'vocab', levelKey);
  return <section className="lv-shelf" aria-labelledby="lv-shelf-h">
    <h2 id="lv-shelf-h" className="shelf-section-h">{levelTilesHeading(tiles)}</h2>
    <ul className={`lv-tiles ${shelfGridClass(tiles.length)}`}>
      {tiles.map(t => <li key={t.levelKey} className="lv-tile">
        <span className="lv-tile__lv">{levelLabel(t.levelKey)}</span>
        <LevelWordsLink className="lv-tile__go" href={vocabHref(t.levelKey)} lang={lang} levelKey={t.levelKey} aria-label={`${levelLabel(t.levelKey)} 단어 ${n(t.vocab)}개`}>단어<b>{n(t.vocab)}</b></LevelWordsLink>
        {t.bunkei != null && <Link className="lv-tile__go" href={levelListHref(lang, 'bunkei', t.levelKey)} aria-label={`${levelLabel(t.levelKey)} 문형 ${n(t.bunkei)}개`}>문형<b>{n(t.bunkei)}</b></Link>}
        {t.hanzi > 0 && <Link className="lv-tile__go" href={levelListHref(lang, 'hanzi', t.levelKey)} aria-label={`${levelLabel(t.levelKey)} 한자 ${n(t.hanzi)}자`}>한자<b>{n(t.hanzi)}</b></Link>}
      </li>)}
    </ul>
  </section>;
}
