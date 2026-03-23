import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const daysData = [
    { id: 0, ja: 'にちようび', kanji: '日曜日', ko: '일요일', romaji: 'nichiyoubi' },
    { id: 1, ja: 'げつようび', kanji: '月曜日', ko: '월요일', romaji: 'getsuyoubi' },
    { id: 2, ja: 'かようび', kanji: '火曜日', ko: '화요일', romaji: 'kayoubi' },
    { id: 3, ja: 'すいようび', kanji: '水曜日', ko: '수요일', romaji: 'suiyoubi' },
    { id: 4, ja: 'もくようび', kanji: '木曜日', ko: '목요일', romaji: 'mokuyoubi' },
    { id: 5, ja: 'きんようび', kanji: '金曜日', ko: '금요일', romaji: 'kin' + 'youbi' },
    { id: 6, ja: 'どようび', kanji: '土曜日', ko: '토요일', romaji: 'doyoubi' },
];

export const Chapter2_3: React.FC = () => {
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50/30">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">요일 익히기</h3>
            <p className="text-slate-500 mb-12 font-medium">달력의 요일을 클릭하여 일본어로 어떻게 읽는지 확인해보세요.</p>

            <div className="bg-white rounded-[2rem] p-10 shadow-lg border border-slate-100 flex flex-col items-center w-full max-w-4xl">
                
                {/* Calendar Header */}
                <div className="w-full flex justify-between items-center mb-8 px-4">
                    <div className="text-2xl font-black text-slate-800 tracking-tight">2026年 5月</div>
                    <div className="text-slate-400 font-bold">MAY</div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-4 w-full mb-8">
                    {['日', '月', '火', '水', '木', '金', '土'].map((kanji, idx) => (
                        <motion.button
                            key={idx}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedDay(idx)}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all ${
                                selectedDay === idx 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105 z-10' 
                                    : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-100'
                            }`}
                        >
                            <span className={`text-3xl font-bold mb-1 ${idx === 0 && selectedDay !== idx ? 'text-red-500' : ''} ${idx === 6 && selectedDay !== idx ? 'text-blue-500' : ''}`}>
                                {kanji}
                            </span>
                            <span className={`text-xs font-bold ${selectedDay === idx ? 'text-blue-200' : 'text-slate-400'}`}>
                                {daysData[idx].ko.replace('요일', '')}
                            </span>
                        </motion.button>
                    ))}
                    
                    {/* Dummy Dates to make it look like a calendar */}
                    {[26, 27, 28, 29, 30].map((d, i) => <div key={`prev-${i}`} className="aspect-square flex justify-center items-center text-slate-300 font-medium">{d}</div>)}
                    {[1, 2].map((d, i) => <div key={`cur-${i}`} className="aspect-square flex justify-center items-center text-slate-600 font-medium">{d}</div>)}
                </div>

                {/* Detail Panel */}
                <div className="w-full bg-slate-50 rounded-2xl min-h-[140px] flex items-center justify-center border-2 border-slate-100 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {selectedDay !== null ? (
                            <motion.div
                                key={selectedDay}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="flex items-center gap-12 w-full px-12"
                            >
                                <div className="flex-1 flex flex-col items-end border-r-2 border-slate-200 pr-12">
                                    <span className="text-5xl font-black text-[#1e3a8a] mb-2">{daysData[selectedDay].kanji}</span>
                                    <span className="text-xl text-slate-500 font-bold bg-white px-4 py-1 rounded-full border border-slate-100">
                                        {daysData[selectedDay].ko}
                                    </span>
                                </div>
                                <div className="flex-1 flex flex-col items-start pl-4">
                                    <span className="text-4xl font-bold text-slate-700 mb-2">{daysData[selectedDay].ja}</span>
                                    <span className="text-xl text-blue-500 tracking-wider font-medium">
                                        {daysData[selectedDay].romaji}
                                    </span>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-slate-400 font-medium flex items-center gap-3"
                            >
                                <span className="text-2xl">👆</span> 
                                위의 요일을 클릭하여 발음을 확인하세요
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    );
};
