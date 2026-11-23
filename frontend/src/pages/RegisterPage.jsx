import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCaptcha, getErrorMessage, getFieldErrors, register } from '../api/client.js';
import CaptchaField from '../components/CaptchaField.jsx';
import FormField from '../components/FormField.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { validateConfirm, validateEmail, validateName, validateNewPassword } from '../utils/validation.js';

// Реєстрація (FR-01): політика паролів, індикатор сили пароля, CAPTCHA, лист активації.
export default function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '', captchaAnswer: '' });
  const [captcha, setCaptcha] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Кожна CAPTCHA одноразова, тому після будь-якої спроби завантажується нова.
  const loadCaptcha = useCallback(() => {
    setCaptcha(null);
    setValues((prev) => ({ ...prev, captchaAnswer: '' }));
    getCaptcha()
      .then(setCaptcha)
      .catch((err) => setServerError(getErrorMessage(err)));
  }, []);

  useEffect(loadCaptcha, [loadCaptcha]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    const nextErrors = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      password: validateNewPassword(values.password),
      confirm: validateConfirm(values.password, values.confirm),
      captcha: values.captchaAnswer.trim() ? '' : 'Введіть символи з картинки',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const result = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        captchaId: captcha?.captchaId,
        captchaAnswer: values.captchaAnswer.trim(),
      });
      navigate('/login', { state: { message: result.message } });
    } catch (err) {
      setServerError(getErrorMessage(err));
      setErrors(getFieldErrors(err));
      loadCaptcha();
      setSubmitting(false);
    }
  };

  return (
    <main className="auth">
      <form className="card auth__form" onSubmit={handleSubmit} noValidate>
        <h1>Реєстрація</h1>
        <FormField id="name" label="Ім'я" error={errors.name}>
          <input id="name" name="name" value={values.name} onChange={handleChange} autoComplete="name" />
        </FormField>
        <FormField id="email" label="Електронна пошта" error={errors.email}>
          <input id="email" name="email" type="email" value={values.email} onChange={handleChange} autoComplete="email" />
        </FormField>
        <FormField id="password" label="Пароль" error={errors.password}>
          <input id="password" name="password" type="password" value={values.password} onChange={handleChange} autoComplete="new-password" />
        </FormField>
        <PasswordStrength password={values.password} />
        <FormField id="confirm" label="Повторіть пароль" error={errors.confirm}>
          <input id="confirm" name="confirm" type="password" value={values.confirm} onChange={handleChange} autoComplete="new-password" />
        </FormField>
        <CaptchaField
          captcha={captcha}
          value={values.captchaAnswer}
          onChange={(event) => {
            setValues((prev) => ({ ...prev, captchaAnswer: event.target.value }));
            setErrors((prev) => ({ ...prev, captcha: '' }));
          }}
          onReload={loadCaptcha}
          error={errors.captcha}
        />
        {serverError && <p className="state state--error" role="alert">{serverError}</p>}
        <button className="btn btn--primary" type="submit" disabled={submitting || !captcha}>
          {submitting ? 'Зачекайте…' : 'Зареєструватися'}
        </button>
        <p className="auth__footer">
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </form>
    </main>
  );
}
