import { accountLockedEmail } from '../../mail/templates.js';
import { formatLockTime } from '../../security/loginGuard.js';
import { SecurityEvents, SecurityObserver } from '../SecurityEventPublisher.js';

// Спостерігач: повідомляє власника листом, що його акаунт тимчасово заблоковано.
// Лист надсилається у фоні, щоб відповідь на запит входу не чекала на SMTP-сервер.
export class AccountLockedMailObserver extends SecurityObserver {
  constructor(mailService) {
    super();
    this.mail = mailService;
  }

  async update(event) {
    if (event.type !== SecurityEvents.ACCOUNT_LOCKED) return;
    const message = accountLockedEmail({
      name: event.user.name,
      until: formatLockTime(event.lockedUntil),
      attempts: event.attempts,
    });
    this.mail
      .send({ to: event.user.email, ...message })
      .catch((err) => console.error('[mail] лист про блокування не надіслано:', err.message));
  }
}
