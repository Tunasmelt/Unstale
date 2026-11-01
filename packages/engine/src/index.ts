import { z } from 'zod'

export { extractClaims } from './extract.js'
export type { ExtractedClaim } from './extract.js'

export const ClaimType = z.enum(['path', 'command', 'packageManager', 'versionTool', 'identifier', 'route', 'count', 'link'])
export type ClaimType = z.infer<typeof ClaimType>

export const ENGINE_VERSION = '0.0.0'
