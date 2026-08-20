import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { auth } from '../../common/auth/auth.instance';

interface Peer {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
}

/** boardId -> peers currently in that board's call. */
const rooms = new Map<string, Map<string, Peer>>();
/** socketId -> boardId, so a disconnect knows which room to clean up. */
const socketBoard = new Map<string, string>();

function roomName(boardId: string) {
  return `voice:${boardId}`;
}

/**
 * Signalling only. Audio itself flows peer-to-peer over WebRTC; this gateway
 * just introduces peers to each other and relays their SDP/ICE.
 */
@WebSocketGateway({
  namespace: '/voice',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class VoiceGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(VoiceGateway.name);

  /** Resolves the better-auth session from the handshake cookie. */
  private async getUser(client: Socket) {
    const cookie = client.handshake.headers.cookie;
    if (!cookie) return null;
    try {
      const session = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      return session?.user ?? null;
    } catch {
      return null;
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { boardId?: string },
  ) {
    const boardId = body?.boardId;
    if (!boardId) return { error: 'boardId is required' };

    const user = await this.getUser(client);
    if (!user) return { error: 'Not authenticated' };

    const peers = rooms.get(boardId) ?? new Map<string, Peer>();
    rooms.set(boardId, peers);

    const me: Peer = {
      socketId: client.id,
      userId: user.id,
      name: user.name || user.email || 'Someone',
      muted: false,
    };

    // Hand the newcomer the existing roster before announcing them, so the
    // two sides never both try to initiate the same connection.
    const existing = [...peers.values()];
    peers.set(client.id, me);

    socketBoard.set(client.id, boardId);
    await client.join(roomName(boardId));
    client.to(roomName(boardId)).emit('peer-joined', me);

    this.logger.log(`${me.name} joined voice on board ${boardId}`);
    return { self: me, peers: existing };
  }

  /** Relays an offer/answer/ICE candidate to one specific peer. */
  @SubscribeMessage('signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { to?: string; data?: unknown },
  ) {
    if (!body?.to) return;
    this.server
      .to(body.to)
      .emit('signal', { from: client.id, data: body.data });
  }

  @SubscribeMessage('mute')
  handleMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { muted?: boolean },
  ) {
    const boardId = socketBoard.get(client.id);
    if (!boardId) return;
    const peer = rooms.get(boardId)?.get(client.id);
    if (!peer) return;
    peer.muted = Boolean(body?.muted);
    client
      .to(roomName(boardId))
      .emit('peer-muted', { socketId: client.id, muted: peer.muted });
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket) {
    this.removeFromRoom(client);
  }

  handleDisconnect(client: Socket) {
    this.removeFromRoom(client);
  }

  private removeFromRoom(client: Socket) {
    const boardId = socketBoard.get(client.id);
    if (!boardId) return;

    const peers = rooms.get(boardId);
    if (peers?.delete(client.id) && peers.size === 0) {
      rooms.delete(boardId);
    }

    client.to(roomName(boardId)).emit('peer-left', { socketId: client.id });
    void client.leave(roomName(boardId));
    socketBoard.delete(client.id);
  }
}
