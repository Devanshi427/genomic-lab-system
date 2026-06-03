// lib/withRateLimit.ts
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { rateLimit, getIP } from './rateLimit'

export function withRateLimit(handler: NextApiHandler, limit = 60): NextApiHandler {
  const customLimiter = rateLimit({ interval: 60_000, limit })
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const ip = getIP(req)
    const allowed = customLimiter.check(res, ip)
    if (!allowed) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }
    return handler(req, res)
  }
}