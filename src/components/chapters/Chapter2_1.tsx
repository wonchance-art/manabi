import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const getNumberData = (num: number) => {
    const units = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
    const unitsRomaji = ['', 'ichi', 'ni', 'san', 'yon', 'go', 'roku', 'nana', 'hachi', 'kyuu'];
    const tens = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう', 'ろくじゅう', 'ななじゅう', 'はちじゅう', 'きゅうじゅう'];
    const tensRomaji = ['', 'juu', 'nijuu', 'sanjuu', 'yonjuu', 'gojuu', 'rokujuu', 'nanajuu', 'hachijuu', 'kyuujuu'];

    if (num === 0) return { ja: 'ゼロ / れい', romaji: 'zero / rei', ko: '영' };
    if (num === 100) return { ja: 'ひゃく', romaji: 'hyaku', ko: '백' };

    const t = Math.floor(num / 10);
    const u = num % 10;

    let ja = '';
    let romaji = '';

    if (t > 0) {
        ja += tens[t];
        romaji += tensRomaji[t];
    }
    if (u > 0) {
        ja += units[u];
        romaji += (t > 0 ? ' ' : '') + unitsRomaji[u];
    }

    return { ja, romaji, ko: num.toString() };
};

export const Chapter2_1: React.FC = () => {
    const [count, setCount] = useState(1);

    const handleIncrement = () => setCount(prev => Math.min(100, prev + 1));
    const handleDecrement = () => setCount(prev => Math.max(0, prev - 1));
    const handleAddTen = () => setCount(prev => Math.min(100, prev + 10));
    const handleSubTen = () => setCount(prev => Math.max(0, prev - 10));

    const currentData = getNumberData(count);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50/30">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">숫자 읽기 (0~100)</h3>
            <p className="text-slate-500 mb-12 font-medium">버튼을 눌러 숫자를 조절하며 일본어 읽는 법을 익혀보세요.</p>

            <div className="bg-white rounded-[2rem] p-10 shadow-lg border border-slate-100 flex flex-col items-center min-w-[400px]">
                <div className="flex items-center justify-center gap-6 mb-10 w-full">
                    <button onClick={handleSubTen} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors active:scale-95" title="-10">-10</button>
                    <button onClick={handleDecrement} className="p-4 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-100 rounded-2xl transition-all active:scale-95 border border-slate-200">
                        <Minus size={24} />
                    </button>
                    
                    <div className="text-7xl font-extrabold text-[#1e3a8a] w-32 text-center tabular-nums">
                        {count}
                    </div>

                    <button onClick={handleIncrement} className="p-4 bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700 rounded-2xl transition-all active:scale-95">
                        <Plus size={24} />
                    </button>
                    <button onClick={handleAddTen} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors active:scale-95" title="+10">+10</button>
                </div>

                <div className="w-full bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 text-center flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={count}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col items-center"
                        >
                            <span className="text-4xl font-bold text-slate-800 mb-2">{currentData.ja}</span>
                            <span className="text-lg text-blue-500 font-medium tracking-wide">{currentData.romaji}</span>
                        </motion.div>
                    </AnimatePresence>
                </div>
                
                <div className="mt-8 flex gap-2">
                    {[1, 10, 50, 100].map(quickNum => (
                        <button 
                            key={quickNum}
                            onClick={() => setCount(quickNum)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${count === quickNum ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            {quickNum}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
