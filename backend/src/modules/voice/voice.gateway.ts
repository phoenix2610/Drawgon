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
import { getFrontendOrigins } from '../../config/frontend-origins';
import { BoardAccessService } from '../boards/board-access.service';

interface Peer {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
}

const rooms = new Map<string, Map<string, Peer>>();

const socketBoard = new Map<string, string>();

function roomName(boardId: string) {
  return `voice:${boardId}`;
}

@WebSocketGateway({
  namespace: '/voice',
  cors: {
    origin: getFrontendOrigins(),
    credentials: true,
  },
})
export class VoiceGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(VoiceGateway.name);

  constructor(private readonly access: BoardAccessService) {}

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
    if (!(await this.access.resolve(boardId, user.id))) {
      return { error: 'You do not have access to this board.' };
    }

    this.removeFromRoom(client);

    const peers = rooms.get(boardId) ?? new Map<string, Peer>();
    rooms.set(boardId, peers);

    const me: Peer = {
      socketId: client.id,
      userId: user.id,
      name: user.name || user.email || 'Someone',
      muted: false,
    };

    const existing = [...peers.values()];
    peers.set(client.id, me);

    socketBoard.set(client.id, boardId);
    await client.join(roomName(boardId));
    client.to(roomName(boardId)).emit('peer-joined', me);

    this.logger.log(`${me.name} joined voice on board ${boardId}`);
    return { self: me, peers: existing };
  }

  @SubscribeMessage('signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { to?: string; data?: unknown },
  ) {
    const boardId = socketBoard.get(client.id);
    if (!body?.to || !boardId || socketBoard.get(body.to) !== boardId) return;
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
