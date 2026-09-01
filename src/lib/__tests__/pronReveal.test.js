import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { pronRevealAvailable, shouldRevealPron, pronHiddenFor, READING_PRESETS, PRESET_META } from '../readingSheet.js';

/**
 * 계약: 후리가나 셀프 테스트 v1-4 R1 (#1077 설계, 오너 "우선순위대로 ㄱㄱ" 2026-09-01).
 *
 * ── 착수 실측이 규모를 절반으로 깎았다
 *
 * v1-4는 2026-08-20 제안이고 읽기 설정 리뉴얼은 08-27이다. 그 사이에 **가리는 축이
 * 이미 생겼다** — `pronDisplay` 3단(all·unknown·none, 주석에 「구 후리가나 토글의 후신」)과
 * 프리셋 🙈 「암기 확인」. 남은 결핍은 「가림」이 아니라 **「확인」 하나**였다: 지금 가려진
 * 발음을 다시 보는 길이 **카드 시트를 여는 것뿐**이라 인출 직후 확인이 무거웠다.
 *
 * 그리고 공개가 싸다는 것도 실측이었다 — 가려진 읽기는 이미 DOM에 있고
 * `.surface--furi-off`가 `visibility`만 꺼 둔다. 공개 = **클래스 한 겹 벗기기**.
 *
 * ── 이 계약이 지키는 것은 카피가 아니라 **탭 규칙의 순서**다
 *
 *   ① 집중 모드 + 지정 문장 밖 → 문장 이동   (무변경)
 *   ② 그 단어의 발음이 가려져 있다 → 발음 공개 (신설)
 *   ③ 그 외 → 단어 카드 시트                (무변경)
 *
 * 순서가 뒤집히면 집중 모드의 「문장 밖 = 순수 이동」이 깨지고, ②가 빠지면 기능이
 * 없는 것과 같다. 그래서 아래는 값이 아니라 **분기 순서**와 **무접촉**을 잡는다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const VIEWER = 'src/views/ViewerPage.jsx';

/** handleTokenClick 본체만 — 파일 전역 grep은 다른 핸들러의 같은 이름에 속는다. */
const tapHandler = () =>
  sliceBetween(read(VIEWER), 'const handleTokenClick = (token, tokenId', '// ② 리스트 단어 탭');

describe('① 꺼져 있으면 탭 동작이 지금과 완전히 같다', () => {
  it('pronReveal이 꺼지면 어떤 조합에서도 공개 단계가 없다', () => {
    for (const display of ['all', 'unknown', 'none', undefined]) {
      for (const hidden of [true, false]) {
        for (const revealed of [true, false]) {
          expect(shouldRevealPron(false, display, { hidden, revealed }), `${display}/${hidden}/${revealed}`).toBe(false);
        }
      }
    }
  });

  it('기본값이 꺼짐이다 — 기존 탭 의미를 바꾸는 기능이라 옵트인이 전제', () => {
    const src = read('src/lib/useViewerSettings.js');
    const line = sliceBetween(src, "readPref('pronReveal'", ')');
    expect(line, "pronReveal 기본값은 false여야 한다").toMatch(/readPref\('pronReveal',\s*false/);
  });

  it('활성 인자로 실제 pronReveal이 들어간다 — 상수로 굳어 있으면 스위치가 죽는다', () => {
    expect(tapHandler()).toMatch(/shouldRevealPron\(\s*pronReveal\s*,/);
  });
});

describe('② 「전체」에는 공개 단계가 없다 — 가릴 게 없다', () => {
  it('pronRevealAvailable: all만 거짓', () => {
    expect(pronRevealAvailable('all')).toBe(false);
    expect(pronRevealAvailable('unknown')).toBe(true);
    expect(pronRevealAvailable('none')).toBe(true);
  });

  it('all이면 켜져 있고 가려져 있어도 공개하지 않는다', () => {
    expect(shouldRevealPron(true, 'all', { hidden: true })).toBe(false);
    // 나머지 두 단은 가려진 토큰에서 공개한다 — 없으면 기능이 성립하지 않는다.
    expect(shouldRevealPron(true, 'unknown', { hidden: true })).toBe(true);
    expect(shouldRevealPron(true, 'none', { hidden: true })).toBe(true);
  });

  it('가려지지 않은 단어는 무변경 — 한 번에 카드다', () => {
    expect(shouldRevealPron(true, 'unknown', { hidden: false })).toBe(false);
  });

  it('이미 공개한 단어는 두 번째 탭에서 카드로 넘어간다', () => {
    expect(shouldRevealPron(true, 'unknown', { hidden: true, revealed: true })).toBe(false);
  });

  it('설정 시트의 흐림과 동작이 같은 판정을 쓴다 — 갈리면 "흐린데 눌리는" 스위치가 된다', () => {
    const sheet = sliceBetween(read(VIEWER), '{/* 탭하면 발음 보기(v1-4 R1)', '<b>단어 상태</b>');
    expect(sheet, '흐림 클래스가 pronRevealAvailable로 판정돼야 한다').toMatch(/rsheet-swrow--off[\s\S]*?pronRevealAvailable\(pronDisplay\)|pronRevealAvailable\(pronDisplay\)[\s\S]*?rsheet-swrow--off/);
    expect(sheet, 'input도 실제로 disabled여야 한다 — 흐리기만 하면 눌린다').toMatch(/disabled=\{!pronRevealAvailable\(pronDisplay\)\}/);
  });
});

describe('③ 집중 모드 우선순위 불변 — 문장 밖 탭은 여전히 이동', () => {
  it('집중 모드 분기가 공개 판정보다 먼저 끝난다', () => {
    const body = tapHandler();
    const focus = body.indexOf('if (focusMode)');
    const reveal = body.indexOf('shouldRevealPron(');
    expect(focus, '집중 모드 분기가 사라졌다').toBeGreaterThanOrEqual(0);
    expect(reveal, '공개 분기가 사라졌다').toBeGreaterThanOrEqual(0);
    expect(focus, '공개가 집중 모드보다 먼저 오면 문장 밖 탭이 이동 대신 공개가 된다').toBeLessThan(reveal);
  });

  it('공개 분기는 카드 시트를 여는 지점보다 먼저다 — ②가 ③ 뒤로 가면 도달하지 않는다', () => {
    const body = tapHandler();
    expect(body.indexOf('shouldRevealPron(')).toBeLessThan(body.indexOf('setIsSheetOpen(true)'));
  });
});

describe('④ 공개는 그 토큰만 — 이웃·문장이 딸려 드러나지 않는다', () => {
  it('공개 여부를 tokenId 단위로 조회한다', () => {
    const render = sliceBetween(read(VIEWER), 'const rubySegments = token.furigana', '{linePick}');
    expect(render, '토큰 단위 조회(revealedPron.has(tokenId))가 아니면 범위가 새어 나간다')
      .toMatch(/const pronRevealed = revealedPron\.has\(tokenId\)/);
    expect(render, '가림 계산이 공개 상태를 반영해야 한다').toMatch(/furiOff = pronHidden && !pronRevealed/);
  });

  it('공개 동작은 탭한 tokenId 하나만 더한다', () => {
    const branch = sliceBetween(tapHandler(), 'shouldRevealPron(', 'const t = { ...token');
    expect(branch).toMatch(/setRevealedPron\(\(prev\) => new Set\(prev\)\.add\(tokenId\)\)/);
  });

  it('읽기가 붙지 않는 토큰은 공개 단계 밖이다 — 탭이 아무 일 없이 먹히면 안 된다', () => {
    // furigana가 있어도 한자가 없으면 splitRuby가 plain 한 조각만 낸다(벗길 rt가 없다).
    const render = sliceBetween(read(VIEWER), 'const rubySegments = token.furigana', '{linePick}');
    expect(render).toMatch(/const hasReading = !!rubySegments\?\.some\(\(seg\) => seg\.kanji\)/);
    expect(render, '가림 판정이 hasReading으로 먼저 걸러져야 한다').toMatch(/const pronHidden = hasReading && pronHiddenFor\(/);
  });

  it('가림 판정 자체는 기존 3단 계약 그대로 — 이 라운드가 pronHiddenFor를 건드리지 않았다', () => {
    expect(pronHiddenFor('unknown', { isKnown: true })).toBe(true);
    expect(pronHiddenFor('unknown', { isKnown: false, isSaved: false })).toBe(false);
    expect(pronHiddenFor('all', { isKnown: true, isSaved: true })).toBe(false);
  });
});

describe('⑤ 공개해도 폭·행간이 변하지 않는다', () => {
  it('가림은 visibility로만 한다 — 자리를 없애면 공개할 때 글이 밀린다', () => {
    const rule = sliceBetween(read('src/index.css'), '.surface--furi-off', '}');
    expect(rule).toMatch(/visibility:\s*hidden/);
    for (const banned of ['display', 'width', 'font-size', 'content-visibility']) {
      expect(rule, `${banned}로 감추면 공개 시 조판이 흔들린다`).not.toContain(banned);
    }
  });

  it('ruby는 공개 여부와 무관하게 항상 만든다 — 폭 예약이 유지돼야 한다', () => {
    const render = sliceBetween(read(VIEWER), 'const rubySegments = token.furigana', '{linePick}');
    // 조건은 token.furigana 하나뿐이다. 여기에 공개/가림이 끼면 DOM이 생겼다 사라진다.
    expect(render).toMatch(/const rubySegments = token\.furigana\s*\n\s*\? splitRuby\(token\.text, token\.furigana\)\s*\n\s*: null;/);
  });
});

describe('⑥⑦ 공개는 아무 데도 쓰지 않는다', () => {
  it('공개 분기가 SRS·DB를 건드리지 않는다 — 약한 신호를 FSRS에 흘리면 복습이 흔들린다', () => {
    const branch = sliceBetween(tapHandler(), 'shouldRevealPron(', 'const t = { ...token');
    for (const banned of ['review_events', 'user_vocabulary', 'supabase', 'persistVocabGrade', 'fetch(']) {
      expect(branch, `공개가 ${banned}에 닿으면 안 된다`).not.toContain(banned);
    }
  });

  it('공개 상태가 어디에도 저장되지 않는다 — 재진입하면 다시 가려져야 인출 연습이 된다', () => {
    const lines = read(VIEWER).split('\n').filter((l) => /revealedPron/.test(l) && !/^\s*(\/\/|\*)/.test(l));
    expect(lines.length, 'revealedPron이 사라졌다').toBeGreaterThan(0);
    for (const line of lines) {
      for (const banned of ['localStorage', 'sessionStorage', 'savePref', 'supabase']) {
        expect(line, `공개 상태를 ${banned}에 저장하면 안 된다`).not.toContain(banned);
      }
    }
    // 시작은 언제나 빈 Set — 어디서도 읽어 오지 않는다.
    expect(read(VIEWER)).toMatch(/useState\(\(\) => new Set\(\)\)/);
  });

  it('자료를 옮기면 공개가 접힌다 — 앱 라우터는 뷰어를 다시 마운트하지 않는다', () => {
    expect(read(VIEWER)).toMatch(/setRevealedPron\(\(prev\) => \(prev\.size \? new Set\(\) : prev\)\);\s*\}, \[id\]\)/);
  });
});

describe('⑧ 🙈 암기 확인 프리셋이 비로소 이름값을 한다', () => {
  it('recall만 pronReveal을 켠다', () => {
    expect(READING_PRESETS.recall.pronReveal).toBe(true);
    expect(READING_PRESETS.immerse.pronReveal).toBe(false);
    expect(READING_PRESETS.study.pronReveal).toBe(false);
  });

  it('프리셋 적용이 새 키를 실제로 대입한다 — 빠뜨리면 카드 불만 켜지는 유령 활성이 생긴다', () => {
    const apply = sliceBetween(read(VIEWER), 'const applyPreset = (name) =>', '};');
    for (const key of ['pronDisplay', 'wordStateHl', 'focusMode', 'showToneColors', 'pronReveal']) {
      expect(apply, `applyPreset이 ${key}를 대입하지 않는다`).toContain(`p.${key}`);
    }
  });

  it('카드 문안이 공개 단계를 말한다 — 프리셋 설명과 실제 동작이 갈리면 안 된다', () => {
    const recall = PRESET_META.find((m) => m.key === 'recall');
    expect(recall?.desc).toMatch(/탭|공개/);
  });
});
