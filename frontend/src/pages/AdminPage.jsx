import { useState } from 'react';
import * as api from '../api/client.js';
import { ErrorBox, Loading } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { formatDateTime } from '../utils/dates.js';

// Панель адміністратора (FR-13, RBAC): користувачі та їх статус,
// журнал входів, блокування / розблокування облікових записів.
const TABS = [
  { id: 'users', label: 'Користувачі' },
  { id: 'log', label: 'Журнал входів' },
  { id: 'summary', label: 'Спроби за користувачами' },
];

export const REASONS = {
  ok: 'Успішний вхід',
  wrong_password: 'Невірний пароль',
  wrong_password_locked: 'Невірний пароль → тимчасове блокування',
  unknown_email: 'Невідома пошта',
  locked: 'Спроба під час блокування',
  blocked: 'Акаунт заблоковано адміністратором',
  no_password: 'Пароль не встановлено (вхід через Google)',
  no_password_locked: 'Пароль не встановлено → тимчасове блокування',
  wrong_2fa_code: 'Невірний код 2FA',
  wrong_2fa_code_locked: 'Невірний код 2FA → тимчасове блокування',
};
const METHODS = { password: 'Пароль', '2fa': 'Код 2FA', google: 'Google' };

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  return (
    <main className="page">
      <div className="page__head">
        <h1>Адміністрування</h1>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'log' && <LogTab />}
      {tab === 'summary' && <SummaryTab />}
    </main>
  );
}

function UserStatus({ user }) {
  if (user.isBlocked) return <span className="badge badge--danger">Заблоковано</span>;
  if (user.lockedUntil) return <span className="badge badge--warn">Тимчасово до {formatDateTime(user.lockedUntil).split(', ')[1]}</span>;
  return <span className="badge badge--ok">Активний</span>;
}

function UsersTab() {
  const { user: me } = useAuth();
  const { data: users, loading, error, reload } = useLoad(api.getUsers, []);
  const [actionError, setActionError] = useState('');

  const act = async (action) => {
    setActionError('');
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(api.getErrorMessage(err));
    }
  };

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!users) return loading ? <Loading /> : null;

  return (
    <>
      {actionError && <ErrorBox message={actionError} />}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Користувач</th>
              <th>Роль</th>
              <th>Активація</th>
              <th>2FA</th>
              <th>Статус</th>
              <th>Невдалі входи (24 год)</th>
              <th>Останній вхід</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                  <br />
                  <span className="muted">{user.email}</span>
                  {user.googleLinked && <span className="badge badge--small">Google</span>}
                </td>
                <td>{user.systemRole === 'admin' ? 'Адміністратор' : 'Користувач'}</td>
                <td>{user.isActivated ? 'Так' : <span className="badge badge--warn">Ні</span>}</td>
                <td>{user.twoFactorEnabled ? 'Увімкнено' : '—'}</td>
                <td><UserStatus user={user} /></td>
                <td>{user.recentFailures > 0 ? <strong>{user.recentFailures}</strong> : 0}</td>
                <td>{formatDateTime(user.lastLoginAt)}</td>
                <td>
                  <div className="actions actions--table">
                    {user.id !== me.id &&
                      (user.isBlocked ? (
                        <button className="btn" onClick={() => act(() => api.setUserBlocked(user.id, false))}>Розблокувати</button>
                      ) : (
                        <button className="btn btn--danger" onClick={() => act(() => api.setUserBlocked(user.id, true))}>Заблокувати</button>
                      ))}
                    {user.lockedUntil && (
                      <button className="btn" onClick={() => act(() => api.unlockUser(user.id))}>Зняти тимч. блокування</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LogTab() {
  const [filters, setFilters] = useState({ email: '', result: '' });
  const [applied, setApplied] = useState(filters);
  const { data: attempts, loading, error, reload } = useLoad(
    () => api.getLoginAttempts({ email: applied.email || undefined, result: applied.result || undefined, limit: 200 }),
    [applied]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    setApplied({ ...filters });
  };

  return (
    <>
      <form className="filters" onSubmit={handleSubmit}>
        <input
          aria-label="Пошта"
          placeholder="Пошта містить…"
          value={filters.email}
          onChange={(event) => setFilters((prev) => ({ ...prev, email: event.target.value }))}
        />
        <select
          aria-label="Результат"
          value={filters.result}
          onChange={(event) => setFilters((prev) => ({ ...prev, result: event.target.value }))}
        >
          <option value="">Усі спроби</option>
          <option value="failed">Лише невдалі</option>
          <option value="success">Лише успішні</option>
        </select>
        <button className="btn btn--primary" type="submit">Застосувати</button>
        <button className="btn" type="button" onClick={reload}>Оновити</button>
      </form>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!attempts && loading && <Loading />}
      {attempts && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Час</th>
                <th>Пошта</th>
                <th>IP-адреса</th>
                <th>Спосіб</th>
                <th>Результат</th>
                <th>Причина</th>
                <th>Браузер</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 && (
                <tr><td colSpan="7" className="muted">Записів немає</td></tr>
              )}
              {attempts.map((attempt) => (
                <tr key={attempt.id} className={attempt.success ? '' : 'row--failed'}>
                  <td>{formatDateTime(attempt.createdAt)}</td>
                  <td>{attempt.email}{attempt.userName && <><br /><span className="muted">{attempt.userName}</span></>}</td>
                  <td>{attempt.ip || '—'}</td>
                  <td>{METHODS[attempt.method] || attempt.method}</td>
                  <td>{attempt.success ? <span className="badge badge--ok">Успіх</span> : <span className="badge badge--danger">Невдача</span>}</td>
                  <td>{REASONS[attempt.reason] || attempt.reason}</td>
                  <td className="cell--ua" title={attempt.userAgent || ''}>{shortAgent(attempt.userAgent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SummaryTab() {
  const { data: rows, loading, error, reload } = useLoad(() => api.getLoginSummary(7), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!rows) return loading ? <Loading /> : null;
  return (
    <>
      <p className="muted">Хто і скільки разів намагався увійти за останні 7 днів.</p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Пошта</th>
              <th>Усього спроб</th>
              <th>Невдалих</th>
              <th>Успішних</th>
              <th>Остання спроба</th>
              <th>Остання IP</th>
              <th>Акаунт існує</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.email} className={row.failed >= 5 ? 'row--failed' : ''}>
                <td>{row.email}</td>
                <td>{row.total}</td>
                <td>{row.failed}</td>
                <td>{row.succeeded}</td>
                <td>{formatDateTime(row.lastAttemptAt)}</td>
                <td>{row.lastIp || '—'}</td>
                <td>{row.accountExists ? 'Так' : 'Ні'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function shortAgent(userAgent) {
  if (!userAgent) return '—';
  const browsers = [['Edg', 'Edge'], ['OPR', 'Opera'], ['Firefox', 'Firefox'], ['Chrome', 'Chrome'], ['Safari', 'Safari'], ['PostmanRuntime', 'Postman']];
  for (const [token, label] of browsers) {
    const match = userAgent.match(new RegExp(`${token}/(\\d+)`));
    if (match) return `${label} ${match[1]}`;
  }
  return userAgent.slice(0, 30);
}
