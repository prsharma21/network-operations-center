import { appConfig } from '@/utils/config'

export class ApiError extends Error {
  readonly status: number
  readonly path: string

  constructor(message: string, status: number, path: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.path = path
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  query?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 3000

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, `${appConfig.apiBaseUrl}/`)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value)
    }
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onOuterAbort)

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (options.signal?.aborted) throw error
      throw new ApiError(`Timed out reaching FastAPI at ${url.origin}`, 0, path)
    }
    const reason = error instanceof Error ? error.message : 'Network request failed'
    throw new ApiError(`Unable to reach FastAPI at ${url.origin}: ${reason}`, 0, path)
  } finally {
    window.clearTimeout(timer)
    options.signal?.removeEventListener('abort', onOuterAbort)
  }

  if (!response.ok) {
    throw new ApiError(
      `FastAPI responded ${response.status} for ${path}`,
      response.status,
      path,
    )
  }

  const text = await response.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

interface GetOptions {
  query?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
}

interface PostOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export async function apiGet<T>(path: string, options: GetOptions = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' })
}

export async function apiPost<T>(path: string, body: unknown = {}, options: PostOptions = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'POST', body })
}

export function isMissingEndpoint(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 0 || error.status === 404 || error.status === 501 || error.status === 502 || error.status === 503
}
