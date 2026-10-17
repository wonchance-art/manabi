import { FlatCompat } from '@eslint/eslintrc';
import { defineConfig, globalIgnores } from 'eslint/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default defineConfig([
  // ESLint 9 flat config는 어떤 설정 객체의 files가 매치해야만 파일을 린트한다.
  // 기본값은 **/*.{js,mjs,cjs}뿐이라, 이 항목이 없으면 .jsx(React UI 전량)가
  // "no matching configuration"으로 조용히 건너뛰어진다. eslintConfigScope.test.js가 지킨다.
  { files: ['**/*.{js,jsx,mjs,cjs}'] },
  ...compat.extends('next/core-web-vitals'),
  // 정의되지 않은 이름 — 화면 코드만(테스트 · world 제외). 꺼져 있던 동안 ReferenceError 3건이 lint 초록으로 숨어 있었다
  // (새 노트 만들기 · 「문단 골라 분석」 · 현황 약점 칸, 2026-10-17 KST 전수). Highlight = CSS Custom Highlight API 브라우저 전역.
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['**/__tests__/**', '**/*.test.{js,jsx}', 'src/components/world/**'],
    languageOptions: { globals: { Highlight: 'readonly' } },
    rules: { 'no-undef': 'error' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'public/pdf.worker.min.mjs',
    'src/components/world/cities/*.geo.js',
  ]),
]);
