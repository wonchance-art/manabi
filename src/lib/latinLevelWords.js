// 영어 · 프랑스어 단어 페이지 묶음(오너 2026-10-26 KST 「단어 몇 개만 넣어서 일단 열어봐」) — 레퍼런스 어휘(src/content/*/vocab)에서
// 테마 몇 개의 앞 단어만 골라 HSK · JLPT 단어 화면(LevelWordScreen)과 같은 항목 꼴로 만든다. 새 콘텐츠 없음 — 같은 단어 · 같은 예문.
// 대조 키 = 레퍼런스 어휘 페이지가 단어장에 저장하는 word_text(refMain — 「la famille」처럼 관사까지)라 두 화면의 저장이 한 행에서 만난다.
// levelWordKey(공백 제거 — 「good morning」 → 「goodmorning」)는 쓰지 않는다.
import { compactLevelEntry, shortMeaning } from './levelList';

const mainOf = (item) => item.fr ?? item.en ?? '';

/** vocab = 레퍼런스 어휘 한 레벨({ themes:[{ name, words }] }) · themes = 고를 테마 순번 · per = 테마마다 앞에서 몇 개. */
export function latinSampleGroups(vocab, { themes, per }) {
  if (!vocab?.themes) return null;
  return themes.map((i) => vocab.themes[i]).filter(Boolean).map((t) => ({
    name: t.name,
    entries: t.words.slice(0, per).map((w) => {
      const word = mainOf(w);
      const ko = String(w.ko || '').trim();
      return compactLevelEntry({
        key: word, word, reading: String(w.ipa || ''), meaning: shortMeaning(ko), fullMeaning: ko, pos: String(w.pos || ''),
        ...(w.ex && mainOf(w.ex) ? { ex: { text: mainOf(w.ex), ko: String(w.ex.ko || '') } } : {}),
      });
    }),
  }));
}
