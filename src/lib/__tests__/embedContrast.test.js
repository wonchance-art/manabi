// 임베드 복습 초록 단추 대비(EMBED-CONTRAST-001, 오너 「권장대로」 2026-11-08 KST — 목업 6UZSByWxAYfga3Uw4JtYup A안).
// 「뒤집기」 · 「알맞음」 · 「쉬움」 · 「닫기」가 GBC 초록 #5F9A46 / 크림 글자 3.26:1(axe)이었다 — 임베드에서만 짙은 초록(≈#497A36, 4.9:1).
// 월드 파일 변경은 QuestReview 선택 값 한 줄(primaryButton)뿐이고, 기본값이 지금 gbcButtonPrimary와 같아 /world는 같은 그림이다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GBC, gbcButton, gbcButtonPrimary } from '../../components/world/QuestReview';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('QuestReview 선택 값 하나 — 기본값은 지금 초록 그대로', () => {
  const src = read('src/components/world/QuestReview.jsx');
  it('시그니처의 선택 값이 안의 gbcButtonPrimary를 가린다(쓰는 곳은 그대로)', () => {
    expect(src).toContain('export default function QuestReview({ userId, onClose, primaryButton: gbcButtonPrimary = { ...gbcButton, background: GBC.green, color: GBC.creamHi } }) {');
  });
  it('기본값 = 모듈의 gbcButtonPrimary(같은 키 · 같은 값) — /world는 넘기지 않아 인라인 스타일이 같다', () => {
    expect({ ...gbcButton, background: GBC.green, color: GBC.creamHi }).toEqual(gbcButtonPrimary);
    expect(src).toContain('export const gbcButtonPrimary = {\n  ...gbcButton,\n  background: GBC.green,\n  color: GBC.creamHi,\n};');
    expect(read('src/views/WorldPage.jsx')).not.toContain('primaryButton=');
  });
  it('모듈 팔레트(GBC.green)는 그대로', () => {
    expect(GBC.green.toLowerCase()).toBe('#5f9a46');
  });
});

describe('임베드만 짙은 초록을 넘긴다', () => {
  it('임베드 주 단추와 같은 값(embedPrimary)을 QuestReview에도', () => {
    const embed = read('src/app/embed/review/EmbedReviewClient.jsx');
    expect(embed).toContain('const embedPrimary = { ...gbcButtonPrimary, background: `color-mix(in srgb, ${GBC.green} 72%, ${GBC.greenInk})` };');
    expect(embed).toContain('<QuestReview key={reviewKey} userId={user.id} onClose={handleClose} primaryButton={embedPrimary} />');
  });
});
