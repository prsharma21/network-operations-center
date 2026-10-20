import type { TimeRange } from '@/types/dashboard'

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
]

interface TimeRangeFilterProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

export function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  return (
    <div className="segmented" role="group" aria-label="Time range">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__button${value === option.value ? ' is-selected' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
