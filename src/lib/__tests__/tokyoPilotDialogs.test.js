import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKYO_PILOT_PHASE } from '../tokyoPilotJourney';
import { tokyoPilotDialogForAnchor } from '../../components/world/tokyoPilotDialogs';

describe('도쿄 파일럿 기존 NPC 대화 재사용', () => {
  it('역무원 대화를 행선지 확인과 도착 방송 구간으로 나눈다', () => {
    expect(tokyoPilotDialogForAnchor(
      'haneda-station-agent',
      TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION,
    )).toMatchObject({ npc: 'ekiin', stepStart: 0, stepEnd: 2, pilotInteraction: true });
    expect(tokyoPilotDialogForAnchor(
      'train-arrival-announcement',
      TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA,
    )).toMatchObject({ npc: 'ekiin', stepStart: 2, stepEnd: 4, pilotInteraction: true });
  });

  it('길 묻기와 카페 주문은 기존 도쿄 NPC 스크립트를 참조한다', () => {
    expect(tokyoPilotDialogForAnchor(
      'shibuya-direction-npc',
      TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS,
    )).toMatchObject({ npc: 'tokyo-central-east-bookstore', stepStart: 0, stepEnd: 4 });
    expect(tokyoPilotDialogForAnchor(
      'shibuya-cafe-order',
      TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER,
    )).toMatchObject({ npc: 'tokyo-yamanote-west-cafe', stepStart: 0, stepEnd: null });
  });

  it('같은 anchor라도 여정 phase가 다르면 대화를 열지 않는다', () => {
    expect(tokyoPilotDialogForAnchor('haneda-station-agent', TOKYO_PILOT_PHASE.HANEDA_ARRIVED)).toBeNull();
    expect(tokyoPilotDialogForAnchor('unknown', TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION)).toBeNull();
  });

  it('NpcDialog 범위와 GameCanvas 완료 배선을 유지한다', () => {
    const dialog = fs.readFileSync('src/components/world/NpcDialog.jsx', 'utf8');
    const canvas = fs.readFileSync('src/components/world/GameCanvas.jsx', 'utf8');
    expect(dialog).toContain('source.steps.slice(stepStart, end)');
    expect(canvas).toContain('stepStart={npcDialog.node?.stepStart}');
    expect(canvas).toContain('if (npcDialog.node?.pilotInteraction) {');
    expect(canvas).toContain('tokyoPilotControllerRef.current?.resolveLanguage({');
  });
});
