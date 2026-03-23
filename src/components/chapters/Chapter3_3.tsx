import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type DemoType = 'kore' | 'sore' | 'are';

const demoData = {
    kore: {
        id: 'kore',
        ja: 'これ',
        ko: '이것',
        desc: '말하는 사람(나)에게 가까운 사물',
        speakerActive: true,
        listenerActive: false,
        characterAnim: { y: [0, -10, 0] },
        itemPos: { left: '30%', bottom: '20%' }
    },
    sore: {
        id: 'sore',
        ja: 'それ',
        ko: '그것',
        desc: '듣는 사람(너)에게 가까운 사물',
        speakerActive: false,
        listenerActive: true,
        characterAnim: {},
        itemPos: { left: '70%', bottom: '20%' }
    },
    are: {
        id: 'are',
        ja: 'あれ',
        ko: '저것',
        desc: '말하는 사람과 듣는 사람 모두에게 멀리 있는 사물',
        speakerActive: false,
        listenerActive: false,
        characterAnim: {},
        itemPos: { left: '50%', bottom: '60%' }
    }
};

export const Chapter3_3: React.FC = () => {
    const [activeDemo, setActiveDemo] = useState<DemoType>('kore');

    return (
        <div className="w-full h-full p-8 flex flex-col items-center bg-slate-50/30 overflow-y-auto">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">지시대명사 (코소아도)</h3>
            <p className="text-slate-500 mb-8 font-medium">상황을 클릭하여 거리와 위치에 따른 일본어 지시대명사를 이해해보세요.</p>

            <div className="flex w-full max-w-5xl gap-8">
                
                {/* Visual Sandbox */}
                <div className="flex-[2] bg-white rounded-3xl p-8 shadow-sm border border-slate-200 relative min-h-[400px] overflow-hidden">
                    
                    {/* Scene Background */}
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white pointer-events-none"></div>
                    <div className="absolute bottom-16 left-0 right-0 h-40 bg-slate-50 -skew-y-3 transform origin-bottom-left border-t border-slate-100"></div>

                    {/* Characters */}
                    <div className="absolute bottom-8 left-[15%] flex flex-col items-center z-10 text-center">
                        <div className="w-20 h-24 bg-blue-100 rounded-[2rem] flex flex-col items-center justify-end pb-3 border border-blue-200 shadow-sm relative">
                            {/* Speech bubble */}
                            <AnimatePresence>
                                <motion.div 
                                    key={activeDemo}
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="absolute -top-16 -right-16 bg-white px-4 py-2 rounded-2xl shadow-md border border-slate-100 text-lg font-bold text-slate-700 whitespace-nowrap z-20"
                                >
                                    {demoData[activeDemo].ja}。
                                    <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white border-b border-l border-slate-100 transform -rotate-45"></div>
                                </motion.div>
                            </AnimatePresence>

                            <div className="text-3xl mb-1">🙎‍♂️</div>
                            <div className={`w-12 h-2 rounded-full ${demoData[activeDemo].speakerActive ? 'bg-blue-400' : 'bg-slate-300'}`}></div>
                        </div>
                        <span className="text-sm font-bold text-slate-500 mt-2 bg-white px-3 py-1 rounded-full shadow-sm">나 (화자)</span>
                    </div>

                    <div className="absolute bottom-8 right-[15%] flex flex-col items-center z-10 text-center">
                        <div className="w-20 h-24 bg-indigo-100 rounded-[2rem] flex flex-col items-center justify-end pb-3 border border-indigo-200 shadow-sm">
                            <div className="text-3xl mb-1">🙎‍♀️</div>
                            <div className={`w-12 h-2 rounded-full ${demoData[activeDemo].listenerActive ? 'bg-indigo-400' : 'bg-slate-300'}`}></div>
                        </div>
                        <span className="text-sm font-bold text-slate-500 mt-2 bg-white px-3 py-1 rounded-full shadow-sm">너 (청자)</span>
                    </div>

                    {/* The specific target item (an apple) moving around based on activeDemo */}
                    <motion.div
                        className="absolute z-20"
                        animate={demoData[activeDemo].itemPos}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    >
                        <motion.div
                            animate={{ rotate: [-5, 5, -5] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="bg-white p-3 rounded-full shadow-md border-2 border-slate-100 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                        >
                            <span className="text-4xl drop-shadow-sm">🍎</span>
                        </motion.div>
                        
                        {/* Distance Indicator lines */}
                        <svg className="absolute top-1/2 left-1/2 overflow-visible pointer-events-none -translate-x-1/2 -translate-y-1/2 w-64 h-64 opacity-30" style={{ zIndex: -1 }}>
                            <motion.circle cx="128" cy="128" r="40" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5" />
                            <motion.circle cx="128" cy="128" r="80" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5,5" />
                        </svg>
                    </motion.div>

                </div>

                {/* Controls Area */}
                <div className="flex-1 flex flex-col gap-4">
                    {(Object.keys(demoData) as DemoType[]).map((key) => {
                        const data = demoData[key];
                        const isActive = activeDemo === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveDemo(key)}
                                className={`p-6 rounded-3xl text-left transition-all border-2 ${
                                    isActive 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 transform scale-105' 
                                        : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center gap-4 mb-2">
                                    <div className={`text-3xl font-black ${isActive ? 'text-white' : 'text-[#1e3a8a]'}`}>
                                        {data.ja}
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {data.ko}
                                    </div>
                                </div>
                                <p className={`font-medium leading-relaxed ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                                    {data.desc}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            <div className="mt-8 text-center text-slate-400 font-bold tracking-widest uppercase text-sm">
                코소아도 (こ・そ・あ・ど) 법칙
            </div>
        </div>
    );
};
