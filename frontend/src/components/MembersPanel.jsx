import { useState } from 'react';
import { addMember, getErrorMessage, removeMember } from '../api/client.js';
import { validateEmail } from '../utils/validation.js';

// Учасники проєкту (FR-05, FR-06): менеджер додає користувачів за поштою та видаляє їх.
export default function MembersPanel({ projectId, members, isManager, currentUserId, onChange }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      onChange();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (await run(() => addMember(projectId, email.trim(), role))) setEmail('');
  };

  const handleRemove = (member) => {
    if (!window.confirm(`Видалити ${member.name} з проєкту?`)) return;
    void run(() => removeMember(projectId, member.userId)); // помилки обробляє run()
  };

  return (
    <details className="card members">
      <summary>Учасники проєкту ({members.length})</summary>
      <ul className="members__list">
        {members.map((member) => (
          <li key={member.userId}>
            <span>
              {member.name} <span className="muted">· {member.email}</span>
            </span>
            <span className={`badge badge--${member.role}`}>{member.role === 'manager' ? 'Менеджер' : 'Учасник'}</span>
            {isManager && member.userId !== currentUserId && (
              <button className="btn btn--ghost btn--small" onClick={() => handleRemove(member)} disabled={busy}>
                Видалити
              </button>
            )}
          </li>
        ))}
      </ul>
      {isManager && (
        <form className="members__form" onSubmit={handleAdd} noValidate>
          <input
            type="email"
            aria-label="Пошта нового учасника"
            placeholder="пошта користувача"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select aria-label="Роль" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="member">Учасник</option>
            <option value="manager">Менеджер</option>
          </select>
          <button className="btn btn--primary" type="submit" disabled={busy}>Додати</button>
        </form>
      )}
      {error && <p className="state state--error" role="alert">{error}</p>}
    </details>
  );
}
