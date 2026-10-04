import { API_BASE_URL, DEVELOPMENT_USER_ID } from '../config';

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-user-id': DEVELOPMENT_USER_ID,
  };
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;

  return typeof body?.error === 'string'
    ? body.error
    : `Request failed with HTTP ${response.status}.`;
}

/** Performs a request against the API and throws the server's error message on failure. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...headers(), ...(init.headers ?? {}) },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error(`Cannot reach the API at ${API_BASE_URL}. Is the backend running?`);
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response;
}

/** JSON request helper. Resolves to `undefined` for 204 No Content responses. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function jsonBody(method: 'POST' | 'PUT' | 'PATCH', body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}
