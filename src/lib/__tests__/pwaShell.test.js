import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 계약: PWA-SHELL-001 — 휴대폰(iOS Safari · 안드로이드 Chrome, 브라우저 탭 · 설치 앱) 앱 셸.
 * 점검 표 · 근거 · 실측: 이 PR 본문(pwa-shell-audit). 브랜드 값(이름 · 색 · 아이콘)은 brandAssets.test.js가 따로 본다.
 * 계약 = 배선 보증(ui-conventions §5). 노치 · 홈 막대 · 길게 누르기 실제 모습은 실기(iOS) 확인 몫이다.
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const manifest = () => JSON.parse(read('public/manifest.webmanifest'));

describe('PWA-SHELL-001 ① manifest — 설치 앱 정체성', () => {
  it('id는 지금 계산값(start_url)과 같은 /home으로 못 박는다 — start_url을 옮겨도 이미 설치한 앱이 「다른 앱」이 되지 않게', () => {
    const m = manifest();
    // id를 처음 적을 때 지금 계산값과 다르면 설치한 사람의 앱이 갈린다(Chrome Page.getAppId 실측 recommendedId "/home").
    expect(m.id).toBe('/home');
    expect(m.start_url).toBe('/home');
  });

  it('scope는 사이트 전체 — 교재 · 서재 · 뷰어 어디로 가도 설치 앱 창 안에 남는다', () => {
    const m = manifest();
    expect(m.scope).toBe('/');
    expect(m.start_url.startsWith(m.scope)).toBe(true);
  });

  it('표시 형식 standalone · 언어 ko', () => {
    const m = manifest();
    expect(m.display).toBe('standalone');
    expect(m.lang).toBe('ko');
    expect(m.dir).toBe('ltr');
  });
});
