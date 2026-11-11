/** Local, disposable PGlite only — never connects to Supabase (JA-KANJI-A-001 · 2026-11-11 KST).
 * 20261111010000_ja_n5_kanji_a2: 공개 N5 시드 표기 전환(A-2) · 표제어 · 오분할 보정.
 * 픽스처 = 운영 실측 토큰(text · base_form · pos, 11/11 읽기 전용)으로 재구성한 3편 — #45(가나 구간 · 합치기) · #52(전환) · #61(머리줄 · 숫자 + 조수사 · 오독).
 * 증명: 자료별 개수가 운영 CTE 실측과 같다 · 전환 본문 · furigana · 머리줄 읽기 그대로 · 가나 구간 표기 그대로 · 토큰 이음 = 원문 ·
 *   재적용 무변경 · 복원 SQL · 학습 기록 있으면 멈춤 · 예상 상태가 아니면 멈춤 · 대상 없는 환경 무변경 · 표 없는 환경 42P01 · 지문 그대로.
 *   node supabase/tests/ja-n5-kanji-a2.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261111010000_ja_n5_kanji_a2.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/ja-kanji-a2-20261111-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

// 운영 내용 토큰(기호 · 개행 제외) — 「줄_칸~text~base_form~pos」. 기호 토큰은 원문에서 빈 칸 번호로 채운다.
const M = {
  45: { title: '[N5 문법 #1] ~は~です (기본 단정문)', sfx: '1794076415068',
    raw: 'わたしは がくせいです。\nあなたは せんせいです。\nわたしは かんこくじんです。\nたなかさんは にほんじんです。\n\nあなたは がくせいですか。\nはい、 がくせいです。\nいいえ、 せんせいです。\n\nわたしは にほんじん じゃないです。\nかんこくじんです。',
    toks: '0_0~わたし~わたし~명사|0_1~は~は~조사|0_3~がくせい~学生~명사|0_4~です~です~조동사|1_0~あなた~あなた~명사|1_1~は~は~조사|1_3~せんせい~せんせい~명사|1_4~です~です~조동사|2_0~わたし~わたし~명사|2_1~は~は~조사|2_3~かん~かん~명사|2_4~こく~こい~형용사|2_5~じ~じ~조동사|2_6~ん~ん~조동사|2_7~です~です~조동사|3_0~た~た~조동사|3_1~なか~なか~명사|3_2~さん~さん~명사|3_3~は~は~조사|3_5~にほん~日本~명사|3_6~じん~人~명사|3_7~です~です~조동사|5_0~あなた~あなた~명사|5_1~は~は~조사|5_3~がくせい~学生~명사|5_4~ですか~ですか~조동사|6_0~はい~はい~감탄사|6_3~がくせい~学生~명사|6_4~です~です~조동사|7_0~いいえ~いいえ~감탄사|7_3~せんせい~せんせい~명사|7_4~です~です~조동사|9_0~わたし~わたし~명사|9_1~は~は~조사|9_3~にほん~日本~명사|9_4~じん~人~명사|9_6~じゃ~じゃ~조사|9_7~ない~ない~조동사|9_8~です~です~조동사|10_0~かん~かん~명사|10_1~こく~こい~형용사|10_2~じ~じ~조동사|10_3~ん~ん~조동사|10_4~です~です~조동사' },
  52: { title: '[N5 문법 #10] 동사 ます형', sfx: '1793989828209',
    raw: 'ほんを よみます。\nパンを たべます。\nえいがを みます。\nコーヒーを のみます。\nにほんごを べんきょう します。\nあさごはんを たべます。\nおんがくを ききます。\nてがみを かきます。',
    toks: '0_0~ほん~ほん~명사|0_1~を~を~조사|0_3~よみ~よむ~동사|0_4~ます~ます~조동사|1_0~パン~パン~명사|1_1~を~を~조사|1_3~たべ~たべる~동사|1_4~ます~ます~조동사|2_0~えいが~えいが~명사|2_1~を~を~조사|2_3~み~みる~동사|2_4~ます~ます~조동사|3_0~コーヒー~コーヒー~명사|3_1~を~を~조사|3_3~のみ~のむ~동사|3_4~ます~ます~조동사|4_0~にほんご~日本語~명사|4_1~を~を~조사|4_3~べんきょう~べんきょう~명사|4_5~し~する~동사|4_6~ます~ます~조동사|5_0~あさごはん~あさごはん~명사|5_1~を~を~조사|5_3~たべ~たべる~동사|5_4~ます~ます~조동사|6_0~おんがく~音楽~명사|6_1~を~を~조사|6_3~きき~きく~동사|6_4~ます~ます~조동사|7_0~てがみ~手紙~명사|7_1~を~を~조사|7_3~かき~かく~동사|7_4~ます~ます~조동사' },
  61: { title: '[N5 문법 #18] ~から / ~まで (범위)', sfx: '1793989842149',
    raw: '오늘 만나는 한자\n時 (じ) — 시\n東京 (とうきょう) — 도쿄\n大阪 (おおさか) — 오사카\n\n본문\n9時から 5時まで はたらきます。\n東京から 大阪まで しんかんせんで いきます。\nげつようびから きんようびまで がっこうです。\nうちから えきまで あるいて 5ふんです。\nあさ 8時から べんきょうを します。\nコンサートは 7時からです。\nやすみは どようびから にちようびまでです。\n4がつから しごとを はじめます。',
    toks: '1_0~時~時~명사|1_3~じ~じ~조동사|2_0~東京~東京~명사|2_3~とう~とう~부사|2_4~きょう~きょう~명사|3_0~大阪~大阪~명사|3_3~おおさか~おおさか~명사|6_0~9時~9時~명사|6_1~から~から~조사|6_3~5時~5時~명사|6_4~まで~まで~조사|6_6~はたらき~はたらく~동사|6_7~ます~ます~조동사|7_0~東京~東京~명사|7_1~から~から~조사|7_3~大阪~大阪~명사|7_4~まで~まで~조사|7_6~しんかんせん~新幹線~명사|7_7~で~で~조사|7_9~いき~いく~동사|7_10~ます~ます~조동사|8_0~げつようび~月曜日~명사|8_1~から~から~조사|8_3~きんようび~金曜日~명사|8_4~まで~まで~조사|8_6~がっこう~学校~명사|8_7~です~です~조동사|9_0~うち~うち~명사|9_1~から~から~조사|9_3~えき~駅~명사|9_4~まで~まで~조사|9_6~ある~ある~동사|9_7~い~いる~동사|9_8~て~て~조동사|9_10~5~5~명사|9_11~ふん~ふん~명사|9_12~です~です~조동사|10_0~あさ~あさ~명사|10_2~8時~8時~명사|10_3~から~から~조사|10_5~べんきょう~べんきょう~명사|10_6~を~を~조사|10_8~し~する~동사|10_9~ます~ます~조동사|11_0~コンサート~コンサート~명사|11_1~は~は~조사|11_3~7時~7時~명사|11_4~から~から~조사|11_5~です~です~조동사|12_0~やすみ~やすみ~명사|12_1~は~は~조사|12_3~どようび~土曜日~명사|12_4~から~から~조사|12_6~にちようび~日曜日~명사|12_7~まで~まで~조사|12_8~です~です~조동사|13_0~4~4~명사|13_1~が~が~조사|13_2~つ~つ~조동사|13_3~から~から~조사|13_5~しごと~仕事~명사|13_6~を~を~조사|13_8~はじめ~はじめ~명사|13_9~ます~ます~조동사' },
};

/** 원문 + 내용 토큰 → processed_json. 내용 토큰 사이의 글자는 빈 칸 번호(없으면 다음 번호)에 기호 토큰으로 넣는다 — 이으면 원문과 같다. */
function build({ raw, toks, sfx }) {
  const byLine = new Map();
  for (const t of toks.split('|')) {
    const [lc, text, base_form, pos] = t.split('~');
    const [L, C] = lc.split('_').map(Number);
    if (!byLine.has(L)) byLine.set(L, []);
    byLine.get(L).push({ C, text, base_form, pos });
  }
  const sequence = []; const dictionary = {};
  raw.split('\n').forEach((line, L) => {
    const content = (byLine.get(L) || []).sort((a, b) => a.C - b.C);
    let at = 0; let nextC = 0;
    const sym = (s, C) => { const key = `id_${L}_${C}_${sfx}`; sequence.push(key); dictionary[key] = { pos: '기호', text: s, meaning: '', furigana: null, base_form: s }; };
    for (const t of content) {
      const i = line.indexOf(t.text, at);
      if (i < 0) throw new Error(`fixture: ${t.text} not in line ${L}`);
      if (i > at) sym(line.slice(at, i), nextC < t.C ? nextC : t.C - 0.5);
      const key = `id_${L}_${t.C}_${sfx}`;
      sequence.push(key);
      dictionary[key] = { pos: t.pos, text: t.text, meaning: 'm', furigana: /[一-鿿]/.test(t.text) ? 'よみ' : null, base_form: t.base_form };
      at = i + t.text.length; nextC = t.C + 1;
    }
    if (at < line.length) sym(line.slice(at), nextC);
    const br = `br_${L}_${sfx}`; sequence.push(br); dictionary[br] = { pos: '개행', text: '\n' };
  });
  sequence.pop(); // 마지막 줄 뒤 개행 없음
  return { status: 'completed', sequence, dictionary, metadata: { language: 'Japanese', level: 'N5 기초', updated_at: 'u0', viewerRevision: 'r0', difficulty: { version: 1 }, viewerCorrections: {} } };
}

async function fixture({ extra = '' } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create table public.reading_materials (id bigint primary key, title text, raw_text text, visibility text, owner_id uuid, processed_json jsonb);
    create table public.reading_progress (id serial primary key, material_id bigint, last_token_idx int);
    create table public.user_vocabulary (id serial primary key, material_id bigint, source_material_id bigint);
    create table public.vocabulary_contexts (id serial primary key, material_id bigint);
    ${extra}`);
  for (const [id, m] of Object.entries(M)) {
    await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [Number(id), m.title, m.raw, 'public', build(m)]);
  }
  await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [900, 'other', 'x', 'public', { status: 'completed', metadata: { language: 'Japanese', level: 'N5 기초' }, sequence: [], dictionary: {} }]);
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select id, raw_text, processed_json from public.reading_materials order by id')).rows.map((r) => [r.id, r]));
const tok = (r, key) => r.processed_json.dictionary[key];

const db = await fixture();
const before = await rows(db);
await check('픽스처 — 토큰 이음 = 원문(운영과 같은 조건)', async () => {
  for (const id of [45, 52, 61]) {
    const { sequence, dictionary } = before[id].processed_json;
    assert.equal(sequence.map((k) => dictionary[k].text).join(''), before[id].raw_text, String(id));
  }
});
await db.exec(migration);
const after = await rows(db);
await check('#52 전환 본문 — 자연 표기(活用형 어간 · 명사) · 띄어쓰기 그대로', async () => {
  assert.equal(after[52].raw_text, '本を 読みます。\nパンを 食べます。\n映画を 見ます。\nコーヒーを 飲みます。\n日本語を 勉強 します。\n朝ご飯を 食べます。\n音楽を 聞きます。\n手紙を 書きます。');
});
await check('furigana — 명사 = 원래 가나 · 동사 = 기본형 읽기 · 표제어 고정', async () => {
  const s = '1793989828209';
  assert.deepEqual([tok(after[52], `id_0_0_${s}`).text, tok(after[52], `id_0_0_${s}`).furigana, tok(after[52], `id_0_0_${s}`).base_form], ['本', 'ほん', '本']);
  assert.deepEqual([tok(after[52], `id_1_3_${s}`).text, tok(after[52], `id_1_3_${s}`).furigana, tok(after[52], `id_1_3_${s}`).base_form], ['食べ', 'たべる', '食べる']);
  assert.deepEqual([tok(after[52], `id_4_0_${s}`).text, tok(after[52], `id_4_0_${s}`).furigana], ['日本語', 'にほんご']);
  assert.deepEqual([tok(after[52], `id_5_0_${s}`).text, tok(after[52], `id_5_0_${s}`).base_form], ['朝ご飯', '朝御飯']);
  assert.equal(tok(after[52], `id_4_5_${s}`).text, 'し'); // する는 가나
});
await check('#61 — 머리줄 읽기 그대로 · 본문 전환 · 숫자 + 조수사 한 토큰 · 오독 보정', async () => {
  const lines = after[61].raw_text.split('\n');
  assert.deepEqual(lines.slice(0, 6), ['오늘 만나는 한자', '時 (じ) — 시', '東京 (とうきょう) — 도쿄', '大阪 (おおさか) — 오사카', '', '본문']);
  assert.deepEqual(lines.slice(6), ['9時から 5時まで 働きます。', '東京から 大阪まで 新幹線で 行きます。', '月曜日から 金曜日まで 学校です。',
    'うちから 駅まで 歩いて 5分です。', '朝 8時から 勉強を します。', 'コンサートは 7時からです。', '休みは 土曜日から 日曜日までです。', '4月から 仕事を 始めます。']);
  const s = '1793989842149';
  assert.deepEqual([tok(after[61], `id_13_0_${s}`).text, tok(after[61], `id_13_0_${s}`).furigana, tok(after[61], `id_13_0_${s}`).base_form], ['4月', 'しがつ', '4月']);
  assert.deepEqual([tok(after[61], `id_9_10_${s}`).text, tok(after[61], `id_9_10_${s}`).furigana], ['5分', 'ごふん']);
  assert.deepEqual([tok(after[61], `id_9_6_${s}`).text, tok(after[61], `id_9_6_${s}`).base_form], ['歩い', '歩く']);
  assert.equal(tok(after[61], `id_13_1_${s}`), undefined); // 합쳐진 key는 사라진다
  assert.deepEqual([tok(after[61], `id_2_3_${s}`).text, tok(after[61], `id_2_3_${s}`).base_form], ['とうきょう', '東京']); // 머리줄 — 표기 그대로, 표제어만
  assert.equal(after[61].processed_json.metadata.difficulty, undefined);
  assert.notEqual(after[61].processed_json.metadata.viewerRevision, 'r0');
});
await check('#45 가나 구간 — 표기 그대로(원문 동일) · 표제어 · 분할만', async () => {
  assert.equal(after[45].raw_text, before[45].raw_text);
  const s = '1794076415068';
  assert.deepEqual([tok(after[45], `id_2_3_${s}`).text, tok(after[45], `id_2_3_${s}`).base_form], ['かんこく', '韓国']);
  assert.deepEqual([tok(after[45], `id_2_3s2_${s}`).text, tok(after[45], `id_2_3s2_${s}`).base_form], ['じん', '人']);
  assert.deepEqual([tok(after[45], `id_3_0_${s}`).text, tok(after[45], `id_3_0_${s}`).base_form], ['たなか', '田中']);
  assert.deepEqual([tok(after[45], `id_0_0_${s}`).text, tok(after[45], `id_0_0_${s}`).base_form, tok(after[45], `id_0_0_${s}`).furigana], ['わたし', '私', null]);
  assert.equal(after[45].processed_json.sequence.length, before[45].processed_json.sequence.length - 5);
  const seqLines = after[45].processed_json.sequence.filter((k) => k.startsWith('id_')).map((k) => Number(/^id_(\d+)_/.exec(k)[1]));
  assert.deepEqual([...seqLines].sort((a, b) => a - b), seqLines); // 줄 번호 순서 그대로
});
await check('토큰 이음 = 원문 · 대상 밖 자료 그대로 · 재적용 무변경 · 지문 그대로', async () => {
  for (const id of [45, 52, 61]) {
    const { sequence, dictionary } = after[id].processed_json;
    assert.equal(sequence.map((k) => dictionary[k].text).join(''), after[id].raw_text, String(id));
  }
  assert.deepEqual(after[900], before[900]);
  await db.exec(migration);
  assert.deepEqual(await rows(db), after);
  assert.equal((await db.query('select count(*)::int n from backup_private.ja_kanji_a2_20261111')).rows[0].n, 3);
  assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp');
});
await check('복원 SQL — 처음 모양', async () => { await db.exec(rollback); assert.deepEqual(await rows(db), before); });
await db.close();
for (const [label, sql, pattern] of [
  ['읽기 진행이 바뀌는 첫 자리 뒤', 'insert into public.reading_progress (material_id, last_token_idx) values (45, 30)', /reading progress past the first changed token/],
  ['대상 자료에서 저장한 단어', 'insert into public.user_vocabulary (material_id) values (52)', /user_vocabulary\.material_id has 1 rows/],
  ['예상 상태가 아님(토큰이 이미 바뀜)', "update public.reading_materials set processed_json = jsonb_set(processed_json, '{dictionary,id_0_0_1793989828209,base_form}', '\"本\"') where id = 52", /pre-check failed — 52: rules 10\/11/],
]) {
  const d = await fixture();
  await d.exec(sql);
  await check(`멈춤 — ${label}(무변경)`, async () => {
    const s = await rows(d);
    await assert.rejects(d.exec(migration), pattern);
    assert.deepEqual(await rows(d), s);
  });
  await d.close();
}
{
  const d = await fixture();
  await d.exec('insert into public.reading_progress (material_id, last_token_idx) values (45, 0)');
  await check('읽기 진행이 바뀌는 첫 자리 앞이면 진행(운영 #45 · idx 0)', async () => { await d.exec(migration); assert.notDeepEqual((await rows(d))[45], before[45]); });
  await d.close();
}
{
  const d = new PGlite();
  await d.exec('create role anon nologin; create role authenticated nologin; create table public.reading_materials (id bigint primary key, raw_text text, visibility text, processed_json jsonb)');
  await check('대상 자료가 없는 환경 — 무변경', async () => { await d.exec(migration); assert.equal((await d.query('select count(*)::int n from public.reading_materials')).rows[0].n, 0); });
  await d.close();
}
{
  const d = new PGlite();
  await check('표 없는 환경 — 42P01', async () => { await assert.rejects(d.exec(migration), (e) => e.code === '42P01'); });
  await d.close();
}
console.log(`ja-n5-kanji-a2: ${checks} checks passed`);
