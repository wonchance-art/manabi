import { describe, it, expect } from 'vitest';
import {
  getGrammarChapters as getJapaneseGrammar,
} from '../../content/japanese';
import {
  getGrammarChapters as getFrenchGrammar,
} from '../../content/french';
import {
  getGrammarChapters as getEnglishGrammar,
} from '../../content/english';
import {
  getGrammarChapters as getChineseGrammar,
} from '../../content/chinese';

describe('Level 1 Coverage Recount (with scene_emergency & scene_travel)', () => {
  const SCENE_KEYWORDS = {
    공항이동: /airport|station|train|express|platform|ticket|densha|ekisya|kyoutsuu|koudousho|sotsukabushou|anzen|nosori/i,
    숙소: /hotel|accommodation|room|check.?in|check.?out|towel|wifi|amenity|trouble|densha/i,
    식당상점: /restaurant|shop|store|order|menu|checkout|payment|allerg|exclude|konbini|izakaya|ramen|menzei|dining|food|supermarket/i,
    길긴급: /direction|address|street|hospital|emergency|injury|lost|illness|symptom|urgent|dokoka|atsui|danger|help|hospital|doctor|sick|accident|crime|police/i,
    기초문자: /alphabet|phonics|pronunciation|kana|kanji|pinyin|tone|accent|syllable|character|script|jinja|omikuji|hanzi|emergency|travel/i,
  };

  function classifyScene(title, slug, topic) {
    const fullText = `${title} ${slug} ${topic}`.toLowerCase();

    for (const [scene, regex] of Object.entries(SCENE_KEYWORDS)) {
      if (regex.test(fullText)) {
        return scene;
      }
    }
    return '기타';
  }

  function countExamples(lesson) {
    let count = 0;

    if (lesson.sections) {
      for (const section of lesson.sections) {
        if (Array.isArray(section.examples)) {
          count += section.examples.length;
        }
      }
    }

    return count;
  }

  it('일본어 N5 재측정 (scene_emergency 포함)', () => {
    const chapters = getJapaneseGrammar('N5');
    expect(chapters).toBeDefined();
    expect(Array.isArray(chapters)).toBe(true);

    const scenes = {
      공항이동: [],
      숙소: [],
      식당상점: [],
      길긴급: [],
      기초문자: [],
      기타: [],
    };

    let totalExamples = 0;

    for (const chapter of chapters) {
      const scene = classifyScene(
        chapter.title || '',
        chapter.slug || '',
        chapter.topic || ''
      );

      const exampleCount = countExamples(chapter);
      totalExamples += exampleCount;

      scenes[scene].push({
        slug: chapter.slug,
        examples: exampleCount,
      });
    }

    console.log('\n=== 일본어 N5 재측정 ===');
    console.log(`총 챕터: ${chapters.length}`);
    console.log(`총 문형: ${totalExamples}`);
    Object.entries(scenes).forEach(([scene, lessons]) => {
      if (lessons.length > 0) {
        const exCount = lessons.reduce((sum, l) => sum + l.examples, 0);
        console.log(`  ${scene}: ${lessons.length} / ${exCount}`);
        console.log(`    목록: ${lessons.map(l => l.slug).join(', ')}`);
      }
    });

    expect(chapters.length).toBeGreaterThan(0);
    expect(scenes.기타.length).toBeGreaterThan(0); // 문법 챕터들
  });

  it('프랑스어 A1 재측정', () => {
    const chapters = getFrenchGrammar('A1');
    expect(chapters).toBeDefined();
    expect(Array.isArray(chapters)).toBe(true);

    const scenes = {
      공항이동: [],
      숙소: [],
      식당상점: [],
      길긴급: [],
      기초문자: [],
      기타: [],
    };

    let totalExamples = 0;

    for (const chapter of chapters) {
      const scene = classifyScene(
        chapter.title || '',
        chapter.slug || '',
        chapter.topic || ''
      );

      const exampleCount = countExamples(chapter);
      totalExamples += exampleCount;

      scenes[scene].push({
        slug: chapter.slug,
        examples: exampleCount,
      });
    }

    console.log('\n=== 프랑스어 A1 재측정 ===');
    console.log(`총 챕터: ${chapters.length}`);
    console.log(`총 문형: ${totalExamples}`);
    Object.entries(scenes).forEach(([scene, lessons]) => {
      if (lessons.length > 0) {
        const exCount = lessons.reduce((sum, l) => sum + l.examples, 0);
        console.log(`  ${scene}: ${lessons.length} / ${exCount}`);
        console.log(`    목록: ${lessons.map(l => l.slug).join(', ')}`);
      }
    });

    expect(chapters.length).toBeGreaterThan(0);
  });

  it('영어 OT 재측정 (scene_travel 포함)', () => {
    const chapters = getEnglishGrammar('OT');
    expect(chapters).toBeDefined();
    expect(Array.isArray(chapters)).toBe(true);

    const scenes = {
      공항이동: [],
      숙소: [],
      식당상점: [],
      길긴급: [],
      기초문자: [],
      기타: [],
    };

    let totalExamples = 0;

    for (const chapter of chapters) {
      const scene = classifyScene(
        chapter.title || '',
        chapter.slug || '',
        chapter.topic || ''
      );

      const exampleCount = countExamples(chapter);
      totalExamples += exampleCount;

      scenes[scene].push({
        slug: chapter.slug,
        examples: exampleCount,
      });
    }

    console.log('\n=== 영어 OT 재측정 ===');
    console.log(`총 챕터: ${chapters.length}`);
    console.log(`총 문형: ${totalExamples}`);
    Object.entries(scenes).forEach(([scene, lessons]) => {
      if (lessons.length > 0) {
        const exCount = lessons.reduce((sum, l) => sum + l.examples, 0);
        console.log(`  ${scene}: ${lessons.length} / ${exCount}`);
        console.log(`    목록: ${lessons.map(l => l.slug).join(', ')}`);
      }
    });

    expect(chapters.length).toBeGreaterThan(0);
  });

  it('중국어 H1 재측정 (scene_emergency 포함)', () => {
    const chapters = getChineseGrammar('H1');
    expect(chapters).toBeDefined();
    expect(Array.isArray(chapters)).toBe(true);

    const scenes = {
      공항이동: [],
      숙소: [],
      식당상점: [],
      길긴급: [],
      기초문자: [],
      기타: [],
    };

    let totalExamples = 0;

    for (const chapter of chapters) {
      const scene = classifyScene(
        chapter.title || '',
        chapter.slug || '',
        chapter.topic || ''
      );

      const exampleCount = countExamples(chapter);
      totalExamples += exampleCount;

      scenes[scene].push({
        slug: chapter.slug,
        examples: exampleCount,
      });
    }

    console.log('\n=== 중국어 H1 재측정 ===');
    console.log(`총 챕터: ${chapters.length}`);
    console.log(`총 문형: ${totalExamples}`);
    Object.entries(scenes).forEach(([scene, lessons]) => {
      if (lessons.length > 0) {
        const exCount = lessons.reduce((sum, l) => sum + l.examples, 0);
        console.log(`  ${scene}: ${lessons.length} / ${exCount}`);
        console.log(`    목록: ${lessons.map(l => l.slug).join(', ')}`);
      }
    });

    expect(chapters.length).toBeGreaterThan(0);
  });
});
