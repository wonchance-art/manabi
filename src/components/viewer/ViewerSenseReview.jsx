'use client';
// 「뜻 확인 필요」 목록 — 시트 [문장] 탭 자리에서 그 자리 고치기(뷰어 v2 AD-R4 PR③, 설계서 docs/manabi-viewer-v2-ad-r4.md §6.2·§6.4).
// 줄마다: 문장(그 단어 칠) · 지금 뜻 · 사전 뜻 후보(○/◉) · [이대로 둘게요].
// - 후보를 누르면 바로 교정한다. 쓰기는 호출 쪽 onChoose/onKeep → 기존 correctTokenMutation(AE-R1 PR③ 사전 뜻 교정 경로) 하나.
//   단어장·FSRS·공유 사전 쓰기는 없다.
// - 후보는 누름 버튼(aria-pressed)이다 — 네이티브 라디오는 화살표 키만으로 선택이 바뀌어 누를 때마다 저장되기 때문이다.
// - 고친 줄은 목록을 연 동안 그 자리에 남는다(포커스를 잃지 않게). 머리 개수와 본문 위 줄의 N은 남은 표식 수로 줄어든다.
// - 「AI」 표시는 없다(오너 결정). 후보 밖 문맥 뜻(meaningCheck 'ctx')도 표 없이 「지금:」에 그대로 보인다.
// - AD-R4 PR④ 경계 후보 줄: 「运动员的【身体 素质】非常好。 / 한 단어로 묶을까요? [묶기] [아니요]」(설계서 §6.2·§6.4).
//   [묶기]는 그 자리에서 AD-R3 확인 줄(호출 쪽이 그린 BoundaryMergeConfirm — boundaryEditFlow로 확정)을 연다. 이 파일은 쓰지 않는다.
//   [아니요]는 호출 쪽 onDismiss → 같은 원자 RPC로 그 꼴을 접는다. 처리한 줄은 목록을 연 동안 「묶었어요」/「확인했어요」로 남는다.
import { useEffect, useRef } from 'react';

const MARK = (on) => (on ? '◉' : '○');

/**
 * @param {object} p
 * @param {Array<{id:string, token:object, sentence:{before:string,term:string,after:string}|null,
 *   options:Array<{meaning:string,current:boolean}>|null, resolved:boolean}>} p.rows  options null = 사전 행을 받는 중
 * @param {number} p.remaining 남은 「뜻 확인 필요」 수
 * @param {boolean} p.busy 교정 저장 중(모든 누름 잠금 — 저장마다 최신 자료로 쓰게)
 * @param {(row:object, meaning:string)=>void} p.onChoose
 * @param {(row:object)=>void} p.onKeep
 * @param {string} [p.contentLang] 원문 lang 태그
 * @param {(text:string, values?:object)=>string} p.vt
 */
export default function ViewerSenseReview({ rows, remaining, busy, onChoose, onKeep, onJoin, onDismiss, boundaryBusy = false, contentLang, vt }) {
  const headingRef = useRef(null);
  // 목록을 열면 머리로 포커스. 시트가 막 열리는 중이면 내용이 숨겨져 있어(hidden) 보일 때까지 몇 프레임 기다린다.
  // 시트도 탭을 열 때 data-sheet-focus 요소에 포커스를 주므로 둘은 같은 곳을 가리킨다.
  useEffect(() => {
    let frame = 0, tries = 0;
    const tick = () => {
      const el = headingRef.current;
      if (el && el.getClientRects().length) { el.focus({ preventScroll: true }); return; }
      if (++tries < 20) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <section className="viewer-sense-review" aria-labelledby="viewer-sense-review-title">
      <h2 id="viewer-sense-review-title" ref={headingRef} tabIndex={-1} data-sheet-focus className="viewer-sense-review__title">
        {vt('뜻 확인 필요 · {count}개', { count: remaining })}
      </h2>
      <ol className="viewer-sense-review__list">
        {rows.map((row) => {
          if (row.kind === 'boundary') return <BoundarySuggestionRow key={row.id} row={row} busy={boundaryBusy} onJoin={onJoin} onDismiss={onDismiss} contentLang={contentLang} vt={vt} />;
          const { token, sentence, options, resolved } = row;
          return (
            <li key={row.id} className="viewer-sense-review__row" data-token-id={row.id}>
              <p className="viewer-sense-review__sentence" lang={contentLang}>
                {sentence ? <>{sentence.before}<mark>{sentence.term}</mark>{sentence.after}</> : <mark>{token.text}</mark>}
              </p>
              <p className="viewer-sense-review__now">{vt('지금: {meaning}', { meaning: token.meaning || vt('(뜻 없음)') })}</p>
              {options === null ? <p className="viewer-sense-review__loading" role="status">{vt('불러오는 중…')}</p>
                : options.length > 0 && (
                  <div className="viewer-sense-review__options" role="group" aria-label={vt('사전 뜻 · {count}개', { count: options.length })}>
                    {options.map((option) => (
                      <button key={option.meaning} type="button" className="viewer-sense-review__option" aria-pressed={option.current}
                        data-meaning={option.meaning} disabled={busy || option.current} onClick={() => onChoose(row, option.meaning)}>
                        <span aria-hidden="true" className="viewer-sense-review__mark">{MARK(option.current)}</span>
                        <span>{option.meaning}</span>
                      </button>
                    ))}
                  </div>
                )}
              {resolved
                ? <p className="viewer-sense-review__done" role="status">{vt('확인했어요')}</p>
                : <button type="button" className="btn btn--ghost btn--sm viewer-sense-review__keep" disabled={busy || !String(token.meaning || '').trim()} onClick={() => onKeep(row)}>{vt('이대로 둘게요')}</button>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * 경계 후보 한 줄. row = {id, parts:[앞, 뒤], form, sentence:{before,after}|null, active(아직 후보), dismissed([아니요]로 접음),
 * joinable([묶기]를 열 수 있음 — 소유자·분석 끝 등 AD-R3 진입점 조건), confirm(그 자리 확인 줄 노드 | null)}.
 */
function BoundarySuggestionRow({ row, busy, onJoin, onDismiss, contentLang, vt }) {
  const term = <mark>{row.parts[0]} {row.parts[1]}</mark>;
  return (
    <li className="viewer-sense-review__row viewer-sense-review__row--boundary" data-boundary-suggest={row.form}>
      <p className="viewer-sense-review__sentence" lang={contentLang}>
        {row.sentence ? <>{row.sentence.before}{term}{row.sentence.after}</> : term}
      </p>
      {!row.active
        ? <p className="viewer-sense-review__done" role="status">{vt(row.dismissed ? '확인했어요' : '묶었어요')}</p>
        : row.confirm || (
          <div className="viewer-sense-review__join">
            <p className="viewer-sense-review__ask">{vt('한 단어로 묶을까요?')}</p>
            <div className="viewer-sense-review__join-actions">
              <button type="button" className="btn btn--ghost btn--sm viewer-sense-review__join-yes" disabled={busy || !row.joinable} onClick={() => onJoin(row)}>{vt('묶기')}</button>
              <button type="button" className="btn btn--ghost btn--sm viewer-sense-review__join-no" disabled={busy} onClick={() => onDismiss(row)}>{vt('아니요')}</button>
            </div>
          </div>
        )}
    </li>
  );
}
