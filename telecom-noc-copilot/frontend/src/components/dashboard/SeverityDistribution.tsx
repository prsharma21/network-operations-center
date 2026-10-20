import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { SeverityDistributionItem } from '@/types/dashboard'

const BAR_COLORS: Record<SeverityDistributionItem['bucket'], string> = {
  critical: '#9f2c23',
  high: '#8a4b08',
  medium: '#1d4e89',
  low: '#526074',
}

interface SeverityDistributionProps {
  items: SeverityDistributionItem[]
}

export function SeverityDistribution({ items }: SeverityDistributionProps) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const summary = items.map((item) => `${item.label} ${item.count}`).join(', ')

  return (
    <Card title="Alarm severity distribution">
      {total === 0 ? (
        <EmptyState compact title="No alarms" description="No alarms were recorded in this time range." />
      ) : (
        <>
          <div className="chart-frame chart-frame--bar" role="img" aria-label={`Alarm severity distribution: ${summary}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#5c6b7e' }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={72}
                  tick={{ fontSize: 12, fill: '#152033' }}
                />
                <Tooltip formatter={(value) => [value ?? 0, 'Alarms']} />
                <Bar dataKey="count" isAnimationActive={false} radius={[0, 4, 4, 0]}>
                  {items.map((item) => (
                    <Cell key={item.bucket} fill={BAR_COLORS[item.bucket]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="visually-hidden">
            <caption>Alarm counts by severity</caption>
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.bucket}>
                  <td>{item.label}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  )
}
