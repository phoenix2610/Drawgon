import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, In, Repository } from 'typeorm';
import { Board, BoardVisibility } from '../../database/entities/board.entity';
import { BoardCommunity } from '../../database/entities/board-community.entity';
import { Community } from '../../database/entities/community.entity';
import {
  CommunityMember,
  CommunityRole,
} from '../../database/entities/community-member.entity';
import { CommunityService, type FeedItem } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { isUuid } from '../boards/board-access.service';

export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  memberCount: number;
  boardCount: number;
  joined: boolean;
  role: CommunityRole | null;
  createdAt: Date;
}

const RESERVED_SLUGS = new Set([
  'new',
  'all',
  'popular',
  'create',
  'search',
  'admin',
  'settings',
  'boards',
  'community',
  'communities',
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])$/;

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(Community)
    private readonly communitiesRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly membersRepository: Repository<CommunityMember>,
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    @InjectRepository(BoardCommunity)
    private readonly boardCommunitiesRepository: Repository<BoardCommunity>,
    private readonly communityService: CommunityService,
  ) {}

  async list(
    currentUserId: string,
    query?: string,
  ): Promise<CommunitySummary[]> {
    const term = query?.trim();
    const where = term
      ? [
          { name: ILike(`%${term}%`) },
          { slug: ILike(`%${term}%`) },
          { description: ILike(`%${term}%`) },
        ]
      : {};

    const communities = await this.communitiesRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return this.summarise(communities, currentUserId);
  }

  async listMine(currentUserId: string): Promise<CommunitySummary[]> {
    const memberships = await this.membersRepository.find({
      where: { userId: currentUserId },
    });
    if (memberships.length === 0) return [];

    const communities = await this.communitiesRepository.find({
      where: { id: In(memberships.map((m) => m.communityId)) },
    });
    return this.summarise(communities, currentUserId);
  }

  async getBySlug(
    slug: string,
    currentUserId: string,
  ): Promise<CommunitySummary> {
    const community = await this.findBySlugOrFail(slug);
    const [summary] = await this.summarise([community], currentUserId);
    return summary;
  }

  async create(
    currentUserId: string,
    dto: CreateCommunityDto,
  ): Promise<CommunitySummary> {
    const slug = dto.slug.trim().toLowerCase();

    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException(
        'Handle must be 3-32 characters: lowercase letters, numbers, hyphens or underscores, starting and ending alphanumeric.',
      );
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new BadRequestException(`d/${slug} is reserved.`);
    }
    if (await this.communitiesRepository.existsBy({ slug })) {
      throw new ConflictException(`d/${slug} already exists.`);
    }

    const community = await this.communitiesRepository.save(
      this.communitiesRepository.create({
        slug,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdBy: currentUserId,
      }),
    );

    await this.membersRepository.save(
      this.membersRepository.create({
        communityId: community.id,
        userId: currentUserId,
        role: CommunityRole.OWNER,
      }),
    );

    const [summary] = await this.summarise([community], currentUserId);
    return summary;
  }

  async join(slug: string, currentUserId: string): Promise<CommunitySummary> {
    const community = await this.findBySlugOrFail(slug);
    const existing = await this.membersRepository.findOneBy({
      communityId: community.id,
      userId: currentUserId,
    });
    if (!existing) {
      await this.membersRepository.save(
        this.membersRepository.create({
          communityId: community.id,
          userId: currentUserId,
          role: CommunityRole.MEMBER,
        }),
      );
    }
    const [summary] = await this.summarise([community], currentUserId);
    return summary;
  }

  async leave(slug: string, currentUserId: string): Promise<CommunitySummary> {
    const community = await this.findBySlugOrFail(slug);
    const membership = await this.membersRepository.findOneBy({
      communityId: community.id,
      userId: currentUserId,
    });

    if (membership?.role === CommunityRole.OWNER) {
      throw new ForbiddenException(
        'Owners cannot leave their own community. Transfer ownership or delete it instead.',
      );
    }
    if (membership) {
      await this.membersRepository.remove(membership);
    }

    const [summary] = await this.summarise([community], currentUserId);
    return summary;
  }

  async remove(slug: string, currentUserId: string): Promise<void> {
    const community = await this.findBySlugOrFail(slug);
    const membership = await this.membersRepository.findOneBy({
      communityId: community.id,
      userId: currentUserId,
    });

    if (membership?.role !== CommunityRole.OWNER) {
      throw new ForbiddenException('Only the community owner can delete it.');
    }

    await this.communitiesRepository.manager.transaction(async (manager) => {
      const postIds = await this.postsOnlyIn(community.id, manager);
      await manager.delete(Community, { id: community.id });
      if (postIds.length > 0) {
        await manager.delete(Board, { id: In(postIds) });
      }
    });
  }

  async removeBoard(
    slug: string,
    boardId: string,
    currentUserId: string,
  ): Promise<void> {
    const community = await this.findBySlugOrFail(slug);
    const board = isUuid(boardId)
      ? await this.boardsRepository.findOneBy({ id: boardId })
      : null;
    const filed =
      board &&
      (board.communityId === community.id ||
        (await this.boardCommunitiesRepository.existsBy({
          boardId,
          communityId: community.id,
        })));
    if (!board || !filed) {
      throw new NotFoundException(`That board is not in d/${community.slug}.`);
    }

    const membership = await this.membersRepository.findOneBy({
      communityId: community.id,
      userId: currentUserId,
    });
    const moderates =
      membership?.role === CommunityRole.OWNER ||
      membership?.role === CommunityRole.MODERATOR;
    if (board.ownerId !== currentUserId && !moderates) {
      throw new ForbiddenException(
        'Only the author or a community moderator can remove this post.',
      );
    }

    await this.boardsRepository.manager.transaction(async (manager) => {
      const orphaned = (await this.postsOnlyIn(community.id, manager)).includes(
        boardId,
      );
      await manager.delete(BoardCommunity, {
        boardId,
        communityId: community.id,
      });
      if (board.communityId === community.id) {
        const next = await manager.findOneBy(BoardCommunity, { boardId });
        await manager.update(
          Board,
          { id: boardId },
          { communityId: next?.communityId ?? null },
        );
      }
      if (orphaned) await manager.delete(Board, { id: boardId });
    });
  }

  private async postsOnlyIn(
    communityId: string,
    manager: EntityManager,
  ): Promise<string[]> {
    const rows: { id: string }[] = await manager.query(
      `SELECT b.id
         FROM boards b
        WHERE b.published_from_id IS NOT NULL
          AND (b.community_id = $1
               OR EXISTS (SELECT 1 FROM board_communities bc
                           WHERE bc.board_id = b.id AND bc.community_id = $1))
          AND NOT EXISTS (SELECT 1 FROM board_communities bc
                           WHERE bc.board_id = b.id AND bc.community_id <> $1)
          AND (b.community_id IS NULL OR b.community_id = $1)`,
      [communityId],
    );
    return rows.map((row) => row.id);
  }

  async listBoards(slug: string, currentUserId: string): Promise<FeedItem[]> {
    const community = await this.findBySlugOrFail(slug);
    const boards = await this.boardsRepository
      .createQueryBuilder('board')
      .leftJoin(
        'board_communities',
        'boardCommunity',
        'boardCommunity.board_id = board.id',
      )
      .leftJoinAndSelect('board.owner', 'owner')
      .where('board.visibility = :visibility', {
        visibility: BoardVisibility.PUBLIC,
      })
      .andWhere(
        '(board.community_id = :communityId OR boardCommunity.community_id = :communityId)',
        { communityId: community.id },
      )
      .orderBy('board.updated_at', 'DESC')
      .getMany();
    return this.communityService.enrichBoards(boards, currentUserId);
  }

  async setBoardCommunity(
    boardId: string,
    ownerId: string,
    slug: string | null,
  ): Promise<Board> {
    const board = await this.boardsRepository.findOneBy({
      id: boardId,
      ownerId,
    });
    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    if (slug === null) {
      board.communityId = null;
      return this.boardsRepository.save(board);
    }

    const community = await this.findBySlugOrFail(slug);
    const membership = await this.membersRepository.findOneBy({
      communityId: community.id,
      userId: ownerId,
    });
    if (!membership) {
      throw new ForbiddenException(
        `Join d/${community.slug} before posting to it.`,
      );
    }

    board.communityId = community.id;
    return this.boardsRepository.save(board);
  }

  async setBoardCommunities(
    boardId: string,
    ownerId: string,
    slugs: string[],
  ): Promise<Board> {
    const board = await this.boardsRepository.findOneBy({
      id: boardId,
      ownerId,
    });
    if (!board) {
      throw new NotFoundException(`Board ${boardId} not found`);
    }

    const uniqueSlugs = [
      ...new Set(slugs.map((slug) => slug.trim().toLowerCase())),
    ];
    const communities = await Promise.all(
      uniqueSlugs.map((slug) => this.findBySlugOrFail(slug)),
    );
    for (const community of communities) {
      const membership = await this.membersRepository.findOneBy({
        communityId: community.id,
        userId: ownerId,
      });
      if (!membership) {
        throw new ForbiddenException(
          `Join d/${community.slug} before posting to it.`,
        );
      }
    }

    board.communityId = communities[0]?.id ?? null;
    board.communities = communities;
    return this.boardsRepository.save(board);
  }

  private async findBySlugOrFail(slug: string): Promise<Community> {
    const community = await this.communitiesRepository.findOneBy({
      slug: slug.toLowerCase(),
    });
    if (!community) {
      throw new NotFoundException(`Community d/${slug} not found`);
    }
    return community;
  }

  private async summarise(
    communities: Community[],
    currentUserId: string,
  ): Promise<CommunitySummary[]> {
    if (communities.length === 0) return [];
    const ids = communities.map((c) => c.id);

    const [memberRows, boardRows, myMemberships] = await Promise.all([
      this.membersRepository
        .createQueryBuilder('m')
        .select('m.community_id', 'communityId')
        .addSelect('COUNT(*)', 'count')
        .where('m.community_id IN (:...ids)', { ids })
        .groupBy('m.community_id')
        .getRawMany<{ communityId: string; count: string }>(),
      this.boardsRepository.query<{ communityId: string; count: number }[]>(
        `SELECT "communityId", COUNT(DISTINCT "boardId")::int AS count
         FROM (
           SELECT b.id AS "boardId", b.community_id AS "communityId"
           FROM boards b
           WHERE b.community_id = ANY($1) AND b.visibility = $2
           UNION ALL
           SELECT bc.board_id AS "boardId", bc.community_id AS "communityId"
           FROM board_communities bc
           JOIN boards b ON b.id = bc.board_id
           WHERE bc.community_id = ANY($1) AND b.visibility = $2
         ) posted
         GROUP BY "communityId"`,
        [ids, BoardVisibility.PUBLIC],
      ),
      this.membersRepository.find({
        where: { communityId: In(ids), userId: currentUserId },
      }),
    ]);

    const memberCounts = new Map(
      memberRows.map((r) => [r.communityId, Number(r.count)]),
    );
    const boardCounts = new Map(
      boardRows.map((r) => [r.communityId, Number(r.count)]),
    );
    const roles = new Map(myMemberships.map((m) => [m.communityId, m.role]));

    return communities
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        memberCount: memberCounts.get(c.id) ?? 0,
        boardCount: boardCounts.get(c.id) ?? 0,
        joined: roles.has(c.id),
        role: roles.get(c.id) ?? null,
        createdAt: c.createdAt,
      }))
      .sort((a, b) => b.memberCount - a.memberCount);
  }
}
