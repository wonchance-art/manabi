import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

// 영어 단어 카드 발음 줄(IPA) — 분석기 출력 → 저장(processed_json.dictionary) → 선택(refreshViewerToken · handleTokenClick = 사전 항목 그대로)
// 어디에도 furigana → reading 옮기기가 없다. 분석기는 IPA를 furigana에 둔다(운영 실측 2026-10-17 KST: 영어 토큰 953개 중 furigana 672 · reading 0).
// 카드가 reading만 봐서 줄이 한 번도 그려지지 않았다 — 영어에서만 furigana(없으면 옛 reading)를 쓴다. 저장값 그대로(/…/ 포함, 다시 감싸지 않음).
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('영어 발음 줄은 토큰 furigana(IPA)를 쓴다', () => {
  it('전제: 분석기 토큰은 독음을 furigana에 두고 reading 칸을 만들지 않는다', () => {
    const entry = sliceBetween(read('src/lib/server/analyzeCore.js'), 'dictionary[tokenId] = {', '};');
    expect(entry).toContain('furigana: cleanFurigana(t.text, rawReading)');
    expect(entry).not.toMatch(/\breading:/);
    expect(read('src/lib/viewerReliability.js')).toContain('return { ...json.dictionary[selected.id], id: selected.id };'); // 옮기기 없음
  });

  it('카드는 영어에서만 furigana → reading 순서로 읽고, 세 자리(줄 · 수업 줄 · 뜻 줄 간격)가 같은 값을 쓴다', () => {
    const page = read('src/views/ViewerPage.jsx');
    expect(page).toContain("const enPronunciation = materialLang === 'English' ? (selectedToken?.furigana || selectedToken?.reading || null) : null;");
    expect(page).toContain('{enPronunciation && <div className="reader-card-pronunciation">{enPronunciation}</div>}');
    expect(page).toContain('{classStudyActive && enPronunciation && <div className="reader-card-pronunciation">{enPronunciation}</div>}');
    expect(page).toContain("word-detail-card__meaningrow${enPronunciation ? ' word-detail-card__meaningrow--tight' : ''}");
    expect(page).not.toMatch(/materialLang === 'English' && selectedToken\.reading/);
    expect(page.match(/reader-card-pronunciation/g)).toHaveLength(2);
  });
});
