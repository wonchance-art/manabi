// 편집기는 표시된 문자열만 변경하고, 문항 ID·출처·정답 인덱스 등은 보존한다.
export const CHAPTER_FIELD_LABELS = {
  title: '챕터 제목', topic: '주제', titleFr: '원어 제목', summary: '학습 안내', duration: '학습 시간',
  heading: '소제목', body: '본문', pattern: '핵심 표현', patternKo: '표현 뜻', tip: '학습 팁',
  pitfall: '주의할 표현', vsKo: '한국어와 비교', vsEn: '영어와 비교', hanja: '한자어 연결', etym: '어원',
  examples: '예문', dialogue: '대화', speaker: '화자', ja: '일본어', zh: '중국어', fr: '프랑스어', en: '영어',
  ko: '한국어 뜻', yomi: '읽는 법', pinyin: '병음', ipa: '발음 표기', note: '설명',
  table: '표', headers: '열 제목', rows: '내용', story: '읽기 자료', questions: '확인 문제',
  prompt: '문제', choices: '선택지', answer: '정답', explanation: '해설', hint: '힌트',
  drills: '연습 문제', writing: '쓰기 연습', hints: '도움 표현', samples: '답안 예시', checklist: '확인할 점',
  presentationFraming: '장면 안내', transitionNote: '다음 단계 안내', vocabs: '학습 단어',
};

const LOCKED = new Set(['id', 'slug', 'level', 'order', 'type', 'status', 'src', 'provider', 'license',
  'by', 'basedOn', 'grade', 'youtubeId', 'url', 'audioUrl', 'storagePath', 'prerequisites', 'kanjiExempt']);

export function editableEntries(node) {
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).filter(([key, value]) => !LOCKED.has(key)
    && (typeof value === 'string' || (value && typeof value === 'object')));
}

export function updateChapterValue(chapter, path, value) {
  const copy = structuredClone(chapter);
  let node = copy;
  for (const key of path.slice(0, -1)) node = node[key];
  node[path.at(-1)] = value;
  return copy;
}

export function chapterEditorHref(lang, slug) {
  const params = new URLSearchParams();
  if (lang) params.set('lang', lang);
  if (slug) params.set('slug', slug);
  return `/admin/textbooks${params.size ? `?${params}` : ''}`;
}
