// 책장 「단어 · 문형」 레벨 타일(LEVEL-LIST-AJ-001 · 목업 #v5-shelf · #z-shelf) — 레벨 + 「단어 N / 문형 N」 두 줄.
// 숫자는 서버가 목록과 같은 조립에서 센 값(levelTileCounts)이다. 설명 열 · 「→」 없음.
import Link from 'next/link';
import { LEVEL_LIST_LANGS, levelLabel, levelListHref } from '@/lib/levelList';
import './level-list.css';

const slugOf = language => Object.keys(LEVEL_LIST_LANGS).find(k => LEVEL_LIST_LANGS[k].language === language);
const n = value => value.toLocaleString('en-US');

export default function LevelTiles({ language, tiles }) {
  const lang = slugOf(language);
  if (!lang) return null;
  return <section className="lv-shelf" aria-labelledby="lv-shelf-h">
    <h2 id="lv-shelf-h">단어·문형</h2>
    <ul className={tiles.length > 5 ? 'lv-tiles lv-tiles--6' : 'lv-tiles'}>
      {tiles.map(t => <li key={t.levelKey} className="lv-tile">
        <span className="lv-tile__lv">{levelLabel(t.levelKey)}</span>
        <Link className="lv-tile__go" href={levelListHref(lang, 'vocab', t.levelKey)} aria-label={`${levelLabel(t.levelKey)} 단어 ${n(t.vocab)}개`}>단어<b>{n(t.vocab)}</b></Link>
        <Link className="lv-tile__go" href={levelListHref(lang, 'bunkei', t.levelKey)} aria-label={`${levelLabel(t.levelKey)} 문형 ${n(t.bunkei)}개`}>문형<b>{n(t.bunkei)}</b></Link>
      </li>)}
    </ul>
  </section>;
}
