import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as api from '../api/client.js';
import FormField from '../components/FormField.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { Notice } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../utils/dates.js';
import { validateConfirm, validateName, validateNewPassword, validateOtp } from '../utils/validation.js';

// Профіль користувача: дані, статус активації, 2FA, зміна пароля.
export default function ProfilePage() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <main className="page page--narrow">
      <h1>Профіль</h1>
      {location.state?.notice && !user.isActivated && <Notice type="warn">{location.state.notice}</Notice>}
      <AccountSection />
      <TwoFactorSection />
      <PasswordSection />
    </main>
  );
}

function useAction() {
  const [state, setState] = useState({ busy: false, error: '', message: '', fieldErrors: {} });
  const run = async (action) => {
    setState({ busy: true, error: '', message: '', fieldErrors: {} });
    try {
      const message = await action();
      setState({ busy: false, error: '', message: message || '', fieldErrors: {} });
      return true;
    } catch (err) {
      setState({ busy: false, error: api.getErrorMessage(err), message: '', fieldErrors: api.getFieldErrors(err) });
      return false;
    }
  };
  return [state, run, setState];
}

function AccountSection() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState('');
  const [state, run] = useAction();

  const saveName = (event) => {
    event.preventDefault();
    const error = validateName(name);
    setNameError(error);
    if (error) return;
    run(async () => {
      setUser(await api.updateProfile({ name: name.trim() }));
      return "Ім'я збережено";
    });
  };

  return (
    <section className="card section" aria-labelledby="account-title">
      <h2 id="account-title">Обліковий запис</h2>
      <dl className="details">
        <dt>Пошта</dt>
        <dd>{user.email}</dd>
        <dt>Роль</dt>
        <dd>{user.systemRole === 'admin' ? 'Адміністратор' : 'Користувач'}</dd>
        <dt>Статус активації</dt>
        <dd>
          {user.isActivated ? (
            <span className="badge badge--ok">Активовано</span>
          ) : (
            <>
              <span className="badge badge--warn">Не активовано</span>{' '}
              <button
                type="button"
                className="btn btn--link"
                disabled={state.busy}
                onClick={() => run(async () => (await api.resendActivation()).message)}
              >
                Надіслати лист повторно
              </button>
            </>
          )}
        </dd>
        <dt>Вхід через Google</dt>
        <dd>{user.googleLinked ? 'Прив’язано' : 'Не прив’язано'}</dd>
        <dt>Зареєстровано</dt>
        <dd>{formatDateTime(user.createdAt)}</dd>
        <dt>Останній вхід</dt>
        <dd>{formatDateTime(user.lastLoginAt)}</dd>
      </dl>

      <form className="inline-form" onSubmit={saveName} noValidate>
        <FormField id="profile-name" label="Ім'я" error={nameError || state.fieldErrors.name}>
          <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </FormField>
        <button className="btn" type="submit" disabled={state.busy || name.trim() === user.name}>Зберегти</button>
      </form>
      {state.message && <Notice type="success">{state.message}</Notice>}
      {state.error && <p className="state state--error" role="alert">{state.error}</p>}
    </section>
  );
}

// Завдання 5: двофакторна автентифікація TOTP, яку користувач вмикає та вимикає сам.
function TwoFactorSection() {
  const { user, setUser } = useAuth();
  const [setup, setSetup] = useState(null); // { secret, otpauthUri }
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [state, run] = useAction();

  const submitCode = (action) => (event) => {
    event.preventDefault();
    const error = validateOtp(code);
    setCodeError(error);
    if (error) return;
    run(async () => {
      const result = await action(code.replace(/\s/g, ''));
      setUser(result.user);
      setSetup(null);
      setCode('');
      return result.message;
    });
  };

  return (
    <section className="card section" aria-labelledby="tfa-title">
      <h2 id="tfa-title">Двофакторна автентифікація (2FA)</h2>
      <p>
        Статус:{' '}
        {user.twoFactorEnabled ? <span className="badge badge--ok">Увімкнено</span> : <span className="badge">Вимкнено</span>}
      </p>
      <p className="muted">
        Після входу з паролем система додатково запитує одноразовий код із застосунку Google Authenticator,
        Microsoft Authenticator або Authy. Код змінюється кожні 30 секунд.
      </p>

      {!user.twoFactorEnabled && !setup && (
        <button
          className="btn btn--primary"
          disabled={state.busy}
          onClick={() =>
            run(async () => {
              setSetup(await api.setupTwoFactor());
            })
          }
        >
          Увімкнути 2FA
        </button>
      )}

      {setup && (
        <form className="tfa-setup" onSubmit={submitCode(api.enableTwoFactor)} noValidate>
          <ol>
            <li>Відскануйте QR-код застосунком-автентифікатором.</li>
            <li>
              Або введіть ключ вручну: <code className="secret">{setup.secret.match(/.{1,4}/g).join(' ')}</code>
            </li>
            <li>Введіть 6-значний код із застосунку, щоб підтвердити налаштування.</li>
          </ol>
          <div className="qr">
            <QRCodeSVG value={setup.otpauthUri} size={180} marginSize={2} title="QR-код для застосунку-автентифікатора" />
          </div>
          <FormField id="tfa-code" label="Код із застосунку" error={codeError || state.fieldErrors.code}>
            <input id="tfa-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
          </FormField>
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={state.busy}>Підтвердити й увімкнути</button>
            <button className="btn" type="button" onClick={() => setSetup(null)}>Скасувати</button>
          </div>
        </form>
      )}

      {user.twoFactorEnabled && (
        <form className="inline-form" onSubmit={submitCode(api.disableTwoFactor)} noValidate>
          <FormField id="tfa-disable" label="Щоб вимкнути 2FA, введіть поточний код" error={codeError || state.fieldErrors.code}>
            <input id="tfa-disable" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
          </FormField>
          <button className="btn btn--danger" type="submit" disabled={state.busy}>Вимкнути 2FA</button>
        </form>
      )}

      {state.message && <Notice type="success">{state.message}</Notice>}
      {state.error && <p className="state state--error" role="alert">{state.error}</p>}
    </section>
  );
}

function PasswordSection() {
  const { user, applySession } = useAuth();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [state, run] = useAction();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      currentPassword: user.hasPassword && !values.currentPassword ? 'Введіть поточний пароль' : '',
      newPassword: validateNewPassword(values.newPassword),
      confirm: validateConfirm(values.newPassword, values.confirm),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    const ok = await run(async () => {
      const result = await api.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      applySession(result); // інші сеанси завершено, поточний отримує новий токен
      return `${result.message}. Сеанси на інших пристроях завершено.`;
    });
    if (ok) setValues({ currentPassword: '', newPassword: '', confirm: '' });
  };

  const fieldError = (name) => errors[name] || state.fieldErrors[name];

  return (
    <section className="card section" aria-labelledby="password-title">
      <h2 id="password-title">{user.hasPassword ? 'Зміна пароля' : 'Встановлення пароля'}</h2>
      {!user.hasPassword && <p className="muted">Ви входите через Google. Можна додатково встановити пароль для входу за поштою.</p>}
      <form onSubmit={handleSubmit} noValidate>
        {user.hasPassword && (
          <FormField id="currentPassword" label="Поточний пароль" error={fieldError('currentPassword')}>
            <input id="currentPassword" name="currentPassword" type="password" value={values.currentPassword} onChange={handleChange} autoComplete="current-password" />
          </FormField>
        )}
        <FormField id="newPassword" label="Новий пароль" error={fieldError('newPassword')}>
          <input id="newPassword" name="newPassword" type="password" value={values.newPassword} onChange={handleChange} autoComplete="new-password" />
        </FormField>
        <PasswordStrength password={values.newPassword} />
        <FormField id="confirmPassword" label="Повторіть новий пароль" error={fieldError('confirm')}>
          <input id="confirmPassword" name="confirm" type="password" value={values.confirm} onChange={handleChange} autoComplete="new-password" />
        </FormField>
        <button className="btn btn--primary" type="submit" disabled={state.busy}>Змінити пароль</button>
      </form>
      {state.message && <Notice type="success">{state.message}</Notice>}
      {state.error && <p className="state state--error" role="alert">{state.error}</p>}
    </section>
  );
}
