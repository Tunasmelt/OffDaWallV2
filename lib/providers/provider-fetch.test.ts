import { providerFetch } from './provider-fetch';

async function runTest() {
  const timestamps: number[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    timestamps.push(Date.now());
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const requests = Array.from({ length: 20 }).map(() =>
    providerFetch('musicbrainz', 'http://example.test').then(() => null)
  );

  await Promise.all(requests);

  globalThis.fetch = originalFetch;

  let minGap = Infinity;
  for (let i = 1; i < timestamps.length; i += 1) {
    const gap = timestamps[i] - timestamps[i - 1];
    minGap = Math.min(minGap, gap);
  }

  console.log('[provider-fetch.test] requests:', timestamps.length);
  console.log('[provider-fetch.test] min gap (ms):', minGap);
}

if (require.main === module) {
  runTest().catch((error) => {
    console.error('[provider-fetch.test] failed', error);
    process.exit(1);
  });
}
