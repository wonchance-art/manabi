import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EMAIL_OTP_TYPES } from '../authConfirm';

// MAIL-KO-001(2026-10-12): Supabase 인증 메일 5종의 한국어 본문 정본 = supabase/templates/*.html.
// 오너가 대시보드에 붙여 넣는 파일이라, 붙여 넣기 전에 깨질 수 있는 것을 여기서 막는다.
const DOC = readFileSync('docs/auth-email-links.md', 'utf8');
const TEMPLATES = {
  'confirmation.html': { type: 'email', subject: '이메일 주소를 확인해 주세요', name: false },
  'invite.html': { type: 'invite', subject: 'manabi에 초대받았어요', name: false },
  'magic_link.html': { type: 'email', subject: 'manabi 로그인 링크', name: false },
  'email_change.html': { type: 'email_change', subject: '새 이메일 주소를 확인해 주세요', name: true },
  'recovery.html': { type: 'recovery', subject: '비밀번호 재설정 링크', name: true },
};
const read = (file) => readFileSync(`supabase/templates/${file}`, 'utf8');
const textOf = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');

function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('인증 메일 템플릿 — 링크', () => {
  for (const [file, spec] of Object.entries(TEMPLATES)) {
    it(`${file}: 모든 링크가 /auth/confirm의 ${spec.type} 하나를 가리킨다`, () => {
      const html = read(file);
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => h !== '{{ .SiteURL }}');
      expect(hrefs.length).toBeGreaterThanOrEqual(2); // 버튼 + 글자 링크
      for (const href of hrefs) {
        expect(href).toBe(`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${spec.type}`);
      }
      expect(EMAIL_OTP_TYPES.has(spec.type)).toBe(true);
      expect(html).not.toContain('ConfirmationURL');
      // 문서의 링크만 바꾸는 표와 같은 종류여야 한다.
      expect(DOC).toContain(`/auth/confirm?token_hash={{ .TokenHash }}&type=${spec.type}\``);
    });
  }
});

describe('인증 메일 템플릿 — 이름(「OO님,」) 경계', () => {
  for (const [file, spec] of Object.entries(TEMPLATES)) {
    it(`${file}: ${spec.name ? '확인된 계정 메일이라 이름을 넣는다' : '확인 전 주소로 가므로 사용자 입력값을 넣지 않는다'}`, () => {
      const html = read(file);
      const data = html.match(/\.Data\b[^}]*/g) || [];
      if (!spec.name) {
        // 가입하는 쪽이 적은 값(user_metadata)이 남의 메일함에 실리면 manabi 도메인 피싱이 된다.
        expect(data).toEqual([]);
        return;
      }
      expect(html).toContain('{{ if .Data.display_name }}{{ .Data.display_name }}님, {{ end }}');
      // 값이 없을 때를 가드 없이 찍지 않는다(빈 「님,」 금지) — 가드 안의 한 번만 허용.
      expect(html.match(/\{\{ \.Data\.display_name \}\}/g)).toHaveLength(1);
    });
  }
});

describe('인증 메일 템플릿 — 메일 앱 안전', () => {
  for (const file of Object.keys(TEMPLATES)) {
    it(`${file}: 외부 자원 없이 열린다`, () => {
      const html = read(file);
      // 메일을 열 때 제3자 요청이 나가지 않게(개인정보·스팸 점수), 이미지 차단 메일함에서도 같은 모양이게.
      expect(html).not.toMatch(/<(link|img|script|iframe)\b/i);
      expect(html).not.toMatch(/@import|url\(|fonts\.googleapis/i);
      expect(html).toContain('<html lang="ko">');
      expect(html).toContain('mso-padding-alt'); // Outlook 버튼 여백
      expect(html).toMatch(/display:none;max-height:0;[^"]*mso-hide:all/); // 받은편지함 미리보기 문장
    });
  }

  it('글자색은 정해 둔 색만 쓰고, 바탕 위 명암비 4.5 이상이다', () => {
    const BACKGROUNDS = ['FFFEFB', 'F6F4EE'];
    const TEXT = ['252721', '65675F', '994A5A'];
    for (const text of TEXT) for (const bg of BACKGROUNDS) expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
    // 버튼 글자(흰색)는 로즈 그라데이션 두 끝 모두에서 4.5 이상.
    for (const rose of ['994A5A', '793B48']) expect(contrast('FFFFFF', rose)).toBeGreaterThanOrEqual(4.5);
    for (const file of Object.keys(TEMPLATES)) {
      const colors = [...read(file).matchAll(/(?<![-\w])color:#([0-9A-Fa-f]{6})/g)].map(m => m[1].toUpperCase());
      for (const c of colors) expect([...TEXT, 'FFFFFF', 'F6F4EE'], `${file} color:#${c}`).toContain(c);
    }
  });
});

describe('인증 메일 템플릿 — 문구', () => {
  for (const [file, spec] of Object.entries(TEMPLATES)) {
    it(`${file}: 해요체 한 가지, 제목에 [manabi] 없음, 문서 표와 같은 제목`, () => {
      const text = textOf(read(file));
      // 웹앱 안내는 해요체다(「진도와 단어장이 기기 간에 이어져요」) — 한 메일 안에 「~니다」를 섞지 않는다.
      expect(text).not.toMatch(/니다[.!]/);
      expect(text).toMatch(/요[.!]/);
      expect(spec.subject).not.toContain('[manabi]');
      expect(DOC).toContain(`| \`supabase/templates/${file}\` | ${spec.subject} |`);
    });
  }

  it('요청하지 않은 사람에게 무시해도 된다고 알린다', () => {
    for (const file of Object.keys(TEMPLATES)) expect(textOf(read(file))).toMatch(/(않았다면|없었다면|없다면)[^.]*무시/);
  });
});
