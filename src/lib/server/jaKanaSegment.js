// 서버 전용 — 가나 문절 분절 (분석기 리뷰 라운드 4, 오너 「순위대로 ㄱㄱ」 2026-09-02).
//
// ── 왜 필요한가
// N5 교재의 첫 텍스트는 가나 전용이고, 그게 kuromoji의 최악 조건이다(코퍼스 799문장 실측):
//   えいがを → え[フィラー]+いが · がくせい → がく+せい · にほんご → に+ほん+ご · みず → み(見る)+ず
//   くるま → くるむ[動詞] · かれ → かれる[動詞] · まえ → まえる[動詞]
// 명사가 동사로 둔갑해 뷰어에 그대로 뜬다. 드릴 R2(#1243)가 같은 벽을 만나 「정본 고정 문절 매칭」으로
// 풀었고, 여기서는 그 부품에 **정본 읽기 색인**(jaYomiIndex.json — 항목마다 있는 yomi)을 더한다.
//
// ── 무엇을 덮어쓰나 — kuromoji가 실제로 부서진 문절만 (정밀도 우선, 전부 코퍼스 실측)
// 문절 = [정본 단어(≥2자)] + [닫힌 꼬리(격조사·계사·する형)]* 로 **완전히 덮일 때**만 후보다(1,308/2,046).
// 그중 kuromoji 첫 토큰이 머리와 다르면(조각, 420) 또는 머리를 동사로 읽었는데 정본이 명사·형용사면
// (130) 덮어쓴다. 나머지 758은 kuromoji가 맞으니 둔다. 동음이의는 최저 급수가 정답(先生/専制·駅/液·
// 今日/強 — 100건 실측), 동급(雨/飴·橋/箸)은 기본형을 표면(가나)으로 둔다 — 틀린 카드에 잇지 않는다.
// 접미 2단어(にほん+じん)는 머리가 N5·N4일 때만(勧告+じん 배제).
//
// ── 무엇을 안 하나
// 띄어쓰기 없는 가나 텍스트는 문절 경계가 없어 손대지 않는다(현행 수렴). 동사 활용(たべます)은 정본이
// 사전형이라 안 덮이고 kuromoji가 맞게 낸다(たべ/たべる). 등재 밖은 무개입.
import JA_YOMI_INDEX from '../data/jaYomiIndex.json';

const LV = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
/** 문절 꼬리 — 격조사·계사·의문. 긴 것 먼저. 동사 어미(ます)는 없다: 어간은 정본 표제어가 아니다. */
const TAILS = ['ではありません', 'じゃありません', 'でしたか', 'でした', 'ですか', 'ですね', 'ですよ', 'では', 'じゃ', 'です', 'には', 'とは', 'にも', 'とも', 'へは', 'から', 'まで', 'より', 'は', 'が', 'を', 'に', 'へ', 'と', 'の', 'も', 'で', 'か', 'や', 'ね', 'よ'];
/** する형 — 명사+する(べんきょうします). 기본형은 する. */
const SURU = ['しましょう', 'しました', 'しません', 'します', 'して', 'した', 'しない', 'する'];
/** 접미 2단어 — 머리가 N5·N4일 때만. 기본형은 한자. */
const SUFFIX = { じん: '人', ご: '語', さん: 'さん', たち: 'たち', ちゃん: 'ちゃん', くん: 'くん' };
const POS_OF = { n: '名詞', v: '動詞', a: '形容詞', na: '形容動詞', d: '副詞', x: '名詞' };

const isKana = (s) => /^[ぁ-ゖァ-ヶー]+$/.test(s || '');
const k2h = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const candidates = (kana) => JA_YOMI_INDEX[k2h(kana)] || null;

function parseTails(rest, out) {
  while (rest) {
    const suru = SURU.find((x) => rest.startsWith(x));
    if (suru) { out.push({ surface_form: suru, basic_form: 'する', reading: suru, pos: '動詞' }); rest = rest.slice(suru.length); continue; }
    const tail = TAILS.find((x) => rest.startsWith(x));
    if (!tail) return null;
    out.push({ surface_form: tail, basic_form: tail, reading: tail, pos: /です|でした|ありません/.test(tail) ? '助動詞' : '助詞' });
    rest = rest.slice(tail.length);
  }
  return out;
}

/** 문절 → { head, cands, tokens } 또는 null. 머리는 가장 긴 정본 일치(2자 이상). */
export function decomposeKanaChunk(chunk) {
  // ≥2: 1자 머리는 조각이다(り·あ). 실제 방벽은 색인 자체(생성기가 1자 키를 안 싣는다 — jaKanaSegment.test가
  // 그 불변식을 못 박는다). 이 가드는 의도 표기 — 변이 실측상 색인이 지키는 동안은 잉여다.
  for (let len = chunk.length; len >= 2; len--) {
    const head = chunk.slice(0, len);
    const cands = candidates(head);
    if (!cands) continue;
    const rest = chunk.slice(len);
    // ① 머리 + 꼬리*
    const tails = parseTails(rest, []);
    if (tails) return { head, cands, tails };
    // ② 머리(N5·N4) + 접미 + 꼬리*
    const suf = Object.keys(SUFFIX).find((x) => rest.startsWith(x));
    if (suf && (cands[0][1] === 'N5' || cands[0][1] === 'N4')) {
      const t2 = parseTails(rest.slice(suf.length), [{ surface_form: suf, basic_form: SUFFIX[suf], reading: suf, pos: '名詞' }]);
      if (t2) return { head, cands, tails: t2 };
    }
  }
  return null;
}

/** 머리 토큰 — 동음이의는 최저 급수, 동급이면 기본형을 표면으로 둔다. */
function headToken(head, cands) {
  const [main, level, cls] = cands[0];
  const tie = cands.length > 1 && LV[cands[1][1]] === LV[level];
  return { surface_form: head, basic_form: tie ? head : main, reading: head, pos: POS_OF[cls] || '名詞', pos_detail_1: '*' };
}

/** kuromoji가 이 문절에서 실제로 부서졌나 — 조각(첫 토큰 ≠ 머리) 또는 명사·형용사를 동사로. */
export function kuromojiBroke(run, dec) {
  const k0 = run[0];
  if (k0.surface_form !== dec.head) return true;
  const cls = dec.cands[0][2];
  return k0.pos === '動詞' && ['n', 'a', 'na', 'd'].includes(cls);
}

/**
 * kuromoji 토큰 배열 → 가나 문절이 부서진 자리만 정본 분절로 바꾼 배열. 문절 = 기호(공백·구두점)나
 * 비가나 토큰 사이의 연속 가나 토큰 런. 등재 밖·정렬된 문절·띄어쓰기 없는 텍스트는 그대로.
 */
export function segmentKanaTokens(tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].pos === '記号' || !isKana(tokens[i].surface_form)) { out.push(tokens[i]); i++; continue; }
    let j = i;
    while (j < tokens.length && tokens[j].pos !== '記号' && isKana(tokens[j].surface_form)) j++;
    const run = tokens.slice(i, j);
    const chunk = run.map((t) => t.surface_form).join('');
    const dec = chunk.length >= 2 ? decomposeKanaChunk(chunk) : null;
    if (dec && kuromojiBroke(run, dec)) out.push(headToken(dec.head, dec.cands), ...dec.tails);
    else out.push(...run);
    i = j;
  }
  return out;
}
