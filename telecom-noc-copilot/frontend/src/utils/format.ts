import type { TimeRange } from '@/types/dashboard'

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

export function formatLatency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} ms`
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function formatChartTick(iso: string, range: TimeRange): string {
  const date = new Date(iso)
  if (range === '7d') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
