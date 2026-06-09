/* public/js/mw-api.js
 * Meta World 공용 클라이언트 API
 * - 서버(/api)와 통신하는 모든 함수를 한곳에 모음
 * - 토큰은 localStorage 'mw_token'
 * - 게임들이 기존에 읽던 'mw_session'{name,email} 도 함께 유지 (호환성)
 */
(function (global) {
  const TOKEN_KEY = 'mw_token';
  const SESSION_KEY = 'mw_session';

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setAuth(tok, user) {
    localStorage.setItem(TOKEN_KEY, tok);
    // 게임들이 읽는 가벼운 세션 정보 (민감정보 없음)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email }));
  }
  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }
  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  async function api(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const t = token();
      if (t) headers['Authorization'] = 'Bearer ' + t;
    }
    const res = await fetch('/api' + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `요청 실패 (${res.status})`);
    }
    return json;
  }

  const MW = {
    token,
    session,
    isLoggedIn: () => !!token(),

    async register(name, email, password) {
      const { token: tok, user } = await api('/auth/register', {
        method: 'POST', body: { name, email, password },
      });
      setAuth(tok, user);
      return user;
    },

    async login(id, password) {
      const { token: tok, user } = await api('/auth/login', {
        method: 'POST', body: { id, password },
      });
      setAuth(tok, user);
      return user;
    },

    logout() { clearAuth(); },

    // 토큰 유효성 확인 + 최신 유저 정보 (없으면 null)
    async me() {
      if (!token()) return null;
      try {
        const { user } = await api('/auth/me', { auth: true });
        localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email }));
        return user;
      } catch {
        clearAuth();
        return null;
      }
    },

    // ── 게임 세이브 ──
    async loadSave(game) {
      const { data } = await api(`/saves/${game}`, { auth: true });
      return data; // 없으면 null
    },
    async saveSave(game, data) {
      return api(`/saves/${game}`, { method: 'PUT', auth: true, body: { data } });
    },
    async deleteSave(game) {
      return api(`/saves/${game}`, { method: 'DELETE', auth: true });
    },
    async allSaves() {
      const { saves } = await api('/saves', { auth: true });
      return saves;
    },
  };

  global.MW = MW;
})(window);
