import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { failureMessage, RETRY_LATER_MESSAGE, UNKNOWN_ERROR_MESSAGE } from '../errorMessage';

// COPY-STD-001 — 화면 문구 표준(docs/design/copy-standard.md §4)의 문구 린트.
// 화면 코드(src/app · src/components · src/views)의 문자열 리터럴 · JSX 텍스트에 표준이 쓰지 않는 형태가 나오면 실패한다.
// 학습 내용(src/content)과 테스트(__tests__ · *.test.*)는 검사 밖이다. 주석은 지우고 본다.
//
// 처음 켤 때 남은 위반은 허용 목록이 아니라 고쳐서 0으로 시작했다(2026-10-13 KST).
// 허용 목록은 화면 문구가 아닌 자리(학습 언어 텍스트 · AI 프롬프트)만 — 파일과 그 줄의 고유 조각, 이유를 함께 적는다.

const ROOT = join(process.cwd(), 'src');
const SCREEN_DIRS = ['app', 'components', 'views'];

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(path, out); }
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) out.push(path);
  }
  return out;
};

// 주석을 같은 길이의 공백으로 바꾼다(줄 번호 유지). 「https://」처럼 문자열 안의 // 는 남긴다.
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

// 금지 형태 — copy-standard.md §4. 「...」는 JS 펼침 문법(...rest)과 섞이므로 화면 문구인 자리만 본다:
// 한글 앞뒤에 붙은 세 점(「불러오는 중...」 「... 더 보기」), 세 점만 있는 문자열('...'), 세 점만 있는 JSX 텍스트(>...<).
const RULES = [
  { form: '해주세요', re: /해주세요/g },
  { form: '하시겠습니까', re: /하시겠습니까/g },
  { form: '실패했습니다', re: /실패했습니다/g },
  { form: '로딩 중...', re: /로딩 중\.\.\./g },
  { form: '...', re: /[가-힣]\s?\.\.\.|\.\.\.\s?[가-힣]|'\.\.\.'|>\s*\.\.\.\s*</g },
  { form: '저장!', re: /저장!/g },
  // 실패는 「…지 못했어요」(§2) — 「가져올 수 없었어요」처럼 「…ㄹ 수 없었어요」로 쓰지 않는다(「…ㄹ 수 없어요」는 규칙상 못 하는 일 전용).
  { form: '할 수 없었어요', re: /수 없었어요/g },
  // 같은 동작을 다시 할 때는 「다시 시도」(§2) — 대화의 「다시 받기」가 남아 있었다(2026-10-17 KST).
  { form: '다시 받기', re: /다시 받기/g },
  // 옛 메뉴 이름 — 지금은 「서재」(메뉴 정본 src/lib/webNavigation.js). 코드 주석은 검사 밖이다.
  { form: '자료실', re: /자료실/g },
];

const ALLOWLIST = [
  { file: 'components/world/npcScripts.js', snippet: 'Trois, quatre, cinq... prix spécial ! (트루아 외로 르 킬로. 트루아, 카트르, 상크... 프리 스페시알!)', reason: 'NPC 대사의 학습 언어 원문과 읽기 — 학습 내용이다' },
  { file: 'components/world/npcScripts.js', snippet: "ko: '1킬로에 3유로예요. 3, 4, 5... 특가!'", reason: 'NPC 대사(학습 언어 원문)의 대역 — 원문의 말줄임을 그대로 옮긴 학습 내용이다' },
  { file: 'components/world/lyonDoors.js', snippet: "gloss: '뭘 추천해주세요? (메뉴 조언)'", reason: '도어 표현의 대역(gloss) — 학습 내용이다' },
  { file: 'views/VocabPage.jsx', snippet: '자연스러운 문장으로 작성해주세요.', reason: 'AI 예문 생성 프롬프트 — 화면에 나오지 않는다' },
];

function violations(files) {
  const found = [];
  for (const path of files) {
    const file = relative(ROOT, path).replaceAll('\\', '/');
    const lines = stripComments(readFileSync(path, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      for (const { form, re } of RULES) {
        re.lastIndex = 0;
        if (!re.test(line)) continue;
        if (ALLOWLIST.some(a => a.file === file && line.includes(a.snippet))) continue;
        found.push(`${file}:${index + 1} 「${form}」 ${line.trim().slice(0, 120)}`);
      }
    });
  }
  return found;
}

const SCREEN_FILES = SCREEN_DIRS.flatMap(dir => walk(join(ROOT, dir)));

describe('문구 린트 — 화면 코드의 금지 형태(copy-standard.md §4)', () => {
  it('검사 대상이 실제로 있다(경로가 바뀌어 공허 통과하지 않는다)', () => {
    expect(SCREEN_FILES.length).toBeGreaterThan(300);
    expect(SCREEN_FILES.some(p => p.endsWith(join('views', 'ViewerPage.jsx')))).toBe(true);
    expect(SCREEN_FILES.some(p => p.includes(join('src', 'content')))).toBe(false);
  });

  it('src/app · src/components · src/views에 금지 형태가 없다', () => {
    expect(violations(SCREEN_FILES)).toEqual([]);
  });

  it('규칙이 금지 형태를 잡고, 펼침 문법 · 주석 · 띄어 쓴 형태는 잡지 않는다', () => {
    const hit = (text) => RULES.filter(({ re }) => { re.lastIndex = 0; return re.test(stripComments(text)); }).map(r => r.form);
    expect(hit("toast('다시 시도해주세요.')")).toEqual(['해주세요']);
    expect(hit("title: '정말 삭제하시겠습니까?'")).toEqual(['하시겠습니까']);
    expect(hit("setError('저장에 실패했습니다.')")).toEqual(['실패했습니다']);
    expect(hit('<Spinner message="로딩 중..." />')).toEqual(['로딩 중...', '...']);
    expect(hit("{busy ? '저장 중...' : '저장'}")).toEqual(['...']);
    expect(hit("{pending ? '...' : '등록'}")).toEqual(['...']);
    expect(hit('<span>...</span>')).toEqual(['...']);
    expect(hit('toast(`"${word}" 저장!`)')).toEqual(['저장!']);
    expect(hit("const next = { ...prev, [key]: true }; <Card {...props} />")).toEqual([]);
    expect(hit("toast('다시 시도해 주세요.') // 다시 시도해주세요... 저장!")).toEqual([]);
    expect(hit("{busy ? '저장 중…' : '저장했어요'}")).toEqual([]);
    expect(hit("detail: '설명을 가져올 수 없었어요.'")).toEqual(['할 수 없었어요']);
    expect(hit("<button>다시 받기</button>")).toEqual(['다시 받기']);
    expect(hit("a: '자료실에서 글을 올려요'")).toEqual(['자료실']);
    expect(hit("detail: '설명을 가져오지 못했어요.' // 자료실 · 다시 받기")).toEqual([]);
    expect(hit("'줄을 넘어서는 묶을 수 없어요'")).toEqual([]);
  });

  it('허용 목록의 각 줄은 지금도 그 파일에 있다(고쳐진 예외를 목록에 남기지 않는다)', () => {
    for (const { file, snippet, reason } of ALLOWLIST) {
      expect(reason.length, file).toBeGreaterThan(5);
      expect(readFileSync(join(ROOT, file), 'utf8'), `${file}: ${snippet}`).toContain(snippet);
    }
  });
});

describe('실패 토스트 — failureMessage(errorMessage.js 정본)', () => {
  it('「…하지 못했어요.」 뒤에 원인 안내 한 문장 — 모르는 오류는 원문 대신 「잠시 후 다시 시도해 주세요.」', () => {
    expect(failureMessage('단어를 저장하지 못했어요.', new Error('TypeError: x is undefined'))).toBe(`단어를 저장하지 못했어요. ${RETRY_LATER_MESSAGE}`);
    expect(failureMessage('단어를 저장하지 못했어요.', null)).toBe('단어를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('알려진 오류는 정해 둔 안내, 우리 한국어 안내는 그대로 붙인다', () => {
    expect(failureMessage('복습을 저장하지 못했어요.', new Error('Failed to fetch'))).toMatch(/^복습을 저장하지 못했어요\. 인터넷 연결을 확인해 주세요\./);
    expect(failureMessage('자료를 휴지통으로 옮기지 못했어요.', new Error('자료가 바뀌었어요. 다시 확인해 주세요.')))
      .toBe('자료를 휴지통으로 옮기지 못했어요. 자료가 바뀌었어요. 다시 확인해 주세요.');
  });

  it('원인 모르는 오류의 고정 문구(「문제가 발생했어요」)를 실패 문장 뒤에 겹쳐 붙이지 않는다', () => {
    expect(failureMessage('저장하지 못했어요.', new Error('boom'))).not.toContain(UNKNOWN_ERROR_MESSAGE);
  });
});

// COPY-EN-001(2026-10-17 KST) — §1 「화면 문구에 영어 원문을 쓰지 않는다」. 읽기 확인의 「New Test」 「Close」처럼
// 버튼 · 안내가 영어로 남아 있던 것을 기존 한국어 라벨로 바꿨다. 새 영어 라벨이 화면에 들어오지 않게 막는다.
// 보는 자리: 영어만 있는 JSX 글(>Close<)과 aria-label · title · placeholder · alt 속성. 관리 화면(admin)과 개발 동결된 월드(world)는 밖이다.
// 허용 목록 = 의도한 영어(상호 · 서비스 이름 · 키 이름 · 예시 주소)와 오너 결정 대기(영문 눈썹 글) — 파일 · 글 · 이유를 함께 적는다.
const EN_EXCLUDED_DIRS = ['admin', 'world'];
const EN_EXCLUDED_FILES = ['views/AdminPage.jsx', 'views/WorldPage.jsx', 'views/WorldMapPage.jsx'];
const EN_OWNER_PENDING = '영문 눈썹 글(디자인 장식) — 한국어로 바꿀지 오너 결정 대기(COPY-EN-001 보고 2026-10-17 KST)';
const EN_ALLOWLIST = [
  { file: 'app/privacy/page.jsx', text: 'Supabase', reason: '처리 위탁 서비스 이름(고유명사)' },
  { file: 'app/privacy/page.jsx', text: 'Google Gemini, Groq', reason: '처리 위탁 서비스 이름(고유명사)' },
  { file: 'components/notes/NoteRecognition.jsx', text: 'Google Gemini', reason: '서비스 이름(고유명사)' },
  { file: 'components/classroom/BoardInkRecognition.jsx', text: 'Google Gemini', reason: '서비스 이름(고유명사)' },
  { file: 'components/LiteraturePublishPanel.jsx', text: 'src/content/art', reason: '저장 경로 표시(코드 경로)' },
  { file: 'components/LiteraturePublishPanel.jsx', text: 'src/content/literature', reason: '저장 경로 표시(코드 경로)' },
  { file: 'components/Layout.jsx', text: 'manabi', reason: '서비스 이름(로고)' },
  { file: 'components/books/BookCover.jsx', text: 'manabi books', reason: '표지 상호(로고 글)' },
  { file: 'components/levels/HanziBoard.jsx', text: 'Space', reason: '키보드 키 이름' },
  { file: 'components/levels/HanziBoard.jsx', text: 'Esc', reason: '키보드 키 이름' },
  { file: 'components/MaterialAddLinkSection.jsx', text: 'https://youtu.be/…', reason: '입력 예시 주소' },
  { file: 'components/materials/MaterialComposer.jsx', text: 'https://', reason: '입력 예시 주소' },
  { file: 'views/AuthPage.jsx', text: 'hello@example.com', reason: '입력 예시 메일 주소' },
  ...[
    ['components/materials/SuggestionReader.jsx', 'MANABI / READINGS'],
    ['components/materials/OriginalMaterialReader.jsx', 'KEPT FOR ANOTHER DAY'],
    ['components/materials/OriginalMaterialReader.jsx', 'ORIGINAL LINK'],
    ['components/materials/PassageStudy.jsx', 'READ INTO LEARNING'],
    ['components/materials/PassageStudy.jsx', 'A PASSAGE TO KEEP'],
    ['components/materials/MaterialComposer.jsx', 'YOUR LIBRARY'],
    ['components/materials/MaterialComposer.jsx', 'SAVED TO YOUR LIBRARY'],
    ['components/materials/MaterialComposer.jsx', 'A PAGE OF YOUR OWN'],
    ['components/notes/StudyNotePage.jsx', 'PERSONAL NOTEBOOK'],
    ['components/notes/NoteVocabulary.jsx', 'MY WORDS'],
    ['components/books/BookMaterials.jsx', 'BEYOND THE BOOK'],
    ['components/books/BookReview.jsx', 'WORDS TO KEEP'],
    ['views/VocabPage.jsx', 'THE REVIEW ROOM'],
    ['components/classroom/ClassroomUI.jsx', 'MANABI / CLASS'],
    ['components/classroom/ClassroomUI.jsx', 'manabi / class'],
    ['views/ClassBoardPage.jsx', 'manabi / class'],
    ['views/ClassHubPage.jsx', 'MANABI / CLASS'],
  ].map(([file, text]) => ({ file, text, reason: EN_OWNER_PENDING })),
];

function englishLabels(files) {
  const found = [];
  for (const path of files) {
    const file = relative(ROOT, path).replaceAll('\\', '/');
    if (EN_EXCLUDED_FILES.includes(file) || file.split('/').some(part => EN_EXCLUDED_DIRS.includes(part))) continue;
    const lines = stripComments(readFileSync(path, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      const texts = [
        ...[...line.matchAll(/>\s*([A-Za-z][A-Za-z '/&!?.,:-]{2,})\s*</g)].map(m => m[1].trim())
          // 「count && <…」 「a?.b」 「x ? <…」처럼 JSX 사이의 코드 조각은 글이 아니다.
          .filter(t => !/&&|\?\.|\w\.\w|\?$/.test(t)),
        ...[...line.matchAll(/(?:aria-label|title|placeholder|alt)=["']([^"'{}]+)["']/g)].map(m => m[1]),
      ].filter(t => /[A-Za-z]{3,}/.test(t) && !/[가-힣]/.test(t));
      for (const text of texts) {
        if (EN_ALLOWLIST.some(a => a.file === file && a.text === text)) continue;
        found.push(`${file}:${index + 1} 「${text}」`);
      }
    });
  }
  return found;
}

describe('문구 린트 — 화면에 영어 라벨을 두지 않는다(copy-standard.md §1, COPY-EN-001)', () => {
  it('src/app · src/components · src/views의 JSX 글 · 접근성 이름에 허용 목록 밖 영어가 없다', () => {
    expect(englishLabels(SCREEN_FILES)).toEqual([]);
  });

  it('읽기 확인 결과는 기존 한국어 라벨을 쓴다(다시 풀기 · 닫기 · 채점 · 내 답 · 정답)', () => {
    const src = readFileSync(join(ROOT, 'components/ReadingTest.jsx'), 'utf8');
    // 「2/5 answered」 → 「2/5」 — 숫자만 쓰는 진행 표시 선례(RefPatternCheck · ExerciseEnginePrototype의 n/m), 오너 「권장대로」 2026-10-17 KST.
    expect(src).toContain("{allAnswered ? '채점' : `${Object.keys(answers).length}/${questions.length}`}");
    for (const old of ['New Test', '>Close<', 'Submit & Grade', 'Your answer:', 'Correct:', 'Excellent!', 'Good job.', 'Try reading the passage', ' answered']) {
      expect(src, old).not.toContain(old);
    }
    for (const label of ['>다시 풀기</Button>', '>닫기</Button>', "'채점'", '내 답: {e.yourAnswer}', '정답: {e.correctAnswer}']) {
      expect(src, label).toContain(label);
    }
    // 결과 세 문장은 뷰어 퀴즈(ViewerQuizModal)와 같은 글이다 — 한쪽만 바뀌면 같은 상황에 두 문구가 된다(§3).
    const quiz = readFileSync(join(ROOT, 'views/ViewerQuizModal.jsx'), 'utf8');
    for (const line of ['완벽해요! 내용을 완전히 이해했네요.', '잘 읽었어요. 틀린 부분을 다시 확인해보세요.', '단어를 복습하고 다시 읽어보세요.']) {
      expect(src, line).toContain(line);
      expect(quiz, line).toContain(line);
    }
  });

  it('규칙이 영어 라벨을 잡고, 코드 조각 · 한국어 섞인 글은 잡지 않는다', () => {
    const scan = (text) => {
      const t = [...stripComments(text).matchAll(/>\s*([A-Za-z][A-Za-z '/&!?.,:-]{2,})\s*</g)].map(m => m[1].trim()).filter(x => !/&&|\?\.|\w\.\w|\?$/.test(x));
      return [...t, ...[...text.matchAll(/(?:aria-label|title|placeholder|alt)=["']([^"'{}]+)["']/g)].map(m => m[1])].filter(x => /[A-Za-z]{3,}/.test(x) && !/[가-힣]/.test(x));
    };
    expect(scan('<Button onClick={reset}>New Test</Button>')).toEqual(['New Test']);
    expect(scan('<button aria-label="Close dialog">×</button>')).toEqual(['Close dialog']);
    expect(scan('{count > 0 && <span>{count}</span>}')).toEqual([]);
    expect(scan('{seg.kanji? <b/> : null}')).toEqual([]);
    expect(scan('<span>JLPT N5 단어</span><button aria-label="닫기">OK</button>')).toEqual([]);
  });

  it('영어 허용 목록의 각 글은 지금도 그 파일에 있다', () => {
    for (const { file, text, reason } of EN_ALLOWLIST) {
      expect(reason.length, file).toBeGreaterThan(5);
      expect(readFileSync(join(ROOT, file), 'utf8'), `${file}: ${text}`).toContain(text);
    }
  });
});
