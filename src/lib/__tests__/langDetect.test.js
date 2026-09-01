import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { detectLang, detectLangConfident, langFromBcp47 } from '../constants.js';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 언어 판별 — 「보여 줄 값」과 「저장해도 되는 값」을 가른다 (2026-09-01).
 *
 * ── 무엇이 문제였나
 *
 * `detectLang`은 `/[가나·한자]/ ? 'Japanese' : 'English'` **2트랙**이었다. 4언어를 여는
 * 동안 이 함수는 따라오지 않았고, 그것만이면 화면 폴백이라 손해가 작다.
 *
 * 진짜 손해는 `vocabIO.fetchVocabFromNetwork`에 있었다 — **같은 판별을 복제해** 놓고
 * 그 답을 `user_vocabulary.language`에 **UPDATE로 박고** 있었다. `language`가 빈 옛
 * 중국어 행은 단어장을 한 번 여는 것만으로 `Japanese`로 굳고(프랑스어는 `English`),
 * 원래 언어를 모르니 되돌릴 수도 없다. 표기만으로 못 가르는 것을 영구화한 것이다.
 *
 * ── 규칙
 *
 * 표기가 **결정적일 때만** 답한다(`detectLangConfident`):
 *   가나 → 일본어 (중국어에 가나가 없다)
 *   프랑스어 발음부호 → 프랑스어
 *   한자만 / 라틴만 → **null** — `会社`도 `table`도 두 언어에 다 있다
 * 화면은 `detectLang`이 기본값을 얹어 예전과 같은 모양을 유지한다. 저장은 못 한다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('① 확신 판별 — 애매하면 답하지 않는다', () => {
  it('가나가 있으면 일본어다', () => {
    for (const w of ['ひらがな', 'カタカナ', '勉強する', '食べます', 'お願いします']) {
      expect(detectLangConfident(w), w).toBe('Japanese');
    }
  });

  it('프랑스어 발음부호가 있으면 프랑스어다 — 예전엔 영어로 읽혔다', () => {
    for (const w of ['été', 'cinéma', 'français', 'où', 'cœur', 'à', 'hôtel', 'naïve']) {
      expect(detectLangConfident(w), w).toBe('French');
    }
  });

  it('한자만이면 답하지 않는다 — ja·zh가 공유하는 표기다', () => {
    // 넷 다 일본어 단어이기도 하고 중국어 단어이기도 하다. 표기로는 못 가른다.
    for (const w of ['会社', '学生', '電話', '先生']) {
      expect(detectLangConfident(w), `${w}를 한쪽으로 단정했다`).toBeNull();
    }
  });

  it('발음부호 없는 라틴이면 답하지 않는다 — en·fr이 공유한다', () => {
    for (const w of ['table', 'important', 'nation', 'orange', 'train']) {
      expect(detectLangConfident(w), `${w}를 한쪽으로 단정했다`).toBeNull();
    }
  });

  it('빈 값에도 죽지 않는다', () => {
    for (const w of [null, undefined, '', 0]) expect(detectLangConfident(w)).toBeNull();
  });
});

describe('② 화면 폴백 — 예전 동작을 유지한다', () => {
  it('한자·가나는 일본어, 그 밖은 영어 (2트랙 시절과 같은 답)', () => {
    expect(detectLang('会社')).toBe('Japanese');
    expect(detectLang('ひらがな')).toBe('Japanese');
    expect(detectLang('table')).toBe('English');
    expect(detectLang('')).toBe('English');
  });

  it('바뀐 것은 프랑스어 하나뿐이다 — TTS 목소리가 맞아진다', () => {
    expect(detectLang('été')).toBe('French');       // 예전: 'English'
    expect(detectLang('cinéma')).toBe('French');
  });

  it('폴백은 확신 판별 위에 얹힌다 — 규칙이 두 벌이 아니다', () => {
    const body = sliceBetween(read('src/lib/constants.js'), 'export function detectLang(', '\n}');
    expect(body, '화면 폴백이 판별을 따로 구현했다').toContain('detectLangConfident(');
  });
});

describe('③ 저장 — 추측을 DB에 박지 않는다', () => {
  const io = () => read('src/lib/vocabIO.js');

  it('backfill이 확신 판별만 쓴다', () => {
    const body = sliceBetween(io(), 'const needsUpdate = [];', '\n  });');
    expect(body, 'backfill이 확신 없는 값을 쓴다').toContain('detectLangConfident(');
    expect(body, 'backfill이 화면용 폴백(detectLang)을 썼다 — 추측이 DB에 박힌다')
      .not.toMatch(/[^t]detectLang\(/);
  });

  it('확신이 없으면 그 행은 건드리지 않는다 — UPDATE 대상에 안 들어간다', () => {
    const body = sliceBetween(io(), 'const needsUpdate = [];', '\n  });');
    // null이면 needsUpdate에 넣기 **전에** 빠져나가야 한다
    const guard = body.indexOf('if (!lang) return v;');
    const push = body.indexOf('needsUpdate.push');
    expect(guard, '애매한 행을 거르는 가드가 없다').toBeGreaterThan(-1);
    expect(guard, '가드가 push보다 뒤에 있다 — 추측이 이미 실린다').toBeLessThan(push);
  });

  it('판별기가 여러 벌이 아니다 — 표기로 언어를 단정하는 삼항이 없다', () => {
    // ⚠ 「CJK 문자 클래스가 있으면 복제」로 재면 **정당한 한자 판별까지** 잡는다
    //    (`patternIndex`·`refQuiz`가 그렇다 — 언어 판별이 아니라 글자 종류 검사다).
    //    결함의 실제 모양은 **`? 'Japanese' : 'English'` 삼항**이다. 그것만 금한다.
    const walk = (dir, out = []) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '__tests__') continue;
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p, out);
        else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
      }
      return out;
    };
    // 주석은 걷어낸다 — 「예전엔 이랬다」고 적어 둔 문장이 스스로 걸리면 계약이 못 산다
    // (죽은 CSS 라운드에서 같은 자기 참조를 두 번 밟았다).
    const strip = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, ' ');
    // 금지 모양은 **2트랙 접기** 하나다 — `? 'Japanese' : 'English'`.
    // 4언어를 갈래로 늘어놓는 것(EPUB 태그 매핑 등)은 접는 게 아니라 옮기는 것이라 무관하다.
    const TWO_TRACK = /\?\s*'Japanese'\s*:\s*'English'/;
    const CANON = 'src/lib/constants.js';   // 화면 폴백의 기본값이 사는 유일한 자리
    const dupes = walk(path.join(process.cwd(), 'src'))
      .map((f) => path.relative(process.cwd(), f))
      .filter((f) => f !== CANON)
      .filter((f) => TWO_TRACK.test(strip(read(f))));
    expect(dupes, `2트랙 언어 접기가 남았다(정본은 constants.js 하나): ${dupes.join(', ')}`)
      .toEqual([]);
  });

  it('BCP-47 매퍼가 정본 4언어를 덮는다 — EPUB 반입이 언어를 흘리지 않는다', () => {
    // 실측: `importWholeBook`은 ja/en/zh 3갈래, `importPicked`는 ja/en 2갈래였다.
    // 프랑스어 EPUB은 양쪽에서, 중국어 EPUB은 한쪽에서 `null`로 떨어졌다.
    for (const [tag, want] of [['ja', 'Japanese'], ['en-US', 'English'],
      ['zh-Hans', 'Chinese'], ['fr', 'French']]) {
      expect(langFromBcp47(tag), tag).toBe(want);
    }
    expect(langFromBcp47('ko')).toBeNull();
    expect(langFromBcp47(null)).toBeNull();
    const epub = read('src/components/MaterialAddEpubSection.jsx');
    expect((epub.match(/langFromBcp47\(/g) || []).length,
      'EPUB 반입 두 자리가 같은 매퍼를 쓰지 않는다').toBe(2);
  });

  it('수동 담기도 추측을 저장하지 않는다 — 사용자가 고른 언어가 없으면 비운다', () => {
    // 실측: 여기가 `draft.language || (isJa ? 'Japanese' : 'English')`였다. 언어 칸을
    // 안 고르고 중국어 단어를 손으로 담으면 **일본어로 굳었다.**
    const body = sliceBetween(read('src/views/VocabPage.jsx'), 'const guess =', 'next_review_at');
    expect(body, '수동 담기가 확신 판별을 안 쓴다').toContain('detectLangConfident(');
    expect(body, '확신 없는 값을 language에 그대로 싣는다 — 조건부로 빼야 한다')
      .toContain('...(guess ? { language: guess } : {})');
  });

  it('저장 경로는 언어를 직접 싣는다 — 폴백에 기대지 않는다', () => {
    // `buildVocabRow`의 `language || 'Japanese'`는 안전망이지 경로가 아니다.
    // 호출부 전부가 language를 넘기는지 본다 — 하나라도 빠지면 중국어가 일본어로 저장된다.
    const callers = ['src/views/ViewerPage.jsx', 'src/views/PdfViewerPage.jsx',
      'src/views/QuickPage.jsx', 'src/views/StudySessionPage.jsx',
      'src/components/world/NpcDialog.jsx'];
    for (const f of callers) {
      const src = read(f);
      const idx = src.indexOf('buildVocabRow(');
      expect(idx, `${f}가 buildVocabRow를 안 쓴다 — 계약이 낡았다`).toBeGreaterThan(-1);
      expect(src.slice(idx, idx + 600), `${f}가 language를 안 싣는다`).toContain('language');
    }
  });
});
