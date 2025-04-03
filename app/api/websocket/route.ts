import { createServer } from 'http';
import { Server } from 'socket.io';
import { NextApiResponseServerIO } from '@/types/next';
import { query } from '@/lib/db';

const ioHandler = (req: Request, res: NextApiResponseServerIO) => {
    if (!res.socket.server.io) {
        const httpServer = createServer();
        const io = new Server(httpServer, {
            path: '/api/websocket',
            addTrailingSlash: false,
        });

        io.on('connection', (socket) => {
            console.log('Client connected');

            socket.on('disconnect', () => {
                console.log('Client disconnected');
            });
        });

        res.socket.server.io = io;
    }

    res.end();
};

export const GET = ioHandler;
export const POST = ioHandler; 