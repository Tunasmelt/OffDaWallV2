import fs from 'node:fs';
import path from 'node:path';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    values[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const cwd = process.cwd();
const fileEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
};
const getValue = (name) => process.env[name] || fileEnv[name];

const baseUrl = getValue('SMOKE_BASE_URL') || 'http://localhost:3000';
const adminToken = getValue('ADMIN_TOKEN') || getValue('ADMIN_API_TOKEN') || '';

const adminHeaders = adminToken ? { 'x-admin-token': adminToken } : undefined;

const routes = [
  { path: '/api/health', headers: adminHeaders, optionalWithoutAdmin: true },
  { path: '/api/genres?preview=1' },
  { path: '/api/search?q=nas&type=artists&limit=5' },
  { path: '/api/artist-image?name=Eminem' },
];

if (adminToken) {
  routes.push({ path: '/api/admin/monitoring', headers: { 'x-admin-token': adminToken } });
}

const failures = [];

console.log(`\nSmoke test base URL: ${baseUrl}`);
for (const route of routes) {
  const url = `${baseUrl}${route.path}`;
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers: route.headers, cache: 'no-store' });
    const durationMs = Date.now() - startedAt;
    let detail = '';
    try {
      const json = await response.clone().json();
      if (typeof json?.ok === 'boolean') {
        detail = ` ok=${json.ok}`;
      }
    } catch {
      // Ignore non-JSON routes.
    }

    console.log(`${response.status} ${route.path} (${durationMs}ms)${detail}`);
    if (!response.ok) {
      if (route.optionalWithoutAdmin && response.status === 401 && !adminToken) {
        console.log(`  ↳ skipped unauthorized check (set ADMIN_API_TOKEN to include this route)`);
        continue;
      }
      failures.push(`${route.path} -> ${response.status}`);
    }
  } catch (error) {
    failures.push(`${route.path} -> ${error instanceof Error ? error.message : 'request failed'}`);
    console.error(`ERR ${route.path}:`, error);
  }
}

if (failures.length > 0) {
  console.error('\nSmoke checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('\nSmoke checks passed.');
