import { useState } from 'react';
import { getErrorMessage } from '../api/client.js';
import { STATUSES } from '../constants.js';
import { validateDeadline, validateTaskTitle } from '../utils/validation.js';
import FormField from './FormField.jsx';

// Модальна форма створення / редагування завдання.
// members — учасники проєкту ({ userId, name }) для вибору виконавця.
export default function TaskForm({ task, members, onSave, onCancel }) {
  const [values, setValues] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigneeId: String(task?.assigneeId ?? members[0]?.userId ?? ''),
    deadline: task?.deadline || '',
    status: task?.status || 'todo',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      title: validateTaskTitle(values.title),
      deadline: validateDeadline(values.deadline),
      assigneeId: values.assigneeId ? '' : 'Оберіть виконавця',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    setServerError('');
    try {
      await onSave({
        title: values.title.trim(),
        description: values.description.trim(),
        assigneeId: values.assigneeId,
        deadline: values.deadline || null,
        status: values.status,
      });
    } catch (err) {
      setServerError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
      <form className="card modal__form" onSubmit={handleSubmit} noValidate>
        <h2 id="task-form-title">{task ? 'Редагування завдання' : 'Нове завдання'}</h2>
        <FormField id="task-title" label="Назва" error={errors.title}>
          <input id="task-title" name="title" value={values.title} onChange={handleChange} />
        </FormField>
        <FormField id="task-description" label="Опис">
          <textarea id="task-description" name="description" rows="3" value={values.description} onChange={handleChange} />
        </FormField>
        <FormField id="task-assignee" label="Виконавець" error={errors.assigneeId}>
          <select id="task-assignee" name="assigneeId" value={values.assigneeId} onChange={handleChange}>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>{member.name}</option>
            ))}
          </select>
        </FormField>
        <FormField id="task-deadline" label="Дедлайн" error={errors.deadline}>
          <input id="task-deadline" name="deadline" type="date" value={values.deadline} onChange={handleChange} />
        </FormField>
        <FormField id="task-status" label="Статус">
          <select id="task-status" name="status" value={values.status} onChange={handleChange}>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </FormField>
        {serverError && <p className="state state--error" role="alert">{serverError}</p>}
        <div className="modal__buttons">
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>Скасувати</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Збереження…' : 'Зберегти'}</button>
        </div>
      </form>
    </div>
  );
}
