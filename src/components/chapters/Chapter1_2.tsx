import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const hiraganaData = [
  { kana: 'あ', romaji: 'a', word: 'あり', meaning: '개미' },
  { kana: 'い', romaji: 'i', word: 'いぬ', meaning: '개' },
  { kana: 'う', romaji: 'u', word: 'うし', meaning: '소' },
  { kana: 'え', romaji: 'e', word: 'えんぴつ', meaning: '연필' },
  { kana: 'お', romaji: 'o', word: 'おにぎり', meaning: '주먹밥' },
  { kana: 'か', romaji: 'ka', word: 'かさ', meaning: '우산' },
  { kana: 'き', romaji: 'ki', word: 'きのこ', meaning: '버섯' },
  { kana: 'く', romaji: 'ku', word: 'くま', meaning: '곰' },
  { kana: 'け', romaji: 'ke', word: 'けむし', meaning: '모충' },
  { kana: 'こ', romaji: 'ko', word: 'こま', meaning: '팽이' },
  { kana: 'さ', romaji: 'sa', word: 'さかな', meaning: '물고기' },
  { kana: 'し', romaji: 'shi', word: 'しか', meaning: '사슴' },
  { kana: 'す', romaji: 'su', word: 'すいか', meaning: '수박' },
  { kana: 'せ', romaji: 'se', word: 'せんせい', meaning: '선생님' },
  { kana: 'そ', romaji: 'so', word: 'そら', meaning: '하늘' },
  { kana: 'た', romaji: 'ta', word: 'たい', meaning: '도미' },
  { kana: 'ち', romaji: 'chi', word: 'ちず', meaning: '지도' },
  { kana: 'つ', romaji: 'tsu', word: 'つき', meaning: '달' },
  { kana: 'て', romaji: 'te', word: 'てがみ', meaning: '편지' },
  { kana: 'と', romaji: 'to', word: 'とけい', meaning: '시계' },
  { kana: 'な', romaji: 'na', word: 'なす', meaning: '가지' },
  { kana: 'に', romaji: 'ni', word: 'にわとり', meaning: '닭' },
  { kana: 'ぬ', romaji: 'nu', word: 'ぬの', meaning: '천' },
  { kana: 'ね', romaji: 'ne', word: 'ねこ', meaning: '고양이' },
  { kana: 'の', romaji: 'no', word: 'のり', meaning: '김' },
  { kana: 'は', romaji: 'ha', word: 'はな', meaning: '꽃' },
  { kana: 'ひ', romaji: 'hi', word: 'ひこうき', meaning: '비행기' },
  { kana: 'ふ', romaji: 'fu', word: 'ふね', meaning: '배' },
  { kana: 'へ', romaji: 'he', word: 'へび', meaning: '뱀' },
  { kana: 'ほ', romaji: 'ho', word: 'ほし', meaning: '별' },
  { kana: 'ま', romaji: 'ma', word: 'まめ', meaning: '콩' },
  { kana: 'み', romaji: 'mi', word: 'みかん', meaning: '귤' },
  { kana: 'む', romaji: 'mu', word: 'むし', meaning: '벌레' },
  { kana: 'め', romaji: 'me', word: 'めがね', meaning: '안경' },
  { kana: 'も', romaji: 'mo', word: 'もも', meaning: '복숭아' },
  { kana: 'や', romaji: 'ya', word: 'やま', meaning: '산' },
  { kana: 'ゆ', romaji: 'yu', word: 'ゆき', meaning: '눈' },
  { kana: 'よ', romaji: 'yo', word: 'よる', meaning: '밤' },
  { kana: 'ら', romaji: 'ra', word: 'らくだ', meaning: '낙타' },
  { kana: 'り', romaji: 'ri', word: 'りんご', meaning: '사과' },
  { kana: 'る', romaji: 'ru', word: 'るすばん', meaning: '집보기' },
  { kana: 'れ', romaji: 're', word: 'れもん', meaning: '레몬' },
  { kana: 'ろ', romaji: 'ro', word: 'ろうそく', meaning: '양초' },
  { kana: 'わ', romaji: 'wa', word: 'わに', meaning: '악어' },
  { kana: 'を', romaji: 'wo', word: 'を', meaning: '을/를 (조사)' },
  { kana: 'ん', romaji: 'n', word: 'えんぴつ', meaning: '연필 (끝음)' },
];

export const Chapter1_2: React.FC = () => {
    const [selected, setSelected] = useState<typeof hiraganaData[0] | null>(null);

    return (
        <div className="w-full h-full p-8 flex flex-col items-center bg-slate-50/30">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">히라가나 첫걸음</h3>
            <p className="text-slate-500 mb-8 font-medium">글자를 클릭하여 발음과 단어를 확인해보세요.</p>

            <div className="flex w-full max-w-4xl gap-8">
                {/* Chart Area */}
                <div className="flex-1 grid grid-cols-5 gap-3">
                    {hiraganaData.map((item, idx) => (
                        <motion.button
                            key={idx}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelected(item)}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-4xl font-bold transition-colors ${
                                selected?.kana === item.kana 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                                    : 'bg-white text-slate-700 border-2 border-slate-100 hover:border-blue-300'
                            }`}
                        >
                            {item.kana}
                            <span className={`text-sm mt-2 ${selected?.kana === item.kana ? 'text-blue-100' : 'text-slate-400'}`}>
                                {item.romaji}
                            </span>
                        </motion.button>
                    ))}
                </div>

                {/* Detail Panel */}
                <div className="w-64 bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 flex flex-col items-center justify-center relative overflow-hidden h-96">
                    <AnimatePresence mode="wait">
                        {selected ? (
                            <motion.div
                                key={selected.kana}
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                className="flex flex-col items-center text-center w-full"
                            >
                                <div className="text-7xl font-bold text-blue-600 mb-4">{selected.kana}</div>
                                <div className="w-full h-px bg-slate-200 my-4"></div>
                                <div className="text-xs text-slate-400 mb-1 uppercase tracking-widest font-bold">Word Example</div>
                                <div className="text-2xl font-bold text-slate-800 mb-2">{selected.word}</div>
                                <div className="text-lg text-blue-600 font-medium bg-blue-100 px-4 py-1 rounded-full">{selected.meaning}</div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-slate-400 text-center font-medium"
                            >
                                <div className="text-5xl mb-4 opacity-50">👆</div>
                                왼쪽에서 글자를 선택해주세요
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
