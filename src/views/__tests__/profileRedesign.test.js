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
    expect(page.indexOf('<h3>알림 받기</h3>')).toBeLessThan(page.indexOf('알림 시간</h3>'));
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
    expect(page).toContain('<label htmlFor="pf-name" className="sr-only">닉네임</label>');
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

// PROFILE-POLISH-001(오너 「권장대로」 2026-10-26 KST — 디자이너 · 사용자 검토 + 목업 2 · 3) — 다듬은 자리를 고정한다.
describe('⑦ 다듬기 — 배움과 같은 폭 · 줄 값 · 시트', () => {
  const css = read('src/components/profile/profile.css');
  it('한 단(본문 720 — 배움 learn-page와 같은 값) · 휴대폰 제목 28 · 여백 16, 예전 두 단은 없다', () => {
    expect(css).toContain('.manabi-app .manabi-page.pf{max-width:720px;padding:40px 24px 64px;');
    expect(read('src/components/learn/learn.css')).toContain('.manabi-app .manabi-page.learn-page{max-width:720px;padding:40px 24px 64px}');
    expect(css).toMatch(/@container manabi-shell \(max-width:640px\)\{\s*\.manabi-app \.manabi-page\.pf\{padding:22px 16px 40px\}\s*\.pf h1\{font-size:28px\}/);
    expect(code(page)).not.toContain('pf-cols');
    expect(css).not.toContain('.pf-cols');
  });
  it('이름 옆 「바꾸기」(이름 = 닉네임 바꾸기) · 로그인 방법은 이메일 옆 한 번', () => {
    expect(page).toContain('aria-label="닉네임 바꾸기"');
    expect(page).toContain('{user.email} <span className="pf-nowrap">· {signInMethods(user)} 로그인</span>');
    expect(account).not.toContain('label="로그인 방법"');
  });
  it('「현황 전체 →」는 내 기록 머리 오른쪽 · 먹색', () => {
    expect(page.indexOf('<h2 id="pf-record-title">내 기록</h2>')).toBeLessThan(page.indexOf('className="pf-more">현황 전체 →'));
    expect(page.indexOf('className="pf-more">현황 전체 →')).toBeLessThan(page.indexOf('<StatTile '));
    expect(css).toMatch(/\.pf \.pf-more\{[^}]*color:var\(--ink\)/);
  });
  it('목표 줄 — 날짜 목표가 없으면 없다고 말한다(하루 목표 기본값만으로 정한 목표처럼 보이지 않게)', () => {
    expect(page).toContain("goal.head ? <strong>{goal.head}</strong> : '시험 · 날짜 목표 없음'");
    expect(page).toContain('sub={profile ? goal.daily : null}');
  });
  it('알림 시트 — 안내문은 화면에 있는 것만, 막혀 있으면 시간 칩을 끄고 푸는 길을 말한다, 바로 저장 · 닫기', () => {
    expect(page).toContain("lead={pushEnabled ? ");
    expect(page).toContain("disabled={h !== '' && notifBlocked}");
    expect(page).toContain('고르면 바로 저장돼요.');
    expect(page).toContain('actions={<button type="button" className="pf-pill" onClick={() => setSheet(null)}>닫기</button>}');
    expect(code(page)).not.toContain('시각 알림');
  });
  it('학습 언어 시트 — 수준을 미리 고르지 않고, 켠 언어마다 골라야 저장된다', () => {
    expect(page).toContain("profileLevel(profile, lang) || ''");
    expect(page).toContain('disabled={busy || missing.length > 0}');
    expect(page).toContain('지금 수준을 골라 주세요');
  });
  it('계정 — 동작 이름은 줄 이름, 내보내기는 ↓, 로그아웃은 따로 한 칸, 삭제 글자는 AA 대비', () => {
    expect(account).toContain('label={`비밀번호 ${pwAction}`} dialog');
    expect(account).toContain('label="내 데이터 내보내기"');
    expect(account).toContain('icon="download"');
    expect(css).toMatch(/\.pf \.pf-delete button\{[^}]*font-size:13px;color:color-mix\(in srgb,var\(--danger\) 85%,var\(--ink\)\)/);
  });
  it('시트 칩은 누르는 자리 44px', () => {
    expect(css).toMatch(/\.pf \.pf-chips button\{min-height:44px;/);
  });
});
