import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import Spinner from './Spinner';

export default function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/materials" replace />;

  return children;
}
