const moduleDefault = module => module.default;

export const FRENCH_GRAMMAR_LOADERS = Object.freeze({
  A0: () => import('./grammar/a0.js').then(moduleDefault),
  A1: () => Promise.all([
    import('./grammar/a1.js'),
    import('./grammar/a1_expansion.js'),
    import('./grammar/a1_pronunciation.js'),
    import('./grammar/scene_emergency.js'),
    import('./grammar/scene_travel.js'),
    import('./grammar/a1_sandwich_pilot.js'),
  ]).then(([grammar, expansion, pronunciation, emergency, travel, sandwich]) => [
    ...grammar.default,
    ...expansion.default,
    ...pronunciation.default,
    ...emergency.default,
    ...travel.default.filter(chapter => chapter.level === 'A1'),
    ...sandwich.default,
  ]),
  A2: () => Promise.all([
    import('./grammar/a2.js'),
    import('./grammar/a2_scenes.js'),
  ]).then(([grammar, scenes]) => [...grammar.default, ...scenes.default]),
  B1: () => import('./grammar/b1.js').then(moduleDefault),
  B2: () => import('./grammar/b2.js').then(moduleDefault),
  C1: () => import('./grammar/c1.js').then(moduleDefault),
  C2: () => import('./grammar/c2.js').then(moduleDefault),
});
