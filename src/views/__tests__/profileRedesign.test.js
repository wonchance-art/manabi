// 내 정보 개편(PROFILE-REDESIGN-001, 오너 승인 시안 A · D1–D6 2026-10-25 KST) — 배선 계약(ui-conventions §5: 계약 = 배선, e2e = 동작).
// 지키는 것: ① 이름은 「내 정보」 하나 ② 머리 입구는 진짜 링크 + 현재 위치 ③ 학습자 화면에 개발용 「테스트 발송」 · 내부 상태 문구가 없다
// ④ 입력 · 고르기 접근성(label for · aria-pressed) · 인라인 style 0 ⑤ 계정 삭제는 맨 아래 따로, 입력 확인 그대로 ⑥ 숨은 테마 토글은 지웠다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const code = src => src.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/[^\n]*/gm, '$1');
const page = read('src/views/MyPage.jsx');
const account = read('src/components/AccountSettings.jsx');
const install = read('src/components/InstallPrompt.jsx');
const parts = read('src/components/profile/ProfileParts.jsx');
const layout = read('src/components/Layout.jsx');

describe('① 이름 · ② 머리 입구', () => {
  it('문서 제목 · h1 · 머리 아이콘 이름이 모두 「내 정보」다', () => {
    expect(read('src/app/(app)/profile/page.jsx')).toContain("title: '내 정보',");
    expect(page).toContain('<h1>내 정보</h1>');
    expect(code(layout)).not.toContain('내 계정');
  });
  it('머리 입구는 /profile 링크이고 그 화면에서 aria-current="page" — 자리(gnb__actions) · 모양(gnb__profile-btn)은 그대로', () => {
    const entry = sliceBetween(layout, '<div className="gnb__user-area">', '</div>');
    expect(entry).toMatch(/<Link\s+href="\/profile"/);
    expect(entry).toContain('className="gnb__profile-btn"');
    expect(entry).toContain('aria-label="내 정보"');
    expect(entry).toContain("aria-current={pathname === '/profile' ? 'page' : undefined}");
    expect(entry).not.toContain('router.push');
    expect(read('src/components/web/web-shell.css')).toContain('.manabi-app .gnb .gnb__profile-btn[aria-current="page"]{');
  });
});

describe('③ 알림은 한 줄 — 푸시 먼저, 시각 알림 보조', () => {
  it('학습자 화면에 테스트 발송 · 서버 키 상태 문구가 없다', () => {
    for (const src of [page, account]) {
      expect(src).not.toContain('/api/push/test');
      expect(src).not.toContain('테스트 발송');
      expect(src).not.toContain('푸시 키');
    }
    expect(page).toContain('<ProfileRow label="알림" dialog');
    expect(page.indexOf('<h3>알림 받기</h3>')).toBeLessThan(page.indexOf('이 브라우저에서 시각 알림</h3>'));
  });
  it('토스트에 느낌표가 없다', () => {
    expect(code(page)).not.toMatch(/toast\([^)]*!['`]/);
  });
});

describe('④ 접근성', () => {
  it('인라인 style이 없다(내 정보 · 계정 · 설치 · 부품)', () => {
    for (const [name, src] of Object.entries({ page, account, install, parts })) expect(src, name).not.toMatch(/style=\{\{/);
  });
  it('입력은 label for로 연결된다 — 닉네임 · 비밀번호 3칸 · 삭제 확인', () => {
    expect(page).toContain('<label htmlFor="pf-name">닉네임</label>');
    expect(page).toContain('<input id="pf-name"');
    for (const id of ['pf-current-password', 'pf-new-password', 'pf-confirm-password']) {
      expect(account).toContain(`<label htmlFor="${id}">`);
      expect(account).toContain(`<input id="${id}"`);
    }
    expect(account).toContain('<label htmlFor={deleteInputId}>확인을 위해 아래에 ‘삭제’를 입력해 주세요.</label>');
    expect(account).not.toMatch(/placeholder="(현재 비밀번호|새 비밀번호)/);
  });
  it('고르는 단추(수준 · 알림 시각 · 푸시)는 aria-pressed로 상태를 말한다', () => {
    expect(page).toMatch(/aria-pressed=\{levels\[lang\] === level\}/);
    expect(page).toMatch(/aria-pressed=\{reminderHour === h\}/);
    expect(page).toMatch(/className="pf-switch" aria-pressed=\{!!pushState\?\.subscribed\}/);
  });
  it('편집 시트는 useDialogReturn(열면 창 안 · Esc · 닫으면 누른 줄로) + 이름 있는 dialog', () => {
    expect(parts).toContain('const ref = useDialogReturn(close);');
    expect(parts).toContain('role="dialog" aria-modal="true" aria-labelledby={titleId}');
  });
});

describe('⑤ 계정 삭제 · 계정 경계', () => {
  it('삭제는 화면 맨 아래(약관 줄 뒤)이고, 「삭제」를 입력해야 「영구 삭제」가 눌린다', () => {
    expect(page.indexOf('<AccountDelete ')).toBeGreaterThan(page.indexOf('className="pf-foot"'));
    expect(account).toContain("disabled={deleting || deleteText !== '삭제'}");
    expect(account).toContain('계정을 영구 삭제할까요?');
  });
  it('기록 개수 조회는 계정 id를 키에 넣는다(공유 캐시 없음)', () => {
    expect(page).toContain("queryKey: ['profile-counts', user?.id]");
  });
});

describe('⑥ 숨은 테마 토글', () => {
  it('셸이 숨겨 누를 수 없던 테마 토글 단추와 그 CSS를 지웠다(어둡게 모드는 범위 밖 — D5)', () => {
    expect(layout).not.toContain('theme-toggle');
    for (const css of ['src/index.css', 'src/components/books/reading-shell.css']) expect(read(css)).not.toContain('.theme-toggle');
  });
});
