const FitnessRealtorsAuth = (() => {
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

  async function callApi(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse(response);
  }

  return {
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
  };
})();
