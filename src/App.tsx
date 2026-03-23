import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import type { ChapterId } from './data/chapters';

function App() {
  const [selectedChapter, setSelectedChapter] = useState<ChapterId>('1-1');

  return (
    <div className="flex w-full h-screen bg-[#f8fafc] overflow-hidden text-[#334e68] font-sans antialiased">
      <Sidebar selectedChapter={selectedChapter} onSelectChapter={setSelectedChapter} />
      <MainContent selectedChapter={selectedChapter} />
    </div>
  );
}

export default App;
