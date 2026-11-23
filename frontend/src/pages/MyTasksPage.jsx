import { useState } from 'react';
import { Link } from 'react-router-dom';
import { changeTaskStatus, getErrorMessage, getMyTasks } from '../api/client.js';
import { ErrorBox, Loading } from '../components/StateViews.jsx';
import { STATUSES } from '../constants.js';
import { useLoad } from '../hooks/useLoad.js';
import { DEADLINE_LABELS, formatDate, getDeadlineState } from '../utils/dates.js';

// Власні завдання користувача з усіх проєктів (FR-11, FR-12).
export default function MyTasksPage() {
  const { data: tasks, loading, error, reload } = useLoad(getMyTasks, []);
  const [actionError, setActionError] = useState('');

  const handleStatusChange = async (task, status) => {
    setActionError('');
    try {
      await changeTaskStatus(task.id, status);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  return (
    <main className="page">
      <div className="page__head">
        <h1>Мої завдання</h1>
      </div>

      {actionError && <ErrorBox message={actionError} />}
      {loading && !tasks && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {tasks && tasks.length === 0 && <p className="state">Вам поки не призначено жодного завдання.</p>}

      <ul className="task-list">
        {(tasks || []).map((task) => {
          const state = getDeadlineState(task.deadline, task.status);
          return (
            <li key={task.id} className="card task-row">
              <div>
                <h2>{task.title}</h2>
                <p className="muted">
                  <Link to={`/projects/${task.projectId}`}>{task.projectName}</Link>
                </p>
              </div>
              <p className={`deadline deadline--${state}`}>
                {formatDate(task.deadline)}
                {DEADLINE_LABELS[state] && ` · ${DEADLINE_LABELS[state]}`}
              </p>
              <select
                aria-label={`Статус завдання «${task.title}»`}
                value={task.status}
                onChange={(event) => handleStatusChange(task, event.target.value)}
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
