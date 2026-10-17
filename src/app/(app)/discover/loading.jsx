import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';

/**
 * 발견(산책) 대기 화면(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST). 탭을 누르면 서버가 서가 · 소식을 모으는 동안
 * 「화면 불러오는 중…」 스피너가 0.25~0.4초 보이던 자리다. 실제 화면(page.jsx · DiscoverShelf)의 **같은 클래스**로
 * 골격을 그린다 — 늘 같은 글(제목 「발견」 · 「서가」 · 칸 이름 · 번호)은 글자 그대로, 바뀌는 글만 회색 줄.
 * 자리표 링크는 href 없는 <a>(초점 · 이동 없음)라 실제 칸 스타일(`.discover-shelf__items a` · `.discover-cultures>a`)을 그대로 받는다.
 * 「함께 읽는 글」 줄은 그리지 않는다 — 실제 화면은 공개 글이 1편 이상일 때만 그 줄을 둔다(DiscoverShelf publicCount > 0).
 * 늘 그리면 공개 글이 없을 때(비로그인 실측) 아래 칸이 ~110px 위로 튀었다. 공개 글이 있으면 그 줄이 늦게 들어오며 아래를 민다 —
 * 데이터에 달린 일이라 받아들이고, 계정 · 데이터를 아는 골격(B1 후속)에서 다룬다(/ux-review 2026-10-17 KST).
 */
export default function Loading() {
  return (
    <SkeletonRegion className="manabi-page manabi-discover" label="발견 화면" announce>
      {/* 제목은 실제 화면이 들어오며 다시 그린다 — 대기 중엔 화면 읽기에 숨겨 「발견」이 두 번 읽히지 않게(배움 · 서재 대기와 같다). */}
      <header className="manabi-page-heading" aria-hidden="true"><h1>발견</h1></header>
      <section className="discover-shelf" aria-hidden="true">
        <div className="manabi-section-heading"><div className="discover-shelf__label"><h2>서가</h2><small>누구나 읽는 책장</small></div></div>
        <div className="discover-shelf__row">
          <div className="discover-shelf__label">
            <h3>오늘의 소식</h3>
            <small><SkeletonLine width="4.5em" /></small>
            <span className="manabi-link">전체 보기</span>
          </div>
          <ul className="discover-shelf__items">
            {[0, 1, 2, 3].map(i => <li key={i}><a>
              <small><SkeletonLine width="5em" /></small>
              <strong><SkeletonLine width="90%" /><br /><SkeletonLine width="55%" /></strong>
              <span><SkeletonLine width="6em" /></span>
            </a></li>)}
          </ul>
        </div>
      </section>
      <section aria-hidden="true">
        <div className="manabi-section-heading"><h2>일본어 N5 · 문화 읽기</h2><span className="manabi-link">전체 보기</span></div>
        <div className="discover-cultures">
          {[1, 2, 3].map(n => <a key={n}>
            <span>0{n}</span>
            <h3><SkeletonLine width="80%" /></h3>
            <p><SkeletonLine width="90%" /></p>
          </a>)}
        </div>
      </section>
    </SkeletonRegion>
  );
}
