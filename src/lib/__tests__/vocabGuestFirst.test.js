import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// 손님 /vocab 첫 그림(VOCAB-GUEST-FIRST-001, 2026-11-02 KST): 운영 CPU×4에서 「계정을 확인하고 있어요…」가 약 1.2초 머문 뒤 손님 안내가 나왔다.
// 서버가 세션 쿠키 이름을 못 봤으면 확인을 기다리지 않는다 — 판정은 서재 · 배움과 같은 hasSupabaseSessionInJar(이름만).
const read = (p) => fs.readFileSync(p, 'utf8');

describe('손님 단어장은 로그인 확인을 기다리지 않는다', () => {
  it('쪽이 세션 쿠키 힌트를 넘긴다(이름만 — 값 · 계정을 읽지 않는 같은 판정)', () => {
    const page = read('src/app/(app)/vocab/page.jsx');
    expect(page).toContain("import { hasSupabaseSessionInJar } from '@/lib/authCookie';");
    expect(page).toContain('sessionHint={hasSupabaseSessionInJar(await cookies())}');
  });
  it('힌트가 false일 때만 바로 그린다 — 쿠키가 있거나 힌트가 없으면 지금처럼 확인 문구', () => {
    const view = read('src/views/VocabPage.jsx');
    expect(view).toContain("export default function VocabPage({ reviewScope = NOT_EXPLICIT, firstScreen = null, serverUserId = null, sessionHint = null })");
    expect(view).toMatch(/if \(loading && sessionHint !== false\) return <div className="page-container manabi-review-room" role="status">계정을 확인하고 있어요…<\/div>;/);
    // 손님 화면은 작업 공간의 `if (!user)` 분기 그대로 — 확인이 끝나 손님이면 키('guest')가 같아 다시 그리지 않는다.
    expect(view).toContain("key={`${user?.id || 'guest'}:${scopeKey}`}");
  });
});

describe('자료 추가도 같은 규칙 — 손님은 로그인 확인을 기다리지 않는다', () => {
  it('쪽이 힌트를 넘기고 두 입구(작성 · 가져오기)가 같은 조건으로만 기다린다', () => {
    expect(read('src/app/(app)/materials/add/page.jsx')).toContain('<MaterialEntry sessionHint={hasSupabaseSessionInJar(await cookies())} />');
    const entry = read('src/components/materials/MaterialEntry.jsx');
    expect(entry).toContain('<LegacyImport sessionHint={sessionHint} />');
    expect(entry).toContain('<MaterialComposer sessionHint={sessionHint} />');
    for (const p of ['src/components/materials/MaterialComposer.jsx', 'src/views/MaterialAddPage.jsx']) {
      expect(read(p)).toMatch(/if \(loading && sessionHint !== false\) return <div className="page-container" role="status">계정을 확인하고 있어요…<\/div>;/);
    }
  });
});
