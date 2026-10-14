// 아오조라 계약 테스트 공용 픽스처. 서식 견본(format-sample-*.txt)은 실제 작품이 아니다 — fixtures/aozora/README.md.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const aozoraFixturePath = (name) => fileURLToPath(new URL(`../fixtures/aozora/${name}`, import.meta.url));
export const aozoraFixture = (name) => readFileSync(aozoraFixturePath(name), 'utf8');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const approvedRights = (overrides = {}) => ({
  status: 'approved',
  basis: 'public-domain',
  reviewedBy: 'owner',
  reviewedAt: '2026-10-12',
  reviewedJurisdictions: ['JP', 'KR', 'US'],
  evidenceUrl: 'https://www.aozora.gr.jp/cards/000001/card1.html',
  ...overrides,
});

/** 서식 견본 「朝の川」(見出し 2개)에 맞춘 승인 항목. */
export const sampleEntry = (overrides = {}) => ({
  schemaVersion: 1,
  personId: '000001',
  workId: '1',
  title: '書式見本　朝の川',
  author: '見本太郎',
  language: 'ja',
  charset: '新字新仮名',
  publishedYear: 1920,
  authorDeathYear: 1940,
  level: 'N3 중급',
  cardUrl: 'https://www.aozora.gr.jp/cards/000001/card1.html',
  sourceFileUrl: 'https://www.aozora.gr.jp/cards/000001/files/1_ruby_1.zip',
  sourceFormat: 'txt',
  sourceSha256: 'a'.repeat(64),
  textSha256: 'b'.repeat(64),
  attribution: { author: '見本太郎', translator: null, illustrator: null },
  rights: approvedRights(),
  display: { titleReading: 'しょしきみほん　あさのかわ', titleKo: '서식 견본 아침 강', authorKo: '견본 다로', cover: 'snow', coverTitle: '書式見本　\n朝の川' },
  ...overrides,
});

/** 서식 견본 「夕方の町」(見出し 없음)에 맞춘 승인 항목. */
export const plainSampleEntry = (overrides = {}) => sampleEntry({
  personId: '000002',
  workId: '2',
  title: '書式見本　夕方の町',
  author: '見本花子',
  cardUrl: 'https://www.aozora.gr.jp/cards/000002/card2.html',
  sourceFileUrl: 'https://www.aozora.gr.jp/cards/000002/files/2_ruby_2.zip',
  sourceSha256: 'c'.repeat(64),
  attribution: { author: '見本花子', translator: null, illustrator: null },
  rights: approvedRights({ evidenceUrl: 'https://www.aozora.gr.jp/cards/000002/card2.html' }),
  display: { titleReading: 'しょしきみほん　ゆうがたのまち', titleKo: '서식 견본 저녁 마을', authorKo: '견본 하나코', cover: 'ink', coverTitle: '書式見本　\n夕方の町' },
  ...overrides,
});
