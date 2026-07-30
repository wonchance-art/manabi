const moduleDefault = module => module.default;

export const JAPANESE_GRAMMAR_LOADERS = Object.freeze({
  OT: () => import('./grammar/ot.js').then(moduleDefault),
  N5: () => Promise.all([
    import('./grammar/n5.js'),
    import('./grammar/scene_emergency.js'),
  ]).then(([grammar, emergency]) => [...grammar.default, ...emergency.default]),
  N4: () => import('./grammar/n4.js').then(moduleDefault),
  N3: () => import('./grammar/n3.js').then(moduleDefault),
  N2: () => import('./grammar/n2.js').then(moduleDefault),
  N1: () => import('./grammar/n1.js').then(moduleDefault),
});
