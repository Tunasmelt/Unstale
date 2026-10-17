import { describe, expect, it } from 'vitest'

import { ClaimType } from './index.js'

describe('engine scaffold', () => {
  it('knows the 8 claim types (REQ-004)', () => {
    expect(ClaimType.options).toHaveLength(8)
  })
})
