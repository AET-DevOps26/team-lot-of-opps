const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function request<T>(path: string, init: RequestInit, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function apiGet<T>(path: string, token?: string | null): Promise<T> {
  return request<T>(path, { method: 'GET' }, token)
}

export function apiPost<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token,
  )
}

export function apiPostFormData<T>(path: string, body: FormData, token?: string | null): Promise<T> {
  return request<T>(path, { method: 'POST', body }, token)
}

export function apiDelete<T>(path: string, token?: string | null): Promise<T> {
  return request<T>(path, { method: 'DELETE' }, token)
}
