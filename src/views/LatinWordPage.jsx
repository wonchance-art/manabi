'use client';
// 영어 · 프랑스어 단어 페이지(오너 2026-10-26 KST 「단어 몇 개만 넣어서 일단 열어봐」) — /english/words/a1 · /french/words/a1.
// HSK · JLPT와 같은 공통 화면(LevelWordScreen)에 라틴 문자 판을 입힌다: 읽기 = IPA(영어는 미국식 하나 — 콘텐츠 그대로) · 전 레벨 색인 없음(이 레벨 안에서 찾기).
// 글자 칸 자리는 형태 · 현재형 · 어원이(LatinParts — 목업 v2, 오너 2026-10-26 KST 「다음 ㄱㄱ」), 프랑스어는 관사 매달기 · f./m. · 성 색(늘 켬).
import LevelWordScreen from '@/components/levels/word/LevelWordScreen';
import { LatinExtras, LatinHeadTag, LatinHeadword, LatinMeanTag } from '@/components/levels/word/LatinParts';
import { LATIN_WORD_LEVELS } from '@/lib/latinLevelWords';

const CEFR = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function Ipa({ text }) {
  return <span className="lw-py lw-ipa">{text}</span>;
}

function latinWordLang({ lang, code, language, name, levels }) {
  return Object.freeze({
    lang, code, language, mode: 'latin', prefsKey: `manabi:level-word:${code}`,
    hw: code, zheng: code, piece: code, exReading: code,
    levels, kinds: ['vocab'],
    levelOf: (key) => String(key).toUpperCase(),
    levelKeyOf: (level) => level,
    levelPill: (key) => String(key),
    levelHref: (key) => `/${lang}/words/${String(key).toLowerCase()}`,
    levelRank: (level) => CEFR.indexOf(level),
    tag: (level) => level,
    title: (level) => `${name} ${level} 단어`,
    scope: `${name} ${levels.join(' · ')}`,
    indexUrl: null,
    placeholder: '철자 · 뜻',
    searchHint: `철자(악센트 없이도) · 한국어 뜻으로 찾아요`,
    noneHint: '철자를 줄이거나 한국어 뜻으로 찾아 보세요.',
    Reading: Ipa,
    head: (e) => ({ hw: e.word, sub: e.reading }),
    Headword: LatinHeadword, HeadTag: LatinHeadTag, MeanTag: LatinMeanTag, Extras: LatinExtras,
    pieceDrill: false,
    loadTiles: null,
    tilesOf: null,
  });
}

export const ENGLISH_WORD_LANG = latinWordLang({ lang: 'english', code: 'en', language: 'English', name: '영어', levels: LATIN_WORD_LEVELS.english });
export const FRENCH_WORD_LANG = latinWordLang({ lang: 'french', code: 'fr', language: 'French', name: '프랑스어', levels: LATIN_WORD_LEVELS.french });

export default function LatinWordPage({ lang, ...props }) {
  return <LevelWordScreen cfg={lang === 'french' ? FRENCH_WORD_LANG : ENGLISH_WORD_LANG} {...props} />;
}
