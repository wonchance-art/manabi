'use client';
// 쪽 넘김 보기의 조작(READER-PAGED-001 설계 §2, 목업 A·B·D). 본문 탭은 언제나 단어창이라 쪽 넘김은 여기·밀기·키보드로만 한다.
// · 아래 쪽 막대: ‹ 「12 / 48쪽 · 25%」 › — 버튼 44px.
// · 여백 띠(PC): 본문 단 바깥 왼쪽·오른쪽(44px 이상). 쪽 막대가 키보드·낭독기 몫을 하므로 띠는 포인터 전용(탭 순서·접근 트리 밖).
import ActionIcon from '../ActionIcon';
import { pageLabel } from '../../lib/usePagedReader';
import './paged-reader.css';

const label = (tr, pager) => tr ? tr('{page} / {count}쪽 · {percent}%', { page: pager.page + 1, count: pager.count, percent: pager.progress }) : pageLabel(pager.page, pager.count);

// extra — 쪽 표시 옆에 잠깐 둘 조작(듣기 따라가기 [지금 문장으로] 등). 막대 높이(52px) 안이라 본문이 다시 흐르지 않는다.
export default function PageBar({ pager, barRef, tr, className = '', extra = null }) {
  const name = text => (tr ? tr(text) : text);
  return (
    <nav ref={barRef} className={`reader-pagebar ${className}`} aria-label={name('쪽 이동')} data-ready={pager.ready || undefined}>
      <button type="button" className="reader-pagebar__btn" aria-label={name('이전 쪽')} title={name('이전 쪽')} aria-keyshortcuts="ArrowLeft PageUp"
        disabled={!pager.ready || pager.page <= 0} onClick={() => pager.prev()} data-icon-action><ActionIcon name="previous" /></button>
      <span className="reader-pagebar__pos" role="status" aria-live="polite">{pager.ready ? label(tr, pager) : ''}</span>
      {extra}
      <button type="button" className="reader-pagebar__btn" aria-label={name('다음 쪽')} title={name('다음 쪽')} aria-keyshortcuts="ArrowRight PageDown"
        disabled={!pager.ready || pager.page >= pager.count - 1} onClick={() => pager.next()} data-icon-action><ActionIcon name="next" /></button>
    </nav>
  );
}

export function PageStrips({ pager, tr }) {
  const name = text => (tr ? tr(text) : text);
  return (
    <>
      <button type="button" className="reader-page-strip reader-page-strip--prev" aria-hidden="true" tabIndex={-1} title={name('이전 쪽')}
        disabled={!pager.ready || pager.page <= 0} onClick={() => pager.prev()}><span>‹</span></button>
      <button type="button" className="reader-page-strip reader-page-strip--next" aria-hidden="true" tabIndex={-1} title={name('다음 쪽')}
        disabled={!pager.ready || pager.page >= pager.count - 1} onClick={() => pager.next()}><span>›</span></button>
    </>
  );
}
