const FitnessRealtorsAuth = (() => {
  const AUTH_REQUIRED_MESSAGE = 'Please sign up or log in to access this content.';

  function getClientMetadata() {
    return {
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    };
  }

  async function parseJsonResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Auth endpoint returned a non-JSON response.');
    }

    return response.json();
  }

  async function callApi(path, payload, options = {}) {
    const method = options.method || 'POST';
    const headers = { ...(options.headers || {}) };

    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(path, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      credentials: 'same-origin',
    });

    return parseJsonResponse(response);
  }

  function buildLoginUrl(message, nextPath) {
    const target = new URL('/login', window.location.origin);

    if (message) {
      target.searchParams.set('error', message);
    }

    if (nextPath) {
      target.searchParams.set('next', nextPath);
    }

    return target;
  }

  return {
    AUTH_REQUIRED_MESSAGE,
    signup({ username, email, password }) {
      return callApi('/api/signup', { username, email, password });
    },
    login({ email, password }) {
      return callApi('/api/login', { email, password, ...getClientMetadata() });
    },
    forgotPassword({ email }) {
      return callApi('/api/forgot-password', { email });
    },
    resetPassword({ token, password }) {
      return callApi('/api/reset-password', { token, password });
    },
    getSession() {
      return callApi('/api/session', undefined, { method: 'GET' });
    },
    logout() {
      return callApi('/api/logout', {}, { method: 'POST' });
    },
    redirectToLogin(message = AUTH_REQUIRED_MESSAGE, nextPath = `${window.location.pathname}${window.location.hash}`) {
      const target = buildLoginUrl(message, nextPath);
      window.location.replace(target.toString());
    },
    getRedirectAfterLogin() {
      const params = new URLSearchParams(window.location.search);
      return params.get('next') || '/app#commission';
    },
    getAuthMessage() {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      if (!error) {
        return '';
      }

      if (error === 'auth_required') {
        return AUTH_REQUIRED_MESSAGE;
      }

      return error;
    },
  };
})();
