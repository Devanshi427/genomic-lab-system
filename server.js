// server.js
import { createServer } from 'http'
import { parse }        from 'url'
import next             from 'next'
import { Server }       from 'socket.io'
import cron             from 'node-cron'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dev    = process.env.NODE_ENV !== 'production'
const app    = next({ dev })
const handle = app.getRequestHandler()

const ARCHIVE_AFTER_DAYS = 90

async function archiveOldRequests() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ARCHIVE_AFTER_DAYS)
  try {
    const result = await prisma.request.updateMany({
      where: {
        status:      'COMPLETED',
        completedAt: { lte: cutoff },
        archived:    false,
      },
      data: {
        archivedAt: new Date(),
        archived:   true,
      },
    })
    return result.count
  } catch (err) {
    console.error('[Archival] Prisma error:', err)
    return 0
  }
}

cron.schedule('0 3 * * *', async () => {
  console.log('[Archival] Checking for requests to archive...')
  try {
    const count = await archiveOldRequests()
    if (count > 0) {
      console.log(`[Archival] Archived ${count} old completed request(s).`)
    } else {
      console.log('[Archival] No requests needed archiving.')
    }
  } catch (err) {
    console.error('[Archival] Error:', err)
  }
})

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: {
      origin:  process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  globalThis.io = io

  io.on('connection', (socket) => {
    // Join role-based room for broadcast notifications
    socket.on('join-role', (role) => {
      socket.join(role)
    })


    socket.on('join-user', (userId) => {
      socket.join(`user_${userId}`)
    })
  })

  const port = parseInt(process.env.PORT || '3000')
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)

    if (dev) {
      import('child_process').then(({ exec }) => {
        exec(`start msedge http://localhost:${port}/login`)
      })
    }
  })
})