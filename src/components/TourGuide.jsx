'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const STEPS = [
  {
    target: null,
    title: '🧬 환영해요!',
    body: '핵심만 빠르게 소개할게요. 언제든 건너뛸 수 있어요.',
    position: 'center',
  },
  {
    target: 'a[href="/guide"]',
    title: '1. 학습 로드맵',
    body: 'JLPT N5→N1, CEFR A1→C2 시리즈로 단계별 학습. 레벨별 진행도가 시각화돼요.',
    position: 'bottom',
  },
  {
    target: 'a[href="/materials"]',
    title: '2. 자료 읽기',
    body: '글이나 PDF를 읽으면 단어가 자동 분석돼요. 본문 듣기·리딩 테스트·AI 회화까지 한 화면에서.',
    position: 'bottom',
  },
  {
    target: 'a[href="/vocab"]',
    title: '3. 자동 복습',
    body: '저장한 단어는 FSRS 기억 곡선으로 자동 복습. 읽기 중 노란 단어 클릭으로도 복습돼요.',
    position: 'bottom',
  },
  {
    target: 'a[href="/home"]',
    title: '4. 홈에서 이어가기',
    body: '"이어서 학습" 카드로 진행 중인 시리즈로 직진. 자, 시작해볼까요?',
    position: 'bottom',
  },
];

const PAD = 8;

export default function TourGuide({ onDone }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const tooltipRef = useRef(null);

  const current = STEPS[step];
  const total = STEPS.length;

  const measureTarget = useCallback((selector) => {
    if (!selector) { setRect(null); return; }
    const el = document.querySelector(selector);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    measureTarget(current.target);
    setFadeKey(k => k + 1);

    const update = () => measureTarget(current.target);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step, mounted, current.target, measureTarget]);

  // Keyboard navigation
  useEffect(() => {
    if (!mounted) return;
    function handleKey(e) {
      if (e.key === 'Escape') { finish(); return; }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { next(); return; }
      if (e.key === 'ArrowLeft') { prev(); return; }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  function finish() {
    localStorage.setItem('as_tour_done', '1');
    onDone?.();
  }

  function next() {
    if (step < total - 1) setStep(s => s + 1);
    else finish();
  }

  function prev() {
    if (step > 0) setStep(s => s - 1);
  }

  if (!mounted) return null;

  const spotlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        borderRadius: 10,
      }
    : null;

  let tooltipStyle = {};
  if (current.position === 'center' || !rect) {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else {
    const TIP_H = 180;
    const TIP_W = 300;
    const spaceBelow = window.innerHeight - (rect.top + rect.height + PAD);
    const spaceAbove = rect.top - PAD;

    if (spaceBelow >= TIP_H + 16 || spaceBelow >= spaceAbove) {
      tooltipStyle = {
        position: 'fixed',
        top: rect.top + rect.height + PAD + 12,
        left: Math.max(12, Math.min(window.innerWidth - TIP_W - 12, rect.left + rect.width / 2 - TIP_W / 2)),
      };
    } else {
      tooltipStyle = {
        position: 'fixed',
        bottom: window.innerHeight - rect.top + PAD + 12,
        left: Math.max(12, Math.min(window.innerWidth - TIP_W - 12, rect.left + rect.width / 2 - TIP_W / 2)),
      };
    }
  }

  const content = (
    <>
      {/* Overlay */}
      <div className="tour-overlay" />

      {/* Spotlight cutout */}
      {spotlight && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: spotlight.borderRadius,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        key={fadeKey}
        className="tour-tooltip"
        style={tooltipStyle}
      >
        {/* Step dots */}
        <div className="tour-dots">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`tour-dot ${i === step ? 'tour-dot--active' : ''}`}
            />
          ))}
        </div>

        <div className="tour-tooltip__title">{current.title}</div>
        <p className="tour-tooltip__body">{current.body}</p>

        <div className="tour-tooltip__footer">
          <button onClick={finish} className="tour-skip-btn">
            건너뛰기
          </button>

          <div className="tour-nav-btns">
            {step > 0 && (
              <button onClick={prev} className="tour-btn tour-btn--prev">이전</button>
            )}
            <button onClick={next} className="tour-btn tour-btn--next">
              {step === total - 1 ? '완료 🎉' : '다음 →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
