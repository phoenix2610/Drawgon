import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  BoardCollaborator,
  type CollaboratorRole,
} from '../../database/entities/board-collaborator.entity';
import { Board } from '../../database/entities/board.entity';
import { User } from '../../database/entities/user.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';
import { BoardAccessService, isUuid } from './board-access.service';
import { BoardSyncService } from './sync/board-sync.service';

const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CollaboratorSummary {
  userId: string;
  name: string;

  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: 'owner' | CollaboratorRole;
  addedAt: Date | null;
}

interface InviteLinkPayload {
  b: string;
  r: CollaboratorRole;
  e: number;
}

@Injectable()
export class CollaboratorsService {
  constructor(
    @InjectRepository(BoardCollaborator)
    private readonly collabsRepo: Repository<BoardCollaborator>,
    @InjectRepository(Board)
    private readonly boardsRepo: Repository<Board>,
    @InjectRepository(UserProfile)
    private readonly profilesRepo: Repository<UserProfile>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly access: BoardAccessService,
    private readonly sync: BoardSyncService,
  ) {}

  async list(
    boardId: string,
    currentUserId: string,
  ): Promise<CollaboratorSummary[]> {
    const result = await this.access.resolve(boardId, currentUserId);
    if (!result) throw new NotFoundException('Board not found');
    const isOwner = result.role === 'owner';

    const collabs = await this.collabsRepo.find({
      where: { boardId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    const userIds = [result.board.ownerId, ...collabs.map((c) => c.userId)];
    const profiles = await this.profilesRepo.find({
      where: { userId: In(userIds) },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const owner = result.board.owner;
    const ownerProfile = profileMap.get(result.board.ownerId);
    return [
      {
        userId: result.board.ownerId,
        name: owner?.name || 'Unknown',
        email: isOwner ? (owner?.email ?? null) : null,
        username: ownerProfile?.username ?? null,
        avatarUrl: ownerProfile?.avatarUrl ?? null,
        role: 'owner' as const,
        addedAt: null,
      },
      ...collabs.map((c) => {
        const profile = profileMap.get(c.userId);
        return {
          userId: c.userId,
          name: c.user?.name || 'Unknown',
          email: isOwner ? (c.user?.email ?? null) : null,
          username: profile?.username ?? null,
          avatarUrl: profile?.avatarUrl ?? null,
          role: c.role,
          addedAt: c.createdAt,
        };
      }),
    ];
  }

  async invite(
    boardId: string,
    currentUserId: string,
    target: { username?: string; email?: string },
    role: CollaboratorRole,
  ): Promise<CollaboratorSummary[]> {
    await this.findOwnedOrFail(boardId, currentUserId);
    const userId = await this.findUserId(target);
    if (userId === currentUserId) {
      throw new BadRequestException('You already own this board.');
    }

    const existing = await this.collabsRepo.findOneBy({ boardId, userId });
    if (existing) {
      existing.role = role;
      await this.collabsRepo.save(existing);
    } else {
      await this.collabsRepo.save(
        this.collabsRepo.create({ boardId, userId, role }),
      );
    }
    await this.sync.revalidate(boardId);
    return this.list(boardId, currentUserId);
  }

  async updateRole(
    boardId: string,
    currentUserId: string,
    userId: string,
    role: CollaboratorRole,
  ): Promise<CollaboratorSummary[]> {
    await this.findOwnedOrFail(boardId, currentUserId);
    const collab = await this.collabsRepo.findOneBy({ boardId, userId });
    if (!collab) {
      throw new NotFoundException('That person is not on this board.');
    }
    collab.role = role;
    await this.collabsRepo.save(collab);
    await this.sync.revalidate(boardId);
    return this.list(boardId, currentUserId);
  }

  async remove(boardId: string, currentUserId: string, userId: string) {
    const board = isUuid(boardId)
      ? await this.boardsRepo.findOneBy({ id: boardId })
      : null;
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== currentUserId && userId !== currentUserId) {
      throw new ForbiddenException('Only the board owner can remove people.');
    }
    await this.collabsRepo.delete({ boardId, userId });
    await this.sync.revalidate(boardId);
  }

  async generateInviteLink(
    boardId: string,
    currentUserId: string,
    role: CollaboratorRole,
  ): Promise<{ token: string; expiresAt: number }> {
    await this.findOwnedOrFail(boardId, currentUserId);
    const payload: InviteLinkPayload = {
      b: boardId,
      r: role,
      e: Date.now() + INVITE_LINK_TTL_MS,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return { token: `${body}.${sign(body)}`, expiresAt: payload.e };
  }

  async joinViaToken(token: string, userId: string) {
    const payload = verifyInviteToken(token);
    if (!payload) {
      throw new NotFoundException(
        'This invite link is invalid or has expired.',
      );
    }

    const board = await this.boardsRepo.findOneBy({ id: payload.b });
    if (!board) throw new NotFoundException('This board no longer exists.');
    if (board.ownerId === userId) {
      return { boardId: board.id, alreadyOwner: true };
    }

    const existing = await this.collabsRepo.findOneBy({
      boardId: board.id,
      userId,
    });
    if (!existing) {
      await this.collabsRepo.save(
        this.collabsRepo.create({
          boardId: board.id,
          userId,
          role: payload.r,
        }),
      );
    } else if (existing.role === 'viewer' && payload.r === 'editor') {
      existing.role = 'editor';
      await this.collabsRepo.save(existing);
      await this.sync.revalidate(board.id);
    }
    return { boardId: board.id };
  }

  private async findUserId(target: {
    username?: string;
    email?: string;
  }): Promise<string> {
    const username = target.username?.trim().replace(/^@/, '');
    const email = target.email?.trim();

    if (email) {
      const user = await this.usersRepo
        .createQueryBuilder('u')
        .where('LOWER(u.email) = LOWER(:email)', { email })
        .getOne();
      if (user) return user.id;
      throw new NotFoundException(
        `No Drawgon account uses ${email}. Ask them to sign up first.`,
      );
    }
    if (username) {
      const profile = await this.profilesRepo
        .createQueryBuilder('p')
        .where('LOWER(p.username) = LOWER(:username)', { username })
        .getOne();
      if (profile) return profile.userId;
      throw new NotFoundException(`No one has the username @${username}.`);
    }
    throw new BadRequestException('Enter a username or an email address.');
  }

  private async findOwnedOrFail(boardId: string, ownerId: string) {
    const board = isUuid(boardId)
      ? await this.boardsRepo.findOneBy({ id: boardId, ownerId })
      : null;
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }
}

function sign(body: string): string {
  return createHmac('sha256', inviteSecret())
    .update(`board-invite:${body}`)
    .digest('base64url');
}

function inviteSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
  return secret;
}

export function verifyInviteToken(token: string): InviteLinkPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as InviteLinkPayload;
    if (
      !isUuid(payload.b) ||
      (payload.r !== 'editor' && payload.r !== 'viewer')
    ) {
      return null;
    }
    return payload.e > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
