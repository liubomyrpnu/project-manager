import { useState } from 'react';
import { getErrorMessage } from '../api/client.js';
import { validateProjectName } from '../utils/validation.js';
import FormField from './FormField.jsx';

// Модальна форма створення / редагування проєкту.
// Якщо project не передано, форма створює новий проєкт.
export default function ProjectForm({ project, onSave, onCancel }) {
  const [values, setValues] = useState({
    name: project?.name || '',
    description: project?.description || '',
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
    const nameError = validateProjectName(values.name);
    setErrors({ name: nameError });
    if (nameError) return;

    setSaving(true);
    setServerError('');
    try {
      await onSave({ name: values.name.trim(), description: values.description.trim() });
    } catch (err) {
      setServerError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
      <form className="card modal__form" onSubmit={handleSubmit} noValidate>
        <h2 id="project-form-title">{project ? 'Редагування проєкту' : 'Новий проєкт'}</h2>
        <FormField id="project-name" label="Назва" error={errors.name}>
          <input id="project-name" name="name" value={values.name} onChange={handleChange} />
        </FormField>
        <FormField id="project-description" label="Опис">
          <textarea id="project-description" name="description" rows="3" value={values.description} onChange={handleChange} />
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
