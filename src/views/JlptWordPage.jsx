'use client';
// JLPT 단어 페이지(오너 확정 2026-10-19 KST · 문서 「HSK 단어 페이지 개편 구현 정리」 「일본어 판에서 달라지는 점」 · 시안 ⑰–㉑) — /japanese/vocab/n5–n1.
// HSK와 같은 공통 화면(LevelWordScreen)에 JLPT 판을 입힌다:
//   읽기 = 가나(성조 색 없음) · 가나만 있는 단어(メモ)는 읽기 줄 · 글자 칸 없음 · N5 · N4는 가나 표제어(jaHeadMode — 한자는 읽기 줄)
//   글자 칸 = 훈음 + 이 단어 속 읽기(経 날 경 けい — 빌드 때 KANJIDIC2로 나눈 kr), 아래 회색 = 한국 정자(経 → 經)
//   예문 = 후리가나(빌드 때 alignFurigana) · 단어 나눔과 원형(빌드 때 형태소 분석 — して → する)
//   찾기 = 가나(가타카나는 히라가나로) · 한자 · 뜻으로 N5–N1 전체 · 범위 = 품사(동사(1) · い형용사 …)
// 이 파일은 중국어 부품을 부르지 않는다(일본어 라우트 — 간체 글꼴 범위 밖, fontScope 계약).
import LevelWordScreen from '@/components/levels/word/LevelWordScreen';
import { jaHeadMode } from '@/lib/levelList';
import { rangeOfPos } from '@/lib/levelWordStatus';
import { jaCharTiles, loadJaCharTables } from '@/lib/levelCharTiles';

const HAN = /\p{Script=Han}/u;

function Kana({ text }) {
  return <span className="lw-py" lang="ja">{text}</span>;
}

/** JLPT 판 — 레벨 key(N5)마다 표제어 표기가 달라 head는 화면이 levelKey를 넣어 만든다(jlptWordLang). */
export function jlptWordLang(levelKey) {
  const kana = jaHeadMode(levelKey) === 'kana';
  return {
    lang: 'japanese', code: 'ja', language: 'Japanese', mode: 'ja', prefsKey: 'manabi:level-word:ja',
    hw: 'ja', zheng: 'ko', piece: 'ko', exReading: 'ja',
    levelOf: (key) => Number(String(key).slice(1)),
    levelKeyOf: (level) => `N${level}`,
    levelPill: (key) => String(key),
    levelHref: (key) => `/japanese/vocab/${String(key).toLowerCase()}`,
    levelRank: (level) => -level, // 같은 순위면 N5 먼저
    tag: (level) => `N${level}`,
    title: (level) => `JLPT N${level} 단어`,
    scope: 'JLPT N5–N1 전체',
    indexUrl: '/api/level-index/japanese',
    placeholder: '가나 · 한자 · 뜻',
    searchHint: '가나(けいけん) · 한자 · 한국어 뜻으로 JLPT N5–N1 전체에서 찾아요',
    noneHint: '읽기를 줄이거나(けい) 한국어 뜻(경험)으로 찾아 보세요.',
    guide: '뜻이나 읽기 중 하나라도 막혔다면 다시',
    aidLabel: '예문 후리가나',
    Reading: Kana,
    // N5 · N4는 가나 표제어 + 한자는 읽기 줄(jaHeadMode — 옛 목록과 같은 규칙). 한자가 없는 단어는 표제어만.
    head: (e) => (kana && HAN.test(e.word) && e.reading ? { hw: e.reading, sub: e.word } : { hw: e.word, sub: e.reading }),
    rangeOf: (e) => rangeOfPos(e.pos),
    loadTiles: loadJaCharTables,
    tilesOf: (word, kr, tables) => jaCharTiles(word, kr, tables),
  };
}

const LANGS = new Map();
const langOf = (levelKey) => {
  if (!LANGS.has(levelKey)) LANGS.set(levelKey, Object.freeze(jlptWordLang(levelKey)));
  return LANGS.get(levelKey);
};

export default function JlptWordPage(props) {
  return <LevelWordScreen cfg={langOf(props.levelKey)} {...props} />;
}
