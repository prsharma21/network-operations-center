import { Button } from '@/components/common/Button'
import type { AlarmListItem } from '@/types/alarm'

interface AlarmBulkBarProps {
  selected: AlarmListItem[]
  grouping: boolean
  notice: string | null
  onCopy: () => void
  onGroup: () => void
  onClear: () => void
}

function groups(selected: AlarmListItem[], key: (item: AlarmListItem) => string): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>()
  for (const item of selected) {
    const label = key(item) || 'Unspecified'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
}

export function AlarmBulkBar({ selected, grouping, notice, onCopy, onGroup, onClear }: AlarmBulkBarProps) {
  if (selected.length === 0) return null

  const bySite = groups(selected, (item) => `${item.siteId} · ${item.siteName}`)
  const byCorrelation = groups(selected, (item) => item.correlationKey ?? 'No correlation key')

  return (
    <div className="alarm-bulk" role="region" aria-label="Selected alarms">
      <div className="alarm-bulk__row">
        <p><strong>{selected.length}</strong> selected for viewing or grouping. These actions do not change the live network.</p>
        <div className="alarm-bulk__actions">
          <Button variant="secondary" onClick={onCopy}>Copy IDs</Button>
          <Button variant="secondary" onClick={onGroup}>{grouping ? 'Hide grouping' : 'Group selected'}</Button>
          <Button variant="ghost" onClick={onClear}>Clear selection</Button>
        </div>
      </div>
      {notice ? <p className="muted">{notice}</p> : null}
      {grouping ? (
        <div className="alarm-bulk__groups">
          <section>
            <h4>By site</h4>
            <ul>
              {bySite.map((group) => (
                <li key={group.label}>{group.label} · {group.count}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>By correlation</h4>
            <ul>
              {byCorrelation.map((group) => (
                <li key={group.label}>{group.label} · {group.count}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  )
}
