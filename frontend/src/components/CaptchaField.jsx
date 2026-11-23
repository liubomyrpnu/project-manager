import FormField from './FormField.jsx';

// Поле CAPTCHA: SVG-зображення з сервера (показується через <img>, тож код у ньому не виконується),
// кнопка оновлення та поле для відповіді.
export default function CaptchaField({ captcha, value, onChange, onReload, error }) {
  const src = captcha ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captcha.svg)}` : '';
  return (
    <FormField id="captcha" label="Введіть символи з картинки" error={error}>
      <div className="captcha">
        {captcha ? <img src={src} alt="CAPTCHA: символи для перевірки" width="220" height="70" /> : <span className="captcha__empty">Завантаження…</span>}
        <button type="button" className="btn" onClick={onReload} aria-label="Інша картинка" title="Інша картинка">
          ↻
        </button>
      </div>
      <input
        id="captcha"
        name="captcha"
        value={value}
        onChange={onChange}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck="false"
        maxLength={10}
      />
    </FormField>
  );
}
