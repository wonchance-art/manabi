'use client';
// 카드 기억률 줄 · 훑어보기 넘기기(단어 페이지). 판정은 lib/levelWordAreas(단어 영역 상태 · 기억률 — 단어장 상세 카드와 같은 계산).
// 예전 네 영역(단어 · 문장 · 뜻 · 소리)과 연습 탭 부품(안내 · 두 칸 · 연습 끝)은 카드 종류가 연습 탭을 흡수하면서 없앴다(CARD-TYPES-001 A안 ·
// 오너 2026-11-01 KST). 연습 답 기록(review_events source 'level')은 지우지 않고 역사로 남는다.
import { AREA_STATES, areaPercent, shownState } from '@/lib/levelWordAreas';
import { LEVEL_CARD_KIND_ITEMS } from '@/lib/levelCardKinds';

const KIND_LABEL = Object.fromEntries(LEVEL_CARD_KIND_ITEMS.map((it) => [it.id, it.label]));

/**
 * 카드 기억률 줄 — 켜진 카드 종류(단어 → 뜻 · 뜻 → 단어 · 듣기)마다 기억 확률 %(오너 선택 2026-10-21 KST 「기억 확률」을 카드 셋에 다시 짬 —
 * CARD-TYPES-001 §5). 색은 맞힘 · 놓침 · 처음, 흐려진 맞힘은 처음 색에 남은 %. 0%도 그대로 적는다. 단어 → 뜻 칸은 테두리(다른 카드가 붙는 기준).
 * areas = [{ kind, state, recall }](켜진 종류 순서) · next = 「2일 후 복습」.
 */
export function AreaRow({ areas, next = null }) {
  if (!areas?.length) return null;
  return <div className="lw-areas-wrap">
    <div className="lw-areas" role="list" aria-label="카드 기억 확률" style={{ '--n': areas.length }}>
      {areas.map((cell) => {
        const s = shownState(cell.state || 'new');
        const pct = areaPercent(cell);
        return <span key={cell.kind} role="listitem" className={`lw-area lw-area--${s}`} data-main={cell.kind === 'recognition' || undefined}
          aria-label={`${KIND_LABEL[cell.kind]} ${AREA_STATES[s].ko} ${pct}%`}>{KIND_LABEL[cell.kind]}<small aria-hidden="true">{pct}%</small></span>;
      })}
    </div>
    {next && <p className="lw-areas__next">{next}</p>}
  </div>;
}

/** 훑어보기 한 단어 — 채점 없이 앞뒤로 넘긴다. */
export function BrowseBar({ at, total, onPrev, onNext }) {
  return <div className="lw-gradebar"><div className="lw-gradebar__in">
    <div className="lw-browse" role="group" aria-label="넘기기">
      <button type="button" className="lw-btn" onClick={onPrev} disabled={at <= 0} aria-keyshortcuts="ArrowLeft">이전</button>
      <span className="lw-browse__at" aria-live="polite">{(at + 1).toLocaleString('en-US')} / {total.toLocaleString('en-US')}</span>
      <button type="button" className="lw-btn" onClick={onNext} disabled={at >= total - 1} aria-keyshortcuts="ArrowRight">다음</button>
    </div>
  </div></div>;
}
