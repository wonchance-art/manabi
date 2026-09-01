'use client';

/**
 * 묶음 카드(v2-P) — 자료 여럿을 카드 하나로 접고, 펼치면 줄 목록을 보여준다.
 *
 * 책 묶음과 PDF 묶음이 **같은 컴포넌트**를 쓴다(설계 계약 ③ 이중 구현 금지). 원래는
 * 자료실 렌더 안에 50줄짜리 인라인 JSX였고, PDF를 흡수하려면 그걸 복제하는 수밖에
 * 없었다 — 「같은 컴포넌트로」라는 계약이 성립하려면 **먼저 컴포넌트가 있어야 했다.**
 *
 * 두 묶음의 차이는 전부 데이터다: 책은 `1 · 챕터 제목 · 완료`, PDF는 `p.13–24 · 제목 ·
 * 복습 4개`. 그래서 줄의 좌/우 슬롯을 노드로 받는다 — 분기는 호출부에 남기고 이 안에는
 * 두지 않는다(분기가 들어오는 순간 다시 두 벌이 된다).
 */
export default function MaterialGroupCard({ icon, title, meta, fitLine, rows, footer }) {
  return (
    <details className="card book-card group-card">
      <summary className="group-card__summary">
        <span className="group-card__title">{icon} {title}</span>
        <span className="group-card__meta">{meta}</span>
        {fitLine && <span className="group-card__fit">{fitLine}</span>}
      </summary>
      <div className="group-card__rows">
        {rows.map((r) => (
          <div
            key={r.key}
            className="group-card__row"
            role="button"
            tabIndex={0}
            onClick={r.onClick}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), r.onClick?.())}
          >
            <span className="group-card__lead">{r.lead}</span>
            <span className="group-card__rowtitle">{r.title}</span>
            {r.right}
          </div>
        ))}
      </div>
      {footer && <div className="group-card__footer">{footer}</div>}
    </details>
  );
}
