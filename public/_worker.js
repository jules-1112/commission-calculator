/**
 * Cloudflare Worker (JavaScript) that provides an API for user auth using D1.
 *
 * Auth flow:
 *   - /api/signup creates users in D1
 *   - /api/login validates credentials, creates a D1-backed session, and sets an auth cookie
 *   - /api/session validates the current cookie against D1 for page gating
 *   - /api/logout deletes the session and clears the cookie
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const SESSION_COOKIE_NAME = 'fr_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse();
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    const staticRoute = getStaticPageRoute(url.pathname);
    if (staticRoute) {
      return serveStaticPage(request, env, url, staticRoute);
    }

    // Serve the calculator app only when the session cookie is valid in D1.
    if (url.pathname === '/app') {
      return handleProtectedAppRequest(request, env, url);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};

function getStaticPageRoute(pathname) {
  const routes = {
    '/login': '/',
    '/signup': '/signup',
    '/forgot': '/forgot',
    '/reset': '/reset',
  };

  return routes[pathname] || '';
}

async function serveStaticPage(request, env, url, assetPath) {
  if (!env.ASSETS) {
    return new Response('Not Found', { status: 404 });
  }

  const assetUrl = new URL(assetPath, url.origin);
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname.replace('/api', '');

  if (!env.DB) {
    return json({ success: false, message: 'Database binding is not configured.' }, 500);
  }

  await ensureSchema(env);

  if (path === '/signup' && method === 'POST') {
    return handleSignup(request, env);
  }

  if (path === '/login' && method === 'POST') {
    return handleLogin(request, env);
  }

  if (path === '/session' && method === 'GET') {
    return handleSession(request, env);
  }

  if (path === '/logout' && method === 'POST') {
    return handleLogout(request, env);
  }

  if (path === '/forgot-password' && method === 'POST') {
    return handleForgot(request, env);
  }

  if (path === '/reset-password' && method === 'POST') {
    return handleResetPassword(request, env);
  }

  return json({ success: false, message: 'Endpoint not found' }, 404);
}

let schemaReadyPromise;

async function ensureSchema(env) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureDatabaseSchema(env);
  }

  return schemaReadyPromise;
}

async function ensureDatabaseSchema(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT
    )`
  ).run();

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      logged_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      client_timezone TEXT,
      timezone_offset_minutes INTEGER,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ).run();

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ).run();

  const columns = await env.DB.prepare('PRAGMA table_info(users)').all();
  const columnNames = new Set((columns.results || []).map((column) => column.name));
  const loginColumns = await env.DB.prepare('PRAGMA table_info(login_events)').all();
  const loginColumnNames = new Set((loginColumns.results || []).map((column) => column.name));
  const sessionColumns = await env.DB.prepare('PRAGMA table_info(sessions)').all();
  const sessionColumnNames = new Set((sessionColumns.results || []).map((column) => column.name));

  if (!columnNames.has('username')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN username TEXT').run();
    await env.DB.prepare(
      "UPDATE users SET username = substr(email, 1, instr(email, '@') - 1) WHERE username IS NULL OR username = ''"
    ).run();
  }

  if (!columnNames.has('created_at')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN created_at TEXT').run();
    await env.DB.prepare(
      'UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL'
    ).run();
  }

  if (!columnNames.has('reset_token')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN reset_token TEXT').run();
  }

  if (!columnNames.has('reset_token_expires_at')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN reset_token_expires_at TEXT').run();
  }

  if (!columnNames.has('last_login_at')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_at TEXT').run();
  }

  if (!loginColumnNames.has('client_timezone')) {
    await env.DB.prepare('ALTER TABLE login_events ADD COLUMN client_timezone TEXT').run();
  }

  if (!loginColumnNames.has('timezone_offset_minutes')) {
    await env.DB.prepare('ALTER TABLE login_events ADD COLUMN timezone_offset_minutes INTEGER').run();
  }

  if (!sessionColumnNames.has('last_seen_at')) {
    await env.DB.prepare('ALTER TABLE sessions ADD COLUMN last_seen_at TEXT').run();
  }

  if (!sessionColumnNames.has('ip_address')) {
    await env.DB.prepare('ALTER TABLE sessions ADD COLUMN ip_address TEXT').run();
  }

  if (!sessionColumnNames.has('user_agent')) {
    await env.DB.prepare('ALTER TABLE sessions ADD COLUMN user_agent TEXT').run();
  }
}

async function handleSignup(request, env) {
  try {
    const body = await request.json();
    const { username, email, password } = body ?? {};

    if (!username || !email || !password) {
      return json({ success: false, message: 'Missing username, email, or password' }, 400);
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    await env.DB.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
      .bind(normalizedUsername, normalizedEmail, hashed)
      .run();

    return json({ success: true, message: 'User created successfully' }, 201);
  } catch (err) {
    const errorMessage = String(err?.message || err || '');
    console.error('Signup failed:', errorMessage);

    if (errorMessage.toLowerCase().includes('unique')) {
      return json({ success: false, message: 'User already exists' }, 409);
    }

    return json({ success: false, message: 'Unable to create account right now.' }, 500);
  }
}

async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { email, password, clientTimezone, timezoneOffsetMinutes } = body ?? {};

    if (!email || !password) {
      return json({ success: false, message: 'Missing email or password' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first();

    if (!row) {
      return json({ success: false, message: 'Invalid credentials' }, 401);
    }

    const passwordMatches = await bcrypt.compare(password, row.password);
    if (!passwordMatches) {
      return json({ success: false, message: 'Invalid credentials' }, 401);
    }

    const ipAddress = request.headers.get('CF-Connecting-IP') || '';
    const userAgent = request.headers.get('User-Agent') || '';

    await env.DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(row.id)
      .run();

    await env.DB.prepare(
      'INSERT INTO login_events (user_id, email, ip_address, client_timezone, timezone_offset_minutes, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(
        row.id,
        normalizedEmail,
        ipAddress,
        String(clientTimezone || ''),
        Number.isFinite(Number(timezoneOffsetMinutes)) ? Number(timezoneOffsetMinutes) : null,
        userAgent
      )
      .run();

    const sessionToken = await createSession(env, request, row.id);

    return json(
      {
        success: true,
        message: 'Login successful',
        user: {
          id: row.id,
          username: row.username,
          email: row.email,
        },
      },
      200,
      {
        'Set-Cookie': buildSessionCookie(request, sessionToken, SESSION_TTL_SECONDS),
      }
    );
  } catch (err) {
    console.error('Login failed:', err);
    return json({ success: false, message: 'Internal server error' }, 500);
  }
}

async function handleSession(request, env) {
  const session = await getAuthenticatedSession(request, env);

  if (!session) {
    return json(
      {
        success: false,
        authenticated: false,
        message: 'Please sign up or log in to access this content.',
      },
      401,
      {
        'Set-Cookie': buildClearedSessionCookie(request),
      }
    );
  }

  return json({
    success: true,
    authenticated: true,
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
    },
  });
}

async function handleLogout(request, env) {
  const sessionToken = getCookie(request, SESSION_COOKIE_NAME);

  if (sessionToken) {
    const tokenHash = await hashToken(sessionToken);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  return json(
    {
      success: true,
      message: 'Logged out successfully.',
    },
    200,
    {
      'Set-Cookie': buildClearedSessionCookie(request),
    }
  );
}

async function handleForgot(request, env) {
  try {
    const body = await request.json();
    const { email } = body ?? {};

    if (!email) {
      return json({ success: false, message: 'Missing email' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const row = await env.DB.prepare('SELECT id, username FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first();

    if (!row) {
      return json({ success: false, message: 'Email not found' }, 404);
    }

    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

    await env.DB.prepare(
      'UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?'
    )
      .bind(resetToken, expiresAt, row.id)
      .run();

    const url = new URL(request.url);
    const resetLink = `${url.origin}/reset?token=${encodeURIComponent(resetToken)}`;

    const emailResult = await sendResetEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM_EMAIL,
      to: normalizedEmail,
      resetLink,
    });

    return json({
      success: true,
      message: emailResult.emailSent
        ? 'Password reset link sent to your email.'
        : 'Password reset link created.',
      resetLink,
      emailSent: emailResult.emailSent,
      emailProviderMessage: emailResult.message,
      username: row.username,
    });
  } catch (err) {
    console.error('Forgot password failed:', err);
    return json({ success: false, message: 'Internal server error' }, 500);
  }
}

async function handleResetPassword(request, env) {
  try {
    const body = await request.json();
    const { token, password } = body ?? {};

    if (!token || !password) {
      return json({ success: false, message: 'Missing reset token or password' }, 400);
    }

    if (String(password).length < 4) {
      return json({ success: false, message: 'Password must be at least 4 characters long' }, 400);
    }

    const row = await env.DB.prepare(
      'SELECT id, reset_token_expires_at FROM users WHERE reset_token = ?'
    )
      .bind(token)
      .first();

    if (!row) {
      return json({ success: false, message: 'Reset link is invalid.' }, 400);
    }

    const expiresAt = Date.parse(row.reset_token_expires_at || '');
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return json({ success: false, message: 'Reset link has expired.' }, 400);
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await env.DB.prepare(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?'
    )
      .bind(hashed, row.id)
      .run();

    return json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password failed:', err);
    return json({ success: false, message: 'Internal server error' }, 500);
  }
}

async function handleProtectedAppRequest(request, env, url) {
  await ensureSchema(env);
  const session = await getAuthenticatedSession(request, env);

  if (!session) {
    const redirectUrl = new URL('/login', url.origin);
    redirectUrl.searchParams.set('error', 'auth_required');
    redirectUrl.searchParams.set('next', '/app');
    return Response.redirect(redirectUrl.toString(), 302);
  }

  if (env.ASSETS) {
    const assetUrl = new URL('/', url.origin);
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }

  return new Response('Not Found', { status: 404 });
}

async function createSession(env, request, userId) {
  const sessionToken = crypto.randomUUID();
  const tokenHash = await hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const ipAddress = request.headers.get('CF-Connecting-IP') || '';
  const userAgent = request.headers.get('User-Agent') || '';

  await env.DB.prepare(
    'INSERT INTO sessions (user_id, token_hash, expires_at, last_seen_at, ip_address, user_agent) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)'
  )
    .bind(userId, tokenHash, expiresAt, ipAddress, userAgent)
    .run();

  return sessionToken;
}

async function getAuthenticatedSession(request, env) {
  const sessionToken = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return null;
  }

  const tokenHash = await hashToken(sessionToken);
  const row = await env.DB.prepare(
    `SELECT
      sessions.id AS session_id,
      sessions.expires_at AS expires_at,
      users.id AS user_id,
      users.username AS username,
      users.email AS email
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?`
  )
    .bind(tokenHash)
    .first();

  if (!row) {
    return null;
  }

  const expiresAt = Date.parse(row.expires_at || '');
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(row.session_id).run();
    return null;
  }

  await env.DB.prepare('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(row.session_id)
    .run();

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
  };
}

async function hashToken(token) {
  const value = new TextEncoder().encode(String(token));
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rawValueParts.join('='));
    }
  }

  return '';
}

function buildSessionCookie(request, token, maxAgeSeconds) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (shouldUseSecureCookies(request)) {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}

function buildClearedSessionCookie(request) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (shouldUseSecureCookies(request)) {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}

function shouldUseSecureCookies(request) {
  const url = new URL(request.url);
  const host = url.hostname;
  const isLocalHost = host === '127.0.0.1' || host === 'localhost';
  return url.protocol === 'https:' && !isLocalHost;
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

async function sendResetEmail({ apiKey, from, to, resetLink }) {
  if (!apiKey || !from) {
    return {
      emailSent: false,
      message: 'Resend is not configured.',
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your Fitness Realtors password',
      html: buildResetEmailHtml(resetLink),
      text: `Reset your password by opening this link: ${resetLink}`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend email failed:', response.status, errorText);
    return {
      emailSent: false,
      message: 'Resend rejected the email request.',
    };
  }

  return {
    emailSent: true,
    message: 'Password reset email sent.',
  };
}

function buildResetEmailHtml(resetLink) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0a2146;">
      <h2 style="margin-bottom:12px;">Reset your password</h2>
      <p>We received a request to reset your Fitness Realtors password.</p>
      <p>
        <a
          href="${escapeHtml(resetLink)}"
          style="display:inline-block;padding:12px 18px;background:#0f8d84;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;"
        >
          Reset Password
        </a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${escapeHtml(resetLink)}">${escapeHtml(resetLink)}</a></p>
      <p>This link expires in 30 minutes.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

