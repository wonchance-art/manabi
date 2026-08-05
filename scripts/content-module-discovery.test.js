import { describe, expect, it } from 'vitest';
import { discoverGrammarModules } from './content-module-discovery.mjs';

describe('grammar content module discovery', () => {
  it('includes expansion, pronunciation, and scene chapter arrays', async () => {
    const [french, english, chinese, japanese] = await Promise.all([
      discoverGrammarModules('french'),
      discoverGrammarModules('english'),
      discoverGrammarModules('chinese'),
      discoverGrammarModules('japanese'),
    ]);

    expect(french.map(module => module.file)).toEqual(expect.arrayContaining([
      'a1_expansion.js',
      'a1_pronunciation.js',
      'a1_sandwich_pilot.js',
      'a2_scenes.js',
      'scene_emergency.js',
      'scene_travel.js',
    ]));
    expect(english.map(module => module.file)).toEqual(expect.arrayContaining([
      'expansion.js',
      'scene_emergency.js',
      'scene_travel.js',
    ]));
    expect(chinese.map(module => module.file)).toEqual(expect.arrayContaining([
      'h1_pronunciation.js',
      'scene_emergency.js',
      'scene_travel.js',
    ]));
    expect(japanese.map(module => module.file)).toContain('scene_emergency.js');
  });

  it('excludes non-array example sidecars', async () => {
    const chinese = await discoverGrammarModules('chinese');
    expect(chinese.some(module => module.file.endsWith('_examples.js'))).toBe(false);
  });
});
