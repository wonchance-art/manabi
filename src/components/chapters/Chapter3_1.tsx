import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const subjects = [
    { id: 'watashi', ja: 'わたし', ko: '저' },
    { id: 'anata', ja: 'あなた', ko: '당신' },
    { id: 'tanaka', ja: 'たなかさん', ko: '다나카 씨' },
    { id: 'kore', ja: 'これ', ko: '이것' },
];

const objects = [
    { id: 'gakusei', ja: 'がくせい', ko: '학생' },
    { id: 'sensei', ja: 'せんせい', ko: '선생님' },
    { id: 'nihonjin', ja: 'にほんじん', ko: '일본인' },
    { id: 'hon', ja: 'ほん', ko: '책' },
];

const endings = [
    { id: 'desu', ja: 'です。', ko: '입니다.', type: 'positive' },
    { id: 'ja_arimasen', ja: 'じゃありません。', ko: '이/가 아닙니다.', type: 'negative' },
    { id: 'desuka', ja: 'ですか。', ko: '입니까?', type: 'question' },
];

export const Chapter3_1: React.FC = () => {
    const [selectedSubj, setSelectedSubj] = useState(subjects[0]);
    const [selectedObj, setSelectedObj] = useState(objects[0]);
    const [selectedEnding, setSelectedEnding] = useState(endings[0]);

    return (
        <div className="w-full h-full flex flex-col items-center p-8 bg-slate-50/30 overflow-y-auto">
            <div className="text-center mb-10 mt-4">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">명사문 만들기 (Aは Bです)</h3>
                <p className="text-slate-500 font-medium">
                    버튼을 클릭하여 주어와 서술어를 변경하고, 문장이 어떻게 만들어지는지 확인하세요.
                </p>
            </div>

            {/* Sentence Display Builder */}
            <div className="bg-white px-10 py-12 rounded-[2rem] shadow-sm border border-slate-200 mb-12 w-full max-w-4xl">
                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-3xl font-bold text-slate-700">
                    
                    {/* Subject Slot */}
                    <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={selectedSubj.id}
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 10, opacity: 0 }}
                                className="text-blue-600 border-b-4 border-blue-200 pb-2 px-2 min-w-[120px] text-center"
                            >
                                {selectedSubj.ja}
                            </motion.div>
                        </AnimatePresence>
                        <span className="text-sm text-slate-400 mt-2 font-medium">{selectedSubj.ko}</span>
                    </div>

                    <div className="text-slate-400 pb-8 tracking-widest text-2xl font-black">は</div>

                    {/* Object Slot */}
                    <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={selectedObj.id}
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 10, opacity: 0 }}
                                className="text-indigo-600 border-b-4 border-indigo-200 pb-2 px-2 min-w-[140px] text-center"
                            >
                                {selectedObj.ja}
                            </motion.div>
                        </AnimatePresence>
                        <span className="text-sm text-slate-400 mt-2 font-medium">{selectedObj.ko}</span>
                    </div>

                    {/* Ending Slot */}
                    <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={selectedEnding.id}
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 10, opacity: 0 }}
                                className={`pb-2 px-2 min-w-[140px] text-center border-b-4 ${
                                    selectedEnding.type === 'positive' ? 'text-green-600 border-green-200' :
                                    selectedEnding.type === 'negative' ? 'text-red-500 border-red-200' :
                                    'text-amber-500 border-amber-200'
                                }`}
                            >
                                {selectedEnding.ja}
                            </motion.div>
                        </AnimatePresence>
                        <span className="text-sm text-slate-400 mt-2 font-medium">{selectedEnding.ko}</span>
                    </div>

                </div>

                {/* Translation Panel */}
                <div className="mt-12 bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={`${selectedSubj.id}-${selectedObj.id}-${selectedEnding.id}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xl font-bold text-slate-700 flex items-center gap-3"
                        >
                            <span className="text-blue-500">{selectedSubj.ko}</span>은(는) 
                            <span className="text-indigo-500">{selectedObj.ko}</span>
                            <span className={
                                selectedEnding.type === 'positive' ? 'text-green-600' :
                                selectedEnding.type === 'negative' ? 'text-red-500' :
                                'text-amber-500'
                            }>
                                {selectedEnding.ko}
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Controls */}
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Subject Selector */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h4 className="font-bold text-slate-500 mb-4 text-sm uppercase tracking-wider">주어 선택 (A)</h4>
                    <div className="flex flex-col gap-2">
                        {subjects.map(subj => (
                            <button
                                key={subj.id}
                                onClick={() => setSelectedSubj(subj)}
                                className={`px-4 py-3 rounded-xl text-left font-bold transition-all ${
                                    selectedSubj.id === subj.id
                                        ? 'bg-blue-50 text-blue-700 border-2 border-blue-200'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent'
                                }`}
                            >
                                {subj.ja} <span className="font-normal text-sm opacity-70 ml-2">({subj.ko})</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Object Selector */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h4 className="font-bold text-slate-500 mb-4 text-sm uppercase tracking-wider">명사 선택 (B)</h4>
                    <div className="flex flex-col gap-2">
                        {objects.map(obj => (
                            <button
                                key={obj.id}
                                onClick={() => setSelectedObj(obj)}
                                className={`px-4 py-3 rounded-xl text-left font-bold transition-all ${
                                    selectedObj.id === obj.id
                                        ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent'
                                }`}
                            >
                                {obj.ja} <span className="font-normal text-sm opacity-70 ml-2">({obj.ko})</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ending Selector */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h4 className="font-bold text-slate-500 mb-4 text-sm uppercase tracking-wider">서술어 형태</h4>
                    <div className="flex flex-col gap-2">
                        {endings.map(end => (
                            <button
                                key={end.id}
                                onClick={() => setSelectedEnding(end)}
                                className={`px-4 py-3 rounded-xl text-left font-bold transition-all ${
                                    selectedEnding.id === end.id
                                        ? end.type === 'positive' ? 'bg-green-50 text-green-700 border-2 border-green-200'
                                        : end.type === 'negative' ? 'bg-red-50 text-red-600 border-2 border-red-200'
                                        : 'bg-amber-50 text-amber-600 border-2 border-amber-200'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent'
                                }`}
                            >
                                {end.ja} <span className="font-normal text-sm opacity-70 block mt-1">{end.ko}</span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
