import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import GuidePage from './pages/GuidePage';
import MaterialsPage from './pages/MaterialsPage';
import VocabPage from './pages/VocabPage';
import ForumPage from './pages/ForumPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/vocab" element={<VocabPage />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/" element={<Navigate to="/materials" replace />} />
          <Route path="*" element={<Navigate to="/materials" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
