import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createProject, deleteProject, getErrorMessage, getProjects, updateProject } from '../api/client.js';
import ProjectForm from '../components/ProjectForm.jsx';
import { ErrorBox, Loading } from '../components/StateViews.jsx';
import { useLoad } from '../hooks/useLoad.js';

// Список проєктів користувача з формою створення / редагування (FR-03, FR-04).
export default function ProjectsPage() {
  const { data: projects, loading, error, reload } = useLoad(getProjects, []);
  const [editing, setEditing] = useState(null); // null | 'new' | об'єкт проєкту
  const [actionError, setActionError] = useState('');

  // Сервер сам призначає автора нового проєкту менеджером.
  const handleSave = async (values) => {
    if (editing === 'new') await createProject(values);
    else await updateProject(editing.id, values);
    setEditing(null);
    reload();
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Видалити проєкт «${project.name}» разом з усіма завданнями?`)) return;
    setActionError('');
    try {
      await deleteProject(project.id);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  return (
    <main className="page">
      <div className="page__head">
        <h1>Мої проєкти</h1>
        <button className="btn btn--primary" onClick={() => setEditing('new')}>Новий проєкт</button>
      </div>

      {actionError && <ErrorBox message={actionError} />}
      {loading && !projects && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {projects && projects.length === 0 && <p className="state">У вас ще немає проєктів. Створіть перший.</p>}

      <ul className="grid">
        {(projects || []).map((project) => (
          <li key={project.id} className="card project-card">
            <h2><Link to={`/projects/${project.id}`}>{project.name}</Link></h2>
            <p>{project.description || 'Без опису'}</p>
            <p className="project-card__stats">
              Учасників: {project.memberCount} · Завдань: {project.doneCount}/{project.taskCount} виконано
            </p>
            <span className={`badge badge--${project.myRole}`}>{project.myRole === 'manager' ? 'Менеджер' : 'Учасник'}</span>
            {project.myRole === 'manager' && (
              <div className="actions">
                <button className="btn" onClick={() => setEditing(project)}>Редагувати</button>
                <button className="btn btn--danger" onClick={() => handleDelete(project)}>Видалити</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <ProjectForm project={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
      )}
    </main>
  );
}
