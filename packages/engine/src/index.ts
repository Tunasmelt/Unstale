import { z } from 'zod'

export const ClaimType = z.enum(['path', 'command', 'packageManager', 'versionTool', 'identifier', 'route', 'count', 'link'])
export type ClaimType = z.infer<typeof ClaimType>

export const ENGINE_VERSION = '0.0.0'
