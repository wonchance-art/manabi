import React, { useState } from 'react';
import { motion } from 'framer-motion';

const questionWords = [
    { id: 'nani', ja: 'なに / なん', ko: '무엇', desc: '사물이나 행동을 물을 때 사용합니다.' },
    { id: 'dare', ja: 'だれ', ko: '누구', desc: '사람을 물을 때 사용합니다.' },
    { id: 'itsu', ja: 'いつ', ko: '언제', desc: '시간이나 때를 물을 때 사용합니다.' },
    { id: 'doko', ja: 'どこ', ko: '어디', desc: '장소를 물을 때 사용합니다.' },
    { id: 'doushite', ja: 'どうして', ko: '왜 / 어째서', desc: '이유를 물을 때 사용합니다.' },
    { id: 'ikura', ja: 'いくら', ko: '얼마', desc: '가격이나 양을 물을 때 사용합니다.' },
];

export const Chapter3_2: React.FC = () => {
    const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

    const toggleCard = (id: string) => {
        setFlippedCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className="w-full h-full p-8 flex flex-col items-center bg-slate-50/30 overflow-y-auto">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">의문사 익히기</h3>
            <p className="text-slate-500 mb-10 font-medium">카드를 클릭하여 일본어 의문사의 뜻을 확인해보세요.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                {questionWords.map(word => {
                    const isFlipped = flippedCards[word.id];
                    return (
                        <div 
                            key={word.id}
                            className="relative w-full aspect-[4/3] cursor-pointer"
                            style={{ perspective: '1000px' }}
                            onClick={() => toggleCard(word.id)}
                        >
                            <motion.div
                                className="w-full h-full relative"
                                style={{ transformStyle: 'preserve-3d' }}
                                animate={{ rotateY: isFlipped ? 180 : 0 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                            >
                                {/* Front */}
                                <div 
                                    className="absolute w-full h-full backface-hidden bg-white rounded-3xl border-2 border-blue-100 shadow-sm flex items-center justify-center p-6 hover:border-blue-300 hover:shadow-md transition-all"
                                >
                                    <div className="text-5xl font-black text-[#1e3a8a]">{word.ja}</div>
                                </div>

                                {/* Back */}
                                <div 
                                    className="absolute w-full h-full backface-hidden bg-blue-600 rounded-3xl shadow-md flex flex-col items-center justify-center p-8 text-white rotate-y-180"
                                >
                                    <div className="text-4xl font-black mb-4">{word.ko}</div>
                                    <div className="text-blue-100 text-center font-medium leading-relaxed">
                                        {word.desc}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-12 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full max-w-3xl flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl shrink-0">💡</div>
                <div>
                    <h4 className="font-bold text-slate-800 mb-2">질문하기 팁</h4>
                    <p className="text-slate-600 font-medium">
                        질문할 때는 문장 끝에 <strong className="text-blue-600 text-xl font-bold px-1">か (까)</strong>를 붙이고 억양을 살짝 올립니다. <br/>
                        예: だれですか？(다레데스까? - 누구입니까?)
                    </p>
                </div>
            </div>
        </div>
    );
};
