import Link from 'next/link';
import { ZhSlot } from '@/components/fonts/ScFontLink';
import ClassicCover from '@/components/books/ClassicCover';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import { canReadSuggestion, TODAY_NEWS_ID } from '@/lib/suggestionReading';

// 산책 큰 칸 셋(DISCOVER-CLASSICS-001, 오너 「산책 세션에 배움의 정사각형 큰 사이즈 세 개를 가로로 · 모바일은 세로로」 → 「권장대로 ㄱㄱ」 2026-10-22 KST).
// 배움 이어 읽기 칸(ResumeTile)과 같은 몸 — 색 머리(칸 이름 · 큰 글자) · 본문 · 아래 단추. 색은 기존 토큰만(오늘 화제 --fr · 고전 명작 --ja · 매거진 --zh).
// 아직 열 것이 없는 칸(첫 책 · 첫 호 전)은 누를 수 없는 칸으로 둔다 — 단추 없이 「준비 중」(누르면 빈 화면인 링크를 만들지 않는다).
// 매거진 칸의 행선지는 매거진 세션이 첫 호를 낼 때 MAGAZINE_HREF에 건다(보드 DISCOVER-CLASSICS-001).
export const MAGAZINE_HREF = null;

/** 「10월 22일」 — KST 날짜 문자열(YYYY-MM-DD)에서. */
export const shelfDateLabel = (date) => {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}월 ${day}일` : '';
};
export const CLASSICS_TILE_COVERS = 3;

/** 표지 셋 — 날마다 한 칸씩 밀린다(KST 날짜 기준, 같은 날은 같은 셋). */
export function dailyCovers(items, date, count = CLASSICS_TILE_COVERS) {
  if (!items.length) return [];
  const day = Math.floor(Date.parse(`${date || '1970-01-01'}T00:00:00Z`) / 86400000) || 0;
  const start = ((day % items.length) + items.length) % items.length;
  return Array.from({ length: Math.min(count, items.length) }, (_, i) => items[(start + i) % items.length]);
}

function Tile({ href, tone, kicker, big, children, bottom }) {
  const body = <>
    <span className="discover-tile__head"><span className="discover-tile__kicker">{kicker}</span>{big && <span className="discover-tile__big">{big}</span>}</span>
    <span className="discover-tile__body">{children}</span>
    {bottom && <span className="discover-tile__bottom">{bottom}</span>}
  </>;
  const className = `discover-tile discover-tile--${tone}`;
  return href ? <Link className={className} href={href} prefetch={false}>{body}</Link> : <div className={className}>{body}</div>;
}

const Pill = ({ children }) => <span className="discover-tile__pill">{children}<i aria-hidden="true">→</i></span>;

export default function DiscoverTiles({ suggestions = [], classics = [], art = [], date }) {
  const news = suggestions.filter(canReadSuggestion);
  const headline = news[0];
  const headlineLang = headline ? encounterLookupLang(headline.language) || undefined : undefined;
  // 고전 명작 칸 = 책 + 그림(DISCOVER-ART-001). 큰 글자는 「N권 · M점」(있는 것만), 그림은 책이 아직 없을 때만 표지 자리에.
  const covers = dailyCovers(classics, date);
  const paintings = covers.length ? [] : dailyCovers(art, date);
  const classicsCount = [classics.length && `${classics.length}권`, art.length && `${art.length}점`].filter(Boolean).join(' · ');
  return <section className="discover-tiles" aria-label="산책">
    {/* 소식 수는 달지 않는다 — 열린 목록은 로그인하면 학습 언어 · 레벨로 걸러져 개수가 달라진다(서가 리뷰 2026-10-17 KST 선례). */}
    <Tile href={news.length ? `/discover?view=reading#${TODAY_NEWS_ID}` : null} tone="news" kicker="오늘 화제" big={shelfDateLabel(date)}
      bottom={news.length ? <><span className="discover-tile__spacer" /><Pill>읽기</Pill></> : null}>
      {headline
        ? <><ZhSlot lang={headlineLang}><strong className="discover-tile__title" lang={headlineLang}>{headline.title}</strong></ZhSlot><span className="discover-tile__sub">{headline.channel_name}</span></>
        : <strong className="discover-tile__title">오늘 소식 준비 중</strong>}
    </Tile>
    <Tile href={classicsCount ? '/discover/classics' : null} tone="classics" kicker="고전 명작" big={classicsCount || null}
      bottom={classicsCount ? <><span className="discover-tile__spacer" /><Pill>둘러보기</Pill></> : null}>
      {covers.length
        ? <span className="discover-tile__covers" aria-hidden="true">{covers.map((item) => <span key={item.key} className="discover-tile__cover"><ClassicCover provider={item.provider} work={item.work} /></span>)}</span>
        : paintings.length
          // eslint-disable-next-line @next/next/no-img-element
          ? <span className="discover-tile__covers" aria-hidden="true">{paintings.map((item) => <span key={item.key} className="discover-tile__cover discover-tile__cover--art">{item.image && <img src={item.image.url} alt="" loading="lazy" decoding="async" />}</span>)}</span>
          : <strong className="discover-tile__title">첫 책 준비 중</strong>}
    </Tile>
    <Tile href={MAGAZINE_HREF} tone="magazine" kicker="여행 매거진">
      <strong className="discover-tile__title">첫 호 준비 중</strong>
    </Tile>
  </section>;
}
