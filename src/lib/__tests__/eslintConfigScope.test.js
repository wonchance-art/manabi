import { beforeAll, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

/**
 * 계약: ESLint 설정이 .jsx를 실제로 린트한다 (2026-10-07).
 * ESLint 9 flat config는 어떤 설정 객체의 `files`가 매치해야만 파일을 린트하고, 기본값은
 * **\/*.{js,mjs,cjs}뿐이다. FlatCompat.extends('next/core-web-vitals')는 files 없는 객체만
 * 내놓으므로, eslint.config.mjs의 `{ files: [... jsx ...] }` 항목이 빠지면 React UI 전량(.jsx
 * 270개)이 "File ignored because no matching configuration was supplied" 경고 한 줄로 조용히
 * 빠지고 `npm run lint`·CI lint는 초록인 채 거짓 보증을 낸다(실측: 그 상태로 오류 5건이 숨어 있었다).
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const REPRESENTATIVE_JSX = 'src/views/ViewerPage.jsx';

let eslint;
beforeAll(() => {
  eslint = new ESLint({ cwd: ROOT });
});

describe('ESLint 설정 범위 — .jsx 누락 회귀 차단', () => {
  it('대표 .jsx 파일에 설정이 해석된다(undefined = 조용한 스킵)', async () => {
    expect(await eslint.isPathIgnored(REPRESENTATIVE_JSX)).toBe(false);
    const config = await eslint.calculateConfigForFile(REPRESENTATIVE_JSX);
    expect(config).toBeDefined();
    expect(config.rules['react-hooks/rules-of-hooks']).toBeDefined();
    expect(config.rules['@next/next/no-html-link-for-pages']).toBeDefined();
  });

  it('.jsx와 .js가 같은 규칙·심각도를 받는다(심각도 임의 변경 금지)', async () => {
    const jsx = await eslint.calculateConfigForFile(REPRESENTATIVE_JSX);
    const js = await eslint.calculateConfigForFile('src/lib/reportError.js');
    expect(Object.keys(jsx.rules).sort()).toEqual(Object.keys(js.rules).sort());
    for (const [name, value] of Object.entries(js.rules)) {
      expect([name, jsx.rules[name][0]]).toEqual([name, value[0]]);
    }
  });

  it('.jsx 본문 위반이 실제로 보고된다(설정 해석만이 아니라 린트가 돈다)', async () => {
    const code = [
      "import { useState } from 'react';",
      'export default function Probe({ on }) {',
      '  if (on) { useState(0); }',
      '  return <div />;',
      '}',
      '',
    ].join('\n');
    const [result] = await eslint.lintText(code, { filePath: `${ROOT}src/views/__eslintScopeProbe__.jsx` });
    const ruleIds = result.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain('react-hooks/rules-of-hooks');
  });
});
