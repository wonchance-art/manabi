import React, { useState } from 'react';
import { motion } from 'framer-motion';

const greetings = [
  { ja: 'おはようございます', romaji: 'Ohayou gozaimasu', ko: '좋은 아침입니다 (아침 인사)' },
  { ja: 'こんにちは', romaji: 'Konnichiwa', ko: '안녕하세요 (낮 인사)' },
  { ja: 'こんばんは', romaji: 'Konbanwa', ko: '안녕하세요 (저녁 인사)' },
  { ja: 'ありがとうございます', romaji: 'Arigatou gozaimasu', ko: '감사합니다' },
  { ja: 'すみません', romaji: 'Sumimasen', ko: '죄송합니다 / 실례합니다' },
  { ja: 'さようなら', romaji: 'Sayounara', ko: '안녕히 계세요 (작별 인사)' },
];

export const Chapter1_1: React.FC = () => {
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  return (
    <div className="w-full h-full p-8 flex flex-col">
      <h3 className="text-2xl font-bold text-center mb-10 text-slate-800">기본 인사말 익히기</h3>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {greetings.map((greet, idx) => (
          <div 
            key={idx} 
            className="relative h-48 perspective-1000 cursor-pointer"
            onClick={() => setFlippedIndex(flippedIndex === idx ? null : idx)}
          >
            <motion.div
              className="w-full h-full relative preserve-3d"
              animate={{ rotateY: flippedIndex === idx ? 180 : 0 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
            >
              {/* Front Side - Japanese */}
              <div className="absolute w-full h-full backface-hidden bg-white border-2 border-blue-100 rounded-2xl flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                <span className="text-3xl font-bold text-blue-900">{greet.ja}</span>
                <span className="text-sm text-slate-400 mt-4">클릭하여 뜻 확인</span>
              </div>
              
              {/* Back Side - Korean / Romaji */}
              <div className="absolute w-full h-full backface-hidden bg-blue-600 rounded-2xl flex flex-col items-center justify-center p-6 text-center rotate-y-180 shadow-md">
                <span className="text-xl font-bold text-white mb-2">{greet.ko}</span>
                <span className="text-blue-200 font-medium">{greet.romaji}</span>
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
};
