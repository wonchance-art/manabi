import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseChapters,
  runCurriculumLint,
  scanDrillDuplicates,
} from '../../../scripts/lint-curriculum.mjs';

describe('P11 커리큘럼 자동 게이트 (원칙 v1 §5)', () => {
  it('fr A1~A2는 order 유일·연속과 prerequisites 실존·비순환을 강제로 통과한다', async () => {
    const { errors } = await runCurriculumLint();
    expect(errors).toEqual([]);
  }, 30000);

  it('single quote·quoted key·숫자 구분자·property 재배치를 파싱한다', () => {
    const chapters = parseChapters(`
      {
        'slug': 'a1-mutated',
        prerequisites: ['a1-before'],
        order: 1_000,
        level: 'A1',
      },
    `, 'mutation.js');
    expect(chapters).toEqual([expect.objectContaining({
      slug: 'a1-mutated',
      level: 'A1',
      order: 1000,
      prerequisites: ['a1-before'],
    })]);
  });

  it('드릴 parser mutation에서도 중복을 검출한다', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'manabi-curriculum-mutation-'));
    const grammarDir = path.join(root, 'src/content/french/grammar');
    await mkdir(grammarDir, { recursive: true });
    await writeFile(path.join(grammarDir, 'a1.js'), `
      export default [{
        'slug': 'a1-mutated',
        level: 'A1',
        drills:
        [
          { answer: 'Même phrase.', meta: { source: 'fixture' }, type: 'choice', id: 'd1' },
          { id: 'd2', choices: ['x'], type: 'choice', answer: 'Même phrase.' },
        ],
      }];
    `);
    try {
      const errors = await scanDrillDuplicates({ repoRoot: root, trackNames: ['french'] });
      expect(errors).toContain('french 드릴 중복(챕터 내): a1-mutated:d2 — "même phrase."');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('한 트랙 scanner 예외는 hard fail하고 뒤 트랙 검사를 계속한다', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'manabi-curriculum-fail-closed-'));
    const grammarDir = path.join(root, 'src/content/english/grammar');
    await mkdir(grammarDir, { recursive: true });
    await writeFile(path.join(grammarDir, 'a1.js'), `
      export default [{
        slug: "a1-after-error",
        drills: [
          { id: "d1", type: "choice", answer: "same" },
          { id: "d2", type: "choice", answer: "same" },
        ],
      }];
    `);
    try {
      const errors = await scanDrillDuplicates({ repoRoot: root, trackNames: ['missing', 'english'] });
      expect(errors.some((error) => error.startsWith('드릴 비중복 게이트 실패 [missing]:'))).toBe(true);
      expect(errors).toContain('english 드릴 중복(챕터 내): a1-after-error:d2 — "same"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
