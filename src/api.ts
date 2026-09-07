export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(path, { method: method || (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data as T;
}
