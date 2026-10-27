// 복습 카드 규격(REV-SCOPE-R1B-1 — 오너 승인 3판 D6 · D9, 설계 §3-2 · §3-3 · §6-1 ⑥⑦).
// 순수 모듈: 종류 판별 · 발음 판정 대상 · 채점 기준 문구 · 뒷면 읽기 줄 · 소리 설정. 화면(VocabReview ·
// FsrsReviewSession · 처음 보는 표현 카드 · 집중 연습)이 모두 이 판정을 쓴다 — 화면마다 다시 짓지 않는다.

/** 종류 이름(화면) — 문형은 R2. */
export const EXPRESSION_KIND_LABELS = Object.freeze({ word: '단어', sentence: '문장' });
export const EXPRESSION_KINDS = Object.freeze(Object.keys(EXPRESSION_KIND_LABELS));

const SENTENCE_END = /[。！？.!?]$/u;
const TRAILING_CLOSE = /[\s」』”’"')）\]］】]+$/u;
const clean = value => String(value ?? '').normalize('NFC').trim();

/**
 * 종류 판별(§6-1 ⑦) — 읽을 때만 판별하고 저장하지 않는다. 직접 바꾸기는 R2.
 * 「문장」 = 교재 「예문 담기」로 담은 것(표현이 담을 때의 맥락 문장과 같음) 또는 문장 끝 부호(。！？.!?)로
 * 끝나는 것. 닫는 따옴표 · 괄호 뒤의 부호도 본다(「…です。」). 나머지는 「단어」.
 */
export function expressionKind(word) {
  const text = clean(word?.word_text);
  if (!text) return 'word';
  if (clean(word?.source_sentence) === text) return 'sentence';
  return SENTENCE_END.test(text.replace(TRAILING_CLOSE, '')) ? 'sentence' : 'word';
}

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆]/u;

/** 저장된 읽기(일본어 후리가나 · 중국어 병음 · 영어/프랑스어 발음 표기). 비면 null. */
export function readingOf(word) {
  const reading = clean(word?.furigana);
  return reading && reading !== clean(word?.word_text) ? reading : null;
}

/**
 * 뒷면 읽기 줄(§3-3): 일본어 한자어 = 한자 위 후리가나(ruby), 중국어 = 성조 부호 병음, 영어 · 프랑스어 =
 * 소리 중심(발음 표기가 있으면 작게), 가나만 있는 표현 = 읽기 줄 없이 소리만.
 * @returns {{kind: 'ruby'|'pinyin'|'phonetic'|'none', text: string|null}}
 */
export function readingLine(word) {
  const reading = readingOf(word);
  if (!reading) return { kind: 'none', text: null };
  if (word.language === 'Japanese') return KANJI.test(clean(word.word_text)) ? { kind: 'ruby', text: reading } : { kind: 'none', text: null };
  if (word.language === 'Chinese') return { kind: 'pinyin', text: reading };
  if (word.language === 'English' || word.language === 'French') return { kind: 'phonetic', text: reading };
  return { kind: 'none', text: null };
}

/** 뜻이 비어 있는 표현(글쓰기에서 담은 단어 등) — 복습에서 빼고 목록에 「뜻 채우기」를 낸다(§5-6). */
export const hasMeaning = word => clean(word?.meaning).length > 0;

// ── 소리(§3-3 소리 규격) ──
// 🔈/🔇는 기기별로 기억한다(대중교통 대비). 저장소가 막히면 이 화면에서만 유지한다.
export const REVIEW_SOUND_KEY = 'vocab_review_sound';
export function readReviewSound(storage = globalThis.localStorage) {
  try { return storage?.getItem(REVIEW_SOUND_KEY) !== 'off'; } catch { return true; }
}
export function saveReviewSound(on, storage = globalThis.localStorage) {
  try { storage?.setItem(REVIEW_SOUND_KEY, on ? 'on' : 'off'); } catch { /* 이 화면에서만 유지 */ }
}

/**
 * 뒷면을 펼칠 때 소리를 자동 재생할까. 화면 읽기 프로그램 · 키보드로 누른 단추는 click detail이 0이다
 * (실제 포인터 탭은 1 이상) — 그때는 자동 재생하지 않고 뜻 · 읽기를 글(aria-live)로만 알린다.
 * 단축키(Space)로 펼친 경우는 화면을 보는 키보드 사용자라 재생한다. 소리 꺼짐 · 음성 불가면 재생하지 않는다.
 */
export function shouldAutoplay({ soundOn, ttsSupported, trigger }) {
  if (!soundOn || !ttsSupported) return false;
  return trigger === 'pointer' || trigger === 'shortcut';
}

/** click 이벤트 → 펼친 방법. detail 0 = 보조기술 · 키보드 활성화. */
export const revealTrigger = event => (event && typeof event.detail === 'number' && event.detail > 0 ? 'pointer' : 'assistive');

/**
 * 앞면 카드 몸통을 눌러 펼치기(복습 손맛 실험실 제안안 — 오너 「웹 위주로 ㄱㄱ」 2026-10-16). 「정답 확인하기」 버튼이
 * 정본 입력이고(키보드 · 보조기술), 몸통 클릭은 마우스 편의다. 카드 안의 다른 조작(버튼 · 링크 · 입력)은 가로채지 않는다.
 */
const CARD_CONTROLS = 'button, a, input, textarea, select, summary, label, [role="button"]';
export const isCardRevealClick = event => !!event?.target && typeof event.target.closest === 'function'
  && !event.target.closest(CARD_CONTROLS);
