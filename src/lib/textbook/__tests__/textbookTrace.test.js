// VERCEL-TRACE-001 계약: 교재 음성·PDF·글꼴은 asset 경로 함수에만 실린다.
//
// Vercel은 Next의 파일 추적기(@vercel/nft)로 함수마다 실을 파일을 고른다. 추적기는 정적으로
// 계산되는 경로가 디렉터리면 그 폴더 전체를 싣는다. server.js의 디렉터리 상수 하나 때문에
// 교재 폴더 전체(mp3 147개 등 약 90MB)가 학습 API·페이지 함수 17개 이상에 실려 함수 저장 용량이
// 10.3GB를 넘었다(2026-10-08 KST). 같은 추적기를 소스에 직접 돌려 회귀를 막는다.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nodeFileTrace, resolve as defaultResolve } from 'next/dist/compiled/@vercel/nft';
import { verifiedAsset } from '../assetFile';
import { checkedAsset, currentCandidate, verifiedReadingHtml } from '../server';

const repo = process.cwd();
const editions = 'src/content/textbookEditions/';
const heavy = /\.(mp3|pdf|ttf|woff2)$/;

async function trace(entry) {
  const { fileList } = await nodeFileTrace([path.join(repo, entry)], {
    base: repo,
    processCwd: repo,
    // 외부 패키지는 교재 파일을 참조하지 않는다 — 추적 시간을 줄이려고 건너뛴다.
    ignore: file => file.includes('node_modules'),
    resolve: (id, parent, job, cjsResolve) => defaultResolve(
      id.startsWith('@/') ? path.join(repo, 'src', id.slice(2)) : id, parent, job, cjsResolve,
    ),
  });
  return [...fileList].filter(file => file.startsWith(editions));
}

describe('교재 파일 추적 계약 (VERCEL-TRACE-001)', () => {
  for (const entry of ['src/lib/textbook/server.js', 'src/lib/server/bookReading.js', 'src/lib/server/learningContext.js']) {
    it(`${entry}는 음성·PDF·글꼴 없이 bundle.json·index.json만 싣는다`, async () => {
      const files = await trace(entry);
      expect(files.filter(file => heavy.test(file))).toEqual([]);
      expect(files.some(file => file.endsWith('/bundle.json'))).toBe(true);
      expect(files).toContain(`${editions}index.json`);
    });
  }

  it('asset 경로 전용 모듈은 음성을 잃지 않는다', async () => {
    const files = await trace('src/lib/textbook/assetFile.js');
    expect(files.some(file => file.endsWith('.mp3'))).toBe(true);
  });

  it('assetFile을 import하는 소스는 asset route와 테스트뿐이다', () => {
    const importers = readdirSync(path.join(repo, 'src'), { recursive: true })
      .filter(file => /\.(m?js|jsx|ts|tsx)$/.test(file))
      .map(file => path.join('src', file).split(path.sep).join('/'))
      .filter(file => /textbook\/assetFile['"]/.test(readFileSync(path.join(repo, file), 'utf8')))
      .filter(file => !/(__tests__\/|\.test\.)/.test(file));
    expect(importers).toEqual(['src/app/api/books/japanese-n5/[edition]/asset/route.js']);
  });
});

// 모듈을 나눠도 경로 검사·해시 대조·오류 문구·상태 코드는 그대로다.
describe('asset 검증 동작 보존', () => {
  const notFound = { status: 404, message: '파일을 찾을 수 없어요.' };
  const unverified = { status: 503, message: '출력 파일을 검증하지 못했어요.' };
  const tamper = (book, file) => ({ ...book, assets: { ...book.assets, [file]: { ...book.assets[file], sha256: '0'.repeat(64) } } });

  it('경로 검사: 매니페스트 밖·상위 경로·허용 밖 문자는 404', async () => {
    const book = await currentCandidate();
    for (const file of ['../bundle.json', 'bundle.json', '%2e%2e/secret', 'missing', 'audio/../index.html'])
      await expect(verifiedAsset(book, file)).rejects.toMatchObject(notFound);
    // 매니페스트에 있어도 경로 규칙을 어기면 읽기 전에 막는다.
    const odd = { ...book, assets: { ...book.assets, 'a b.mp3': book.assets['index.html'], 'x/../index.html': book.assets['index.html'] } };
    for (const file of ['a b.mp3', 'x/../index.html']) await expect(verifiedAsset(odd, file)).rejects.toMatchObject(notFound);
  });

  it('해시가 다르면 503, 같으면 바이트와 형식을 돌려준다', async () => {
    const book = await currentCandidate();
    const mp3 = Object.keys(book.assets).find(file => file.endsWith('.mp3'));
    const audio = await verifiedAsset(book, mp3);
    expect(audio.type).toBe(book.assets[mp3].type);
    expect(audio.bytes.length).toBe(book.assets[mp3].bytes);
    await expect(verifiedAsset(tamper(book, mp3), mp3)).rejects.toMatchObject(unverified);
  });

  it('본문 HTML 읽기는 asset 경로로 읽은 결과와 같고, 같은 오류를 낸다', async () => {
    const book = await currentCandidate();
    const viaRoute = await verifiedAsset(book, 'index.html');
    const viaReading = await verifiedReadingHtml(book);
    expect(viaReading.type).toBe(viaRoute.type);
    expect(viaReading.bytes.equals(viaRoute.bytes)).toBe(true);
    await expect(verifiedReadingHtml(tamper(book, 'index.html'))).rejects.toMatchObject(unverified);
    const { 'index.html': _omit, ...rest } = book.assets;
    await expect(verifiedReadingHtml({ ...book, assets: rest })).rejects.toMatchObject(notFound);
  });

  it('checkedAsset은 파일을 읽지 않고 주어진 바이트만 대조한다', async () => {
    const book = await currentCandidate();
    const { bytes } = await verifiedAsset(book, 'index.html');
    // 존재하지 않는 판본 폴더를 가리켜도 바이트만으로 판정한다 — 디스크를 읽지 않는다는 뜻이다.
    const elsewhere = { ...book, editionId: 'no-such-edition-folder' };
    expect(checkedAsset(elsewhere, 'index.html', bytes).bytes).toBe(bytes);
    expect(() => checkedAsset(elsewhere, 'index.html', Buffer.from('changed'))).toThrow(expect.objectContaining(unverified));
    expect(() => checkedAsset(elsewhere, 'missing', bytes)).toThrow(expect.objectContaining(notFound));
  });
});
