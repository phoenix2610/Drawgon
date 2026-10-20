import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from '../../database/entities/follow.entity';
import { BoardCollaborator } from '../../database/entities/board-collaborator.entity';

export interface NotificationDto {
  id: string;
  type: 'follow' | 'collab_invite' | 'collab_joined' | 'board_updated' | 'info';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly readNotifs = new Map<string, Set<string>>();

  constructor(
    @InjectRepository(Follow)
    private readonly followsRepo: Repository<Follow>,
    @InjectRepository(BoardCollaborator)
    private readonly collabsRepo: Repository<BoardCollaborator>,
  ) {}

  async getUserNotifications(userId: string): Promise<NotificationDto[]> {
    const userReadSet = this.readNotifs.get(userId) ?? new Set<string>();

    const follows = await this.followsRepo.find({
      where: { followingId: userId },
      relations: { follower: true },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const followNotifs: NotificationDto[] = follows.map((f) => {
      const id = `follow-${f.followerId}-${new Date(f.createdAt).getTime()}`;
      return {
        id,
        type: 'follow',
        title: `${f.follower?.name || 'Someone'} started following you`,
        body: 'Check out their profile and creations.',
        createdAt: new Date(f.createdAt).toISOString(),
        read: userReadSet.has(id),
        link: `/users/${f.followerId}`,
      };
    });

    const collabs = await this.collabsRepo.find({
      where: { userId },
      relations: { board: { owner: true } },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const collabNotifs: NotificationDto[] = collabs.map((c) => {
      const id = `collab-${c.boardId}-${new Date(c.createdAt).getTime()}`;
      return {
        id,
        type: 'collab_invite',
        title: `${c.board?.owner?.name || 'Someone'} invited you to "${c.board?.title || 'Untitled board'}"`,
        body: `You can ${c.role === 'editor' ? 'edit' : 'view'} this board. Open it to start collaborating.`,
        createdAt: new Date(c.createdAt).toISOString(),
        read: userReadSet.has(id),
        link: `/boards/${c.boardId}`,
      };
    });

    const joins = await this.collabsRepo.find({
      where: { board: { ownerId: userId } },
      relations: { board: true, user: true },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const joinNotifs: NotificationDto[] = joins
      .filter((c) => c.userId !== userId)
      .map((c) => {
        const opened = c.lastOpenedAt ? new Date(c.lastOpenedAt) : null;
        const id = `joined-${c.boardId}-${c.userId}-${new Date(c.createdAt).getTime()}-${opened ? 'opened' : 'sent'}`;
        return {
          id,
          type: 'collab_joined' as const,
          title: opened
            ? `${c.user?.name || 'Someone'} opened "${c.board?.title || 'Untitled board'}"`
            : `Invite sent to ${c.user?.name || 'Someone'}`,
          body: opened
            ? `Your invite was received. They can ${c.role === 'editor' ? 'edit' : 'view'} the board.`
            : `They've been notified and can ${c.role === 'editor' ? 'edit' : 'view'} "${c.board?.title || 'Untitled board'}". We'll tell you when they open it.`,
          createdAt: (opened ?? new Date(c.createdAt)).toISOString(),
          read: userReadSet.has(id),
          link: `/boards/${c.boardId}`,
        };
      });

    const all = [...followNotifs, ...collabNotifs, ...joinNotifs];
    all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return all;
  }

  markAsRead(userId: string, notifId: string): { success: boolean } {
    if (!this.readNotifs.has(userId)) {
      this.readNotifs.set(userId, new Set());
    }
    this.readNotifs.get(userId)!.add(notifId);
    return { success: true };
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean }> {
    const notifs = await this.getUserNotifications(userId);
    if (!this.readNotifs.has(userId)) {
      this.readNotifs.set(userId, new Set());
    }
    const set = this.readNotifs.get(userId)!;
    for (const n of notifs) {
      set.add(n.id);
    }
    return { success: true };
  }
}
