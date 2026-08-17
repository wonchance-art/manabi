function withExtraExamples(chapters, extra) {
  if (!extra) return chapters;
  return chapters.map((chapter) => {
    const chapterExtra = extra[chapter.slug];
    if (!chapterExtra) return chapter;
    return {
      ...chapter,
      sections: (chapter.sections || []).map((section, index) => {
        const additions = chapterExtra[index] || chapterExtra[String(index)];
        if (!additions?.length) return section;
        return {
          ...section,
          examples: [...(section.examples || []), ...additions],
        };
      }),
    };
  });
}

async function loadLevel(grammarImport, examplesImport) {
  const [grammar, examples] = await Promise.all([grammarImport(), examplesImport()]);
  return withExtraExamples(grammar.default, examples.default);
}

export const CHINESE_GRAMMAR_LOADERS = Object.freeze({
  OT: () => loadLevel(
    () => import('./grammar/ot.js'),
    () => import('./grammar/ot_examples.js'),
  ),
  H1: () => Promise.all([
    import('./grammar/h1.js'),
    import('./grammar/h1_examples.js'),
    import('./grammar/h1_pronunciation.js'),
    import('./grammar/scene_emergency.js'),
    import('./grammar/scene_travel.js'),
  ]).then(([grammar, examples, pronunciation, emergency, travel]) => [
    ...withExtraExamples(grammar.default, examples.default),
    ...pronunciation.default,
    ...emergency.default,
    ...travel.default.filter(chapter => chapter.level === 'H1'),
  ]),
  H2: () => Promise.all([
    import('./grammar/h2.js'),
    import('./grammar/h2_examples.js'),
    import('./grammar/ja_bridge.js'),
  ]).then(([grammar, examples, jaBridge]) => [
    ...withExtraExamples(grammar.default, examples.default),
    ...jaBridge.default,
  ]),
  H3: () => loadLevel(
    () => import('./grammar/h3.js'),
    () => import('./grammar/h3_examples.js'),
  ),
  H4: () => loadLevel(
    () => import('./grammar/h4.js'),
    () => import('./grammar/h4_examples.js'),
  ),
  H5: () => loadLevel(
    () => import('./grammar/h5.js'),
    () => import('./grammar/h5_examples.js'),
  ),
  H6: () => loadLevel(
    () => import('./grammar/h6.js'),
    () => import('./grammar/h6_examples.js'),
  ),
  LIFE: async () => [],
});

export { withExtraExamples };
