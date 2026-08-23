import { describe, expect, it } from 'vitest';
import { frInflectionVariants } from '../frInflect.js';

// 🈁 fr 굴절 전개(rfc-vocab-encounter §4.8) — 대조기 재료 계약.
//   과잉 전개는 무해(안 쓰이는 키), 누락은 만남 미기록(하한). 핀은 "실문장에서 오는
//   표면형이 접히는가"를 고정한다.

const v = (base) => frInflectionVariants(base, 'v.');
const has = (base, ...forms) => {
  const set = new Set(v(base));
  for (const f of forms) expect(set.has(f), `${base} → ${f}`).toBe(true);
};

describe('동사 — 규칙 패러다임', () => {
  it('-er: 현재·반과거·미래·조건법·분사·성수 분사', () => {
    has('parler', 'parle', 'parles', 'parlons', 'parlez', 'parlent',
      'parlais', 'parlait', 'parlions', 'parlaient',
      'parlerai', 'parlera', 'parleront', 'parlerais',
      'parlé', 'parlée', 'parlés', 'parlées', 'parlant');
  });

  it('-er 철자 보정: -cer/-ger 연음, 묵음 e·é→è, -eler 중복, -yer y→i', () => {
    has('commencer', 'commençons', 'commençais');
    has('manger', 'mangeons', 'mangeais', 'mangeant');
    has('lever', 'lève', 'lèvent', 'lèverai');
    has('préférer', 'préfère', 'préfèrent');
    has('appeler', 'appelle', 'appellerai');
    has('acheter', 'achète', 'achèterai');
    has('payer', 'paie', 'paies');
  });

  it('-ir(finir형 기본): 현재·복수 어간·분사·미래', () => {
    has('finir', 'finis', 'finit', 'finissons', 'finissez', 'finissent',
      'finissais', 'fini', 'finirai', 'finissant');
    has('choisir', 'choisissons', 'choisi', 'choisirez');
  });

  it('-dre(vendre형): 무어미 3단수·-u 분사·미래', () => {
    has('attendre', 'attends', 'attend', 'attendons', 'attendez', 'attendent',
      'attendais', 'attendu', 'attendue', 'attendrai');
    has('répondre', 'réponds', 'répond', 'répondu', 'répondrons');
  });
});

describe('동사 — 가족(suffix family)·불규칙 저작', () => {
  it('최고빈도 완전 불규칙: être·avoir·aller', () => {
    has('être', 'suis', 'es', 'est', 'sommes', 'êtes', 'sont', 'étais', 'été', 'serai', 'sois', 'étant');
    has('avoir', 'ai', 'as', 'a', 'avons', 'avez', 'ont', 'avais', 'eu', 'aurai', 'aie', 'ayant');
    has('aller', 'vais', 'vas', 'va', 'allons', 'allez', 'vont', 'allais', 'allé', 'irai', 'aille');
  });

  it('가족이 합성동사를 접는다: obtenir·apprendre·permettre·reconnaître·satisfaire', () => {
    has('venir', 'viens', 'viennent', 'venu', 'viendrai');
    has('obtenir', 'obtiens', 'obtenons', 'obtenu', 'obtiendrai');
    has('apprendre', 'apprends', 'apprenons', 'appris', 'apprendrai');
    has('permettre', 'permets', 'permis', 'permettra');
    has('reconnaître', 'reconnais', 'reconnaît', 'reconnu', 'reconnaissant');
    has('satisfaire', 'satisfais', 'satisfont', 'satisfait', 'satisferai');
    has('conduire', 'conduis', 'conduisons', 'conduit', 'conduirai');
  });

  it('partir형·-vrir형·-oir 저작', () => {
    has('partir', 'pars', 'part', 'partons', 'parti', 'partirai');
    has('dormir', 'dors', 'dort', 'dormons', 'dormi');
    has('ouvrir', 'ouvre', 'ouvrons', 'ouvert', 'ouverte', 'ouvrirai');
    has('découvrir', 'découvre', 'découvert');
    has('offrir', 'offre', 'offert');
    has('voir', 'vois', 'voyons', 'voient', 'vu', 'verrai');
    has('pouvoir', 'peux', 'peut', 'peuvent', 'pu', 'pourrai', 'puisse');
    has('vouloir', 'veux', 'veulent', 'voulu', 'voudrais');
    has('devoir', 'dois', 'doivent', 'dû', 'devrai');
    has('savoir', 'sais', 'savent', 'su', 'saurai', 'sache');
    has('recevoir', 'reçois', 'recevons', 'reçu', 'recevrai');
    has('faire', 'fais', 'faites', 'font', 'fait', 'ferai', 'fasse');
    has('boire', 'bois', 'buvons', 'bu');
    has('écrire', 'écris', 'écrivons', 'écrit');
    has('mourir', 'meurs', 'mort', 'morte');
  });

  it('미저작 잔여는 조용히 빈 배열(하한) — 다단어도 전개 없음', () => {
    expect(frInflectionVariants('opposer à', 'v.')).toEqual([]);
    expect(frInflectionVariants('', 'v.')).toEqual([]);
  });
});

describe('명사·형용사', () => {
  it('명사 복수: +s·-al→aux·-eau/-eu→+x·s/x/z 불변', () => {
    expect(frInflectionVariants('maison', 'n.f.')).toEqual(['maisons']);
    expect(frInflectionVariants('journal', 'n.m.')).toEqual(['journaux']);
    expect(frInflectionVariants('bureau', 'n.m.')).toEqual(['bureaux']);
    expect(frInflectionVariants('jeu', 'n.m.')).toEqual(['jeux']);
    expect(frInflectionVariants('pays', 'n.m.')).toEqual([]);
  });

  it('형용사 성·수: 규칙 여성형 + 양쪽 복수, 불규칙 소표', () => {
    expect(new Set(frInflectionVariants('grand', 'adj.'))).toEqual(new Set(['grande', 'grands', 'grandes']));
    expect(new Set(frInflectionVariants('heureux', 'adj.'))).toEqual(new Set(['heureuse', 'heureuses']));
    expect(new Set(frInflectionVariants('premier', 'adj.'))).toEqual(new Set(['première', 'premiers', 'premières']));
    expect(new Set(frInflectionVariants('actif', 'adj.'))).toEqual(new Set(['active', 'actifs', 'actives']));
    expect(new Set(frInflectionVariants('bon', 'adj.'))).toEqual(new Set(['bonne', 'bons', 'bonnes']));
    expect(new Set(frInflectionVariants('beau', 'adj.'))).toEqual(new Set(['bel', 'belle', 'beaux', 'belles']));
    expect(frInflectionVariants('rouge', 'adj.')).toEqual(['rouges']);
  });

  it('동사·명사·형용사 외 pos는 전개하지 않는다', () => {
    expect(frInflectionVariants('vite', 'adv.')).toEqual([]);
    expect(frInflectionVariants('bonjour', 'expr.')).toEqual([]);
  });
});
