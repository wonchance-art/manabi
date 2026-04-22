'use client';

import { useEffect, useRef, useState } from 'react';

export default function ViewerBottomSheet({
  leftContent,
  rightContent,
  leftActive,
  rightActive,
  leftBadge,
  rightBadge,
}) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const prevLeft = useRef(false);
  const prevRight = useRef(false);

  useEffect(() => {
    if (leftActive && !prevLeft.current) {
      setLeftOpen(true);
      setSheetOpen(true);
    }
    prevLeft.current = leftActive;
  }, [leftActive]);

  useEffect(() => {
    if (rightActive && !prevRight.current) {
      setRightOpen(true);
      setSheetOpen(true);
    }
    prevRight.current = rightActive;
  }, [rightActive]);

  const toggleLeft = () => {
    if (!sheetOpen) { setSheetOpen(true); setLeftOpen(true); return; }
    setLeftOpen(o => !o);
  };
  const toggleRight = () => {
    if (!sheetOpen) { setSheetOpen(true); setRightOpen(true); return; }
    setRightOpen(o => !o);
  };
  const closeSheet = () => setSheetOpen(false);

  return (
    <>
      <div className="viewer-sheet-bar" role="toolbar">
        <button
          className={`viewer-sheet-bar__btn ${sheetOpen && leftOpen ? 'is-active' : ''}`}
          onClick={toggleLeft}
        >
          <span>🌐 번역·맥락</span>
          {leftBadge && <span className="viewer-sheet-bar__badge">{leftBadge}</span>}
        </button>
        <button
          className={`viewer-sheet-bar__btn ${sheetOpen && rightOpen ? 'is-active' : ''}`}
          onClick={toggleRight}
        >
          <span>📖 단어</span>
          {rightBadge && <span className="viewer-sheet-bar__badge">{rightBadge}</span>}
        </button>
      </div>

      {sheetOpen && (
        <div className="viewer-sheet" role="dialog" aria-label="AI 분석 결과">
          <div className="viewer-sheet__handle">
            <div className="viewer-sheet__handle-bar" aria-hidden="true" />
            <button className="viewer-sheet__close" onClick={closeSheet} aria-label="닫기">✕</button>
          </div>

          <div className="viewer-sheet__sections">
            <section className={`viewer-sheet__section ${leftOpen ? 'is-open' : ''}`}>
              <button
                className="viewer-sheet__section-header"
                onClick={() => setLeftOpen(o => !o)}
                aria-expanded={leftOpen}
              >
                <span>🌐 번역·맥락</span>
                <span className="viewer-sheet__chevron">{leftOpen ? '▼' : '▶'}</span>
              </button>
              {leftOpen && <div className="viewer-sheet__section-body">{leftContent}</div>}
            </section>

            <section className={`viewer-sheet__section ${rightOpen ? 'is-open' : ''}`}>
              <button
                className="viewer-sheet__section-header"
                onClick={() => setRightOpen(o => !o)}
                aria-expanded={rightOpen}
              >
                <span>📖 단어</span>
                <span className="viewer-sheet__chevron">{rightOpen ? '▼' : '▶'}</span>
              </button>
              {rightOpen && <div className="viewer-sheet__section-body">{rightContent}</div>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
