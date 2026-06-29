import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' }
})

interface Room {
  hostId: string | null
  viewers: Set<string>
}

const rooms: Record<string, Room> = {}

const generateRoomId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

app.get('/create-room', (req, res) => {
  let id: string
  do { id = generateRoomId() } while (rooms[id])
  rooms[id] = { hostId: null, viewers: new Set() }
  res.json({ roomId: id })
})

io.on('connection', (socket) => {
  console.log('conectado:', socket.id)

  socket.on('join-as-host', (roomId: string) => {
    if (!rooms[roomId]) return socket.emit('error', 'Sala não encontrada')
    rooms[roomId].hostId = socket.id
    socket.join(roomId)
    console.log(`Host ${socket.id} entrou em ${roomId}`)
  })

  socket.on('join-as-viewer', (roomId: string) => {
    if (!rooms[roomId]) return socket.emit('error', 'Sala não encontrada')
    rooms[roomId].viewers.add(socket.id)
    socket.join(roomId)
    socket.emit('viewer-joined', roomId)
    const hostId = rooms[roomId].hostId
    if (hostId) socket.to(hostId).emit('new-viewer', socket.id)
    console.log(`Viewer ${socket.id} entrou em ${roomId}`)
  })

  socket.on('signal', ({ to, signal }: { to: string; signal: unknown }) => {
    io.to(to).emit('signal', { from: socket.id, signal })
  })

  socket.on('disconnect', () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.hostId === socket.id) {
        io.to(roomId).emit('host-disconnected')
        delete rooms[roomId]
      } else {
        room.viewers.delete(socket.id)
      }
    }
    console.log('desconectado:', socket.id)
  })
})

server.listen(3001, () => console.log('Servidor rodando em http://localhost:3001'))