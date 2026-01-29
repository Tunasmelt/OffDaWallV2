type ProviderResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

type CircuitState = {
  failures: number;
  openUntil: number;
};

const circuitState = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 3;
const OPEN_MS = 60_000;

function getState(provider: string): CircuitState {
  return circuitState.get(provider) || { failures: 0, openUntil: 0 };
}

function setState(provider: string, state: CircuitState) {
  circuitState.set(provider, state);
}

export function canCallProvider(provider: string) {
  const state = getState(provider);
  return Date.now() >= state.openUntil;
}

export async function safeCall<T>(
  provider: string,
  fn: () => Promise<T>
): Promise<ProviderResult<T>> {
  const state = getState(provider);
  if (Date.now() < state.openUntil) {
    return {
      ok: false,
      error: { code: 'circuit_open', message: `Provider ${provider} temporarily disabled` },
    };
  }

  try {
    const data = await fn();
    setState(provider, { failures: 0, openUntil: 0 });
    return { ok: true, data };
  } catch (error: any) {
    const failures = state.failures + 1;
    const openUntil = failures >= FAILURE_THRESHOLD ? Date.now() + OPEN_MS : 0;
    setState(provider, { failures, openUntil });
    return {
      ok: false,
      error: {
        code: error?.name || 'provider_error',
        message: error?.message || 'Provider call failed',
      },
    };
  }
}

export function getCircuitStatus(provider: string) {
  const state = getState(provider);
  return {
    failures: state.failures,
    openUntil: state.openUntil,
  };
}
