import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading } from './StateViews.jsx';

// Захищений маршрут:
//  - неавторизованого користувача перенаправляє на сторінку входу;
//  - adminOnly — лише для адміністратора (RBAC);
//  - requireActivated — лише для активованого акаунта (інакше — у профіль).
export default function ProtectedRoute({ children, adminOnly = false, requireActivated = false }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <main className="page"><Loading /></main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && user.systemRole !== 'admin') {
    return (
      <main className="page">
        <p className="state state--error" role="alert">Доступ заборонено: сторінка доступна лише адміністратору.</p>
      </main>
    );
  }
  if (requireActivated && !user.isActivated) {
    return <Navigate to="/profile" replace state={{ notice: 'Щоб працювати з проєктами, активуйте обліковий запис за посиланням з листа.' }} />;
  }
  return children;
}
