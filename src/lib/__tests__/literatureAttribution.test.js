import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { literatureAttributionParts } from '../videoAttribution.js';
import { createAozoraMaterialDraft } from '../aozoraMaterial.js';
import { parseAozoraText } from '../aozoraParser.js';
import { translateViewerText } from '../viewerMessages.js';
import { sliceBetween } from './helpers/sliceBetween';
import { aozoraFixture, sampleEntry } from './helpers/aozoraFixtures.js';

// 아오조라 정본 책 장의 출처 줄(설계 §3.4 · 목업 C). 「저장은 표기가 아니다」(videoAttribution.js 머리) —
// 크레딧이 metadata에 실리는 것으로 끝나지 않고 뷰어에 실제로 보이는지까지 묶는다.
//
// 기대 화면(한 줄, 유튜브·PDF 출처와 같은 문법):
//   출처: 青空文庫 · 底本 「書式見本集」架空書房 · 입력 見本入力者 · 교정 見本校正者 · 원작 퍼블릭 도메인 · 도서 카드 보기
//         · 루비는 독음 보조, 장 분할은 manabi 편집   ← 흐린 글씨(viewer-attribution__muted)

const literature = () => createAozoraMaterialDraft(sampleEntry(), parseAozoraText(aozoraFixture('format-sample-headings.txt')))
  .chapters[0].metadata.literature;

describe('literatureAttributionParts — 출처 줄 재료', () => {
  it('빌드 산출물의 크레딧을 그대로 쓴다(底本은 첫 줄만)', () => {
    expect(literatureAttributionParts(literature())).toEqual({
      provider: '青空文庫',
      sourceBook: '「書式見本集」架空書房',
      inputter: '見本入力者',
      proofreader: '見本校正者',
      cardUrl: 'https://www.aozora.gr.jp/cards/000001/card1.html',
      publicDomain: true,
      editNote: true,
      smallKanaNote: false,
      unproofreadNote: false,
    });
  });

  it('교정자 없는 입력본은 오너 승인 기록이 있을 때만 수록되고, 출처 줄이 그 사실을 밝힌다(夢十夜, 2026-10-15)', () => {
    const unproofread = aozoraFixture('format-sample-headings.txt').replace(/\n校正：[^\n]*/u, '');
    expect(() => createAozoraMaterialDraft(sampleEntry(), parseAozoraText(unproofread))).toThrow('proofreader');
    const approved = { ...sampleEntry(), unproofreadApproval: { approvedBy: 'owner', approvedAt: '2026-10-15', reason: '오너 결정 원문' } };
    const lit = createAozoraMaterialDraft(approved, parseAozoraText(unproofread)).chapters[0].metadata.literature;
    expect(lit.edits).toContain('unproofread-source');
    expect(literatureAttributionParts(lit)).toMatchObject({ proofreader: '', unproofreadNote: true });
    // 승인 기록은 누가·언제·왜가 다 있어야 하고, 교정자가 있는 원문에는 붙일 수 없다
    expect(() => createAozoraMaterialDraft({ ...approved, unproofreadApproval: { approvedBy: 'claude', approvedAt: '2026-10-15', reason: 'x' } }, parseAozoraText(unproofread))).toThrow('owner');
    expect(() => createAozoraMaterialDraft(approved, parseAozoraText(aozoraFixture('format-sample-headings.txt')))).toThrow('only for texts without a proofreader');
  });

  it('작은 가나를 보통 크기로 바꾼 책만 그 편집을 한 줄 더 밝힌다(small-kana-as-full)', () => {
    const substituted = createAozoraMaterialDraft(sampleEntry(), parseAozoraText(aozoraFixture('format-sample-headings.txt')
      .replace('。', '。僕※［＃小書き平仮名ん、168-12］とこ。'))).chapters[0].metadata.literature;
    expect(substituted.edits).toEqual(['ruby-reading-aid', 'chapter-split-by-manabi', 'small-kana-as-full']);
    expect(literatureAttributionParts(substituted)).toMatchObject({ editNote: true, smallKanaNote: true });
  });

  it('권리 기록이 approved·public-domain이 아니면 「원작 퍼블릭 도메인」을 쓰지 않는다(없는 권리 주장 금지)', () => {
    expect(literatureAttributionParts({ ...literature(), rights: { status: 'reviewing', basis: 'public-domain' } }).publicDomain).toBe(false);
    expect(literatureAttributionParts({ ...literature(), rights: undefined }).publicDomain).toBe(false);
  });

  it('도서 카드 링크는 青空文庫 HTTPS 주소만 — 공개 자료 metadata의 임의 링크를 그리지 않는다', () => {
    for (const cardUrl of ['javascript:alert(1)', 'http://www.aozora.gr.jp/cards/000001/card1.html', 'https://evil.example/card1.html', 42]) {
      expect(literatureAttributionParts({ ...literature(), cardUrl }).cardUrl).toBe('');
    }
  });

  it('아오조라 문학 메타가 아니면 줄이 없다', () => {
    expect(literatureAttributionParts(null)).toBe(null);
    expect(literatureAttributionParts({ provider: 'gutenberg' })).toBe(null);
    expect(literatureAttributionParts('aozora')).toBe(null);
  });
});

describe('뷰어 배선 — 출처 줄이 실제로 그려진다', () => {
  const viewer = readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
  const block = sliceBetween(viewer, '아오조라 정본 책 출처', 'PDF 출처 —');

  it('정본 대조를 통과한 크레딧(useCanonicalLiterature)만 같은 한 줄 문법으로 그린다 — 자료 metadata를 직접 읽지 않는다', () => {
    expect(block).toContain('literatureAttributionParts(canonicalLiterature)');
    expect(block).not.toContain('literatureAttributionParts(material');
    expect(viewer).toContain('const canonicalLiterature = useCanonicalLiterature(material);');
    expect(block).toContain('className="viewer-attribution"');
    for (const piece of ['lit.provider', 'lit.sourceBook', 'lit.inputter', 'lit.proofreader', 'lit.cardUrl', 'lit.publicDomain', 'lit.editNote', 'lit.smallKanaNote', 'lit.unproofreadNote']) {
      expect(block, `출처 줄 항목 누락: ${piece}`).toContain(piece);
    }
    expect(block).toContain('rel="noopener noreferrer"');
  });

  it('문구는 세 언어 화면 모두 번역돼 있다', () => {
    expect(translateViewerText('ko', '입력 {name}', { name: '甲' })).toBe('입력 甲');
    expect(translateViewerText('zh-CN', '원작 퍼블릭 도메인')).toBe('原作已进入公有领域');
    expect(translateViewerText('zh-TW', '루비는 독음 보조, 장 분할은 manabi 편집')).toBe('注音僅為讀音輔助，分章由 manabi 編輯');
    expect(translateViewerText('zh-CN', '글꼴에 없는 작은 가나는 보통 크기로')).toBe('字库中没有的小写假名改为普通大小');
    expect(translateViewerText('zh-TW', '青空文庫 교정 전 입력본')).toBe('青空文庫未經校對的輸入本');
  });
});
