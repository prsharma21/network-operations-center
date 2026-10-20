import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDateTime } from '@/utils/format'

interface DemoDataBannerProps {
  asOf: string
  missingEndpoint?: string
  missingEndpoints?: string[]
}

export function DemoDataBanner({ asOf, missingEndpoint, missingEndpoints }: DemoDataBannerProps) {
  const endpoints = missingEndpoints?.length ? missingEndpoints : missingEndpoint ? [missingEndpoint] : []

  return (
    <div className="demo-banner" role="status">
      <StatusBadge status="demo" label="Demo Data" />
      <p>
        Showing labeled synthetic telecom data. Time filters use the dataset clock
        ({formatDateTime(asOf)}). This is not live network information
        {endpoints.length > 0 ? `. Unavailable FastAPI routes: ${endpoints.join(', ')}` : ''}.
      </p>
    </div>
  )
}
