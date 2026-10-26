// 영어 단어 페이지(/english/words) 한 단어 화면 보충 — 오너 2026-10-26 KST 목업 v2 「다음 ㄱㄱ」.
// 키 = 어휘(vocab/a1.js)의 표제어. 어휘 본문(ipa · 뜻 · 예문 · etym 글)은 그대로 두고 화면 칸만 더한다.
//   mean — 화면 뜻(어휘 뜻의 괄호 속 꼴을 형태 칸이 맡을 때), irregular — 뜻 옆 「불규칙」 표, forms — 형태 칸 [이름, 꼴](리스트에는 내지 않는다 — 오너 「눌러서 나오는 화면에만」),
//   etym — 어원 칸: parts = 합성어 조각 [조각, 뜻] · root = [뿌리말, 말] · kin = 같은 뿌리 [말(없으면 영어), 단어] ·
//   note = 칸 아래 한 줄(없으면 어휘의 etym 글, false면 줄 없음 — 조각 · 뿌리가 같은 말을 이미 할 때).
const WORD_NOTES = {
  welcome: { etym: { parts: [['well', '잘'], ['come', '오다']], note: '‘잘 오셨어요’라는 뜻이 그대로 담겨 있어요.' } },
  family: { etym: { root: ['familia', '라틴어'], kin: [[null, 'familiar'], ['프랑스어', 'famille']], note: false } },
  be: { mean: '~이다, 있다', irregular: true, forms: [['현재', 'am · is · are'], ['과거', 'was · were'], ['과거분사', 'been']] },
  go: { irregular: true, forms: [['현재', 'go'], ['과거', 'went'], ['과거분사', 'gone']] },
  good: { irregular: true, forms: [['원급', 'good'], ['비교급', 'better'], ['최상급', 'best']] },
  bad: { irregular: true, forms: [['원급', 'bad'], ['비교급', 'worse'], ['최상급', 'worst']] },
};

export default WORD_NOTES;
