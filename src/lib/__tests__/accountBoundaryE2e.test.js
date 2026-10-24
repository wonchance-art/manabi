// 계정 경계 e2e(e2e/account-boundary.e2e.mjs, AUTH-ROUTER-REFRESH-001)의 전제 — 빌드 없이 지킨다.
// ① 표식 계정은 그 e2e 전용이라 공용 서버 대역(server-fetch-mock)을 바꿔도 다른 e2e 응답이 그대로다
// ② e2e가 고르는 화면 문구 · 표식이 실제 화면에 있다(문구가 바뀌면 e2e가 「못 찾음」으로 깨지기 전에 여기서 알린다)
// ③ 앱 안 이동에 쓰는 window.next.router가 설치된 Next에 있다(전체 로드로 바뀌면 라우터 캐시를 시험하지 못한다)
// ④ 필수 CI가 돌린다 — 「서재 과 추가·관리」 격리 서버(8878, QA_BASE) 단계의 e2e 목록에 든다(계정 경계는 필수 CI로 지킨다, 2026-10-18 KST)
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { BOUNDARY_ACTORS, BOUNDARY_MARKER } from '../../../e2e/fixtures/account-boundary-actors.mjs';

const ROOT = process.cwd();
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const e2eFiles = (dir = 'e2e', out = []) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) e2eFiles(rel, out); else if (/\.(mjs|js|cjs)$/.test(e.name)) out.push(rel);
  }
  return out;
};

describe('계정 경계 e2e 전제', () => {
  it('① 표식 계정 sub · 표식 글은 경계 e2e 파일에만 있다', () => {
    const users = e2eFiles().filter(f => [...Object.values(BOUNDARY_ACTORS), BOUNDARY_MARKER].some(v => read(f).includes(v)));
    expect(users).toEqual(['e2e/fixtures/account-boundary-actors.mjs']);
    const importers = e2eFiles().filter(f => read(f).includes('account-boundary-actors.mjs')).sort();
    expect(importers).toEqual(['e2e/account-boundary.e2e.mjs', 'e2e/server-fetch-mock.mjs']);
  });
  it('① 서버 대역은 표식 계정이 아니면 손대지 않고(null) 기존 응답으로 넘긴다', () => {
    const mock = read('e2e/server-fetch-mock.mjs');
    expect(mock).toContain('if (sub !== BOUNDARY_ACTORS.A && sub !== BOUNDARY_ACTORS.B) return null;');
    expect(mock).toMatch(/function mockResponse\(url, claims\) \{\n  const boundary = boundaryResponse\(url, claims\);\n  if \(boundary\) return boundary;/);
  });
  it('② e2e가 고르는 문구 · 표식이 화면에 있다', () => {
    expect(read('src/views/MyPage.jsx')).toContain('>로그아웃</Button>');
    const account = read('src/components/AccountSettings.jsx');
    expect(account).toMatch(/계정 삭제\s*<\/Button>/);
    expect(account).toContain("{deleting ? '삭제 중…' : '영구 삭제'}");
    expect(account).toContain('placeholder="삭제"');
    expect(read('src/views/StudyLibraryPage.jsx')).toContain('>지난 이야기</h1>');
    const auth = read('src/views/AuthPage.jsx');
    expect(auth).toContain('htmlFor="auth-email">이메일</label>');
    expect(auth).toContain('htmlFor="auth-password" style={{ marginBottom: 0 }}>비밀번호</label>');
    expect(auth).toContain("className={`auth-submit ${loading ? 'auth-submit--loading' : ''}`}"); // 머리말 「로그인」과 겹치지 않게 폼 제출 버튼으로 고른다
    const materials = read('src/views/MaterialsPage.jsx');
    expect(materials).toContain('aria-label="자료 메뉴"');
    expect(materials).toMatch(/role="menuitemcheckbox"[\s\S]{0,200}className=\{`mat-pin/);
    expect(materials).toContain('<span className="tag" title="받아둠 — 연결이 없어도 열려요">받아둠</span>');
    expect(materials).toContain("'아직 보관된 개인 자료가 없어요.'");
    expect(read('e2e/account-boundary.e2e.mjs').match(/^test\('/gm)).toHaveLength(9);
    // ⑨ 문서 bfcache 복원(GUEST-STATIC-001 1단계) — 정적 화면에서 A의 흔적은 머리말 내 계정 단추(title = 프로필 이름)와 내 정보의 메일이다.
    expect(read('src/components/Layout.jsx')).toContain('title={profile?.display_name || user.email}');
    expect(read('src/views/MyPage.jsx')).toContain('{user.email}');
    // Playwright가 기본으로 bfcache를 끄는 인자 — 이 이름이 바뀌면 ⑨는 복원을 못 보고 양성 대조에서 멈춘다.
    expect(read('e2e/account-boundary.e2e.mjs')).toContain("const BF_ARGS = ['--disable-back-forward-cache'];");
  });
  it('③ 설치된 Next가 운영 빌드에도 window.next.router를 건다', () => {
    const instance = read('node_modules/next/dist/client/components/app-router-instance.js');
    expect(instance).toMatch(/if \(typeof window !== 'undefined' && window\.next\) \{\s*window\.next\.router = publicAppRouterInstance;/);
  });
  it('④ 필수 CI의 격리 서버(8878 · QA_BASE) 단계가 이 e2e를 돌린다', () => {
    const step = sliceBetween(read('.github/workflows/ci.yml'), 'QA_BASE=http://127.0.0.1:8878 node --test', '\n');
    expect(step).toContain('e2e/account-boundary.e2e.mjs');
  });
});
