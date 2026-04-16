'use client';

import { useEffect, useState } from 'react';
import Button from './Button';

// PWA 홈 화면 추가 프롬프트. Chromium 계열 브라우저에서 beforeinstallprompt 이벤트를 가로채어 직접 버튼을 제공.
// iOS Safari는 이벤트 미지원이라 별도 안내 텍스트로 처리.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 이미 standalone으로 실행 중이면 숨김
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (standalone) { setInstalled(true); return; }

    const ua = window.navigator.userAgent.toLowerCase();
    const iosCheck = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIos(iosCheck);

    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (installed) return null;
  if (!deferred && !isIos) return null;

  return (
    <div className="card mypage-section" style={{ marginBottom: 16 }}>
      <h2 className="mypage-section__title" style={{ fontSize: '0.9rem', marginBottom: 8 }}>
        📱 앱으로 설치
      </h2>
      {deferred ? (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
            홈 화면에 추가하면 브라우저 없이 앱처럼 실행할 수 있어요.
          </p>
          <Button size="sm" onClick={handleInstall}>🏠 홈 화면에 추가</Button>
        </>
      ) : isIos ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Safari 공유 버튼 <strong>(⬆️)</strong> → <strong>&ldquo;홈 화면에 추가&rdquo;</strong> 로 앱처럼 사용할 수 있어요.
        </p>
      ) : null}
    </div>
  );
}
