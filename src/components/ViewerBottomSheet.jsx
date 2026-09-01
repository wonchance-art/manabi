'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 신호 전이 판정(순수) — 어느 탭을 띄울지 고른다.
 *
 * ── 옛 규칙과 무엇이 다른가 (v2-R, 오너 승인 2026-09-01)
 * 예전에는 섹션 둘이 **동시에 펼쳐질 수 있었다**(#992: 문장 드래그 = 번역+단어 동시 오픈).
 * 시트 상한이 60svh인데 둘을 펼치면 각자 ~30svh이고, **단어 카드 하나만으로도 예문이
 * 잘리는 상황**이라 동시 오픈은 실질적으로 둘 다 못 보게 만들었다. 아코디언은 좌우 칸이
 * 있는 데스크톱의 은유이고, 모바일 하단 바는 이미 **탭처럼 생겼다**.
 * ⇒ 시트는 **선택된 하나만** 렌더한다. 동시 신호(문장 드래그)는 **번역·맥락**을 띄우고,
 *   단어 목록은 하단 바 배지(N개)가 알린다 — 탭으로 건너간다.
 * ※ 데스크톱(좌우 칸, ≥1180px)은 시트를 쓰지 않으므로 **무영향**이다.
 *
 * @returns {{tab: 'left'|'right'}|null} null = 전이 없음
 */
export function resolveSignalTransition(leftRose, rightRose) {
  if (!leftRose && !rightRose) return null;
  // 동시 신호에서 번역·맥락을 고르는 이유: 문장 드래그의 주 목적이 문장 이해이고,
  // 단어 목록은 배지로 존재를 알릴 수 있지만 번역은 열지 않으면 알 길이 없다.
  return { tab: leftRose ? 'left' : 'right' };
}

export default function ViewerBottomSheet({
  leftContent,
  rightContent,
  leftActive,
  rightActive,
  leftBadge,
  rightBadge,
  // 명시적 재오픈 신호(증가 카운터) — active는 한 번 켜지면 유지되므로 rising edge만으론
  // "시트를 닫은 뒤 다른 단어를 탭"했을 때 다시 열 방법이 없다(#996 오너 보고).
  leftSignal = 0,
  rightSignal = 0,
  // 바 오른쪽 끝 슬롯(leftContent 합성 선례) — 문장 이동 ▲▼ 재배치용. 바는 시트(z 95)보다
  // 항상 위(z 100)·항상 노출이라, 플로팅 필처럼 시트에 덮이는 일이 구조적으로 없다.
  barNav = null,
}) {
  // 시트는 한 번에 하나만 보여 준다 — 열림 여부(sheetOpen)와 **무엇을 보는지**(tab)로 가른다.
  const [tab, setTab] = useState('left');
  const [sheetOpen, setSheetOpen] = useState(false);

  const prevLeft = useRef(false);
  const prevRight = useRef(false);


  useEffect(() => {
    if (leftActive && !prevLeft.current) {
      setTab('left');
      setSheetOpen(true);
    }
    prevLeft.current = leftActive;
  }, [leftActive]);

  useEffect(() => {
    if (rightActive && !prevRight.current) {
      setTab('right');
      setSheetOpen(true);
    }
    prevRight.current = rightActive;
  }, [rightActive]);

  // 신호 전이 — 신호가 오면 해당 탭으로 건너간다. 「먼저 열려 있던 문장 설명이 단어 상세를
  // 가린다」는 옛 문제(오너 보고)는 탭 구조에서 구조적으로 성립하지 않는다.
  const prevSig = useRef({ left: 0, right: 0 });
  useEffect(() => {
    const leftRose = leftSignal > prevSig.current.left;
    const rightRose = rightSignal > prevSig.current.right;
    prevSig.current = { left: leftSignal, right: rightSignal };
    const t = resolveSignalTransition(leftRose, rightRose);
    if (!t) return;
    setSheetOpen(true);
    setTab(t.tab);
  }, [leftSignal, rightSignal]);

  // 하단 바가 **유일한 전환 수단**이다(시트 안 섹션 헤더·셰브런은 폐지 — 같은 것을 여는
  // 방법이 셋이고 라벨까지 겹쳐 화면에 「번역·맥락」이 두 번 보였다).
  //   닫힘 → 그 탭으로 연다 / 열림+같은 탭 → 시트째 닫는다 / 열림+다른 탭 → 건너간다
  const selectTab = (next) => {
    if (!sheetOpen) { setSheetOpen(true); setTab(next); return; }
    if (tab === next) { setSheetOpen(false); return; }
    setTab(next);
  };
  const closeSheet = () => setSheetOpen(false);

  // 핸들 아래로 스와이프 = 내리기 (바텀시트 표준 제스처 — 탭 경로만으론 '내린다'는
  // 기대와 어긋난다). 핸들에서 시작한 하향 드래그만 추적해 콘텐츠 스크롤과 분리.
  const sheetRef = useRef(null);
  const dragY = useRef(null);
  const onHandleTouchStart = (e) => { dragY.current = e.touches[0].clientY; };
  const onHandleTouchMove = (e) => {
    if (dragY.current == null || !sheetRef.current) return;
    const dy = e.touches[0].clientY - dragY.current;
    if (dy > 0) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onHandleTouchEnd = (e) => {
    if (dragY.current == null) return;
    const dy = e.changedTouches[0].clientY - dragY.current;
    dragY.current = null;
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (dy > 48) setSheetOpen(false);
  };
  // 브라우저가 제스처를 가로채 touchcancel이 오면 이동값이 남아 시트가 화면 밖에
  // 고착된다(#996 '고장' 증상) — 반드시 원위치로 정리.
  const onHandleTouchCancel = () => {
    dragY.current = null;
    if (sheetRef.current) sheetRef.current.style.transform = '';
  };
  // 시트·바 안의 터치가 뷰어 본문의 onMouseUp(문장 드래그 분석)으로 버블되면
  // 닫기 동작과 충돌한다 — 여기서 끊는다.
  const stopMouseUp = (e) => e.stopPropagation();

  return (
    <>
      <div className="viewer-sheet-bar" role="toolbar" onMouseUp={stopMouseUp}>
        <button
          className={`viewer-sheet-bar__btn ${sheetOpen && tab === 'left' ? 'is-active' : ''}`}
          onClick={() => selectTab('left')}
          aria-pressed={sheetOpen && tab === 'left'}
        >
          <span>번역·맥락</span>
          {leftBadge && <span className="viewer-sheet-bar__badge">{leftBadge}</span>}
        </button>
        <button
          className={`viewer-sheet-bar__btn ${sheetOpen && tab === 'right' ? 'is-active' : ''}`}
          onClick={() => selectTab('right')}
          aria-pressed={sheetOpen && tab === 'right'}
        >
          <span>단어</span>
          {rightBadge && <span className="viewer-sheet-bar__badge">{rightBadge}</span>}
        </button>
        {barNav}
      </div>

      {sheetOpen && (
        <div className="viewer-sheet" role="dialog" aria-label="AI 분석 결과" onMouseUp={stopMouseUp} ref={sheetRef}>
          <div className="viewer-sheet__handle" onClick={closeSheet} role="button" tabIndex={0}
            aria-label="시트 닫기"
            onTouchStart={onHandleTouchStart}
            onTouchMove={onHandleTouchMove}
            onTouchEnd={onHandleTouchEnd}
            onTouchCancel={onHandleTouchCancel}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), closeSheet())}>
            <div className="viewer-sheet__handle-bar" aria-hidden="true" />
          </div>

          {/* 선택된 하나만 렌더한다 — 접힌 섹션의 헤더 줄이 세로를 먹던 것이 사라지고,
              그만큼이 카드 하단 예문(한자/병음/번역 3줄)이 잘리지 않을 여백이 된다. */}
          <div className="viewer-sheet__sections">
            <div className="viewer-sheet__section-body">
              {tab === 'left' ? leftContent : rightContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
