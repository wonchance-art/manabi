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
