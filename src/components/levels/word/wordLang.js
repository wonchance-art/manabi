'use client';
// 단어 페이지 언어 판(HSK · JLPT — 오너 확정 2026-10-19 KST) — 부품이 언어마다 다른 것(표제어 lang · 태그 · 읽기 줄 · 안내 문구)을 여기서 받는다.
// 판 자체(문자열 · 읽기 부품 · 글자 칸 함수)는 각 언어 화면 파일(views/LevelWordPage · views/JlptWordPage)이 만든다 —
// 이 부품들은 언어 값을 직접 적지 않아 일본어 라우트가 중국어 글꼴 범위 밖에 남는다(fontScope 계약).
import { createContext, useContext } from 'react';

export const WordLangContext = createContext(null);
export const useWordLang = () => useContext(WordLangContext);
