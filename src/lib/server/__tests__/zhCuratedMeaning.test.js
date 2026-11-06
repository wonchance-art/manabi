// 중국어 빈 뜻 예방(DATA-TUNE-001 후속) — 교재 표제어 폴백 계약.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  ZH_CURATED_VOCAB_FILE_COUNT, zhPinyinKey, buildZhCuratedIndex, loadZhCuratedIndex, pickZhCuratedMeaning,
} from '../zhCuratedMeaning.js';

const fixture = buildZhCuratedIndex([{ default: { themes: [{ words: [
  { zh: '不得了', pinyin: 'bùdéliǎo', ko: '큰일이다', pos: '형용사' },
  { zh: '教', pinyin: 'jiāo', ko: '가르치다', pos: '동사' },
  { zh: '教', pinyin: 'jiào', ko: '가르침', pos: '명사' },
  { zh: '用', pinyin: 'yòng', ko: '쓰다', pos: '동사' },
  { zh: '计划', pinyin: 'jìhuà', ko: '계획하다', pos: '동사' },
  { zh: '计划', pinyin: 'jìhuà', ko: '계획', pos: '명사' },
] }] } }]);

describe('교재 표제어 목록', () => {
  it('vocab 폴더의 파일을 모두 읽는다 — 새 세트가 빠지지 않게', () => {
    const files = fs.readdirSync(new URL('../../../content/chinese/vocab/', import.meta.url)).filter((f) => f.endsWith('.js'));
    expect(ZH_CURATED_VOCAB_FILE_COUNT).toBe(files.length);
    const src = fs.readFileSync(new URL('../zhCuratedMeaning.js', import.meta.url), 'utf8');
    for (const f of files) expect(src).toContain(`content/chinese/vocab/${f.replace(/\.js$/, '')}'`);
  });
});

describe('zhPinyinKey', () => {
  it('공백 · 아포스트로피를 걷고, tones=false면 성조도 걷는다', () => {
    expect(zhPinyinKey('jīng cháng')).toBe('jīngcháng');
    expect(zhPinyinKey("Xī'ān", { tones: false })).toBe('xian');
    expect(zhPinyinKey('bú jiàn de', { tones: false })).toBe(zhPinyinKey('bùjiànde', { tones: false }));
  });
});

describe('pickZhCuratedMeaning', () => {
  it('두 글자 이상 — 성조를 뺀 병음이 같으면 받는다(不 변조 통과), 문맥 품사가 맞는 항목 우선', () => {
    expect(pickZhCuratedMeaning(fixture, { text: '不得了', reading: 'bù dé liǎo', pos: '관용구' })).toBe('큰일이다');
    expect(pickZhCuratedMeaning(fixture, { text: '计划', reading: 'jì huà', pos: '명사' })).toBe('계획');
    expect(pickZhCuratedMeaning(fixture, { text: '计划', reading: 'jì huà', pos: '동사' })).toBe('계획하다');
  });
  it('한 글자 — 성조와 품사가 모두 같아야 한다(다음자 · 전치사 쓰임은 빈칸)', () => {
    expect(pickZhCuratedMeaning(fixture, { text: '教', reading: 'jiāo', pos: '동사' })).toBe('가르치다');
    expect(pickZhCuratedMeaning(fixture, { text: '教', reading: 'jiào', pos: '동사' })).toBe('');
    expect(pickZhCuratedMeaning(fixture, { text: '用', reading: 'yòng', pos: '전치사' })).toBe('');
  });
  it('병음이 다르거나 · 병음이 없거나 · 한자가 아니거나 · 표제어 밖이면 빈칸', () => {
    expect(pickZhCuratedMeaning(fixture, { text: '计划', reading: 'jì hǔ', pos: '명사' })).toBe('');
    expect(pickZhCuratedMeaning(fixture, { text: '计划', reading: null, pos: '명사' })).toBe('');
    expect(pickZhCuratedMeaning(fixture, { text: '，', reading: '，', pos: '기호' })).toBe('');
    expect(pickZhCuratedMeaning(fixture, { text: '舰艇', reading: 'jiàn tǐng', pos: '명사' })).toBe('');
  });
  it('실제 교재 색인 — 2차 운영 실측 표본이 같은 판정을 받는다', async () => {
    const idx = await loadZhCuratedIndex();
    expect(idx.size).toBeGreaterThan(10000);
    expect(pickZhCuratedMeaning(idx, { text: '经常', reading: 'jīng cháng', pos: '부사' })).toBe('자주, 늘');
    expect(pickZhCuratedMeaning(idx, { text: '制服', reading: 'zhì fú', pos: '명사' })).toContain('제복');
    expect(pickZhCuratedMeaning(idx, { text: '用', reading: 'yòng', pos: '전치사' })).toBe('');
    expect(pickZhCuratedMeaning(idx, { text: '经', reading: 'jīng', pos: '명사' })).toBe('');
    expect(pickZhCuratedMeaning(idx, { text: '舰艇', reading: 'jiàn tǐng', pos: '명사' })).toBe('');
  });
});

describe('분석기 배선', () => {
  const core = fs.readFileSync(new URL('../analyzeCore.js', import.meta.url), 'utf8');
  it('공유 사전 뜻이 비었을 때만 폴백하고, 토큰에 출처를 남기며 사전 행에는 쓰지 않는다', () => {
    expect(core).toContain('const curatedMeaning = !dictMeaning && zhCurated');
    expect(core).toContain("...(curatedMeaning ? { meaning_src: 'curated' } : {}),");
    expect(core).toContain('const meaning = dictMeaning || curatedMeaning;');
    const mod = fs.readFileSync(new URL('../zhCuratedMeaning.js', import.meta.url), 'utf8');
    expect(mod).not.toMatch(/supabase|morpheme_dictionary\s*\.|\.upsert\(|\.update\(/);
  });
});
