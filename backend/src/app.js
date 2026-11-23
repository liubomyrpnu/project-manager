import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createAdminController } from './controllers/adminController.js';
import { createAuthController } from './controllers/authController.js';
import { createProfileController } from './controllers/profileController.js';
import { createProjectController } from './controllers/projectController.js';
import { createTaskController } from './controllers/taskController.js';
import { SecurityEventPublisher } from './events/SecurityEventPublisher.js';
import { AccountLockedMailObserver } from './events/observers/AccountLockedMailObserver.js';
import { LoginAuditObserver } from './events/observers/LoginAuditObserver.js';
import { SecurityLogObserver } from './events/observers/SecurityLogObserver.js';
import { createMailService } from './mail/mailService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createGoogleOidc } from './oauth/googleOidc.js';
import { createLoginAttemptRepository } from './repositories/loginAttemptRepository.js';
import { createProjectRepository } from './repositories/projectRepository.js';
import { createTaskRepository } from './repositories/taskRepository.js';
import { createTokenRepository } from './repositories/tokenRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createCaptchaStore } from './security/captcha.js';
import { createCryptoBox } from './security/cryptoBox.js';
import { createLockoutPolicy } from './security/lockoutPolicies.js';
import { createRouter } from './routes/index.js';
import { createAdminService } from './services/adminService.js';
import { createAuthService } from './services/authService.js';
import { createOAuthService } from './services/oauthService.js';
import { createProfileService } from './services/profileService.js';
import { createProjectService } from './services/projectService.js';
import { createTaskService } from './services/taskService.js';

// Збирання застосунку: репозиторії → сервіси → контролери → маршрути.
// Залежності передаються явно, тому в тестах їх легко підмінити
// (наприклад, тестова БД і поштовий транспорт у пам'яті).
export async function createApp({ config, db, mailTransport, fetchFn, captcha: captchaOverride, logRequests = true }) {
  const repositories = {
    users: createUserRepository(db),
    tokens: createTokenRepository(db),
    attempts: createLoginAttemptRepository(db),
    projects: createProjectRepository(db),
    tasks: createTaskRepository(db),
  };

  const mail = await createMailService(config.mail, mailTransport);
  const cryptoBox = createCryptoBox(config.encryptionKey);
  const captcha = captchaOverride ?? createCaptchaStore({ ttlMs: config.security.captchaTtlMinutes * 60 * 1000 });
  const google = createGoogleOidc(config.google, fetchFn ? { fetchFn } : {});

  // Observer: підписка спостерігачів на події безпеки.
  const events = new SecurityEventPublisher()
    .subscribe(new LoginAuditObserver(repositories.attempts))
    .subscribe(new AccountLockedMailObserver(mail));
  if (logRequests) events.subscribe(new SecurityLogObserver());

  // Strategy: політика блокування обирається в конфігурації (LOCKOUT_POLICY).
  const lockoutPolicy = createLockoutPolicy(config.security);

  const authService = createAuthService({ ...repositories, events, lockoutPolicy, mail, captcha, cryptoBox, config });
  const projectService = createProjectService(repositories);
  const services = {
    authService,
    oauthService: createOAuthService({ google, users: repositories.users, authService }),
    profileService: createProfileService({ users: repositories.users, cryptoBox, issueAccessToken: authService.issueAccessToken }),
    adminService: createAdminService(repositories),
    projectService,
    taskService: createTaskService({ ...repositories, projectService }),
  };

  const controllers = {
    auth: createAuthController({ ...services, config }),
    profile: createProfileController(services),
    admin: createAdminController(services),
    projects: createProjectController(services),
    tasks: createTaskController(services),
  };

  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendUrl,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '100kb' }));
  if (logRequests) app.use(requestLogger);

  app.use('/api', createRouter({ controllers, authService, db }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, services, mail, events, lockoutPolicy };
}
