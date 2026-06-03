// pages/api/socket.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { Server } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import type { Socket as NetSocket } from 'net'

interface SocketServer extends HTTPServer {
  io?: InstanceType<typeof Server>
}
interface SocketWithIO extends NetSocket {
  server: SocketServer
}
interface ResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

declare global {
  var io: InstanceType<typeof Server> | undefined
}

export const config = { api: { bodyParser: false } }

export default function handler(req: NextApiRequest, res: ResponseWithSocket) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path:             '/api/socket',
      addTrailingSlash: false,
    })
    res.socket.server.io = io
    global.io = io

    io.on('connection', socket => {
      // Join role-based room for broadcast notifications (e.g. 'ADMIN', 'BIOTECHNOLOGIST')
      socket.on('join-role', (role: string) => {
        socket.join(role)
      })


      socket.on('join-user', (userId: string) => {
        socket.join(`user_${userId}`)
      })
    })
  }
  res.end()
}