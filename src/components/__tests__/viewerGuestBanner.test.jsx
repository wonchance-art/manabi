import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import ViewerGuestBanner, { GUEST_BANNER_TEXT } from '../viewer/ViewerGuestBanner';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages';

// 계약: 게스트 배너는 자료 상태와 맞는 말을 한다(VIEWER-GUEST-BANNER-001, 2026-10-17 KST).
// 미분석(isPending)은 토큰이 없어 「단어를 클릭해…」가 거짓이었다(/viewer/169 — VIEWER-IDLE-001 뒤 원문만 보이는 상태).
const vt = (text) => text;
const HREF = '/auth?from=%2Fviewer%2F169';
const html = (pending) => renderToStaticMarkup(<ViewerGuestBanner vt={vt} signInHref={HREF} pending={pending} />);

describe('뷰어 게스트 배너', () => {
  it('분석된 자료 — 단어를 눌러 뜻을 본다고 안내한다', () => {
    expect(html(false)).toContain(GUEST_BANNER_TEXT.analyzed);
    expect(html(false)).not.toContain(GUEST_BANNER_TEXT.pending);
  });

  it('미분석 자료 — 원문만 읽는 상태를 말하고, 단어를 클릭하라고 하지 않는다', () => {
    expect(html(true)).toContain('원문을 읽을 수 있어요.');
    expect(html(true)).not.toContain(GUEST_BANNER_TEXT.analyzed);
  });

  it('로그인 링크는 뷰어가 준 authEntryHref 값 그대로(로그인 뒤 이 자료로) — 맨 /auth가 아니다', () => {
    for (const pending of [false, true]) expect(html(pending)).toContain(`href="${HREF.replaceAll('&', '&amp;')}"`);
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('<ViewerGuestBanner vt={vt} signInHref={signInHref} pending={isPending} />');
    expect(viewer).toMatch(/const signInHref = authEntryHref\(/);
  });

  it('배너 문구는 뷰어 세 언어 표에 있다', () => {
    for (const text of Object.values(GUEST_BANNER_TEXT)) {
      for (const locale of VIEWER_MESSAGE_LOCALES) expect(VIEWER_MESSAGES[locale][text], `${locale} ${text}`).toBeTruthy();
    }
  });
});
