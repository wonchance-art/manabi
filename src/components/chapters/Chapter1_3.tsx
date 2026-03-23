import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';

export const Chapter1_3: React.FC = () => {
    const [blanks, setBlanks] = useState<{ id: string, answer: string, current: string | null, label: string }[]>([
        { id: 'name', answer: '나카무라', current: null, label: '이름' },
        { id: 'job', answer: '학생', current: null, label: '직업' },
        { id: 'country', answer: '한국', current: null, label: '국적' }
    ]);

    const options = ['학생', '한국', '나카무라', '선생님', '미국', '다나카'];

    const dropZoneRefs = useRef<(HTMLDivElement | null)[]>([]);

    const handleDragEnd = (_event: any, info: any, text: string) => {
        const { x, y } = info.point;
        
        let foundZone = -1;
        dropZoneRefs.current.forEach((ref, idx) => {
            if (!ref) return;
            const rect = ref.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                foundZone = idx;
            }
        });

        if (foundZone !== -1) {
            setBlanks(prev => {
                const newBlanks = [...prev];
                newBlanks[foundZone].current = text;
                return newBlanks;
            });
        }
    };

    const isComplete = blanks.every(b => b.current !== null);
    const isCorrect = blanks.every(b => b.current === b.answer);

    const checkAnswers = () => {
        if (!isComplete) return null;
        return isCorrect ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg font-bold">
                <Check size={20} /> 완벽합니다! (Watashi wa Nakamura desu.)
            </div>
        ) : (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-lg font-bold">
                다시 한 번 확인해보세요!
            </div>
        );
    };

    const reset = () => {
        setBlanks(prev => prev.map(b => ({ ...b, current: null })));
    };

    return (
        <div className="w-full h-full p-8 flex flex-col items-center bg-slate-50/30">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">자기소개 만들기</h3>
            <p className="text-slate-500 mb-8 font-medium">
                알맞은 단어를 빈칸으로 드래그하여 자기소개를 완성하세요.<br />
                <span className="text-sm text-blue-500">목표: '저는 나카무라입니다. 한국에서 온 학생입니다.'</span>
            </p>

            {/* Sentence Builder */}
            <div className="mb-12 flex flex-wrap items-center justify-center gap-4 text-2xl font-bold text-slate-700 max-w-2xl bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <span>はじめまして、わたしは</span>
                
                <div 
                    ref={el => { dropZoneRefs.current[0] = el; }}
                    className={`min-w-32 h-14 border-b-4 flex items-center justify-center transition-colors relative ${blanks[0].current ? 'border-blue-500' : 'border-slate-300 border-dashed'}`}
                >
                    {blanks[0].current ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-blue-600">{blanks[0].current}</motion.span>
                    ) : (
                        <span className="text-sm text-slate-400 absolute">{blanks[0].label}</span>
                    )}
                </div>
                
                <span>です。</span>

                <div className="w-full h-4"></div>

                <div 
                    ref={el => { dropZoneRefs.current[2] = el; }}
                    className={`min-w-24 h-14 border-b-4 flex items-center justify-center transition-colors relative ${blanks[2].current ? 'border-blue-500' : 'border-slate-300 border-dashed'}`}
                >
                    {blanks[2].current ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-blue-600">{blanks[2].current}</motion.span>
                    ) : (
                        <span className="text-sm text-slate-400 absolute">{blanks[2].label}</span>
                    )}
                </div>

                <span>からきた</span>

                <div 
                    ref={el => { dropZoneRefs.current[1] = el; }}
                    className={`min-w-24 h-14 border-b-4 flex items-center justify-center transition-colors relative ${blanks[1].current ? 'border-blue-500' : 'border-slate-300 border-dashed'}`}
                >
                    {blanks[1].current ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-blue-600">{blanks[1].current}</motion.span>
                    ) : (
                        <span className="text-sm text-slate-400 absolute">{blanks[1].label}</span>
                    )}
                </div>

                <span>です。</span>
            </div>

            {/* Status */}
            <div className="h-16 flex items-center justify-center mb-8">
                <AnimatePresence mode="wait">
                    {isComplete && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex flex-col items-center gap-3"
                        >
                            {checkAnswers()}
                            <button onClick={reset} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold transition-colors">
                                <RotateCcw size={14} /> 다시풀기
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Draggable Options */}
            <div className="flex flex-wrap justify-center gap-4 max-w-xl">
                {options.map((opt, i) => {
                    const isUsed = blanks.some(b => b.current === opt);
                    return (
                        <motion.div
                            drag={!isUsed}
                            dragSnapToOrigin={true}
                            onDragEnd={(e, info) => handleDragEnd(e, info, opt)}
                            key={i}
                            className={`px-6 py-3 rounded-xl font-bold text-lg cursor-grab active:cursor-grabbing border-2 ${
                                isUsed 
                                    ? 'bg-slate-100 text-slate-300 border-slate-200 shadow-none pointer-events-none'
                                    : 'bg-white text-slate-700 border-blue-100 shadow-sm hover:border-blue-400 hover:text-blue-600 hover:shadow-md'
                            } transition-all z-10 block`}
                        >
                            {opt}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
