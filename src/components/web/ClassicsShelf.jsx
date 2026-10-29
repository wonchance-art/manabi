import Link from 'next/link';
import ClassicCover from '@/components/books/ClassicCover';
import {
  classicsCategoryLabel, classicsChips, classicsGroupLabel, classicsHref, classicsHtmlLang, classicsLanguageName, filterClassics,
} from '@/lib/classicsShelf';

// 산책 「고전 명작」 — 「책」 구간(DISCOVER-CLASSICS-001, 오너 「권장대로 ㄱㄱ」 2026-10-22 KST). 서버 화면 — 브라우저 스크립트 없음.
// 거르기는 칩 = 주소 링크(뒤로 가기 · 공유가 그대로 된다). 줄은 늘 둘까지: 언어 · 갈래(큰 갈래를 고르면 그 줄이 「‹ 문학 (소설) (시)」로 한 단계 들어간다).
// 책이 없는 칩은 만들지 않고, 고를 것이 하나뿐인 줄은 두지 않는다(누르면 늘 같은 결과인 칩은 고장으로 읽힌다 — 「받아둔 것만」 선례).
// 카드: 표지(칸 폭을 거의 채운다) · 태그(레벨 · 장 수) · 원제 · 한국어 제목 · 작가(누르면 다른 거르기를 풀고 그 작가 책만). 담기 단추 · 갈래 꼬리표는 두지 않는다(절제 — 한 번 열면 서재에 남는다).
// 읽은 자리(로그인 · classicsProgress): 표지 위 오른쪽 리본에 퍼센트, 다 읽으면 아래 오른쪽 ✓ — 태그 줄에 두지 않는다(오너 「읽음 상태는 거기에 있으면 어색」 → Kindle 서재 모방 창조, 2026-10-23 KST).
// 열기 = 그 책 첫 장(뷰어), 읽은 자리가 있으면 가장 최근에 손댄 장. 손님은 뷰어가 로그인으로 안내한다(BOOK-GUEST-GATE-1). 「←」는 이 화면으로(readerReturnTarget — /discover/classics).

export function Chip({ href, current, children, className = '' }) {
  return <Link href={href} className={`classics-chip ${className}`.trim()} aria-current={current ? 'true' : undefined} prefetch={false}>{children}</Link>;
}

// 다 읽음 표시 — 오른쪽 아래 둥근 ✓(종이색 테두리로 어느 표지 위에서도 읽힌다). 그림 카드도 같은 것을 쓴다.
export function ReadCheck({ label }) {
  return <span className="card-check" role="img" aria-label={label}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg></span>;
}

export default function ClassicsShelf({ items, filters, failed = false, resume = {} }) {
  if (failed) return <p className="classics-state" role="alert">고전 명작을 불러오지 못했어요. <Link className="manabi-link" href={classicsHref(filters)} prefetch={false}>다시 시도</Link></p>;
  if (!items.length) return <p className="classics-state">아직 공개한 고전 명작이 없어요.</p>;
  const chips = classicsChips(items, filters);
  const shown = filterClassics(items, filters);
  const returnTo = classicsHref(filters);
  return <>
    {chips.languages.length > 1 && <nav className="classics-chips" aria-label="언어">
      <Chip href={classicsHref(filters, { lang: '' })} current={!filters.lang}>전체</Chip>
      {chips.languages.map((language) => <Chip key={language} href={classicsHref(filters, { lang: language })} current={filters.lang === language}>{classicsLanguageName(language)}</Chip>)}
    </nav>}
    {filters.group
      ? <nav className="classics-chips" aria-label="갈래">
        <Chip href={classicsHref(filters, { group: '', cat: '' })} className="classics-chip--back" current={!filters.cat}><span aria-hidden="true">‹ </span>{classicsGroupLabel(filters.group)}</Chip>
        {chips.categories.map((cat) => <Chip key={cat} href={classicsHref(filters, { cat: filters.cat === cat ? '' : cat })} current={filters.cat === cat}>{classicsCategoryLabel(cat)}</Chip>)}
      </nav>
      : chips.groups.length > 1 && <nav className="classics-chips" aria-label="갈래">
        {chips.groups.map((group) => <Chip key={group} href={classicsHref(filters, { group, cat: '' })} current={false}>{classicsGroupLabel(group)}</Chip>)}
      </nav>}
    {filters.author && <p className="classics-author">
      <span>{filters.author} · {shown.length}권</span>
      <Link href={classicsHref(filters, { author: '' })} className="classics-author__clear" aria-label={`${filters.author} 거르기 해제`} prefetch={false}>✕</Link>
    </p>}
    {shown.length === 0
      ? <p className="classics-state">이 조건의 책이 없어요. <Link className="manabi-link" href="/discover/classics" prefetch={false}>전체 보기</Link></p>
      : <ul className="classics-grid">
        {shown.map((item) => {
          const lang = classicsHtmlLang(item.language);
          const going = resume[item.key];
          return <li key={item.key} className="classics-card">
            <Link className="classics-card__open" href={`/viewer/${going?.materialId ?? item.firstMaterialId}?returnTo=${encodeURIComponent(returnTo)}`} prefetch={false}>
              <span className="classics-card__coverwrap">
                <span className="classics-card__cover"><ClassicCover provider={item.provider} work={item.work} /></span>
                {going && (going.done
                  ? <ReadCheck label="다 읽음" />
                  : <span className="card-ribbon" role="img" aria-label={`${going.percent}% 읽음`}><span>{going.percent}<small>%</small></span></span>)}
              </span>
              <span className="classics-card__tags">
                {item.level && <span className="tag">{item.level}</span>}
                <span className="tag">{item.chapters}장</span>
              </span>
              <strong lang={lang}>{item.title}</strong>
              {item.titleKo && item.titleKo !== item.title && <span>{item.titleKo}</span>}
            </Link>
            <Link className="classics-card__author" href={classicsHref({ author: item.authorKo })} aria-current={filters.author === item.authorKo ? 'true' : undefined} prefetch={false}>{item.authorKo}</Link>
          </li>;
        })}
      </ul>}
  </>;
}
