/**
 * Worker entry: upgrades /ws?room=CODE&id=...&name=... to a WebSocket and
 * forwards the connection to that team's DungeonRoom Durable Object.
 */
import { DungeonRoom } from './room';

export { DungeonRoom };

export interface Env {
  DUNGEON_ROOMS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    }

    const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(roomCode)) {
      return new Response('bad room', { status: 400 });
    }

    // WebSocket upgrade → hand over to the room's Durable Object.
    const upgradeHeader = request.headers.get('Upgrade') || '';
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const id = env.DUNGEON_ROOMS.idFromName(roomCode);
    const stub = env.DUNGEON_ROOMS.get(id);
    return stub.fetch(request);
  },
};
