// Журнал HTTP-запитів у консоль: метод, шлях (без параметрів, щоб у журнал
// не потрапили токени з посилань), статус і час виконання.
export function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl?.split('?')[0] ?? req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}
