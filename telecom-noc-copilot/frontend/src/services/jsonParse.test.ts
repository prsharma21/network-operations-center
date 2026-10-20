import { describe, expect, it } from 'vitest'
import { isRecord, readNumber, readString, readStringArray, unwrapList } from '@/services/jsonParse'

describe('jsonParse', () => {
  it('reads camelCase or snake_case strings', () => {
    expect(readString({ incident_id: 'INC-1' }, 'incidentId', 'incident_id')).toBe('INC-1')
    expect(readString({ incidentId: 'INC-2' }, 'incidentId', 'incident_id')).toBe('INC-2')
    expect(readString({ incident_id: '  ' }, 'incident_id')).toBeUndefined()
  })

  it('reads finite numbers only', () => {
    expect(readNumber({ total: 4, page_size: 25 }, 'pageSize', 'page_size')).toBe(25)
    expect(readNumber({ total: Number.NaN }, 'total')).toBeUndefined()
  })

  it('filters string arrays', () => {
    expect(readStringArray(['a', '', 1, 'b'])).toEqual(['a', 'b'])
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord(null)).toBe(false)
  })

  it('unwraps array or named collection keys', () => {
    expect(unwrapList([{ id: 1 }])).toEqual([{ id: 1 }])
    expect(unwrapList({ incidents: [{ id: 2 }] }, 'incidents')).toEqual([{ id: 2 }])
    expect(unwrapList({ items: [{ id: 3 }] }, 'approvals', 'items')).toEqual([{ id: 3 }])
    expect(unwrapList({ other: [] }, 'incidents')).toEqual([])
  })
})
