import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ROUTE-AUDIT-2 P2(오너 「권장대로」 2026-10-26 KST) — 옛 언어 첫 화면(/japanese 등)은 그 언어의 책장(/lessons?lang=…)으로 엣지에서 보낸다.
// 예전엔 보관함 규칙(legacyTextbookTarget)에 먼저 걸려 손님은 「관리자 보관함 로그인」, 학습자는 /admin → / → /home 3번을 돌았고,
// 각 언어 page.jsx의 redirect('/lessons?lang=…')는 닿지 않았다. 목적지는 그 page.jsx와 같다 — 질의는 버리고 세션은 읽지 않는다.
const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: createServerClientMock }));

import { middleware } from '../../middleware';
import JapanesePage from '../../app/(app)/japanese/page';
import ChinesePage from '../../app/(app)/chinese/page';
import EnglishPage from '../../app/(app)/english/page';
import FrenchPage from '../../app/(app)/french/page';

const PAGES = { japanese: JapanesePage, chinese: ChinesePage, english: EnglishPage, french: FrenchPage };
// page.jsx가 내는 목적지(redirect 예외의 digest: NEXT_REDIRECT;replace;<위치>;307;)
function pageTarget(lang) {
  try { PAGES[lang](); } catch (error) { return String(error.digest).split(';')[2]; }
  throw new Error(`${lang}/page.jsx did not redirect`);
}

describe('옛 언어 첫 화면 → 그 언어 책장(엣지 307, page.jsx와 같은 목적지)', () => {
  it.each(Object.keys(PAGES).flatMap((lang) => [`/${lang}`, `/${lang}/`, `/${lang}?utm_source=x`]))('%s', async (input) => {
    const lang = input.slice(1).split(/[/?]/)[0];
    const response = await middleware(new NextRequest(`https://example.test${input}`));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location'));
    expect(location.pathname + location.search).toBe(pageTarget(lang));
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('장 주소는 지금처럼 보관함으로(질의 보존)', async () => {
    const response = await middleware(new NextRequest('https://example.test/japanese/grammar/n5-04-desu-da?sourceRevision=one'));
    expect(response.headers.get('location')).toBe('https://example.test/admin/legacy-textbooks/japanese/grammar/n5-04-desu-da?sourceRevision=one');
  });
});
