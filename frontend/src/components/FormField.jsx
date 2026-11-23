// Обгортка поля форми: підпис, елемент введення (children) та текст помилки.
export default function FormField({ id, label, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}
