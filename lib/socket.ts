import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (!socket) {
    socket = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => {
      console.log('Socket.IO connected')
    })

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error)
    })
  }

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

