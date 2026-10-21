'use client';
// 네 영역 체크 화면 조각(오너 승인 2026-10-21 KST · 시안 「단어 네 영역 체크」) — 판정은 lib/levelWordAreas.
// 영역 줄(펼친 카드 맨 아래 · 찾기 카드) · 연습 탭 두 칸(다시 볼래요 · 알아요) · 연습 안내 · 연습 끝 화면 · 전체 탭 넘기기.
import { AREA_LABEL, AREA_STATES, LEVEL_AREAS, areaPercent, shownState } from '@/lib/levelWordAreas';
import { CountUp } from './WordParts';

/**
 * 영역 줄 — 단어 · 문장 · 뜻 · 소리, 칸마다 기억 확률 %(오너 선택 2026-10-21 KST 「영역별 기억 확률」). 색은 맞힘 · 놓침 · 처음,
 * 흐려진 맞힘은 처음 색에 남은 %. 0%도 그대로 적는다. 단어 칸은 테두리로 「일정에 반영되는 칸」. next = 「2일 뒤 복습」.
 */
export function AreaRow({ areas, next = null }) {
  if (!areas) return null;
  return <div className="lw-areas-wrap">
    <div className="lw-areas" role="list" aria-label="네 영역 기억 확률">
      {LEVEL_AREAS.map((area) => {
        const s = shownState(areas[area]?.state || 'new');
        const pct = areaPercent(areas[area]);
        return <span key={area} role="listitem" className={`lw-area lw-area--${s}`} data-main={area === 'word' || undefined}
          aria-label={`${AREA_LABEL[area]} ${AREA_STATES[s].ko} ${pct}%`}>{AREA_LABEL[area]}<small aria-hidden="true">{pct}%</small></span>;
      })}
    </div>
    {next && <p className="lw-areas__next">{next}</p>}
  </div>;
}

/** 연습 탭 안내 — 일정에 반영되지 않는다는 한 줄 + 순서 칩(놓침 · 처음 · 맞힘). */
export function PracticeIntro({ counts }) {
  return <div className="lw-practice">
    <p className="lw-practice__note">연습이에요 · 복습 일정에는 반영되지 않아요</p>
    {counts && <p className="lw-practice__order" aria-label="연습 순서">
      <span>놓침 {counts.miss}</span><span>처음 {counts.new}</span><span>맞힘 {counts.hit}</span></p>}
  </div>;
}

/** 연습 두 칸 — 화면 아래 고정(네 칸 자리). 키 1 = 다시 볼래요 · 2 = 알아요. label = 리스트에서 지금 답할 카드 안내. */
export function PracticeBar({ onAnswer, disabled = false, label = null }) {
  return <div className="lw-gradebar"><div className="lw-gradebar__in">
    <p className="lw-gradebar__guide" aria-hidden={!label || undefined}>{label}</p>
    <div className="lw-two" role="group" aria-label="떠올랐나요">
      <button type="button" className="lw-two__btn lw-two__btn--again" aria-keyshortcuts="1" disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onAnswer(false); }}>다시 볼래요</button>
      <button type="button" className="lw-two__btn lw-two__btn--know" aria-keyshortcuts="2" disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onAnswer(true); }}>알아요</button>
    </div>
  </div></div>;
}

/** 전체 탭(훑기) 한 단어 — 채점 없이 앞뒤로 넘긴다. */
export function BrowseBar({ at, total, onPrev, onNext }) {
  return <div className="lw-gradebar"><div className="lw-gradebar__in">
    <div className="lw-browse" role="group" aria-label="넘기기">
      <button type="button" className="lw-btn" onClick={onPrev} disabled={at <= 0} aria-keyshortcuts="ArrowLeft">이전</button>
      <span className="lw-browse__at" aria-live="polite">{(at + 1).toLocaleString('en-US')} / {total.toLocaleString('en-US')}</span>
      <button type="button" className="lw-btn" onClick={onNext} disabled={at >= total - 1} aria-keyshortcuts="ArrowRight">다음</button>
    </div>
  </div></div>;
}

/** 연습 끝 화면 — 단어 탭 끝 화면과 같은 꼴: 큰 칸(학습) + 두 칸(알아요 · 다시 볼래요) + 「놓친 N개 한 번 더」 · 「다음 N개」 · 「단어 탭으로」. */
export function PracticeDone({ area, hits, misses, onAgain, moreCount = 0, onMore, onWordTab }) {
  return <section className="lw-done" aria-labelledby="lw-done-title">
    <h2 id="lw-done-title" tabIndex={-1}>{AREA_LABEL[area]} 연습 끝</h2>
    <div className="lw-done__big lw-done__big--one"><span className="lw-done__n"><b><CountUp n={hits + misses} /></b><small>학습</small></span></div>
    <div className="lw-done__counts lw-done__counts--two" aria-label="답한 수">
      <span className="lw-done__n lw-done__n--know"><b><CountUp n={hits} /></b><small>알아요</small></span>
      <span className="lw-done__n lw-done__n--again"><b><CountUp n={misses} /></b><small>다시 볼래요</small></span>
    </div>
    <div className="lw-done__actions">
      {misses > 0 && <button type="button" className="lw-btn lw-btn--primary lw-btn--wide" onClick={onAgain}>놓친 {misses}개 한 번 더
        <small>오늘 두 번째부터는 진행률에 들어가지 않아요</small></button>}
      <div className="lw-done__row">
        {moreCount > 0 && <button type="button" className={`lw-btn${misses > 0 ? '' : ' lw-btn--primary'}`} onClick={onMore}>다음 {moreCount}개</button>}
        <button type="button" className="lw-btn" onClick={onWordTab}>단어 탭으로</button>
      </div>
    </div>
  </section>;
}
