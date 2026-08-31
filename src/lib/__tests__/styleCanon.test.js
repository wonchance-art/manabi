import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 스타일 캐논 2건 + 교재 R3 건지기 (오너 "정리 ㄱㄱ", 2026-08-31).
 *
 * 착수 실측이 스펙을 줄였다 — 건지기 목록은 닫힌 PR #1154의 디프에서 뽑은 것이라
 * 그 뒤 main이 움직였고, **여러 항목이 이미 반영돼 있거나 애초에 없었다**.
 * 이 계약이 지키는 것은 목록이 아니라 **실측으로 남은 요구**다.
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function contentFiles() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js') || name.endsWith('.md')) out.push(path.relative(ROOT, p));
    }
  })(path.join(ROOT, 'src/content/japanese'));
  return out;
}

describe('스타일 캐논 ① — 한글 음차의 장음은 하이픈', () => {
  it('한글 뒤 장음 부호 `ー`가 0이다', () => {
    // 한글 음차는 한국어 독자용 보조 표기다. 거기 가타카나 기호를 섞으면 폰트·줄바꿈이
    // 이물감을 준다. 실측 63건(ot.js 47 · n5.js 16)을 하이픈으로 옮겼다.
    const bad = [];
    for (const f of contentFiles()) {
      for (const m of read(f).matchAll(/[가-힣]ー/g)) bad.push(`${f} — ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });

  it('내가 건드린 두 파일의 가나 장음이 한 글자도 안 줄었다 — ①이 넘치지 않았다', () => {
    // 이게 없으면 "한글 뒤 ー 0"을 **ー 전량 삭제**로도 만족시킬 수 있다.
    // 처음엔 전체 합계 하한(2000)으로 뒀다가 돌연변이가 살아남았다 — 전체 2107에서
    // n5.js의 106이 통째로 사라져도 2001이라 하한을 넘었다. 실제로 수정한 파일을
    // **파일별로** 고정해야 그 변이가 잡힌다.
    const kana = (f) => (read(f).match(/[ぁ-んァ-ヶ]ー/g) || []).length;
    expect(kana('src/content/japanese/grammar/ot.js'), 'ot.js 가나 장음').toBe(25);
    expect(kana('src/content/japanese/grammar/n5.js'), 'n5.js 가나 장음').toBe(106);
  });

  it('박자 설명용 표기는 예외다 — ニュ-ー-ス는 한글 뒤가 아니라 안 걸린다', () => {
    // 규칙을 "ー 앞이 한글일 때"로 좁힌 이유. 넓히면 이 의도적 표기가 깨진다.
    expect(read('src/content/japanese/vocab/n4.js')).toContain('ニュ-ー-ス');
  });
});

describe('스타일 캐논 ② — yomi는 가나 표기를 원문대로 둔다', () => {
  it('SCHEMA가 "전체 히라가나"라고 말하지 않는다 — 그 규칙이 오답을 만든다', () => {
    // 가타카나 포함 yomi가 781건 있는데, ケーキ를 けーき로 바꾸는 것은 일본어로 오답이다.
    // 콘텐츠가 아니라 **규칙이 틀렸다**.
    const schema = read('src/content/japanese/SCHEMA.md');
    expect(schema).toContain('가나(히라가나·가타카나) 표기는 원문 그대로 유지');
    expect(schema, '옛 문구가 되살아나면 안 된다').not.toContain('yomi = 전체 히라가나 독음');
  });

  it('가타카나 yomi가 실제로 살아 있다 — 규칙만 고치고 콘텐츠는 안 건드렸다', () => {
    const n = contentFiles()
      .reduce((c, f) => c + (read(f).match(/yomi:\s*["'][^"']*[ァ-ヶ]/g) || []).length, 0);
    expect(n, '가타카나 yomi를 히라가나로 바꾸는 대량 작업은 배제됐다').toBeGreaterThan(300);
  });
});

describe('교재 R3 건지기 — 실측으로 남은 것만', () => {
  const n5 = () => read('src/content/japanese/grammar/n5.js');

  it('일본어 조사 が를 한글 "가"로 적지 않는다', () => {
    // 스펙은 3곳이라 했으나 실측은 1곳이었다(나머지 둘은 현재 main에 없다).
    const emergency = read('src/content/japanese/grammar/scene_emergency.js');
    expect(emergency).toContain('おなか에 が를 붙여');
    expect(emergency).not.toContain('おなか에 가를 붙여');
  });

  it('오탈자 "받해요"가 없다', () => {
    expect(n5()).not.toContain('받해요');
    // 스펙의 다른 오탈자 "였해요"는 이미 고쳐져 있었다(`~이었어요`) — 확인만 한다.
    expect(n5()).not.toContain('였해요');
  });

  it('라멘집 설명이 모든 가게를 단정하지 않는다', () => {
    const src = n5();
    expect(src, '"한국인 최대 당황 포인트"는 근거 없는 단정이다').not.toContain('한국인 최대 당황 포인트');
    expect(src, '식권식이 보편이라는 인상을 남기면 안 된다').toContain('물론 모든 라멘집이 그렇진 않아요');
  });

  it('콜아웃 2건이 실재한다 — 신사 박수, 허가 も vs 금지 は', () => {
    const src = n5();
    expect(src, '절에서는 박수를 치지 않는다').toContain('기와지붕 절(お寺)에서는');
    expect(src, '참배 방식은 신사마다 다르다').toContain('박수를 네 번 치는 곳도 있으니');
    expect(src, 'も와 は가 허가·금지를 가른다').toContain('**も**면 「해도 돼요?」');
  });

  it('챕터 제목·요약은 건드리지 않았다 — R1에서 기각된 항목이다', () => {
    // #1154가 R1 기각분(n5-07 제목·요약)을 재제출했던 것이 반려 사유였다.
    // 여기서 같은 것이 조용히 들어가면 안 된다.
    expect(n5()).toContain('title: "일본어 불규칙 동사, 딱 2개가 전부다"');
  });
});

describe('#152 AI Relay — 조건부 보류', () => {
  it('보드 owner-gate에서 승인 대기 줄이 빠졌다 — 결정할 항목이 아니었다', () => {
    expect(read('docs/ai-tasks.md')).not.toContain('#152 AI Relay DB 마이그레이션 승인');
  });

  it('설계 문서가 보류 사유와 재개 조건 둘을 싣는다 — 지우지 않고 조건을 건다', () => {
    const doc = read('docs/ai-relay.md');
    expect(doc).toContain('조건부 보류');
    expect(doc, '보류 사유는 품질이 아니라 쓸 주체 부재다').toContain('쓸 주체가 없다');
    expect(doc).toContain('외부 HTTP 호출 + 시크릿 보관');
    expect(doc).toContain('리포 접근이 있는 상시 세션이 다시 여러 개');
  });

  it('마이그레이션 파일은 그대로 있다 — 되살릴 때 그대로 꺼내 쓴다', () => {
    expect(fs.existsSync(path.join(ROOT, 'supabase/migrations/20260716074502_ai_relay_messages.sql'))).toBe(true);
  });
});
