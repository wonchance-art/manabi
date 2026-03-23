import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const getJapaneseTime = (hour: number, minute: number) => {
    const hoursJa = [
        'じゅうにじ', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ', 'じゅうにじ'
    ];
    
    // Simplified precise minute reading for textbook
    let minJa = '';
    if (minute === 0) minJa = '';
    else if (minute === 5) minJa = 'ごふん';
    else if (minute === 10) minJa = 'じゅっぷん';
    else if (minute === 15) minJa = 'じゅうごふん';
    else if (minute === 20) minJa = 'にじゅっぷん';
    else if (minute === 30) minJa = 'はん';
    else if (minute === 45) minJa = 'よんじゅうごふん';
    else if (minute === 50) minJa = 'ごじゅっぷん';
    else minJa = `${minute}분`; // fallback
    
    const h = hour % 12 || 12;
    const isAm = hour < 12;
    const ampm = isAm ? 'ごぜん (午前)' : 'ごご (午後)';
    
    return {
        ja: `${ampm} ${hoursJa[h]} ${minJa}`.trim(),
        kr: `${isAm ? '오전' : '오후'} ${h}시 ${minute === 0 ? '정각' : (minute === 30 ? '반' : minute + '분')}`
    };
};

export const Chapter2_2: React.FC = () => {
    const [time, setTime] = useState({ h: 9, m: 0 }); // 09:00
    const [dragging, setDragging] = useState<'h' | 'm' | null>(null);

    const timeStr = getJapaneseTime(time.h, time.m);

    const handleClockClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        if (dragging === 'm' || (!dragging && Math.sqrt(x*x + y*y) > rect.width * 0.35)) {
            // Set minute (snap to 5s for simplicity)
            let m = Math.round(angle / 30) * 5;
            if (m === 60) m = 0;
            setTime(t => ({ ...t, m }));
        } else if (dragging === 'h' || (!dragging && Math.sqrt(x*x + y*y) <= rect.width * 0.35)) {
            // Set hour
            let h = Math.round(angle / 30);
            if (h === 0) h = 12;
            
            setTime(t => {
                let newH = h;
                if (t.h >= 12 && h < 12) newH = h + 12;
                if (newH === 24) newH = 0;
                return { ...t, h: newH };
            });
        }
    };

    const toggleAmPm = () => {
        setTime(t => ({ ...t, h: (t.h + 12) % 24 }));
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50/30">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">시간 묻고 답하기</h3>
            <p className="text-slate-500 mb-12 font-medium">시계를 클릭하여 바늘을 움직이고 시간을 읽어보세요.</p>

            <div className="flex bg-white rounded-3xl p-10 shadow-sm border border-slate-200 gap-16 max-w-4xl w-full">
                
                {/* Clock Visualization */}
                <div 
                    className="relative w-72 h-72 rounded-full border-8 border-slate-100 bg-white shadow-inner flex items-center justify-center cursor-pointer select-none"
                    onMouseDown={() => setDragging('m')} // Simplification for click interaction
                    onMouseUp={() => setDragging(null)}
                    onClick={handleClockClick}
                >
                    {/* Clock Numbers */}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => {
                        const angle = (num * 30 - 90) * (Math.PI / 180);
                        const radius = 105;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        return (
                            <div 
                                key={num}
                                className="absolute text-xl font-bold text-slate-400"
                                style={{ transform: `translate(${x}px, ${y}px)` }}
                            >
                                {num}
                            </div>
                        )
                    })}
                    
                    {/* Center Dot */}
                    <div className="w-4 h-4 bg-slate-800 rounded-full z-20 shadow-sm"></div>

                    {/* Hour Hand */}
                    <div 
                        className="absolute w-2 bg-slate-800 rounded-full origin-bottom z-10 transition-transform duration-300"
                        style={{ height: '70px', transform: `translateY(-50%) rotate(${((time.h % 12) + time.m / 60) * 30}deg)` }}
                    />
                    
                    {/* Minute Hand */}
                    <div 
                        className="absolute w-1 bg-blue-500 rounded-full origin-bottom z-10 transition-transform duration-300"
                        style={{ height: '100px', transform: `translateY(-50%) rotate(${time.m * 6}deg)` }}
                    />
                </div>

                {/* Digital Time & Text */}
                <div className="flex-1 flex flex-col justify-center">
                    <div className="flex items-end justify-center gap-2 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <button 
                            onClick={toggleAmPm}
                            className={`px-4 py-2 rounded-xl font-bold transition-all ${time.h < 12 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}
                        >
                            {time.h < 12 ? 'AM' : 'PM'}
                        </button>
                        <div className="text-6xl font-black text-slate-800 tabular-nums font-mono tracking-tighter">
                            {String(time.h % 12 || 12).padStart(2, '0')}:{String(time.m).padStart(2, '0')}
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${time.h}-${time.m}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center"
                        >
                            <div className="text-3xl font-bold text-[#1e3a8a] mb-3">{timeStr.ja}</div>
                            <div className="text-lg text-slate-500 font-medium bg-slate-100 inline-block px-4 py-1 rounded-full">{timeStr.kr}</div>
                        </motion.div>
                    </AnimatePresence>

                    <div className="mt-8 flex justify-center gap-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-bold"># {time.h < 12 ? 'ごぜん' : 'ごご'}</span>
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-bold"># ~じ</span>
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-bold"># ~ふん/ぷん</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
