/**
 * 프랑스어 정본 활용형 전개 — fr 굴절 대응 (rfc-vocab-encounter §4.8).
 * 렘마타이저(열린 어휘 → 사전 의존)를 들이는 대신, 대조 대상이 폐집합(정본 표제어)이라는
 * 사실을 이용해 표제어 쪽에서 활용형을 미리 전개해 인덱스 키로 깐다 — 결정적·무의존·전량 핀 가능.
 *
 * 원칙:
 *  · 이 모듈은 "생성기"가 아니라 "대조기 재료"다 — 과잉 전개는 무해(안 쓰이는 키가 놀 뿐),
 *    누락은 만남 미기록(하한 — 무해). 정밀 철자보다 회수율이 우선이라 -eter류는 è형·중복형을
 *    둘 다 낸다(acheter→achète·achette 병출).
 *  · 어미 가족(suffix family): venir/tenir/prendre/mettre… 계열은 합성동사(obtenir·apprendre)가
 *    같은 꼬리로 활용하므로, 꼬리 하나의 저작으로 계열 전체를 접는다(최장 일치).
 *  · 여기서 못 접는 동사(-re·-oir 잔여)는 조용히 빈 배열 — 표제어 직대조는 §4.7이 이미 한다.
 */

// ── 활용 꼬리 저작(가족·불규칙) — base.endsWith(suffix)면 suffix를 각 꼬리로 치환 ──
// 형태: suffix → 치환 꼬리들(현재·반과거·미래/조건법 대표형·과거분사 성수·현재분사·접속법 대표형).
const VERB_FAMILIES = {
  // 최고빈도 완전 불규칙(suffix = 동사 전체)
  'être': ['suis', 'es', 'est', 'sommes', 'êtes', 'sont', 'étais', 'était', 'étions', 'étiez', 'étaient',
    'été', 'serai', 'seras', 'sera', 'serons', 'serez', 'seront', 'serais', 'serait', 'seraient',
    'sois', 'soit', 'soyons', 'soyez', 'soient', 'étant'],
  'avoir': ['ai', 'as', 'a', 'avons', 'avez', 'ont', 'avais', 'avait', 'avions', 'aviez', 'avaient',
    'eu', 'eue', 'eus', 'eues', 'aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront',
    'aurais', 'aurait', 'auraient', 'aie', 'aies', 'ait', 'ayons', 'ayez', 'aient', 'ayant'],
  'aller': ['vais', 'vas', 'va', 'allons', 'allez', 'vont', 'allais', 'allait', 'allions', 'alliez', 'allaient',
    'allé', 'allée', 'allés', 'allées', 'irai', 'iras', 'ira', 'irons', 'irez', 'iront',
    'irais', 'irait', 'iraient', 'aille', 'ailles', 'aillent', 'allant'],
  // 가족(합성동사 공유) — obtenir·prévenir·apprendre·permettre·satisfaire·reconnaître 등이 접힘
  'venir': ['viens', 'vient', 'venons', 'venez', 'viennent', 'venais', 'venait', 'venions', 'veniez', 'venaient',
    'venu', 'venue', 'venus', 'venues', 'viendrai', 'viendras', 'viendra', 'viendrons', 'viendrez', 'viendront',
    'viendrais', 'viendrait', 'vienne', 'viennes', 'venant'],
  'tenir': ['tiens', 'tient', 'tenons', 'tenez', 'tiennent', 'tenais', 'tenait', 'tenions', 'teniez', 'tenaient',
    'tenu', 'tenue', 'tenus', 'tenues', 'tiendrai', 'tiendra', 'tiendrons', 'tiendrez', 'tiendront',
    'tiendrais', 'tiendrait', 'tienne', 'tenant'],
  'prendre': ['prends', 'prend', 'prenons', 'prenez', 'prennent', 'prenais', 'prenait', 'prenions', 'preniez', 'prenaient',
    'pris', 'prise', 'prises', 'prendrai', 'prendra', 'prendrons', 'prendrez', 'prendront',
    'prendrais', 'prendrait', 'prenne', 'prenant'],
  'mettre': ['mets', 'met', 'mettons', 'mettez', 'mettent', 'mettais', 'mettait', 'mettions', 'mettiez', 'mettaient',
    'mis', 'mise', 'mises', 'mettrai', 'mettra', 'mettrons', 'mettrez', 'mettront', 'mettrais', 'mettrait', 'mette', 'mettant'],
  'dire': ['dis', 'dit', 'disons', 'dites', 'disent', 'disais', 'disait', 'disions', 'disiez', 'disaient',
    'dite', 'dits', 'dites', 'dirai', 'dira', 'dirons', 'direz', 'diront', 'dirais', 'dirait', 'dise', 'disant'],
  'faire': ['fais', 'fait', 'faisons', 'faites', 'font', 'faisais', 'faisait', 'faisions', 'faisiez', 'faisaient',
    'faite', 'faits', 'faites', 'ferai', 'feras', 'fera', 'ferons', 'ferez', 'feront',
    'ferais', 'ferait', 'feraient', 'fasse', 'fasses', 'fassent', 'faisant'],
  'connaître': ['connais', 'connaît', 'connaissons', 'connaissez', 'connaissent', 'connaissais', 'connaissait',
    'connaissions', 'connaissiez', 'connaissaient', 'connu', 'connue', 'connus', 'connues',
    'connaîtrai', 'connaîtra', 'connaîtrons', 'connaîtrez', 'connaîtront', 'connaisse', 'connaissant'],
  'naître': ['nais', 'naît', 'naissons', 'naissez', 'naissent', 'naissais', 'naissait', 'né', 'née', 'nés', 'nées',
    'naîtrai', 'naîtra', 'naisse', 'naissant'],
  'uire': ['uis', 'uit', 'uisons', 'uisez', 'uisent', 'uisais', 'uisait', 'uisions', 'uisiez', 'uisaient',
    'uite', 'uits', 'uites', 'uirai', 'uira', 'uirons', 'uirez', 'uiront', 'uirais', 'uirait', 'uise', 'uisant'],
  'courir': ['cours', 'court', 'courons', 'courez', 'courent', 'courais', 'courait', 'courions', 'couriez', 'couraient',
    'couru', 'courue', 'courus', 'courues', 'courrai', 'courra', 'courrons', 'courrez', 'courront', 'coure', 'courant'],
  'cueillir': ['cueille', 'cueilles', 'cueillons', 'cueillez', 'cueillent', 'cueillais', 'cueillait',
    'cueilli', 'cueillie', 'cueillis', 'cueillies', 'cueillerai', 'cueillera', 'cueillerons', 'cueillerez', 'cueilleront', 'cueillant'],
  'quérir': ['quiers', 'quiert', 'quérons', 'quérez', 'quièrent', 'quérais', 'quérait',
    'quis', 'quise', 'quises', 'querrai', 'querra', 'quière', 'quérant'],
  // partir형(단수에서 어간 끝 자음 탈락) — ressortir·endormir·ressentir도 같은 꼬리로 접힘
  'partir': ['pars', 'part', 'partons', 'partez', 'partent', 'partais', 'partait', 'partions', 'partiez', 'partaient',
    'parti', 'partie', 'partis', 'parties', 'partirai', 'partira', 'partirons', 'partirez', 'partiront', 'parte', 'partant'],
  'sortir': ['sors', 'sort', 'sortons', 'sortez', 'sortent', 'sortais', 'sortait', 'sortions', 'sortiez', 'sortaient',
    'sorti', 'sortie', 'sortis', 'sorties', 'sortirai', 'sortira', 'sortirons', 'sortirez', 'sortiront', 'sorte', 'sortant'],
  'dormir': ['dors', 'dort', 'dormons', 'dormez', 'dorment', 'dormais', 'dormait', 'dormions', 'dormiez', 'dormaient',
    'dormi', 'dormirai', 'dormira', 'dorme', 'dormant'],
  'servir': ['sers', 'sert', 'servons', 'servez', 'servent', 'servais', 'servait', 'servions', 'serviez', 'servaient',
    'servi', 'servie', 'servis', 'servies', 'servirai', 'servira', 'serve', 'servant'],
  'sentir': ['sens', 'sent', 'sentons', 'sentez', 'sentent', 'sentais', 'sentait', 'sentions', 'sentiez', 'sentaient',
    'senti', 'sentie', 'sentis', 'senties', 'sentirai', 'sentira', 'sente', 'sentant'],
  'mentir': ['mens', 'ment', 'mentons', 'mentez', 'mentent', 'mentais', 'mentait', 'menti', 'mentirai', 'mente', 'mentant'],
  // -vrir/-frir(현재는 -er형, 과거분사 -ert)
  'vrir': ['vre', 'vres', 'vrons', 'vrez', 'vrent', 'vrais', 'vrait', 'vrions', 'vriez', 'vraient',
    'vert', 'verte', 'verts', 'vertes', 'vrirai', 'vrira', 'vrirons', 'vrirez', 'vriront', 'vrant'],
  'frir': ['fre', 'fres', 'frons', 'frez', 'frent', 'frais', 'frait', 'frions', 'friez', 'fraient',
    'fert', 'ferte', 'ferts', 'fertes', 'frirai', 'frira', 'frirons', 'frirez', 'friront', 'frant'],
  // -oir 저작(가족 포함 — apercevoir·percevoir·concevoir는 cevoir로 접힘)
  'cevoir': ['çois', 'çoit', 'cevons', 'cevez', 'çoivent', 'cevais', 'cevait', 'cevions', 'ceviez', 'cevaient',
    'çu', 'çue', 'çus', 'çues', 'cevrai', 'cevra', 'cevrons', 'cevrez', 'cevront', 'çoive', 'cevant'],
  'voir': ['vois', 'voit', 'voyons', 'voyez', 'voient', 'voyais', 'voyait', 'voyions', 'voyiez', 'voyaient',
    'vu', 'vue', 'vus', 'vues', 'verrai', 'verras', 'verra', 'verrons', 'verrez', 'verront', 'verrais', 'verrait', 'voie', 'voyant'],
  'pouvoir': ['peux', 'peut', 'pouvons', 'pouvez', 'peuvent', 'pouvais', 'pouvait', 'pouvions', 'pouviez', 'pouvaient',
    'pu', 'pourrai', 'pourras', 'pourra', 'pourrons', 'pourrez', 'pourront', 'pourrais', 'pourrait', 'puisse', 'puissent', 'pouvant'],
  'vouloir': ['veux', 'veut', 'voulons', 'voulez', 'veulent', 'voulais', 'voulait', 'voulions', 'vouliez', 'voulaient',
    'voulu', 'voulue', 'voudrai', 'voudras', 'voudra', 'voudrons', 'voudrez', 'voudront', 'voudrais', 'voudrait', 'veuille', 'voulant'],
  'devoir': ['dois', 'doit', 'devons', 'devez', 'doivent', 'devais', 'devait', 'devions', 'deviez', 'devaient',
    'dû', 'due', 'dus', 'dues', 'devrai', 'devra', 'devrons', 'devrez', 'devront', 'devrais', 'devrait', 'doive', 'devant'],
  'savoir': ['sais', 'sait', 'savons', 'savez', 'savent', 'savais', 'savait', 'savions', 'saviez', 'savaient',
    'su', 'sue', 'sus', 'saurai', 'saura', 'saurons', 'saurez', 'sauront', 'saurais', 'saurait', 'sache', 'sachant'],
  'valoir': ['vaux', 'vaut', 'valons', 'valez', 'valent', 'valais', 'valait', 'valu', 'value', 'vaudrai', 'vaudra', 'vaille', 'valant'],
  'falloir': ['faut', 'fallait', 'fallu', 'faudra', 'faudrait', 'faille'],
  'pleuvoir': ['pleut', 'pleuvait', 'plu', 'pleuvra', 'pleuve'],
  'mouvoir': ['meus', 'meut', 'mouvons', 'mouvez', 'meuvent', 'mouvais', 'mouvait', 'mû', 'mue', 'mus', 'mues', 'mouvrai', 'mouvra', 'meuve', 'mouvant'],
  'asseoir': ['assieds', 'assied', 'asseyons', 'asseyez', 'asseyent', 'asseyais', 'assis', 'assise', 'assises', 'assiérai', 'asseyant'],
  // -re 잔여 불규칙(가족 겸용 — sourire·admettre류는 위 가족이, 아래는 자체 계열)
  'boire': ['bois', 'boit', 'buvons', 'buvez', 'boivent', 'buvais', 'buvait', 'bu', 'bue', 'bus', 'bues', 'boirai', 'boira', 'boive', 'buvant'],
  'lire': ['lis', 'lit', 'lisons', 'lisez', 'lisent', 'lisais', 'lisait', 'lu', 'lue', 'lus', 'lues', 'lirai', 'lira', 'lise', 'lisant'],
  'crire': ['cris', 'crit', 'crivons', 'crivez', 'crivent', 'crivais', 'crivait', 'crite', 'crits', 'crites', 'crirai', 'crira', 'crive', 'crivant'],
  'suivre': ['suis', 'suit', 'suivons', 'suivez', 'suivent', 'suivais', 'suivait', 'suivi', 'suivie', 'suivis', 'suivies', 'suivrai', 'suivra', 'suive', 'suivant'],
  'vivre': ['vis', 'vit', 'vivons', 'vivez', 'vivent', 'vivais', 'vivait', 'vécu', 'vécue', 'vécus', 'vécues', 'vivrai', 'vivra', 'vive', 'vivant'],
  'battre': ['bats', 'bat', 'battons', 'battez', 'battent', 'battais', 'battait', 'battu', 'battue', 'battus', 'battues', 'battrai', 'battra', 'batte', 'battant'],
  'plaire': ['plais', 'plaît', 'plaisons', 'plaisez', 'plaisent', 'plaisais', 'plaisait', 'plu', 'plairai', 'plaira', 'plaise', 'plaisant'],
  'rire': ['ris', 'rit', 'rions', 'riez', 'rient', 'riais', 'riait', 'ri', 'rirai', 'rira', 'rie', 'riant'],
  'clure': ['clus', 'clut', 'cluons', 'cluez', 'cluent', 'cluais', 'cluait', 'clue', 'clus', 'clues', 'clurai', 'clura', 'cluant'],
  'rompre': ['romps', 'rompt', 'rompons', 'rompez', 'rompent', 'rompais', 'rompait', 'rompu', 'rompue', 'rompus', 'rompues', 'romprai', 'rompra', 'rompe', 'rompant'],
  'indre': ['ins', 'int', 'ignons', 'ignez', 'ignent', 'ignais', 'ignait', 'inte', 'ints', 'intes', 'indrai', 'indra', 'indrons', 'indrez', 'indront', 'igne', 'ignant'],
  'traire': ['trais', 'trait', 'trayons', 'trayez', 'traient', 'trayais', 'trayait', 'traite', 'traits', 'traites', 'trairai', 'traira', 'traie', 'trayant'],
  'suffire': ['suffis', 'suffit', 'suffisons', 'suffisez', 'suffisent', 'suffisais', 'suffirai', 'suffira', 'suffise', 'suffisant'],
  'mourir': ['meurs', 'meurt', 'mourons', 'mourez', 'meurent', 'mourais', 'mourait', 'mort', 'morte', 'morts', 'mortes', 'mourrai', 'mourra', 'meure', 'mourant'],
  'fuir': ['fuis', 'fuit', 'fuyons', 'fuyez', 'fuient', 'fuyais', 'fuyait', 'fui', 'fuie', 'fuis', 'fuies', 'fuirai', 'fuira', 'fuie', 'fuyant'],
};
// 최장 일치 우선 — 'reconnaître'가 'naître'보다 'connaître'로 접히게.
const FAMILY_SUFFIXES = Object.keys(VERB_FAMILIES).sort((a, b) => b.length - a.length);

// ── 규칙 패러다임 ──
function erForms(inf) {
  const stem = inf.slice(0, -2);
  // -cer/-ger 연음 보정(a·o 앞): commencer→commençons, manger→mangeons
  const soft = (ending) => {
    if (/^[aoâ]/.test(ending)) {
      if (stem.endsWith('c')) return `${stem.slice(0, -1)}ç${ending}`;
      if (stem.endsWith('g')) return `${stem}e${ending}`;
    }
    return stem + ending;
  };
  // 묵음 e 계열(lever→lève)·-eler/-eter(appeler→appelle) — 대조기라 è형·중복형을 병출한다.
  const graves = [];
  const m = stem.match(/^(.*)e([^aeiouéèêëy])$/);
  if (m) graves.push(`${m[1]}è${m[2]}`);
  const ac = stem.match(/^(.*)é([^aeiouéèêëy]+)$/); // préférer→préfère(현재형만)
  if (ac) graves.push(`${ac[1]}è${ac[2]}`);
  if (inf.endsWith('eler') || inf.endsWith('eter')) graves.push(stem + stem.slice(-1));
  if (/[aou]yer$/.test(inf)) graves.push(`${stem.slice(0, -1)}i`); // payer→paie

  const out = [];
  for (const sg of [stem, ...graves]) out.push(`${sg}e`, `${sg}es`, `${sg}ent`);
  out.push(soft('ons'), `${stem}ez`, `${stem}iez`, soft('ions'));
  out.push(soft('ais'), soft('ait'), soft('aient'));
  out.push(`${stem}é`, `${stem}ée`, `${stem}és`, `${stem}ées`, soft('ant'));
  // 미래·조건법 — 어간형이 è·중복형이면 그 형으로도(achèterai·appellerai), 기본은 부정사 어간
  const futStems = [inf, ...(m ? [`${m[1]}è${m[2]}er`] : []),
    ...(inf.endsWith('eler') || inf.endsWith('eter') ? [stem + stem.slice(-1) + 'er'] : [])];
  for (const fs of futStems) {
    for (const e of ['ai', 'as', 'a', 'ons', 'ez', 'ont', 'ais', 'ait', 'ions', 'aient']) out.push(fs + e);
  }
  return out;
}

function irForms(inf) { // finir형 기본값 — partir형·-vrir형은 가족이 먼저 접는다
  const stem = inf.slice(0, -2);
  const out = [`${stem}is`, `${stem}it`, `${stem}issons`, `${stem}issez`, `${stem}issent`,
    `${stem}issais`, `${stem}issait`, `${stem}issions`, `${stem}issiez`, `${stem}issaient`,
    `${stem}i`, `${stem}ie`, `${stem}ies`, `${stem}issant`];
  for (const e of ['ai', 'as', 'a', 'ons', 'ez', 'ont', 'ais', 'ait', 'aient']) out.push(inf + e);
  return out;
}

function dreForms(inf) { // vendre형(-dre 규칙: attendre·répondre·descendre…)
  const stem = inf.slice(0, -2);
  const fut = inf.slice(0, -1); // vendr-
  const out = [`${stem}s`, stem, `${stem}ons`, `${stem}ez`, `${stem}ent`,
    `${stem}ais`, `${stem}ait`, `${stem}ions`, `${stem}iez`, `${stem}aient`,
    `${stem}u`, `${stem}ue`, `${stem}us`, `${stem}ues`, `${stem}ant`];
  for (const e of ['ai', 'as', 'a', 'ons', 'ez', 'ont', 'ais', 'ait', 'aient']) out.push(fut + e);
  return out;
}

function verbForms(base) {
  for (const suffix of FAMILY_SUFFIXES) {
    if (base.endsWith(suffix)) {
      const prefix = base.slice(0, -suffix.length);
      return VERB_FAMILIES[suffix].map((tail) => prefix + tail);
    }
  }
  if (base.endsWith('er')) return erForms(base);
  if (base.endsWith('ir')) return irForms(base);
  if (base.endsWith('dre')) return dreForms(base);
  return []; // 미저작 -re·-oir 잔여 — 표제어 직대조만(하한)
}

// ── 명사 복수 ──
function nounForms(base) {
  if (/[sxz]$/.test(base)) return [];
  if (/al$/.test(base)) return [`${base.slice(0, -2)}aux`];
  if (/(eau|au|eu)$/.test(base)) return [`${base}x`];
  return [`${base}s`];
}

// ── 형용사 성·수 — 불규칙 소표 + 규칙(여성형 + 양쪽 복수) ──
const ADJ_IRREGULAR = {
  beau: ['bel', 'belle', 'beaux', 'belles'],
  nouveau: ['nouvel', 'nouvelle', 'nouveaux', 'nouvelles'],
  vieux: ['vieil', 'vieille', 'vieilles'],
  blanc: ['blanche', 'blancs', 'blanches'],
  long: ['longue', 'longs', 'longues'],
  frais: ['fraîche', 'fraîches'],
  sec: ['sèche', 'secs', 'sèches'],
  public: ['publique', 'publics', 'publiques'],
  doux: ['douce', 'douces'],
  faux: ['fausse', 'fausses'],
  gros: ['grosse', 'grosses'],
  bas: ['basse', 'basses'],
  gentil: ['gentille', 'gentils', 'gentilles'],
  favori: ['favorite', 'favoris', 'favorites'],
  fou: ['fol', 'folle', 'fous', 'folles'],
};

function adjForms(base) {
  if (ADJ_IRREGULAR[base]) return ADJ_IRREGULAR[base];
  let fem = null;
  if (/eux$/.test(base)) fem = `${base.slice(0, -3)}euse`;
  else if (/er$/.test(base)) fem = `${base.slice(0, -2)}ère`;
  else if (/f$/.test(base)) fem = `${base.slice(0, -1)}ve`;
  else if (/(el|eil|en|on|et)$/.test(base)) fem = `${base}${base.slice(-1)}e`;
  else if (!/e$/.test(base)) fem = `${base}e`;
  const out = fem ? [fem] : [];
  for (const form of [base, ...(fem ? [fem] : [])]) out.push(...nounForms(form));
  return out;
}

/**
 * 정규화된 표제어 + 저작 pos → 대조용 활용형 목록(정규화 키 공간, 표제어 자신 제외).
 * 다단어 표제어는 전개하지 않는다(단일 토큰과 어차피 미대조 — §4.7 한계 그대로).
 */
export function frInflectionVariants(base, pos) {
  if (!base || /\s/.test(base)) return [];
  const p = String(pos || '');
  if (p.startsWith('v')) return verbForms(base);
  if (p.startsWith('n')) return nounForms(base);
  if (p.startsWith('adj')) return adjForms(base);
  return [];
}
