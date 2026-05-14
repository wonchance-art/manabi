// 학습 보상 시각 효과 — canvas-confetti 래퍼.
// 정답·매치·완료 등 짧은 모먼트에 사용.

const COLOR_MAP = {
  primary: ['#5b8def', '#a3c4ff', '#dde9ff'],
  accent: ['#10b981', '#6ee7b7', '#d1fae5'],
  warning: ['#f59e0b', '#fcd34d', '#fef3c7'],
};

function resolveColors(input) {
  if (!input) return COLOR_MAP.accent;
  if (Array.isArray(input)) {
    if (typeof input[0] === 'string' && COLOR_MAP[input[0]]) {
      return input.flatMap(k => COLOR_MAP[k] || []);
    }
    return input;
  }
  return COLOR_MAP[input] || COLOR_MAP.accent;
}

function getOrigin(source) {
  if (!source) return { x: 0.5, y: 0.5 };
  if (typeof source.left === 'number' && typeof source.top === 'number') {
    const x = (source.left + source.width / 2) / window.innerWidth;
    const y = (source.top + source.height / 2) / window.innerHeight;
    return { x, y };
  }
  if (source.getBoundingClientRect) {
    const r = source.getBoundingClientRect();
    return {
      x: (r.left + r.width / 2) / window.innerWidth,
      y: (r.top + r.height / 2) / window.innerHeight,
    };
  }
  return { x: 0.5, y: 0.5 };
}

let confettiFn = null;
async function getConfetti() {
  if (confettiFn) return confettiFn;
  try {
    const mod = await import('canvas-confetti');
    confettiFn = mod.default;
    return confettiFn;
  } catch {
    return null;
  }
}

// 작은 sparkle — 정답/매치 직후
export async function fireSparkle({ source, count = 12, colors = 'accent' } = {}) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const confetti = await getConfetti();
  if (!confetti) return;
  confetti({
    particleCount: count,
    spread: 60,
    startVelocity: 22,
    gravity: 0.9,
    decay: 0.92,
    scalar: 0.7,
    ticks: 50,
    origin: getOrigin(source),
    colors: resolveColors(colors),
    disableForReducedMotion: true,
  });
}

// 큰 폭발 — 강의 완료 / 미션 클리어
export async function fireBurst({ source, colors = ['primary', 'accent'] } = {}) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const confetti = await getConfetti();
  if (!confetti) return;
  const origin = getOrigin(source);
  const palette = resolveColors(colors);
  // 두 갈래 발사 — 좌·우
  confetti({
    particleCount: 60,
    angle: 60,
    spread: 65,
    startVelocity: 45,
    origin: { x: Math.max(0.1, origin.x - 0.2), y: origin.y },
    colors: palette,
    disableForReducedMotion: true,
  });
  confetti({
    particleCount: 60,
    angle: 120,
    spread: 65,
    startVelocity: 45,
    origin: { x: Math.min(0.9, origin.x + 0.2), y: origin.y },
    colors: palette,
    disableForReducedMotion: true,
  });
}
