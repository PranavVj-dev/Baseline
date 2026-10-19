// Small fetch wrapper used by both apps. Each app keeps its own sign-in token.
export function createApi(tokenKey = 'baseline-token') {
  const getToken = () => localStorage.getItem(tokenKey);

  async function request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('Cannot reach the server. Is it running?');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Something went wrong');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    request,
    getToken,
    setToken: (t) => localStorage.setItem(tokenKey, t),
    clearToken: () => localStorage.removeItem(tokenKey),
  };
}
