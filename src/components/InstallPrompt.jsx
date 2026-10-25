'use client';

import { useEffect, useState } from 'react';
import { ProfileRow } from './profile/ProfileParts';
import { INSTALL_PROMPT_EVENT, clearInstallPrompt, storedInstallPrompt } from '../lib/installPrompt';

// PWA 홈 화면 추가 — 내 정보 「이 기기에서」 묶음의 한 줄(설치 전에만). Chromium 계열의 beforeinstallprompt는 루트 인라인 스크립트가
// 문서 처음부터 받아 보관한다(src/lib/installPrompt.js — 이 화면이 늦게 떠도 놓치지 않게). 여기서는 보관된 것을 꺼내 줄을 누르면 띄운다.
// iOS Safari는 이벤트 미지원이라 줄에 방법만 적는다.
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

    // 이미 받아 둔 것(대개 이쪽) + 이 화면이 떠 있는 동안 새로 오는 것.
    setDeferred(storedInstallPrompt());
    const onStored = () => setDeferred(storedInstallPrompt());
    window.addEventListener(INSTALL_PROMPT_EVENT, onStored);

    const onInstalled = () => { setInstalled(true); setDeferred(null); clearInstallPrompt(); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener(INSTALL_PROMPT_EVENT, onStored);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    // prompt()는 이벤트당 한 번 — 누르는 순간 보관함을 비워 다른 화면이 같은 이벤트를 다시 쓰지 않게 한다.
    clearInstallPrompt();
    setDeferred(null);
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch { /* 브라우저가 거절하면 단추만 사라진다 — 다음 방문에 새 이벤트가 온다 */ }
  }

  if (installed) return null;
  if (!deferred && !isIos) return null;

  if (deferred) return <ProfileRow label="앱으로 설치" value="홈 화면에 추가" onClick={handleInstall} ariaLabel="앱으로 설치, 홈 화면에 추가" />;
  return <ProfileRow label="앱으로 설치" value="Safari 공유 → 홈 화면에 추가" />;
}
