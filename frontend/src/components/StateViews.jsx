// Стани завантаження, помилки та повідомлення, що повторюються на різних сторінках.

export function Loading() {
  return <p className="state" role="status">Завантаження…</p>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <p>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Повторити</button>}
    </div>
  );
}

// type: 'success' | 'info' | 'warn'
export function Notice({ type = 'info', children }) {
  return (
    <div className={`notice notice--${type}`} role={type === 'warn' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
