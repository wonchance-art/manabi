const moduleDefault = module => module.default;
const publishExpansion = chapters => chapters.map(({ status, ...chapter }) => chapter);

async function loadExpandedLevel(baseImport, level) {
  const [base, expansion] = await Promise.all([
    baseImport(),
    import('./grammar/expansion.js'),
  ]);
  return [
    ...base.default,
    ...publishExpansion(expansion.default).filter(chapter => chapter.level === level),
  ];
}

export const ENGLISH_GRAMMAR_LOADERS = Object.freeze({
  OT: () => Promise.all([
    import('./grammar/ot.js'),
    import('./grammar/scene_emergency.js'),
    import('./grammar/scene_travel.js'),
  ]).then(([grammar, emergency, travel]) => [
    ...grammar.default,
    ...emergency.default,
    ...travel.default.filter(chapter => chapter.level === 'OT'),
  ]),
  A1: () => loadExpandedLevel(() => import('./grammar/a1.js'), 'A1'),
  A2: () => loadExpandedLevel(() => import('./grammar/a2.js'), 'A2'),
  B1: () => loadExpandedLevel(() => import('./grammar/b1.js'), 'B1'),
  B2: () => loadExpandedLevel(() => import('./grammar/b2.js'), 'B2'),
  C1: () => loadExpandedLevel(() => import('./grammar/c1.js'), 'C1'),
  C2: () => loadExpandedLevel(() => import('./grammar/c2.js'), 'C2'),
});
