import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약(TAP-INP-SETTINGS-001): 읽기 설정의 보기 전환(쪽 넘김 ↔ 스크롤) · 본문 크기는 누른 조작의 선택 · 값 표시를 먼저 그리고,
 * 본문 반영(쪽 다시 나누기)은 transition으로 미룬다 — 누른 표시가 무거운 다시 나누기를 기다리지 않는다.
 * 쪽 나누기는 그대로 반영 커밋의 layout effect · 그 프레임 rAF에서 한다(깜빡임 방지 의도 유지). 배경(테마)은 바꾸지 않는다.
 * 행동 근거는 e2e 프레임 캡처(중간 프레임 = 새 선택 표시 + 옛 본문, 어긋난 프레임 0)로 기록했다.
 */
const src = fs.readFileSync(path.join(process.cwd(), 'src/components/viewer/ViewerSettings.jsx'), 'utf8');

describe('읽기 설정 반영 미루기(TAP-INP-SETTINGS-001)', () => {
  it('표시는 먼저(urgent) · 반영은 transition', () => {
    expect(src).toContain('const [isPending,startTransition]=useTransition();');
    expect(src).toContain('return [isPending&&pending?pending.value:value,next=>{setPending({value:next});startTransition(()=>onChange(next));}];');
    // 미루지 않는 조작은 예전 그대로(설정값 · 바로 반영)
    expect(src).toContain('if(!enabled)return [value,onChange];');
  });

  it('Choices · Slider는 미룬 값으로 선택 · 숫자 · 끝 버튼을 그린다', () => {
    expect(src).toContain('const [value,onChange]=useDeferredApply(applied,apply,defer);');
    expect(src.match(/useDeferredApply\(applied,apply,defer\)/g)).toHaveLength(2);
    expect(src).toContain('const display=format?format(value):shownText;');
  });

  it('미루는 것은 보기 전환 · 본문 크기 둘뿐 — 배경(테마) · 다른 조작은 그대로', () => {
    const deferred = src.split('\n').filter((line) => /<(Choices|Slider)\b/.test(line) && /\sdefer\/>/.test(line)).map((line) => line.match(/label="([^"]+)"/)[1]);
    expect(deferred.sort()).toEqual(['보기', '본문 크기']);
    expect(src).toMatch(/<Slider uiLocale=\{uiLocale\} label="본문 크기"[^>]*format=\{v=>`\$\{Math\.round\(v\*16\)\}px`\}/);
    expect(src.split('\n').find((line) => line.includes('<Choices label="배경"'))).not.toMatch(/\sdefer\b/);
  });
});
