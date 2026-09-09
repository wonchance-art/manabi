import { describe, it, expect } from 'vitest';
import { getParagraphs } from '../useReanalyze';
import { newComposerDraft, composerRow, composerTitle, normalizeSourceUrl, validateComposer,
  prepareComposerFile, safeAssetPath, createComposerSave, saveComposerOnce, SOURCE_BUCKET, shouldReadComposerOriginal } from '../materialComposer';

const owner = '00000000-0000-4000-8000-000000000001';
const draft = () => newComposerDraft('11111111-1111-4111-8111-111111111111');
const original = { name: 'My reading.pdf', kind: 'pdf', type: 'application/pdf', size: 20, hash: 'a'.repeat(64), blob: new Blob(['%PDF-1.4 test source']) };

function backend() {
  const rows = [], objects = [], writes = [];
  let loseReply = false, failUpload = false, failRead = false;
  const client = {
    storage: { from(bucket) {
      expect(bucket).toBe(SOURCE_BUCKET);
      return {
        async list(folder) { return { data: objects.filter(item => item.folder === folder) }; },
        async upload(path, blob, options) {
          expect(options.upsert).toBe(false);
          if (failUpload) return { error: new Error('upload failed') };
          const parts = path.split('/'), name = parts.pop();
          objects.push({ folder: parts.join('/'), name, metadata: { size: original.size }, blob });
          return { data: { path } };
        },
      };
    } },
    from() {
      let payload, filters = [];
      const chain = { eq(k,v) { filters.push([k,v]); return chain; }, select() { return chain; }, limit() { return chain; },
        insert(value) { payload = value[0]; return chain; },
        then(resolve,reject) { return Promise.resolve().then(() => {
          if (payload) {
            const exists = rows.some(row => row.owner_id === payload.owner_id && row.processed_json.metadata.importAttempt === payload.processed_json.metadata.importAttempt);
            if (exists) return { error: { code: '23505' } };
            const row = { ...payload, id: rows.length + 1 }; rows.push(row); writes.push(row);
            if (loseReply) { loseReply = false; throw new Error('lost reply'); }
            return { data: [{ id: row.id }] };
          }
          if (failRead) return { error: new Error('read failed') };
          return { data: rows.filter(row => filters.every(([key,value]) => (key.includes('importAttempt') ? row.processed_json.metadata.importAttempt : row[key]) === value)).map(row => ({ id: row.id })) };
        }).then(resolve,reject); },
      }; return chain;
    },
  };
  return { client, rows, objects, writes, lose: () => { loseReply = true; }, failUpload: () => { failUpload = true; }, failRead: () => { failRead = true; } };
}

describe('unified private material', () => {
  it('keeps partial analysis line indices anchored to the exact authored body', () => {
    const body = `${'Bonjour. '.repeat(100)}\n\nDeuxième paragraphe.\nUne autre ligne.`;
    const paragraphs = getParagraphs(body, true);
    expect(paragraphs.map(part => part.lineIndices)).toEqual([[0], [2, 3]]);
  });
  it('allows body-only, file-only, link-only and mixed writing without classification or automatic analysis', () => {
    for (const value of [{ body: 'Bonjour\n\n  exact spacing.' }, { files: [original] }, { links: ['https://example.org/read'] }, { body: '내가 쓴 설명', files: [original], links: ['https://example.org/'] }]) {
      const d = { ...draft(), ...value };
      const row = composerRow(owner, d);
      expect(row.raw_text).toBe(d.body);
      expect(row).toMatchObject({ owner_id: owner, visibility: 'private', processed_json: { status: 'saved', metadata: { language: null } } });
      expect(row.direction).toBeUndefined();
      expect(JSON.stringify(row)).not.toContain('"blob"');
    }
  });
  it('keeps an authored title and body when sources are added; title fallback is not a destructive field mutation', () => {
    const d = { ...draft(), title: '내가 정한 제목', body: '나의 기록', files: [original] };
    expect(composerTitle(d)).toBe('내가 정한 제목'); expect(composerRow(owner, d).raw_text).toBe('나의 기록');
    expect(composerTitle({ ...d, title: '' })).toBe('나의 기록'); expect(d.title).toBe('내가 정한 제목');
    expect(composerTitle({ ...draft(), files: [original] })).toBe('My reading');
  });
  it('keeps French/English language choices and leaves uncertain language unspecified', () => {
    for (const language of ['French','English','Japanese','Chinese']) expect(composerRow(owner, { ...draft(), body:'text', language }).processed_json.metadata.language).toBe(language);
    expect(composerRow(owner, { ...draft(), body:'text', language:'Korean' }).processed_json.metadata.language).toBeNull();
  });
  it('preserves review-to-source focus while file-only and unclassified items stay in original reading', () => {
    const material = composerRow(owner, { ...draft(), body:'Bonjour', language:'French' });
    expect(shouldReadComposerOriginal(material, new URLSearchParams())).toBe(true);
    expect(shouldReadComposerOriginal(material, new URLSearchParams('study=1'))).toBe(false);
    expect(shouldReadComposerOriginal(material, new URLSearchParams('sourceToken=id_0_0&sourceText=Bonjour'))).toBe(false);
    expect(shouldReadComposerOriginal({ ...material, raw_text:'' }, new URLSearchParams('study=1'))).toBe(true);
    expect(shouldReadComposerOriginal({ raw_text:'legacy' }, new URLSearchParams())).toBe(false);
  });
  it('rejects empty, oversized and unsupported inputs', async () => {
    expect(() => validateComposer(draft())).toThrow();
    expect(() => validateComposer({ ...draft(), body: 'x'.repeat(200001) })).toThrow('20만');
    expect(() => validateComposer({ ...draft(), files: Array(6).fill(original) })).toThrow('5개');
    await expect(prepareComposerFile(new File(['bad'], 'bad.pdf'))).rejects.toThrow('형식');
    await expect(prepareComposerFile(new File(['data'], 'bad.html'))).rejects.toThrow('PDF 또는');
  });
  it('detects original file type and hashes bytes, ignoring spoofed MIME', async () => {
    const file = new File(['%PDF-1.4\nfixture'], 'file.pdf', { type: 'text/html' });
    const result = await prepareComposerFile(file);
    expect(result).toMatchObject({ kind: 'pdf', type: 'application/pdf', blob: file });
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect((await prepareComposerFile(new File(['%PDF-1.4\nfixture'], 'renamed.pdf'))).hash).toBe(result.hash);
  });
  it('rejects executable/data/credential URLs and keeps valid source paths', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', 'https://me:pass@example.org/', '/relative']) expect(() => normalizeSourceUrl(url)).toThrow();
    expect(normalizeSourceUrl(' https://example.org/a?q=2#part ')).toBe('https://example.org/a?q=2#part');
  });
  it('only signs exact owner/attempt/hash paths, never paths from another account', () => {
    const save = createComposerSave(owner, { ...draft(), files:[original] });
    const row = save.attempt.row, asset = row.processed_json.metadata.composer.assets[0];
    expect(safeAssetPath(row, asset)).toBe(asset.path);
    expect(safeAssetPath({ ...row, owner_id:'another-owner' }, asset)).toBeNull();
    expect(safeAssetPath(row, { ...asset, path:'../other.pdf' })).toBeNull();
    const unsafe = { ...row, processed_json: { metadata: { importAttempt: '../other-owner' } } };
    expect(safeAssetPath(unsafe, { ...asset, path: `${owner}/../other-owner/${asset.hash}.pdf` })).toBeNull();
  });
});

describe('durable original then one material', () => {
  it('deduplicates rapid submissions and saves a file-only row without analysis', async () => {
    const db = backend(), save = createComposerSave(owner, { ...draft(), files:[original] });
    const result = await Promise.all([saveComposerOnce(db.client, save), saveComposerOnce(db.client, save)]);
    expect(result[0].id).toBe(result[1].id); expect(db.writes).toHaveLength(1); expect(db.objects).toHaveLength(1);
    expect(db.rows[0].raw_text).toBe(''); expect(db.rows[0].processed_json.status).toBe('saved');
  });
  it('recovers after a lost insert response and browser refresh without uploading or inserting twice', async () => {
    const db = backend(), d = { ...draft(), files:[original], body:'내 문장' }; db.lose();
    await expect(saveComposerOnce(db.client, createComposerSave(owner,d))).rejects.toThrow('lost reply');
    const record = await saveComposerOnce(db.client, createComposerSave(owner,d));
    expect(record.id).toBe(1); expect(db.objects).toHaveLength(1); expect(db.writes).toHaveLength(1);
  });
  it('does not create a broken source row if file upload fails', async () => {
    const db = backend(); db.failUpload();
    await expect(saveComposerOnce(db.client, createComposerSave(owner,{ ...draft(),files:[original] }))).rejects.toThrow('upload failed');
    expect(db.rows).toHaveLength(0);
  });
  it('does not upload or insert when prior-save reconciliation fails', async () => {
    const db = backend(); db.failRead();
    await expect(saveComposerOnce(db.client, createComposerSave(owner,{ ...draft(),files:[original] }))).rejects.toThrow('read failed');
    expect(db.rows).toHaveLength(0); expect(db.objects).toHaveLength(0);
  });
  it('resumes an interrupted upload using the immutable original path', async () => {
    const db = backend(), d = { ...draft(), files:[original] };
    db.objects.push({ folder:`${owner}/${d.id}`, name:`${original.hash}.pdf`, metadata:{size:original.size} });
    await saveComposerOnce(db.client,createComposerSave(owner,d));
    expect(db.objects).toHaveLength(1); expect(db.rows).toHaveLength(1);
  });
});
