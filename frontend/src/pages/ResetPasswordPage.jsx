import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { checkResetToken, getErrorMessage, getFieldErrors, resetPassword } from '../api/client.js';
import FormField from '../components/FormField.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { Loading } from '../components/StateViews.jsx';
import { validateConfirm, validateNewPassword } from '../utils/validation.js';

// Встановлення нового пароля за посиланням з листа.
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [tokenState, setTokenState] = useState({ status: 'loading', message: '' });
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState({ status: 'invalid', message: 'Посилання не містить токена.' });
      return;
    }
    checkResetToken(token)
      .then(() => setTokenState({ status: 'valid', message: '' }))
      .catch((err) => setTokenState({ status: 'invalid', message: getErrorMessage(err) }));
  }, [token]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    const nextErrors = { password: validateNewPassword(values.password), confirm: validateConfirm(values.password, values.confirm) };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSubmitting(true);
    try {
      const result = await resetPassword(token, values.password);
      navigate('/login', { state: { message: result.message } });
    } catch (err) {
      setServerError(getErrorMessage(err));
      setErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <main className="auth">
      <form className="card auth__form" onSubmit={handleSubmit} noValidate>
        <h1>Новий пароль</h1>
        {tokenState.status === 'loading' && <Loading />}
        {tokenState.status === 'invalid' && (
          <>
            <p className="state state--error" role="alert">{tokenState.message}</p>
            <Link className="auth__link" to="/forgot-password">Надіслати нове посилання</Link>
          </>
        )}
        {tokenState.status === 'valid' && (
          <>
            <FormField id="password" label="Новий пароль" error={errors.password}>
              <input id="password" name="password" type="password" value={values.password} onChange={handleChange} autoComplete="new-password" />
            </FormField>
            <PasswordStrength password={values.password} />
            <FormField id="confirm" label="Повторіть пароль" error={errors.confirm}>
              <input id="confirm" name="confirm" type="password" value={values.confirm} onChange={handleChange} autoComplete="new-password" />
            </FormField>
            {serverError && <p className="state state--error" role="alert">{serverError}</p>}
            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting ? 'Збереження…' : 'Зберегти пароль'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
