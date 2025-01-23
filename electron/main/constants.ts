import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// eslint-disable-next-line no-underscore-dangle
export const __filename = fileURLToPath(import.meta.url)
// eslint-disable-next-line no-underscore-dangle
export const __dirname = dirname(__filename)
export const wholeAppUrl = process.env.VITE_DEV_SERVER_URL || 'write-production-url-here'
