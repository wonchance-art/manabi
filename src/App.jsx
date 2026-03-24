import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Layout from './components/Layout';
import GuidePage from './pages/GuidePage';
import MaterialsPage from './pages/MaterialsPage';
import VocabPage from './pages/VocabPage';
import ForumPage from './pages/ForumPage';
import AuthPage from './pages/AuthPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/vocab" element={<VocabPage />} />
            <Route path="/forum" element={<ForumPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<Navigate to="/materials" replace />} />
            <Route path="*" element={<Navigate to="/materials" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
