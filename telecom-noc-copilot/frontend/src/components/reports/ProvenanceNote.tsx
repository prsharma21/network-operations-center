import type { ReportProvenance } from '@/types/report'
import { PROVENANCE_LABEL } from '@/types/report'

interface ProvenanceNoteProps {
  kind: ReportProvenance
  children: string
}

export function ProvenanceNote({ kind, children }: ProvenanceNoteProps) {
  return (
    <p className={`report-provenance report-provenance--${kind}`} role="note">
      <span className="report-provenance__kind">{PROVENANCE_LABEL[kind]}</span>
      {' '}
      {children}
    </p>
  )
}
