export const appConfig = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
  appTitle: import.meta.env.VITE_APP_TITLE?.trim() || 'Telecom NOC Copilot',
} as const
