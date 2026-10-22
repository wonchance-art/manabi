import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { jaPlainMeaning, levelListData } from '../levelListData.js';
import { LEVEL_LIST_LANGS, compactLevelEntry, levelEntry, levelGroupsOf, levelWordKey, shortMeaning } from '../levelList.js';

// 계약: 레벨 단어 항목 중복 필드 생략 — 서버는 표제어와 같은 key · 짧은 뜻과 같은 fullMeaning을 빼고 보내고,
// 화면(LevelListPage)은 한 곳에서 levelGroupsOf로 되살린다. 값 손실 0, 전달 크기만 준다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const levels = Object.entries(LEVEL_LIST_LANGS).flatMap(([lang, conf]) => conf.levels.map((key) => [lang, key]));

describe('왕복 동치', () => {
  it('줄인 꼴 → 되살림 → 다시 줄임이 같은 값이고, 되살린 항목은 늘 key · fullMeaning을 가진다', async () => {
    for (const [lang, key] of levels) {
      const data = await levelListData(lang, 'vocab', key);
      for (const raw of data.groups.flatMap((g) => g.entries)) {
        const full = levelEntry(raw);
        expect(compactLevelEntry(full), `${lang} ${key} ${raw.word}`).toEqual(raw);
        expect(levelEntry(compactLevelEntry(full))).toEqual(full);
        expect(full.key).toBe(levelWordKey(full.word));
        expect(typeof full.fullMeaning).toBe('string');
        // JLPT는 표제어를 되풀이한 한자 괄호를 뗀 짧은 뜻(jaPlainMeaning — 시안 ⑳).
        expect(full.meaning).toBe(lang === 'japanese' ? jaPlainMeaning(shortMeaning(full.fullMeaning), full.word) : shortMeaning(full.fullMeaning));
      }
    }
  });

  it('다를 때만 남긴다 — key ≠ 표제어, fullMeaning ≠ 짧은 뜻', () => {
    const same = { key: '学习', word: '学习', reading: 'xuéxí', meaning: '공부하다', fullMeaning: '공부하다', pos: '동사', ex: null };
    expect(compactLevelEntry(same)).toEqual({ word: '学习', reading: 'xuéxí', meaning: '공부하다', pos: '동사', ex: null });
    const differ = { key: '食べる', word: '〜食べる', reading: 'たべる', meaning: '먹다', fullMeaning: '먹다 (식사 — 아침 · 점심 · 저녁 모두)', pos: '', ex: null };
    expect(compactLevelEntry(differ)).toEqual(differ);
    expect(levelEntry(compactLevelEntry(same))).toEqual(same);
    // 문형 · 한자 항목(뜻 칸 없음)은 손대지 않는다.
    expect(levelEntry({ key: 'p0', pattern: '〜ている', ko: '하고 있다' })).toEqual({ key: 'p0', pattern: '〜ている', ko: '하고 있다' });
    expect(levelEntry({ key: '学' })).toEqual({ key: '学' });
  });

  it('HSK 1 전 항목이 되살린 뒤 key와 fullMeaning을 가진다', async () => {
    const entries = levelGroupsOf((await levelListData('chinese', 'vocab', 'H1')).groups).flatMap((g) => g.entries);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.key, e.word).toBeTruthy();
      expect(typeof e.fullMeaning, e.word).toBe('string');
    }
  });
});

describe('전달 크기', () => {
  it('HSK 6 직렬화 길이가 준다(전 = 되살린 꼴, 후 = 서버가 보내는 꼴)', async () => {
    const data = await levelListData('chinese', 'vocab', 'H6');
    const after = JSON.stringify(data.groups).length;
    const before = JSON.stringify(levelGroupsOf(data.groups)).length;
    const entries = data.groups.flatMap((g) => g.entries);
    const omitted = entries.filter((e) => !('key' in e) && !('fullMeaning' in e)).length;
    expect(entries.length).toBeGreaterThan(1700);
    expect(omitted / entries.length).toBeGreaterThan(0.95);
    expect(after).toBeLessThan(before * 0.9);
  });
});

describe('읽는 곳', () => {
  it('서버 조립은 단어 항목을 줄이고, 화면은 진입점 한 곳에서 되살리며, 저장은 줄인 꼴에도 안전하다', () => {
    const data = read('src/lib/levelListData.js');
    expect(data.match(/compactLevelEntry\(\{ key, word: /g)).toHaveLength(2);
    const page = read('src/views/LevelListPage.jsx');
    expect(page).toContain('export default function LevelListPage({ lang, kind, levelKey, groups: rawGroups }) {');
    expect(page).toContain('const groups = useMemo(() => levelGroupsOf(rawGroups), [rawGroups]);');
    expect(page.match(/rawGroups/g)).toHaveLength(3);
    expect(page).toContain('meaning: (entry.fullMeaning ?? entry.meaning).slice(0, 2000)');
  });
});
