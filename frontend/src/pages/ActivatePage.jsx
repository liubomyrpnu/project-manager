import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { activateAccount, getErrorMessage, tokenStorage } from '../api/client.js';
import { Loading, Notice } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Токен одноразовий, тому запит кешується: у режимі React StrictMode ефект
// виконується двічі, але на сервер піде лише один запит.
const requests = new Map();
const activateOnce = (token) => {
  if (!requests.has(token)) requests.set(token, activateAccount(token));
  return requests.get(token);
};

// Сторінка, на яку веде посилання з листа активації.
export default function ActivatePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, ready, refreshUser } = useAuth();
  const [state, setState] = useState({ status: token ? 'loading' : 'error', message: token ? '' : 'Посилання не містить токена активації.' });

  useEffect(() => {
    // чекаємо, доки AuthProvider завантажить поточного користувача, щоб уникнути гонки запитів
    if (!token || !ready) return;
    activateOnce(token)
      .then((result) => {
        setState({ status: 'success', message: result.message });
        // якщо користувач уже увійшов — оновлюємо його дані (статус активації) з сервера
        if (tokenStorage.get()) refreshUser().catch(() => {});
      })
      .catch((err) => setState({ status: 'error', message: getErrorMessage(err) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ready]);

  return (
    <main className="auth">
      <div className="card auth__form">
        <h1>Активація акаунта</h1>
        {state.status === 'loading' && <Loading />}
        {state.status === 'success' && <Notice type="success">{state.message}</Notice>}
        {state.status === 'error' && <p className="state state--error" role="alert">{state.message}</p>}
        {state.status !== 'loading' &&
          (user ? <Link to="/profile">Перейти до профілю</Link> : <Link to="/login">Перейти до входу</Link>)}
      </div>
    </main>
  );
}
