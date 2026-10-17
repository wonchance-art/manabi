import Link from 'next/link';
import { langNameKo } from '@/lib/constants';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import { canReadSuggestion, suggestionHref, TODAY_NEWS_ID } from '@/lib/suggestionReading';

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
    {/* 부제는 제목 아래(B2 A안 — 오너 「권장대로」 2026-10-17 KST). 오른쪽 끝은 「전체 보기」 같은 링크 자리라 회색 글이 링크로 읽혔다.
        쌓는 모양은 줄 머리(.discover-shelf__label h3 + small)와 같은 클래스 — 새 스타일 없음. */}
    <div className="manabi-section-heading">
      <div className="discover-shelf__label">
        <h2 id="discover-shelf-title">서가</h2>
        <small>누구나 읽는 책장</small>
      </div>
    </div>
    {news.length > 0 && <div className="discover-shelf__row">
      <div className="discover-shelf__label">
        <h3>오늘의 소식</h3>
        <small>{shelfDateLabel(date)}</small>
        {/* 숫자는 달지 않는다 — 열린 목록은 로그인하면 학습 언어 · 레벨로 걸러져 개수가 달라진다(리뷰 2026-10-17 KST). */}
        {/* 소식 전체는 「함께 읽는 글」 화면 아래 「오늘의 소식」 칸 — 그 칸으로 내려가 제목에 초점(TODAY_NEWS_ID, MaterialsPage). */}
        <Link className="manabi-link" href={`/discover?view=reading#${TODAY_NEWS_ID}`}>전체 보기</Link>
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
