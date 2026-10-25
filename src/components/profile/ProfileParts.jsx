'use client';
/**
 * 내 정보(시안 A) 부품 — 묶음 카드 · 「라벨 — 지금 값 ›」 줄 · 편집 시트 (PROFILE-REDESIGN-001, 오너 승인 2026-10-25 KST).
 *
 *   학습
 *   ┌ 학습 언어      일본어 N3 [기본] · 중국어 H3 › ┐
 *   │ 목표                     JLPT N3 · D-42 › │
 *   └ 알림                          매일 21시 › ┘
 *
 * 줄은 링크(다른 화면) · 단추(시트 · 바로 실행) · 글(값만) 셋 중 하나다. 시트는 휴대폰에서 아래 시트, 넓은 화면에서 가운데 창이다
 * (profile.css의 @container — 뷰포트 쿼리 신설 0). 키보드 하한은 useDialogReturn(열면 창 안 · Esc · 닫으면 누른 줄로).
 */
import { useId } from 'react';
import Link from 'next/link';
import ActionIcon from '../ActionIcon';
import { useDialogReturn } from '../../lib/useDialogReturn';

export function ProfileGroup({ title, note, children }) {
  const id = useId();
  return (
    <section className="pf-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="pf-list">{children}</div>
      {note && <p className="pf-note">{note}</p>}
    </section>
  );
}

/**
 * 한 줄. href = 다른 화면으로(링크), onClick = 시트를 열거나 바로 실행(단추), 둘 다 없으면 값만 보이는 글.
 * ariaLabel은 지금 값을 읽어 주는 이름(라벨로 시작 — 보이는 이름이 들어 있어야 음성 조작이 맞는다).
 */
export function ProfileRow({ label, value, sub, href, onClick, ariaLabel, dialog = false, chevron, busy = false, className = '', disabled = false }) {
  const body = (
    <>
      <span className="pf-row__label">{label}</span>
      <span className="pf-row__value">{value}{sub && <small>{sub}</small>}</span>
      {(chevron ?? !!(href || onClick)) && <span className="pf-row__chev"><ActionIcon name="next" /></span>}
    </>
  );
  const cls = `pf-row ${className}`.trim();
  if (href) return <Link href={href} prefetch={false} className={cls} aria-label={ariaLabel}>{body}</Link>;
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel} disabled={disabled}
        aria-haspopup={dialog ? 'dialog' : undefined} aria-busy={busy || undefined}>
        {body}
      </button>
    );
  }
  return <div className={cls} role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel}>{body}</div>;
}

/**
 * 편집 시트 — 휴대폰은 아래에서 올라오는 시트, 넓은 화면은 가운데 창. 바깥을 누르거나 Esc · ✕로 닫는다(busy 동안은 닫지 않는다).
 * 스크림은 공용 .scrim(토큰 --scrim · 화면 이동 효과 예외 목록에 이미 있다)을 쓴다.
 */
export function ProfileSheet({ title, lead, onClose, busy = false, children, actions }) {
  const titleId = useId();
  const close = () => { if (!busy) onClose(); };
  const ref = useDialogReturn(close);
  return (
    <div className="scrim pf-scrim" role="presentation" onClick={close}>
      <div className="pf-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}
        onClick={e => e.stopPropagation()}>
        <div className="pf-sheet__grip" aria-hidden="true" />
        <div className="pf-sheet__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="pf-sheet__x" onClick={close} aria-label="닫기" disabled={busy}><ActionIcon name="close" /></button>
        </div>
        {lead && <p className="pf-sheet__lead">{lead}</p>}
        {children}
        {actions && <div className="pf-sheet__actions">{actions}</div>}
      </div>
    </div>
  );
}
