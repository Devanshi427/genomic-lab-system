// lib/rateLimit.ts
import { LRUCache } from 'lru-cache'
import type { NextApiRequest, NextApiResponse } from 'next'

type Options = {
  uniqueTokenPerInterval?: number
  interval?: number
  limit?: number
}

export function rateLimit(options?: Options) {
  const {
    uniqueTokenPerInterval = 500,
    interval = 60_000,
    limit    = 20,
  } = options ?? {}

  const tokenCache = new LRUCache<string, number[]>({
    max: uniqueTokenPerInterval,
    ttl: interval,
  })

  return {
    check(res: NextApiResponse, token: string): boolean {
      const tokenCount = tokenCache.get(token) ?? []
      const now = Date.now()
      const windowStart = now - interval
      const requestsInWindow = tokenCount.filter((t: number) => t > windowStart)
      requestsInWindow.push(now)
      tokenCache.set(token, requestsInWindow)
      if (requestsInWindow.length > limit) {
        res.setHeader('X-RateLimit-Limit', limit)
        res.setHeader('X-RateLimit-Remaining', 0)
        res.setHeader('Retry-After', Math.ceil(interval / 1000))
        return false
      }
      res.setHeader('X-RateLimit-Limit', limit)
      res.setHeader('X-RateLimit-Remaining', limit - requestsInWindow.length)
      return true
    },
  }
}

export function getIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}