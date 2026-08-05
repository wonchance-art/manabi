import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config.mjs';

describe('kuromoji output file tracing', () => {
  it('tokenizer를 쓰는 두 Node route에 같은 dict glob을 포함한다', () => {
    const includes = nextConfig.outputFileTracingIncludes;
    const dictGlob = './node_modules/kuromoji/dict/**/*';

    expect(includes['/api/analyze']).toContain(dictGlob);
    expect(includes['/api/admin/backfill-base-form']).toContain(dictGlob);
  });
});
