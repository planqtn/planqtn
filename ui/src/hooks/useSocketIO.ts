import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketIOOptions {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: any) => void;
}

export const useSocketIO = (options: SocketIOOptions = {}) => {
    const socketRef = useRef<Socket | null>(null);

    const connect = useCallback(() => {
        if (socketRef.current?.connected) {
            console.log('Socket already connected');
            return;
        }

        socketRef.current = io('/', {
            path: '/socket.io',
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            options.onConnect?.();
        });

        socketRef.current.on('disconnect', () => {
            console.log('Socket disconnected');
            options.onDisconnect?.();
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            options.onError?.(error);
        });
    }, [options]);

    const joinRoom = useCallback((roomId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('join_room', { room_id: roomId });
        }
    }, []);

    const leaveRoom = useCallback((roomId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('leave_room', { room_id: roomId });
        }
    }, []);

    useEffect(() => {
        connect();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [connect]);

    return {
        socket: socketRef.current,
        joinRoom,
        leaveRoom,
    };
}; 