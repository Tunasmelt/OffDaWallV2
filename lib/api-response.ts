import { NextResponse } from 'next/server';
import { isDebugMode } from './observability';

type CacheMeta = { hit: boolean; stale?: boolean };

export function respondOk<T>(
  data: T,
  meta: {
    payloadMode: 'preview' | 'deep';
    providersUsed: string[];
    cache: CacheMeta;
    source?: string;
    fallbackUsed?: string[];
    emptyReason?: string;
    status?: 'ok' | 'partial' | 'empty' | 'rate_limited';
    fastPath?: boolean;
    requestId?: string;
    durationMs?: number;
    providerMs?: Record<string, number>;
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
  status?: 'ok' | 'partial' | 'empty' | 'rate_limited';
  emptyReason?: string;
  fastPath?: boolean;
  requestId?: string;
  durationMs?: number;
  providerMs?: Record<string, number>;
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
      status: meta.status,
      emptyReason: meta.emptyReason,
      fastPath: meta.fastPath,
      requestId: meta.requestId,
      durationMs: meta.durationMs,
      providerMs: meta.providerMs,
    },
  };

  return NextResponse.json(body, { status });
}
