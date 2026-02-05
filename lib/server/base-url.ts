function trim(url: string) {
  return url.replace(/\/$/, '');
}

export function getBaseUrlFromHeaders(
  incoming?: Pick<Headers, 'get'>
) {
  const forwardedHost = incoming?.get('x-forwarded-host') || incoming?.get('host');
  if (forwardedHost) {
    const proto = incoming?.get('x-forwarded-proto') || 'https';
    return trim(`${proto}://${forwardedHost}`);
  }

  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl && !envUrl.includes('yourdomain.com')) {
    return trim(envUrl);
  }

  if (process.env.VERCEL_URL) {
    return trim(`https://${process.env.VERCEL_URL}`);
  }

  return 'http://localhost:3000';
}

export function getBaseUrl() {
  return getBaseUrlFromHeaders();
}
