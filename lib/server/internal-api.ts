import { headers } from 'next/headers';
import { getBaseUrlFromHeaders } from './base-url';

function mergeHeaders(
  base: HeadersInit | undefined,
  forwarded: Record<string, string>
): Headers {
  const result = new Headers(base);
  Object.entries(forwarded).forEach(([key, value]) => {
    if (value) {
      result.set(key, value);
    }
  });
  return result;
}

export async function fetchInternalApi(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const incoming = await headers();
  const url = `${getBaseUrlFromHeaders(incoming)}${path.startsWith('/') ? path : `/${path}`}`;

  // Forward auth/cookie headers so Vercel deployment protection does not block server-side internal calls.
  const forwardedHeaders: Record<string, string> = {
    cookie: incoming.get('cookie') || '',
    authorization: incoming.get('authorization') || '',
    'x-vercel-protection-bypass':
      incoming.get('x-vercel-protection-bypass') ||
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
      '',
    'x-vercel-set-bypass-cookie': incoming.get('x-vercel-set-bypass-cookie') || '',
  };

  return fetch(url, {
    ...init,
    headers: mergeHeaders(init.headers, forwardedHeaders),
  });
}
