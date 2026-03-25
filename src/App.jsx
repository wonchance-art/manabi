import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import GuidePage from './pages/GuidePage';
import MaterialsPage from './pages/MaterialsPage';
import MaterialAddPage from './pages/MaterialAddPage';
import VocabPage from './pages/VocabPage';
import ForumPage from './pages/ForumPage';
import AuthPage from './pages/AuthPage';
import ViewerPage from './pages/ViewerPage';
import MyPage from './pages/MyPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/materials/add" element={<MaterialAddPage />} />
            <Route path="/vocab" element={<VocabPage />} />
            <Route path="/forum" element={<ForumPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/viewer/:id" element={<ViewerPage />} />
            <Route path="/profile" element={<MyPage />} />
            <Route path="/" element={<Navigate to="/materials" replace />} />
            <Route path="*" element={<Navigate to="/materials" replace />} />
          </Route>
        </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
