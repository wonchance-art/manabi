import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
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
            {/* 랜딩 페이지 — Layout 없이 독립 렌더 */}
            <Route path="/" element={<LandingPage />} />

            {/* 앱 페이지 — Layout 포함 */}
            <Route element={<Layout />}>
              <Route path="/guide"    element={<GuidePage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/viewer/:id" element={<ViewerPage />} />
              <Route path="/forum"   element={<ForumPage />} />
              <Route path="/auth"    element={<AuthPage />} />

              {/* 로그인 필요 */}
              <Route path="/materials/add" element={<ProtectedRoute><MaterialAddPage /></ProtectedRoute>} />
              <Route path="/vocab"         element={<ProtectedRoute><VocabPage /></ProtectedRoute>} />
              <Route path="/profile"       element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
