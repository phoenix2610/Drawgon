import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  TLSocketRoom,
  TLSyncErrorCloseEventCode,
  TLSyncErrorCloseEventReason,
  type RoomSnapshot,
} from '@tldraw/sync-core';
import type { TLRecord, TLStoreSnapshot } from '@tldraw/tlschema';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { Board } from '../../../database/entities/board.entity';
import { auth } from '../../../common/auth/auth.instance';
import { getFrontendOrigins } from '../../../config/frontend-origins';
import { BoardAccessService, isUuid } from '../board-access.service';
import { boardSchema } from './board-schema';

interface SessionMeta {
  userId: string;
}

type Room = TLSocketRoom<TLRecord, SessionMeta>;

const SYNC_PATH = /^\/sync\/([^/?]+)(?:\?(.*))?$/;
const PERSIST_DELAY_MS = 2000;
const MAX_MESSAGE_BYTES = 50 * 1024 * 1024;

@Injectable()
export class BoardSyncService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BoardSyncService.name);
  private readonly wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  private readonly rooms = new Map<string, Promise<Room>>();
  private readonly persistTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingWrites = new Map<string, Promise<void>>();

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    private readonly access: BoardAccessService,
  ) {}

  onApplicationBootstrap() {
    const server = this.adapterHost.httpAdapter.getHttpServer() as Server;
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head) => {
      const match = SYNC_PATH.exec(req.url ?? '');
      if (!match) return;

      const origin = req.headers.origin;
      if (origin && !getFrontendOrigins().includes(origin)) {
        socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        const sessionId = new URLSearchParams(match[2] ?? '').get('sessionId');
        void this.handleConnection(
          ws,
          req,
          decodeURIComponent(match[1]),
          sessionId,
        );
      });
    });
  }

  async onApplicationShutdown() {
    await Promise.all(
      [...this.rooms.keys()].map((boardId) => this.persist(boardId)),
    );
    await Promise.all(this.pendingWrites.values());
  }

  async flush(boardId: string): Promise<void> {
    await this.persist(boardId);
    await this.pendingWrites.get(boardId);
  }

  async revalidate(boardId: string): Promise<void> {
    const room = await this.rooms.get(boardId)?.catch(() => null);
    if (!room) return;
    for (const session of room.getSessions()) {
      const result = await this.access.resolve(boardId, session.meta.userId);
      if (!result) {
        room.closeSession(
          session.sessionId,
          TLSyncErrorCloseEventReason.FORBIDDEN,
        );
      } else if ((result.role === 'viewer') !== session.isReadonly) {
        room.closeSession(session.sessionId);
      }
    }
  }

  async discard(boardId: string): Promise<void> {
    const pending = this.rooms.get(boardId);
    if (!pending) return;
    this.rooms.delete(boardId);
    this.clearPersistTimer(boardId);
    const room = await pending.catch(() => null);
    if (!room) return;
    for (const session of room.getSessions()) {
      room.closeSession(
        session.sessionId,
        TLSyncErrorCloseEventReason.NOT_FOUND,
      );
    }
    room.close();
  }

  private async handleConnection(
    ws: WebSocket,
    req: IncomingMessage,
    boardId: string,
    sessionId: string | null,
  ) {
    const early: string[] = [];
    const buffer = (data: RawData) => early.push(rawToString(data));
    ws.on('message', buffer);

    const reject = (reason: string) => {
      ws.off('message', buffer);
      ws.close(TLSyncErrorCloseEventCode, reason);
    };

    if (!sessionId || !isUuid(boardId)) {
      return reject(TLSyncErrorCloseEventReason.NOT_FOUND);
    }

    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: req.headers.cookie ?? '' }),
      });
      userId = session?.user.id ?? null;
    } catch {
      userId = null;
    }
    if (!userId) return reject(TLSyncErrorCloseEventReason.NOT_AUTHENTICATED);

    const result = await this.access.resolve(boardId, userId);
    if (!result) return reject(TLSyncErrorCloseEventReason.NOT_FOUND);
    if (ws.readyState !== WebSocket.OPEN) return;

    let room: Room;
    try {
      room = await this.getRoom(boardId);
    } catch (error) {
      this.logger.error(`Could not open board ${boardId}`, error as Error);
      return reject(TLSyncErrorCloseEventReason.UNKNOWN_ERROR);
    }
    if (ws.readyState !== WebSocket.OPEN) return;

    ws.off('message', buffer);
    room.handleSocketConnect({
      sessionId,
      socket: ws,
      isReadonly: result.role === 'viewer',
      meta: { userId },
    });
    for (const message of early) room.handleSocketMessage(sessionId, message);
  }

  private getRoom(boardId: string): Promise<Room> {
    let room = this.rooms.get(boardId);
    if (!room) {
      room = this.openRoom(boardId);
      this.rooms.set(boardId, room);
      room.catch(() => this.rooms.delete(boardId));
    }
    return room;
  }

  private async openRoom(boardId: string): Promise<Room> {
    await this.pendingWrites.get(boardId);
    const board = await this.boardsRepository.findOne({
      where: { id: boardId },
      select: { id: true, snapshot: true },
    });
    if (!board) throw new Error(`Board ${boardId} not found`);

    return new TLSocketRoom<TLRecord, SessionMeta>({
      schema: boardSchema,
      initialSnapshot: toStoreSnapshot(board.snapshot),
      onDataChange: () => this.schedulePersist(boardId),
      onSessionRemoved: (_room, { numSessionsRemaining }) => {
        if (numSessionsRemaining === 0) void this.closeIdleRoom(boardId);
      },
      log: {
        warn: (...args: unknown[]) => this.logger.warn(args.join(' ')),
        error: (...args: unknown[]) => this.logger.error(args.join(' ')),
      },
    });
  }

  private async closeIdleRoom(boardId: string) {
    const pending = this.rooms.get(boardId);
    const room = await pending?.catch(() => null);
    if (!room || room.getNumActiveSessions() > 0) return;
    if (this.rooms.get(boardId) !== pending) return;
    this.rooms.delete(boardId);
    this.clearPersistTimer(boardId);
    this.write(boardId, room.getCurrentSnapshot());
    room.close();
  }

  private schedulePersist(boardId: string) {
    if (this.persistTimers.has(boardId)) return;
    this.persistTimers.set(
      boardId,
      setTimeout(() => void this.persist(boardId), PERSIST_DELAY_MS),
    );
  }

  private clearPersistTimer(boardId: string) {
    clearTimeout(this.persistTimers.get(boardId));
    this.persistTimers.delete(boardId);
  }

  private async persist(boardId: string) {
    this.clearPersistTimer(boardId);
    const room = await this.rooms.get(boardId)?.catch(() => null);
    if (room) this.write(boardId, room.getCurrentSnapshot());
  }

  private write(boardId: string, snapshot: RoomSnapshot) {
    const previous = this.pendingWrites.get(boardId) ?? Promise.resolve();
    const next = previous
      .then(() =>
        this.boardsRepository.update({ id: boardId }, {
          snapshot: fromRoomSnapshot(snapshot),
        } as QueryDeepPartialEntity<Board>),
      )
      .then(
        () => undefined,
        (error: Error) =>
          this.logger.error(`Could not save board ${boardId}`, error),
      )
      .finally(() => {
        if (this.pendingWrites.get(boardId) === next) {
          this.pendingWrites.delete(boardId);
        }
      });
    this.pendingWrites.set(boardId, next);
  }
}

function rawToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

function toStoreSnapshot(
  snapshot: Record<string, unknown> | null,
): TLStoreSnapshot | undefined {
  if (!snapshot) return undefined;
  const document = (snapshot.document ?? snapshot) as Partial<TLStoreSnapshot>;
  if (!document.store || !document.schema) return undefined;
  return document as TLStoreSnapshot;
}

function fromRoomSnapshot(snapshot: RoomSnapshot): Record<string, unknown> {
  const store = Object.fromEntries(
    snapshot.documents.map(({ state }) => [state.id, state]),
  );
  return {
    document: {
      store,
      schema: snapshot.schema ?? boardSchema.serialize(),
    },
  };
}
