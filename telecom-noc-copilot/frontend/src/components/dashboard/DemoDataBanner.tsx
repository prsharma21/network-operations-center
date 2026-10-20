import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDateTime } from '@/utils/format'

interface DemoDataBannerProps {
  asOf: string
  missingEndpoint?: string
}

export function DemoDataBanner({ asOf, missingEndpoint }: DemoDataBannerProps) {
  return (
    <div className="demo-banner" role="status">
      <StatusBadge status="demo" label="Demo Data" />
      <p>
        Showing labeled synthetic telecom data. Time filters use the dataset clock
        ({formatDateTime(asOf)}). No live network telemetry is connected
        {missingEndpoint ? `, and FastAPI ${missingEndpoint} is not available` : ''}.
      </p>
    </div>
  )
}
