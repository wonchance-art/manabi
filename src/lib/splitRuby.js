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
export function splitRuby(text, furigana) {
  if (!furigana) return [{ plain: text }];

  const KANJI = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
  const isKanji = ch => KANJI.test(ch);

  // 중국어 병음: 라틴 음절이 글자 수와 일치하면 글자별로 분배(글자당 음절 = 표준 병음
  // 조판 — 격자 폭 1em 고정·단일 축소 크기·성조색은 이 표식이 스위치다).
  // 판별: 전 글자가 한자 + 독음에 가나 없음 + 라틴 스크립트 존재(성조 부호 붙은 모음도
  // 라틴 스크립트라 ǹ 같은 단독 음절까지 잡힌다). 일본어 요미가나는 가나 조건에서 걸러진다.
  // ※ 공백 존재를 조건으로 걸었던 초기 구현은 한 글자 단어(我·去 — 음절 1개라 공백이
  //    없다)를 일본어 경로로 흘려보내 병음이 요미 크기(0.5em)로 크게 렌더됐다(오너 발견
  //    2026-08-19). 음절 수 == 글자 수 비교가 공백 유무까지 포괄하므로 공백 조건은 제거.
  const zhChars = [...text];
  if (!/[぀-ヿ]/.test(furigana) && /\p{Script=Latin}/u.test(furigana) && zhChars.every(isKanji)) {
    const syllables = furigana.trim().split(/\s+/);
    if (syllables.length === zhChars.length) {
      // pinyin 표식 — 글자당 1음절 격자 조판(폭 1em 고정·단일 축소 크기) 전용 경로.
      return zhChars.map((ch, i) => ({ kanji: ch, reading: syllables[i], pinyin: true }));
    }
  }

  // 1. surface를 [kanji 구간, hira 구간, ...] 으로 분할
  const segments = [];
  let i = 0;
  while (i < text.length) {
    if (isKanji(text[i])) {
      let j = i;
      while (j < text.length && isKanji(text[j])) j++;
      segments.push({ type: 'kanji', text: text.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < text.length && !isKanji(text[j])) j++;
      segments.push({ type: 'plain', text: text.slice(i, j) });
      i = j;
    }
  }

  // 한자가 없으면 plain으로 반환
  if (!segments.some(s => s.type === 'kanji')) return [{ plain: text }];

  // 2. hira 구간들을 앵커로 regex를 만들어 reading을 분할
  //    한자 구간 → (.+?)  /  hira 구간 → 리터럴 이스케이프
  const regexParts = segments.map(s =>
    s.type === 'kanji' ? '(.+?)' : s.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  // 마지막 한자 캡처는 greedy로 (.+)
  const lastKanjiIdx = regexParts.lastIndexOf('(.+?)');
  if (lastKanjiIdx !== -1) regexParts[lastKanjiIdx] = '(.+)';

  try {
    const regex = new RegExp('^' + regexParts.join('') + '$');
    const match = furigana.match(regex);
    if (match) {
      let groupIdx = 1;
      return segments.map(s => {
        if (s.type === 'kanji') {
          return { kanji: s.text, reading: match[groupIdx++] };
        }
        return { plain: s.text };
      });
    }
  } catch {}

  // regex 실패 시 fallback: 전체 한자에 전체 reading
  return segments.map(s =>
    s.type === 'kanji' ? { kanji: s.text, reading: furigana } : { plain: s.text }
  );
}
