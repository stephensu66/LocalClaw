import type { Response } from 'express';
import { randomUUID } from 'crypto';

export interface SseEvent {
  type: string;
  payload: unknown;
}

export class SseHub {
  private clients = new Map<string, Response>();

  addClient(res: Response): string {
    const id = randomUUID();
    this.clients.set(id, res);
    res.write(': connected\n\n');
    return id;
  }

  removeClient(id: string): void {
    const res = this.clients.get(id);
    if (res) {
      res.end();
    }
    this.clients.delete(id);
  }

  broadcast(event: SseEvent): void {
    const data = `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
    for (const res of this.clients.values()) {
      res.write(data);
    }
  }
}
