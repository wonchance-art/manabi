import React from 'react';
import type { ChapterId } from '../data/chapters';
import { chaptersData } from '../data/chapters';
import { Chapter1_1 } from './chapters/Chapter1_1';
import { Chapter1_2 } from './chapters/Chapter1_2';
import { Chapter1_3 } from './chapters/Chapter1_3';
import { Chapter2_1 } from './chapters/Chapter2_1';
import { Chapter2_2 } from './chapters/Chapter2_2';
import { Chapter2_3 } from './chapters/Chapter2_3';
import { Chapter3_1 } from './chapters/Chapter3_1';
import { Chapter3_2 } from './chapters/Chapter3_2';
import { Chapter3_3 } from './chapters/Chapter3_3';

interface MainContentProps {
    selectedChapter: ChapterId;
}

export const MainContent: React.FC<MainContentProps> = ({ selectedChapter }) => {
    
    const getCurrentSubChapter = () => {
        for (const group of chaptersData) {
            const sub = group.subChapters.find(s => s.id === selectedChapter);
            if (sub) return { group, sub };
        }
        return null;
    };

    const currentInfo = getCurrentSubChapter();

    const renderInteractiveComponent = () => {
        switch (selectedChapter) {
            case '1-1': return <Chapter1_1 />;
            case '1-2': return <Chapter1_2 />;
            case '1-3': return <Chapter1_3 />;
            case '2-1': return <Chapter2_1 />;
            case '2-2': return <Chapter2_2 />;
            case '2-3': return <Chapter2_3 />;
            case '3-1': return <Chapter3_1 />;
            case '3-2': return <Chapter3_2 />;
            case '3-3': return <Chapter3_3 />;
            default: return (
                <div className="text-center text-slate-400">
                    <h3 className="text-xl font-medium mb-2">Interactive Learning Area</h3>
                    <p>Component for {selectedChapter} goes here.</p>
                </div>
            );
        }
    };

    return (
        <main className="flex-1 h-screen overflow-y-auto bg-slate-50/50 relative">
            <div className="max-w-5xl mx-auto px-10 py-12 h-full flex flex-col">
                <header className="mb-8 items-start">
                    <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm font-bold rounded-full mb-3">
                        {currentInfo?.group.title}
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-800 mb-3 block">
                        {currentInfo?.sub.title || `Chapter ${selectedChapter}`}
                    </h2>
                    <p className="text-slate-500 font-medium text-lg max-w-2xl">
                        오늘의 핵심 내용을 다양한 인터랙션을 통해 직관적으로 학습해보세요. 
                        아래의 카드나 요소를 클릭하여 발음과 뜻을 확인하세요.
                    </p>
                </header>

                <section className="flex-1 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden min-h-[600px] p-6">
                    {renderInteractiveComponent()}
                </section>
            </div>
        </main>
    );
};
