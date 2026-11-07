import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

// CI-CJK-FONTS-001(2026-11-07 KST): 러너 이미지에 중 · 일 시스템 글꼴이 없어(fc-list :lang=zh/ja 빈 결과) 조판 · 상자 e2e가 대체 글리프로 쟀다.
// 로컬 개발 컨테이너와 같은 묶음(Playwright install-deps 글꼴)을 e2e 잡이 빌드 · 실행 전에 깐다 — 한쪽만 바뀌면 기하 차이가 다른 모양으로 남는다.
const ROOT = path.resolve(__dirname, '../../..');
const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
const LOCAL_FONT_PACKAGES = ['fonts-ipafont-gothic', 'fonts-wqy-zenhei', 'fonts-freefont-ttf', 'fonts-liberation', 'fonts-noto-color-emoji',
  'fonts-tlwg-loma-otf', 'fonts-unifont', 'xfonts-cyrillic', 'xfonts-scalable'];

describe('CI e2e 잡의 CJK 시스템 글꼴', () => {
  const job = sliceBetween(ci, '- name: CJK 글꼴 설치(로컬과 같은 묶음)', '- name: 테스트 env로 빌드');
  it('로컬 컨테이너와 같은 글꼴 묶음을 깐다', () => {
    const pkgs = job.match(/pkgs="([^"]+)"/)?.[1].split(/\s+/) || [];
    expect(pkgs.sort()).toEqual([...LOCAL_FONT_PACKAGES].sort());
  });
  it('받은 .deb를 캐시하고, 깐 뒤 중 · 일 글꼴이 실제로 잡히는지 확인한다', () => {
    expect(ci).toMatch(/- name: CJK 글꼴 캐시\s+uses: actions\/cache@v4/);
    expect(job).toMatch(/sudo dpkg -i "\$cache"\/\*\.deb/);
    expect(job).toMatch(/test -n "\$\(fc-list :lang=zh family\)" && test -n "\$\(fc-list :lang=ja family\)"/);
  });
  it('e2e 실행 전에 있다', () => {
    expect(ci.indexOf('- name: CJK 글꼴 설치(로컬과 같은 묶음)')).toBeLessThan(ci.indexOf('- run: npm run e2e:typography'));
  });
});
