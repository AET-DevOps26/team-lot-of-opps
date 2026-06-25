import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './schema'
import { auth } from '../firebase'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  const token = await auth.currentUser?.getIdToken()
  const uid = auth.currentUser?.uid
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (uid) headers['X-User-Sub'] = uid
  return headers
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    for (const [k, v] of Object.entries(await authHeaders())) request.headers.set(k, v)
    return request
  },
}

export const api = createClient<paths>({ baseUrl: BASE_URL })
api.use(authMiddleware)

export async function unwrap<T>(
  p: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await p
  if (error !== undefined || !response.ok) {
    throw new Error(`API ${response.url} failed: ${response.status}`)
  }
  return data as T
}
