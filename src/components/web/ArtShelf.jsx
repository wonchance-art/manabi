import Link from 'next/link';
import { Chip, ReadCheck } from '@/components/web/ClassicsShelf';
import { CLASSICS_LANGUAGES, classicsHref, classicsLanguageName } from '@/lib/classicsShelf';

// 산책 「고전 명작」 — 「그림」 구간(DISCOVER-ART-001, 목업 2026-10-23 KST 오너 「권장대로 ㄱㄱ」). 서버 화면 — 브라우저 스크립트 없음.
// 작품 한 점 = 카드 한 장: 정사각 그림 · 태그(읽는 언어 · 레벨) · 원어 제목 · 한국어 부제 · 작가(누르면 그 작가만). 다 읽은 그림은 오른쪽 아래 ✓(로그인 · classicsProgress).
// 한 줄 이야기는 카드에 싣지 않는다(오너 「너무 많은 정보 담으면 심플하지 않으니」 2026-10-23 KST — 카탈로그 hook은 그대로 둔다).
// 차례는 한국에서 익숙한 그림 먼저(shelf-order.json). 거르기는 언어 칩(둘 이상일 때만) · 작가 — 책 구간과 같은 주소 링크 문법.
// 열기 = 그 작품의 장(뷰어 — 정보 카드 · 찾아볼 것이 그림과 함께). 「←」는 이 구간으로(returnTo에 shelf=art).
// 카드 그림은 꾸밈(alt 빈 값) — 같은 링크 안 제목이 이름이고, 그림 설명(alt)은 뷰어 정보 카드가 싣는다.

const sameFilters = (item, { lang, author }) => (!lang || item.language === lang) && (!author || item.artist === author);

const NOTHING_READ = new Set();

export default function ArtShelf({ items, filters, failed = false, read = NOTHING_READ }) {
  if (failed) return <p className="classics-state" role="alert">그림을 불러오지 못했어요. <Link className="manabi-link" href={classicsHref(filters)} prefetch={false}>다시 시도</Link></p>;
  if (!items.length) return <p className="classics-state">아직 공개한 그림이 없어요.</p>;
  const languages = CLASSICS_LANGUAGES.filter((language) => items.some((item) => sameFilters(item, { ...filters, lang: language })));
  const shown = items.filter((item) => sameFilters(item, filters));
  const returnTo = classicsHref(filters);
  return <>
    {languages.length > 1 && <nav className="classics-chips" aria-label="언어">
      <Chip href={classicsHref(filters, { lang: '' })} current={!filters.lang}>전체</Chip>
      {languages.map((language) => <Chip key={language} href={classicsHref(filters, { lang: language })} current={filters.lang === language}>{classicsLanguageName(language)}</Chip>)}
    </nav>}
    {filters.author && <p className="classics-author">
      <span>{filters.author} · {shown.length}점</span>
      <Link href={classicsHref(filters, { author: '' })} className="classics-author__clear" aria-label={`${filters.author} 거르기 해제`} prefetch={false}>✕</Link>
    </p>}
    {shown.length === 0
      ? <p className="classics-state">이 조건의 그림이 없어요. <Link className="manabi-link" href={classicsHref({ shelf: 'art' })} prefetch={false}>전체 보기</Link></p>
      : <ul className="art-grid">
        {shown.map((item) => <li key={item.key} className="art-card">
          <Link className="art-card__open" href={`/viewer/${item.materialId}?returnTo=${encodeURIComponent(returnTo)}`} prefetch={false}>
            <span className="art-card__frame">
              {/* 저장소에 둔 그림(public/art) 그대로 — next/image 변환 없이. width · height는 비율만 알린다(CSS가 정사각으로 자른다). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.image && <img src={item.image.url} alt="" width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />}
              {read.has(item.key) && <ReadCheck label="읽음" />}
            </span>
            <span className="classics-card__tags">
              <span className="tag">{classicsLanguageName(item.language)}</span>
              {item.level && <span className="tag">{item.level}</span>}
            </span>
            {/* 책 카드와 같은 머리 — 원어 제목(읽는 언어의 lang) 위, 한국어 제목은 부제로 한 줄. */}
            <strong lang={item.titleLang}>{item.titleNative}</strong>
            {item.title && item.title !== item.titleNative && <span className="art-card__ko">{item.title}</span>}
          </Link>
          {item.artist && <Link className="classics-card__author" href={classicsHref({ shelf: 'art', author: item.artist })} aria-current={filters.author === item.artist ? 'true' : undefined} prefetch={false}>{item.artist}</Link>}
        </li>)}
      </ul>}
  </>;
}
