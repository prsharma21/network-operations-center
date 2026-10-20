import type { ReactNode, SVGProps } from 'react'
import type { IconName } from '@/types/ui'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="1.2" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.2" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.2" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.2" />
    </>
  ),
  alarm: (
    <>
      <path d="M12 4.5a6.5 6.5 0 0 1 6.5 6.5v3.2l1.4 2.3H4.1L5.5 14.2V11A6.5 6.5 0 0 1 12 4.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ),
  site: (
    <>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  incident: (
    <>
      <path d="M12 4.5 20 19H4L12 4.5Z" />
      <path d="M12 10v4.2" />
      <path d="M12 16.8h.01" />
    </>
  ),
  runbook: (
    <>
      <path d="M7 4.5h8.5A2.5 2.5 0 0 1 18 7v12.5H8.5A2.5 2.5 0 0 0 6 22V7a2.5 2.5 0 0 1 1-2.5Z" />
      <path d="M8 4.5v15" />
      <path d="M11 9h4M11 12.5h4" />
    </>
  ),
  approval: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.3 2.3 4.7-5" />
    </>
  ),
  report: (
    <>
      <path d="M7 3.5h7l4 4V20.5H7V3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9.5 13h5M9.5 16.5h3.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.2 1.8H4.8L6 16.5Z" />
      <path d="M10 19.2a2 2 0 0 0 4 0" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  chevron: <path d="m14.5 6-5 6 5 6" />,
  radar: (
    <>
      <path d="M5 18.5v-3.2M9 18.5V11M13 18.5V7.5M17 18.5V5" />
      <circle cx="18.2" cy="5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
}
