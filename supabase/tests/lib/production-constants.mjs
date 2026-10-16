// 운영 고정 기대값 ↔ 관측 fixture 지역값 (KO-CAP-REPIN-001 · FINGERPRINT-REPIN-002). Local PGlite helpers only.
//
// 학습 계약을 고치는 마이그레이션은 적용 전 검사에 운영의 「지금 상태」를 상수로 박는다(게시 · 실제 capability 지문, FSRS 네 게시값).
// 관측 fixture는 같은 정의 위에서 지역 해시를 갖으므로, PGlite 검사는 이 여섯 상수만 그 순간의 fixture 값으로 바꾸고 나머지 본문은
// 파일 그대로 실행한다. 템플릿 · 지문 SELECT의 md5(4a497440… · 2e57290c…)는 fixture 본문이 운영 그대로라 바꾸지 않는다.
export const PROD = Object.freeze({
  pin: '1c25422cdd5f6be088ac624e8858cb3d', live: 'da2c7548aa782ebb81d55e69d913cd52',
  core: '9dcbdd2614642e67911d4fcf2055b42d', manual: 'edef271bed593ff8cec045bb5661fde3',
  admission: 'af33cb37ca276d0b23af51f0f46c012b', profile: 'e892069f4a99f5ba9565c54d72226740',
});

/**
 * 운영이 나중 상태로 옮긴 뒤의 같은 양(量) — 그 상태를 전제로 쓴 마이그레이션(예: PERF-SNAPSHOT P2 · P3 초안)용.
 * core: 191500(KO-CAP-REPIN-001) 적용 뒤 운영 core 게시값. capability는 그 뒤 게시 = 실제 = PROD.live(da2c…)라 따로 없다.
 */
export const PROD_LATER = Object.freeze({
  core: Object.freeze(['b2771b0426e2cb6aefe776edc9d0f108']),
});
const productionValues = key => [PROD[key], ...(PROD_LATER[key] || [])];
const allProductionValues = () => Object.keys(PROD).flatMap(productionValues);

const stripComments = sql => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');

/**
 * 운영 상수를 지역값으로 바꾼다 — 바꾼 뒤 운영 상수가 남아 있으면 던진다(일부만 바꾸면 검사가 엉뚱한 이유로 실패한다).
 * 같은 양의 이전 값과 나중 값이 주석 밖에 함께 있으면 던진다: 둘을 한 지역값으로 바꾸면 「core = 이전 값이냐 아니냐」 같은
 * 상태 분기가 구분되지 않는다(191500은 core 9dcbdd…로 분기한다). 주석(-- · /* *\/) 속 언급은 세지 않는다.
 * 코드에 쓰인 서로 다른 양이 같은 지역값이 되어도 던진다(같은 이유 — 아래).
 */
export function localize(sql, local) {
  const code = stripComments(sql);
  for (const key of Object.keys(PROD)) {
    const present = productionValues(key).filter(value => code.includes(value));
    if (present.length > 1) throw new Error(`localize: ${key}의 운영 값 여럿(${present.join(', ')})이 함께 있다 — 한 지역값으로 바꾸면 상태 분기가 사라진다`);
  }
  for (const key of Object.keys(PROD)) {
    if (typeof local[key] !== 'string' || !/^[0-9a-f]{32}$/.test(local[key])) throw new Error(`localize: 지역값 ${key} 없음`);
  }
  // 서로 다른 양(운영에서 값이 다른)이 같은 지역값으로 바뀌면 그 둘로 가르는 상태 분기가 사라진다 — 예: 191500을 이미 적용한 뒤
  // 「지금 값」으로 치환하면 게시(pin) = 실제(live)라 「고칠 상태(게시 = 1c25…)」 갈래로 잘못 들어가 엉뚱한 검사로 멈춘다.
  // 그 경우는 치환으로 흉내 낼 수 없으니 던진다(이미 적용한 상태는 상수를 고정한 PGlite 검사가 본다 — korean-capability-repin.mjs).
  const used = Object.keys(PROD).filter(key => productionValues(key).some(value => code.includes(value)));
  for (const [i, a] of used.entries()) for (const b of used.slice(i + 1)) {
    if (local[a] === local[b]) throw new Error(`localize: ${a}와 ${b}가 같은 지역값(${local[a]})으로 바뀐다 — 운영에서 다른 두 값이 한 값이 되면 상태 분기가 사라진다`);
  }
  let out = sql;
  for (const key of Object.keys(PROD)) {
    for (const value of productionValues(key)) out = out.replaceAll(value, local[key]);
  }
  for (const value of allProductionValues()) if (out.includes(value)) throw new Error(`localize: 운영 상수 ${value}가 남았다`);
  return out;
}

export const containsProductionConstants = sql => allProductionValues().some(value => sql.includes(value));

/**
 * 지금 DB(관측 fixture 위)의 여섯 값 — 게시 capability 상수, 실제 capability 지문(capability 함수 본문의 그 SELECT를 search_path=''에서),
 * FSRS 네 게시값. 운영 상수가 뜻하는 「적용 직전 운영 상태」를 같은 순간의 fixture 상태로 옮긴다.
 */
export async function localConstants(db) {
  const one = async sql => (await db.query(sql)).rows[0];
  const cap = await one(`SELECT substring(prosrc from 'ready:=live_hash= ''([0-9a-f]{32})''') pin,
    substring(prosrc from '(WITH RECURSIVE .*FROM objects) INTO live_hash;') fingerprint
    FROM pg_catalog.pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure`);
  if (!cap?.pin || !cap.fingerprint) throw new Error('localConstants: capability 본문에서 상수 · 지문 SELECT를 찾지 못했다');
  await db.exec("BEGIN; SET LOCAL search_path='';");
  let live;
  try { live = Object.values(await one(cap.fingerprint))[0]; } finally { await db.exec('COMMIT'); }
  const pins = await one(`SELECT (SELECT contract_hash FROM fsrs_private.settings) core,
    (SELECT contract_hash FROM fsrs_private.manual_save_settings) manual,
    (SELECT contract_hash FROM fsrs_private.admission_settings) admission,
    (SELECT profile_contract_hash FROM fsrs_private.activity_settings) profile`);
  return { pin: cap.pin, live, ...pins };
}
