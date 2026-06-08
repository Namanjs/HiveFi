import { io, Socket } from 'socket.io-client';
import { StatusEvent } from './types';

export class SocketManager {
  private socket: Socket | null = null;
  private baseUrl: string;
  private onStatusUpdate?: (event: StatusEvent) => void;

  constructor(baseUrl: string, onStatusUpdate?: (event: StatusEvent) => void) {
    this.baseUrl = baseUrl;
    this.onStatusUpdate = onStatusUpdate;
  }

  public connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.baseUrl, {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        resolve(this.socket!.id as string);
      });

      this.socket.on('connect_error', (err: any) => {
        reject(new Error(`Socket connection error: ${err.message}`));
      });

      if (this.onStatusUpdate) {
        this.socket.on('STATUS_UPDATE', (payload: any) => {
          this.onStatusUpdate!(payload as StatusEvent);
        });
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
