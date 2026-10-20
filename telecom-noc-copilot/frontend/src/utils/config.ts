function readFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  return value.trim().toLowerCase() === 'true'
}

export const appConfig = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
  appTitle: import.meta.env.VITE_APP_TITLE?.trim() || 'Telecom NOC Copilot',
  useDemoData: readFlag(import.meta.env.VITE_USE_DEMO_DATA, false),
} as const

export function canUseDemoFallback(): boolean {
  return import.meta.env.DEV || appConfig.useDemoData
}
