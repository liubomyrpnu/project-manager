import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client.js';

const AuthContext = createContext(null);

// Стан автентифікації: токен зберігається в localStorage, а дані користувача
// після оновлення сторінки повторно завантажуються з сервера (GET /auth/me).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(() => {
    api.tokenStorage.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    api.setUnauthorizedHandler(clearSession);
    if (!api.tokenStorage.get()) {
      setReady(true);
      return;
    }
    api
      .getMe()
      .then(setUser)
      .catch(clearSession)
      .finally(() => setReady(true));
  }, [clearSession]);

  // Зберігає новий сеанс (після входу, 2FA, Google або зміни пароля).
  const applySession = useCallback(({ token, user: nextUser }) => {
    api.tokenStorage.set(token);
    setUser(nextUser);
  }, []);

  // Повертає { twoFactorRequired, challengeToken }, якщо потрібен другий крок.
  const login = useCallback(
    async (email, password) => {
      const result = await api.login(email, password);
      if (result.twoFactorRequired) return result;
      applySession(result);
      return { twoFactorRequired: false };
    },
    [applySession]
  );

  const verifyTwoFactor = useCallback(
    async (challengeToken, code) => applySession(await api.loginTwoFactor(challengeToken, code)),
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // сеанс уже недійсний — достатньо очистити локальні дані
    }
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => setUser(await api.getMe()), []);

  const value = useMemo(
    () => ({ user, ready, login, verifyTwoFactor, logout, applySession, refreshUser, setUser }),
    [user, ready, login, verifyTwoFactor, logout, applySession, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
