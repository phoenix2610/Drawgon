import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board, BoardVisibility } from '../../database/entities/board.entity';
import { BoardCollaborator } from '../../database/entities/board-collaborator.entity';

export type BoardRole = 'owner' | 'editor' | 'viewer';

const RANK: Record<BoardRole, number> = { viewer: 1, editor: 2, owner: 3 };

export function canEdit(role: BoardRole | null): boolean {
  return role === 'owner' || role === 'editor';
}

@Injectable()
export class BoardAccessService {
  constructor(
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    @InjectRepository(BoardCollaborator)
    private readonly collaboratorsRepository: Repository<BoardCollaborator>,
  ) {}

  async resolve(
    boardId: string,
    userId: string,
  ): Promise<{ board: Board; role: BoardRole } | null> {
    if (!isUuid(boardId)) return null;
    const board = await this.boardsRepository.findOne({
      where: { id: boardId },
      relations: { owner: true },
    });
    if (!board) return null;
    if (board.ownerId === userId) return { board, role: 'owner' };

    const roles: BoardRole[] = [];
    const invite = await this.collaboratorsRepository.findOneBy({
      boardId,
      userId,
    });
    if (invite) roles.push(invite.role === 'editor' ? 'editor' : 'viewer');
    if (board.visibility === BoardVisibility.PUBLIC) roles.push('viewer');

    if (roles.length === 0) return null;
    const role = roles.reduce((best, r) => (RANK[r] > RANK[best] ? r : best));
    return { board, role };
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
