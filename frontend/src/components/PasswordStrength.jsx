import { STRENGTH_LABELS, passwordChecks, passwordStrength } from '../utils/validation.js';

// Індикатор сили пароля та перелік вимог політики паролів.
export default function PasswordStrength({ password }) {
  if (!password) return null;
  const score = passwordStrength(password);
  return (
    <div className="strength" aria-live="polite">
      <div className="strength__bar" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={index < score ? `strength__seg strength__seg--${score}` : 'strength__seg'} />
        ))}
      </div>
      <p className="strength__label">Надійність: {STRENGTH_LABELS[score]}</p>
      <ul className="checklist">
        {passwordChecks(password).map((check) => (
          <li key={check.id} className={check.ok ? 'checklist__ok' : 'checklist__fail'}>
            {check.ok ? '✓' : '✗'} {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
