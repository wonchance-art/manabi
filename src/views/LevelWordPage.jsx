'use client';
// HSK 단어 페이지(오너 확정 2026-10-19 KST · 문서 「HSK 단어 페이지 개편 구현 정리」 · 시안 9판) — /chinese/vocab/h1–h7.
// 화면은 JLPT와 같은 공통 화면(LevelWordScreen)이고, 여기서는 HSK 판만 정한다: 병음(성조 색) · 간체/정체 글자 칸 · HSK 1–7 색인 · 품사 묶음 범위.
import LevelWordScreen from '@/components/levels/word/LevelWordScreen';
import { pinyinSyllables } from '@/lib/levelList';
import { pinyinToneNumber } from '@/lib/pinyinTone';
import { levelCharTiles, loadLevelCharTables } from '@/lib/levelCharTiles';

const HAN = /\p{Script=Han}/u;

/** 병음 — 음절마다 성조 색(1 빨강 · 2 초록 · 3 파랑 · 4 보라 · 경성 회색). 음절이 글자 수와 안 맞거나 tone이 꺼지면 색 없이. */
export function Pinyin({ text, word, tone = true, className = 'lw-py' }) {
  const parts = tone ? pinyinSyllables(text, [...String(word || '')].filter((c) => HAN.test(c)).length) : null;
  if (!parts) return <span className={className}>{text}</span>;
  return <span className={className}>{parts.map((p, i) => <span key={i} className={`lw-tone--${pinyinToneNumber(p) ?? 0}`}>{p}</span>)}</span>;
}

export const HSK_WORD_LANG = Object.freeze({
  lang: 'chinese', code: 'zh', language: 'Chinese', mode: 'zh', prefsKey: 'manabi:level-word',
  hw: 'zh-CN', zheng: 'zh-TW', piece: 'zh-CN', exReading: undefined,
  levelOf: (key) => Number(String(key).slice(1)),
  levelKeyOf: (level) => `H${level}`,
  levelPill: (key) => String(key).slice(1),
  levelHref: (key) => `/chinese/vocab/${String(key).toLowerCase()}`,
  levelRank: (level) => level,
  tag: (level) => `HSK ${level}`,
  title: (level) => `HSK ${level} 단어`,
  scope: 'HSK 1–7 전체',
  indexUrl: '/api/level-index/chinese',
  placeholder: '한자 · 병음 · 뜻',
  searchHint: '한자 · 병음(jingyan · jing1yan4) · 한국어 뜻으로 HSK 1–7 전체에서 찾아요',
  noneHint: '철자를 줄이거나(jing) 한국어 뜻(경험)으로 찾아 보세요.',
  guide: '뜻이나 발음 중 하나라도 막혔다면 다시',
  aidLabel: '성조 색',
  Reading: Pinyin,
  head: (e) => ({ hw: e.word, sub: e.reading }),
  rangeOf: null, // 묶음이 이미 품사(ZH_POS_GROUPS)
  loadTiles: loadLevelCharTables,
  tilesOf: (word, _kr, tables) => levelCharTiles(word, tables),
});

export default function LevelWordPage(props) {
  return <LevelWordScreen cfg={HSK_WORD_LANG} {...props} />;
}
