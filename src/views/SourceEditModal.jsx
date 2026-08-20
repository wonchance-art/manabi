'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildEditPlan } from '../lib/sourceEdit';

/**
 * ③ 원문 수정 모달(오너 승인) — 자료 소유자 전용. 저장 시 바뀐 줄만 재분석한다.
 * 계획(diff·리맵·분석 대상)은 순수 lib(sourceEdit.js)가 계산하고, 여기는 초안
 * 상태와 요약 표시만 담당한다. 요약은 300ms 디바운스(LCS가 키 입력마다 돌지 않게),
 * 저장은 디바운스와 무관하게 현재 초안으로 다시 계산해 넘긴다(정확성 우선).
 */
export default function SourceEditModal({ open, initialText, processedJson, saving, onSave, onClose }) {
  const [draft, setDraft] = useState(initialText);
  useEffect(() => { if (open) setDraft(initialText); }, [open, initialText]);

  const [debounced, setDebounced] = useState(initialText);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft), 300);
    return () => clearTimeout(t);
  }, [draft]);

  const plan = useMemo(
    () => (open ? buildEditPlan(initialText, debounced, processedJson) : null),
    [open, initialText, debounced, processedJson]
  );

  if (!open) return null;

  const summaryText = !plan ? ''
    : plan.noop ? '변경 없음'
    : !plan.ok ? plan.reason
    : plan.analyzeCount > 0
      ? `바뀐/추가 ${plan.summary.changed}줄 · 삭제 ${plan.summary.removed}줄 → ${plan.analyzeCount}줄만 분석`
      : '줄 구조만 변경 — 재분석 없이 저장';

  return (
    <>
      <div className="source-edit-overlay" onClick={saving ? undefined : onClose} />
      <div className="source-edit" role="dialog" aria-label="원문 수정">
        <div className="source-edit__title">원문 수정</div>
        <textarea
          className="source-edit__textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          aria-label="원문 텍스트"
        />
        <div className="source-edit__footer">
          <span className="source-edit__summary">{summaryText}</span>
          <div className="source-edit__actions">
            <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>취소</button>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onSave(buildEditPlan(initialText, draft, processedJson))}
              disabled={saving || !plan || plan.noop || !plan.ok}
            >
              {saving ? '저장 중…' : plan?.ok && plan.analyzeCount > 0 ? `저장하고 ${plan.analyzeCount}줄 분석` : '저장'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
