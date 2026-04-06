'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const STEPS = [
  {
    target: null,
    title: '🧬 Anatomy Studio 투어',
    body: '앱의 주요 기능을 빠르게 소개해 드릴게요! 언제든지 건너뛸 수 있어요.',
    position: 'center',
  },
  {
    target: 'a[href="/home"]',
    title: '🏠 홈',
    body: '오늘의 목표와 미션을 확인하고, 학습 현황을 한눈에 볼 수 있어요.',
    position: 'bottom',
  },
  {
    target: 'a[href="/materials"]',
    title: '📰 자료',
    body: '실제 일본어·영어 텍스트를 읽으며 모르는 단어를 탭해 바로 수집하세요.',
    position: 'bottom',
  },
  {
    target: 'a[href="/vocab"]',
    title: '⭐ 단어장',
    body: '수집한 단어를 FSRS 알고리즘으로 최적화된 간격에 맞춰 복습해요.',
    position: 'bottom',
  },
  {
    target: 'a[href="/forum"]',
    title: '💬 포럼',
    body: '다른 학습자들과 질문을 나누고 스터디 팁을 공유해보세요.',
    position: 'bottom',
  },
  {
    target: 'a[href="/leaderboard"]',
    title: '🏆 랭킹',
    body: '읽기·복습·단어 수집으로 XP를 쌓고 리더보드 상위권에 도전하세요!',
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
