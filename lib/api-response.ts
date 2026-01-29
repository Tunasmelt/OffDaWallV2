import { NextResponse } from 'next/server';
import { isDebugMode } from './observability';

type CacheMeta = { hit: boolean; stale?: boolean };

export function respondOk<T>(
  data: T,
  meta: {
    payloadMode: 'preview' | 'deep';
    providersUsed: string[];
    cache: CacheMeta;
    fallbackUsed?: string;
    emptyReason?: string;
  }
) {
  const body: any = {
    ok: true,
    data,
    meta,
  };

  if (!isDebugMode()) {
    delete body.meta.providersUsed;
  }

  return NextResponse.json(body);
}

export function respondError(code: string, message: string, meta: {
  payloadMode: 'preview' | 'deep';
  providersUsed: string[];
  cache: CacheMeta;
  provider?: string;
}, status: number = 500) {
  const body: any = {
    ok: false,
    error: {
      code,
      message,
      provider: meta.provider,
    },
    meta: {
      payloadMode: meta.payloadMode,
      providersUsed: isDebugMode() ? meta.providersUsed : [],
      cache: meta.cache,
    },
  };

  return NextResponse.json(body, { status });
}
