import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  PARAGRAPH_LINES, cleanVideoTitle, detectLinkKind, paragraphize,
  stripCueNoise, transcriptFromPaste,
} from '../linkImport.js';

/**
 * 계약: v2-F R1 링크 반입 (#1077 설계 §6 — 이 절이 이 축의 합격선).
 *
 * 반입 입구는 여섯인데 **사용자가 URL을 직접 넣는 문은 없었다**. 그 문 하나를 연다.
 * 자동 취득은 검증된 적 없는 경로라(아래 §0 교정) 붙여넣기를 1급으로 둔다.
 * 새 테이블·마이그레이션 0 — 출처는 metadata에 얹는다(metadata.book 선례).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('§0 실측 교정 — 자동 취득은 검증된 경로가 아니다', () => {
  it('크론은 유튜브를 안 쓴다 — 글 소스만 쓴다', () => {
    // 설계 §0은 「크론 수집 → 자막 추출(youtube.js extractTranscript)」이 있다고 적었다.
    // 실측은 다르다. 이 사실이 뒤집히면(크론이 유튜브를 쓰게 되면) 위험 판단도 달라진다.
    const cron = read('src/app/api/cron/fetch-suggestions/route.js');
    expect(cron).toContain('content-sources');
    expect(cron, '크론이 youtube.js를 쓰지 않는다').not.toContain('youtube');
  });

  it('그래서 붙여넣기가 1급 경로다 — 422가 정상 분기로 설계돼 있다', () => {
    const route = codeOf(read('src/app/api/import/link/route.js'));
    expect(route).toContain("error: 'no_transcript'");
    expect(route).toMatch(/status: 422/);
    const ui = codeOf(read('src/components/MaterialAddLinkSection.jsx'));
    expect(ui).toContain('if (res.status === 422)');
    expect(ui).toContain('setManual(');
  });
});

describe('§4 URL 판별', () => {
  it('유튜브 주소 형태를 두루 받는다', () => {
    for (const u of [
      'https://youtu.be/abc12345678',
      'https://www.youtube.com/watch?v=abc12345678',
      'https://m.youtube.com/watch?v=abc12345678',
      'youtube.com/watch?v=abc12345678',            // 스킴 없이 붙여넣는 사람이 많다
    ]) {
      expect(detectLinkKind(u), `${u}는 유튜브다`).toBe('youtube');
    }
  });

  it('나머지는 지원하지 않는다고 말한다 — 조용히 실패하지 않는다', () => {
    for (const u of ['https://vimeo.com/1', 'https://example.com', 'not a url', '', null]) {
      expect(detectLinkKind(u)).toBe('unsupported');
    }
  });

  it('호스트로만 가른다 — 주소 안에 youtube.com이 적혔다고 유튜브가 아니다', () => {
    expect(detectLinkKind('https://evil.example.com/?u=youtube.com/watch?v=x')).toBe('unsupported');
  });
});

describe('§4 자막 잡음 제거 — 붙여넣은 스크립트가 본문이 된다', () => {
  it('타임코드만 있는 줄을 지운다 — 유튜브는 시각과 대사를 번갈아 흘린다', () => {
    expect(stripCueNoise('0:00\nこんにちは\n1:23\nさようなら')).toEqual(['こんにちは', 'さようなら']);
    expect(stripCueNoise('00:01:02.500\nhello')).toEqual(['hello']);
    expect(stripCueNoise('[00:01:02]\nhello')).toEqual(['hello']);
  });

  it('줄 앞에 박힌 타임코드도 뗀다', () => {
    expect(stripCueNoise('0:12 では はじめましょう')).toEqual(['では はじめましょう']);
  });

  it('대괄호 지문을 지운다 — [음악]은 읽을 말이 아니다', () => {
    expect(stripCueNoise('[音楽]\n[Music] hello\n[박수]')).toEqual(['hello']);
  });

  it('연속 중복을 지운다 — 자동 생성 자막은 같은 줄을 롤업으로 두 번 흘린다', () => {
    expect(stripCueNoise('a\na\nb\na')).toEqual(['a', 'b', 'a']);   // 떨어진 반복은 남긴다
  });

  it('WebVTT 잔재를 지운다 — 파일을 통째로 붙여넣는 사람이 있다', () => {
    expect(stripCueNoise('WEBVTT\nKind: captions\nLanguage: ja\n1\nこんにちは')).toEqual(['こんにちは']);
  });

  it('빈 입력은 조용히 빈 결과', () => {
    expect(stripCueNoise('')).toEqual([]);
    expect(stripCueNoise(null)).toEqual([]);
  });
});

describe('§4 문단화 — 자동 취득분과 붙여넣기분의 본문이 갈리지 않는다', () => {
  it('8줄씩 묶는다 — extractTranscript와 같은 규칙(정본 일치)', () => {
    expect(PARAGRAPH_LINES).toBe(8);
    // 정본 쪽 규칙이 바뀌면 두 경로의 자료 모양이 갈린다.
    expect(read('src/lib/youtube.js')).toContain('i += 8');
    const lines = Array.from({ length: 17 }, (_, i) => `L${i}`);
    const out = paragraphize(lines).split('\n');
    expect(out).toHaveLength(3);
    expect(out[0].split(' ')).toHaveLength(8);
    expect(out[2]).toBe('L16');
  });

  it('빈 줄은 세지 않는다', () => {
    expect(paragraphize(['a', '', '  ', 'b'])).toBe('a b');
    expect(paragraphize([])).toBe('');
    expect(paragraphize(null)).toBe('');
  });

  it('붙여넣기 한 방 — 잡음 제거 후 문단화', () => {
    const paste = '0:00\nおはよう\n0:03\n[音楽]\n0:05\nいい 天気ですね';
    expect(transcriptFromPaste(paste)).toBe('おはよう いい 天気ですね');
  });
});

describe('§4 제목 정리', () => {
  it('말머리 태그와 꼬리 채널 표기를 던다 — 자료 제목으로 쓸 것이라 짧을수록 좋다', () => {
    expect(cleanVideoTitle('【N3】今日のニュース | NHK')).toBe('今日のニュース');
    expect(cleanVideoTitle('  Hello World  ')).toBe('Hello World');
    expect(cleanVideoTitle(null)).toBe('');
  });
});

describe('§6 라우트 — 인증·판별·리밋', () => {
  const route = codeOf(read('src/app/api/import/link/route.js'));

  it('미인증은 401 — 문구가 아니라 **관문**이 있어야 한다', () => {
    // 401 문자열만 보면 관문을 없애도 계약이 통과한다(돌연변이 ⑥가 실제로 살아남았다).
    // 지키려는 건 "토큰이 나쁘면 여기서 끊긴다"이므로 조건과 return을 함께 본다.
    expect(route).toContain("if (!authHeader) {");
    const gate = sliceBetween(route, 'auth.getUser(token)', 'isRateLimited');
    expect(gate).toContain('if (authErr || !user) {');
    expect(gate).toMatch(/return Response\.json\([\s\S]*status: 401[\s\S]*\);/);
  });

  it('미지원 URL은 400 — 판별은 순수 함수가 한다', () => {
    expect(route).toContain("detectLinkKind(url) !== 'youtube'");
    expect(route).toContain("error: 'unsupported_url'");
    expect(route).toMatch(/status: 400/);
  });

  it('레이트 리밋 10/분·사용자 — 남의 서비스를 두드리는 입구다', () => {
    expect(route).toContain('const RATE_LIMIT = 10;');
    expect(route).toContain("isRateLimited(`u:${user.id}`)");
    expect(route).toContain("error: 'rate_limited'");
  });

  it('취득 단계마다 시간을 끊는다 — 서버리스 벽시계를 넘기면 사용자가 아무것도 못 받는다', () => {
    expect(route).toContain('STEP_TIMEOUT_MS');
    expect(route).toContain('withTimeout(viaTranscript(');
    expect(route).toContain('withTimeout(viaSupadata(');
    expect(route).toContain('withTimeout(fetchOEmbed(');
  });

  it('제목은 키 없는 공개 경로로 받는다 — 자막이 실패해도 폼이 비지 않는다', () => {
    expect(route).toContain('youtube.com/oembed');
    expect(route, 'oEmbed는 키가 필요 없다').not.toContain('YOUTUBE_API_KEY');
    // 422에도 제목을 실어 보낸다
    const fail = sliceBetween(route, "error: 'no_transcript'", '}, { status: 422 });');
    expect(fail).toContain('title:');
  });

  it('Supadata는 키가 있을 때만 — 없으면 조용히 다음으로', () => {
    const f = sliceBetween(route, 'async function viaSupadata(', '\n}');
    expect(f).toContain('if (!key) return null;');
    expect(f).toContain('normalizeSupadataSegments');
  });

  it('두 취득 경로가 같은 순수 함수로 본문을 만든다 — 경로마다 본문이 갈리면 안 된다', () => {
    for (const fn of ['viaTranscript', 'viaSupadata']) {
      const f = sliceBetween(route, `async function ${fn}(`, '\n}');
      expect(f, `${fn}이 stripCueNoise를 쓴다`).toContain('stripCueNoise');
      expect(f, `${fn}이 paragraphize를 쓴다`).toContain('paragraphize');
    }
  });

  it('순수 모듈은 서버를 모른다', () => {
    const pure = codeOf(read('src/lib/linkImport.js'));
    for (const banned of ['supabase', 'fetch(', 'process.env']) {
      expect(pure, `링크 판별이 ${banned}를 알면 안 된다`).not.toContain(banned);
    }
  });
});

describe('§5 정책 — 기본 비공개이되 강제는 아니다', () => {
  const page = codeOf(read('src/views/MaterialAddPage.jsx'));

  it('링크 반입은 비공개로 시작한다 — 남의 자막이다', () => {
    const h = sliceBetween(page, 'const handleLinkReady =', '\n  };');
    expect(h).toContain("setVisibility('private')");
  });

  it('강제는 아니다 — 재배포 판단은 사용자 몫이라 토글을 남긴다(PDF·EPUB와 다른 점)', () => {
    // PDF·EPUB는 저장 시점에 강제로 private을 덮어쓴다. 링크는 그 목록에 없어야 한다.
    const forced = sliceBetween(page, 'visibility: (', ',');
    expect(forced).toContain('pdfSource || epubSource');
    expect(forced, '링크까지 강제하면 공개 선택지가 사라진다').not.toContain('linkSource');
  });

  it('출처를 남긴다 — 어디서 온 본문인지 자료가 스스로 말해야 한다', () => {
    expect(page).toContain('...(linkSource ? { source: linkSource } : {}),');
    const ui = codeOf(read('src/components/MaterialAddLinkSection.jsx'));
    // 요구는 「출처 네 조각(종류·주소·videoId·채널)이 실린다」이지 **주소를 어느 변수에서
    // 읽느냐**가 아니다. 처음엔 `url: url.trim()`을 리터럴로 얼렸다가, F R4가 주소를
    // 인자로 받게 되자 요구가 그대로인데 깨졌다 — 구현 모양을 고정한 값.
    expect(ui).toMatch(/source: \{ kind: 'youtube', url:[^,]+, videoId/);
    expect(ui, '채널까지 실려야 자료가 스스로 출처를 말한다').toMatch(/source: \{[^}]*channel:/);
  });

  it('입구를 갈아타면 옛 출처가 따라오지 않는다', () => {
    for (const h of ['handlePdfRangeReady', 'handleEpubReady']) {
      expect(sliceBetween(page, `const ${h} =`, '\n  };'), `${h}가 링크 출처를 비운다`)
        .toContain('setLinkSource(null)');
    }
  });

  it('스키마 변경 0 — 출처는 metadata에 얹는다(metadata.book 선례)', () => {
    const files = fs.readdirSync(path.join(process.cwd(), 'supabase/migrations'));
    for (const f of files) {
      const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations', f), 'utf8');
      for (const banned of ['material_source', 'import_link', 'source_url']) {
        expect(sql.includes(banned), `${f}에 ${banned}가 생기면 안 된다`).toBe(false);
      }
    }
  });
});

describe('§6 입구 — 같은 층, 같은 프롭 규약', () => {
  const page = read('src/views/MaterialAddPage.jsx');

  it('PDF·EPUB·문장 목록과 같은 층에 네 번째로 선다', () => {
    const i = page.indexOf('<MaterialAddLinkSection');
    expect(i).toBeGreaterThan(page.indexOf('<MaterialAddSentenceSection'));
    expect(i).toBeGreaterThan(page.indexOf('<MaterialAddEpubSection'));
  });

  it('프롭 규약이 기존 입구와 같다 — 문마다 다른 규약이면 다섯 번째 문이 또 다르게 생긴다', () => {
    // 지킬 것은 **toast·onReady 두 프롭이 다른 입구와 같은 이름·역할**이라는 것이다.
    // 프롭 **추가**는 그 규약을 깨지 않는다(F R4가 initialUrl을 더했다) — 닫힌 목록으로
    // 얼리면 확장할 때마다 요구와 무관하게 빨개진다.
    expect(page).toMatch(/<MaterialAddLinkSection toast=\{toast\} onReady=\{handleLinkReady\}/);
    expect(read('src/components/MaterialAddLinkSection.jsx'))
      .toMatch(/export default function MaterialAddLinkSection\(\{ toast, onReady[,}]/);
  });
});
