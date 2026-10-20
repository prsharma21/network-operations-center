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

interface GetOptions {
  query?: Record<string, string>
  signal?: AbortSignal
}

const REQUEST_TIMEOUT_MS = 3000

export async function apiGet<T>(path: string, options: GetOptions = {}): Promise<T> {
  const url = new URL(path, `${appConfig.apiBaseUrl}/`)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value)
    }
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onOuterAbort)

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
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

  return (await response.json()) as T
}

export function isMissingEndpoint(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 0 || error.status === 404 || error.status === 501 || error.status === 502 || error.status === 503
}
