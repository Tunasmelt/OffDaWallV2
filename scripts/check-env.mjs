const REQUIRED = [
  'ADMIN_API_TOKEN',
];

const RECOMMENDED = [
  'NEXT_PUBLIC_BASE_URL',
  'LASTFM_API_KEY',
  'AUDIODB_API_KEY',
];

function formatList(list) {
  return list.map((name) => `- ${name}`).join('\n');
}

const missingRequired = REQUIRED.filter((name) => !process.env[name]);
const missingRecommended = RECOMMENDED.filter((name) => !process.env[name]);

if (missingRequired.length > 0) {
  console.warn('[OffDaWallV2] Missing required env vars:\n' + formatList(missingRequired));
}

if (missingRecommended.length > 0) {
  console.warn('[OffDaWallV2] Missing recommended env vars:\n' + formatList(missingRecommended));
}

if (missingRequired.length === 0 && missingRecommended.length === 0) {
  console.log('[OffDaWallV2] Env check passed.');
}
