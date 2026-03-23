import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, BookOpenText } from 'lucide-react';
import { chaptersData, type ChapterId } from '../data/chapters';

interface SidebarProps {
    selectedChapter: ChapterId;
    onSelectChapter: (id: ChapterId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedChapter, onSelectChapter }) => {
    // Store open group IDs. Default open all
    const [openGroups, setOpenGroups] = useState<string[]>(['1', '2', '3']);

    const toggleGroup = (id: string) => {
        setOpenGroups(prev =>
            prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
        );
    };

    return (
        <aside className="w-[30%] min-w-[300px] h-screen bg-white border-r border-slate-100 flex flex-col overflow-y-auto shadow-sm z-10">
            <div className="p-6 border-b border-slate-100 flex-shrink-0 bg-blue-50/50">
                <h1 className="text-xl font-extrabold text-[#1e3a8a] flex items-center gap-2 tracking-tight">
                    <BookOpenText className="text-blue-500" size={26} />
                    Hello, Japanese!
                </h1>
                <p className="text-sm text-blue-600/80 mt-1 font-semibold ml-8">초급 일본어 웹 교과서</p>
            </div>

            <nav className="p-4 flex flex-col gap-3 flex-1">
                {chaptersData.map((group) => {
                    const isOpen = openGroups.includes(group.id);

                    return (
                        <div key={group.id} className="flex flex-col">
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className="flex items-center justify-between w-full p-3 text-left bg-white hover:bg-slate-50 rounded-xl transition-colors text-slate-800 font-bold border border-transparent hover:border-slate-100"
                            >
                                <span className="text-[15px]">{group.title}</span>
                                {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                            </button>

                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex flex-col gap-1 py-2 pl-2 pr-1 ml-4 border-l-2 border-blue-50">
                                            {group.subChapters.map((sub) => {
                                                const isSelected = selectedChapter === sub.id;
                                                return (
                                                    <button
                                                        key={sub.id}
                                                        onClick={() => onSelectChapter(sub.id)}
                                                        className={`text-left px-4 py-3 rounded-xl transition-all text-sm w-full relative group ${isSelected
                                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-200 transform scale-[1.02]'
                                                            : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                                                            }`}
                                                    >
                                                        <div className="font-semibold text-[14px]">{sub.title}</div>
                                                        {isSelected && (
                                                            <motion.div
                                                                layoutId="active-indicator"
                                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-300 rounded-r-full"
                                                            />
                                                        )}
                                                        <div className={`text-[12px] mt-1 truncate ${isSelected ? 'text-blue-100' : 'text-slate-400 group-hover:text-blue-400/80'}`}>
                                                            {sub.description}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
};
