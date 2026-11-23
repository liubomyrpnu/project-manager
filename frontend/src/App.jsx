import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ActivatePage from './pages/ActivatePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyTasksPage from './pages/MyTasksPage.jsx';
import OAuthCallbackPage from './pages/OAuthCallbackPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        {/* Публічні сторінки */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/activate" element={<ActivatePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

        {/* Потрібен вхід */}
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />

        {/* Потрібен вхід і активований акаунт */}
        <Route path="/projects" element={<ProtectedRoute requireActivated><ProjectsPage /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute requireActivated><BoardPage /></ProtectedRoute>} />
        <Route path="/my-tasks" element={<ProtectedRoute requireActivated><MyTasksPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </>
  );
}
