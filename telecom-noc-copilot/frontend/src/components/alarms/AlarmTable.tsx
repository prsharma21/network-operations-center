import { Link } from 'react-router-dom'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { AlarmListItem, AlarmSortKey, SortDirection } from '@/types/alarm'
import { formatDateTime } from '@/utils/format'

interface AlarmTableProps {
  items: AlarmListItem[]
  selectedIds: { has(id: string): boolean }
  selectedAlarmId: string | null
  sort: AlarmSortKey
  dir: SortDirection
  onSort: (key: AlarmSortKey) => void
  onToggle: (item: AlarmListItem) => void
  onTogglePage: (checked: boolean) => void
  onOpen: (alarmId: string) => void
}

const COLUMNS: Array<{ key: AlarmSortKey; label: string }> = [
  { key: 'alarmId', label: 'Alarm ID' },
  { key: 'alarmType', label: 'Alarm type' },
  { key: 'severity', label: 'Severity' },
  { key: 'siteId', label: 'Site ID' },
  { key: 'region', label: 'Region' },
  { key: 'networkComponent', label: 'Network component' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'status', label: 'Status' },
  { key: 'relatedIncident', label: 'Related incident' },
]

export function AlarmTable({
  items,
  selectedIds,
  selectedAlarmId,
  sort,
  dir,
  onSort,
  onToggle,
  onTogglePage,
  onOpen,
}: AlarmTableProps) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.alarmId))
  const someSelected = items.some((item) => selectedIds.has(item.alarmId))

  return (
    <div className="table-wrap">
      <table className="data-table alarm-table">
        <thead>
          <tr>
            <th scope="col" className="alarm-table__check">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(element) => {
                  if (element) element.indeterminate = someSelected && !allSelected
                }}
                aria-label="Select all alarms on this page"
                onChange={(event) => onTogglePage(event.target.checked)}
              />
            </th>
            {COLUMNS.map((column) => {
              const active = sort === column.key
              return (
                <th key={column.key} scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="sort-button" onClick={() => onSort(column.key)}>
                    {column.label}
                    <span className="sort-button__mark" aria-hidden="true">
                      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.alarmId}
              className={`data-table__row--clickable${selectedAlarmId === item.alarmId ? ' is-selected' : ''}`}
              tabIndex={0}
              aria-label={`Open alarm ${item.alarmId}`}
              onClick={() => onOpen(item.alarmId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(item.alarmId)
                }
              }}
            >
              <td className="alarm-table__check" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.alarmId)}
                  aria-label={`Select ${item.alarmId}`}
                  onChange={() => onToggle(item)}
                />
              </td>
              <td>
                <span className="table-link">{item.alarmId}</span>
                <div className="muted">{item.message}</div>
              </td>
              <td>{item.alarmType.replaceAll('_', ' ')}</td>
              <td><SeverityBadge severity={item.severity} /></td>
              <td>
                <Link to={`/sites/${item.siteId}`} onClick={(event) => event.stopPropagation()}>{item.siteId}</Link>
                <div className="muted">{item.siteName}</div>
              </td>
              <td>{item.region}</td>
              <td>{item.networkComponent}</td>
              <td>{formatDateTime(item.timestamp)}</td>
              <td><StatusBadge status={item.status} /></td>
              <td>
                {item.relatedIncident ? (
                  <Link
                    className="table-link"
                    to={`/incidents/${item.relatedIncident.incidentId}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {item.relatedIncident.incidentId}
                  </Link>
                ) : (
                  <span className="muted">None</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
