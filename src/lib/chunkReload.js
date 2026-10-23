// 배포 어긋남(새 배포 뒤 열려 있던 화면) 복구 — PWA-SHELL-001 ⑧.
// 새 배포는 옛 빌드의 JS · CSS 조각을 갖고 있지 않아, 열려 있던 화면이 아직 받지 않은 조각(다음 화면 · 지연 부품)을 부르면 404 →
// ChunkLoadError가 오류 화면으로 떨어진다(빌드 탐침 실측: /materials · /conversation/new 이동 → 「인터넷 연결을 확인해 주세요」, 다시 시도로도 안 풀림).
// 문서를 새로 받으면 새 빌드의 조각 이름을 받으므로 한 번 새로 고친다. 같은 오류가 30초 안에 또 나면(진짜 연결 끊김 · 서버 이상) 멈추고
// 오류 화면을 그대로 둔다 — 무한 새로 고침 금지. 저장소를 못 쓰면(사생활 보호 창 등) 새로 고치지 않는다(반복을 막을 수 없으므로).
// 계정 · 학습 기록과 무관하다: 쿠키 세션 그대로 같은 주소를 다시 열 뿐이고, 보내지 못한 복습은 보관함(IndexedDB)에 남아 있다.

export const CHUNK_RELOAD_KEY = 'manabi:chunk-reload-at';
export const CHUNK_RELOAD_WINDOW_MS = 30_000;

// webpack(ChunkLoadError · Loading chunk / CSS chunk) · 브라우저 ESM 동적 import(Chrome · Safari · Firefox 문구).
const CHUNK_MESSAGE = /Loading (?:CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isChunkLoadError(error) {
  if (!error) return false;
  return error.name === 'ChunkLoadError' || CHUNK_MESSAGE.test(String(error.message || ''));
}

function sessionStore() {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null; } catch { return null; }
}

/** 조각 오류면 한 번 새로 고친다. 새로 고쳤으면 true(오류 화면은 곧 사라진다). */
export function reloadOnceForChunkError(error, {
  storage = sessionStore(),
  now = Date.now(),
  reload = () => window.location.reload(),
  windowMs = CHUNK_RELOAD_WINDOW_MS,
} = {}) {
  if (!isChunkLoadError(error) || !storage) return false;
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY));
    if (last > 0 && now - last >= 0 && now - last < windowMs) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}
