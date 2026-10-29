// 프랑스어 단어 페이지(/french/words) 한 단어 화면 보충 — 오너 2026-10-26 KST 목업 v2 「다음 ㄱㄱ」.
// 키 = 어휘(vocab/a1.js)의 표제어(관사 포함). 어휘 본문은 그대로 두고 화면 칸만 더한다. 칸의 뜻은 english/wordNotes.js 머리말과 같다.
//   conj — 현재형 [주어, 꼴] 여섯 칸. A1 불규칙 동사만 손으로 쓴다(활용 자료 Verbiste는 GPL이라 배제 — 오너 결정 ② 추천안).
//   성(f. · m.)은 어휘의 품사(n.f. · n.m.)에서 읽는다 — 여기 적지 않는다.
const WORD_NOTES = {
  'la famille': { etym: { root: ['familia', '라틴어'], kin: [['영어', 'family'], ['영어', 'familiar']], note: false } },
  'le père': { etym: { root: ['pater', '라틴어'], kin: [['영어', 'paternal']] } },
  'être': { irregular: true, conj: [['je', 'suis'], ['tu', 'es'], ['il · elle', 'est'], ['nous', 'sommes'], ['vous', 'êtes'], ['ils · elles', 'sont']] },
  'avoir': { irregular: true, conj: [['j’', 'ai'], ['tu', 'as'], ['il · elle', 'a'], ['nous', 'avons'], ['vous', 'avez'], ['ils · elles', 'ont']] },
  'le pain': { etym: { root: ['pānis', '라틴어'], kin: [['영어', 'pantry']] } },
  'grand': { mean: '큰, 키가 큰', forms: [['m.', 'grand'], ['f.', 'grande']], etym: { root: ['grandis', '라틴어'], kin: [['영어', 'grand']] } },
  'petit': { mean: '작은', forms: [['m.', 'petit'], ['f.', 'petite']] },
};

export default WORD_NOTES;
