// Cloudflare Worker to handle API requests and connect to D1.
// Deploy with `wrangler publish` (requires Cloudflare account + D1 binding).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    // For static asset hosting (optional), return 404 here.
    return new Response('Not Found', { status: 404 });
  },
};

async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname.replace('/api', '');

  // Initialize database schema if needed
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT
    )`
  ).run();

  if (path === '/signup' && method === 'POST') {
    const body = await request.json();
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return json({ error: 'Missing fields' }, 400);
    }

    try {
      await env.DB.prepare(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)' 
      ).bind(username, email, password).run();

      return json({ status: 'ok' });
    } catch (err) {
      return json({ error: 'User already exists or invalid' }, 400);
    }
  }

  if (path === '/login' && method === 'POST') {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return json({ error: 'Missing fields' }, 400);
    }

    const row = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND password = ?')
      .bind(email, password)
      .first();

    if (!row) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    return json({ status: 'ok', user: { id: row.id, username: row.username, email: row.email } });
  }

  if (path === '/forgot' && method === 'POST') {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return json({ error: 'Missing email' }, 400);
    }

    // Simulate sending email
    return json({ status: 'ok', message: 'Password reset link sent to your email.' });
  }

  return json({ error: 'Not found' }, 404);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
