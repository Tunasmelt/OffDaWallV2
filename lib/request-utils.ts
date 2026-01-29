export async function readJsonWithLimit<T>(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const reader = request.body?.getReader();
  if (!reader) {
    try {
      const data = (await request.json()) as T;
      return { ok: true, data };
    } catch {
      return { ok: false, error: 'Invalid JSON' };
    }
  }

  let received = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.length;
        if (received > maxBytes) {
          return { ok: false, error: 'Payload too large' };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, error: 'Failed to read body' };
  }

  try {
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}
