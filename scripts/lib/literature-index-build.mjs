// 출처별 책 목록 모듈(index.generated.js) 직렬화 — 青空文庫 · Standard Ebooks · 위키문헌 · 전자책 사이트 빌드가 같이 쓴다.
// 장 원문(<key>/chapters.json)은 import하지 않고 key만 싣는다(BUILD-OOM-001 근본, 2026-11-01 KST): 정적 import하면 85권 · 약 33MB가
// 서버 묶음 하나(28.8MB)로 들어가 Vercel 빌드 컨테이너(8GB)를 넘겼다. 원문은 서버가 필요한 책만 읽는다(src/lib/server/literatureBooks.js).

/**
 * @param {string} exportName 내보낼 상수 이름(예: LITERATURE_BOOK_KEYS)
 * @param {string} label 머리 주석의 출처 이름(예: '정본 문학책')
 * @param {string[]} keys 작품 key — 빌드 차례 그대로(게시 목록의 출처 안 차례)
 */
export function serializeBookKeyIndex(exportName, label, keys) {
  // key는 작품 폴더 이름이자 서버가 여는 파일 경로의 한 칸이다 — 소문자 · 숫자 · '-' · '_' 밖이면 목록을 만들지 않는다.
  const odd = keys.find((key) => !/^[a-z0-9][a-z0-9_-]*$/.test(key));
  if (odd !== undefined) throw new Error(`책 key가 폴더 이름 규칙 밖이다: ${odd}`);
  const lines = [
    '// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).',
    `// ${label} key 목록 — 장 원문(<key>/chapters.json)은 번들에 싣지 않고 서버가 필요한 책만 읽는다(src/lib/server/literatureBooks.js · BUILD-OOM-001).`,
    `export const ${exportName} = Object.freeze([`,
    ...keys.map((key) => `  '${key}',`),
    ']);',
  ];
  return `${lines.join('\n')}\n`;
}
