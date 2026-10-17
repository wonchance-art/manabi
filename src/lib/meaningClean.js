// 뜻 정리 — 의존성 없는 작은 모듈. /vocab(VocabPage)이 이 함수 하나 때문에 studySession(18.5KB) 전체를 싣던 것을 끊는다
// (2026-10-17 KST 번들 조사). studySession이 다시 내보낸다.
/**
 * 뜻 문자열에서 원어 병기 괄호 제거 — 보기 텍스트 정화.
 * user_vocabulary.meaning에 "일하다 (働く)"처럼 원어(가나·한자·라틴)를 병기해 저장한 데이터가
 * 4지선다 보기에 그대로 나오면 정답이 시각적으로 새므로, 사용 시점에 정리한다.
 * 판정: 괄호(반각 `()`·전각 `（）`) 안에 한글이 하나라도 있으면 보존("달리다 (과거형)"),
 *       없고 가나/한자/라틴문자가 있으면 원어 병기로 보고 괄호째 제거. 그 외(숫자·기호)는 보존.
 * 순수 함수·멱등. 남은 공백은 정리해 trim.
 */
const MEANING_HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const MEANING_SOURCE_SCRIPT = /[ぁ-ゟゔァ-ヿーｦ-ﾟ々〆〤ヶ一-鿿a-zA-Z]/; // 가나·장음·반각가나·한자·라틴
export function stripSourceLangInMeaning(meaning) {
  if (typeof meaning !== 'string' || !meaning) return meaning;
  const out = meaning.replace(/\s*[（(]\s*([^（()）]*?)\s*[)）]/g, (m, inner) => {
    if (MEANING_HANGUL.test(inner)) return m;          // 한글 설명 괄호 → 보존
    if (MEANING_SOURCE_SCRIPT.test(inner)) return '';  // 원어(가나·한자·라틴)만 → 제거
    return m;                                          // 숫자·기호 등 → 보존
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}

/*
 * 보기(4지선다 · 짝 맞추기)용 뜻 — 보기만 보고 정답을 알 수 없게(STUDY-CHOICE-LEAK-001, 2026-10-17 KST).
 * 실측: 「マジ／マジで」의 정답 보기가 「진짜·레알 (「マジで?」=실화냐?)」 — 괄호 속 용례가 문제 낱말을 그대로 보였다.
 * 규칙 ① choiceMeaning: stripSourceLangInMeaning에 더해, 한글이 섞여 있어도 원어(가나 · 한자 · 라틴)나 인용 괄표(「」『』)가
 *   들어 있는 괄호는 뺀다. 문제 낱말과 상관없이 **모든 보기에 같은 규칙**이다 — 정답에만 적용하면 「괄호 없는 보기 = 정답」이 된다.
 *   한글만 있는 괄호(「달리다 (과거형)」 · 「(속어)」)는 남긴다: 낱말 철자를 드러낼 수 없고 뜻을 가르는 정보라서.
 * 규칙 ② choiceSet: ① 뒤에도 어느 보기의 괄호에 문제 낱말(표면형 · 「／」 변형 · 〜 뗀 꼴, NFC 비교)이 남아 있으면 — 한글 낱말
 *   (한국어 학습)처럼 ①이 못 거르는 경우 — 네 보기 **모두**에서 괄호를 뺀다(역시 한쪽만 다르지 않게).
 * 결과 화면 · 담기는 원래 뜻(전문)을 그대로 쓴다 — 여기는 보기 글자만 정한다.
 */
const PAREN = /\s*[（(]\s*([^（()）]*?)\s*[)）]/g;
const QUOTE_MARKS = /[「」『』]/;
const tidy = s => s.replace(/\s{2,}/g, ' ').trim();
const nfc = s => String(s).normalize('NFC');

export function choiceMeaning(meaning) {
  const base = stripSourceLangInMeaning(meaning);
  if (typeof base !== 'string' || !base) return base;
  return tidy(nfc(base).replace(PAREN, (m, inner) => (MEANING_SOURCE_SCRIPT.test(inner) || QUOTE_MARKS.test(inner) ? '' : m)));
}

/** 문제 낱말의 비교용 꼴들 — 「／」·「/」로 나뉜 변형, 앞뒤 〜·~ 뗀 꼴. 한 글자 꼴은 우연 일치가 많아 뺀다. */
function promptForms(prompt) {
  if (typeof prompt !== 'string') return [];
  return [...new Set(nfc(prompt).split(/[／/]/).map(s => s.replace(/^[〜~]+|[〜~]+$/g, '').trim()).filter(s => s.length >= 2))];
}

/** 규칙 ② — 보기 글자 묶음(①을 이미 적용한 값). 어느 괄호에 문제 낱말이 있으면 전부에서 괄호를 뺀다. 순서 · 개수는 그대로. */
export function choiceLabels(labels, prompt) {
  const forms = promptForms(prompt);
  const leaks = forms.length > 0 && labels.some(label => [...String(label).matchAll(PAREN)].some(([, inner]) => forms.some(f => nfc(inner).includes(f))));
  return leaks ? labels.map(label => tidy(String(label).replace(PAREN, ''))) : labels;
}

/**
 * 정답 · 오답 보기를 함께 정한다(①은 호출자가 choiceMeaning으로 이미 적용한 값을 넘긴다).
 * @returns {{ correct: string, options: string[] } | null} 괄호를 빼서 보기가 겹쳐 오답이 2개 미만이면 null(문항 성립 안 함)
 */
export function choiceSet(correct, distractors, prompt) {
  const shown = choiceLabels([correct, ...(distractors || [])], prompt);
  const options = [...new Set(shown)];
  if (options.length < 3) return null;
  return { correct: shown[0], options };
}
