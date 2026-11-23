import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Шапка з навігацією; меню відображається лише після входу.
export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header__inner">
        <span className="header__logo">Управління проєктами</span>
        {user && (
          <>
            <nav className="header__nav" aria-label="Основна навігація">
              <NavLink to="/projects">Проєкти</NavLink>
              <NavLink to="/my-tasks">Мої завдання</NavLink>
              <NavLink to="/profile">Профіль</NavLink>
              {user.systemRole === 'admin' && <NavLink to="/admin">Адміністрування</NavLink>}
            </nav>
            <div className="header__user">
              <span>{user.name}</span>
              <button className="btn btn--ghost" onClick={handleLogout}>Вийти</button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
