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
 * 「원어」는 문제 낱말의 글자 체계로 정한다(데이터 감사 2026-10-17 KST): 일본어 · 중국어 낱말이면 가나 · 한자, 영어 · 프랑스어
 *   낱말이면 라틴 문자. 한국어 설명 속 단위 · 약어(「근(무게 단위, 500g)」 · 「웨이보(중국 대표 SNS)」)나 가운뎃점 「・」은
 *   원어가 아니다 — 예전엔 이것들로 뜻을 가르는 설명까지 빠졌다. 같은 문항의 네 보기에는 같은 문제 낱말을 넘긴다.
 * 보기는 앞 절만 쓴다: 괄호 밖의 첫 「 — 」 · 첫 문장 끝(「. 」 · 「。」) 뒤 해설은 뺀다(만남 문항의 「정본 ko 앞 절」 선례와 같은 규칙).
 *   데이터 감사: 문화 · 속어 뜻풀이가 「성격. … 「性格いい」=성격 좋다」처럼 문제 낱말을 해설 안에 그대로 담고 있었다(괄호 밖 누출 99건).
 * 괄호는 ( ) · （ ） · [ ] · 【 】를 같이 보고, 겹친 괄호는 안쪽부터 다시 본다. 짝이 안 맞는 꼬리 괄호(「아버지 (남에게 …」 — 만남 문항이
 *   「 — 」로 자를 때 괄호 안에서 잘린 것)도 뺀다.
 * 괄호를 뺀 뒤 끝에 남는 구분 부호(「내일;」의 ;)는 지운다.
 * 결과 화면 · 담기는 원래 뜻(전문)을 그대로 쓴다 — 여기는 보기 글자만 정한다.
 */
const PAREN = /\s*[（(［[【]\s*([^（()）［\][\]【】]*?)\s*[)）］\]】]/g;
const OPEN = /[（(［[【]/, CLOSE = /[)）］\]】]/;
const QUOTE_MARKS = /[「」『』]/;
const HANGUL_SYLLABLE = /[가-힣ㄱ-ㅎㅏ-ㅣ]/u; // 「ㅋㅋ」도 한글 뜻
const tidy = s => s.replace(/\s{2,}/g, ' ').trim().replace(/\s*[;；,，、·]+$/u, '').replace(/([가-힣])[.。]$/u, '$1').trim();
const nfc = s => String(s).normalize('NFC');
// 가운뎃점 「・」(U+30FB)은 가나 블록에 있지만 한국어 설명에도 쓰여 원어로 치지 않는다.
const CJK_SCRIPT = /[ぁ-ゖゝ-ゟァ-ヺー-ヿｦ-ﾟ々〆〤一-鿿]/;
const LATIN_SCRIPT = /[A-Za-zÀ-ÖØ-öø-ÿŒœ]/;
/** 문제 낱말의 글자 체계 → 괄호를 뺄 원어 판정식. 모르면(없음 · 한글 낱말) 둘 다(예전과 같은 넓은 쪽). 한글 낱말은 ②가 맡는다. */
function sourceScriptOf(prompt) {
  const p = typeof prompt === 'string' ? nfc(prompt) : '';
  if (CJK_SCRIPT.test(p)) return CJK_SCRIPT;
  if (LATIN_SCRIPT.test(p)) return LATIN_SCRIPT;
  return { test: s => CJK_SCRIPT.test(s) || LATIN_SCRIPT.test(s) };
}

/** 괄호 밖에서 처음 만나는 「 — 」 · 문장 끝 앞까지(앞 절). 만남 후보(studyMaterials)도 이 함수로 자른다 — 괄호 안 「 — 」에서 자르지 않게. */
export function headClause(s) {
  if (typeof s !== 'string') return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (OPEN.test(c)) depth++;
    else if (CLOSE.test(c)) depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      if ((c === '—' || c === '–') && s[i - 1] === ' ' && s[i + 1] === ' ') return s.slice(0, i);
      if (c === '。' && s.slice(i + 1).trim()) return s.slice(0, i);
      if (c === '.' && /[가-힣]/u.test(s[i - 1] || '') && s[i + 1] === ' ' && s.slice(i + 1).trim()) return s.slice(0, i); // 한글 문장 끝만(「U.S. 달러」는 그대로)
    }
  }
  return s;
}
/** 괄호를 안쪽부터 되풀이해 본다(겹친 괄호). decide(inner) → null(남김) · ''(뺌) · 문자열(괄호 안을 그 글로).
 * 남기는 괄호는 자리표로 숨겨 바깥 괄호를 다음 차례에 본다. 짝 없는 꼬리 괄호는 decide와 상관없이 뺀다. */
function dropParens(s, decide) {
  const kept = [];
  const expand = t => { let r = t, p; do { p = r; r = r.replace(/\u0000(\d+)\u0001/g, (_, k) => kept[k]); } while (r !== p); return r; };
  let prev, out = s;
  do {
    prev = out;
    out = out.replace(PAREN, (m, inner) => {
      const verdict = decide(expand(inner));
      if (verdict === '') return '';
      kept.push(verdict === null ? m : m.replace(inner, verdict));
      return `\u0000${kept.length - 1}\u0001`;
    });
  } while (out !== prev);
  return expand(out.replace(/\s*[（(［[【][^)）］\]】]*$/u, ''));
}

/** 규칙 ① — prompt = 이 문항의 문제 낱말(정답 · 오답 보기 모두 같은 값을 넘긴다). */
export function choiceMeaning(meaning, prompt) {
  const base = stripSourceLangInMeaning(meaning);
  if (typeof base !== 'string' || !base) return base;
  const source = sourceScriptOf(prompt);
  // 뺄 괄호라도 「 — 」 앞이 한글 설명뿐이면 그 앞만 남긴다 — 「안녕하세요 (낮 인사 — 원래 「今日は」…)」 → 「(낮 인사)」.
  // 뜻을 가르는 설명(낮 · 저녁 인사, 자동사, 찬물)은 지키고 용례만 뺀다(데이터 감사: こんにちは · こんばんは가 같은 보기가 됐다).
  const leaks = t => source.test(t) || QUOTE_MARKS.test(t);
  const drop = inner => {
    if (!leaks(inner)) return null;
    const head = inner.split(/\s[—–]\s/u)[0].trim();
    return head !== inner.trim() && !leaks(head) && HANGUL_SYLLABLE.test(head) ? head : '';
  };
  const text = nfc(base);
  // 한글 뜻이 남는 가장 짧은 꼴을 고른다 — 앞 절이 약어 · 원어뿐이면(「TKG — 갓 지은 밥에…」) 앞 절로 자르지 않는다.
  for (const candidate of [tidy(dropParens(headClause(text), drop)), tidy(dropParens(text, drop))]) {
    if (HANGUL_SYLLABLE.test(candidate)) return candidate;
  }
  return base;
}

/** 문제 낱말의 비교용 꼴들 — 「／」·「/」로 나뉜 변형, 앞뒤 〜·~ 뗀 꼴. 한 글자 꼴은 우연 일치가 많아 뺀다. */
function promptForms(prompt) {
  if (typeof prompt !== 'string') return [];
  return [...new Set(nfc(prompt).split(/[／/]/).map(s => s.replace(/^[〜~]+|[〜~]+$/g, '').trim()).filter(s => s.length >= 2))];
}

/** 규칙 ② — 보기 글자 묶음(①을 이미 적용한 값). 어느 보기에 문제 낱말이 남아 있으면 전부에서 괄호를 뺀다. 순서 · 개수는 그대로. */
export function choiceLabels(labels, prompt) {
  const forms = promptForms(prompt);
  const leaks = forms.length > 0 && labels.some(label => forms.some(f => nfc(label).includes(f)));
  // 괄호 밖(앞 절 자체)에 낱말이 있으면 더 뺄 수 없다 — 그 경우도 괄호는 모두 빼 한쪽만 다르지 않게 둔다(데이터 쪽 과제).
  return leaks ? labels.map(label => tidy(dropParens(nfc(label), () => ''))) : labels;
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
