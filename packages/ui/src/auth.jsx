import { createContext, useContext, useEffect, useState } from 'react';
import { createApi } from '@baseline/shared';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ tokenKey, children }) {
  const [api] = useState(() => createApi(tokenKey));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api.getToken()) { setLoading(false); return; }
    api.request('/me')
      .then((d) => setUser(d.user))
      .catch((e) => { if (e.status === 401) api.clearToken(); })
      .finally(() => setLoading(false));
  }, [api]);

  const finish = (d) => { api.setToken(d.token); setUser(d.user); };
  const login = async (email, password) => finish(await api.request('/auth/login', { method: 'POST', body: { email, password } }));
  const signup = async (form) => finish(await api.request('/auth/signup', { method: 'POST', body: form }));
  const logout = () => { api.clearToken(); setUser(null); };

  return <Ctx.Provider value={{ api, user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}
