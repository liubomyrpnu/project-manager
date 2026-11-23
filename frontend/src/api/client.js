import axios from 'axios';

// Усі запити до REST API зосереджені в цьому файлі (лаб. 8-10: замість mock-сервера
// json-server використовується справжній бекенд Node.js + Express + PostgreSQL).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = 'pm_token';
export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)),
};

const http = axios.create({ baseURL: API_URL, timeout: 10000 });

// До кожного запиту додається токен доступу.
http.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Якщо сервер відповів 401 на запит із токеном — сеанс завершився, користувача буде розлогінено.
let unauthorizedHandler = null;
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) unauthorizedHandler?.();
    return Promise.reject(error);
  }
);

// Повідомлення про помилку для користувача (сервер повертає { status, message, errors }).
export function getErrorMessage(err) {
  if (err?.isAxiosError) {
    if (!err.response) return 'Не вдалося підключитися до сервера. Перевірте, чи запущено бекенд.';
    return err.response.data?.message || 'Сервер повернув помилку. Спробуйте ще раз.';
  }
  return err?.message || 'Сталася невідома помилка.';
}

// Помилки окремих полів форми, які повернув сервер.
export const getFieldErrors = (err) => err?.response?.data?.errors || {};

const data = (promise) => promise.then((response) => response.data);

// --- Автентифікація ---
export const getCaptcha = () => data(http.get('/auth/captcha'));
export const register = (body) => data(http.post('/auth/register', body));
export const activateAccount = (token) => data(http.post('/auth/activate', { token }));
export const resendActivation = () => data(http.post('/auth/activation/resend'));
export const login = (email, password) => data(http.post('/auth/login', { email, password }));
export const loginTwoFactor = (challengeToken, code) => data(http.post('/auth/login/2fa', { challengeToken, code }));
export const logout = () => data(http.post('/auth/logout'));
export const getMe = () => data(http.get('/auth/me'));
export const forgotPassword = (email) => data(http.post('/auth/password/forgot', { email }));
export const checkResetToken = (token) => data(http.get('/auth/password/reset', { params: { token } }));
export const resetPassword = (token, password) => data(http.post('/auth/password/reset', { token, password }));
export const getAuthProviders = () => data(http.get('/auth/providers'));
export const exchangeOAuthCode = (code) => data(http.post('/auth/oauth/exchange', { code }));
export const GOOGLE_LOGIN_URL = `${API_URL}/auth/oauth/google`;

// --- Профіль і 2FA ---
export const updateProfile = (body) => data(http.patch('/profile', body));
export const changePassword = (body) => data(http.post('/profile/password', body));
export const setupTwoFactor = () => data(http.post('/profile/2fa/setup'));
export const enableTwoFactor = (code) => data(http.post('/profile/2fa/enable', { code }));
export const disableTwoFactor = (code) => data(http.post('/profile/2fa/disable', { code }));

// --- Адміністратор ---
export const getUsers = () => data(http.get('/admin/users'));
export const setUserBlocked = (id, isBlocked) => data(http.patch(`/admin/users/${id}`, { isBlocked }));
export const unlockUser = (id) => data(http.post(`/admin/users/${id}/unlock`));
export const getLoginAttempts = (params) => data(http.get('/admin/login-attempts', { params }));
export const getLoginSummary = (days = 7) => data(http.get('/admin/login-attempts/summary', { params: { days } }));

// --- Проєкти та учасники ---
export const getProjects = () => data(http.get('/projects'));
export const getProject = (id) => data(http.get(`/projects/${id}`));
export const createProject = (project) => data(http.post('/projects', project));
export const updateProject = (id, project) => data(http.put(`/projects/${id}`, project));
export const deleteProject = (id) => data(http.delete(`/projects/${id}`)); // завдання й учасники видаляються каскадно
export const getProjectMembers = (projectId) => data(http.get(`/projects/${projectId}/members`));
export const addMember = (projectId, email, role) => data(http.post(`/projects/${projectId}/members`, { email, role }));
export const removeMember = (projectId, userId) => data(http.delete(`/projects/${projectId}/members/${userId}`));

// --- Завдання ---
export const getProjectTasks = (projectId) => data(http.get(`/projects/${projectId}/tasks`));
export const createTask = (projectId, task) => data(http.post(`/projects/${projectId}/tasks`, task));
export const updateTask = (id, task) => data(http.put(`/tasks/${id}`, task));
export const changeTaskStatus = (id, status) => data(http.patch(`/tasks/${id}`, { status }));
export const deleteTask = (id) => data(http.delete(`/tasks/${id}`));
export const getMyTasks = () => data(http.get('/tasks/my'));
