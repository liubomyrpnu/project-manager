import { SecurityEvents, SecurityObserver } from '../SecurityEventPublisher.js';

// Спостерігач: виводить події безпеки в журнал сервера (консоль).
// Доданий уже після рефакторингу без жодних змін в AuthService — приклад розширення через Observer.
export class SecurityLogObserver extends SecurityObserver {
  constructor(logger = console) {
    super();
    this.logger = logger;
  }

  async update(event) {
    const who = event.user?.email ?? event.email ?? '—';
    const where = event.context?.ip ? ` ip=${event.context.ip}` : '';
    if (event.type === SecurityEvents.ACCOUNT_LOCKED) {
      this.logger.warn(`[security] ${event.type} ${who} attempts=${event.attempts} until=${event.lockedUntil.toISOString()}`);
    } else {
      this.logger.log(`[security] ${event.type} ${who} method=${event.method} reason=${event.reason ?? 'ok'}${where}`);
    }
  }
}
