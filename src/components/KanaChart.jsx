'use client';
import { Fragment, useState } from 'react';
import { useTTS } from '../lib/useTTS';
import KanaTracer from './KanaTracer';

const HIRAGANA = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '',   'ゆ', '',   'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', '',   '',   '',   'を'],
  ['ん', '',   '',   '',   ''  ],
];

const KATAKANA = [
  ['ア', 'イ', 'ウ', 'エ', 'オ'],
  ['カ', 'キ', 'ク', 'ケ', 'コ'],
  ['サ', 'シ', 'ス', 'セ', 'ソ'],
  ['タ', 'チ', 'ツ', 'テ', 'ト'],
  ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  ['マ', 'ミ', 'ム', 'メ', 'モ'],
  ['ヤ', '',   'ユ', '',   'ヨ'],
  ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  ['ワ', '',   '',   '',   'ヲ'],
  ['ン', '',   '',   '',   ''  ],
];

const ROW_LABELS = ['', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w', 'n'];
const COL_LABELS = ['a', 'i', 'u', 'e', 'o'];

export default function KanaChart({ variant = 'hiragana' }) {
  const { speak, supported } = useTTS();
  const [tracing, setTracing] = useState(null);
  const chart = variant === 'hiragana' ? HIRAGANA : KATAKANA;
  const titleKo = variant === 'hiragana' ? '히라가나 50음도' : '가타카나 50음도';

  return (
    <section className="kana-chart">
      <div className="kana-chart__header">
        <h3 className="kana-chart__title">{titleKo}</h3>
        <p className="kana-chart__hint">글자를 누르면 발음이 들려요 — 길게 누르면 따라 써보기</p>
      </div>

      <div className="kana-chart__grid">
        <div className="kana-chart__head kana-chart__head--corner" aria-hidden="true" />
        {COL_LABELS.map(l => (
          <div key={`col-${l}`} className="kana-chart__head">{l}</div>
        ))}

        {chart.map((row, ri) => (
          <Fragment key={ri}>
            <div className="kana-chart__head">{ROW_LABELS[ri]}</div>
            {row.map((c, ci) => (
              c ? (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  className="kana-chart__cell"
                  onClick={() => supported && speak(c, 'Japanese')}
                  onContextMenu={(e) => { e.preventDefault(); setTracing(c); }}
                  onDoubleClick={() => setTracing(c)}
                  aria-label={`${c} 발음 듣기 (더블클릭: 따라 쓰기)`}
                  title="클릭: 발음 / 더블클릭: 따라 쓰기"
                >
                  {c}
                </button>
              ) : (
                <div key={`${ri}-${ci}`} className="kana-chart__cell kana-chart__cell--empty" aria-hidden="true">·</div>
              )
            ))}
          </Fragment>
        ))}
      </div>

      <p className="kana-chart__footer">✏️ 글자를 더블클릭하면 화면 위에 직접 따라 쓸 수 있어요</p>

      <KanaTracer char={tracing} onClose={() => setTracing(null)} />
    </section>
  );
}
