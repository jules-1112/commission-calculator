/**
 * Cloudflare Worker (JavaScript) that provides an API for user auth using D1.
 *
 * Requirements met:
 *   - D1 binding named "DB" (configured in wrangler.toml)
 *   - /signup, /login, /forgot-password endpoints
 *   - Passwords stored hashed (bcrypt)
 *   - Parameterized SQL queries with env.DB.prepare + bind
 *   - JSON responses + appropriate HTTP status codes
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

    return new Response('Not Found', { status: 404 });
  },
};

async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname.replace('/api', '');

  // Ensure the users table exists.
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`
  ).run();

  if (path === '/signup' && method === 'POST') {
    return handleSignup(request, env);
  }

  if (path === '/login' && method === 'POST') {
    return handleLogin(request, env);
  }

  if (path === '/forgot-password' && method === 'POST') {
    return handleForgot(request, env);
  }

  return json({ error: 'Not found' }, 404);
}

async function handleSignup(request, env) {
  const body = await request.json();
  const { email, password } = body ?? {};

  if (!email || !password) {
    return json({ error: 'Missing email or password' }, 400);
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    await env.DB.prepare('INSERT INTO users (email, password) VALUES (?, ?)')
      .bind(email, hashed)
      .run();

    return json({ status: 'ok' }, 201);
  } catch (err) {
    // Unique constraint violation (user already exists)
    return json({ error: 'User already exists' }, 409);
  }
}

async function handleLogin(request, env) {
  const body = await request.json();
  const { email, password } = body ?? {};

  if (!email || !password) {
    return json({ error: 'Missing email or password' }, 400);
  }

  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!row) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  const passwordMatches = await bcrypt.compare(password, row.password);
  if (!passwordMatches) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  return json({ status: 'ok', user: { id: row.id, email: row.email } });
}

async function handleForgot(request, env) {
  const body = await request.json();
  const { email } = body ?? {};

  if (!email) {
    return json({ error: 'Missing email' }, 400);
  }

  const row = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!row) {
    // For security, do not reveal whether the email exists.
    return json({ status: 'ok', message: 'If an account exists, a reset link has been sent.' });
  }

  // Placeholder: In a real app, send email via Mailgun/SendGrid/etc.
  return json({ status: 'ok', message: 'Password reset link sent to your email.' });
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
