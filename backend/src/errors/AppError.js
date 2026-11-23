// Помилка застосунку з HTTP-статусом. Обробник помилок перетворює її на JSON:
// { "status": 404, "message": "Проєкт не знайдено" }

export class AppError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (errors) this.errors = errors; // помилки окремих полів форми
  }
}

export const badRequest = (message, errors) => new AppError(400, message, errors);
export const unauthorized = (message = 'Необхідна автентифікація') => new AppError(401, message);
export const forbidden = (message = 'Доступ заборонено') => new AppError(403, message);
export const notFound = (message = 'Ресурс не знайдено') => new AppError(404, message);
export const conflict = (message) => new AppError(409, message);
export const tooManyRequests = (message) => new AppError(429, message);
export const serviceUnavailable = (message) => new AppError(503, message);

// Кидає помилку 400, якщо в об'єкті є хоча б одна помилка поля.
export function throwIfInvalid(errors, message = 'Перевірте правильність заповнення полів') {
  const filtered = Object.fromEntries(Object.entries(errors).filter(([, value]) => value));
  if (Object.keys(filtered).length > 0) throw badRequest(message, filtered);
}
