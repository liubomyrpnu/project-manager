import { STATUSES } from '../constants.js';
import { DEADLINE_LABELS, formatDate, getDeadlineState } from '../utils/dates.js';

// Картка завдання на Kanban-дошці.
// Стан дедлайну передається і кольором, і текстом, щоб не залежати лише від кольору.
export default function TaskCard({ task, assigneeName, canChangeStatus, canEdit, onMove, onEdit, onDelete }) {
  const index = STATUSES.findIndex((status) => status.value === task.status);
  const previous = STATUSES[index - 1];
  const next = STATUSES[index + 1];
  const state = getDeadlineState(task.deadline, task.status);

  return (
    <article className="card task">
      <h3>{task.title}</h3>
      {task.description && <p className="task__desc">{task.description}</p>}
      <p className="task__meta">Виконавець: {assigneeName || 'не призначено'}</p>
      <p className={`deadline deadline--${state}`}>
        {formatDate(task.deadline)}
        {DEADLINE_LABELS[state] && ` · ${DEADLINE_LABELS[state]}`}
      </p>
      <div className="actions">
        {canChangeStatus && previous && (
          <button className="btn" onClick={() => onMove(task, previous.value)}>← {previous.label}</button>
        )}
        {canChangeStatus && next && (
          <button className="btn" onClick={() => onMove(task, next.value)}>{next.label} →</button>
        )}
        {canEdit && <button className="btn btn--ghost" onClick={onEdit}>Редагувати</button>}
        {canEdit && <button className="btn btn--danger" onClick={onDelete}>Видалити</button>}
      </div>
    </article>
  );
}
