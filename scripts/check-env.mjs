import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = [];

const RECOMMENDED = [
  'NEXT_PUBLIC_BASE_URL',
  'LASTFM_API_KEY',
  'AUDIODB_API_KEY',
];

function formatList(list) {
  return list.map((name) => `- ${name}`).join('\n');
}

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

const adminTokenConfigured = Boolean(getValue('ADMIN_API_TOKEN') || getValue('ADMIN_TOKEN'));
const missingRequired = REQUIRED.filter((name) => !getValue(name));
if (!adminTokenConfigured) {
  missingRequired.push('ADMIN_API_TOKEN (or ADMIN_TOKEN)');
}
const missingRecommended = RECOMMENDED.filter((name) => !getValue(name));

if (missingRequired.length > 0) {
  console.warn('[OffDaWallV2] Missing required env vars:\n' + formatList(missingRequired));
}

if (missingRecommended.length > 0) {
  console.warn('[OffDaWallV2] Missing recommended env vars:\n' + formatList(missingRecommended));
}

if (missingRequired.length === 0 && missingRecommended.length === 0) {
  console.log('[OffDaWallV2] Env check passed.');
}
