import { AppError } from '../errors/AppError.js';

// Відповідь 404 для невідомих маршрутів.
export function notFoundHandler(req, res) {
  res.status(404).json({ status: 404, message: `Маршрут ${req.method} ${req.path} не знайдено` });
}

// Коди помилок PostgreSQL, які означають некоректні дані клієнта.
const PG_ERRORS = {
  23505: [409, 'Запис з такими даними вже існує'],
  23503: [409, "Порушено зв'язок між даними"],
  23514: [400, 'Дані не відповідають обмеженням бази даних'],
  '22P02': [400, 'Некоректний формат даних'],
  22007: [400, 'Некоректний формат дати'],
  22008: [400, 'Некоректна дата'],
  22001: [400, 'Значення занадто довге'],
};

// Централізоване оброблення помилок: клієнт отримує зрозуміле повідомлення
// і відповідний HTTP-статус, а технічні деталі записуються лише в журнал сервера.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { status: err.status, message: err.message };
    if (err.errors) body.errors = err.errors;
    return res.status(err.status).json(body);
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 400, message: 'Некоректний JSON у тілі запиту' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ status: 413, message: 'Завеликий запит' });
  }
  const pg = PG_ERRORS[err?.code];
  if (pg) {
    return res.status(pg[0]).json({ status: pg[0], message: pg[1] });
  }
  console.error(`[error] ${req.method} ${req.path}:`, err);
  return res.status(500).json({ status: 500, message: 'Внутрішня помилка сервера' });
}
