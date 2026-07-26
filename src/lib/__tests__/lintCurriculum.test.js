import { describe, expect, it } from 'vitest';
import { runCurriculumLint } from '../../../scripts/lint-curriculum.mjs';

describe('P11 커리큘럼 자동 게이트 (원칙 v1 §5)', () => {
  it('fr A1~A2는 order 유일·연속과 prerequisites 실존·비순환을 강제로 통과한다', async () => {
    const { errors } = await runCurriculumLint();
    expect(errors).toEqual([]);
  }, 30000);
});
