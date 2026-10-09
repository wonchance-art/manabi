import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKYO_PILOT_SCENE } from '../tokyoPilotMap';

const canvasSource = fs.readFileSync('src/components/world/GameCanvas.jsx', 'utf8');

describe('도쿄 파일럿 GameCanvas 개발 하니스 배선', () => {
  it('하네다·전철·시부야 회색 박스 scene을 모두 생성하고 Phaser 설정에 등록한다', () => {
    expect(canvasSource).toContain('const TokyoPilotHanedaScene = buildTokyoPilotScene(');
    expect(canvasSource).toContain('const TokyoPilotShibuyaScene = buildTokyoPilotScene(');
    expect(canvasSource).toContain('const TokyoPilotTrainScene = buildTokyoPilotScene(');
    expect(canvasSource).toContain('TranssibCorridorScene, TokyoPilotHanedaScene, TokyoPilotTrainScene, TokyoPilotShibuyaScene,');
  });

  it('제품 도쿄 진입을 바꾸지 않고 로컬 debug bridge에만 진입점을 둔다', () => {
    expect(canvasSource).toContain("enterTokyoPilot: (place = 'haneda') => {");
    expect(canvasSource).toContain('game.scene.start(sceneId);');
    expect(canvasSource).not.toContain("if (id === 'tokyo')");
  });

  it('debug scene 이름은 순수 map 계약의 두 값뿐이다', () => {
    expect(Object.values(TOKYO_PILOT_SCENE)).toEqual([
      'tokyo-pilot:haneda',
      'tokyo-pilot:train',
      'tokyo-pilot:shibuya',
    ]);
  });

  it('debug snapshot이 파일럿 위치를 오버월드보다 먼저 소비한다', () => {
    expect(canvasSource).toContain('sceneRef.current?.pilotRuntimeSnapshot?.()');
    expect(canvasSource).toContain('?? sceneRef.current?.overworldRuntimeSnapshot?.() ?? null');
  });

  it('공간 anchor와 언어 판정을 순수 controller에 연결한다', () => {
    expect(canvasSource).toContain('const tokyoPilotController = createTokyoPilotController({');
    expect(canvasSource).toContain('tokyoPilotController.enterAnchor(anchor.id);');
    expect(canvasSource).toContain('resolveTokyoPilotLanguage: (evaluation) => tokyoPilotController.resolveLanguage(evaluation)');
    expect(canvasSource).toContain('dispatchTokyoPilot: (event) => tokyoPilotController.dispatch(event)');
  });
});
