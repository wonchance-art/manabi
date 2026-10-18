// HOME-HYDRATION-001(2026-10-18 KST): 배움(/home) 로그인 첫 화면에서 페이지 첫 시간대 서식기(new Intl.DateTimeFormat({ timeZone:
// 'Asia/Seoul' }))가 ICU 시간대 자료를 여느라 LCP 전에 주 스레드를 한 번에 150–360ms(CPU×4) 막았다(useLearningAdmission → dayAt →
// learningDay, 서식기 1개 · 부름 7번 실측). 서울은 1988-10-09 뒤 UTC+9 고정이라 서식기 없이 센다. 다른 시간대 · 그 전 시각은 지역
// 달력 그대로이고 서식기는 시간대마다 한 번만 만든다(카드마다 새로 만들지 않는다). 결과(학습일)는 바꾸기 전과 같아야 한다.
import { afterEach, describe, expect, it, vi } from 'vitest';

const RealFormat = Intl.DateTimeFormat;
afterEach(() => { Intl.DateTimeFormat = RealFormat; vi.resetModules(); });

// 바꾸기 전 구현 그대로(매번 새 서식기) — 결과 대조용
function referenceDay(value, timeZone, rolloverHour) {
  const parts = new RealFormat('en-US', { timeZone, calendar: 'gregory', numberingSystem: 'latn',
    era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(Date.parse(value));
  const f = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const day = new Date(0);
  day.setUTCFullYear(f.era === 'BC' ? 1 - Number(f.year) : Number(f.year), Number(f.month) - 1, Number(f.day));
  return Math.floor(day.getTime() / 86400000) - (Number(f.hour) < rolloverHour ? 1 : 0);
}

async function freshScheduler() {
  let made = 0;
  Intl.DateTimeFormat = function DateTimeFormat(...args) { made += 1; return new RealFormat(...args); };
  vi.resetModules();
  const mod = await import('../fsrsScheduler.js');
  return { ...mod, made: () => made };
}

describe('learningDay — 시간대별 서식기 한 번', () => {
  it('여러 시간대를 섞어 불러도 결과는 바꾸기 전과 같다(DST · 04시 경계 · 연말)', async () => {
    const { learningDay } = await freshScheduler();
    const zones = ['Asia/Seoul', 'America/New_York', 'UTC', 'Europe/Paris', 'Asia/Seoul'];
    const times = ['2026-03-08T06:30:00.000Z', '2026-03-08T07:30:00.000Z', '2026-10-17T18:59:59.000Z', '2026-10-17T19:00:00.000Z',
      '2026-12-31T19:00:00.000Z', '2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z', '2000-01-01T00:00:00.000Z'];
    for (const zone of zones) for (const at of times) for (const hour of [0, 4, 23]) {
      expect(learningDay(at, zone, hour), `${zone} ${at} ${hour}`).toBe(referenceDay(at, zone, hour));
    }
  });

  it('서울(1988-10-09 뒤)은 서식기 없이 — 결과는 지역 달력과 같다(무작위 2만 시각 · 모든 04시류 경계)', async () => {
    const { learningDay, made } = await freshScheduler();
    const from = Date.UTC(1988, 9, 8, 18), to = Date.UTC(2100, 0, 1);
    let seed = 20261018;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const times = [from, from + 1, Date.UTC(1999, 11, 31, 15), Date.UTC(1999, 11, 31, 14, 59, 59, 999), Date.UTC(2026, 9, 17, 19), Date.UTC(2026, 9, 17, 18, 59, 59, 999)];
    for (let i = 0; i < 20000; i++) times.push(Math.floor(from + rand() * (to - from)));
    const before = made();
    const days = times.map((t, i) => learningDay(t, 'Asia/Seoul', i % 24));
    expect(made() - before, '서울 최근 시각은 서식기를 만들지 않는다').toBe(0);
    times.forEach((t, i) => expect(days[i], new Date(t).toISOString()).toBe(referenceDay(new Date(t).toISOString(), 'Asia/Seoul', i % 24)));
    expect(learningDay('2026-10-18T00:00:00.000Z')).toBe(referenceDay('2026-10-18T00:00:00.000Z', 'Asia/Seoul', 4)); // 기본값 = 서울 · 04시
  });

  it('1988-10-09 전 서울(일광 절약 시기 포함)과 다른 시간대는 지역 달력 — 서식기는 시간대마다 한 번', async () => {
    const { learningDay, made } = await freshScheduler();
    for (const at of ['1988-06-01T15:30:00.000Z', '1988-10-08T17:59:59.999Z', '1987-08-01T14:30:00.000Z', '1960-01-01T00:00:00.000Z']) {
      for (const hour of [0, 4]) expect(learningDay(at, 'Asia/Seoul', hour), at).toBe(referenceDay(at, 'Asia/Seoul', hour));
    }
    expect(made()).toBe(1);
    for (let i = 0; i < 500; i++) learningDay(Date.UTC(2026, 9, 18, i % 24), 'America/New_York');
    expect(made()).toBe(2);
  });

  it('잘못된 시간대 · 경계 시각은 예전처럼 매번 던진다(저장하지 않는다)', async () => {
    const { learningDay } = await freshScheduler();
    for (let i = 0; i < 2; i++) expect(() => learningDay('2026-10-18T00:00:00.000Z', 'Mars/Olympus')).toThrow(RangeError);
    expect(() => learningDay('2026-10-18T00:00:00.000Z', 'Asia/Seoul', 24)).toThrow('invalid_rollover');
    expect(() => learningDay('not-a-time')).toThrow('invalid_scheduler_time');
  });
});
