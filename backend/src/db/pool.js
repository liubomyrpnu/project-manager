import pg from 'pg';

// Тип PostgreSQL date (OID 1082) повертаємо рядком 'РРРР-ММ-ДД' без перетворення
// в об'єкт Date — так дедлайн не зсувається через часовий пояс.
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  pool.on('error', (err) => console.error('[db] неочікувана помилка з’єднання:', err.message));
  return pool;
}
