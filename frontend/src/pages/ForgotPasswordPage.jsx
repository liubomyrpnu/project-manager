import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword, getErrorMessage } from '../api/client.js';
import FormField from '../components/FormField.jsx';
import { Notice } from '../components/StateViews.jsx';
import { validateEmail } from '../utils/validation.js';

// Запит на відновлення пароля: сервер надсилає лист з одноразовим посиланням.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;
    setSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth">
      <form className="card auth__form" onSubmit={handleSubmit} noValidate>
        <h1>Відновлення пароля</h1>
        {message ? (
          <Notice type="success">{message}</Notice>
        ) : (
          <>
            <p className="muted">Вкажіть пошту, з якою ви реєструвалися. Ми надішлемо посилання для встановлення нового пароля.</p>
            <FormField id="email" label="Електронна пошта" error={error}>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </FormField>
            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting ? 'Надсилання…' : 'Надіслати лист'}
            </button>
          </>
        )}
        <Link className="auth__link" to="/login">← Повернутися до входу</Link>
      </form>
    </main>
  );
}
