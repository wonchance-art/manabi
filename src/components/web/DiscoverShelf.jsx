import Link from 'next/link';
import { langNameKo } from '@/lib/constants';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import { canReadSuggestion, suggestionHref } from '@/lib/suggestionReading';

// 발견 서가(SHELF-001 — 오너 「발견에 공개」·「서가」 2026-10-16 KST): 누구나 읽는 책장. 매일 오는 소식 · 함께 읽는 글을
// 한자리에서 연다. 문학 · 그림 한 장 읽기 · 매거진 칸은 공개가 결정될 때 연다 — 공개 자료 metadata는 누구나 꾸밀 수 있어서
// (artBook.js 경고) 정본 판정 없이 provider만 보고 꽂으면 남의 자료가 정본 책처럼 보인다.
export const SHELF_NEWS_LIMIT = 4;

/** 언어가 한쪽으로 몰리지 않게 번갈아 고른다(일본어 · 영어 · 일본어 …). 같은 언어 안의 순서는 그대로. */
export function interleaveByLanguage(rows, limit = SHELF_NEWS_LIMIT) {
  const queues = new Map();
  for (const row of rows) {
    if (!queues.has(row.language)) queues.set(row.language, []);
    queues.get(row.language).push(row);
  }
  const lanes = [...queues.values()];
  const picked = [];
  for (let i = 0; picked.length < limit && lanes.some((lane) => i < lane.length); i++) {
    for (const lane of lanes) if (lane[i] && picked.length < limit) picked.push(lane[i]);
  }
  return picked;
}

/** 「10월 16일」 — KST 날짜 문자열(YYYY-MM-DD)에서. */
export const shelfDateLabel = (date) => {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}월 ${day}일` : '';
};

export default function DiscoverShelf({ suggestions = [], publicCount = 0, date }) {
  const readable = suggestions.filter(canReadSuggestion);
  const news = interleaveByLanguage(readable);
  if (!news.length && !publicCount) return null;
  return <section className="discover-shelf" aria-labelledby="discover-shelf-title">
    <div className="manabi-section-heading">
      <h2 id="discover-shelf-title">서가</h2>
      <span>누구나 읽는 책장</span>
    </div>
    {news.length > 0 && <div className="discover-shelf__row">
      <div className="discover-shelf__label">
        <h3>오늘의 소식</h3>
        <small>{shelfDateLabel(date)}</small>
        <Link className="manabi-link" href="/discover?view=reading">전체 보기 ({readable.length})</Link>
      </div>
      <ul className="discover-shelf__items">
        {news.map((s) => <li key={s.id}>
          <Link href={suggestionHref(s, 'discover')}>
            <small>{[langNameKo(s.language), s.level].filter(Boolean).join(' · ')}</small>
            <strong lang={encounterLookupLang(s.language) || undefined}>{s.title}</strong>
            <span>{s.channel_name}</span>
          </Link>
        </li>)}
      </ul>
    </div>}
    {publicCount > 0 && <div className="discover-shelf__row">
      <div className="discover-shelf__label">
        <h3>함께 읽는 글</h3>
        <small>공개 글 {publicCount.toLocaleString()}편</small>
        <Link className="manabi-link" href="/discover?view=reading">전체 보기</Link>
      </div>
    </div>}
  </section>;
}
