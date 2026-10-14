import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Board, BoardVisibility } from '../../database/entities/board.entity';
import { BoardCollaborator } from '../../database/entities/board-collaborator.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardThumbnailDto } from './dto/update-board-thumbnail.dto';
import { UpdateBoardVisibilityDto } from './dto/update-board-visibility.dto';
import { RenameBoardDto } from './dto/rename-board.dto';
import { PublishBoardDto } from './dto/publish-board.dto';
import {
  BoardAccessService,
  canEdit,
  type BoardRole,
} from './board-access.service';
import { BoardSyncService } from './sync/board-sync.service';

export type BoardWithRole = Omit<
  Board,
  'owner' | 'community' | 'communities'
> & {
  role: BoardRole;
  ownerName: string;
};

export interface SharedBoardSummary extends Omit<BoardWithRole, 'snapshot'> {
  role: BoardRole;
}

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    @InjectRepository(BoardCollaborator)
    private readonly collaboratorsRepository: Repository<BoardCollaborator>,
    private readonly access: BoardAccessService,
    private readonly sync: BoardSyncService,
  ) {}

  async listByOwner(ownerId: string): Promise<Board[]> {
    return this.boardsRepository.find({
      where: { ownerId, publishedFromId: IsNull() },
      order: { updatedAt: 'DESC' },
    });
  }

  async listSharedWith(userId: string): Promise<SharedBoardSummary[]> {
    const invites = await this.collaboratorsRepository.find({
      where: { userId },
      relations: { board: { owner: true } },
    });
    return invites
      .filter((invite) => invite.board)
      .map((invite) => {
        const { snapshot: _snapshot, ...board } = toBoardWithRole(
          invite.board!,
          invite.role === 'editor' ? 'editor' : 'viewer',
        );
        return board;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async findOneOwnedBy(id: string, ownerId: string): Promise<Board> {
    const board = await this.boardsRepository.findOne({
      where: { id, ownerId },
    });
    if (!board) {
      throw new NotFoundException(`Board ${id} not found`);
    }
    return board;
  }

  async findAccessible(id: string, userId: string): Promise<BoardWithRole> {
    const result = await this.access.resolve(id, userId);
    if (!result) {
      throw new NotFoundException(`Board ${id} not found`);
    }
    return toBoardWithRole(result.board, result.role);
  }

  async create(ownerId: string, dto: CreateBoardDto): Promise<Board> {
    const board = this.boardsRepository.create({
      ownerId,
      title: dto.title,
      snapshot: {},
    });
    return this.boardsRepository.save(board);
  }

  async updateThumbnail(
    id: string,
    userId: string,
    dto: UpdateBoardThumbnailDto,
  ): Promise<void> {
    const result = await this.access.resolve(id, userId);
    if (!result) throw new NotFoundException(`Board ${id} not found`);
    if (!canEdit(result.role)) {
      throw new ForbiddenException('You can only view this board.');
    }
    await this.boardsRepository.update(
      { id },
      { thumbnailUrl: dto.thumbnail || null },
    );
  }

  async rename(
    id: string,
    ownerId: string,
    dto: RenameBoardDto,
  ): Promise<Board> {
    const board = await this.findOneOwnedBy(id, ownerId);
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Title cannot be blank.');
    }
    board.title = title;
    return this.boardsRepository.save(board);
  }

  async updateVisibility(
    id: string,
    ownerId: string,
    dto: UpdateBoardVisibilityDto,
  ): Promise<Board> {
    const board = await this.findOneOwnedBy(id, ownerId);
    if (dto.visibility === BoardVisibility.PRIVATE) {
      await this.boardsRepository.delete({
        publishedFromId: board.id,
        ownerId,
      });
    }
    board.visibility = dto.visibility;
    const saved = await this.boardsRepository.save(board);
    await this.sync.revalidate(id);
    return saved;
  }

  async publish(
    id: string,
    ownerId: string,
    dto: PublishBoardDto,
  ): Promise<Board> {
    await this.findOneOwnedBy(id, ownerId);
    const postTitle = dto.postTitle.trim();
    if (!postTitle) {
      throw new BadRequestException('Post title cannot be blank.');
    }

    await this.sync.flush(id);
    const board = await this.findOneOwnedBy(id, ownerId);

    const content = {
      title: board.title,
      snapshot: board.snapshot,
      thumbnailUrl: board.thumbnailUrl,
      postTitle,
      postDetails: dto.postDetails.trim() || null,
      postTags: dto.postTags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      postMedia: dto.postMedia,
    };

    const existing = await this.findPostOf(board.id);
    if (existing) {
      Object.assign(existing, content);
      return this.boardsRepository.save(existing);
    }

    return this.boardsRepository.save(
      this.boardsRepository.create({
        ...content,
        ownerId,
        publishedFromId: board.id,
        visibility: BoardVisibility.PUBLIC,
      }),
    );
  }

  async getPost(id: string, ownerId: string) {
    const board = await this.findOneOwnedBy(id, ownerId);
    const post = await this.findPostOf(board.id, true);
    if (!post) return null;
    return {
      id: post.id,
      postTitle: post.postTitle,
      postDetails: post.postDetails,
      postTags: post.postTags,
      postMedia: post.postMedia,
      updatedAt: post.updatedAt,
      communities: (post.communities ?? []).map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
      })),
    };
  }

  async listPostsByOwner(ownerId: string) {
    const posts = await this.boardsRepository.find({
      where: { ownerId, publishedFromId: Not(IsNull()) },
      relations: { communities: true },
      order: { updatedAt: 'DESC' },
    });
    const sourceIds = [...new Set(posts.map((p) => p.publishedFromId!))];
    const sources = sourceIds.length
      ? await this.boardsRepository.find({
          where: { id: In(sourceIds) },
          select: { id: true },
        })
      : [];
    const existing = new Set(sources.map((s) => s.id));
    return posts.map((post) => ({
      id: post.id,
      title: post.postTitle || post.title,
      thumbnailUrl: post.thumbnailUrl,
      updatedAt: post.updatedAt,
      sourceBoardId: existing.has(post.publishedFromId!)
        ? post.publishedFromId
        : null,
      communities: (post.communities ?? []).map((c) => ({
        id: c.id,
        slug: c.slug,
      })),
    }));
  }

  private findPostOf(boardId: string, withCommunities = false) {
    return this.boardsRepository.findOne({
      where: { publishedFromId: boardId },
      relations: withCommunities ? { communities: true } : undefined,
      order: { createdAt: 'ASC' },
    });
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const board = await this.findOneOwnedBy(id, ownerId);
    await this.sync.discard(id);
    await this.boardsRepository.remove(board);
  }
}

export function toBoardWithRole(board: Board, role: BoardRole): BoardWithRole {
  const {
    owner,
    community: _community,
    communities: _communities,
    ...rest
  } = board;
  return { ...rest, role, ownerName: owner?.name || owner?.email || 'Unknown' };
}
