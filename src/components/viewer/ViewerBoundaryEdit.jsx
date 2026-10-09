'use client';
// 뷰어 v2 AD-R3 PR③ — 「이 자료」 단어 경계 편집 화면 조각(설계서 docs/manabi-viewer-v2-ad-r3.md §6.3 목업).
// · BoundaryMergeRow: [문장] 탭 원문 줄 아래 [⊕ 한 단어로 묶기] — 조건이 안 맞으면 숨기지 않고 꺼진 채 이유 한 줄(§6.1).
// · BoundaryMergeConfirm: 같은 자리 확인 줄 「身体 + 素质 → 身体素质 / ◉ 이 자료만 / 단어장의 身体은(는) 그대로 있어요. / [묶기] [취소]」.
//   범위는 ① 이 자료만(②③은 PR④). ⋯ 「옆 단어와 묶기」는 같은 확인 줄 위에 [앞 단어와][뒤 단어와] 고르기를 둔다.
// · BoundarySplitPanel: 「어디서 나눌까요?」 글자 사이마다 44px 칼선 칸(누르면 진하게, 여러 개) · 미리 보기 · [나누기](칼선 0이면 꺼짐) [취소].
// · BoundaryPendingList: 재분석에서 적용하지 못한 기록 목록(알림 [보기] → [문장] 탭 자리, 보기 전용).
// 쓰기는 호출 쪽(ViewerPage → boundaryEditFlow)이 한다. 이 파일은 표시와 고르기만 한다. 「AI」 표시 없음.
import { useEffect, useRef, useState } from 'react';

export function BoundaryReason({ reason, vt }) {
  if (!reason) return null;
  const [key, values] = reason;
  return <p className="viewer-boundary__reason" role="status">{vt(key, values)}</p>;
}

export function BoundaryMergeRow({ plan, reasonText, onStart, vt }) {
  return (
    <div className="viewer-boundary-merge">
      <button type="button" className="btn btn--ghost btn--sm viewer-boundary-merge__start" disabled={!plan?.ok} onClick={onStart}>
        <span aria-hidden="true" className="viewer-boundary-merge__icon">⊕</span>{vt('한 단어로 묶기')}
      </button>
      {!plan?.ok && <BoundaryReason reason={reasonText} vt={vt} />}
    </div>
  );
}

/**
 * @param {object} p
 * @param {{ok:boolean, parts?:string[], result?:string}|null} p.plan 고른 안(이웃 고르기면 지금 고른 쪽)
 * @param {Array<[string, object?]>|null} p.reasonText plan이 안 될 때 이유 문구
 * @param {{value:'prev'|'next', onChange:(v)=>void, prev:boolean, next:boolean}|null} [p.choice] ⋯ 「옆 단어와 묶기」
 * @param {string[]} p.savedWords 단어장에 있는 구성 단어(있을 때만 안내 줄)
 */
export function BoundaryMergeConfirm({ plan, reasonText, choice = null, savedWords = [], busy, onConfirm, onCancel, contentLang, vt, autoFocus = true }) {
  const rootRef = useRef(null);
  useEffect(() => {
    if (!autoFocus) return undefined;
    const frame = requestAnimationFrame(() => rootRef.current?.querySelector('button:not(:disabled), input')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);
  return (
    <div ref={rootRef} className="viewer-boundary-confirm" role="group" aria-label={vt('한 단어로 묶기')}>
      {choice && (
        <div className="viewer-boundary-confirm__choice">
          {['prev', 'next'].map((side) => (
            <button key={side} type="button" className="btn btn--ghost btn--sm" aria-pressed={choice.value === side}
              disabled={busy || !choice[side]} onClick={() => choice.onChange(side)}>
              {vt(side === 'prev' ? '앞 단어와' : '뒤 단어와')}
            </button>
          ))}
        </div>
      )}
      {plan?.ok ? (
        <>
          <p className="viewer-boundary-confirm__preview" lang={contentLang}>
            {plan.parts.map((part, k) => <span key={k}>{k > 0 && <span aria-hidden="true" className="viewer-boundary-confirm__op"> + </span>}{part}</span>)}
            <span aria-hidden="true" className="viewer-boundary-confirm__op"> → </span><b>{plan.result}</b>
          </p>
          <fieldset className="viewer-boundary-confirm__scope">
            <legend className="sr-only">{vt('적용 범위')}</legend>
            <label><input type="radio" name="viewer-boundary-scope" checked readOnly />{vt('이 자료만')}</label>
          </fieldset>
          {savedWords.length > 0 && <p className="viewer-boundary-confirm__note">{vt('단어장의 {word}은(는) 그대로 있어요.', { word: savedWords.join('·') })}</p>}
        </>
      ) : <BoundaryReason reason={reasonText} vt={vt} />}
      <div className="viewer-boundary-confirm__actions">
        <button type="button" className="btn btn--primary btn--sm" disabled={busy || !plan?.ok} onClick={onConfirm}>{busy ? vt('묶는 중…') : vt('묶기')}</button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={onCancel}>{vt('취소')}</button>
      </div>
    </div>
  );
}

/** plan = boundaryEditFlow.planBoundarySplit 결과(ok일 때만 그린다 — 아니면 이유 한 줄). preview(cuts) → 조각 목록. */
export function BoundarySplitPanel({ plan, reasonText, preview, busy, onConfirm, onCancel, contentLang, vt }) {
  const [chosen, setChosen] = useState([]);
  const headRef = useRef(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => headRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const toggle = (cut) => setChosen((list) => (list.includes(cut) ? list.filter((c) => c !== cut) : [...list, cut].sort((a, b) => a - b)));
  return (
    <section className="viewer-boundary-split" aria-labelledby="viewer-boundary-split-title">
      <h3 id="viewer-boundary-split-title" ref={headRef} tabIndex={-1} className="viewer-boundary-split__title">{vt('어디서 나눌까요?')}</h3>
      {plan?.ok ? (
        <>
          <div className="viewer-boundary-split__chars" lang={contentLang}>
            {plan.chars.map((ch, k) => (
              <span key={k} className="viewer-boundary-split__unit">
                {k > 0 && (
                  <button type="button" className="viewer-boundary-split__cut" aria-pressed={chosen.includes(plan.cuts[k - 1])} disabled={busy}
                    aria-label={vt('{left}와(과) {right} 사이에서 나누기', { left: plan.chars[k - 1], right: ch })}
                    onClick={() => toggle(plan.cuts[k - 1])}><span aria-hidden="true" className="viewer-boundary-split__line" /></button>
                )}
                <span className="viewer-boundary-split__char">{ch}</span>
              </span>
            ))}
          </div>
          <p className="viewer-boundary-split__preview" lang={contentLang} aria-live="polite">
            {preview(chosen).map((piece, k) => <span key={k}>{k > 0 && <span aria-hidden="true" className="viewer-boundary-confirm__op"> │ </span>}{piece}</span>)}
          </p>
        </>
      ) : <BoundaryReason reason={reasonText} vt={vt} />}
      <div className="viewer-boundary-confirm__actions">
        <button type="button" className="btn btn--primary btn--sm" disabled={busy || !plan?.ok || chosen.length === 0} onClick={() => onConfirm(chosen)}>{busy ? vt('나누는 중…') : vt('나누기')}</button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={onCancel}>{vt('취소')}</button>
      </div>
    </section>
  );
}

export function BoundaryPendingList({ rows, contentLang, vt }) {
  const headingRef = useRef(null);
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
    <section className="viewer-boundary-pending" aria-labelledby="viewer-boundary-pending-title">
      <h2 id="viewer-boundary-pending-title" ref={headingRef} tabIndex={-1} data-sheet-focus className="viewer-boundary-pending__title">
        {vt('적용하지 못한 단어 경계 · {count}개', { count: rows.length })}
      </h2>
      <ol className="viewer-boundary-pending__list">
        {rows.map((row) => (
          <li key={row.id} className="viewer-boundary-pending__row">
            <p className="viewer-boundary-pending__word"><b lang={contentLang}>{row.display}</b>{' · '}{vt(row.merged ? '한 단어로 묶음' : '나눔')}</p>
            <p className="viewer-boundary-pending__sentence" lang={row.sentence ? contentLang : undefined}>{row.sentence || vt('원문에서 그 줄을 찾지 못했어요')}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
