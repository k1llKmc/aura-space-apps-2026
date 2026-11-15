import assert from 'node:assert/strict';
process.loadEnvFile('.env');
const base = `http://127.0.0.1:${process.env.WEB_PORT || '3000'}/api/v1`;
assert.equal((await fetch(`${base}/health`)).status, 200);
assert.equal((await fetch(`${base}/missions/current`)).status, 401);
const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: process.env.AUTH_BOOTSTRAP_USERNAME || 'commander', password: process.env.AUTH_BOOTSTRAP_PASSWORD }) });
assert.equal(login.status, 200, 'Initial account must be able to log in through the frontend proxy.');
const { accessToken, user } = await login.json();
const headers = { Authorization: `Bearer ${accessToken}` };
for (const path of ['/auth/me', '/missions/current', '/crew', '/alerts', '/protocols']) {
  const response = await fetch(`${base}${path}`, { headers });
  assert.equal(response.status, 200, `Authenticated proxy request failed: ${path}`);
  if (path === '/missions/current') assert.equal((await response.json()).missionId, user.missionId);
}
assert.equal((await fetch(`${base}/auth/logout`, { method: 'POST', headers })).status, 200);
assert.equal((await fetch(`${base}/auth/me`, { headers })).status, 401);
console.log('Authenticated frontend proxy smoke test passed.');
