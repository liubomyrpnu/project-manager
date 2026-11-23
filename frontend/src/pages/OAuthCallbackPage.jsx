import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeOAuthCode, getErrorMessage } from '../api/client.js';
import { Loading } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Одноразовий код обмінюється лише один раз (захист від подвійного ефекту StrictMode).
const requests = new Map();
const exchangeOnce = (code) => {
  if (!requests.has(code)) requests.set(code, exchangeOAuthCode(code));
  return requests.get(code);
};

// Сюди бекенд повертає браузер після входу через Google.
export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { applySession } = useAuth();

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');
    if (error || !code) {
      navigate('/login', { replace: true, state: { error: error || 'Не вдалося увійти через Google' } });
      return;
    }
    exchangeOnce(code)
      .then((result) => {
        if (result.twoFactorRequired) {
          navigate('/login', { replace: true, state: { challengeToken: result.challengeToken } });
        } else {
          applySession(result);
          navigate('/projects', { replace: true });
        }
      })
      .catch((err) => navigate('/login', { replace: true, state: { error: getErrorMessage(err) } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="auth">
      <div className="card auth__form">
        <h1>Вхід через Google</h1>
        <Loading />
      </div>
    </main>
  );
}
