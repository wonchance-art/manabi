'use client';
// 카드 세 종류의 문제 면(CARD-TYPES-001 §2 · 오너 결정 2026-11-01 KST · 실렌더 시안 승인) — 단어 페이지(한 단어 · 리스트)와 복습실이 같은 부품을 쓴다.
//   단어 → 뜻 = 표제어(각 화면의 표제어 부품) · 뜻 → 단어 = 뜻(MeaningFace — 표제어와 같은 크기 규칙) · 듣기 = 소리 단추만(ListenFace — 실제 듣기 단추를 키움).
// 종류 글씨(「뜻 → 단어」 · 「듣기 카드」)는 어디에도 붙이지 않는다 — 문제 면만으로 구분된다. 문제 면에는 후리가나를 넣지 않는다(맨 글자),
// 답 면(예문 · 표제어 루비)에는 늘 넣는다 — 그 규칙은 각 화면의 답 면 부품(Example · ReviewHeadword)이 진다.
import { Listen, SpeakerIcon } from '@/components/levels/word/WordParts';
import './card-faces.css';

const LATIN = /[\p{Script=Latin}0-9]/u;
/**
 * 문제 면 글자 크기의 칸 수(--n) — 언어와 무관한 한 규칙(지금 lw-card__hw · lw-one__hw): 글자 하나 = 1칸, 로마자 · 숫자는 반 칸(latinN과 같은 0.55).
 * 한국어 뜻은 한 글자 = 1칸 — 표제어(経験 · 약속)와 같은 줄 높이 · 같은 크기로 선다(시안 7 · 정렬).
 */
export function faceN(text) {
  let n = 0;
  for (const ch of String(text || '')) n += LATIN.test(ch) ? 0.55 : 1;
  return Math.max(1, Math.round(n * 10) / 10);
}

/** 뜻 문제 면 — className은 화면의 표제어 칸(한 단어 lw-one__hw · 리스트 lw-card__hw · 복습실 review-card__word). as = 그 칸의 요소. */
export function MeaningFace({ meaning, className, as: Tag = 'span', id }) {
  return <Tag id={id} className={`${className} cf-meaning`} lang="ko" style={{ '--n': faceN(meaning) }}>{meaning}</Tag>;
}

/**
 * 듣기 문제 면 — 글자 없이 실제 듣기 단추(Listen)를 키운 것. size 'one' = 한 단어 앞면 · 복습실(누르는 자리 72px · 아이콘 34px),
 * 'row' = 리스트 접힌 줄(줄 첫머리 · 아이콘 28px — 그린 왼쪽 = 다른 줄 글자 왼쪽). speak가 없는 기기(소리 없음)는 단추 대신 빈 자리.
 */
export function ListenFace({ speak, text, size = 'one', label = '문장 듣기' }) {
  if (!speak) return <span className={`cf-play cf-play--${size} cf-play--off`} aria-hidden="true"><SpeakerIcon /></span>;
  return <Listen speak={speak} text={text} label={label} className={`lw-listen cf-play cf-play--${size}`} />;
}

/**
 * 네 칸 위 안내 줄(리스트 모드) — 지금 채점할 카드의 문제 면과 같다(답을 흘리지 않게): 단어 → 뜻 = 표제어, 뜻 → 단어 = 뜻, 듣기 = 소리 아이콘.
 * hw · hwLang = 표제어(판의 head(entry).hw · 판 lang).
 */
export function GuideFace({ kind, meaning, hw, hwLang }) {
  if (kind === 'production') return <b lang="ko">{meaning}</b>;
  if (kind === 'listening') return <span className="cf-guide-icon" role="img" aria-label="소리"><SpeakerIcon /></span>;
  return <b lang={hwLang}>{hw}</b>;
}
