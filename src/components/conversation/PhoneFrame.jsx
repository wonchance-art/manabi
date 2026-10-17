'use client';
// 휴대폰 틀(CONV-CHAT-001 9차, 오너 「[대화] 페이지 아예 중간에 스마트폰 스크린샷 크기로 넣어서 그 안에서 구동되게」 2026-10-17).
// 마우스로 쓰는 넓은 화면(PC)에서만 대화 화면을 가운데 휴대폰 틀(390×844 비율) 안에 띄운다 — 메신저 PC판·기기 미리보기 관례.
// 폰·태블릿(터치)에서는 틀이 display: contents로 사라져 지금 화면 그대로다. 틀은 CSS(conversation.css)만으로 켜고 끄므로
// 첫 그림부터 틀이 있다(JS 측정 후 튀는 일 없음). 상태 표시줄·홈 막대는 꾸밈이라 읽기 도구에 감춘다. 특정 기기 모양·로고는 없다.
import { useEffect, useState } from 'react';

const clockFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });

function StatusClock() {
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = () => setNow(clockFormat.format(new Date()));
    tick();
    const timer = setInterval(tick, 20000);
    return () => clearInterval(timer);
  }, []);
  return <span className="phone-stage__clock">{now}</span>;
}

export default function PhoneFrame({ children }) {
  return (
    <div className="phone-stage">
      <div className="phone-stage__device">
        <div className="phone-stage__status" aria-hidden="true">
          <StatusClock />
          <span className="phone-stage__icons">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 4a9.5 9.5 0 0 1 13 0M3.4 6.6a6 6 0 0 1 8.2 0"/><circle cx="7.5" cy="9.3" r="1.1" fill="currentColor" stroke="none"/></svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/><rect x="2.4" y="2.4" width="15.5" height="7.2" rx="1.6" fill="currentColor"/><path d="M23.3 4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"/></svg>
          </span>
        </div>
        <div className="phone-stage__screen">{children}</div>
        <div className="phone-stage__home" aria-hidden="true" />
      </div>
    </div>
  );
}
