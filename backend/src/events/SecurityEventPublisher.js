// Патерн Observer: публікація подій безпеки.
//
// Раніше AuthService сам виконував усі дії, пов'язані зі входом: записував спробу в журнал
// (login_attempts) і надсилав лист про блокування. Тепер він лише повідомляє про подію,
// а реагують на неї незалежні спостерігачі, підписані у app.js. Нову реакцію (наприклад,
// сповіщення в Telegram чи метрики) можна додати новим спостерігачем, не змінюючи AuthService.

export const SecurityEvents = Object.freeze({
  LOGIN_SUCCEEDED: 'login.succeeded',
  LOGIN_FAILED: 'login.failed',
  ACCOUNT_LOCKED: 'account.locked',
});

// Базовий клас спостерігача (інтерфейс). Спостерігач сам вирішує, на які події реагувати.
export class SecurityObserver {
  // eslint-disable-next-line no-unused-vars
  async update(event) {
    throw new Error('Спостерігач має реалізувати update(event)');
  }
}

// Суб'єкт (Subject): зберігає список спостерігачів і сповіщає їх про події.
export class SecurityEventPublisher {
  #observers = new Set();

  subscribe(observer) {
    if (typeof observer?.update !== 'function') throw new TypeError('Спостерігач має містити метод update(event)');
    this.#observers.add(observer);
    return this;
  }

  unsubscribe(observer) {
    this.#observers.delete(observer);
    return this;
  }

  get observerCount() {
    return this.#observers.size;
  }

  // Подію публікують лише після того, як зміни вже збережено в БД.
  // Помилка одного спостерігача не зупиняє інших і не ламає вхід користувача.
  async notify(type, data = {}) {
    const event = Object.freeze({ type, occurredAt: new Date(), ...data });
    for (const observer of this.#observers) {
      try {
        await observer.update(event);
      } catch (err) {
        console.error(`[events] спостерігач ${observer.constructor.name} не обробив подію ${type}:`, err.message);
      }
    }
    return event;
  }
}
