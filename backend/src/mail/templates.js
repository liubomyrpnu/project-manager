// Шаблони листів. Дані користувача екрануються, щоб у лист не потрапив HTML-код.

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout(title, body) {
  return `<!doctype html><html lang="uk"><body style="font-family:Arial,sans-serif;background:#f4f5f7;padding:24px">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:8px;padding:24px">
<h2 style="margin-top:0;color:#1f2937">${title}</h2>${body}
<p style="color:#6b7280;font-size:12px;margin-top:24px">Лист надіслано автоматично системою «Управління проєктами». Якщо ви не виконували цю дію, просто проігноруйте його.</p>
</div></body></html>`;
}

const button = (url, label) =>
  `<p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${label}</a></p>
<p style="font-size:12px;color:#6b7280">Якщо кнопка не працює, скопіюйте посилання: <br>${url}</p>`;

export function activationEmail({ name, url, hours }) {
  return {
    subject: 'Активація облікового запису',
    html: layout(
      'Підтвердіть електронну пошту',
      `<p>Вітаємо, ${escapeHtml(name)}!</p><p>Щоб активувати обліковий запис, перейдіть за посиланням. Посилання одноразове й діє ${hours} год.</p>${button(url, 'Активувати акаунт')}`
    ),
    text: `Вітаємо, ${name}! Активуйте обліковий запис за посиланням (діє ${hours} год): ${url}`,
  };
}

export function passwordResetEmail({ name, url, minutes }) {
  return {
    subject: 'Відновлення пароля',
    html: layout(
      'Відновлення пароля',
      `<p>${escapeHtml(name)}, ми отримали запит на зміну пароля.</p><p>Посилання одноразове й діє ${minutes} хв.</p>${button(url, 'Встановити новий пароль')}`
    ),
    text: `${name}, щоб встановити новий пароль, перейдіть за посиланням (діє ${minutes} хв): ${url}`,
  };
}

export function accountLockedEmail({ name, until, attempts }) {
  return {
    subject: 'Обліковий запис тимчасово заблоковано',
    html: layout(
      'Підозріла активність',
      `<p>${escapeHtml(name)}, до вашого акаунта було виконано ${attempts} невдалих спроб входу поспіль.</p><p>Вхід тимчасово заблоковано до <b>${escapeHtml(until)}</b>. Якщо це були не ви, рекомендуємо змінити пароль.</p>`
    ),
    text: `${name}, після ${attempts} невдалих спроб входу акаунт заблоковано до ${until}. Якщо це були не ви, змініть пароль.`,
  };
}
