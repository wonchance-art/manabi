import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  return children;
}
