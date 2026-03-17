/**
 * Cloudflare Worker (JavaScript) that provides an API for user auth using D1.
 *
 * Requirements met:
 *   - D1 binding named "DB" (configured in wrangler.toml)
 *   - /signup, /login, /forgot-password endpoints
 *   - Passwords stored hashed (bcrypt)
 *   - Parameterized SQL queries with env.DB.prepare + bind
 *   - JSON responses + appropriate HTTP status codes
 *   - Response format: { success: true/false, message }
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse();
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};

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
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ).run();

  const columns = await env.DB.prepare('PRAGMA table_info(users)').all();
  const columnNames = new Set((columns.results || []).map((column) => column.name));

  if (!columnNames.has('username')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN username TEXT').run();
    await env.DB.prepare(
      "UPDATE users SET username = substr(email, 1, instr(email, '@') - 1) WHERE username IS NULL OR username = ''"
    ).run();
  }

  if (!columnNames.has('created_at')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN created_at TEXT').run();
    await env.DB.prepare(
      "UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
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
    const { email, password } = body ?? {};

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
      'INSERT INTO login_events (user_id, email, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    )
      .bind(row.id, normalizedEmail, ipAddress, userAgent)
      .run();

    return json({
      success: true,
      message: 'Login successful',
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
      },
    });
  } catch (err) {
    console.error('Login failed:', err);
    return json({ success: false, message: 'Internal server error' }, 500);
  }
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
    const resetLink = `${url.origin}/reset.html?token=${encodeURIComponent(resetToken)}`;

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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
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
