import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { compareImages, assertQuality } from '../e2e/visual-quality.mjs';

const picture = (offset = 0, width = 100) => {
  const image = new PNG({ width, height: 60 });image.data.fill(255);
  for (let y = 10; y < 40; y++) for (let x = 10 + offset; x < 70 + offset; x++) {
    const i = (y * width + x) * 4;image.data[i] = image.data[i + 1] = image.data[i + 2] = 25;
  }
  return PNG.sync.write(image);
};
describe('visual gate detects regressions instead of updating expectations', () => {
  it('fails a one-pixel layout shift, clipping and color changes', () => {
    expect(compareImages(picture(), picture()).passed).toBe(true);
    expect(compareImages(picture(), picture(1)).passed).toBe(false);
    expect(compareImages(picture(), picture(0, 99)).reason).toBe('dimensions');
    const changed = PNG.sync.read(picture());changed.data.fill(255);
    expect(compareImages(picture(), PNG.sync.write(changed)).passed).toBe(false);
  });
  it('does not count missing/unstable/inaccessible evidence as success', () => {
    const row = {name:'card',stable:true,comparison:{passed:true},a11y:{violations:[]}};
    expect(() => assertQuality({visual:[row]}, ['card'])).not.toThrow();
    expect(() => assertQuality({}, ['card'])).toThrow('missing');
    for (const patch of [{stable:false}, {comparison:{passed:false,reason:'missing_reviewed_baseline'}}, {a11y:{violations:[{id:'button-name'}]}}]) {
      expect(() => assertQuality({visual:[{...row,...patch}]}, ['card'])).toThrow('visual_quality_failed');
    }
  });
});
