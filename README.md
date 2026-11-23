# Управління проєктами — вебзастосунок для командної роботи

Індивідуальний проєкт з дисципліни «Професійна практика програмної інженерії»
(тема 20) і проєкт «Розробка безпечної системи управління обліковими записами»
з дисципліни «Безпека програм та даних».

| Частина      | Технології                                                        |
| ------------ | ----------------------------------------------------------------- |
| `frontend/`  | React 18, Vite, React Router, axios, qrcode.react                 |
| `backend/`   | Node.js 20+, Express 5, PostgreSQL (pg), nodemailer, helmet, cors |
| Тести        | вбудований тестовий фреймворк Node.js (`node:test`)               |

## Можливості

**Проєкти:** проєкти, учасники з ролями «менеджер» і «учасник», Kanban-дошка
(To Do / In Progress / Done), завдання з виконавцем і дедлайном, перелік власних
завдань, виділення прострочених завдань і тих, у яких скоро дедлайн.

**Безпека облікових записів:**

1. Реєстрація з політикою паролів (≥ 8 символів, великі й малі літери, цифра,
   символ), індикатором сили пароля та забороною поширених паролів. Паролі
   хешуються алгоритмом **scrypt** із випадковою сіллю.
2. **CAPTCHA** під час реєстрації (SVG-зображення, яке генерує сервер).
3. **Активація акаунта через пошту** одноразовим посиланням із терміном дії 24 год.
4. **Захист від brute force:** блокування на 15 хв після 5 невдалих спроб,
   обмеження частоти запитів з однієї IP-адреси, лист власнику акаунта,
   журнал входів для адміністратора.
5. **2FA (TOTP)** через Google Authenticator / Microsoft Authenticator, яку
   вмикають і вимикають у профілі.
6. **Вхід через Google** (OpenID Connect + PKCE).
7. **Відновлення пароля** через пошту, токен діє 30 хв.
8. **RBAC:** роль `admin` має доступ до панелі адміністрування (користувачі та їх
   статус, журнал входів, блокування / розблокування).

## Запуск на Windows

Потрібні: Node.js 20 або новіший, PostgreSQL 13 або новіший (пароль користувача
`postgres` знадобиться для налаштування).

### 1. Бекенд

```powershell
cd backend
npm install
npm run setup        # створює .env з випадковими секретами
```

Відкрийте `backend/.env` і в рядку `DATABASE_URL` вкажіть свій пароль від PostgreSQL:

```
DATABASE_URL=postgres://postgres:ВАШ_ПАРОЛЬ@localhost:5432/project_manager
TEST_DATABASE_URL=postgres://postgres:ВАШ_ПАРОЛЬ@localhost:5432/project_manager_test
```

```powershell
npm run db:reset     # створює базу project_manager, таблиці й тестові дані
npm run dev          # API на http://localhost:3001/api
```

> `db:reset` **видаляє** таблиці та заново їх створює. Базу з лабораторної №5
> буде перезаписано новою схемою (додано поля безпеки).

### 2. Фронтенд (у другому терміналі)

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Тестові користувачі (пароль `Password123!`)

| Пошта               | Роль                                                       |
| ------------------- | ---------------------------------------------------------- |
| olena@example.com   | адміністратор                                              |
| andriy@example.com  | менеджер проєкту «Редизайн сайту», учасник другого проєкту |
| maria@example.com   | менеджер проєкту «Мобільний застосунок», учасник першого   |
| igor@example.com    | учасник проєкту «Редизайн сайту»                           |

## Пошта

Без налаштувань листи **не надсилаються**, а виводяться в консоль бекенду й
зберігаються у папку `backend/mail-outbox/` (посилання з листа можна скопіювати).

Щоб надсилати справжні листи через Gmail:

1. Увімкніть двоетапну перевірку в акаунті Google.
2. Створіть **пароль застосунку**: https://myaccount.google.com/apppasswords
3. Заповніть у `backend/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ваша.пошта@gmail.com
SMTP_PASS=16-символьний пароль застосунку без пробілів
MAIL_FROM=Project Manager <ваша.пошта@gmail.com>
```

## Вхід через Google

1. Відкрийте https://console.cloud.google.com/ → створіть проєкт.
2. **APIs & Services → OAuth consent screen**: тип *External*, додайте свою пошту
   в *Test users*.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   тип *Web application*.
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:3001/api/auth/oauth/google/callback`
4. Скопіюйте Client ID і Client secret у `backend/.env`
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) і перезапустіть бекенд.

## Тести

```powershell
cd backend
npm test                    # модульні тести (без бази даних)
npm run test:integration    # інтеграційні тести: API + PostgreSQL (база project_manager_test)
```

Колекція для Postman: `backend/postman/ProjectManager.postman_collection.json`
(File → Import). Запити виконуйте по порядку: вхід зберігає токени в змінні колекції.

## Структура

```
backend/
  db/schema.sql              схема БД (лаб. 5 + таблиці безпеки)
  scripts/                   setup (.env), db:reset (схема + тестові дані)
  src/
    server.js, app.js        запуск і збирання застосунку
    config.js                налаштування з .env
    routes/                  маршрути REST API (/api/...)
    controllers/             приймання HTTP-запитів і формування відповідей
    services/                бізнес-логіка (auth, profile, oauth, admin, project, task)
    repositories/            SQL-запити до PostgreSQL
    security/                scrypt, політика паролів, JWT, TOTP, AES-GCM, CAPTCHA, brute force
    middleware/              автентифікація, RBAC, rate limit, обробка помилок
    mail/                    надсилання листів і шаблони
    oauth/                   OpenID Connect (Google)
    validation/              серверна валідація
  tests/unit, tests/integration
  postman/                   колекція запитів
frontend/
  src/api/client.js          запити до REST API
  src/context/AuthContext    сеанс користувача
  src/pages/                 вхід, реєстрація, активація, відновлення пароля,
                             профіль (2FA), адмін-панель, проєкти, дошка, мої завдання
```

## Основні маршрути API

| Метод  | Шлях                                  | Доступ                     |
| ------ | ------------------------------------- | -------------------------- |
| GET    | /api/auth/captcha                     | усі                        |
| POST   | /api/auth/register                    | усі                        |
| POST   | /api/auth/activate                    | усі (токен з листа)        |
| POST   | /api/auth/login, /api/auth/login/2fa  | усі                        |
| POST   | /api/auth/password/forgot, /reset     | усі                        |
| GET    | /api/auth/oauth/google                | усі                        |
| GET    | /api/auth/me, POST /api/auth/logout   | автентифікований           |
| PATCH  | /api/profile, POST /api/profile/...   | автентифікований           |
| GET    | /api/admin/users, /login-attempts     | admin                      |
| PATCH  | /api/admin/users/:id                  | admin                      |
| GET    | /api/projects, POST /api/projects     | активований акаунт         |
| PUT    | /api/projects/:id, DELETE             | менеджер проєкту           |
| POST   | /api/projects/:id/members             | менеджер проєкту           |
| GET    | /api/projects/:id/tasks               | учасник проєкту            |
| POST   | /api/projects/:id/tasks               | менеджер проєкту           |
| PATCH  | /api/tasks/:id                        | виконавець або менеджер    |
| GET    | /api/tasks/my                         | активований акаунт         |

Помилки повертаються у форматі `{ "status": 404, "message": "Проєкт не знайдено" }`;
для помилок полів форми додається `errors`.
