import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { compareImages, assertQuality, sha256 } from '../e2e/visual-quality.mjs';
import { approveVisual } from './qa-visual-approve.mjs';

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
  it('requires the reviewed pixels and blocks approval in CI or after accessibility failure', () => {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'visual-approval-'));
    const file=path.join(dir,'card.json'),destination=path.join(dir,'approved');
    const bytes=picture(),hash=sha256(bytes),key='linux-x64-chromium-149.0.7827.55';
    const row={name:'card',key,sha256:hash,stable:true,a11y:{violations:[]}};
    fs.writeFileSync(path.join(dir,'card.png'),bytes);
    fs.writeFileSync(file,JSON.stringify(row));
    try {
      vi.stubEnv('CI','');
      expect(()=>approveVisual(file,'0'.repeat(64),'Inspected',destination)).toThrow('image_changed_since_review');
      fs.writeFileSync(file,JSON.stringify({...row,a11y:{violations:[{id:'button-name'}]}}));
      expect(()=>approveVisual(file,hash,'Inspected',destination)).toThrow('cannot_approve');
      fs.writeFileSync(file,JSON.stringify(row));
      vi.stubEnv('CI','true');
      expect(()=>approveVisual(file,hash,'Inspected',destination)).toThrow('ci_cannot_approve');
      expect(fs.existsSync(destination)).toBe(false);
      vi.stubEnv('CI','');
      approveVisual(file,hash,'Inspected',destination);
      expect(sha256(fs.readFileSync(path.join(destination,key,'card.png')))).toBe(hash);
    } finally { vi.unstubAllEnvs();fs.rmSync(dir,{recursive:true,force:true}); }
  });
});
