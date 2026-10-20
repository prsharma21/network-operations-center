import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { TimeRange, TrendPoint } from '@/types/dashboard'
import { formatChartTick } from '@/utils/format'

interface TrendChartsProps {
  range: TimeRange
  points: TrendPoint[]
}

interface SeriesConfig {
  key: keyof Omit<TrendPoint, 'timestamp'>
  title: string
  color: string
  unit: string
  digits: number
}

const SERIES: SeriesConfig[] = [
  { key: 'latencyMs', title: 'Latency', color: '#0b1f3a', unit: 'ms', digits: 1 },
  { key: 'throughputMbps', title: 'Throughput', color: '#1d4e89', unit: 'Mbps', digits: 1 },
  { key: 'utilizationPct', title: 'Utilization', color: '#8a4b08', unit: '%', digits: 1 },
  { key: 'droppedCallRatePct', title: 'Dropped-call rate', color: '#9f2c23', unit: '%', digits: 2 },
]

export function TrendCharts({ range, points }: TrendChartsProps) {
  return (
    <div className="chart-grid">
      {SERIES.map((series) => (
        <TrendChart key={series.key} range={range} points={points} series={series} />
      ))}
    </div>
  )
}

function TrendChart({ range, points, series }: { range: TimeRange; points: TrendPoint[]; series: SeriesConfig }) {
  const accessibleSummary = points.length === 0
    ? `${series.title} has no samples in this time range.`
    : `${series.title} across ${points.length} samples, from ${formatChartTick(points[0].timestamp, range)} to ${formatChartTick(points[points.length - 1].timestamp, range)}.`

  return (
    <Card>
      <div className="chart-block">
        <h3 className="chart-block__title">{series.title}</h3>
        {points.length === 0 ? (
          <EmptyState
            compact
            title="No trend data"
            description="No telemetry samples fall in this time range."
          />
        ) : (
          <>
            <div className="chart-frame" role="img" aria-label={accessibleSummary}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e3e8ef" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value: string) => formatChartTick(value, range)}
                    tick={{ fontSize: 11, fill: '#5c6b7e' }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#5c6b7e' }}
                    width={44}
                    tickFormatter={(value: number) => value.toFixed(0)}
                  />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === 'number' ? `${value.toFixed(series.digits)} ${series.unit}` : '—',
                      series.title,
                    ]}
                    labelFormatter={(label) => formatChartTick(String(label), range)}
                  />
                  <Line
                    type="monotone"
                    dataKey={series.key}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <table className="visually-hidden">
              <caption>{series.title} samples</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">{series.title} ({series.unit})</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={`${series.key}-${point.timestamp}`}>
                    <td>{formatChartTick(point.timestamp, range)}</td>
                    <td>{point[series.key] === null ? 'Unavailable' : Number(point[series.key]).toFixed(series.digits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Card>
  )
}
