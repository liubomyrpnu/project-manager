import { SecurityEvents, SecurityObserver } from '../SecurityEventPublisher.js';

// Спостерігач: записує кожну спробу входу в журнал login_attempts (для панелі адміністратора).
export class LoginAuditObserver extends SecurityObserver {
  constructor(attemptRepository) {
    super();
    this.attempts = attemptRepository;
  }

  async update(event) {
    if (event.type !== SecurityEvents.LOGIN_SUCCEEDED && event.type !== SecurityEvents.LOGIN_FAILED) return;
    await this.attempts.add({
      userId: event.user?.id ?? null,
      email: event.user?.email ?? event.email,
      ip: event.context?.ip ?? null,
      userAgent: event.context?.userAgent ?? null,
      method: event.method,
      success: event.type === SecurityEvents.LOGIN_SUCCEEDED,
      reason: event.reason ?? 'ok',
    });
  }
}
