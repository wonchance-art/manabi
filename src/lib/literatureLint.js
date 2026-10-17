// 정본 책 장 글 점검(LIT-IMPORT-1, 오너 「불러오고 사용자들이 실사용 할 수 있을 정도로 다듬는 과정까지 모두 프로세스 최적화」 2026-10-17 KST).
//
// 출처마다 판 HTML·텍스트를 파서가 걸러도, 걸러지지 않은 찌꺼기가 장 글에 남는 일이 반복됐다(3차 묶음 실측: 표 칸 안 각주 번호
// 「642,607[143]」 · 장 끝 각주 목록 「[1] Reported in …」 · 「THE END」 · 위키문헌 이용 허락 안내 · 장 제목이 없어 모든 장이 책 제목인 판 ·
// 작은 대문자가 소문자로 남은 장 이름). 그때마다 눈으로 장 미리보기를 읽어 잡았다. 그 규칙을 여기 모은다 — 가져오기(import)와 빌드 계약이
// 같은 규칙을 쓴다(`literatureLint.test.js`가 리포의 모든 정본 책에 오류 0을 지킨다).
//
// 심각도: error = 싣기 전에 고친다(파서 · parse 설정) · warn = 사람이 한 번 본다(대개 원문 그대로가 맞다) · info = 참고(분량 고르기).

const WORD_LANGUAGES = new Set(['English', 'French']);

/** 장 분량 — 영어·프랑스어는 단어 수, 일본어·중국어·한국어는 공백 뺀 글자 수(빌드의 장 나눔 기준과 같다). */
export function chapterSize(text, language) {
  const value = String(text ?? '');
  return WORD_LANGUAGES.has(language) ? (value.match(/\S+/gu) || []).length : value.replace(/\s+/gu, '').length;
}

const RULES = Object.freeze([
  // 각주 번호가 글자에 붙어 남음(「coat.[19]」 · 「642,607[143]」) — 연도 같은 4자리 괄호(「[1795]」)는 본문이다
  { code: 'footnote-marker', level: 'error', test: (text) => /[^\s[]\[\d{1,3}\](?!\d)/u.exec(text) },
  // 장 끝 각주 목록 줄(「[1] Reported in the Washington Post」)
  { code: 'footnote-list', level: 'error', test: (text) => /(?:^|\n)\[\d{1,3}\] \S/u.exec(text) },
  // 판의 끝 표시 — 장 글이 아니다(parse stop 위치를 하나 앞으로)
  { code: 'end-marker', level: 'error', test: (text) => /(?:^|\n)(?:THE END|FIN|FINIS)\.?(?:\n|$)/u.exec(text) },
  // 출처 사이트 · 전자책 판의 안내 글(본문에 사이트 이름이 나오는 작품은 없다 — 나오면 사람이 본다)
  { code: 'site-boilerplate', level: 'error', test: (text) => /Project Gutenberg|Distributed Proofreaders|fadedpage|Faded Page|Standard Ebooks|Transcriber[’']s Note|This e-?book is|Wikisource|維基文庫|维基文库|위키문헌/iu.exec(text) },
  // 이용 허락 · 저작권 안내(위키문헌 틀 · 사이트 머리말)
  { code: 'license-text', level: 'error', test: (text) => /퍼블릭 도메인|공공누리|CC BY-SA|Creative Commons|저작권(?:이|은|자)|copyright (?:status|notice)|in the public domain in|public domain in (?:Canada|Australia|the United States)/iu.exec(text) },
  // 판 HTML 찌꺼기 — 태그 · 문자 참조
  // 문서 머리 틀이 본문으로 샌 자리(zh 「祝福」 실측 — 「作者：鲁迅 … 弟兄 →」 · 「本作品收录于《彷徨》」) — 작가 칸 · 앞뒤 편 화살표 줄
  { code: 'header-residue', level: 'error', test: (text) => /(?:^|\n)(?:[^\n]*作者[：:][^\n]*|本作品收[录錄][于於][^\n]*|[^\n]*\s[→←]|[←→]\s[^\n]*)(?:\n|$)/u.exec(text) },
  { code: 'markup-residue', level: 'error', test: (text) => /<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>|&(?:[a-z]+|#\d+|#x[0-9a-f]+);/iu.exec(text) },
  // 쪽 번호 표시(「[Pg 12]」 · 「{12}」) — 맨 숫자 한 줄은 시의 연 번호일 수 있어 warn
  { code: 'page-marker', level: 'error', test: (text) => /\[Pg\.? ?\d+\]|\{\d{1,4}\}/iu.exec(text) },
  { code: 'number-line', level: 'warn', test: (text) => /(?:^|\n)\d{1,4}\n(?!\n?\d)/u.exec(text) },
  // 보이지 않는 제어 글자 · 너비 없는 공백(조판 찌꺼기)
  { code: 'control-char', level: 'error', test: (text) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F​﻿]/u.exec(text) },
]);

const PART_SUFFIX = / \(\d+\/\d+\)$/u;

/**
 * 한 작품의 장들 → 점검 결과. chapters: chapters.json의 장({order, title, rawText}), book: {title, total}, language: 데이터 언어 이름.
 * target: 장 목표 분량(언어별 빌드 목표 — 없으면 분량 점검을 하지 않는다).
 * @returns {{code:string, level:'error'|'warn'|'info', order:number|null, sample:string}[]}
 */
export function lintLiteratureChapters({ chapters, book, language, target = null }) {
  const findings = [];
  const sample = (text, index) => text.slice(Math.max(0, index - 30), index + 50).replace(/\n/gu, '⏎');
  for (const chapter of chapters) {
    const text = String(chapter.rawText ?? '');
    if (!text.trim()) { findings.push({ code: 'empty-chapter', level: 'error', order: chapter.order, sample: chapter.title }); continue; }
    for (const rule of RULES) {
      const match = rule.test(text);
      if (match) findings.push({ code: rule.code, level: rule.level, order: chapter.order, sample: sample(text, match.index) });
    }
    // 작은 대문자가 소문자로 남은 장 이름(「exchange.」) — 라틴 글자 장 이름이 통째로 소문자
    const base = String(chapter.title ?? '').replace(PART_SUFFIX, '');
    if (/^[a-zà-ÿ][a-zà-ÿ ’'.,:;-]*$/u.test(base) && base.length > 3) findings.push({ code: 'lowercase-title', level: 'warn', order: chapter.order, sample: base });
  }
  // 장 제목이 없는 판 — 원문 쪽(파일)이 여럿인데 모든 장이 책 제목(「Capital, Volume I (3/8)」만 115장). 쪽 하나를 나눈 단편
  // (운수 좋은 날 (1/3) · 노인과 바다 (1/12))은 원작에 장 제목이 없는 것이라 그대로다.
  const bases = chapters.map((chapter) => String(chapter.title ?? '').replace(PART_SUFFIX, ''));
  const sources = new Set(chapters.map((chapter) => chapter.metadata?.literature?.sourcePage ?? chapter.metadata?.literature?.sourceFile ?? null));
  if (chapters.length > 2 && sources.size > 1 && bases.every((title) => title === book?.title)) {
    findings.push({ code: 'chapter-titles-missing', level: 'error', order: null, sample: `${chapters.length}장 모두 「${book.title}」` });
  }
  // 분량 — 아주 짧은 장 · 긴 장(정보: 원작 장이 짧은 것은 그대로 둔다 — 모비 딕 「The Prairie」)
  if (target) {
    for (const chapter of chapters) {
      const size = chapterSize(chapter.rawText, language);
      if (size < target * 0.1) findings.push({ code: 'tiny-chapter', level: 'info', order: chapter.order, sample: `${size} / 목표 ${target}` });
      else if (size > target * 1.8) findings.push({ code: 'long-chapter', level: 'info', order: chapter.order, sample: `${size} / 목표 ${target}` });
    }
  }
  return findings;
}

/** 결과 요약 — 심각도별 개수와 코드별 개수(가져오기 보고 · 빌드 출력 한 줄). */
export function summarizeLint(findings) {
  const byLevel = { error: 0, warn: 0, info: 0 };
  const byCode = {};
  for (const finding of findings) {
    byLevel[finding.level] += 1;
    byCode[finding.code] = (byCode[finding.code] ?? 0) + 1;
  }
  return { ...byLevel, byCode };
}
