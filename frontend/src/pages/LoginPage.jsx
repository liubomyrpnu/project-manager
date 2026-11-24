import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GOOGLE_LOGIN_URL, getAuthProviders, getErrorMessage, getFieldErrors } from '../api/client.js';
import FormField from '../components/FormField.jsx';
import { Notice } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateEmail, validateLoginPassword, validateOtp } from '../utils/validation.js';

// Вхід: пошта + пароль, другий крок 2FA (код TOTP), вхід через Google (FR-02).
export default function LoginPage() {
  const { user, login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/projects';

  const [values, setValues] = useState({ email: '', password: '', code: '' });
  const [challengeToken, setChallengeToken] = useState(location.state?.challengeToken || null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(location.state?.error || '');
  const [submitting, setSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(null);

  useEffect(() => {
    getAuthProviders()
      .then((providers) => setGoogleEnabled(providers.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const run = async (action) => {
    setSubmitting(true);
    setServerError('');
    try {
      await action();
    } catch (err) {
      setServerError(getErrorMessage(err));
      setErrors(getFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = (event) => {
    event.preventDefault();
    const nextErrors = { email: validateEmail(values.email), password: validateLoginPassword(values.password) };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    void run(async () => {
      const result = await login(values.email.trim(), values.password);
      if (result.twoFactorRequired) setChallengeToken(result.challengeToken);
    });
  };

  const handleTwoFactor = (event) => {
    event.preventDefault();
    const codeError = validateOtp(values.code);
    setErrors({ code: codeError });
    if (codeError) return;
    void run(async () => {
      try {
        await verifyTwoFactor(challengeToken, values.code.replace(/\s/g, ''));
      } catch (err) {
        setValues((prev) => ({ ...prev, code: '' }));
        if (err?.response?.status !== 401 || /минув|знову/.test(getErrorMessage(err))) setChallengeToken(null);
        throw err;
      }
    });
  };

  if (challengeToken) {
    return (
      <main className="auth">
        <form className="card auth__form" onSubmit={handleTwoFactor} noValidate>
          <h1>Підтвердження входу</h1>
          <p className="muted">Введіть 6-значний код із застосунку-автентифікатора (Google Authenticator, Microsoft Authenticator тощо).</p>
          <FormField id="code" label="Код підтвердження" error={errors.code}>
            <input
              id="code"
              name="code"
              value={values.code}
              onChange={handleChange}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
            />
          </FormField>
          {serverError && <p className="state state--error" role="alert">{serverError}</p>}
          <button className="btn btn--primary" type="submit" disabled={submitting}>
            {submitting ? 'Перевірка…' : 'Підтвердити'}
          </button>
          <button type="button" className="btn btn--link" onClick={() => setChallengeToken(null)}>
            ← Повернутися до входу
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="auth">
      <form className="card auth__form" onSubmit={handleLogin} noValidate>
        <h1>Вхід</h1>
        {location.state?.message && <Notice type="success">{location.state.message}</Notice>}
        <FormField id="email" label="Електронна пошта" error={errors.email}>
          <input id="email" name="email" type="email" value={values.email} onChange={handleChange} autoComplete="email" />
        </FormField>
        <FormField id="password" label="Пароль" error={errors.password}>
          <input id="password" name="password" type="password" value={values.password} onChange={handleChange} autoComplete="current-password" />
        </FormField>
        {serverError && <p className="state state--error" role="alert">{serverError}</p>}
        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Зачекайте…' : 'Увійти'}
        </button>
        <Link className="auth__link" to="/forgot-password">Забули пароль?</Link>

        <div className="divider"><span>або</span></div>
        <button
          type="button"
          className="btn btn--google"
          disabled={googleEnabled === false}
          onClick={() => window.location.assign(GOOGLE_LOGIN_URL)}
        >
          <span className="google-mark" aria-hidden="true">G</span> Увійти через Google
        </button>
        {googleEnabled === false && <p className="hint">Вхід через Google не налаштовано на сервері.</p>}

        <p className="auth__footer">
          Немає акаунта? <Link to="/register">Зареєструватися</Link>
        </p>
      </form>
    </main>
  );
}
