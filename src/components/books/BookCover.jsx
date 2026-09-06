import { BOOK_SERIES } from '@/lib/bookNavigation';

export default function BookCover({ language = 'Japanese', compact = false }) {
  const series = BOOK_SERIES.find(item => item.language === language) || BOOK_SERIES[0];
  return <div className={`manabi-cover${compact ? ' manabi-cover--compact' : ''}`} style={{ '--series-color': series.color }} aria-hidden="true">
    <div className="manabi-cover__top"><span>manabi books</span><b>{series.level}</b></div>
    {<strong>작은 문장으로<br />시작하는 {series.name}</strong>}
    <span className={`manabi-cover__glyph${['English', 'French'].includes(language) ? ' manabi-cover__glyph--latin' : ''}`} lang={{ Japanese: 'ja', Chinese: 'zh', English: 'en', French: 'fr' }[language]}>{series.glyph}</span>
    <div className="manabi-cover__bottom"><span>{series.native}</span><small>{compact ? series.level : 'LANGUAGE COLLECTION'}</small></div>
  </div>;
}
