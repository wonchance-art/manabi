import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tokenizeZhLine } from '@/lib/server/tokenizeZh';
import { scriptVariantSurfaces, variantPieces } from '../scriptVariant.js';
import { verifiedScriptVariant } from '../wikisourceCanonical.js';
import { splitRuby } from '../splitRuby.js';
import { sliceBetween } from './helpers/sliceBetween';

// 번체로 읽기(LIT-SRC-WS-1, 오너 「권장대로」 2026-10-17 KST — 시안 B 「한 권 + 보기 전환」): 분석은 간체 한 번, 화면 글자만 번체.

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');
const book = (key) => JSON.parse(read(`src/content/literature/wikisource/${key}/chapters.json`));

/** analyzeText와 같은 모양의 json — 줄마다 id_<줄>_<n> 토큰, 줄 사이 개행 토큰. */
async function analyzed(rawText) {
  const json = { sequence: [], dictionary: {} };
  const lines = rawText.split('\n');
  for (const [index, line] of lines.entries()) {
    for (const [n, token] of (line ? await tokenizeZhLine(line) : []).entries()) {
      json.sequence.push(`id_${index}_${n}_1`);
      json.dictionary[`id_${index}_${n}_1`] = { text: token.text, furigana: token.furigana, pos: token.pos };
    }
    if (index < lines.length - 1) { json.sequence.push(`br_${index}_1`); json.dictionary[`br_${index}_1`] = { text: '\n', pos: '개행' }; }
  }
  return json;
}

describe('scriptVariantSurfaces — 토큰 자리마다 같은 길이의 번체 글자', () => {
  it('리포 중국어 세 편: 번체로 바꾼 화면 글자를 이으면 번체 사본과 같다(분석기 토큰 그대로)', async () => {
    for (const key of ['ws-zh-lu-xun_kong-yi-ji', 'ws-zh-lu-xun_gu-xiang', 'ws-zh-zhu-ziqing_bei-ying']) {
      for (const chapter of book(key).chapters) {
        const hant = chapter.metadata.scriptVariants['zh-hant'];
        const json = await analyzed(chapter.rawText);
        const surfaces = scriptVariantSurfaces(json, chapter.rawText, hant);
        expect(surfaces).toBeInstanceOf(Map);
        const shown = json.sequence.map((id) => (json.dictionary[id].pos === '개행' ? '\n' : surfaces.get(id) ?? json.dictionary[id].text)).join('');
        expect(shown).toBe(hant);
        expect(surfaces.size).toBeGreaterThan(0);
      }
    }
  });
  it('「镇」 자리는 「鎭」으로 보이고, 단어(token.text)는 간체 그대로', async () => {
    const raw = '鲁镇的酒店的格局，是和别处不同的';
    const hant = '魯鎭的酒店的格局，是和別處不同的';
    const json = await analyzed(raw);
    const surfaces = scriptVariantSurfaces(json, raw, hant);
    const id = json.sequence.find((tokenId) => json.dictionary[tokenId].text.includes('镇'));
    expect(surfaces.get(id)).toContain('鎭');
    expect(json.dictionary[id].text).toContain('镇');
    expect([...surfaces.values()]).not.toContain('的'); // 같은 글자는 바꾸지 않는다(맵에 넣지 않음)
  });
  it('어긋나면 하나도 바꾸지 않는다(fail-closed) — 길이·줄 수·토큰 자리', async () => {
    const raw = '鲁镇的酒店\n是和别处不同的';
    const hant = '魯鎭的酒店\n是和別處不同的';
    const json = await analyzed(raw);
    expect(scriptVariantSurfaces(json, raw, `${hant}。`)).toBeNull();
    expect(scriptVariantSurfaces(json, raw, '魯鎭的酒\n店是和別處不同的')).toBeNull();
    const tampered = { ...json, dictionary: { ...json.dictionary, [json.sequence[0]]: { text: '上海' } } };
    expect(scriptVariantSurfaces(tampered, raw, hant)).toBeNull();
    expect(scriptVariantSurfaces({ ...json, sequence: [...json.sequence, 'odd_9'], dictionary: { ...json.dictionary, odd_9: { text: '的' } } }, raw, hant)).toBeNull();
    expect(scriptVariantSurfaces(null, raw, hant)).toBeNull();
  });
  it('variantPieces — 병음 루비 조각도 글자마다 번체로(읽기는 그대로), 길이가 다르면 그대로', () => {
    const pieces = splitRuby('鲁镇', 'lǔ zhèn');
    expect(variantPieces(pieces, '魯鎭')).toEqual([{ kanji: '魯', reading: 'lǔ', pinyin: true }, { kanji: '鎭', reading: 'zhèn', pinyin: true }]);
    expect(variantPieces(pieces, undefined)).toBe(pieces);
    expect(variantPieces(pieces, '魯')).toBe(pieces);
  });
});

describe('verifiedScriptVariant — 정본 대조표의 번체 해시와 같을 때만', () => {
  const chapter = book('ws-zh-lu-xun_kong-yi-ji').chapters[0];
  const material = { raw_text: chapter.rawText, processed_json: { metadata: chapter.metadata } };
  it('정본 장 + 같은 번체 → 번체 글자', async () => {
    expect(await verifiedScriptVariant(material)).toBe(chapter.metadata.scriptVariants['zh-hant']);
  });
  it('번체를 고치거나 · 원문이 다르거나 · 위키문헌 장이 아니면 null', async () => {
    const hant = chapter.metadata.scriptVariants['zh-hant'];
    const edited = `${hant.slice(0, -1)}吧`;
    expect(await verifiedScriptVariant({ ...material, processed_json: { metadata: { ...chapter.metadata, scriptVariants: { 'zh-hant': edited } } } })).toBeNull();
    expect(await verifiedScriptVariant({ ...material, raw_text: `${chapter.rawText.slice(0, -1)}吧` })).toBeNull();
    expect(await verifiedScriptVariant({ ...material, processed_json: { metadata: { ...chapter.metadata, literature: { provider: 'aozora' } } } })).toBeNull();
  });
});

describe('배선 — 뷰어 · 설정', () => {
  it('뷰어: 대조 통과한 번체 사본 + 글자 모양이 번체일 때만 화면 글자를 바꾼다(data-text·단어 카드는 간체)', () => {
    const page = read('src/views/ViewerPage.jsx');
    expect(page).toContain("const zhHant = useScriptVariant(material);");
    expect(page).toContain("zhGrid && zhHant && settings.zhScript === 'hant'");
    const token = sliceBetween(page, 'const shownText = scriptSurfaces?.get(tokenId) ?? token.text;', '// 대화 자료');
    expect(token).toContain('<ZhText text={shownText} />'); // 분석 실패 칸
    expect(token).toContain('variantText={scriptSurfaces?.get(tokenId)}'); // 낱말 칸은 ReaderToken(memo)이 그린다
    expect(token).not.toContain('<ZhText text={token.text} />');
    const view = read('src/components/viewer/ReaderToken.jsx');
    expect(view).toContain('data-text={token.text}');
    expect(view).toContain('const shownText = variantText ?? token.text;');
    expect(view).toContain('variantPieces(rubySegments, variantText)');
    expect(view).not.toContain('<ZhText text={token.text} />');
    expect(page).toContain('zhScriptAvailable={!!zhHant}');
  });
  it('설정: 「글자 모양 간체 | 번체」는 번체 사본이 있는 중국어 책에서만', () => {
    const settings = read('src/components/viewer/ViewerSettings.jsx');
    expect(settings).toContain("language==='Chinese'&&zhScriptAvailable&&<Choices label=\"글자 모양\"");
    expect(settings).toContain("[['hans','간체'],['hant','번체']]");
  });
});
