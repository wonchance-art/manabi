'use client';
// 문법 자세히 보기(오너 확정 2026-08-18) — 드래그 지정 문장의 문법을 온디맨드로 1회 해설한다.
// 기존 '문법 해설 모달'의 6항목 체크박스를 걷어내고, 시트 좌측(번역·맥락) 아래 인라인으로
// 펼치는 단일 [자세히] 경로로 통합했다.
//
// 설계 근거:
// - 번역·어휘는 이미 드래그 자동 경로(좌 번역·맥락 / 우 단어 목록)가 준다 → 중복 제거.
// - 남길 것은 '구조 분해'와 '재사용 가능한 패턴' 둘인데, 서로 같은 말을 반복하므로 한 번에
//   묶어 모델이 중복을 스스로 제거하게 한다.
// - 판별된 패턴을 우리 레퍼런스 문법 챕터로 연결해 일회성 소비를 자산 진입점으로 바꾼다.
// - 언어별 문법 축이 다르다: 중국어에는 조사가 없다(어순·개사·양사·보어·把/被).
//   기존 코드가 '일본어가 아니면 영어' 이분법이라 중국어에 조사를 묻던 결함을 여기서 끊는다.

/** 문장 단위 localStorage 캐시 키 — 좌측 번역(viewer_tx)과 같은 관례. */
export function grammarCacheKey(language, text) {
  return `viewer_gr:${language}:${String(text || '').slice(0, 200)}`;
}

const AXES = {
  Japanese: '주어·서술어·목적어·조사(격조사/부조사)·활용형',
  Chinese: '어순·주어·술어·목적어·개사(전치사)·양사·보어·시간사 (※ 중국어에는 조사가 없다 — 조사로 설명하지 말 것)',
  English: '주어·동사·목적어·시제·관사·전치사·어순',
  French: '주어·동사·목적어·시제·관사·전치사·성수 일치',
};

/** 챕터 후보 목록(slug·급수·주제)을 프롬프트용 줄로. 너무 길면 잘라 토큰을 지킨다. */
export function formatChapterCandidates(chapters, limit = 120) {
  return (chapters || [])
    .filter((ch) => ch?.slug && (ch.topic || ch.title))
    .slice(0, limit)
    .map((ch) => `${ch.slug} | ${ch.level || ''} | ${ch.topic || ch.title}`)
    .join('\n');
}

/**
 * 통합 문법 프롬프트 — 구조(이 문장) + 패턴(다음 문장에 쓸 규칙)을 한 번에, 중복 없이.
 * @param {string} text 지정 문장
 * @param {string} language materialLang
 * @param {string} chapterList formatChapterCandidates 결과(비어도 됨)
 */
export function buildGrammarPrompt(text, language, chapterList = '') {
  const axis = AXES[language] || AXES.English;
  const langKo = { Japanese: '일본어', Chinese: '중국어', English: '영어', French: '프랑스어' }[language] || language;
  const chapterBlock = chapterList
    ? `\n## 연결 가능한 정본 챕터 (slug | 급수 | 주제)\n${chapterList}\n`
    : '';
  const chapterRule = chapterList
    ? '- 챕터: 위 목록에서 이 패턴과 가장 가까운 slug 하나. 적절한 것이 없으면 줄 자체를 생략'
    : '';
  return `${langKo} 문장 「${text}」의 문법을 한국어로 해설해주세요.

## 출력 형식 (이 4~5줄만, 각 줄은 "레이블: 내용")
구조: (문장 성분 분해 — ${axis})
패턴: (이 문장이 쓰는 재사용 가능한 규칙 한 줄)
예문: (같은 패턴의 다른 짧은 예문 1개${language === 'Chinese' ? ' + 병음' : ''})
활용: (적용 범위·주의점 한 줄)
${chapterList ? '챕터: (slug 하나)' : ''}${chapterBlock}
## 규칙
- 뜻·번역·단어 뜻풀이는 쓰지 말 것(다른 화면이 이미 보여준다)
- 구조와 패턴이 같은 말이 되지 않게 — 구조는 이 문장, 패턴은 일반 규칙
- 각 줄은 한 줄로(줄바꿈 금지), 군더더기·도입 문구 금지
${chapterRule}`;
}

/**
 * 응답 파싱 — 레이블 줄을 뽑고 '챕터:' 줄은 화면에서 분리해 링크로 만든다.
 * @returns {{body: string, chapterSlug: string|null}}
 */
export function parseGrammarResult(raw, validSlugs) {
  const lines = String(raw || '').split('\n');
  const kept = [];
  let chapterSlug = null;
  for (const line of lines) {
    const m = line.match(/^\s*(?:\*\*)?챕터(?:\*\*)?\s*[:：]\s*(.+?)\s*$/);
    if (m) {
      const slug = m[1].replace(/[`*'"]/g, '').trim();
      if (!validSlugs || validSlugs.has(slug)) chapterSlug = slug;
      continue; // 본문에서는 감춘다 — 링크로만 노출
    }
    kept.push(line);
  }
  return { body: kept.join('\n').trim(), chapterSlug };
}

/** 좌측 번역·맥락 프롬프트 — 말투(뉘앙스)는 학습에 유의미할 때만 붙는 조건부 줄. */
export function buildContextPrompt(text, langKo) {
  return `다음 ${langKo} 텍스트를 한국어로 처리해주세요.

"${text}"

아래 형식 정확히 따라 출력. 도입 문구 없이 바로:

**번역**
자연스러운 한국어 번역

**맥락**
내용 이해를 돕는 배경 설명 2~3문장

**말투**
격식·반말 차이나 화자 관계가 학습에 유의미할 때만 한 줄. 서술문·설명문처럼
말투를 따질 필요가 없으면 이 항목(제목 포함)을 통째로 생략

규칙: 마크다운 **굵게**만 사용, 간결하게`;
}
