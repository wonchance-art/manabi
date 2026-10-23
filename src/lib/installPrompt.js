// 설치 안내(PWA-SHELL-001 ⑨) — 안드로이드 Chrome의 beforeinstallprompt는 문서를 열 때 한 번만 온다.
// 예전에는 내 정보 화면(InstallPrompt)이 떠 있을 때만 받아서, 배움에서 시작해 화면 이동으로 내 정보에 오면 이미 지나가
// 「홈 화면에 추가」 단추가 뜨지 않았다. 루트 인라인 스크립트(layout.jsx)가 처음부터 받아 보관하고, InstallPrompt가 꺼내 쓴다.
// preventDefault = 브라우저 자체 설치 띠 대신 우리 단추(내 정보 「앱으로 설치」)가 설치 자리다(오너 상시 지시 「권장대로」 2026-10-23 KST).
// 계정과 무관하다 — 기기 · 브라우저의 설치 가능 여부일 뿐이고 계정이 바뀌어도 같은 이벤트를 쓴다.

export const INSTALL_PROMPT_KEY = '__manabiInstallPrompt';
export const INSTALL_PROMPT_EVENT = 'manabi:installprompt';

// layout.jsx의 <head> 인라인 스크립트에 그대로 들어간다(하이드레이션 전에 와도 놓치지 않게) — ES5 문법만.
export const INSTALL_CAPTURE_SCRIPT = "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window."
  + INSTALL_PROMPT_KEY + "=e;window.dispatchEvent(new Event('" + INSTALL_PROMPT_EVENT + "'))});"
  + "window.addEventListener('appinstalled',function(){window." + INSTALL_PROMPT_KEY + "=null});";

/** 보관된 설치 이벤트(없으면 null). */
export function storedInstallPrompt(win = typeof window !== 'undefined' ? window : undefined) {
  return win?.[INSTALL_PROMPT_KEY] || null;
}

/** 한 번 쓴 이벤트는 다시 쓸 수 없다(prompt()는 이벤트당 한 번) — 보관함을 비운다. */
export function clearInstallPrompt(win = typeof window !== 'undefined' ? window : undefined) {
  if (win) win[INSTALL_PROMPT_KEY] = null;
}
