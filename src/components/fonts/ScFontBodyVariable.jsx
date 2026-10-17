'use client';
import { useLayoutEffect } from 'react';

// ScFontScope 감싸개 밖(document.body 포털)에서도 --font-noto-sc가 정의되게 body에 같은 변수 클래스를 건다.
// 범위 화면을 떠나면 뗀다(겹쳐 마운트돼도 마지막이 떠날 때만 — 참조 수).
const COUNT = 'scFontScopes';
export default function ScFontBodyVariable({ className }) {
  useLayoutEffect(() => {
    const body = document.body;
    const n = Number(body.dataset[COUNT] || 0) + 1;
    body.dataset[COUNT] = String(n);
    body.classList.add(className);
    return () => {
      const left = Number(body.dataset[COUNT] || 1) - 1;
      if (left > 0) { body.dataset[COUNT] = String(left); return; }
      delete body.dataset[COUNT];
      body.classList.remove(className);
    };
  }, [className]);
  return null;
}
