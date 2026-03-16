const FitnessRealtorsAuth = (() => {
  const USERS_KEY = 'fr_users';
  const RESET_KEY = 'fr_reset_tokens';

  function readUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function readResetTokens() {
    try {
      const raw = localStorage.getItem(RESET_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeResetTokens(tokens) {
    localStorage.setItem(RESET_KEY, JSON.stringify(tokens));
  }

  async function hashPassword(password) {
    const encoded = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
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

  async function signup({ username, email, password }) {
    try {
      return await callApi('/api/signup', { username, email, password });
    } catch (error) {
      const users = readUsers();
      const normalizedEmail = email.toLowerCase();

      if (users.some((user) => user.email === normalizedEmail)) {
        return { success: false, message: 'User already exists' };
      }

      const passwordHash = await hashPassword(password);
      users.push({
        username,
        email: normalizedEmail,
        passwordHash,
        createdAt: new Date().toISOString(),
      });
      writeUsers(users);

      return {
        success: true,
        message: 'User created successfully',
        fallbackMode: true,
      };
    }
  }

  async function login({ email, password }) {
    try {
      return await callApi('/api/login', { email, password });
    } catch (error) {
      const users = readUsers();
      const normalizedEmail = email.toLowerCase();
      const passwordHash = await hashPassword(password);
      const matchedUser = users.find(
        (user) => user.email === normalizedEmail && user.passwordHash === passwordHash
      );

      if (!matchedUser) {
        return { success: false, message: 'Invalid credentials' };
      }

      return {
        success: true,
        message: 'Login successful',
        fallbackMode: true,
        user: {
          email: matchedUser.email,
          username: matchedUser.username || '',
        },
      };
    }
  }

  async function forgotPassword({ email }) {
    try {
      return await callApi('/api/forgot-password', { email });
    } catch (error) {
      const users = readUsers();
      const normalizedEmail = email.toLowerCase();
      const exists = users.some((user) => user.email === normalizedEmail);

      if (!exists) {
        return { success: false, message: 'Email not found' };
      }

      const token = crypto.randomUUID();
      const resetTokens = readResetTokens();
      resetTokens.push({
        email: normalizedEmail,
        token,
        expiresAt: Date.now() + 1000 * 60 * 30,
      });
      writeResetTokens(resetTokens);

      return {
        success: true,
        message: 'Password reset link created.',
        fallbackMode: true,
        resetLink: `${window.location.origin}/reset.html?token=${encodeURIComponent(token)}`,
        emailSent: false,
      };
    }
  }

  async function resetPassword({ token, password }) {
    try {
      return await callApi('/api/reset-password', { token, password });
    } catch (error) {
      const resetTokens = readResetTokens();
      const tokenEntry = resetTokens.find((entry) => entry.token === token);

      if (!tokenEntry) {
        return { success: false, message: 'Reset link is invalid.' };
      }

      if (Number(tokenEntry.expiresAt) < Date.now()) {
        writeResetTokens(resetTokens.filter((entry) => entry.token !== token));
        return { success: false, message: 'Reset link has expired.' };
      }

      const users = readUsers();
      const userIndex = users.findIndex((user) => user.email === tokenEntry.email);
      if (userIndex === -1) {
        return { success: false, message: 'Account not found.' };
      }

      users[userIndex].passwordHash = await hashPassword(password);
      writeUsers(users);
      writeResetTokens(resetTokens.filter((entry) => entry.token !== token));

      return {
        success: true,
        message: 'Password reset successfully.',
        fallbackMode: true,
      };
    }
  }

  return {
    signup,
    login,
    forgotPassword,
    resetPassword,
  };
})();
