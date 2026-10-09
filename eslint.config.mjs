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
