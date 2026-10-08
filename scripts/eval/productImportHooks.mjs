// 제품 서버 모듈(src/lib/server/*)은 번들러 관례(확장자 없는 상대 import·JSON import)를 쓴다.
// eval 스크립트 프로세스에서만 Node가 풀 수 있게 하는 로더 훅 — import하는 것만으로 등록된다.
// 쓰는 곳: run-zh-sense-holdout.mjs · generate-zh-sense-candidates.mjs. 제품 모듈은 이 훅을 등록한 뒤 동적 import한다.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (err) {
      if (/^\.{1,2}\//.test(specifier) && !/\.(?:[cm]?js|json)$/.test(specifier)) return next(`${specifier}.js`, context);
      throw err;
    }
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
    }
    return next(url, context);
  },
});
