import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { canonical, manuscriptContent, validateManuscript } from '../textbook/contract';

const root = 'src/content/textbookEditions/';
const previous = 'fdf070fa5123b18cc55f24c7', corrected = '8a8c1c1fd452773810abaf8c';
const load = id => JSON.parse(fs.readFileSync(`${root}${id}/bundle.json`, 'utf8'));
const before = load(previous), after = load(corrected);
const sha = value => createHash('sha256').update(value).digest('hex');

describe('mandatory message-title correction preserves learning contracts', () => {
  it('retains the old candidate and changes no passage, task, answer or input identity', () => {
    expect(sha(fs.readFileSync(`${root}${previous}/bundle.json`))).toBe('a03c8fec9a08073250f8017bf011f3c6ee4e8f60aa9470d10c5cf8592e00aa90');
    const content = structuredClone(manuscriptContent(after.manuscript));
    content.lessons[41].practice_pages[3].title = before.manuscript.lessons[41].practice_pages[3].title;
    expect(content).toEqual(manuscriptContent(before.manuscript));
    expect(validateManuscript(after.manuscript, before.manuscript)).toBeNull();
    expect(after.contentHash).toBe(sha(JSON.stringify(canonical(manuscriptContent(after.manuscript)))));
    expect(after.editionId).toBe(after.contentHash.slice(0, 24));
    const pages = structuredClone(after.pages);
    pages[294].title = before.pages[294].title;
    expect(pages).toEqual(before.pages);
  });

  it('preserves source anchors and media while synchronizing rendered navigation and page metadata', () => {
    const sourceIndex = structuredClone(before.sourceIndex);
    const oldTitle = before.manuscript.lessons[41].practice_pages[3].title;
    const newTitle = after.manuscript.lessons[41].practice_pages[3].title;
    for (const source of Object.values(sourceIndex)) source.text = source.text.replaceAll(oldTitle, newTitle);
    expect(after.sourceIndex).toEqual(sourceIndex);
    expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
    expect(after.assets['style.css']).toEqual(before.assets['style.css']);
    const html = fs.readFileSync(`${root}${corrected}/index.html`, 'utf8');
    const oldHtml = fs.readFileSync(`${root}${previous}/index.html`, 'utf8');
    expect(html.match(/(?:id|data-save|href)="[^"]+"/g).map(value => value.replaceAll(corrected, previous))).toEqual(oldHtml.match(/(?:id|data-save|href)="[^"]+"/g));
    expect(html.split(oldTitle)).toHaveLength(1);
    expect(html.split(newTitle)).toHaveLength(3);
    const app = fs.readFileSync(`${root}${corrected}/app.js`, 'utf8');
    const legacyPages = JSON.parse(app.match(/const editionPages=(\[[^\n]*\]);/)[1]);
    expect(legacyPages).toEqual(after.pages);
    for (const [file, asset] of Object.entries(after.assets)) expect(sha(fs.readFileSync(`${root}${corrected}/${file}`))).toBe(asset.sha256);
    const index = JSON.parse(fs.readFileSync(`${root}index.json`, 'utf8'));
    expect(index.current).toBe('7f572327dc67893e9453246c');
    expect(index.reviewCandidates).toEqual([corrected, previous, index.current]);
  });
});
