import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { INSTALL_CAPTURE_SCRIPT, INSTALL_PROMPT_EVENT, INSTALL_PROMPT_KEY, clearInstallPrompt, storedInstallPrompt } from '../installPrompt';

// PWA-SHELL-001 ⑨ — beforeinstallprompt는 문서를 열 때 한 번만 온다. 루트가 받아 보관하고 내 정보 화면이 꺼내 쓴다.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

function fakeWindow() {
  const listeners = new Map();
  const dispatched = [];
  const win = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    dispatchEvent: (event) => { dispatched.push(event.type); return true; },
  };
  return { win, fire: (type, event) => listeners.get(type)?.(event), listeners, dispatched };
}

describe('루트 인라인 스크립트(보관)', () => {
  it('설치 이벤트를 막고(브라우저 자체 띠 대신 우리 단추) 보관한 뒤 알린다', () => {
    const { win, fire, dispatched } = fakeWindow();
    vm.runInNewContext(INSTALL_CAPTURE_SCRIPT, { window: win, Event: class { constructor(type) { this.type = type; } } });
    const event = { preventDefault: vi.fn() };
    fire('beforeinstallprompt', event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(win[INSTALL_PROMPT_KEY]).toBe(event);
    expect(storedInstallPrompt(win)).toBe(event);
    expect(dispatched).toEqual([INSTALL_PROMPT_EVENT]);
  });

  it('설치가 끝나면 보관함을 비운다 · 꺼내 쓴 뒤 비울 수 있다', () => {
    const { win, fire } = fakeWindow();
    vm.runInNewContext(INSTALL_CAPTURE_SCRIPT, { window: win, Event: class { constructor(type) { this.type = type; } } });
    fire('beforeinstallprompt', { preventDefault() {} });
    fire('appinstalled');
    expect(storedInstallPrompt(win)).toBeNull();
    win[INSTALL_PROMPT_KEY] = { prompt() {} };
    clearInstallPrompt(win);
    expect(storedInstallPrompt(win)).toBeNull();
  });

  it('ES5만 쓴다(하이드레이션 전 · 옛 브라우저에서 문법 오류로 테마 스크립트까지 죽지 않게)', () => {
    expect(INSTALL_CAPTURE_SCRIPT).not.toMatch(/=>|\bconst\b|\blet\b|`/);
  });
});

describe('배선', () => {
  it('layout.jsx 인라인 스크립트 맨 앞(localStorage가 막혀 던져도 먼저 받는다)', () => {
    expect(read('src/app/layout.jsx')).toContain("__html: `(function(){${INSTALL_CAPTURE_SCRIPT}var t=localStorage.getItem('theme')");
  });

  it('InstallPrompt는 보관된 이벤트를 쓰고 자기 beforeinstallprompt 수신을 두지 않는다(받는 곳은 루트 하나)', () => {
    const src = read('src/components/InstallPrompt.jsx');
    expect(src).toContain('storedInstallPrompt()');
    expect(src).toContain('window.addEventListener(INSTALL_PROMPT_EVENT, onStored)');
    expect(src).not.toContain("addEventListener('beforeinstallprompt'");
    // 이벤트당 prompt() 한 번 — 누르면 보관함부터 비운다.
    expect(src).toMatch(/clearInstallPrompt\(\);\s*setDeferred\(null\);\s*try \{\s*deferred\.prompt\(\);/);
  });
});
