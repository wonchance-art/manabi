// 토큰 표기+독음 → ruby 세그먼트 분해 — 뷰어 본문·단어 시트·드래그 팝업 공용.
// ViewerPage에서 추출(2026-08-19): 중국어/일본어 판별이 조판 크기·성조색의 스위치인데
// 컴포넌트 내부 함수라 단위 테스트가 불가능했다(한 글자 병음 오분류가 그 사각에서 나옴).

/**
 * 送り仮名(okurigana) 제거: 요미가나에서 원문에 이미 있는 히라가나 제거
 *
 * 원칙: 원문(text)에 보이는 히라가나는 요미가나에서 중복 제거.
 *       요미가나는 한자 읽기만 남긴다.
 *
 * 超える  + こえる    → こ
 * 食べる  + たべる    → た
 * 思い出す + おもいだす → おもだ   (い・す 제거)
 * 한자·히라가나 혼합 토큰을 ruby 세그먼트로 분리.
 * 例: 取りまとめ + とりまとめ → [{kanji:"取", reading:"と"}, {plain:"りまとめ"}]
 *     引っ張る   + ひっぱる   → [{kanji:"引", reading:"ひ"}, {plain:"っ"}, {kanji:"張", reading:"ぱ"}, {plain:"る"}]
 *     今日       + きょう     → [{kanji:"今日", reading:"きょう"}]
 *
 * 알고리즘: surface의 히라가나 구간을 앵커로 reading을 분할 → 한자 구간에 읽기 할당
 */
/**
 * 가나 판별 — 이 모듈의 병음/요미 갈림길이 쓰는 그 검사다.
 *
 * 밖에서도 쓴다: 카드 요미의 分散配置가 「요미 폭 = 글자수 × 0.5em」을 전제하는데
 * 그건 **가나** 전제다(혼종 중국어 토큰의 병음은 라틴이라 훨씬 좁다). 같은 판별을
 * 두 벌로 두면 한쪽만 낡으므로 여기서 내보낸다.
 */
export const KANA_RE = /[぀-ヿ]/;

// 来る는 뒤 가나에 따라 읽기가 바뀐다(来ない こ · 来ます/来た/来て き · 来る/来れば く) — 기본형 읽기(くる)를 그대로 옮기면 틀린다.
// 뒤 가나를 모르면(다음 토큰도 없으면) 가장 흔한 き다 — 来る는 보통 「来る」 한 토큰으로 온다.
const KURU_STEM = (next) => (/^[なよさら]/.test(next) ? 'こ' : /^る|^れ/.test(next) ? 'く' : 'き');

/**
 * @param {string} text 표면형(본문 그대로)
 * @param {string|null} furigana 독음 — 분석기는 활용형에도 **기본형 읽기**를 준다(違い + ちがう, 待っ + まつ — 운영 자료 실측).
 * @param {string} [nextText] 바로 뒤 토큰 표기 — 来 | ない처럼 활용 어미가 다음 토큰이면 来의 읽기(こ · き · く)를 여기서 고른다.
 * @param {string} [baseForm] 기본형(違う · 待つ). 주면 표면 앵커가 안 맞을 때 기본형으로 한자 읽기를 구해 옮긴다 —
 *   없으면 독음 전체가 한자 위에 얹혀 「違[ちがう]い」 「待[まつ]っ」로 보였다(VIEWER-LANG-AUDIT, 2026-10-17 KST).
 */
const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;

/** 표기를 [한자 구간, 가나 구간, …]으로 나눈다. */
function segmentsOf(text) {
  const segments = [];
  let i = 0;
  while (i < text.length) {
    const kanji = KANJI_RE.test(text[i]);
    let j = i;
    while (j < text.length && KANJI_RE.test(text[j]) === kanji) j++;
    segments.push({ type: kanji ? 'kanji' : 'plain', text: text.slice(i, j) });
    i = j;
  }
  return segments;
}

/** 가나 구간을 앵커로 독음을 한자 구간에 나눈다 — 맞지 않으면 null(폴백은 부르는 쪽이 정한다). */
function anchorSplit(segments, furigana) {
  const parts = segments.map(s => (s.type === 'kanji' ? '(.+?)' : s.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const last = parts.lastIndexOf('(.+?)');
  if (last !== -1) parts[last] = '(.+)'; // 마지막 한자 캡처는 greedy
  let match = null;
  try { match = furigana.match(new RegExp('^' + parts.join('') + '$')); } catch { return null; }
  if (!match) return null;
  let group = 1;
  return segments.map(s => (s.type === 'kanji' ? { kanji: s.text, reading: match[group++] } : { plain: s.text }));
}

/**
 * 활용형 토큰의 한자 읽기를 기본형에서 옮긴다 — 기본형이 오쿠리가나 앵커로 **맞게** 나뉘고 한자 구간이 같을 때만. 아니면 null.
 * (기본형 쪽도 폴백이면 쓰지 않는다 — 食べ + たべ(표면 읽기) + 食べる처럼 독음이 표면 읽기면 표면 앵커가 맞는다.)
 */
function fromBaseForm(segments, furigana, baseForm, nextText = '') {
  const baseSegments = segmentsOf(baseForm);
  if (!baseSegments.some(seg => seg.type === 'plain')) return null;
  const base = anchorSplit(baseSegments, furigana);
  if (!base) return null;
  const baseKanji = base.filter(seg => seg.kanji);
  const surfaceKanji = segments.filter(seg => seg.type === 'kanji');
  if (baseKanji.length !== surfaceKanji.length || !baseKanji.every((seg, k) => seg.kanji === surfaceKanji[k].text)) return null;
  let k = 0;
  return segments.map((seg, idx) => {
    if (seg.type !== 'kanji') return { plain: seg.text };
    let reading = baseKanji[k++].reading;
    // 来 뒤 가나가 토큰 안에 없으면(来 | ない · 来 | ます — 실제 분석 출력) 다음 토큰 글자로 고른다.
    if (seg.text === '来' && /^来る/.test(baseForm)) reading = KURU_STEM(segments[idx + 1]?.text ?? nextText);
    return { kanji: seg.text, reading };
  });
}

export function splitRuby(text, furigana, baseForm, nextText) {
  if (!furigana) return [{ plain: text }];

  const isKanji = ch => KANJI_RE.test(ch);

  // 중국어 병음: 라틴 음절이 글자 수와 일치하면 글자별로 분배(글자당 음절 = 표준 병음
  // 조판 — 격자 폭 1em 고정·단일 축소 크기·성조색은 이 표식이 스위치다).
  // 판별: 전 글자가 한자 + 독음에 가나 없음 + 라틴 스크립트 존재(성조 부호 붙은 모음도
  // 라틴 스크립트라 ǹ 같은 단독 음절까지 잡힌다). 일본어 요미가나는 가나 조건에서 걸러진다.
  // ※ 공백 존재를 조건으로 걸었던 초기 구현은 한 글자 단어(我·去 — 음절 1개라 공백이
  //    없다)를 일본어 경로로 흘려보내 병음이 요미 크기(0.5em)로 크게 렌더됐다(오너 발견
  //    2026-08-19). 음절 수 == 글자 수 비교가 공백 유무까지 포괄하므로 공백 조건은 제거.
  const zhChars = [...text];
  if (!KANA_RE.test(furigana) && /\p{Script=Latin}/u.test(furigana) && zhChars.every(isKanji)) {
    const syllables = furigana.trim().split(/\s+/);
    if (syllables.length === zhChars.length) {
      // pinyin 표식 — 글자당 1음절 격자 조판(폭 1em 고정·단일 축소 크기) 전용 경로.
      return zhChars.map((ch, i) => ({ kanji: ch, reading: syllables[i], pinyin: true }));
    }
  }

  // 1. surface를 [kanji 구간, hira 구간, ...] 으로 분할
  const segments = segmentsOf(text);

  // 한자가 없으면 plain으로 반환
  if (!segments.some(s => s.type === 'kanji')) return [{ plain: text }];

  // 활용형: 분석기는 기본형 읽기를 준다(違い + ちがう) — 기본형이 있고 표면과 다르면 기본형에서 한자 읽기를 옮긴다.
  // 표면에 오쿠리가나가 없는 토큰(来 · 見)도 앵커가 늘 맞아 「来[くる]」가 되므로 같은 길로 간다.
  if (baseForm && baseForm !== text && KANA_RE.test(furigana)) {
    const moved = fromBaseForm(segments, furigana, baseForm, nextText);
    if (moved) return moved;
  }

  // 2. 가나 구간을 앵커로 독음을 나눈다
  const anchored = anchorSplit(segments, furigana);
  if (anchored) return anchored;

  // regex 실패 시 fallback: 전체 한자에 전체 reading
  return segments.map(s =>
    s.type === 'kanji' ? { kanji: s.text, reading: furigana } : { plain: s.text }
  );
}
