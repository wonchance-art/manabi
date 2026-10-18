import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ART_FILES,
  ART_PUBLIC_DIR,
  ART_ROOT,
  buildArt,
  descriptionSnapshotPath,
  imageSnapshotPath,
  serializeSnapshot,
  sha256,
} from '../../../scripts/lib/art-build.mjs';
import { ART_SOURCES, artSourceText } from '../artSource.js';

// 그림 카탈로그 빌드(scripts/build-art.mjs, ART-AUTO-1) 계약 — entries/ + sources/(원 응답 스냅샷) → works.json.
// 리포 상태가 --check를 통과하고(prebuild와 같은 검사), 임시 사본에서 변조·누락·해시 불일치가 실패하는지 본다.
// 그림 파일은 리포 public/art를 읽기만 한다(사본에서는 스냅샷의 sha256을 바꿔 불일치를 만든다).

const temps = [];
afterEach(() => { while (temps.length) rmSync(temps.pop(), { recursive: true, force: true }); });

/** src/content/art 사본(그림 파일은 복사하지 않는다 — publicDir은 리포 public). */
function workspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'manabi-art-'));
  temps.push(root);
  cpSync(ART_ROOT, root, { recursive: true });
  return root;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const editJson = (file, edit) => { const value = readJson(file); edit(value); writeJson(file, value); };
const committedWorks = () => readFileSync(path.join(ART_ROOT, ART_FILES.works), 'utf8');
const build = (root, check = false) => buildArt({ root, publicDir: ART_PUBLIC_DIR, check });
const entryFile = (root, id) => path.join(root, ART_FILES.entries, `${id}.json`);

const WAVE = 'hokusai-kanagawa-oki-nami-ura';
const WAVE_JA = 'cobas-49296';
const WAVE_EN = '24645';

describe('build-art — 리포 상태', () => {
  it('리포의 entries·sources가 --check를 통과한다 — 커밋한 works.json이 생성물과 바이트 단위로 같다', async () => {
    const result = await build(ART_ROOT, true);
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({ status: 'checked', works: 24, descriptions: 29, images: 24 });
  });

  it('works.json을 지우고 다시 만들면 커밋본과 같은 바이트 — 다시 돌리면 unchanged', async () => {
    const root = workspace();
    unlinkSync(path.join(root, ART_FILES.works));
    expect((await build(root)).status).toBe('written');
    expect(readFileSync(path.join(root, ART_FILES.works), 'utf8')).toBe(committedWorks());
    expect((await build(root)).status).toBe('unchanged');
  });

  it('prebuild가 --check를 돈다 — 낡은 works.json·바뀐 그림 파일이 배포로 새지 않는다', () => {
    const pkg = readJson(path.join(process.cwd(), 'package.json'));
    expect(pkg.scripts.prebuild).toContain('node scripts/build-art.mjs --check');
    expect(pkg.scripts['check:art']).toBe('node scripts/build-art.mjs --check');
  });

  it('스냅샷은 결정적 직렬화(키 정렬·2칸·끝 개행)로 커밋돼 있다', () => {
    const dir = path.join(ART_ROOT, ART_FILES.sources);
    const files = readdirSync(dir, { recursive: true }).filter((name) => String(name).endsWith('.json'));
    expect(files.length).toBe(52);
    for (const name of files) {
      const text = readFileSync(path.join(dir, String(name)), 'utf8');
      expect(serializeSnapshot(JSON.parse(text)), String(name)).toBe(text);
    }
  });

  it('entries에는 기계 필드(text·textSha256·credit·license·sourceUrl, 그림 url·credit·크기)를 쓰지 않는다', () => {
    for (const id of readJson(path.join(ART_ROOT, ART_FILES.entries, ART_FILES.order))) {
      const entry = readJson(entryFile(ART_ROOT, id));
      for (const description of entry.descriptions) expect(Object.keys(description).sort(), id).toEqual(['language', 'source', 'sourceId']);
      if (entry.image) expect(Object.keys(entry.image).sort(), id).toEqual(['alt', 'source', 'sourceId']);
    }
  });
});

describe('build-art — 결정적 직렬화', () => {
  it('serializeSnapshot은 받은 키 순서와 관계없이 같은 바이트', () => {
    const a = serializeSnapshot({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 'x' } });
    const b = serializeSnapshot({ a: { c: 'x', d: [3, { y: 2, z: 1 }] }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{\n  "a": {\n    "c": "x",\n    "d": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n');
  });

  it('entry의 키 순서가 달라도 works.json 작품 키 순서는 같다', async () => {
    const root = workspace();
    const file = entryFile(root, WAVE);
    const entry = readJson(file);
    writeJson(file, Object.fromEntries(Object.entries(entry).reverse()));
    expect((await build(root, true)).errors).toEqual([]);
  });
});

describe('build-art — 스냅샷 원문 → text → textSha256', () => {
  it('해설 text·textSha256은 스냅샷 원문을 artSourceText로 바꾼 값이다', async () => {
    const works = readJson(path.join(ART_ROOT, ART_FILES.works));
    for (const work of works) {
      for (const description of work.descriptions) {
        const snapshot = readJson(descriptionSnapshotPath(ART_ROOT, description.source, description.sourceId));
        const text = artSourceText(ART_SOURCES[description.source].snapshotRaw(snapshot, description.language));
        expect(description.text, `${work.id} ${description.sourceId}`).toBe(text);
        expect(description.textSha256).toBe(sha256(Buffer.from(text, 'utf8')));
        expect(description.credit).toBe(ART_SOURCES[description.source].credit(snapshot));
        expect(description.license).toBe(ART_SOURCES[description.source].license);
      }
    }
  });

  it('스냅샷 원문을 고치면 --check 실패 — works.json은 쓰지 않는다', async () => {
    const root = workspace();
    editJson(descriptionSnapshotPath(root, 'colbase', WAVE_JA), (snapshot) => { snapshot.description = snapshot.description.replace('大波', '小波'); });
    const result = await build(root, true);
    expect(result.errors).toEqual([expect.stringContaining('works.json이 entries·sources와 다르다')]);
    expect(readFileSync(path.join(root, ART_FILES.works), 'utf8')).toBe(committedWorks());
  });

  it('다시 받은 원문이 바뀌면 빌드가 text와 해시를 함께 바꾼다(검토할 diff)', async () => {
    const root = workspace();
    editJson(descriptionSnapshotPath(root, 'aic', WAVE_EN), (snapshot) => { snapshot.description = `${snapshot.description}<p>Added.</p>`; });
    expect((await build(root)).status).toBe('written');
    const before = readJson(path.join(ART_ROOT, ART_FILES.works)).find((work) => work.id === WAVE).descriptions[1];
    const after = readJson(path.join(root, ART_FILES.works)).find((work) => work.id === WAVE).descriptions[1];
    expect(after.text).toBe(`${before.text}\n\nAdded.`);
    expect(after.textSha256).not.toBe(before.textSha256);
  });

  it.each([
    ['박물관 내부 메모', '（20171003_h102）', '내부 메모'],
    ['읽기 표시', '宮＠みや＠は', '읽기 표시'],
  ])('%s가 섞인 원문은 계약 위반으로 실패', async (_, inserted, message) => {
    const root = workspace();
    editJson(descriptionSnapshotPath(root, 'colbase', WAVE_JA), (snapshot) => { snapshot.description = `${inserted}${snapshot.description}`; });
    const result = await build(root);
    expect(result.errors.join('\n')).toContain(message);
    expect(result.status).toBeNull();
    expect(readFileSync(path.join(root, ART_FILES.works), 'utf8')).toBe(committedWorks());
  });

  it('크레딧 표에 없는 ColBase 소장관이면 실패(크레딧을 지어내지 않는다)', async () => {
    const root = workspace();
    editJson(descriptionSnapshotPath(root, 'colbase', WAVE_JA), (snapshot) => { snapshot.provider = 'unknown-museum'; });
    expect((await build(root)).errors.join('\n')).toContain('크레딧 줄을 만들 수 없다');
  });
});

describe('build-art — 그림 파일 해시', () => {
  it('그림 파일 sha256이 스냅샷과 다르면 실패', async () => {
    const root = workspace();
    editJson(imageSnapshotPath(root, WAVE), (snapshot) => { snapshot.sha256 = '0'.repeat(64); });
    const result = await build(root, true);
    expect(result.errors).toEqual([expect.stringContaining('SHA-256·크기가')]);
  });

  it('바이트 수가 다르면 실패', async () => {
    const root = workspace();
    editJson(imageSnapshotPath(root, WAVE), (snapshot) => { snapshot.bytes += 1; });
    expect((await build(root, true)).errors).toEqual([expect.stringContaining('SHA-256·크기가')]);
  });

  it('메트 record가 퍼블릭 도메인이 아니면 캡션을 만들지 않는다', async () => {
    const root = workspace();
    editJson(imageSnapshotPath(root, WAVE), (snapshot) => { snapshot.record.isPublicDomain = false; });
    expect((await build(root)).errors.join('\n')).toContain('그림 라이선스가 아니다');
  });
});

describe('build-art — fail-closed(entries·스냅샷 참조)', () => {
  it('없는 해설 스냅샷을 가리키면 실패', async () => {
    const root = workspace();
    unlinkSync(descriptionSnapshotPath(root, 'aic', WAVE_EN));
    const result = await build(root, true);
    expect(result.errors).toEqual([expect.stringContaining('스냅샷 sources/aic/24645.json이 없다')]);
  });

  it('그림 스냅샷이 없으면 실패', async () => {
    const root = workspace();
    unlinkSync(imageSnapshotPath(root, WAVE));
    expect((await build(root, true)).errors).toEqual([expect.stringContaining('그림 스냅샷 sources/images/')]);
  });

  it('entries의 그림 출처와 스냅샷이 다르면 실패', async () => {
    const root = workspace();
    editJson(entryFile(root, WAVE), (entry) => { entry.image.sourceId = '1'; });
    expect((await build(root, true)).errors.join('\n')).toContain('고른 출처 met:1');
  });

  it('entries에 기계 필드를 쓰면 실패(손으로 쓴 text가 소리 없이 무시되지 않게)', async () => {
    const root = workspace();
    editJson(entryFile(root, WAVE), (entry) => { entry.descriptions[0].text = '手で書いた解説'; });
    expect((await build(root, true)).errors).toEqual([expect.stringContaining('descriptions[0].text: 모르는 키')]);
  });

  it('출처가 주지 않는 언어를 고르면 실패', async () => {
    const root = workspace();
    editJson(entryFile(root, WAVE), (entry) => { entry.descriptions[1].language = 'ja'; });
    expect((await build(root, true)).errors.join('\n')).toContain('aic는 en 해설만 있다');
  });

  it('order.json과 entries 파일이 어긋나면 실패', async () => {
    const root = workspace();
    const orderFile = path.join(root, ART_FILES.entries, ART_FILES.order);
    editJson(orderFile, (order) => { order.splice(order.indexOf(WAVE), 1); });
    expect((await build(root, true)).errors).toContain(`entries/${WAVE}.json: order.json에 없다(순서를 정한다)`);
    editJson(orderFile, (order) => { order.push(WAVE, 'no-such-work'); });
    expect((await build(root, true)).errors).toContain('entries/order.json: no-such-work.json이 없다');
  });

  it('entry id가 파일 이름과 다르면 실패', async () => {
    const root = workspace();
    editJson(entryFile(root, WAVE), (entry) => { entry.id = 'other-id'; });
    expect((await build(root, true)).errors.join('\n')).toContain('id가 파일 이름');
  });
});
