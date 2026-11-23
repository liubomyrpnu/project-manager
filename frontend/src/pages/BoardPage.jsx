import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  getErrorMessage,
  getProject,
  getProjectMembers,
  getProjectTasks,
  updateTask,
} from '../api/client.js';
import MembersPanel from '../components/MembersPanel.jsx';
import { ErrorBox, Loading } from '../components/StateViews.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskForm from '../components/TaskForm.jsx';
import { STATUSES } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';

// Kanban-дошка проєкту (FR-07...FR-10, FR-12). Права перевіряє сервер;
// інтерфейс лише приховує недоступні дії.
export default function BoardPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(
    () =>
      Promise.all([getProject(id), getProjectMembers(id), getProjectTasks(id)]).then(([project, members, tasks]) => ({
        project,
        members,
        tasks,
      })),
    [id]
  );
  const [editing, setEditing] = useState(null); // null | 'new' | об'єкт завдання
  const [actionError, setActionError] = useState('');

  if (error) {
    return (
      <main className="page">
        <ErrorBox message={error} onRetry={reload} />
        <Link to="/projects">← Усі проєкти</Link>
      </main>
    );
  }
  if (!data) {
    return <main className="page">{loading && <Loading />}</main>;
  }

  const { project, members, tasks } = data;
  const isManager = project.myRole === 'manager';

  const handleSaveTask = async (values) => {
    if (editing === 'new') await createTask(id, values);
    else await updateTask(editing.id, values);
    setEditing(null);
    reload();
  };

  const run = async (action) => {
    setActionError('');
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleDelete = (task) => {
    if (!window.confirm(`Видалити завдання «${task.title}»?`)) return;
    run(() => deleteTask(task.id));
  };

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <Link to="/projects" className="back">← Усі проєкти</Link>
          <h1>{project.name}</h1>
          {project.description && <p className="muted">{project.description}</p>}
        </div>
        {isManager && <button className="btn btn--primary" onClick={() => setEditing('new')}>Нове завдання</button>}
      </div>

      <MembersPanel projectId={id} members={members} isManager={isManager} currentUserId={user.id} onChange={reload} />

      {actionError && <ErrorBox message={actionError} />}

      <div className="board">
        {STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status.value);
          return (
            <section key={status.value} className="column" aria-label={status.label}>
              <h2>
                {status.label} <span className="count">({columnTasks.length})</span>
              </h2>
              {columnTasks.length === 0 && <p className="muted">Немає завдань</p>}
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  assigneeName={task.assigneeName}
                  canChangeStatus={isManager || task.assigneeId === user.id}
                  canEdit={isManager}
                  onMove={(item, nextStatus) => run(() => changeTaskStatus(item.id, nextStatus))}
                  onEdit={() => setEditing(task)}
                  onDelete={() => handleDelete(task)}
                />
              ))}
            </section>
          );
        })}
      </div>

      {editing && (
        <TaskForm task={editing === 'new' ? null : editing} members={members} onSave={handleSaveTask} onCancel={() => setEditing(null)} />
      )}
    </main>
  );
}
