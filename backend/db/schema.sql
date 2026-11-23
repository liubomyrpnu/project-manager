-- Схема бази даних project_manager (PostgreSQL 13+).
-- Основа — лабораторна робота №5 (users, projects, project_members, tasks).
-- Для системи облікових записів (лаб. 8-10 + «Безпека програм та даних», лаб. 6)
-- таблицю users розширено полями безпеки та додано таблиці user_tokens і login_attempts.
-- УВАГА: скрипт видаляє наявні таблиці разом із даними.

DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS user_tokens CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name               varchar(100) NOT NULL,
    email              varchar(255) NOT NULL UNIQUE,
    -- NULL, якщо користувач зареєструвався лише через Google і ще не задав пароль
    password_hash      varchar(255),
    system_role        varchar(10)  NOT NULL DEFAULT 'user'
                       CHECK (system_role IN ('user', 'admin')),
    is_blocked         boolean      NOT NULL DEFAULT false,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    -- Поля безпеки
    is_activated       boolean      NOT NULL DEFAULT false,
    failed_login_count integer      NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until       timestamptz,
    totp_secret        text,                       -- секрет 2FA, зашифрований AES-256-GCM
    totp_enabled       boolean      NOT NULL DEFAULT false,
    totp_last_step     bigint,                     -- захист від повторного використання коду
    google_sub         varchar(255) UNIQUE,        -- ідентифікатор користувача Google (OpenID Connect)
    token_version      integer      NOT NULL DEFAULT 0, -- збільшення робить недійсними видані токени
    last_login_at      timestamptz
);

CREATE TABLE projects (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(150) NOT NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
    project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users (id),
    role       varchar(10) NOT NULL CHECK (role IN ('manager', 'member')),
    joined_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    title       varchar(200) NOT NULL,
    description text,
    deadline    date,
    status      varchar(12) NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done')),
    assignee_id uuid NOT NULL REFERENCES users (id),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_project_status ON tasks (project_id, status);
CREATE INDEX idx_tasks_assignee_deadline ON tasks (assignee_id, deadline);

-- Одноразові токени для активації акаунта та відновлення пароля.
-- Зберігається лише SHA-256 хеш токена, сам токен є тільки в листі.
CREATE TABLE user_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       varchar(20) NOT NULL CHECK (type IN ('activation', 'password_reset')),
    token_hash char(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_tokens_user_type ON user_tokens (user_id, type);

-- Журнал спроб входу для адміністратора (захист від brute force).
CREATE TABLE login_attempts (
    id         bigserial PRIMARY KEY,
    user_id    uuid REFERENCES users (id) ON DELETE SET NULL,
    email      varchar(255) NOT NULL,
    ip         varchar(45),
    user_agent varchar(255),
    method     varchar(10) NOT NULL DEFAULT 'password'
               CHECK (method IN ('password', '2fa', 'google')),
    success    boolean NOT NULL,
    reason     varchar(40) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_created ON login_attempts (created_at DESC);
CREATE INDEX idx_login_attempts_email ON login_attempts (email, created_at DESC);
