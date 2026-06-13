import { auth } from '../firebase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  const token = await auth.currentUser?.getIdToken()
  const uid = auth.currentUser?.uid
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (uid) headers['X-User-Sub'] = uid

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function apiPostFormData<T>(path: string, body: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body })
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
