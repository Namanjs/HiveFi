import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketResult {
  socket: Socket | null;
  socketId: string | null;
  isConnected: boolean;
}

export function useSocket(serverUrl: string = "http://localhost:3001"): UseSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const socketInstance: Socket = io(serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketInstance.on("connect", () => {
      console.log("Connected to WebSocket Server:", socketInstance.id);
      setIsConnected(true);
      setSocketId(socketInstance.id || null);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("Disconnected from WebSocket Server:", reason);
      setIsConnected(false);
      setSocketId(null);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connect_error:", error.message);
      setIsConnected(false);
    });

    socketInstance.on("reconnect_attempt", (attempt) => {
      console.log(`Socket reconnect_attempt: ${attempt}`);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [serverUrl]);

  return { socket, socketId, isConnected };
}
